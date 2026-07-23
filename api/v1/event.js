// api/v1/event.js
// -----------------------------------------------------------------------------
// Minimal first-party funnel-analytics sink for the ML Fitness apps.
//
// Accepts ANONYMOUS events (no PII) so the paywall / purchase funnel can be
// observed. Auth mirrors meal-scan.js: same APP_SHARED_SECRET + per-install id.
// Body: { event: string, ts?: number, context?: string }.
//
// Storage: for now it writes a structured, greppable line to the Vercel Function
// logs (filter by "FUNNEL"). This is zero-infra and enough to eyeball the funnel
// on a low-volume app. Upgrade path when aggregation is needed: increment daily
// per-event counters in Vercel KV / Upstash Redis, or attach a log drain.
// -----------------------------------------------------------------------------

const crypto = require('crypto');

function secretMatches(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const ALLOWED_EVENTS = new Set([
  'onboarding_complete',
  'first_scan',
  'paywall_shown',
  'buy_tapped',
  'purchase_success',
  'purchase_failed',
]);

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const sharedSecret = process.env.APP_SHARED_SECRET;
  if (!sharedSecret) {
    console.error('Server misconfigured — missing APP_SHARED_SECRET');
    return res.status(500).json({ error: 'server_misconfigured' });
  }
  if (!secretMatches(req.headers['x-app-secret'], sharedSecret)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const installId = req.headers['x-install-id'];
  if (!installId) return res.status(400).json({ error: 'missing_install_id' });
  const platform = String(req.headers['x-platform'] || '').toLowerCase();

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const event = String(body.event || '');
  if (!ALLOWED_EVENTS.has(event)) return res.status(400).json({ error: 'invalid_event' });

  const context = body.context != null ? String(body.context).slice(0, 64) : undefined;

  // Structured, greppable. No PII: anonymous install id + event + optional context.
  console.log('FUNNEL ' + JSON.stringify({
    event,
    context,
    platform,
    install: String(installId).slice(0, 36),
    ts: Number(body.ts) || Math.floor(Date.now() / 1000),
  }));

  return res.status(204).end();
};
