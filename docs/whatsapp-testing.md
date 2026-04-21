# WhatsApp Testing Recipe

## Local dev with Meta test number

1. In [developers.facebook.com](https://developers.facebook.com/), create a
   WhatsApp Business app. The dashboard gives you a test `phone_number_id`,
   a temporary `access_token` (24h), and an `app_secret`.
2. Copy those into `.env.local`:
   ```
   WHATSAPP_PHONE_NUMBER_ID=...
   WHATSAPP_ACCESS_TOKEN=...
   WHATSAPP_APP_SECRET=...
   WHATSAPP_VERIFY_TOKEN=any-string-you-pick
   ```
3. In the Meta dashboard, add your phone as a recipient. Only whitelisted
   recipients can receive test messages.
4. Expose localhost with `ngrok http 3000` or `cloudflared`.
5. Configure the webhook in the Meta dashboard:
   - Callback URL: `https://<tunnel>/api/webhooks/whatsapp`
   - Verify token: same as `WHATSAPP_VERIFY_TOKEN`
   - Fields: `messages`

## Smoke tests

### Inbound routing
WhatsApp your test number the literal word `HELP`. You should receive the
command list within ~1s.

### TOP flow
Send `TOP 500`. You should get a Paystack payment link. Complete the charge
with test card `4084084084084081 / 408 / 04 / 26 / 1234`. Within ~5s the
reconnect-confirmation template should arrive.

### Unit tests
```
pnpm test lib/whatsapp
```

Covers: `parseMessage`, `parseAmountKobo`, `toE164Nigeria`,
`verifyWhatsAppSignature` edge cases.

## Production cutover checklist

- [ ] Submit 5 templates for Meta approval (`docs/whatsapp-templates.md`).
- [ ] Replace dev access token with a permanent system-user token.
- [ ] Configure Vercel Cron secret and verify daily-summary fires at 20:00
      Africa/Lagos.
- [ ] Set `WHATSAPP_APP_SECRET` — **required** in prod; without it the webhook
      rejects all inbound.
- [ ] Smoke-test SMS fallback by revoking the access token briefly and
      confirming Termii delivery + `status='fell_back_to_sms'` rows.
