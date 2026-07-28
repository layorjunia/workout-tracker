// Vercel serverless function: receives Apple Health data from an iOS Shortcut,
// authenticates against Firebase using the user's name + 4-digit PIN, then
// writes the metrics into their state.health.data field in Firestore.
//
// Called by the iOS Shortcut with a body like:
//   {
//     "name": "jacob",
//     "pin":  "1234",
//     "restingHR": 58,
//     "hrv": 42,
//     "sleepHours": 7.3,
//     "stepsToday": 8420,
//     "activeEnergyToday": 642,
//     "weightLbs": 175,
//     "bodyFatPct": 18
//   }
// Any subset of metrics is fine — only fields present are updated.

const API_KEY    = "AIzaSyCgy28dqL2agj0_ns92a9GagW-nipVhxsQ";
const PROJECT_ID = "workout-tracker-9f206";
const PIN_SUFFIX = ".wtapp2026"; // must match firebase-sync.js

// Same normalization as the client: identifier → an email Firebase Auth accepts
function toEmail(identifier) {
  const s = String(identifier || "").trim();
  if (s.includes("@")) return s.toLowerCase();
  const clean = s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!clean) throw new Error("name required");
  return `${clean}@workout-tracker.local`;
}

// Firestore REST wants typed values. Recurse into arrays/objects.
function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return { nullValue: null };
    return { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, vv]) => [k, toFirestoreValue(vv)])) } };
  }
  return { stringValue: String(v) };
}

function fromFirestoreValue(v) {
  if (!v || typeof v !== "object") return v;
  if ("nullValue" in v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in v) {
    const out = {};
    for (const [k, vv] of Object.entries(v.mapValue.fields || {})) out[k] = fromFirestoreValue(vv);
    return out;
  }
  return v;
}

// The set of keys we recognize as Apple Health metrics — everything else is ignored.
const METRIC_KEYS = new Set([
  "currentHR", "restingHR", "hrv", "bloodOxygen",
  "stepsToday", "distanceMiToday", "activeEnergyToday", "restingEnergyToday",
  "exerciseMinutesToday", "standHoursToday",
  "sleepHours",
  "weightLbs", "bodyFatPct",
]);

export default async function handler(req, res) {
  // CORS for browser dev/testing — the Shortcut doesn't need it, but harmless.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "POST only" });

  // Body may be pre-parsed by Vercel or arrive as a raw string.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ error: "invalid JSON body" }); }
  }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "JSON body required" });

  const { name, pin, metrics: nestedMetrics, ...rest } = body;
  if (!name) return res.status(400).json({ error: "name required" });
  if (!/^\d{4}$/.test(String(pin || ""))) return res.status(400).json({ error: "pin must be 4 digits" });

  // Accept both {name, pin, metrics:{...}} and flat {name, pin, restingHR, ...}
  const rawMetrics = nestedMetrics && typeof nestedMetrics === "object" ? nestedMetrics : rest;
  const metrics = {};
  for (const [k, v] of Object.entries(rawMetrics)) {
    if (!METRIC_KEYS.has(k)) continue;
    if (v === "" || v == null) continue;
    const n = typeof v === "number" ? v : parseFloat(v);
    if (Number.isFinite(n)) metrics[k] = n;
  }
  if (Object.keys(metrics).length === 0) {
    return res.status(400).json({ error: "no valid metrics", knownKeys: [...METRIC_KEYS] });
  }

  let email;
  try { email = toEmail(name); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const password = String(pin) + PIN_SUFFIX;

  // Step 1: authenticate via Firebase Auth REST → idToken + uid
  const authRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!authRes.ok) {
    const err = await authRes.json().catch(() => ({}));
    const msg = err.error?.message || "unknown";
    if (msg === "EMAIL_NOT_FOUND" || msg === "INVALID_PASSWORD" || msg === "INVALID_LOGIN_CREDENTIALS") {
      return res.status(401).json({ error: "wrong name or PIN" });
    }
    return res.status(401).json({ error: "auth failed", detail: msg });
  }
  const { idToken, localId: uid } = await authRes.json();

  // Step 2: read the current user doc so we don't clobber unrelated state
  const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`;
  let currentState = {};
  const getRes = await fetch(docUrl, { headers: { Authorization: `Bearer ${idToken}` } });
  if (getRes.ok) {
    const doc = await getRes.json();
    if (doc.fields?.state) currentState = fromFirestoreValue(doc.fields.state);
  } else if (getRes.status !== 404) {
    const err = await getRes.text();
    return res.status(500).json({ error: "read failed", detail: err.slice(0, 500) });
  }

  // Step 3: merge new metrics into state.health.data
  currentState.health = currentState.health || {};
  currentState.health.data = {
    ...(currentState.health.data || {}),
    ...metrics,
    updatedAt: new Date().toISOString(),
  };
  currentState.health.lastFetch = Date.now();
  currentState.health.lastError = null;

  // Step 4: PATCH the doc back with just the state / metadata fields
  const now = new Date().toISOString();
  const updateBody = {
    fields: {
      state:      toFirestoreValue(currentState),
      updatedAt:  { timestampValue: now },
      deviceId:   { stringValue: "shortcut-health-sync" },
      clientTime: { integerValue: String(Date.now()) },
    },
  };
  const mask =
    "updateMask.fieldPaths=state" +
    "&updateMask.fieldPaths=updatedAt" +
    "&updateMask.fieldPaths=deviceId" +
    "&updateMask.fieldPaths=clientTime";

  const patchRes = await fetch(`${docUrl}?${mask}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updateBody),
  });
  if (!patchRes.ok) {
    const err = await patchRes.text();
    return res.status(500).json({ error: "write failed", detail: err.slice(0, 500) });
  }

  return res.status(200).json({
    ok: true,
    uid,
    updated: Object.keys(metrics),
    at: now,
  });
}
