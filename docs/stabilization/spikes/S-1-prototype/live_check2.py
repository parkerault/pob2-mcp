import json, sys, time, urllib.parse
sys.argv=[sys.argv[0], sys.argv[1]]
exec(open(sys.argv[1]+"/live_check.py").read().split("out = {}")[0])  # reuse req()/search() helpers only
count = 2  # 2 requests already spent in live_check.py (both 400)
MAX_REQ = 4
out = {}
st, j, q = search("q_body_count.json")
out["body_count_search"] = {"status": st, "total": j.get("total"), "n": len(j.get("result") or []), "id": j.get("id"), "complexity": j.get("complexity"), "error": j.get("error")}
print(out["body_count_search"])
ids = (j.get("result") or [])[:10]
if st == 200 and ids:
    url = f"{HOST}/api/trade2/fetch/{','.join(ids)}?query={j['id']}&realm=poe2"
    st2, raw = req("GET", url)
    open(f"{S1}/fetch_body.json", "wb").write(raw)
    out["body_fetch"] = {"status": st2, "n": len(json.loads(raw).get("result") or []), "queryId": j["id"]}
    print(out["body_fetch"])
out["requests"] = log
json.dump(out, open(f"{S1}/live_out2.json", "w"), indent=1)
