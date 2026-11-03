#!/usr/bin/env python3
"""Fill in the Sets & Steps App Store listing through the App Store Connect API. Safe to run again.

    python3 scripts/asc-listing.py            # text, category, age rating, price, availability
    python3 scripts/asc-listing.py review     # the notes and contact for App Review
    python3 scripts/asc-listing.py screenshots  # upload store/screenshots/iphone-6.9/*.png
    python3 scripts/asc-listing.py build      # attach the newest processed build to version 1.0

The text mirrors APP-STORE.md. What the API cannot do is left to the web: App Privacy answers, the EU
Digital Services Act trader status and the regulated-medical-device declaration. This never submits
anything for review.
"""
import glob, hashlib, importlib.util, json, os, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("asc", os.path.join(HERE, "asc.py"))
asc = importlib.util.module_from_spec(spec); spec.loader.exec_module(asc)
ROOT = os.path.dirname(HERE)

APP = "6830320969"                       # Apple ID of Sets & Steps
SUBTITLE = "Workout log, streaks & goals"
PRIVACY_URL = "https://layorjunia-workouts.vercel.app/privacy.html"
SUPPORT_URL = "https://layorjunia-workouts.vercel.app/support.html"
COPYRIGHT = "2026 Illuminate Drones, LLC"
KEYWORDS = "gym,lifting,tracker,strength,reps,progress,widget,exercise,weights,routine,habit,pedometer,1rm"
PROMO = "Log every set, watch your progress charts, and hit your daily step goal. A Home Screen widget keeps your streak in sight."
DESCRIPTION = """Sets & Steps is a fast, no-nonsense log for lifting and daily activity.

• Log workouts from templates you can edit: sets, reps, weight, time and cardio.
• See your progress: estimated 1RM, volume, personal records and a chart for every exercise.
• Steps and streaks: reads your steps from Apple Health, tracks a daily goal and a streak, and shows both in a Home Screen widget.
• Goals with medals: set a rep or step total and earn a medal at every 10%, with daily rings showing what today needs.
• Body and nutrition: weight trends, plus protein, carbs and fat from Health.
• Your log is saved on your phone first, so spotty gym Wi-Fi never loses a set. Sign in (optional) to sync across devices with a name and a 4-digit PIN, and delete your account in Settings any time.
• Private: no ads and no tracking.

Sets & Steps is a general fitness log, not medical advice."""
REVIEW_NOTES = """Sets & Steps is a native iPhone app with Apple Health (HealthKit) integration, a Home Screen widget (WidgetKit) and haptic feedback. Its screens are served from our own website over HTTPS inside the app's web view.

No account is needed to log workouts. To try the Health features, open Settings > Cloud sync, enter any name and a 4-digit PIN (for example "applereview" and 1234), tap "Sign in / Create account", then allow Health access. Steps, streak and goals then show on the Steps and Goals tabs and in the widget.

To test account deletion: Settings > Cloud sync > Delete account, then enter the same PIN.

The app only reads from Health; it never writes to it."""

# Age rating: nothing objectionable. Health or wellness topics: yes, it is a fitness and nutrition log.
AGE = {
    "advertising": False, "gambling": False, "lootBox": False, "messagingAndChat": False, "parentalControls": False,
    "ageAssurance": False, "unrestrictedWebAccess": False, "userGeneratedContent": False,
    "socialMedia": False, "socialMediaAgeRestricted": False, "healthOrWellnessTopics": True,
    "alcoholTobaccoOrDrugUseOrReferences": "NONE", "contests": "NONE", "gamblingSimulated": "NONE",
    "gunsOrOtherWeapons": "NONE", "horrorOrFearThemes": "NONE", "matureOrSuggestiveThemes": "NONE",
    "medicalOrTreatmentInformation": "NONE", "profanityOrCrudeHumor": "NONE",
    "sexualContentGraphicAndNudity": "NONE", "sexualContentOrNudity": "NONE",
    "violenceCartoonOrFantasy": "NONE", "violenceRealistic": "NONE", "violenceRealisticProlongedGraphicOrSadistic": "NONE",
}


def check(label, r):
    if "error" in r:
        try:
            msg = "; ".join(f"{e.get('code')}: {e.get('detail')}" for e in json.loads(r["body"])["errors"])
        except Exception:
            msg = r.get("body", r)
        print(f"   !! {label}: HTTP {r['error']}: {msg}")
        return False
    print(f"   ok {label}")
    return True


