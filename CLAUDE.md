# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Git and GitHub: read this first

- **Never push to GitHub.** Do not run `git push` in any form. Do not create branches on the remote, open pull requests, or use GitHub API/MCP tools to write to the repository.
- **Never commit unless the user asks for that commit.** By default, leave changes uncommitted in the working tree.
- The team members review, commit and push all changes themselves. When a task is done, list the changed files and suggest a commit message. Do not commit or push it.
- Do not rewrite history (`rebase`, `reset --hard`, `commit --amend`, force-push) or delete branches.

## Project

CS4473 Mobile Computing, Assignment 2. Team Divinus (Group 13): Pamudu Chandeepa (220366X), Vinuka Buddhima (220720E).

**Topic:** *Usability vs. Replay Security of Rotating-QR Attendance: Finding a Safe QR Refresh Interval on Real Android Phones.*

**What we build:** a real attendance system plus an experiment that runs on top of it.
- **Lecturer web portal:** login, modules shown like Moodle (`In22-S7-CS4473 - Mobile Computing`), students added by index number + name (one at a time or by CSV), registration QR, sessions, rotating check-in QR, attendance views with the 80% line.
- **Student app (Kotlin):** register with the same name + index number the lecturer entered, then check in by scanning the projected QR.
- **Experiment:** measures how refresh interval and distance affect check-in success and time, and whether screenshot relays are rejected.

The full plan is in [`docs/PLAN.md`](docs/PLAN.md). Follow it. Ask before changing the experiment design (factors, levels, repetitions, accept rule), because the proposal has been approved.

### Hard requirements from the assignment brief
- The phone app is **native Android in Kotlin**. Do not use React Native, Flutter or another cross-platform framework.
- Use **low-level platform APIs** directly: CameraX `ImageAnalysis` with our own decoding (ZXing core on the Y plane), Android Keystore, BiometricPrompt, WifiManager. Do not use high-level scanner wrappers (e.g. ML Kit code scanner UI, ZXing `IntentIntegrator`/embedded activity).
- Every check-in attempt must be logged with its timings so it can be analysed (mean ± SD, ≥3 runs per condition).
- Privacy: no names or index numbers in experiment exports. Device and student IDs are hashed.
- The experiment carries the marks. Keep the portal simple, and build in the Must / Should / Could order in `docs/PLAN.md` §13.

## Repository layout

| Path | What it is | Status |
|---|---|---|
| `apps/qr-android/` | Student app: Kotlin, Jetpack Compose, Gradle | **Active** (new) |
| `apps/backend/` | Next.js 16 (App Router) + Prisma 7 + PostgreSQL (Neon), deployed on Vercel | **Active**: API under `src/app/api/v1/`, lecturer portal pages under `src/app/(portal)/`, projector pages under `src/app/present/` |
| `analysis/qr/` | Python analysis (pandas, matplotlib) and the run sheet generator | **Active** (new) |
| `design/` | UI design: Lumora tokens, CSS, Compose theme, one design file per screen | **Follow it** for every screen (see Design below) |
| `packages/shared/` | Shared TypeScript schemas and types | Reuse if helpful |
| `apps/host/`, `apps/student/`, `packages/mobile-core/`, `native-tests/` | Old NFC / React Native system | **Do not modify.** Not part of this assignment |

## Design

The UI follows the Lumora design system. Read `design/README.md` before building or changing any screen.

- The product name is **CSE Attendance**. Never use "Divinus Attend".
- Each screen has a design file in `design/screens/` (light and `…Dark` versions). Match its layout, copy and states. The tables in `design/README.md` map design files to routes and app screens.
- **Web portal:** use `design/tokens/tokens.css` variables and the `lu-` classes from `design/tokens/lumora-components.css`. Don't hard-code colours.
- **Android app:** use `CseAttendanceTheme`, `MaterialTheme` and `Lumora.colors` from the Compose theme copied from `design/android/`. Don't hard-code colours.
- `brand` teal is the primary colour, with one primary button per screen. Statuses use `success` / `warning` / `danger` and always come with an icon or a word.
- Fonts: the system UI font for the interface, Newsreader only for the name, greetings and headlines, and monospace for index numbers and timings.
- Light and dark themes are both required. The QR code is always black on white.
- Copy is in sentence case. Buttons start with a verb. No "OK", exclamation marks or emoji.

## Domain rules (see `docs/PLAN.md` §6)

- A **student** is identified by **index number** (`^\d{6}[A-Z]$`, upper-cased). One `Student` per index; the lecturer's typed name is stored per `RosterEntry`.
- A **module** is owned by one lecturer. Intake + semester + code is unique per lecturer. A lecturer has many modules; a student can be registered in many modules.
- **Registration:** the student scans the module's rotating registration QR and enters name + index. It succeeds only if the index is on that module's roster and the name matches. Names are compared after upper-casing and removing everything except letters and digits.
- **One active device per student; one student per device.** A new phone needs the lecturer's **Reset device**.
- **Check-in** is allowed only for students registered in the session's module, within the session's check-in time. The first check-in creates the `Attendance` row (`PRESENT` or `LATE`). Absent = registered with no row.
- QR payloads: `QA1:R:<token>` (registration) and `QA1:C:<token>` (check-in). The HMAC includes the purpose, so one type can't be used as the other.

## Conventions

### Android (`apps/qr-android`)
- Kotlin, Jetpack Compose, min SDK 23 (Android 6.0), target SDK 35. Wi-Fi SSID and key-unlock code must follow the per-version tables in `docs/PLAN.md` §6.4–6.5.
- Timings use `SystemClock.elapsedRealtimeNanos()`. Do not use wall-clock time for durations.
- Camera: `ImageAnalysis`, fixed 1280×720, `STRATEGY_KEEP_ONLY_LATEST`, `YUV_420_888`. Count processed and dropped frames.
- Keystore: EC P-256, `SHA256withECDSA`, DER signatures. Public key as X.509 SPKI DER, base64 in JSON. StrongBox when available, else TEE.
- Signed messages: `"QRv1-LOGIN" | deviceId | nonce`, `"QRv1-REG" | token | deviceId | indexNumber`, `"QRv1-CHK" | token | deviceId | attemptId`.
- The server URL is a `BuildConfig` field, editable in the settings screen.

### Backend (`apps/backend`)
- Route handlers use the existing `handler` wrapper and `ApiError` from `src/lib/http.ts`. Validate every body with zod.
- Every lecturer route checks that the lecturer owns the module or session.
- Token age is measured **only on the server clock**. Accept rule: valid HMAC and `tokenAgeMs ≤ (intervalSec + graceSec) × 1000`.
- CSV import: dry run first, then save in one transaction.
- Schema changes go through a new Prisma migration. Never edit applied migrations, and never run `prisma migrate reset` against a shared database.
- Never print or commit secrets (`DATABASE_URL`, `JWT_SECRET`, module/window secrets).

## Commands

```bash
# Backend
pnpm install
pnpm --filter @attendance/backend dev          # http://localhost:3000
pnpm --filter @attendance/backend typecheck
pnpm --filter @attendance/backend test         # needs local Postgres (DB attendance_test)

# Android (from apps/qr-android)
./gradlew assembleDebug
./gradlew testDebugUnitTest

# Analysis
python analysis/qr/make_run_sheet.py
python analysis/qr/analyze.py attempts.csv
```

Before saying a task is done, run the relevant typecheck, tests or build and report the real result. If something could not be run (e.g. no phone or no Android SDK), say so.
