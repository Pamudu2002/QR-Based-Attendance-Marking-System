import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * In development, Next only serves its scripts and live-reload connection to
 * localhost. Opening the dev server from this laptop's network address (for
 * example to test with a phone on the same Wi-Fi) then breaks every page, so
 * allow this machine's own IPv4 addresses. Extra hosts: DEV_ORIGINS="a,b".
 */
function devOrigins(): string[] {
  const own = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
  const extra = (process.env.DEV_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return [...own, ...extra];
}

const nextConfig: NextConfig = {
  // argon2 ships a native binary; keep it out of the bundle.
  serverExternalPackages: ["@node-rs/argon2"],
  typedRoutes: false,
  allowedDevOrigins: devOrigins(),
};

export default nextConfig;