def ids():
    v = asc.call("GET", f"/v1/apps/{APP}/appStoreVersions")["data"][0]
    info = asc.call("GET", f"/v1/apps/{APP}/appInfos")["data"][0]["id"]
    loc = asc.call("GET", f"/v1/appStoreVersions/{v['id']}/appStoreVersionLocalizations")["data"][0]["id"]
    iloc = asc.call("GET", f"/v1/appInfos/{info}/appInfoLocalizations")["data"][0]["id"]
    return v["id"], loc, info, iloc


def listing():
    vid, loc, info, iloc = ids()
    print("text")
    check("subtitle + privacy policy URL", asc.call("PATCH", f"/v1/appInfoLocalizations/{iloc}", {"data": {"type": "appInfoLocalizations", "id": iloc,
          "attributes": {"subtitle": SUBTITLE, "privacyPolicyUrl": PRIVACY_URL}}}))
    check("description, keywords, promo text, support URL", asc.call("PATCH", f"/v1/appStoreVersionLocalizations/{loc}", {"data": {"type": "appStoreVersionLocalizations", "id": loc,
          "attributes": {"description": DESCRIPTION, "keywords": KEYWORDS, "promotionalText": PROMO, "supportUrl": SUPPORT_URL}}}))
    check("copyright", asc.call("PATCH", f"/v1/appStoreVersions/{vid}", {"data": {"type": "appStoreVersions", "id": vid, "attributes": {"copyright": COPYRIGHT}}}))
    check("content rights: no third-party content", asc.call("PATCH", f"/v1/apps/{APP}", {"data": {"type": "apps", "id": APP,
          "attributes": {"contentRightsDeclaration": "DOES_NOT_USE_THIRD_PARTY_CONTENT"}}}))
    print("category and age rating")
    check("primary category: Health & Fitness", asc.call("PATCH", f"/v1/appInfos/{info}", {"data": {"type": "appInfos", "id": info,
          "relationships": {"primaryCategory": {"data": {"type": "appCategories", "id": "HEALTH_AND_FITNESS"}}}}}))
    ok = check("age rating answers", asc.call("PATCH", f"/v1/ageRatingDeclarations/{info}", {"data": {"type": "ageRatingDeclarations", "id": info, "attributes": AGE}}))
    if ok:
        r = asc.call("GET", f"/v1/appInfos/{info}")
        print("   age rating Apple computed:", json.dumps({k: v for k, v in r["data"]["attributes"].items() if "AgeRating" in k and v}))
    print("price")
    sched = asc.call("GET", f"/v1/appPriceSchedules/{APP}/manualPrices?include=appPricePoint")
    if "error" not in sched and sched.get("data"):
        pts = {i["id"]: i["attributes"] for i in sched.get("included", [])}
        print("   already set:", [pts.get(m["relationships"]["appPricePoint"]["data"]["id"], {}).get("customerPrice") for m in sched["data"]][:3])
    else:
        free = asc.call("GET", f"/v1/apps/{APP}/appPricePoints?filter[territory]=USA&limit=1")["data"][0]["id"]
        check("free in every storefront", asc.call("POST", "/v1/appPriceSchedules", {"data": {"type": "appPriceSchedules", "relationships": {
              "app": {"data": {"type": "apps", "id": APP}}, "baseTerritory": {"data": {"type": "territories", "id": "USA"}},
              "manualPrices": {"data": [{"type": "appPrices", "id": "${p1}"}]}}},
              "included": [{"type": "appPrices", "id": "${p1}", "attributes": {"startDate": None},
                            "relationships": {"appPricePoint": {"data": {"type": "appPricePoints", "id": free}}}}]}))
    print("availability")
    if "error" in asc.call("GET", f"/v1/apps/{APP}/appAvailabilityV2"):
        terr = [t["id"] for t in asc.call("GET", "/v1/territories?limit=200")["data"]]
        body = {"data": {"type": "appAvailabilities", "attributes": {"availableInNewTerritories": True}, "relationships": {
                "app": {"data": {"type": "apps", "id": APP}},
                "territoryAvailabilities": {"data": [{"type": "territoryAvailabilities", "id": f"${{t{i}}}"} for i in range(len(terr))]}}},
                "included": [{"type": "territoryAvailabilities", "id": f"${{t{i}}}", "attributes": {"available": True},
                              "relationships": {"territory": {"data": {"type": "territories", "id": t}}}} for i, t in enumerate(terr)]}
        check(f"available in {len(terr)} storefronts, and in new ones", asc.call("POST", "/v2/appAvailabilities", body))
    else:
        print("   already set")


