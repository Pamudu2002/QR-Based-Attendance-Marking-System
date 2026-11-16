// Fetch helper for client components. Refreshes the access cookie once on 401.

export class ClientApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors: Record<string, string[] | undefined> = {},
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown };

async function send(path: string, opts: Options) {
  return fetch(`/api/v1${path}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    credentials: "same-origin",
  });
}

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  let res = await send(path, opts);
  if (res.status === 401 && !path.startsWith("/auth/")) {
    // Admin API calls use the admin session; everything else the lecturer's.
    const admin = path.startsWith("/admin/");
    const refreshed = await fetch(admin ? "/api/v1/auth/admin/refresh" : "/api/v1/auth/refresh", {
      method: "POST",
      credentials: "same-origin",
    });
    if (refreshed.ok) res = await send(path, opts);
    else {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${admin ? "/admin/login" : "/login"}?next=${next}`;
    }
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error ?? {};
    if (err.code === "PASSWORD_CHANGE_REQUIRED") window.location.href = "/change-password";
    throw new ClientApiError(
      res.status,
      err.code ?? "ERROR",
      err.message ?? "Something went wrong. Try again.",
      err.details?.fieldErrors ?? {},
    );
  }
  return data as T;
}
