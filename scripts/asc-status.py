#!/usr/bin/env python3
"""Read-only look at the App Store Connect account and the Workout Tracker's release state.
Changes nothing.

    python3 scripts/asc-status.py        # keys come from scripts/.asc-env or the environment
"""
import base64, json, os, re, sys, time, urllib.error, urllib.request
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_file = os.path.join(ROOT, "scripts", ".asc-env")
if os.path.exists(env_file):
    for line in open(env_file):
        m = re.match(r"\s*(?:export\s+)?(ASC_KEY_ID|ASC_ISSUER_ID)=(\S+)", line)
        if m:
            os.environ.setdefault(m.group(1), m.group(2).strip("'\""))
KID, ISS = os.environ.get("ASC_KEY_ID"), os.environ.get("ASC_ISSUER_ID")
if not KID or not ISS:
    sys.exit("set ASC_KEY_ID and ASC_ISSUER_ID (scripts/.asc-env)")
MINE = "com.layorjunia."
APP_ID = "com.layorjunia.workouttracker"


def token():
    b64 = lambda d: base64.urlsafe_b64encode(d).rstrip(b"=")
    head = b64(json.dumps({"alg": "ES256", "kid": KID, "typ": "JWT"}).encode())
    now = int(time.time())
    payload = b64(json.dumps({"iss": ISS, "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"}).encode())
    key = load_pem_private_key(open(os.path.expanduser(f"~/.appstoreconnect/private_keys/AuthKey_{KID}.p8"), "rb").read(), password=None)
    r, s = decode_dss_signature(key.sign(head + b"." + payload, ec.ECDSA(hashes.SHA256())))
    return (head + b"." + payload + b"." + b64(r.to_bytes(32, "big") + s.to_bytes(32, "big"))).decode()


def get(path):
    req = urllib.request.Request("https://api.appstoreconnect.apple.com" + path, headers={"Authorization": f"Bearer {token()}"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=40))
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read()[:600].decode(errors="replace")}


def failed(label, r):
    if "error" not in r:
        return False
    try:
        msg = "; ".join(f"{e.get('code')}: {e.get('detail')}" for e in json.loads(r["body"])["errors"])
    except Exception:
        msg = r["body"]
    print(f"   !! {label} -> HTTP {r['error']}: {msg}")
    return True


print("== apps in the account")
apps = get("/v1/apps?limit=200&fields[apps]=name,bundleId,sku")
mine_app = None
if not failed("apps", apps):
    for a in apps["data"]:
        at = a["attributes"]
        if at["bundleId"] == APP_ID:
            mine_app = a
        flag = "   <-- this app" if at["bundleId"].startswith(MINE) else ""
        print(f"   {at['bundleId']:<52} {at['name']}{flag}")
    print(f"   ({len(apps['data'])} apps total)")

print("\n== App IDs for this app, and what each one has switched on")
ids = get("/v1/bundleIds?limit=200")
if not failed("bundleIds", ids):
    mine = [b for b in ids["data"] if b["attributes"]["identifier"].startswith(MINE)]
    for b in mine:
        caps = get(f"/v1/bundleIds/{b['id']}/bundleIdCapabilities")
        names = "?" if failed("capabilities", caps) else ", ".join(sorted(c["attributes"]["capabilityType"] for c in caps["data"]))
        print(f"   {b['attributes']['identifier']:<46} {b['attributes']['platform']:<9} {names}")
    if not mine:
        print(f"   none of {len(ids['data'])} App IDs start with {MINE}")

print("\n== certificates")
certs = get("/v1/certificates?limit=200")
if not failed("certificates", certs):
    for c in certs["data"]:
        at = c["attributes"]
        print(f"   {at['certificateType']:<26} {at['displayName']:<42} expires {at['expirationDate'][:10]}")

print("\n== provisioning profiles that mention this app")
profs = get("/v1/profiles?limit=200&include=bundleId")
if not failed("profiles", profs):
    by_id = {i["id"]: i["attributes"]["identifier"] for i in profs.get("included", []) if i["type"] == "bundleIds"}
    shown = 0
    for p in profs["data"]:
        bid = (p.get("relationships", {}).get("bundleId", {}).get("data") or {}).get("id")
        if by_id.get(bid, "").startswith(MINE):
            at = p["attributes"]
            print(f"   {at['profileType']:<22} {at['profileState']:<8} {at['name']}  (expires {at['expirationDate'][:10]})")
            shown += 1
    if not shown:
        print("   none")

print("\n== App Store")
if not mine_app:
    print("   no App Store Connect record for", APP_ID, "yet")
else:
    aid = mine_app["id"]
    vers = get(f"/v1/apps/{aid}/appStoreVersions?limit=5")
    if not failed("versions", vers):
        for v in vers["data"]:
            at = v["attributes"]
            print(f"   version {at['versionString']:<8} {at.get('appStoreState') or at.get('appVersionState')}")
        if not vers["data"]:
            print("   no version created yet")
    builds = get(f"/v1/apps/{aid}/builds?limit=5&sort=-uploadedDate")
    if not failed("builds", builds):
        for b in builds["data"]:
            at = b["attributes"]
            print(f"   build {at['version']:<14} {at['processingState']:<11} uploaded {(at.get('uploadedDate') or '')[:16]}"
                  f"{'  EXPIRED' if at.get('expired') else ''}")
        if not builds["data"]:
            print("   no builds uploaded yet")
