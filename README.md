# RedFlag

RedFlag is a Netlify-hosted quiz with Gumroad-gated results. The public app is served from `dist/index.html`; server-side payment verification lives in `netlify/functions`.

## Required Netlify environment variables

- `GUMROAD_PRODUCT_ID`: the product ID shown in Gumroad's license-key settings.
- `GUMROAD_WEBHOOK_SECRET`: a long random value used only in the Gumroad Ping endpoint URL.
- `SUPABASE_URL`: the Supabase project URL used for purchase records.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only Supabase service-role key. Never expose this in `dist` or commit it to GitHub.

## Required Gumroad settings

1. Enable license keys for the RedFlag product.
2. Copy the product ID into Netlify as `GUMROAD_PRODUCT_ID`.
3. Set the Gumroad Ping endpoint to:

   `https://YOUR-NETLIFY-SITE.netlify.app/api/gumroad-webhook?secret=YOUR_GUMROAD_WEBHOOK_SECRET`

The buyer completes checkout in a new tab, returns to the RedFlag paywall, and enters the license key from their Gumroad receipt. The Netlify function verifies the key directly with Gumroad before calculating and returning the paid result.

## Deployment

Netlify reads `netlify.toml`, publishes `dist`, and deploys functions from `netlify/functions`.

