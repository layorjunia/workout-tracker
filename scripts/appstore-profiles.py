#!/usr/bin/env python3
"""Issue the App Store provisioning profiles for the Workout Tracker (what App Store builds are signed with).

    python3 scripts/appstore-profiles.py        # keys come from scripts/.asc-env or the environment

Both targets need a profile: the app and the StreakWidget extension. Each App ID already carries the
HealthKit and App Group capabilities (Xcode registered them when the widget was first built to the
phone), and the profiles inherit them. App Store profiles name no devices. Profiles are rewritten
(not patched), so running this again is safe; the new files go to ~/Library/MobileDevice/Provisioning
Profiles, where Xcode looks for them.

Needs the team's Account Holder to have accepted Apple's latest Program License Agreement; until
then every call below answers 403 PLA_NOT_ACCEPTED.
"""
import base64, json, os, plistlib, re, subprocess, sys, time, urllib.error, urllib.request
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
TARGETS = {"Workout Tracker AppStore": "com.layorjunia.workouttracker",
           "Workout Widget AppStore": "com.layorjunia.workouttracker.widget"}


def token():
    b64 = lambda d: base64.urlsafe_b64encode(d).rstrip(b"=")
    head = b64(json.dumps({"alg": "ES256", "kid": KID, "typ": "JWT"}).encode())
    now = int(time.time())
    payload = b64(json.dumps({"iss": ISS, "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"}).encode())
    key_path = os.path.expanduser(f"~/.appstoreconnect/private_keys/AuthKey_{KID}.p8")
    key = load_pem_private_key(open(key_path, "rb").read(), password=None)
    r, s = decode_dss_signature(key.sign(head + b"." + payload, ec.ECDSA(hashes.SHA256())))
    return (head + b"." + payload + b"." + b64(r.to_bytes(32, "big") + s.to_bytes(32, "big"))).decode()


def api(path, method="GET", body=None):
    req = urllib.request.Request("https://api.appstoreconnect.apple.com" + path,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {token()}",
                                          "Content-Type": "application/json"}, method=method)
    try:
        return json.load(urllib.request.urlopen(req, timeout=40))
    except urllib.error.HTTPError as e:
        text = e.read()[:600].decode(errors="replace")
        if "PLA_NOT_ACCEPTED" in text:
            sys.exit("Apple says the Account Holder must accept the latest Program License Agreement first:\n"
                     "sign in at developer.apple.com/account and accept it, then run this again.")
        sys.exit(f"{method} {path} -> {e.code}: {text}")
    except json.JSONDecodeError:
        return {}


def main():
    if not KID or not ISS:
        sys.exit("set ASC_KEY_ID and ASC_ISSUER_ID (scripts/.asc-env)")
    cert = next((c["id"] for c in api("/v1/certificates?limit=200")["data"]
                 if c["attributes"]["certificateType"] == "DISTRIBUTION"), None)
    if not cert:
        sys.exit("no Apple Distribution certificate - make one in Xcode > Settings > Accounts > Manage Certificates")
    bundles = {b["attributes"]["identifier"]: b["id"] for b in api("/v1/bundleIds?limit=200")["data"]}
    for ident in TARGETS.values():
        if ident not in bundles:
            sys.exit(f"no App ID for {ident} - build once to the phone so Xcode registers it")
    existing = {p["attributes"]["name"]: p["id"] for p in api("/v1/profiles?limit=200")["data"]}
    out = os.path.expanduser("~/Library/MobileDevice/Provisioning Profiles")
    os.makedirs(out, exist_ok=True)

    for name, bundle in TARGETS.items():
        if name in existing:
            api(f"/v1/profiles/{existing[name]}", "DELETE")
        r = api("/v1/profiles", "POST", {"data": {"type": "profiles",
            "attributes": {"name": name, "profileType": "IOS_APP_STORE"},
            "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bundles[bundle]}},
                              "certificates": {"data": [{"type": "certificates", "id": cert}]}}}})
        content = base64.b64decode(r["data"]["attributes"]["profileContent"])
        decoded = plistlib.loads(subprocess.run(["security", "cms", "-D", "-i", "/dev/stdin"],
                                                input=content, capture_output=True).stdout)
        open(os.path.join(out, decoded["UUID"] + ".mobileprovision"), "wb").write(content)
        ents = decoded.get("Entitlements", {})
        print(f'{name}: expires {r["data"]["attributes"]["expirationDate"][:10]}, '
              f'HealthKit={bool(ents.get("com.apple.developer.healthkit"))}, '
              f'App Groups={ents.get("com.apple.security.application-groups")}')


main()
