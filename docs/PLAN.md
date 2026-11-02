# Rotating-QR Attendance System and Experiment: Full Plan (Kotlin)

> CS4473 Mobile Computing, Assignment 2. Team Divinus (Group 13): Lokuhewa P. C. (220366X), Wijesinghe L. A. V. B. (220720E)
> Approved topic: *Usability vs. Replay Security of Rotating-QR Attendance: Finding a Safe QR Refresh Interval on Real Android Phones* (Option I).
> The student app is a **native Kotlin Android app**. React Native is out of scope.
>
> The earlier NFC apps (`apps/host`, `apps/student`) and the older NFC design docs stay in the repo but are not part of this project.

---

## 1. What we are building and proving

We are building a **real attendance system**:
- **Lecturers** use a **web portal**. They create modules, add students (one at a time or from a CSV), show a **registration QR**, schedule **sessions**, and show a **rotating check-in QR** on the projector.
- **Students** use the **Kotlin Android app**. They register with the same name and index number the lecturer entered, then check in to their real classes by scanning the projected QR.

The **experiment** runs on top of this system.

**Research question.** How do the QR refresh interval (T) and viewing distance affect the check-in success rate and check-in time of genuine students, and is there an interval that accepts genuine check-ins while rejecting screenshot-relay attempts?

**Expected result.**
- Genuine check-ins take about 2–5 s from the front, and longer from the back, especially on the low-end phone.
- A relay (screenshot → WhatsApp → scan from another screen) takes 10 s or more.
- An interval of about 5–10 s may separate the two groups. The margin may vanish for back-row students on weak phones.

**The key number is token age at check-in**: server receive time minus token issue time.
- Genuine check-ins should have a small token age.
- Relays should have a large one.
- A *safe interval* exists if the two distributions don't overlap.

> **Focus for marks.** The brief marks the *experiment*: design, mobile-computing relevance, data, report and interview. The lecturer portal and module management make the system real, but keep them simple. The scan → sign → check-in path and its measurements matter most.

---

## 2. Real-world flow

### 2.1 Lecturer (web portal, on a laptop)
1. **Sign up or log in** with email and password.
2. **Create a module** with intake, semester, module code and name. It is shown like Moodle: **`In22-S7-CS4473 - Mobile Computing`**. A lecturer can have **many modules**.
3. **Add students** to the module. Only **index number** and **name** are needed:
   - one at a time, or
   - **CSV upload**: the portal shows a preview with errors first, and nothing is saved until the lecturer confirms.
4. **Open registration** and show the module's **registration QR** on the projector in the first class.
5. **Watch registrations come in**: the roster shows each student as **Registered** or **Not registered yet**.
6. **Add sessions** (the real classes). Each has a title, date, start and end time, and venue. A session can repeat weekly for N weeks.
7. **Link a beacon phone** (once): install **CSE Attendance Beacon** on an Android phone and scan the link code from **Beacon phones** in the portal.
8. **Start check-in** in class. The projector shows the **rotating check-in QR**, and a live counter shows who has checked in. The beacon phone on the desk starts broadcasting by itself and stops at **End check-in** (§6.5).
9. **View attendance** in three ways:
   - per session (present, late or absent among registered students);
   - per module, as a matrix with each student's % and the **80% line**;
   - as a CSV export.
10. **Manual fixes:**
   - mark a student *excused* or *present* with a reason (logged);
   - **reset a student's device** when they get a new phone.

### 2.2 Student (Kotlin app)
1. **Install and open the app.** It creates a hardware key, which needs a fingerprint or PIN.
2. In the first class, **scan the module's registration QR** and enter the **same name and index number** the lecturer used. The student is now registered for that module.
3. **Other modules:** scan each module's registration QR. The app already knows who the student is, so it only asks them to confirm. A student can be registered in **many modules**.
4. **In each class**, with Bluetooth on, tap **Scan**, aim at the projector, confirm with fingerprint or PIN, and see *Present* or *Late*. While the camera reads the code, the app listens for the classroom beacon.
5. **My modules:** see upcoming sessions, attendance history and attendance % for each module.

---

## 3. System overview

```
            ┌───────────────────────────────────────────────────────────────┐
            │ Server: Next.js on Vercel + PostgreSQL (Neon)                 │
            │ lecturer auth · modules · rosters · registration · sessions   │
            │ check-in windows · tokens · attendance · attempt logs · CSV   │
            └──────▲───────────────────────▲──────────────────────▲─────────┘
                   │ HTTPS (cookie)        │ GET token every 500 ms │ HTTPS (device JWT +
                   │                       │                       │  signed requests)
 ┌─────────────────┴──────────┐  ┌─────────┴─────────────────┐  ┌──┴──────────────────────────┐
 │ Lecturer web portal         │  │ Projector pages            │  │ Student app (Kotlin)        │
 │ modules, students, CSV,     │  │ registration QR / rotating │  │ CameraX → ZXing → Keystore  │
 │ sessions, attendance views  │  │ check-in QR (changes / T)  │  │ + BiometricPrompt → POST    │
 └─────────────────────────────┘  └─────────────┬──────────────┘  └──────────────▲──────────────┘
                                                │       camera views QR         │
                                                └───────────────────────────────┘
 ┌─────────────────────────────┐   polls /beacon/current every 2 s     Bluetooth LE advert
 │ Beacon app (Kotlin) on the  │ ───────────────────────────────────►  (rotating code)  ──► student app
 │ lecturer's phone            │   ◄── open check-in run + beacon key
 └─────────────────────────────┘
```

