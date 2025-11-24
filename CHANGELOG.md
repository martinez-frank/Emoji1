# Changelog

## v0.9.0 — Admin + Orders MVP (2025-11-24)

- Added `emoji_orders` admin panel with secure passphrase access.
- Wired upload → Supabase `emoji_orders` table.
- Implemented `/api/orders` endpoint with pagination (limit + offset).
- Implemented `/api/notify` endpoint for email/SMS notifications.
- Added auto-refresh, filtering, and pagination controls in `orders.html`.
- Verified end-to-end flow with 80+ test orders and successful email notifications.
