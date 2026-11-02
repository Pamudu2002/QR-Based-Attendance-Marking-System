# Student app API (setup, login, registration, my modules)

The contract between the Kotlin app (`apps/qr-android`) and the server. Base URL: `<server>/api/v1`. All bodies are JSON.

## Formats

| Thing | Format |
|---|---|
| Device key | EC P-256 in the Android Keystore (StrongBox if available, else TEE) |
| Public key | X.509 SubjectPublicKeyInfo DER (`publicKey.encoded`), base64 |
| Signature | `SHA256withECDSA`, DER (what `Signature.sign()` returns), base64 |
| Signed message | Parts joined with `\|`, signed as UTF-8 bytes |
| Errors | `{ "error": { "code": "…", "message": "…" } }` with a 4xx/5xx status. `message` can be shown to the student as is |

Signed messages:

```
login:         QRv1-LOGIN|<deviceId>|<nonce>
registration:  QRv1-REG|<token>|<deviceId>|<indexNumber>
check-in:      QRv1-CHK|<token>|<deviceId>|<attemptId>      (week 3)
```

`<token>` is the QR text **without** the `QA1:R:` / `QA1:C:` prefix (48 characters).

## QR codes

```
Registration: QA1:R:<token>
Check-in:     QA1:C:<token>
```

One Scan button handles both: the prefix says which flow to start. Anything else → "That isn't a CSE Attendance code."

## 1. Setup: `POST /devices` (no auth)

```json
{ "publicKey": "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE…", "keyLevel": "TEE",
  "model": "Galaxy A14", "manufacturer": "samsung", "androidSdk": 34, "label": "P1-lowend" }
```

`keyLevel`: `STRONGBOX` | `TEE` | `SOFTWARE` (from `KeyInfo`). `label` is optional (experiment phones only).
→ `201 { "deviceId": "c…" }`. Save `deviceId`.

## 2. Login: challenge, then verify

`POST /auth/device/challenge { "deviceId" }` → `{ "nonce", "expiresAt" }` (valid 60 s).

`POST /auth/device/verify { "deviceId", "nonce", "signature" }` with the signature over `QRv1-LOGIN|deviceId|nonce`
→ `{ "accessToken", "expiresInSec": 900, "refreshToken", "deviceId" }`.

Send `Authorization: Bearer <accessToken>` on every `/student/*` call. On `401`, refresh:

`POST /auth/refresh { "refreshToken" }` → `{ "accessToken", "expiresInSec", "refreshToken" }`. Each refresh token works **once**; store the new one. If refresh fails, log in again with step 2.

`403 DEVICE_REVOKED` anywhere means the lecturer pressed **Reset device**: delete the key and go back to setup.

## 3. Register for a module (auth)

**Preview first:** `POST /student/registrations/preview { "token": "QA1:R:…" }` right after scanning. Nothing is saved or signed.

```json
{ "verdict": "OK", "message": "Registration is open for this module.",
  "module": { "id", "displayName", "shortName": "In22-S7-CS4473", "name": "Mobile Computing", "lecturer": "Dr. N. Ranasinghe" },
  "nameOnList": "Lokuhewa P. C." | null, "alreadyRegistered": false, "codeValidForSec": 24 }
```

`verdict` is `OK`, `REGISTRATION_CLOSED`, `EXPIRED` or `BAD_TOKEN`. For a phone that's already linked, `nameOnList: null` means the student isn't on this module's list.

**The code expires after 32 s** (T = 30 s + 2 s grace, server clock). Typing an index and name takes longer, so the app re-scans if the code is more than 20 s old when the student taps Confirm, then goes straight to the fingerprint/PIN prompt.

**Register:** `POST /student/registrations`, after the fingerprint/PIN prompt:

```json
{ "token": "QA1:R:Cr0gcGDf…", "indexNumber": "220366X", "name": "Lokuhewa P. C.", "signature": "MEUCIQ…" }
```

- **First module** (`/student/me` returns `student: null`): send `indexNumber` and `name`. Sign with the typed index.
- **Later modules**: omit both; sign with your registered index from `/student/me`. Show *"Register for In22-S7-CS4473 - Mobile Computing as LOKUHEWA P. C. (220366X)?"* first.

Always `200` with a verdict (unless the request is malformed or the device is revoked):

```json
{ "verdict": "REGISTERED", "message": "You're registered for this module.",
  "module": { "id": "c…", "displayName": "In22-S7-CS4473 - Mobile Computing" },
  "student": { "indexNumber": "220366X", "name": "Lokuhewa P. C." } }
```

| verdict | What the app does |
|---|---|
| `REGISTERED`, `ALREADY_REGISTERED` | Success screen, refresh My modules |
| `EXPIRED`, `BAD_TOKEN` | "Scan again" (the code changes every 30 s) |
| `REGISTRATION_CLOSED`, `NOT_ON_ROSTER`, `NAME_MISMATCH` | Show `message`; let them retry with corrected input for `NAME_MISMATCH` |
| `DEVICE_BOUND_TO_OTHER_STUDENT`, `STUDENT_HAS_OTHER_DEVICE` | Show `message` (the lecturer can reset the device) |
| `BAD_SIGNATURE` | Show `message`; the key is probably broken, offer setup again |

## 4. Me and my modules (auth)

