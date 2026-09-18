#!/usr/bin/env python3
"""Read usage stats for Mocha's products from PostHog and GA4 without a browser.

Credentials come from env vars (POSTHOG_API_KEY, POSTHOG_HOST,
GA4_SERVICE_ACCOUNT_JSON as a path or the JSON itself, GA4_PROPERTIES) so cloud
agents (GitHub Actions secrets, Vercel env, the Claude Code environment) and
local sessions (~/Development/.analytics.env) use the same script. Never
commit the values. Reads, plus PostHog insights and dashboards; never spends.

Usage:
  analytics.py projects
  analytics.py posthog events <project> [days]          # named events, count by name
  analytics.py posthog funnel <project> <e1> <e2> ... [--days N]
  analytics.py posthog sql <project> "<HogQL>"
  analytics.py ga4 sessions <property> [days]           # sessions, users, key events by day
  analytics.py ga4 events <property> [days]             # event counts
  analytics.py ga4 pages <property> [days]              # top pages by views

<project> / <property> accept a short name (happygrants, mindfulmealplan,
mochashmigelsky, mochasmindlab, certalot) or a raw id.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ENV = os.path.expanduser("~/Development/.analytics.env")

POSTHOG_PROJECTS = {
    "happygrants": 522783,
    "mochashmigelsky": 524542,
    "mochasmindlab": 524555,
    "certalot": 524609,
    "mindfulmealplan": 524615,
}


def load_env():
    """Env vars win (cloud agents: GitHub Actions secrets, Vercel env, the
    Claude Code environment). The local file is the fallback on Mocha's Mac."""
    if os.path.exists(ENV):
        for line in open(ENV):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k, v)
    missing = [k for k in ("POSTHOG_API_KEY", "GA4_SERVICE_ACCOUNT_JSON", "GA4_PROPERTIES") if not os.environ.get(k)]
    if missing:
        sys.exit("missing " + ", ".join(missing) + ": set them as env vars (GitHub Actions secrets, Vercel env, "
                 "or the Claude Code environment) or in ~/Development/.analytics.env; see Linear MOC-426")
    os.environ.setdefault("POSTHOG_HOST", "https://us.posthog.com")


def ga4_properties():
    out = {}
    for pair in os.environ.get("GA4_PROPERTIES", "").split(","):
        if ":" in pair:
            n, i = pair.split(":", 1)
            out[n.strip()] = i.strip()
    return out


def resolve(name, table):
    if name in table:
        return table[name]
    if name.isdigit():
        return int(name) if isinstance(next(iter(table.values()), 0), int) else name
    sys.exit(f"unknown name {name!r}; known: {', '.join(table)}")


# ---------------------------------------------------------------- PostHog

