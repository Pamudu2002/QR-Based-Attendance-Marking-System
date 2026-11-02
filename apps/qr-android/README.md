# CSE Attendance: Android apps (Kotlin)

Two native apps from one Gradle project (product flavours):

- **CSE Attendance** (`student`, `lk.cse.attendance`): set up the phone, register for modules, check in by scanning the projected QR while listening for the classroom beacon, and see My modules. Every check-in attempt is timed and logged for the experiment.
- **CSE Attendance Beacon** (`beacon`, `lk.cse.attendance.beacon`): the lecturer's phone. Linked once from the portal, it broadcasts the classroom beacon while check-in is open (PLAN §5.5, §6.5).

Shared code is in `app/src/main`; `app/src/student` and `app/src/beacon` hold each app's manifest, and `src/beacon` the beacon app's code.

## Build

Needs JDK 17 or 21 and the Android SDK (platform 36, build-tools 36). Android Studio has both: open this folder (`apps/qr-android`) and run.

From the command line:

```bash
cd apps/qr-android
./gradlew assembleDebug        # both apps: app/build/outputs/apk/{student,beacon}/debug/app-{student,beacon}-debug.apk
./gradlew testStudentDebugUnitTest testBeaconDebugUnitTest    # JVM unit tests (QR format, signed messages, beacon code, 80% rule)
adb install -r app/build/outputs/apk/student/debug/app-student-debug.apk
adb install -r app/build/outputs/apk/beacon/debug/app-beacon-debug.apk     # on the lecturer's phone
```

`local.properties` (not committed) points at the SDK: `sdk.dir=C\:/Users/<you>/AppData/Local/Android/Sdk`.

## Server

The default is `BuildConfig.SERVER_URL` (the Vercel deployment). Change it on the setup screen or in **Settings → Server** (student), or on the beacon app's screen. Debug builds also allow plain `http`, so a phone on the same Wi-Fi can use the laptop: run `pnpm dev -- -H 0.0.0.0` in `apps/backend` and enter `http://<laptop IP>:3000`.

## How it works

| Part | Where | Notes |
|---|---|---|
| Keystore key | `security/DeviceKey.kt` | EC P-256, `SHA256withECDSA`, StrongBox if available, else TEE. Key level from `KeyInfo` |
| Unlocking per Android version | `security/UserAuth.kt` | 11+: BiometricPrompt with a CryptoObject, fingerprint/face/PIN. 6–10 with fingerprint: BiometricPrompt, fingerprint only. 6–10 PIN-only: device credential screen, key valid 15 s |
| Login | `data/Session.kt` | Challenge–response: signs `QRv1-LOGIN\|deviceId\|nonce`, gets a 15-min access token and a one-time refresh token |
| QR decoding | `scan/QrAnalyzer.kt` | CameraX `ImageAnalysis` 1280×720, `KEEP_ONLY_LATEST`, `YUV_420_888`; ZXing `QRCodeReader` on the Y plane. Counts processed and dropped frames |
| Check-in and timings | `data/CheckIns.kt` | t0 Scan pressed → t1 decode → t2 signature → t3 reply (`elapsedRealtimeNanos`). Saved in Room before sending; uploaded with `/attempts/bulk` |
| Classroom beacon (student) | `data/BeaconListener.kt` | `BluetoothLeScanner` filtered to our manufacturer data while the scanner is open; codes go with the check-in. Android 12+: Nearby devices (`neverForLocation`); 6–11: location permission and location on |
| Beacon code | `core/BeaconCode.kt` | The 15-byte advert, same bytes as the server (`BeaconCodeTest` shares test values with `beacon.test.ts`) |
| Beacon app | `src/beacon/…/beacon/` | `BeaconService`: foreground service, polls `/beacon/current` every 2 s and broadcasts with `BluetoothLeAdvertiser` (`Broadcaster`) while a check-in is open. `BeaconKey`: Keystore key without user auth |
| Experiment settings | Home → long-press the greeting | Phone label, seat row, metres, role, run, next attempt, scan timeout. Labels are added to attempts while a phone label is set |
| API | `data/Api.kt` | OkHttp + kotlinx.serialization. Contract: [`docs/app-api.md`](../../docs/app-api.md) |
| Theme | `ui/theme/` | Copied from `design/android/` (Lumora). Newsreader font: SIL OFL, see `third_party/` |

## Without a phone

`apps/backend/scripts/sim-phone.ts` does the same server calls with a software key, for both apps (`beacon-link`, `beacon-status`, `checkin --beacon`), so the server can be tested before installing them.
