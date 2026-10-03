#!/usr/bin/env python3
"""S-1 live check: POST generated trade2 queries and fetch <=10 results.
Hard cap of 4 HTTP requests. Generic UA only, no cookies, no identity."""
import json, sys, time, urllib.request, urllib.error, urllib.parse

S1 = sys.argv[1]
LEAGUE = "Runes of Aldur"
HOST = "https://www.pathofexile.com"
UA = "pob2-mcp-server/0.1"
MAX_REQ = 4
count = 0
last_headers = {}
log = []


def rate_wait():
    """Honor X-Rate-Limit-* state from the previous response: if any rule is restricted, or at its
    limit, wait for the restriction / window. Always leave >=1.5 s between requests."""
    wait = 1.5
    for k, v in last_headers.items():
        kl = k.lower()
        if not kl.startswith("x-rate-limit-") or kl.endswith("-state") or kl in ("x-rate-limit-policy", "x-rate-limit-rules"):
            continue
        state = last_headers.get(k + "-State") or last_headers.get(k + "-state")
        if not state:
            continue
        for rule, st in zip(v.split(","), state.split(",")):
            lim, period, _pen = map(int, rule.split(":"))
            hits, _p, restricted = map(int, st.split(":"))
            if restricted > 0:
                wait = max(wait, restricted + 1)
            elif hits >= lim - 1:
                wait = max(wait, period + 1)
    time.sleep(wait)


def req(method, url, body=None):
    global count, last_headers
    if count >= MAX_REQ:
        raise SystemExit("request budget exhausted")
    if count > 0:
        rate_wait()
    count += 1
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
                               headers={"User-Agent": UA, "Content-Type": "application/json", "Accept": "application/json"})
    t0 = time.monotonic()
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            status, hdrs, raw = resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as e:
        status, hdrs, raw = e.code, dict(e.headers), e.read()
    ms = (time.monotonic() - t0) * 1000
    last_headers = hdrs
    rl = {k: v for k, v in hdrs.items() if k.lower().startswith("x-rate-limit") or k.lower() == "retry-after"}
    log.append({"n": count, "method": method, "url": url.split("?")[0], "status": status, "ms": round(ms), "rateLimit": rl})
    print(f"[{count}] {method} {url[:110]} -> {status} ({ms:.0f} ms) {rl}", flush=True)
    if status == 429:
        ra = int(hdrs.get("Retry-After", "60"))
        print(f"429: backing off {ra}s", flush=True)
        time.sleep(ra)
    return status, raw


def search(qfile):
    q = json.load(open(f"{S1}/{qfile}"))
    url = f"{HOST}/api/trade2/search/poe2/{urllib.parse.quote(LEAGUE)}"
    status, raw = req("POST", url, q)
    try:
        j = json.loads(raw)
    except Exception:
        j = {"raw": raw[:500].decode(errors="replace")}
    return status, j, q


out = {}
# 1. body armour (with required stat + max price + max level)
st, j, q = search("q_body.json")
out["body_search"] = {"status": st, "total": j.get("total"), "n": len(j.get("result") or []), "id": j.get("id"),
                      "error": j.get("error"), "complexity": j.get("complexity")}
print("body search:", out["body_search"])
ids = (j.get("result") or [])[:10]
if st == 200 and not ids:
    # PoB's SearchWithQueryWeightAdjusted halves the min weight when too few results (TradeQueryRequests.lua:175-179)
    q["query"]["stats"][0]["value"]["min"] /= 2
    json.dump(q, open(f"{S1}/q_body_halved.json", "w"))
    st, j, q = search("q_body_halved.json")
    out["body_search_halved"] = {"status": st, "total": j.get("total"), "n": len(j.get("result") or []), "id": j.get("id")}
    print("halved:", out["body_search_halved"])
    ids = (j.get("result") or [])[:10]

# 2. fetch <=10
if ids:
    url = f"{HOST}/api/trade2/fetch/{','.join(ids)}?query={j['id']}&realm=poe2"
    st, raw = req("GET", url)
    open(f"{S1}/fetch_body.json", "wb").write(raw)
    fj = json.loads(raw)
    out["body_fetch"] = {"status": st, "n": len(fj.get("result") or []), "queryId": j["id"],
                         "url": f"{HOST}/trade2/search/poe2/{urllib.parse.quote(LEAGUE)}/{j['id']}"}
    print("fetch:", out["body_fetch"])

# 3. second slot type: weapon query accepted?
if count < MAX_REQ:
    st, j, _ = search("q_weapon.json")
    out["weapon_search"] = {"status": st, "total": j.get("total"), "n": len(j.get("result") or []), "id": j.get("id"),
                            "error": j.get("error"), "complexity": j.get("complexity")}
    print("weapon search:", out["weapon_search"])

out["requests"] = log
json.dump(out, open(f"{S1}/live_out.json", "w"), indent=1)
