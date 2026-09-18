import path from "node:path";
import type { NextConfig } from "next";

// The repository keeps one .env at the root so Compose, Prisma, and the Python
// backend all read the same file. Next only looks inside its own directory, so
// load the root file first. Real environment variables already present (as in
// Docker and CI) are not overwritten.
try {
  process.loadEnvFile?.(path.resolve(process.cwd(), "..", ".env"));
} catch {
  // No root .env: expected in containers and CI, where values are injected.
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  typedRoutes: false,
  // The dev server runs in a container published on 0.0.0.0, so it is reached
  // by whichever host name the developer types. Next refuses to serve its dev
  // chunks to an origin it was not told about, and the refusal is silent in
  // the browser: the page renders from the server and then never hydrates, so
  // nothing on it responds to a click. Listing both loopback spellings keeps
  // that from looking like an application bug. Dev-only; ignored in a build.
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
      ]
    }];
  }
};

export default nextConfig;
