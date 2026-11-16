# WhatsApp templates — so alerts and confirmations arrive without the recipient writing first

WhatsApp lets a business send free text only to someone who wrote to it in the last 24 hours. Outside that window the only thing Meta delivers is an **approved template**. The assistant already supports this: set a variable to the template's name and that kind of message is sent through it.

| Variable in Cloudflare | Used for | Language |
|---|---|---|
| `WA_TPL_TEAM_ALERT` | front-desk alerts (paid, undelivered, form filled, urgent) | English |
| `WA_TPL_DOCTOR_ALERT` | messages, refill and call requests for Dr. Bibi | English |
| `WA_TPL_CONFIRMED` | the client's "appointment confirmed + form" message | English **and** Arabic |
| `WA_TPL_PAYMENT_LINK` | payment link sent to a client | English **and** Arabic |

## Create the staff-alert template (one template serves both staff variables)
1. business.facebook.com → **WhatsApp Manager** → *Message templates* → **Create template**.
2. Category **Utility** · Name `tawasol_team_alert` · Language **English** (plain "English", code `en` — not "English (US)").
3. Body: `Tawasol assistant alert: {{1}} Reply here to open the chat.`
   Sample for {{1}}: `Paid and confirmed · Sara Ahmed · Psychiatric follow-up · Sunday 22 November 4:00 pm · TW-AB12CD`
4. Submit and wait until the status is **Active**.
5. Cloudflare → worker → Variables: `WA_TPL_TEAM_ALERT = tawasol_team_alert` and `WA_TPL_DOCTOR_ALERT = tawasol_team_alert` → Deploy.
6. Check: open the diagnostic link with `&send=1`. The `templates` block lists what is set, and the test alert should arrive even if the phone has not written for a day.

## Client templates (before going live)
Same steps, in **English and Arabic** under one name, e.g. `tawasol_confirmed` with body `Tawasol clinic: {{1}} Reply here if you need anything.` — then `WA_TPL_CONFIRMED = tawasol_confirmed`. Through a template the message has no button; the text already says to reply "done".

## Good to know
- A template variable cannot contain line breaks, so a message sent this way arrives as one line and is cut at 900 characters.
- Meta can reject or re-categorise a template that is mostly a variable; if that happens, add more fixed words around {{1}}.
- Meta charges per template message sent outside an open chat. Free text inside an open chat stays free.
- Without templates nothing is lost: a staff alert WhatsApp drops is queued and handed over the moment that phone next writes to the assistant (`undelivered_alerts` in the diagnostic shows how many are waiting).
