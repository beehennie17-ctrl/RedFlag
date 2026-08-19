# RedFlag

RedFlag is a Netlify-hosted quiz with Gumroad-gated results. The public app is served from `dist/index.html`; payment verification and scoring run only in Netlify Functions.

## Customer flow

1. The customer finishes the quiz and enters the email they will use at Gumroad.
2. RedFlag creates a signed, one-hour checkout session and opens Gumroad with that email prefilled.
3. Gumroad sends its Ping webhook after payment. The webhook verifies the issued license directly with Gumroad before recording the paid purchase in Supabase.
4. The original RedFlag tab checks the server for that purchase and reveals the server-calculated result automatically.

An old purchase cannot unlock a newly started checkout. Refunded, disputed, or charged-back purchases remain locked. The collapsed license-key form is a recovery option if a browser blocks or interrupts the automatic flow.

## Required Netlify environment variables

- `CHECKOUT_SESSION_SECRET`: a random secret of at least 32 characters used to sign temporary checkout sessions.
- `GUMROAD_PRODUCT_ID`: the product ID shown in Gumroad's license-key settings.
- `GUMROAD_WEBHOOK_SECRET`: a separate long random value used only in the Gumroad Ping endpoint URL.
- `SUPABASE_URL`: the Supabase project URL used for purchase records.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only Supabase service-role key. Never expose this in `dist` or commit it to GitHub.
- `GUMROAD_PRODUCT_URL` (optional): override the default RedFlag Gumroad product URL.

Generate secrets locally instead of typing a memorable password:

```bash
openssl rand -hex 32
```

Use a different generated value for `CHECKOUT_SESSION_SECRET` and `GUMROAD_WEBHOOK_SECRET`.

## Required Gumroad settings

1. Enable license keys for the RedFlag product.
2. Copy the product ID into Netlify as `GUMROAD_PRODUCT_ID`.
3. Set the Gumroad Ping endpoint to:

   `https://YOUR-NETLIFY-SITE.netlify.app/api/gumroad-webhook?secret=YOUR_GUMROAD_WEBHOOK_SECRET`

4. Keep the product checkout email field enabled. The customer must pay using the same email they entered in RedFlag; the checkout link prefills it.

Do not paste any production secret into GitHub, the browser code, or a support message.

## Supabase table

The existing `purchases` table must include these columns:

- `payment_id` (unique)
- `email`
- `product`
- `payment_provider`
- `status`
- `created_at`

## Deployment

Netlify reads `netlify.toml`, publishes `dist`, and deploys functions from `netlify/functions`. The automatic flow uses `/api/create-checkout-session`, `/api/checkout-status`, and `/api/gumroad-webhook`; `/api/verify-payment` remains available only for recovery.