def ph_query(project_id, hogql):
    host = os.environ.get("POSTHOG_HOST", "https://us.posthog.com")
    body = json.dumps({"query": {"kind": "HogQLQuery", "query": hogql}}).encode()
    req = urllib.request.Request(
        f"{host}/api/projects/{project_id}/query/",
        data=body,
        headers={"Authorization": f"Bearer {os.environ['POSTHOG_API_KEY']}",
                 "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        d = json.load(r)
    return d.get("columns", []), d.get("results", [])


def table(cols, rows):
    if not rows:
        print("  (no rows)")
        return
    widths = [max(len(str(c)), *(len(str(r[i])) for r in rows)) for i, c in enumerate(cols)]
    print("  " + "  ".join(str(c).ljust(w) for c, w in zip(cols, widths)))
    for r in rows:
        print("  " + "  ".join(str(v).ljust(w) for v, w in zip(r, widths)))


def cmd_posthog(args):
    sub, project = args[0], resolve(args[1], POSTHOG_PROJECTS)
    if sub == "events":
        days = int(args[2]) if len(args) > 2 else 7
        cols, rows = ph_query(project, f"""
            select event, count() as events, count(distinct person_id) as people
            from events where timestamp > now() - interval {days} day
            and event not like '$%' group by event order by events desc limit 40""")
        print(f"PostHog {args[1]}: named events, last {days} days")
        table(cols, rows)
    elif sub == "funnel":
        rest = args[2:]
        days = 30
        if "--days" in rest:
            i = rest.index("--days"); days = int(rest[i + 1]); rest = rest[:i] + rest[i + 2:]
        steps = rest
        if len(steps) < 2:
            sys.exit("funnel needs at least two event names")
        parts = ", ".join(f"countIf(event = '{s}') > 0 as s{i}" for i, s in enumerate(steps))
        conds = " and ".join(f"s{j}" for j in range(len(steps)))
        cols, rows = ph_query(project, f"""
            select {", ".join(f"countIf({' and '.join(f's{j}' for j in range(i + 1))}) as step{i + 1}" for i in range(len(steps)))}
            from (select person_id, {parts} from events
                  where timestamp > now() - interval {days} day group by person_id)""")
        counts = rows[0] if rows else [0] * len(steps)
        print(f"PostHog {args[1]}: funnel over {days} days (people who did every step so far)")
        prev = None
        for s, c in zip(steps, counts):
            conv = "" if prev in (None, 0) else f"  ({100 * c / prev:.0f}% of previous)"
            print(f"  {c:>7}  {s}{conv}")
            prev = c
    elif sub == "sql":
        cols, rows = ph_query(project, args[2])
        table(cols, rows)
    else:
        sys.exit("posthog: events | funnel | sql")


# ------------------------------------------------------------------- GA4

def ga4_token():
    """Service-account JWT exchange, no client library needed."""
    import base64
    import hashlib
    raw = os.environ["GA4_SERVICE_ACCOUNT_JSON"]
    # Either a path to the key file (local) or the JSON itself (a secret in a cloud agent).
    sa = json.loads(raw) if raw.lstrip().startswith("{") else json.load(open(os.path.expanduser(raw)))
    try:
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import padding
    except ImportError:
        sys.exit("pip3 install cryptography (needed once, for the GA4 signature)")
    now = int(time.time())
    b64 = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
    header = b64(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64(json.dumps({
        "iss": sa["client_email"], "scope": "https://www.googleapis.com/auth/analytics.readonly",
        "aud": "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 3600}).encode())
    key = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
    sig = b64(key.sign(f"{header}.{claims}".encode(), padding.PKCS1v15(), hashes.SHA256()))
    data = urllib.parse.urlencode({"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                                   "assertion": f"{header}.{claims}.{sig}"}).encode()
    with urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data), timeout=30) as r:
        return json.load(r)["access_token"]


def ga4_report(prop, body):
    req = urllib.request.Request(
        f"https://analyticsdata.googleapis.com/v1beta/properties/{prop}:runReport",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {ga4_token()}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def ga4_rows(d):
    cols = [h["name"] for h in d.get("dimensionHeaders", [])] + [h["name"] for h in d.get("metricHeaders", [])]
    rows = [[v["value"] for v in r.get("dimensionValues", [])] + [v["value"] for v in r.get("metricValues", [])]
            for r in d.get("rows", [])]
    return cols, rows


def cmd_ga4(args):
    sub, prop = args[0], resolve(args[1], ga4_properties())
    days = int(args[2]) if len(args) > 2 else 7
    rng = [{"startDate": f"{days}daysAgo", "endDate": "today"}]
    if sub == "sessions":
        d = ga4_report(prop, {"dateRanges": rng, "dimensions": [{"name": "date"}],
                              "metrics": [{"name": "sessions"}, {"name": "totalUsers"}, {"name": "keyEvents"}],
                              "orderBys": [{"dimension": {"dimensionName": "date"}}]})
    elif sub == "events":
        d = ga4_report(prop, {"dateRanges": rng, "dimensions": [{"name": "eventName"}],
                              "metrics": [{"name": "eventCount"}, {"name": "totalUsers"}],
                              "orderBys": [{"metric": {"metricName": "eventCount"}, "desc": True}], "limit": 40})
    elif sub == "pages":
        d = ga4_report(prop, {"dateRanges": rng, "dimensions": [{"name": "pagePath"}],
                              "metrics": [{"name": "screenPageViews"}, {"name": "totalUsers"}],
                              "orderBys": [{"metric": {"metricName": "screenPageViews"}, "desc": True}], "limit": 25})
    else:
        sys.exit("ga4: sessions | events | pages")
    print(f"GA4 {args[1]} ({prop}): {sub}, last {days} days")
    table(*ga4_rows(d))


def main(argv):
    load_env()
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__); return
    if argv[0] == "projects":
        print("PostHog:"); [print(f"  {v:>7}  {k}") for k, v in POSTHOG_PROJECTS.items()]
        print("GA4:"); [print(f"  {v:>10}  {k}") for k, v in ga4_properties().items()]
    elif argv[0] == "posthog":
        cmd_posthog(argv[1:])
    elif argv[0] == "ga4":
        cmd_ga4(argv[1:])
    else:
        print(__doc__); sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1:])
