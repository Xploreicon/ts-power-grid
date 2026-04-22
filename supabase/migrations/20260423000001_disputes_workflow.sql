-- ============================================================================
-- 20260423000001_disputes_workflow.sql
-- Extends disputes for the full resolution workflow: context snapshots,
-- escalation, SLA tracking, investigation notes, and refund linkage.
--
-- ROLLBACK:
--   ALTER TYPE public.dispute_category DROP VALUE IF EXISTS 'auto_detect';
--   ALTER TYPE public.dispute_status DROP VALUE IF EXISTS 'escalated';
--   ALTER TYPE public.dispute_status DROP VALUE IF EXISTS 'awaiting_info';
--   ALTER TABLE public.disputes DROP COLUMN IF EXISTS context;
--   ALTER TABLE public.disputes DROP COLUMN IF EXISTS assigned_to;
--   ALTER TABLE public.disputes DROP COLUMN IF EXISTS escalated_to;
--   ALTER TABLE public.disputes DROP COLUMN IF EXISTS escalated_at;
--   ALTER TABLE public.disputes DROP COLUMN IF EXISTS sla_acknowledged_at;
--   ALTER TABLE public.disputes DROP COLUMN IF EXISTS photos;
--   ALTER TABLE public.disputes DROP COLUMN IF EXISTS source;
--   ALTER TABLE public.disputes DROP COLUMN IF EXISTS refund_amount_kobo;
--   ALTER TABLE public.disputes DROP COLUMN IF EXISTS refund_source;
--   DROP TABLE IF EXISTS public.dispute_notes CASCADE;
-- ============================================================================

-- 1. Extend enums ---------------------------------------------------------------
DO $$
BEGIN
  -- Add 'auto_detect' to dispute_category if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'auto_detect'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'dispute_category')
  ) THEN
    ALTER TYPE public.dispute_category ADD VALUE 'auto_detect';
  END IF;

  -- Add 'escalated' to dispute_status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'escalated'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'dispute_status')
  ) THEN
    ALTER TYPE public.dispute_status ADD VALUE 'escalated';
  END IF;

  -- Add 'awaiting_info' to dispute_status if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'awaiting_info'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'dispute_status')
  ) THEN
    ALTER TYPE public.dispute_status ADD VALUE 'awaiting_info';
  END IF;
END $$;

-- 2. Extend disputes table -----------------------------------------------------
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalated_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS photos text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pwa',
  ADD COLUMN IF NOT EXISTS refund_amount_kobo numeric(18,0),
  ADD COLUMN IF NOT EXISTS refund_source text;

COMMENT ON COLUMN public.disputes.context IS 'JSON snapshot of connection state, transactions, meter readings, and wallet balance at time of dispute.';
COMMENT ON COLUMN public.disputes.source IS 'Origin: pwa | whatsapp';
COMMENT ON COLUMN public.disputes.refund_amount_kobo IS 'Amount refunded (in kobo) if resolved with refund.';
COMMENT ON COLUMN public.disputes.refund_source IS 'Source of refund: host | treasury';

CREATE INDEX IF NOT EXISTS disputes_assigned_to_idx ON public.disputes (assigned_to);

-- 3. Dispute notes (threaded investigation) -----------------------------------
CREATE TABLE IF NOT EXISTS public.dispute_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES public.disputes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dispute_notes_dispute_id_idx ON public.dispute_notes (dispute_id);

-- 4. process_refund RPC --------------------------------------------------------
-- Atomically credits recipient wallet and creates a refund transaction linked
-- to a dispute. If source = 'host', also debits the host wallet.
CREATE OR REPLACE FUNCTION public.process_refund(
  p_dispute_id uuid,
  p_amount_kobo bigint,
  p_source text,          -- 'host' | 'treasury'
  p_recipient_id uuid,
  p_host_id uuid DEFAULT NULL,
  p_connection_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recipient_wallet_id uuid;
  v_host_wallet_id uuid;
  v_txn_id uuid;
  v_new_balance bigint;
BEGIN
  -- Validate amount
  IF p_amount_kobo <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive';
  END IF;

  -- Get recipient wallet
  SELECT id INTO v_recipient_wallet_id
    FROM public.wallets WHERE user_id = p_recipient_id;
  IF v_recipient_wallet_id IS NULL THEN
    -- Auto-create wallet if missing
    INSERT INTO public.wallets (user_id, balance) VALUES (p_recipient_id, 0)
      RETURNING id INTO v_recipient_wallet_id;
  END IF;

  -- If source = 'host', debit the host
  IF p_source = 'host' THEN
    IF p_host_id IS NULL THEN
      RAISE EXCEPTION 'host_id required when source is host';
    END IF;
    SELECT id INTO v_host_wallet_id
      FROM public.wallets WHERE user_id = p_host_id;
    IF v_host_wallet_id IS NULL THEN
      RAISE EXCEPTION 'Host wallet not found';
    END IF;

    -- Check sufficient balance
    IF (SELECT balance FROM public.wallets WHERE id = v_host_wallet_id) < p_amount_kobo THEN
      RAISE EXCEPTION 'Host wallet has insufficient balance for refund';
    END IF;

    -- Debit host
    UPDATE public.wallets
      SET balance = balance - p_amount_kobo, updated_at = now()
      WHERE id = v_host_wallet_id;

    -- Record host debit transaction
    INSERT INTO public.transactions (wallet_id, type, amount, connection_id, status, metadata)
      VALUES (
        v_host_wallet_id,
        'refund',
        -p_amount_kobo,
        p_connection_id,
        'success',
        jsonb_build_object('dispute_id', p_dispute_id, 'direction', 'debit', 'source', p_source)
      );
  END IF;
  -- If source = 'treasury', no wallet is debited — T&S absorbs the cost.

  -- Credit recipient
  UPDATE public.wallets
    SET balance = balance + p_amount_kobo, updated_at = now()
    WHERE id = v_recipient_wallet_id
    RETURNING balance INTO v_new_balance;

  -- Record recipient credit transaction
  INSERT INTO public.transactions (wallet_id, type, amount, connection_id, status, metadata)
    VALUES (
      v_recipient_wallet_id,
      'refund',
      p_amount_kobo,
      p_connection_id,
      'success',
      jsonb_build_object('dispute_id', p_dispute_id, 'direction', 'credit', 'source', p_source)
    )
    RETURNING id INTO v_txn_id;

  -- Tag the dispute with refund info
  UPDATE public.disputes
    SET refund_amount_kobo = p_amount_kobo,
        refund_source = p_source
    WHERE id = p_dispute_id;

  RETURN jsonb_build_object(
    'transaction_id', v_txn_id,
    'new_balance_kobo', v_new_balance,
    'amount_kobo', p_amount_kobo
  );
END;
$$;
