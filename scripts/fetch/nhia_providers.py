# Fetches the NHIA accredited-provider list for Greater Accra from https://nhis.gov.gh/providers
# (an ASP.NET page: select the region, then page through 14 pages of 30). See data/nhia/SOURCE.md.
# Run: python -I scripts/fetch/nhia_providers.py <empty output folder>. Writes greater_accra_raw.csv.
import re, time, sys, json, urllib.request, urllib.parse, http.cookiejar, html
out = sys.argv[1]
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def _open(req, tries=6):
    for k in range(tries):
        try:
            return op.open(req, timeout=60).read().decode("utf-8", "replace")
        except Exception as e:
            print("retry", k, e); time.sleep(5 * (k + 1))
    raise SystemExit("gave up")
op.addheaders = [("User-Agent", "Mozilla/5.0 (Veriq Health data import)")]
URL = "https://nhis.gov.gh/providers"
page = _open(URL)
def hidden(p):
    return {m.group(1): html.unescape(m.group(2)) for m in re.finditer(r'<input type="hidden" name="([^"]+)" id="[^"]*" value="([^"]*)"', p)}
f = hidden(page)
f["__EVENTTARGET"] = "ctl00$ContentPlaceHolder1$rdRegion"
f["__EVENTARGUMENT"] = json.dumps({"Command": "Select", "Index": 4})
f["ctl00$ContentPlaceHolder1$rdRegion"] = "GREATER ACCRA REGION"
f["ctl00_ContentPlaceHolder1_rdRegion_ClientState"] = json.dumps({"logEntries": [], "value": "1", "text": "GREATER ACCRA REGION", "enabled": True, "checkedIndices": [], "checkedItemsTextOverflows": False})
r = _open(urllib.request.Request(URL, data=urllib.parse.urlencode(f).encode(), method="POST"))
open(out + "/page0.html", "w", encoding="utf-8").write(r)
print(len(r))
def rows(p):
    out=[]
    for r in re.findall(r'<tr class="rg(?:Alt)?Row"[^>]*>(.*?)</tr>',p,re.S):
        out.append([html.unescape(re.sub(r'<[^>]+>','',c)).strip() for c in re.findall(r'<td[^>]*>(.*?)</td>',r,re.S)])
    return out
import csv
allrows = rows(r)
cur = r
for i in range(2, 15):
    f = hidden(cur)
    links = re.findall(r'href="javascript:__doPostBack\(&#39;(ctl00\$ContentPlaceHolder1\$provgrid\$ctl00\$ctl03\$ctl01\$ctl\d+)&#39;,&#39;&#39;\)"[^>]*>(?:<span>)?([^<]*)<', cur)
    tgt = [t for t, txt in links if txt.strip() == str(i)] or [t for t, txt in links if txt.strip() == "..."][-1:]
    f["__EVENTTARGET"] = tgt[0]; f["__EVENTARGUMENT"] = ""
    f["ctl00$ContentPlaceHolder1$rdRegion"] = "GREATER ACCRA REGION"
    f["ctl00_ContentPlaceHolder1_rdRegion_ClientState"] = json.dumps({"logEntries": [], "value": "1", "text": "GREATER ACCRA REGION", "enabled": True, "checkedIndices": [], "checkedItemsTextOverflows": False})
    cur = _open(urllib.request.Request(URL, data=urllib.parse.urlencode(f).encode(), method="POST"))
    pr = rows(cur)
    print(i, len(pr), pr[0][1] if pr else None)
    allrows += pr
with open(out + "/greater_accra_raw.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.writer(fh); w.writerow(["District","Provider Name","Provider Type","Location"]); w.writerows(allrows)
print("total", len(allrows), "unique", len({tuple(x) for x in allrows}))
