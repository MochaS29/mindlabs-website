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
Production and Preview environments:

| Name | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Your real Anthropic key. Server-side only — never in the app binary. |
| `APP_SHARED_SECRET` | random 64-char string | Same value also embedded in the released app builds (release config only). |

Generate `APP_SHARED_SECRET` with: `openssl rand -hex 32`

## App-side request

```http
POST /api/v1/meal-scan
Content-Type: application/json
X-App-Secret: <APP_SHARED_SECRET>
X-Install-Id: <per-install UUID generated on first launch>

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
