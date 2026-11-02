// Phone simulator: does what the Android app does (P-256 key, signed requests)
// so the server can be tested before the app exists. Not used in the experiment.
//
//   pnpm --filter @attendance/backend sim:phone register --payload "QA1:R:…" --index 220366X --name "Lokuhewa P. C."
//   pnpm --filter @attendance/backend sim:phone register --module <id> --lecturer demo@uom.lk:demo-pass-2026 --index …
//   pnpm --filter @attendance/backend sim:phone me
//   pnpm --filter @attendance/backend sim:phone checkin --window <id> --lecturer demo@uom.lk:demo-pass-2026 [--delay 12000]
//       [--ssid UniWiFi] [--label P1-lowend --row FRONT --distance 3 --role GENUINE --run 1 --attempt 1]
//   pnpm --filter @attendance/backend sim:phone nodecode [--label …]     (logs a NO_DECODE attempt)
//
// Options: --base http://localhost:3000   --phone sim1 (keeps one key per name in .sim-phone-<name>.json)
import { generateKeyPairSync, sign, createPrivateKey } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    base: { type: "string", default: "http://localhost:3000" },
    phone: { type: "string", default: "sim1" },
    payload: { type: "string" },
    module: { type: "string" },
    lecturer: { type: "string" },
    index: { type: "string" },
    name: { type: "string" },
    window: { type: "string" },
    delay: { type: "string" },
    ssid: { type: "string" },
    label: { type: "string" },
    row: { type: "string" },
    distance: { type: "string" },
    role: { type: "string" },
    run: { type: "string" },
    attempt: { type: "string" },
  },
});
const command = positionals[0] ?? "me";
const base = values.base!.replace(/\/$/, "");
const stateFile = `.sim-phone-${values.phone}.json`;

type State = { privateKeyPem: string; publicKeyB64: string; deviceId?: string; refreshToken?: string };

function sig(privateKeyPem: string, message: string) {
  return sign("sha256", Buffer.from(message, "utf8"), { key: createPrivateKey(privateKeyPem), dsaEncoding: "der" }).toString("base64");
}

async function call<T>(path: string, init: { method?: string; body?: unknown; token?: string; cookie?: string } = {}) {
  const res = await fetch(`${base}/api/v1${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
      ...(init.cookie ? { Cookie: init.cookie } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status} ${path}: ${JSON.stringify(data)}`);
  return { data: data as T, res };
}

function load(): State {
  if (existsSync(stateFile)) return JSON.parse(readFileSync(stateFile, "utf8"));
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return {
    privateKeyPem: privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
    publicKeyB64: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  };
}

/** Device setup (first run) and challenge–response login. Returns an access token. */
async function login(state: State): Promise<string> {
  if (!state.deviceId) {
    const { data } = await call<{ deviceId: string }>("/devices", {
      body: { publicKey: state.publicKeyB64, keyLevel: "SOFTWARE", model: `Simulator ${values.phone}`, manufacturer: "Node", androidSdk: 35 },
    });
    state.deviceId = data.deviceId;
    console.log(`Device set up: ${state.deviceId}`);
  }
  const { data: ch } = await call<{ nonce: string }>("/auth/device/challenge", { body: { deviceId: state.deviceId } });
  const { data: tokens } = await call<{ accessToken: string; refreshToken: string }>("/auth/device/verify", {
    body: { deviceId: state.deviceId, nonce: ch.nonce, signature: sig(state.privateKeyPem, `QRv1-LOGIN|${state.deviceId}|${ch.nonce}`) },
  });
  state.refreshToken = tokens.refreshToken;
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
  return tokens.accessToken;
}

/** The QR text: given, or fetched as the lecturer from `path` (what the projector shows). */
async function projectorPayload(path: string | null): Promise<string> {
  if (values.payload) return values.payload;
  if (!path || !values.lecturer) throw new Error("Pass --payload, or --module/--window and --lecturer email:password.");
  const [email, password] = values.lecturer.split(":");
  const { res } = await call("/auth/lecturer/login", { body: { email, password } });
  const cookie = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const { data } = await call<{ payload: string; seq: number }>(path, { cookie });
  console.log(`Projector code #${data.seq}: ${data.payload}`);
  return data.payload;
}

/** Run-sheet labels from the flags, as the app's experiment settings would add them. */
function labels() {
  const num = (v?: string) => (v === undefined ? undefined : Number(v));
  return {
    phoneLabel: values.label,
    distanceRow: values.row?.toUpperCase(),
    distanceM: num(values.distance),
    role: values.role?.toUpperCase(),
    runNo: num(values.run),
    attemptNo: num(values.attempt),
  };
}

async function main() {
  const state = load();
  const access = await login(state);

  if (command === "checkin") {
    const t0 = performance.now();
    const payload = await projectorPayload(values.window ? `/windows/${values.window}/token` : null);
    const decodeMs = performance.now() - t0;
    // A relay: screenshot, send on WhatsApp, open on another screen, scan.
    if (values.delay) await new Promise((r) => setTimeout(r, Number(values.delay)));
    const token = payload.replace(/^QA1:C:/, "");
    const attemptId = crypto.randomUUID();
    const t1 = performance.now();
    const signature = sig(state.privateKeyPem, `QRv1-CHK|${token}|${state.deviceId}|${attemptId}`);
    const biometricMs = performance.now() - t1;
    const t2 = performance.now();
    const { data } = await call<Record<string, unknown>>("/checkins", {
      token: access,
      body: { token: payload, attemptId, signature, ssid: values.ssid ?? null, decodeMs, biometricMs, authMethod: "SIMULATOR", ...labels() },
    });
    const postRttMs = performance.now() - t2;
    // Timings known only after the reply go up with the log, as the app does.
    await call("/attempts/bulk", { token: access, body: { attempts: [{ id: attemptId, postRttMs, totalMs: performance.now() - t0 }] } });
    const { verdict, attendance, tokenAgeMs, seq, message } = data as Record<string, unknown>;
    console.log(JSON.stringify({ verdict, attendance, tokenAgeMs, seq, message }));
  } else if (command === "nodecode") {
    const { data } = await call("/attempts/bulk", {
      token: access,
      body: { attempts: [{ id: crypto.randomUUID(), verdict: "NO_DECODE", reason: "No code within 20 s", framesProcessed: 300, ...labels() }] },
    });
    console.log(JSON.stringify(data));
  } else if (command === "register") {
    const payload = await projectorPayload(values.module ? `/modules/${values.module}/registration/token` : null);
    const token = payload.replace(/^QA1:R:/, "");
    // Like the app: show which module the code is for before signing anything.
    const { data: preview } = await call<{ verdict: string; module?: { displayName: string } }>("/student/registrations/preview", {
      token: access,
      body: { token: payload },
    });
    console.log(`Preview: ${preview.verdict} ${preview.module?.displayName ?? ""}`);
    const me = await call<{ student: { indexNumber: string } | null }>("/student/me", { token: access });
    const index = values.index?.toUpperCase() ?? me.data.student?.indexNumber;
    if (!index) throw new Error("This phone isn't registered yet. Pass --index and --name.");
    const { data } = await call("/student/registrations", {
      token: access,
      body: {
        token: payload,
        ...(values.index ? { indexNumber: index } : {}),
        ...(values.name ? { name: values.name } : {}),
        signature: sig(state.privateKeyPem, `QRv1-REG|${token}|${state.deviceId}|${index}`),
      },
    });
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify((await call("/student/me", { token: access })).data, null, 2));
    console.log(JSON.stringify((await call("/student/modules", { token: access })).data, null, 2));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