| Part | Tech | Location in repo |
|---|---|---|
| Student app | **Kotlin, Jetpack Compose**, CameraX, ZXing core, androidx.biometric, Android Keystore, BluetoothLeScanner, OkHttp, Room | `apps/qr-android/`, flavour `student` |
| Beacon app (lecturer's phone) | **Kotlin, Jetpack Compose**, BluetoothLeAdvertiser, foreground service, Android Keystore, OkHttp | `apps/qr-android/`, flavour `beacon` |
| Lecturer web portal | Next.js App Router pages (TypeScript/React), plain CSS modules, `qrcode` npm package for SVG QR codes | `apps/backend/src/app/(portal)/…` |
| Projector pages | Next.js pages, fullscreen | `apps/backend/src/app/present/…` |
| Server API | Existing Next.js route handlers, Prisma, PostgreSQL (Neon), Vercel | `apps/backend/src/app/api/v1/…` |
| Analysis | Python (pandas, matplotlib) | `analysis/qr/` |

**Reused from the existing repo:**
- Vercel and Neon hosting;
- the `handler`/`ApiError` wrapper, zod validation, jose JWTs, argon2 passwords and refresh-token rotation;
- the Keystore and signature-verification approach.

**Not used:** the Expo/React Native apps and the NFC code.

---

## 4. Lecturer web portal

### 4.1 Pages
| Page | Content |
|---|---|
| `/login`, `/signup` | Email + password. Sign-up can be limited to allowed email domains (`ALLOWED_LECTURER_DOMAINS`, e.g. `uom.lk`) |
| `/modules` | Cards like Moodle: `In22-S7-CS4473 - Mobile Computing`, number of students, registered count, next session. **New module** button |
| `/modules/new`, `/modules/[id]/edit` | Intake (`In22`), semester (`S7`), code (`CS4473`), name (`Mobile Computing`) |
| `/modules/[id]` · **Students** tab | Roster table: index number, name, **Registered ✓ / Not registered**, registered at, phone model. Filters: all / registered / not registered. Actions: add student, **Import CSV**, edit name, remove, **reset device** |
| `/modules/[id]` · **Registration** tab | Open/close registration, **Show registration QR** (opens the projector page), live "registered 42 / 60" counter, recent failed registrations with their reason (e.g. name mismatch) |
| `/modules/[id]` · **Sessions** tab | Calendar/list of sessions. Add/edit/delete; weekly repeat. **Start check-in** on a session |
| `/modules/[id]` · **Attendance** tab | Student × session matrix, each student's % with students under **80%** highlighted, CSV export |
| `/sessions/[id]` | Session attendance: present / late / absent (registered students), not-registered roster students listed separately, manual mark with reason |
| `/present/register/[moduleId]` | Fullscreen registration QR (rotating, see §6.2) with the module title |
| `/present/checkin/[windowId]` | Fullscreen rotating check-in QR, countdown, `seq` number, live counter |
| `/experiment` | Experiment controls: create check-in windows with a chosen T and mode, export attempts CSV (see §9) |
| `/beacons` | **Beacon phones**: link a phone with a one-time QR (2 min), each phone's live state (ready, broadcasting, Bluetooth off, app closed), remove |
| `/sessions/[id]` · Start check-in | **Require the classroom beacon** tick box (on when a beacon phone is linked) and the beacon phone's live state; while open, how many phones heard it |

### 4.2 Adding students by CSV
- **Template:** `index_number,name`, e.g. `220366X,Lokuhewa P. C.`. The importer also accepts a Moodle participants export if its columns can be mapped (ID number → index, first + last name → name).
- **Validation, per row:**
  - index format `^\d{6}[A-Z]$`, converted to upper case;
  - name must not be empty;
  - no duplicate index numbers in the file;
  - limit of 1,000 rows.
- **Dry run first.** The preview shows four groups: *new*, *already on roster (unchanged)*, *name differs from roster*, and *errors*. The lecturer chooses whether to update differing names, then confirms.
- The import runs in one database transaction, so either every row is saved or none is.

### 4.3 Module display name
`{intake}-{semester}-{code} - {name}`, e.g. `In22-S7-CS4473 - Mobile Computing`. Intake + semester + code is unique **per lecturer**, so two lecturers can each create a co-taught module.

---

## 5. Student app (Kotlin)

### 5.1 Screens (Jetpack Compose)
1. **Welcome / setup:**
   - asks for permissions (camera; Bluetooth: "Nearby devices" on Android 12+, location on 6–11);
   - creates the Keystore key, which needs a fingerprint or PIN check;
   - registers the device with the server and gets a `deviceId`;
   - shows the key level (TEE or StrongBox).
2. **Register for a module:** scan the registration QR.
   - **First module:** enter index number and name, confirm with fingerprint or PIN, and submit.
   - **Later modules:** a screen shows *"Register for In22-S7-CS4473 - Mobile Computing as LOKUHEWA P. C. (220366X)?"* → confirm.
   - Clear error messages: *"Your index number is not on this module's list. Ask your lecturer to add you."*, *"Name doesn't match the lecturer's list."*, *"Registration is closed."*
3. **My modules:** module cards in the same style as Moodle, each showing its attendance % (green above 80%, red below).
4. **Module detail:** upcoming sessions, attendance history (present / late / absent / excused) and the %.
5. **Scan (check-in):** camera preview with a frame overlay. Decoding runs in the background, and a Bluetooth scan listens for the classroom beacon at the same time (status: found / looking / Bluetooth off, with a button to fix it). When a code is decoded, the fingerprint/PIN prompt appears automatically.
6. **Result:** *Present* / *Late* / reason for rejection, plus the module and session title. In experiment mode it also shows decode time, total time, token age and frames processed.
7. **Experiment settings** (hidden; long-press the title):
   - phone label;
   - distance row (front/middle/back) and metres;
   - role (genuine/relay);
   - run number and auto attempt counter;
   - scan timeout (default 20 s).
8. **Log:** local attempts, upload status, *Upload now*.

The **same Scan button handles both QR types**. A short prefix in the QR tells the app which one it is (§6.2).

### 5.2 Measurement pipeline
All phone timings use `SystemClock.elapsedRealtimeNanos()` (monotonic):

| Mark | When |
|---|---|
| `t0` | Scan pressed; camera bound |
| `tFirstFrame` | First frame reaches the analyzer |
| `t1` | First successful decode (`decodeMs = t1 − t0`) |
| `t2` | Fingerprint/PIN succeeded and the signature was made (`biometricMs = t2 − t1`) |
| `t3` | Server response received (`postRttMs = t3 − t2`, `totalMs = t3 − t0`) |

**Camera:**
- `ImageAnalysis`, **fixed target resolution 1280×720**, `STRATEGY_KEEP_ONLY_LATEST`, `YUV_420_888`;
- decoding uses ZXing `QRCodeReader` on the Y plane (`PlanarYUVLuminanceSource`) with fixed hints;
- frames processed and dropped are counted.

**Logging:**
- Every check-in attempt, real class or experiment, is logged to Room.
- **Timeout:** no decode within 20 s gives `NO_DECODE`, which is logged and uploaded later.

### 5.3 Permissions
**Student app:**
- `CAMERA`, `INTERNET`
- `USE_BIOMETRIC` (and `USE_FINGERPRINT` for Android 6–8)
- Classroom beacon: `BLUETOOTH_SCAN` with `neverForLocation` (Android 12+); `BLUETOOTH`, `BLUETOOTH_ADMIN` and `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` (Android 6–11 only, where Bluetooth scans need location, and location must be switched on)

**Beacon app:** `CAMERA` (link code), `INTERNET`, `BLUETOOTH_ADVERTISE` (12+; `BLUETOOTH`/`BLUETOOTH_ADMIN` on 6–11), `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_CONNECTED_DEVICE`, `CHANGE_NETWORK_STATE` (lets the service start on 14+ before Nearby devices is granted), `POST_NOTIFICATIONS`, `WAKE_LOCK`.

Runtime prompts are handled on first launch. **Minimum SDK 23 (Android 6.0)**, target SDK 35. CameraX, Jetpack Compose, Room and androidx.biometric all support API 23.

### 5.4 Build and install
- Gradle project in `apps/qr-android` with two product flavours from one codebase: `student` (`lk.cse.attendance`) and `beacon` (`lk.cse.attendance.beacon`). Shared code is in `src/main`; each flavour has its own manifest in `src/student` / `src/beacon`, and the beacon app's code is in `src/beacon`.
- `./gradlew assembleDebug` builds both: `app/build/outputs/apk/student/debug/app-student-debug.apk` and `app/build/outputs/apk/beacon/debug/app-beacon-debug.apk`. Unit tests: `./gradlew testStudentDebugUnitTest testBeaconDebugUnitTest`.
- A GitHub Actions job builds a debug-signed APK, which can be downloaded from the workflow run.
- The server URL is a `BuildConfig` field, also editable in settings.

### 5.5 Beacon app (lecturer's phone)
1. **Link:** permissions (camera, Nearby devices, notifications), then scan the link code from the portal. The app creates its own EC P-256 Keystore key **without user authentication** (it runs unattended) and sends the public key with the code.
2. **Main screen:** the beacon's state (*Waiting for check-in* / *Broadcasting · module · session* / *Bluetooth is off* / *No connection*), a **Beacon on** switch, range (small room / hall / large hall = Low / Medium / High power), server, and *Unlink this phone*.
3. **Automatic on/off:** a foreground service polls `GET /beacon/current` every 2 s. While the lecturer has an open check-in, it broadcasts that run's code; when the run ends, it stops. It keeps a known run going through network drops of up to 5 minutes.

---

## 6. Server design

### 6.1 Identity and registration rules
- **A student is identified by index number.** One `Student` row per index number, shared across modules. The name the lecturer typed is stored **per roster entry**, because two lecturers may type it slightly differently.
- **A phone is identified by its Keystore key.** When a student first registers, the device is **bound** to that student. After that it can only act for that student.
- **The name check** is case-, space- and punctuation-insensitive: upper-case, then remove everything except letters and digits. So `Lokuhewa P. C.`, `LOKUHEWA P.C.` and `lokuhewa pc` all match. Index numbers must match exactly after upper-casing.

**Registration verdicts:**

| Situation | Result |
|---|---|
| Registration QR invalid or expired | `BAD_TOKEN` / `EXPIRED` (scan again) |
| Registration closed for the module | `REGISTRATION_CLOSED` |
| Index number not on this module's roster | `NOT_ON_ROSTER` |
| Name doesn't match the roster name | `NAME_MISMATCH` |
| Device unbound, and the student has no other active device | Bind the device to the student, mark the roster entry registered → `REGISTERED` |
| Device already bound to this student | Mark this module's roster entry registered → `REGISTERED` (no retyping) |
| Device bound to a **different** student | `DEVICE_BOUND_TO_OTHER_STUDENT` (one phone can't serve two people) |
| Student already has a **different** active device | `STUDENT_HAS_OTHER_DEVICE`. The lecturer presses **Reset device** to revoke the old one; the student then registers again |
| Already registered for this module | `ALREADY_REGISTERED` (harmless) |

- **Why the registration QR also rotates:** students must be in the room to register, so a friend can't register someone remotely with just their name and index number.
- **Why the lecturer can still spot misuse:** they see the phone model and time of every registration, plus failed attempts.
- **Limitation, stated in the report:** someone in the room who knows a classmate's name and index number could register first. The real student would then get `STUDENT_HAS_OTHER_DEVICE`, and the lecturer resets it.

**Check-in verdicts** (on top of the token checks in §6.3):

| Situation | Result |
|---|---|
| Device not bound / revoked | `UNKNOWN_DEVICE` / `DEVICE_REVOKED` |
| Student not registered for the session's module | `NOT_REGISTERED` |
| Outside the session's check-in time | `OUTSIDE_TIME` |
| Already marked for this session | `DUPLICATE` (the first record stays) |
| Otherwise | `OK` → attendance `PRESENT`, or `LATE` if after `startsAt + lateAfterMin` |

### 6.2 QR contents
The QR codes are kept short, so they decode from the back row:

```
Registration QR:  QA1:R:<token>
Check-in QR:      QA1:C:<token>
token = base64url( id(16) | seq(4) | HMAC-SHA256(secret, purpose | id | seq)[0..16] )   → 48 chars
```

- `id` is the moduleId for registration and the check-in windowId for check-in.
- `purpose` is `R` or `C`, so a registration code can never be used as a check-in code.
- The registration QR rotates slowly (T = 30 s). The check-in QR uses the window's T.
- **Beacon link QR** (portal, Beacon phones): `QA1:B:<code>`, a signed one-time code (2 minutes) naming the lecturer. Shown on the laptop only, never on the projector.

### 6.3 Rotating tokens
A token is computed from the time, so the server needs no stored token list:

```
seq        = floor((now − window.startedAt) / T)
issuedAt   = window.startedAt + seq × T
```

- **Projector page:** calls the token endpoint every 500 ms and redraws when `seq` changes. It also shows a small countdown and the `seq` number, so photos and videos of the screen can be matched to the logs.
- **Accept rule:** HMAC valid **and** `tokenAge = receivedAt − issuedAt ≤ T + grace`, with grace = 2 s for network delay.
- **Server clock only.** Token age uses only the server's clock, so phone clock errors don't matter.
- **Normal classes** use the default T = 10 s. After the experiment, this changes to the recommended T. **Experiment windows** set T explicitly.

### 6.4 Device key and signing
1. **Setup:** the app creates an **EC P-256 key in the Android Keystore**:
   - `setUserAuthenticationRequired(true)`, so the key is usable only right after a fingerprint, face or PIN check (setup per Android version below);
   - StrongBox when available (Android 9+), otherwise the TEE. The app records the real key level with `KeyInfo`.
2. **Device registration:** the app sends the **public key**, phone model and Android version to `POST /devices` and receives a `deviceId`.
3. **App login:** challenge–response as in the existing code. The server sends a nonce, the app signs `"QRv1-LOGIN" | deviceId | nonce`, and gets a short-lived JWT plus a refresh token.
4. **Every registration and check-in is signed** after a fingerprint or PIN check:
   - registration: `"QRv1-REG" | token | deviceId | indexNumber`;
   - check-in: `"QRv1-CHK" | token | deviceId | attemptId`.

   The server verifies each signature with the stored public key.
5. **Beacon phone** (its own key, no user authentication): link `"QRv1-BEACON-LINK" | code`, login `"QRv1-BEACON-LOGIN" | beaconId | nonce` → a 15-minute access JWT (`typ: beacon`), renewed by signing a new challenge.

**How the key is unlocked on each Android version** (minimum Android 6):

| Android | Fingerprint / face phones | PIN / pattern / password-only phones |
|---|---|---|
| 11+ (API 30+) | `setUserAuthenticationParameters(0, BIOMETRIC_STRONG or DEVICE_CREDENTIAL)` + `BiometricPrompt` with a `CryptoObject` (one unlock = one signature) | Same key and prompt; the PIN option is shown |
| 6–10 (API 23–29) | `setUserAuthenticationValidityDurationSeconds(-1)` + `BiometricPrompt` (androidx.biometric) with a `CryptoObject` | Key with `setUserAuthenticationValidityDurationSeconds(15)`, unlocked by `KeyguardManager.createConfirmDeviceCredentialIntent()`; the app signs straight after the PIN screen |

Each attempt logs which method was used (`authMethod`), so `biometricMs` can be compared fairly in the report.

### 6.5 Classroom beacon (being in the room)
The rotating QR stops old screenshots, but not someone outside the room who is sent a fresh one. A Wi-Fi name check was considered and dropped: anyone can rename a home router to `UOM_WIRELESS`. Instead, the lecturer's Android phone broadcasts a **Bluetooth LE beacon** with a rotating, signed code, and a check-in must include a current code heard by the student's phone.

**Advert** (same bytes in `apps/backend/src/lib/beacon.ts` and `core/BeaconCode.kt`):

```
manufacturer data, company ID 0xFFFF (reserved for testing), non-connectable, no device name
payload = "CA" | version 1 | seq (4, big-endian) | HMAC-SHA256(key, "B" | seq)[0..8]   → 15 bytes
key     = HMAC-SHA256(window secret, "QA1-BEACON-KEY")   (the beacon phone gets only this key)
seq     = floor((server now − window.startedAt) / 5 s)
```

- **Beacon phone:** knows the server time from each poll and the monotonic clock in between, and restarts the advert with each new code (minSdk 23 can't update a running advert).
- **Student phone:** `BluetoothLeScanner` with a filter on company ID 0xFFFF and the `CA 01` prefix, running while the scanner is open. The check-in sends up to 5 codes heard in the last 30 s, strongest first: `beacons: [{ data, rssi, heardAgoMs }]`. If none has been heard when the signature is made, the app waits up to 3 s more (not in experiment runs). The signed message is unchanged.
- **Server rule:** a code is valid if its HMAC matches this run's key and it was issued no more than **30 s** before the check-in arrived (2 s allowed the other way for clock skew), on the server clock. `beaconOk` = true (valid code), false (codes, none valid), null (none sent); the strongest valid code's `beaconRssi` and `beaconAgeMs` are stored. Signal strength is recorded only; a threshold can be set after the range test.
- **When it's required:** each check-in window has `requireBeacon`. Normal classes: on when the lecturer has a linked beacon phone (the lecturer can untick it, e.g. when the phone is forgotten). **Experiment runs (genuine and relay) never require it**; they record the result only, so the beacon can't change the measured times, and the relay receiver sits outside the hall by design.
- **Verdict:** `NO_BEACON` (*"Classroom beacon not found. Turn on Bluetooth and move closer to the front, then scan again."*), checked after the time window and before the duplicate check (§6.1).
- **Permissions per Android version** (student phone):

| Android | Needed to hear the beacon |
|---|---|
| 6–11 (API 23–30) | `ACCESS_FINE_LOCATION` (or COARSE on 6–9) granted **and** location switched on; Bluetooth on |
| 12+ (API 31+) | `BLUETOOTH_SCAN` ("Nearby devices") with `neverForLocation`; Bluetooth on. No location permission |

- **What it proves:** the phone was within Bluetooth range of the beacon (about 10–30 m indoors, depending on power, walls and people) within the last 30 s. It doesn't stop a determined live relay of both the QR and the beacon by two people with two devices; that's a stated limitation.
- **Not covered:** iPhones. A web app can't hear Bluetooth beacons (Safari and every iPhone browser have no Web Bluetooth), so iPhone support would need a native iOS app.

### 6.6 Data model (Prisma)

| Table | Key fields |
|---|---|
| `Lecturer` | id, name, email (unique), passwordHash, createdAt |
| `RefreshToken` | as in the existing code (hash, familyId, expiry, revoked); owner is a lecturer or a device |
| `Module` | id, lecturerId, intake, semester, code, name, registrationOpen, regSecret, regIntervalSec (30), createdAt. Unique (lecturerId, intake, semester, code) |
| `Student` | id, indexNumber (unique), createdAt |
| `RosterEntry` | id, moduleId, studentId, rosterName, addedVia (`MANUAL`/`CSV`), addedAt, **registeredAt** (null = not registered), registeredDeviceId. Unique (moduleId, studentId) |
| `Device` | id, studentId (null until bound), publicKey (SPKI), keyLevel (TEE/StrongBox), model, manufacturer, androidSdk, status (`ACTIVE`/`REVOKED`), label (experiment, e.g. "P1-lowend"), createdAt, boundAt. **At most one ACTIVE device per student** (partial unique index) |
| `RegistrationEvent` | id, moduleId, deviceId, indexNumberTyped, verdict, at (for the lecturer's "failed registrations" list) |
| `Session` | id, moduleId, title, startsAt, endsAt, venue, opensBeforeMin (15), lateAfterMin (15), isExperiment. CHECK endsAt > startsAt |
| `BeaconPhone` | id, lecturerId, publicKey (SPKI), keyLevel, model, manufacturer, androidSdk, pairingId (unique: each link code works once), createdAt, lastSeenAt, lastState (`waiting` / `broadcasting` / `bluetooth_off` / `no_permission` / `cant_broadcast`) |
| `CheckinWindow` | id, sessionId, intervalSec, graceSec (2), secret, requireBeacon, mode (`NORMAL` / `EXP_GENUINE` / `EXP_RELAY`), label, startedAt, endedAt |
| `Attendance` | id, sessionId, studentId, status (`PRESENT`/`LATE`/`EXCUSED`), source (`QR`/`MANUAL`), attemptId, markedAt, markedBy, note. Unique (sessionId, studentId). *Absent* = registered but no row |
| `Attempt` | id (client UUID), windowId, deviceId, studentId, **label fields** (phone, distanceRow, distanceM, role, runNo, attemptNo), **client timings** (decodeMs, framesProcessed, framesDropped, biometricMs, postRttMs, totalMs, authMethod, androidSdk), **server fields** (seq, issuedAt, receivedAt, **tokenAgeMs**), **beacon** (beaconOk, beaconRssi, beaconAgeMs), **verdict** (`OK`, `EXPIRED`, `BAD_TOKEN`, `BAD_SIGNATURE`, `NO_BEACON`, `NOT_REGISTERED`, `OUTSIDE_TIME`, `DUPLICATE`, `NO_DECODE`, `CANCELLED`, `NETWORK_ERROR`; `WRONG_NETWORK` is kept only for old rows), reason |

### 6.7 API (`/api/v1`)

**Lecturer auth.** The portal stores tokens in httpOnly cookies.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/lecturer/signup` · `/auth/lecturer/login` | Create account / log in |
| POST | `/auth/refresh` · `/auth/logout` | Rotate refresh token / log out |
| GET | `/me` | Current lecturer |

**Modules and students** (lecturer; owner only)

| Method | Path | Purpose |
|---|---|---|
| GET · POST | `/modules` | List my modules (with counts) / create |
| GET · PATCH · DELETE | `/modules/{id}` | View / edit / delete |
| GET | `/modules/{id}/students?status=all\|registered\|not_registered` | Roster with registration status |
| POST | `/modules/{id}/students` | Add one student `{indexNumber, name}` |
| POST | `/modules/{id}/students/import?dryRun=1` | CSV upload. A dry run returns the preview; without it, saves in one transaction |
| PATCH · DELETE | `/modules/{id}/students/{studentId}` | Edit roster name / remove from module |
| POST | `/students/{studentId}/reset-device` | Revoke the student's active device (new phone) |

**Registration**

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/modules/{id}/registration/open` · `/close` | lecturer | Open / close registration |
| GET | `/modules/{id}/registration/token` | registration projector page | Current registration token |
| GET | `/modules/{id}/registration/live` | portal | Registered count, latest registrations, failed attempts |
| POST | `/student/registrations` | app | `{token, indexNumber?, name?, signature}` → verdict and module summary |

**Sessions, check-in and attendance**

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET · POST | `/modules/{id}/sessions` | lecturer | List / create (optional `repeatWeeks`) |
| GET · PATCH · DELETE | `/sessions/{id}` | lecturer | View / edit / delete |
| POST | `/sessions/{id}/windows` | lecturer | **Start check-in**: `{intervalSec?, requireBeacon?, mode?, label?}` → windowId |
| POST | `/windows/{id}/end` | lecturer | Stop check-in |
| GET | `/windows/{id}/token` | check-in projector page | Current token, `seq`, `issuedAt`, `validUntil`, server time |
| GET | `/windows/{id}/live` | projector / portal | Checked-in count and latest names |
| POST | `/checkins` | app | Signed check-in → verdict, attendance status, `tokenAgeMs`, server times |
| POST | `/attempts/bulk` | app | Upload attempts that never reached the server (no decode, cancelled) and client timings |
| GET | `/sessions/{id}/attendance` | lecturer | Present / late / excused / absent among registered students |
| PUT | `/sessions/{id}/attendance/{studentId}` | lecturer | Manual mark `{status, note}` (logged) |
| GET | `/modules/{id}/attendance` | lecturer | Student × session matrix, per-student %, below-80% list |
| GET | `/modules/{id}/attendance.csv` | lecturer | Attendance export |
| GET | `/beacons` | lecturer | Linked beacon phones with live state |
| POST | `/beacons/link-code` | lecturer | One-time link QR `QA1:B:…` (2 minutes) |
| DELETE | `/beacons/{id}` | lecturer | Remove a beacon phone (it gets `UNLINKED`) |

**Student app**

| Method | Path | Purpose |
|---|---|---|
| POST | `/devices` | Register the public key → `deviceId` |
| POST | `/auth/device/challenge` · `/auth/device/verify` | Challenge–response login → JWT + refresh token |
| GET | `/student/me` | Bound student (index, names per module) or "not registered yet" |
| GET | `/student/modules` | My registered modules with attendance % |
| GET | `/student/modules/{id}` | Sessions (upcoming and past) and my attendance |

**Beacon app**

| Method | Path | Purpose |
|---|---|---|
| POST | `/beacon/link` | `{code, publicKey, keyLevel, model, manufacturer, androidSdk, signature}` → `{beaconId, lecturer}` |
| POST | `/beacon/auth/challenge` · `/beacon/auth/verify` | Challenge–response login → 15-minute JWT (`typ: beacon`) |
| GET | `/beacon/current?state=…` | Polled every 2 s: records the phone's state → `{serverTime, lecturer, run: {windowId, key, startedAt, rotateSec, mode, requireBeacon, session, module} \| null}` |

**Experiment**

| Method | Path | Purpose |
|---|---|---|
| GET | `/experiment/attempts.csv` | Raw per-attempt data with hashed device and student IDs, for the data package |

---

## 7. Projector pages
- Check-in: `https://attendance-backend-steel.vercel.app/present/checkin/<windowId>`
- Registration: `https://attendance-backend-steel.vercel.app/present/register/<moduleId>`
- **Fullscreen white page:**
  - the module title;
  - the QR code at a **fixed size** (e.g. 60% of screen height, error correction level M);
  - a countdown bar and the `seq` number (small);
  - a live counter.
- Opened from the portal (lecturer logged in). The URL alone can't control anything.
- Shows server-time drift, so the laptop's clock doesn't matter.

---

## 8. What is *not* in scope
- An iPhone app (Android only; stated in the limitations). A web app for iPhones couldn't hear the classroom beacon (§6.5).
- Push reminders before class (possible later with FCM; not needed for the experiment).
- Students self-enrolling without being on the lecturer's roster.
- Moodle integration (CSV import only).

---

## 9. Experiment protocol

### 9.1 How the experiment uses the system
- **Experiment module:** create `In22-S7-CS4473 - Mobile Computing (Experiment)`. Its roster is the two of us and any consenting volunteers.
- **Registration:** the test phones register through the normal registration QR.
- **Experiment sessions:** add sessions with `isExperiment = true`.
- **Check-in windows:** each run is one check-in window with a fixed T (5 / 10 / 20 s) and mode `EXP_GENUINE` or `EXP_RELAY`.
- **Repeat check-ins:** these sessions allow repeated check-ins by the same student. Every attempt is logged, even though only one attendance row is kept.
- **Run labels:** the hidden experiment settings in the app add the labels (phone, distance, run, attempt) to each attempt.
- **Classroom beacon:** experiment runs record whether the phone heard the beacon but never require it, and the app doesn't wait for it, so it doesn't change the measured times (§6.5).

### 9.2 Factors and constants
| | Levels |
|---|---|
| Refresh interval T | 5 s, 10 s, 20 s |
| Distance | Front, middle, back rows of **one lecture hall**, distances measured with tape (e.g. ~3 m, ~8 m, ~14 m) |
| Phones | **P1 low-end**, **P2 higher-end** (model and Android version recorded automatically) |
| Held constant | Hall, projector, room lighting, QR size and error correction level, scan resolution, time of day, campus Wi-Fi, same tester per phone |

### 9.3 Genuine trials
- **Conditions:** 9 (3 T × 3 distances), each with 3 runs × 4 attempts, per phone → **216 attempts**.
- **Order:** randomised by `analysis/qr/make_run_sheet.py` (fixed seed, printed run sheet).
- **Each attempt:**
  1. sit at the marked seat;
  2. the observer says "go" at a **random moment** (the run sheet gives a random delay of 0–T s, so attempts start at different points in a token's life);
  3. press Scan and aim;
  4. confirm the fingerprint or PIN;
  5. wait for the result.
- **Ground truth:** the run sheet pre-labels every attempt (phone, distance, T, run, attempt number). The server log and the projector `seq` give the true issue time of every token.

### 9.4 Relay trials
- **At least 10 relays per interval** (30 total). Relay windows use `mode = EXP_RELAY`; the classroom beacon is **not required** (the receiver is outside the hall by design).
- **Procedure:**
  1. **Sender in the hall** (any phone) screenshots the projector QR as soon as it changes;
  2. sends it on WhatsApp to the **receiver outside the hall** (e.g. the library, on campus Wi-Fi);
  3. the receiver opens the image fullscreen on a second device;
  4. scans it with the registered app phone, confirms, and submits.
- **Timing:** the sender notes the `seq` they captured, and the server's token age shows the full relay delay.

### 9.5 Pilot (before the real runs)
One short session in the hall:
- check the QR size is decodable from the back row;
- check the 20 s timeout is long enough;
- measure network round-trip times;
- **beacon range test:** with the beacon phone on the desk at Low / Medium / High power, record whether phones at the front, middle and back rows, in the corridor and in the next room hear it (and the signal strength). Choose the power for normal classes;
- run one real registration and check-in end to end;
- fix any app bugs.

Pilot data is **not** used in the results.

### 9.6 Privacy
- Only our own phones and consenting volunteers in the experiment module.
- Exports hash device and student IDs. Names and index numbers never appear in the data package.
- Real-class rosters stay in the lecturer portal and are not exported with the experiment data.

---

## 10. Analysis (`analysis/qr/analyze.py`)

| Output | Content |
|---|---|
| `summary_by_condition.csv` | For each phone × T × distance: success rate (mean ± SD across the 3 runs), decode time, total time, token age, frames processed, expired rate |
| `relay_by_interval.csv` | Relay success rate and token-age distribution for each T |
| Fig. 1 | Success rate vs distance, one line per T, one panel per phone (error bars = SD across runs) |
| Fig. 2 | Total check-in time box plots per condition |
| Fig. 3 | **Token age at check-in: genuine vs relay, per T.** This is the key figure: the gap or overlap shows the safe interval |
| Fig. 4 | Decode time vs frames processed (low-end vs high-end phone) |
| Text | Recommended T, or "no safe interval", with the numbers that decide it |

---

## 11. Report and data package (assignment checklist)

| Brief item | Where it comes from |
|---|---|
| Report §1 Introduction (≥2 references) | Android docs: CameraX ImageAnalysis, BiometricPrompt / Keystore; papers on QR attendance and relay attacks |
| §2 Prototype and method | Block diagram (§3), short description of the real system (§2), check-in pipeline (§5.2, §6), protocol (§9) |
| §3 Results | Figures 1–4 and the summary tables |
| §4 Discussion and limitations | Device heterogeneity, projector glare and lighting, WhatsApp compression, one hall, two phones, Android-only, classroom beacon range (walls, corridors) and live relay of both QR and beacon, first-come registration risk, biometric time depends on the person |
| §5 Contributions | The work split below |
| Data package | `attempts.csv` (raw, pseudonymised), run sheets, analysis script, figures, `apps/qr-android` source, README, **AI-usage log** |
| Demo deliverables | Lecturer creates a module, imports a CSV, a student registers; live check-in from the hall; screenshot relay rejected at T = 5 s; attendance view with the 80% line; results and plots |

---

## 12. Work split

| Area | Pamudu | Vinuka |
|---|---|---|
| Server: data model, lecturer auth, modules, roster, CSV import | ✅ lead | review |
| Server: registration, sessions, check-in windows, tokens, attendance, CSV export | ✅ lead | review |
| Lecturer portal pages + projector pages | ✅ | |
| Android: CameraX + ZXing pipeline, timing | | ✅ lead |
| Android: Keystore + fingerprint/PIN per Android version, device login | ✅ | |
| Android: registration flow, My modules, module detail | | ✅ |
| Android: Room log, upload, experiment settings | shared | shared |
| Android: beacon app (link, service, advertising) + student beacon scan | ✅ | review |
| Run sheet + protocol + pilot | shared | shared |
| Running the experiment (one tester per phone) | P1 | P2 |
| Analysis script + figures | | ✅ |
| Report writing | §1, §2, §5 | §3, §4 |
| AI-usage log | both keep their own entries | |

---

## 13. Timeline and priorities

| Week | Milestone | Done when |
|---|---|---|
| 1 | Server: data model + migration, lecturer auth, modules, roster + CSV import, sessions. Portal: login, modules, students, sessions pages | A lecturer can create `In22-S7-CS4473`, import a CSV and add sessions on the deployed site |
| 2 | Registration QR + projector page. Android: setup, Keystore per version, device login, registration flow, My modules | A phone registers with the same name/index; the roster shows *Registered ✓* |
| 3 | Check-in windows + rotating QR page. Android: scanner pipeline, timings, signed check-in, Room log, upload. Portal: attendance views + CSV | A real check-in marks Present/Late; attempts appear in the CSV; a full dry run of one condition gives correct rows |
| 4 | **Pilot in the hall** → fixes → **genuine trials** (216) → **relay trials** (30) | All attempts uploaded; spot-checks match the run sheet |
| 5 | Analysis, figures, report, data package, demo rehearsal | Report ≤ 4 pages (two-column); demo checklist passes |

**If time is short, build in this order:**
1. **Must:** the check-in path, rotating QR, measurements and logging, plus the minimum roster and registration needed to bind the test phones.
2. **Should:** CSV import, attendance views with the 80% line, session repeat.
3. **Could:** failed-registration list, Moodle CSV mapping, polish.

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Building the portal takes time from the experiment | Follow the Must / Should / Could order in §13; keep the portal plain |
| Low-end phone can't decode from the back row | Found in the pilot; adjust QR size once (then hold it constant) and report it |
| Projector glare or low contrast | Fix the room lighting, test brightness in the pilot, note it in the limitations |
| WhatsApp compresses the screenshot | Realistic for an attacker; report the relay decode failures separately |
| Campus Wi-Fi drops | Retries logged; `postRttMs` recorded separately so network delay doesn't hide decode time |
| Biometric time differs by person | Same tester per phone; `biometricMs` reported separately |
| Android 6–11 need location on for Bluetooth scans | The scanner shows "Location off" with a button to the settings; Android 12+ needs no location |
| Bluetooth off on a student's phone | The scanner shows "Bluetooth off" with a button to the settings; the rejection message says to turn it on |
| Android 6–10 PIN-only phones unlock the key differently | Log `authMethod`; report biometric and PIN times separately |
| Someone outside the room is sent a fresh QR | Classroom beacon (§6.5): the phone must hear a current beacon code. Remaining limitation: a live relay of both QR and beacon |
| Lecturer forgets the beacon phone, or it's off | Its live state shows on the session page; untick *Require the classroom beacon* for that class |
| Beacon leaks into the corridor or next room, or misses the back rows | Range test in the pilot (§9.5); power setting on the beacon phone; signal strength is logged for a later threshold |
| A phone can't broadcast (old Bluetooth chip) | The beacon app detects it and says so; use another Android phone |
| Someone registers as a classmate first | Rotating registration QR (must be in the room); lecturer sees phone model and time; **Reset device** fixes it |
| Lecturer's name and student's typed name differ slightly | Punctuation/space/case-insensitive match; lecturer can edit the roster name |
| Phone clock wrong | Token age uses server time only |
| Vercel cold start delays the first request | Warm-up request before each run; the first attempt of each run is flagged |
