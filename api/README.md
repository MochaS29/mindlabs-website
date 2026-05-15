# ML Fitness API proxy

Serverless functions that sit between the ML Fitness mobile apps (iOS + Android)
and third-party APIs that need a secret key. The apps never carry the secret —
only the proxy does.

## Endpoints

| Path | Method | Purpose |
|---|---|---|
| `/api/v1/ping` | GET | Health check. No auth, no upstream calls. Safe to hit. |
| `/api/v1/meal-scan` | POST | Forwards a base64 JPEG to Anthropic Claude for nutrition analysis. |

## Required environment variables (Vercel dashboard)

Set these under **Project → Settings → Environment Variables** for both
Production and Preview environments.

**Required (minimum to run):**

| Name | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Anthropic key. Used as the fallback / single-key setup. |
| `APP_SHARED_SECRET` | random 64-char string | Same value also embedded in released app builds (release config only). |

**Optional — set later when you want iOS + Android tracked separately:**

| Name | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY_IOS` | `sk-ant-...` | Used when an iOS app calls in (header `X-Platform: ios`). Falls back to `ANTHROPIC_API_KEY` if unset. |
| `ANTHROPIC_API_KEY_ANDROID` | `sk-ant-...` | Used when an Android app calls in (header `X-Platform: android`). Falls back to `ANTHROPIC_API_KEY` if unset. |

This gives separate spend caps + usage metrics per platform without any app
update — just set the env vars when you're ready and the proxy starts routing
automatically.

Generate `APP_SHARED_SECRET` with: `openssl rand -hex 32`

## App-side request

```http
POST /api/v1/meal-scan
Content-Type: application/json
X-App-Secret: <APP_SHARED_SECRET>
X-Install-Id: <per-install UUID generated on first launch>
X-Platform: ios | android

{
  "image": "<base64-encoded JPEG, no data: prefix>"
}
```

Response on success is Anthropic's raw `/v1/messages` JSON (the app already knows
how to parse it). On failure: `{ "error": "<code>" }` with status 4xx/5xx.

## Rate limits

In-memory only (lost on Vercel cold-start). First-line abuse protection:
- 10 scans per hour per install ID
- 50 scans per hour per IP

For tighter limits across instances, switch to Vercel KV later. The Anthropic
spend cap (set in console.anthropic.com) is the actual financial backstop.

## Local testing

```bash
# Ping
curl https://mochasmindlab.com/api/v1/ping

# Meal scan (you need a real shared secret + base64 image)
curl -X POST https://mochasmindlab.com/api/v1/meal-scan \
  -H "Content-Type: application/json" \
  -H "X-App-Secret: $APP_SHARED_SECRET" \
  -H "X-Install-Id: test-install-123" \
  -d '{"image":"<base64 jpeg here>"}'
```

## Rotating keys

1. Generate new `ANTHROPIC_API_KEY` in console.anthropic.com
2. Update Vercel env var
3. Redeploy (Vercel auto-redeploys on env var change)
4. Revoke old key in Anthropic dashboard

The apps never see the Anthropic key, so rotation needs no app update.

To rotate `APP_SHARED_SECRET`, you have to ship app updates with the new value.
Plan rotation carefully — old app versions break until users update.
