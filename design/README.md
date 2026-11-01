# CSE Attendance: design

The approved UI design for the lecturer web portal and the student Android app, in light and dark themes, built on the **Lumora** design system.

- **Live design canvas** (private; share it from its Share menu): https://claude.ai/artifact/ScVvNQXCVgAC9YfhUnnsHM
- Everything in this folder was exported from that canvas. The canvas is the visual reference; this folder is what the code uses.

```
design/
  README.md                  this file
  tokens/
    lumora.tokens.json       source of truth: every colour, font, spacing, radius, shadow
    tokens.css               the same tokens as CSS variables, light + dark (web portal)
    lumora-components.css    Lumora's ready-made CSS classes (lu-btn, lu-badge, lu-notice, …)
  android/
    Color.kt  Type.kt  Theme.kt   Jetpack Compose theme for the student app
  screens/
    *.dc.html                one file per screen (design source, for reference)
    canvas.json              screen list and canvas layout
    assets/qr-*.svg          the sample QR codes used in the screens
```

---

## 1. Design rules (short version)

| Thing | Rule |
|---|---|
| Name | **CSE Attendance**, set in the Newsreader serif ("CSE" in `ink`, "Attendance" in `ink-muted`). There is no logo mark |
| Surfaces | Flat. Page background `surface-sunken`, cards `surface` with a 1px `line` border and `radius-lg` (10px). Shadows only on things that float (popovers, bottom sheets, the QR "paper") |
| Primary colour | `brand` teal: primary buttons, links, the active menu item (`selected` fill + `brand` text). **One primary button per screen** |
| Accent | `lumen` amber: tips (`lumen-soft` background, lead phrase in `lumen-ink`) and chart highlights. Never a button colour |
| Statuses and messages | `success` green: present, registered, saved. `warning` amber: late, not registered, name differs, close to 80%. `danger` red: rejected, failed registration, errors. Info notes use `brand-soft`. **Always add an icon or a word; never show state by colour alone** |
| Text | System UI font. Body 13px on the portal (14px in the app). Titles 15px (panels) and 20px (page/dialog). Newsreader only for the name, greetings and big headlines. Monospace for index numbers, timings, codes |
| Spacing | 4px grid. Controls 32px tall on the portal, at least 44px on the phone |
| Writing | Sentence case. Buttons say what they do ("Import 58 students", "Start check-in"). Errors say what happened and what to do. No "OK", no exclamation marks, no emoji |
| Dark mode | Every screen has a dark version. The QR is always black on white (on the `paper` card) so phones can scan it in both themes |

Status → component cheat sheet:

| Meaning | Web (class) | Android (colours) |
|---|---|---|
| Present / registered / done | `lu-badge lu-badge--success` | `Lumora.colors.success` on `successSoft` |
| Late / not registered / needs a look | `lu-badge lu-badge--warning` | `warning` on `warningSoft` |
| Rejected / error / failed | `lu-badge lu-badge--danger` | `danger` on `dangerSoft` |
| Info note | `lu-notice lu-notice--info` | `ink` on `brandSoft`, icon in `brand` |
| Tip | `lu-notice lu-notice--tip` | `ink` on `lumenSoft`, lead phrase in `lumenInk` |
| Neutral | `lu-badge` | `inkMuted` on `surfaceSunken` |

---

## 2. Using it in the lecturer portal (Next.js)

1. Copy `tokens/tokens.css` and `tokens/lumora-components.css` into the web app, e.g. `apps/backend/src/app/styles/`.
2. Import both once in the root layout (`src/app/layout.tsx`), tokens first:
   ```ts
   import "./styles/tokens.css";
   import "./styles/lumora-components.css";
   ```