`GET /student/me` →
```json
{ "device": { "id", "keyLevel", "status", "label" },
  "student": null | { "indexNumber": "220366X", "name": "Lokuhewa P. C.", "names": [{ "moduleId", "name" }] } }
```

`GET /student/modules` → `{ "modules": [{ "id", "displayName", "code", "name", "lecturer", "nameOnList", "registeredAt", "nextSession": { "id", "title", "startsAt", "endsAt", "venue" } | null, "pastSessions", "attended", "attendancePct": 0–100 | null }] }`. Green at 80% or more, red below.

`GET /student/modules/{id}` → `{ "module", "pastSessions", "attended", "attendancePct", "upcoming": [session], "history": [session] }` where each session has `status`: `PRESENT` | `LATE` | `EXCUSED` | `ABSENT` | `UPCOMING` | `NOT_YET` (started, not checked in).

Times are ISO 8601 UTC; show them in the phone's timezone.

## 5. Check in: `POST /checkins` (auth)

After decoding `QA1:C:…`, the fingerprint/PIN prompt, and signing `QRv1-CHK|token|deviceId|attemptId`:

```json
{ "token": "QA1:C:…", "attemptId": "uuid-v4 made by the phone", "signature": "MEUCIQ…", "ssid": "UniWiFi",
  "decodeMs": 1820.4, "firstFrameMs": 310.2, "framesProcessed": 14, "framesDropped": 3, "biometricMs": 1104.9,
  "authMethod": "BIOMETRIC", "androidSdk": 34,
  "phoneLabel": "P1-lowend", "distanceRow": "MIDDLE", "distanceM": 8, "role": "GENUINE", "runNo": 2, "attemptNo": 3 }
```

- Timings are milliseconds from `SystemClock.elapsedRealtimeNanos()` (PLAN §5.2): `firstFrameMs` and `decodeMs` from Scan pressed (t0), `biometricMs` = t2 − t1. Labels only in experiment mode. `distanceRow`: `FRONT` / `MIDDLE` / `BACK`; `role`: `GENUINE` / `RELAY`.
- **Token age is measured on the server clock only**, from the moment the request arrives. Refresh the access token *before* signing (the app does this when it has under a minute left), so a 401 retry can't add delay.
- The same `attemptId` sent again returns the stored result; the server keeps one record. Use this for "Send again" after no reply.

Always `200` with a verdict (unless the access token is missing or the body is malformed):

```json
{ "attemptId", "verdict": "OK", "attendance": "PRESENT", "message": "You're checked in.",
  "tokenAgeMs": 2412, "seq": 131, "issuedAt", "receivedAt", "serverTime", "wifiOk": true,
  "windowId", "intervalSec": 10, "graceSec": 2,
  "session": { "id", "title", "startsAt", "endsAt", "venue" }, "module": { "id", "code", "displayName" },
  "summary": { "attended": 9, "pastSessions": 9, "attendancePct": 100 } }
```

| verdict | Meaning |
|---|---|
| `OK` | Checked in: `attendance` is `PRESENT` or `LATE`. In experiment sessions repeats are also `OK` (every attempt logged, first mark kept) |
| `EXPIRED` | Token age over (T + grace) × 1000 ms, or the run had ended |
| `BAD_TOKEN` | Not a valid check-in code (forged, wrong purpose, or from the future) |
| `BAD_SIGNATURE` | Signature doesn't match this phone's key |
| `WRONG_NETWORK` | The session's Wi-Fi name is enforced and `ssid` doesn't match (`UNKNOWN` never matches) |
| `UNKNOWN_DEVICE` / `DEVICE_REVOKED` | Phone not registered yet / reset by the lecturer |
| `NOT_REGISTERED` | Not registered for this session's module |
| `OUTSIDE_TIME` | Before `startsAt − opensBeforeMin` or after `endsAt` |
| `DUPLICATE` | Already marked for this session (normal classes) |

## 6. Upload the log: `POST /attempts/bulk` (auth)

Every attempt is saved in Room first. Afterwards the phone sends `{ "attempts": [ … ] }` (up to 500):

- **Attempts the server has** (it replied to `/checkins`): only `id` and client fields, chiefly `postRttMs` and `totalMs`, which are known only after the reply. Server fields and the verdict never change.
- **Attempts the server never saw:** add `verdict` (`NO_DECODE`, `CANCELLED` or `NETWORK_ERROR`), `reason`, and `token` if a code was decoded (links it to its run and `seq`).

→ `{ "saved": [ids], "rejected": [{ "id", "reason" }] }`. Mark the saved ones as uploaded.

## Testing without the app

`apps/backend/scripts/sim-phone.ts` does exactly the above with a software key:

```bash
pnpm --filter @attendance/backend sim:phone register --module <moduleId> --lecturer demo@uom.lk:demo-pass-2026 --index 220512P --name "Jayasinghe R. T."
pnpm --filter @attendance/backend sim:phone me
pnpm --filter @attendance/backend sim:phone checkin --window <windowId> --lecturer demo@uom.lk:demo-pass-2026 --ssid UniWiFi
pnpm --filter @attendance/backend sim:phone checkin --window <windowId> --lecturer … --delay 12000   # a screenshot relay
pnpm --filter @attendance/backend sim:phone nodecode --label P1-lowend --run 1 --attempt 4
```
