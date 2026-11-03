#!/usr/bin/env python3
"""Tiny App Store Connect API client. Keys come from scripts/.asc-env or the environment.

    python3 scripts/asc.py GET /v1/apps
    python3 scripts/asc.py PATCH /v1/appInfoLocalizations/<id> '{"data": {...}}'

Prints the JSON answer (or Apple's error text). Used for one-off looks and changes; the other scripts
in this folder do the routine jobs.
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


def token():
    b64 = lambda d: base64.urlsafe_b64encode(d).rstrip(b"=")
    head = b64(json.dumps({"alg": "ES256", "kid": KID, "typ": "JWT"}).encode())
    now = int(time.time())
    payload = b64(json.dumps({"iss": ISS, "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"}).encode())
    key = load_pem_private_key(open(os.path.expanduser(f"~/.appstoreconnect/private_keys/AuthKey_{KID}.p8"), "rb").read(), password=None)
    r, s = decode_dss_signature(key.sign(head + b"." + payload, ec.ECDSA(hashes.SHA256())))
    return (head + b"." + payload + b"." + b64(r.to_bytes(32, "big") + s.to_bytes(32, "big"))).decode()


def call(method, path, body=None):
    req = urllib.request.Request("https://api.appstoreconnect.apple.com" + path,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"}, method=method)
    try:
        raw = urllib.request.urlopen(req, timeout=60).read()
        return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read()[:1500].decode(errors="replace")}


if __name__ == "__main__":
    if not KID or not ISS:
        sys.exit("set ASC_KEY_ID and ASC_ISSUER_ID (scripts/.asc-env)")
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    out = call(sys.argv[1].upper(), sys.argv[2], json.loads(sys.argv[3]) if len(sys.argv) > 3 else None)
    print(json.dumps(out, indent=1))