3. Load Newsreader for the brand text with `next/font/google` (weight 500) and use `var(--font-display)` only for the name, greetings and headlines.
4. Build pages with the CSS variables (`var(--surface)`, `var(--brand)`, …) and the `lu-` classes:
   ```html
   <button class="lu-btn lu-btn--primary">Start check-in</button>
   <span class="lu-badge lu-badge--success">Present</span>
   <div class="lu-notice lu-notice--warning">…</div>
   <input class="lu-input">
   ```
5. **Dark mode:** it follows the computer's setting automatically. For the theme button, set `document.documentElement.dataset.theme = "dark"` (or `"light"`) and remember the choice.
6. **Icons:** use `lucide-react`, 16px in buttons and lists, 18px in toolbars, stroke width 1.75.

Portal screens (open the matching file in `screens/` or the canvas to see the layout):

| Screen | Design file | Route in `docs/PLAN.md` |
|---|---|---|
| Login | `PortalLogin.dc.html` | `/login` |
| Dashboard | `Main.dc.html` | `/` |
| Modules | `PortalModules.dc.html` | `/modules` |
| Module students + registration | `PortalStudents.dc.html` | `/modules/[id]` (Students tab) |
| CSV import | `PortalCsvImport.dc.html` | `/modules/[id]` → Import CSV |
| Sessions | `PortalSessions.dc.html` | `/modules/[id]` (Sessions tab) |
| Attendance | `PortalAttendance.dc.html` | `/modules/[id]` (Attendance tab) |
| Projector: check-in QR | `Projector.dc.html` (kind = checkin) | `/present/checkin/[windowId]` |
| Projector: registration QR | `ProjectorRegister.dc.html` | `/present/register/[moduleId]` |
| Shared sidebar / top bar | `Sidebar.dc.html`, `Topbar.dc.html` | portal layout |

Files ending in `Dark.dc.html` are the same screens in the dark theme.

---

## 3. Using it in the student app (Kotlin, Jetpack Compose)

1. Copy `android/Color.kt`, `Type.kt` and `Theme.kt` into `apps/qr-android/app/src/main/java/<your/package>/ui/theme/` and change the `package` line in each file.
2. Download **Newsreader Medium** from Google Fonts (SIL Open Font License) and save it as `app/src/main/res/font/newsreader_medium.ttf`.
3. Needs Compose Material 3 **1.2 or newer** (for `surfaceContainer` colours).
4. Wrap the app:
   ```kotlin
   setContent {
       val dark = /* Appearance setting, or */ isSystemInDarkTheme()
       CseAttendanceTheme(darkTheme = dark) { AppNavHost() }
   }
   ```
5. Use Material components as usual (they pick up the Lumora colours). For statuses use the extra palette:
   ```kotlin
   Text("Present", color = Lumora.colors.success,
        modifier = Modifier.background(Lumora.colors.successSoft, MaterialTheme.shapes.extraSmall))
   ```
6. Buttons are 48dp tall, every tap target at least 44dp.

App screens:

| Screen | Design file | Screen in `docs/PLAN.md` §5.1 |
|---|---|---|
| Welcome / setup | `AppWelcome.dc.html` | 1 |
| Register for a module | `AppRegister.dc.html` | 2 |
| Home (My modules) | `AppHome.dc.html` | 3 |
| Module detail | `AppModule.dc.html` | 4 |
| Scanner | `AppScanner.dc.html` | 5 (camera view stays dark in both themes) |
| Check-in result | `AppResult.dc.html` | 6 |
| Experiment settings (hidden) | `AppSettings.dc.html` | 7 |

---

## 4. About the files in `screens/`

- They are **design source**, not production code. Open them on the canvas to see them rendered. The raw files show the exact colours, spacing and copy for each screen, which is useful when building a screen or when asking Claude Code to build one ("build the Sessions page to match `design/screens/PortalSessions.dc.html`").
- They use the canvas's own runtime, so they don't open as normal web pages in a browser.
- Image references like `/_blob/6eb2…` are the sample QR codes, saved here as `screens/assets/qr-checkin.svg` and `qr-register.svg`.
- All names, numbers and dates in the screens are sample data.
