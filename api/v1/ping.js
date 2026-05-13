// Cheap health check — no auth, no upstream call. Useful for confirming
// the Vercel deployment is alive without touching Anthropic budget.
//
//   curl https://mochasmindlab.com/api/v1/ping
//   → { "ok": true, "service": "ml-fitness-proxy", "ts": "..." }

module.exports = function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'ml-fitness-proxy',
    ts: new Date().toISOString(),
  });
};
