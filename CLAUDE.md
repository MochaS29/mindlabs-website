# mochasmindlab.com

Five static HTML pages on Vercel (`index`, `about`, `calorie-counter-without-subscription`,
`support`, `privacy`), no build step. The apex is canonical; `www` and the `mochamindlabs.com`
spellings redirect to it. A push to `main` deploys.

## Analytics

`analytics.js` is the one `track()` that reports to GA4 and PostHog together, so the two can never
drift. It follows `~/Desktop/vex/docs/TRACKING-STANDARD.md`: `store_click` (the conversion, and the
GA4 key event), `cta_click`, `outbound_click`, `scroll_depth`. No forms on this site, so no `form_*`.

- **Both tools load only on `mochasmindlab.com`** — `analytics.js` and the GA4 snippet in each
  page's `<head>` check the hostname. Localhost and Vercel previews send nothing.
- **Events queue until `posthog.__loaded`.** `posthog.capture()` before the client finishes loading
  sends nothing and throws nothing; without the queue the first click of a visit reached GA4 only.
- **PostHog ignores automated browsers** (`_is_bot()`), so Playwright can never prove PostHog
  delivery. GA4 does accept headless traffic — which is why a verification walk must be **one walk
  per deploy, with `traffic_type: "internal"` on every event**, and every other browser check must
  block `googletagmanager.com`, `google-analytics.com` and `*.posthog.com`.

### ML Fitness funnel events (`api/v1/event.js`)

The ML Fitness apps POST anonymous funnel events (`paywall_shown`, `buy_tapped`,
`purchase_success`, and so on) to `/api/v1/event`. The function always writes a `FUNNEL` line to
the Vercel logs, and when `EVENTS_SUPABASE_URL` + `EVENTS_SUPABASE_ANON_KEY` are set in Vercel it
also stores each event durably by calling the `log_fitness_event()` RPC in the **Mindful Meal
Plans** Supabase project (ML Fitness has no backend of its own). The anon key can only call that
RPC; it cannot read the table. Rows land in `public.fitness_events` (migration
`20260918120000_fitness_events.sql` in `meal-plans-pivot`). A failed store logs
`FUNNEL_STORE_FAIL` and never fails the request. Read the funnel in the Meal Plans SQL editor:

```sql
select * from public.fitness_funnel_weekly order by week desc;               -- distinct installs per step, by ISO week
select event, count(*) from public.fitness_events
 where created_at > now() - interval '7 days' group by 1 order by 2 desc;    -- raw counts, last 7 days
```

## Reading our analytics

Read-only, this brand only, 60 requests a minute. `VEX_ANALYTICS_KEY` and `VEX_ANALYTICS_URL` live
in the gitignored `.env` (master copy: `~/.config/activeq/analytics-keys/mochasmindlab.env`). Never
print the key or commit it.

```sh
set -a && . ./.env && set +a
q() { curl -s -X POST "$VEX_ANALYTICS_URL" -H "Authorization: Bearer $VEX_ANALYTICS_KEY" \
      -H "content-type: application/json" -d "$1"; }

q '{"source":"whoami"}'
q '{"source":"posthog","query":"select event, count() from events where timestamp > now() - interval 7 day group by event"}'
q '{"source":"ga4_realtime","report":{"metrics":[{"name":"eventCount"}],"dimensions":[{"name":"eventName"}]}}'
q '{"source":"search_console","request":{"startDate":"2026-09-01","endDate":"2026-09-17","dimensions":["query"],"rowLimit":10}}'
```

Sources: `ga4` and `ga4_realtime` take a `report` (a `runReport` body without `property`),
`posthog` takes HogQL starting with `select` and no `;`, `search_console` takes a `request`
(a `searchAnalytics.query` body without `siteUrl`). Ids: GA4 `properties/552894389`,
PostHog project `524555`, `sc-domain:mochasmindlab.com`. Anything that **writes** — key events,
filters, property settings — goes to the vex session, which holds the write access.

## Usage stats and logs
- Analytics without a browser: `python3 ~/Development/Scripts-Tools/analytics/analytics.py posthog events mochasmindlab 7`, `ga4 sessions mochasmindlab 7`, `posthog funnel mochasmindlab <event> <event> ... --days 30`. Credentials live only in `~/Development/.analytics.env`; never copy them into this repo.
- Request logs (public pages, gated app routes, admin): the Vercel plugin's `get_runtime_logs` (project id in `.vercel/project.json`; group by route or statusCode for patterns) or `vercel logs <domain>`; user agents show only in the Vercel dashboard log detail.
- ML Fitness funnel events posted to `/api/v1/event` are stored in the Meal Plans Supabase project (`fitness_funnel_weekly`); the `FUNNEL` log line remains in Vercel logs.