def review():
    vid, *_ = ids()
    print("App Review details")
    existing = asc.call("GET", f"/v1/appStoreVersions/{vid}/appStoreReviewDetail")
    attrs = {"contactFirstName": "Jacob", "contactLastName": "Howard", "contactEmail": "jacob@illuminatedrones.com",
             "demoAccountRequired": False, "notes": REVIEW_NOTES}
    phone = os.environ.get("REVIEW_PHONE")
    if phone:
        attrs["contactPhone"] = phone
    if "error" not in existing and existing.get("data"):
        rid = existing["data"]["id"]
        check("update", asc.call("PATCH", f"/v1/appStoreReviewDetails/{rid}", {"data": {"type": "appStoreReviewDetails", "id": rid, "attributes": attrs}}))
    else:
        check("create", asc.call("POST", "/v1/appStoreReviewDetails", {"data": {"type": "appStoreReviewDetails", "attributes": attrs,
              "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": vid}}}}}))
    if not phone:
        print("   (no contact phone yet: set REVIEW_PHONE=... and run this again, or add it in App Store Connect)")


def screenshots():
    vid, loc, *_ = ids()
    print("screenshots")
    sets = asc.call("GET", f"/v1/appStoreVersionLocalizations/{loc}/appScreenshotSets")
    sset = next((s for s in sets.get("data", []) if s["attributes"]["screenshotDisplayType"] == "APP_IPHONE_67"), None)
    if not sset:
        r = asc.call("POST", "/v1/appScreenshotSets", {"data": {"type": "appScreenshotSets", "attributes": {"screenshotDisplayType": "APP_IPHONE_67"},
            "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": loc}}}}})
        if not check("create the 6.7/6.9-inch set", r):
            return
        sset = r["data"]
    sid = sset["id"]
    have = asc.call("GET", f"/v1/appScreenshotSets/{sid}/appScreenshots").get("data", [])
    if have:
        print(f"   the set already holds {len(have)} screenshots; delete them in App Store Connect first to replace them")
        return
    for path in sorted(glob.glob(os.path.join(ROOT, "store/screenshots/iphone-6.9/*.png"))):
        data = open(path, "rb").read()
        r = asc.call("POST", "/v1/appScreenshots", {"data": {"type": "appScreenshots", "attributes": {"fileName": os.path.basename(path), "fileSize": len(data)},
              "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": sid}}}}})
        if not check(f"reserve {os.path.basename(path)}", r):
            return
        shot = r["data"]
        for op in shot["attributes"]["uploadOperations"]:
            chunk = data[op["offset"]: op["offset"] + op["length"]]
            req = urllib.request.Request(op["url"], data=chunk, method=op["method"], headers={h["name"]: h["value"] for h in op["requestHeaders"]})
            urllib.request.urlopen(req, timeout=120).read()
        check("  upload + commit", asc.call("PATCH", f"/v1/appScreenshots/{shot['id']}", {"data": {"type": "appScreenshots", "id": shot["id"],
              "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()}}}))
    for _ in range(30):
        shots = asc.call("GET", f"/v1/appScreenshotSets/{sid}/appScreenshots")["data"]
        states = [s["attributes"]["assetDeliveryState"]["state"] for s in shots]
        if all(s == "COMPLETE" for s in states):
            break
        time.sleep(3)
    print("   Apple's processing:", states)


def build():
    vid, *_ = ids()
    print("build")
    r = asc.call("GET", f"/v1/builds?filter[app]={APP}&sort=-uploadedDate&limit=5")
    builds = r.get("data", [])
    for b in builds:
        print("  ", b["attributes"]["version"], b["attributes"]["processingState"], b["attributes"].get("uploadedDate", "")[:19])
    good = next((b for b in builds if b["attributes"]["processingState"] == "VALID"), None)
    if not good:
        print("   no processed build yet; run this again in a few minutes")
        return
    check(f"attach build {good['attributes']['version']} to version 1.0", asc.call("PATCH", f"/v1/appStoreVersions/{vid}/relationships/build",
          {"data": {"type": "builds", "id": good["id"]}}))


if __name__ == "__main__":
    step = sys.argv[1] if len(sys.argv) > 1 else "listing"
    {"listing": listing, "review": review, "screenshots": screenshots, "build": build}[step]()
