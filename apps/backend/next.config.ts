import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // argon2 ships a native binary; keep it out of the bundle.
  serverExternalPackages: ["@node-rs/argon2"],
  typedRoutes: false,
};

export default nextConfig;
