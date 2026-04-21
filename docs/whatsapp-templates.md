# WhatsApp Message Templates

We submit these to Meta Business Manager for approval. Each is used by
`lib/whatsapp/proactive.ts` for messages sent outside the 24-hour customer-care
window.

| Template name          | Category   | Variables                                      |
| ---------------------- | ---------- | ---------------------------------------------- |
| `welcome_connection`   | UTILITY    | `{{1}}` host name, `{{2}}` price per kWh       |
| `low_balance_warning`  | UTILITY    | `{{1}}` formatted balance (e.g. ₦180.00)       |
| `meter_disconnected`   | UTILITY    | —                                              |
| `meter_reconnected`    | UTILITY    | `{{1}}` new balance                            |
| `daily_summary`        | UTILITY    | `{{1}}` kWh, `{{2}}` spent, `{{3}}` balance    |

## Copy (submit verbatim)

### welcome_connection
> Welcome to T&S Power Grid! You're now connected to {{1}}'s solar grid at ₦{{2}}/kWh. Reply HELP anytime for the list of commands, or TOP 500 to top up ₦500.

### low_balance_warning
> ⚠️ Your T&S Power wallet balance is {{1}}. Reply TOP 500 to top up and avoid disconnection.

### meter_disconnected
> 🔌 Your T&S Power meter has been disconnected because your wallet balance reached ₦0. Reply TOP 500 to reconnect automatically.

### meter_reconnected
> ✅ Your T&S Power meter is back on. New wallet balance: {{1}}. Thanks for topping up.

### daily_summary
> 📊 Today's power: {{1}} used, {{2}} spent. Balance: {{3}}. Reply USAGE for the 7-day breakdown.

## Notes

- All templates are `en` (language code). Yoruba/pidgin variants tracked in
  `issue #future`.
- Opt-out: users reply STOP to pause `auto_reconnect`, but they can disable
  all WhatsApp outbound by flipping `notification_prefs.whatsapp_opt_in=false`
  from the host dashboard.
