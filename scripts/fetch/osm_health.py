# Fetches named health places (amenity hospital, clinic, doctors, pharmacy, dentist, and any healthcare=*)
# in the Greater Accra box from the OpenStreetMap Overpass API. Data (c) OpenStreetMap contributors, ODbL.
# Run: python -I scripts/fetch/osm_health.py <output.json>. Trim it to name and position for data/nhia/.
import sys, time, json, urllib.request, urllib.parse
out = sys.argv[1]
Q = '[out:json][timeout:180];(nwr["amenity"~"^(hospital|clinic|doctors|pharmacy|dentist)$"](5.45,-0.55,6.15,0.75);nwr["healthcare"](5.45,-0.55,6.15,0.75););out center tags;'
hosts = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"]
wait = 20
for attempt in range(12):
    host = hosts[attempt % len(hosts)]
    try:
        req = urllib.request.Request(host, data=urllib.parse.urlencode({"data": Q}).encode(), headers={"User-Agent": "VeriqHealth/0.1 (data import)"})
        body = urllib.request.urlopen(req, timeout=240).read()
        d = json.loads(body)
        open(out, "wb").write(body)
        print("ok", host, len(d["elements"]), d.get("osm3s", {}).get("timestamp_osm_base"))
        sys.exit(0)
    except Exception as e:
        print("fail", attempt, host, str(e)[:120], flush=True)
        time.sleep(wait); wait = min(wait * 2, 300)
sys.exit(1)
