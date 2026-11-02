# CSE Attendance: student app (Kotlin)

Native Android app for students: set up the phone, register for modules, check in by scanning the projected QR, and see My modules. Every check-in attempt is timed and logged for the experiment.

## Build

Needs JDK 17 or 21 and the Android SDK (platform 36, build-tools 36). Android Studio has both: open this folder (`apps/qr-android`) and run.

From the command line:

```bash
cd apps/qr-android
./gradlew assembleDebug        # app/build/outputs/apk/debug/app-debug.apk
./gradlew testDebugUnitTest    # JVM unit tests (QR format, signed messages, 80% rule)
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`local.properties` (not committed) points at the SDK: `sdk.dir=C\:/Users/<you>/AppData/Local/Android/Sdk`.

## Server

The default is `BuildConfig.SERVER_URL` (the Vercel deployment). Change it in **Settings → Server**. Debug builds also allow plain `http`, so a phone on the same Wi-Fi can use the laptop: run `pnpm dev -- -H 0.0.0.0` in `apps/backend` and enter `http://<laptop IP>:3000`.

## How it works

| Part | Where | Notes |
|---|---|---|
| Keystore key | `security/DeviceKey.kt` | EC P-256, `SHA256withECDSA`, StrongBox if available, else TEE. Key level from `KeyInfo` |
| Unlocking per Android version | `security/UserAuth.kt` | 11+: BiometricPrompt with a CryptoObject, fingerprint/face/PIN. 6–10 with fingerprint: BiometricPrompt, fingerprint only. 6–10 PIN-only: device credential screen, key valid 15 s |
| Login | `data/Session.kt` | Challenge–response: signs `QRv1-LOGIN\|deviceId\|nonce`, gets a 15-min access token and a one-time refresh token |
| QR decoding | `scan/QrAnalyzer.kt` | CameraX `ImageAnalysis` 1280×720, `KEEP_ONLY_LATEST`, `YUV_420_888`; ZXing `QRCodeReader` on the Y plane. Counts processed and dropped frames |
| Check-in and timings | `data/CheckIns.kt` | t0 Scan pressed → t1 decode → t2 signature → t3 reply (`elapsedRealtimeNanos`). Saved in Room before sending; uploaded with `/attempts/bulk` |
| Wi-Fi name | `data/WifiReader.kt` | Per Android version (PLAN §6.5); Android 12+ uses a location-aware network callback |
| Experiment settings | Home → long-press the greeting | Phone label, seat row, metres, role, run, next attempt, scan timeout. Labels are added to attempts while a phone label is set |
| API | `data/Api.kt` | OkHttp + kotlinx.serialization. Contract: [`docs/app-api.md`](../../docs/app-api.md) |
| Theme | `ui/theme/` | Copied from `design/android/` (Lumora). Newsreader font: SIL OFL, see `third_party/` |

## Without a phone

`apps/backend/scripts/sim-phone.ts` does the same server calls with a software key, so the server can be tested before installing the app.
