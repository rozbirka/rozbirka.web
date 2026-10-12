# Telegram support on the landing

Set the public `VITE_TELEGRAM_SUPPORT_BOT` build variable to the new bot's username
(with or without `@`) for both QA and production. No bot token belongs in Vite
variables. Missing/invalid configuration hides both links; there is no placeholder
account or mock success destination.

The floating brand pill and footer link open the same private Telegram chat in a
new window. The landing locale determines labels; the bot itself asks the visitor
to choose Ukrainian, English or Polish. These links do not submit a form or call
Core. The backend setup is documented in `rozbirka.core/docs/telegram-support.md`.
