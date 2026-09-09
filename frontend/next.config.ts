import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(
  fileURLToPath(import.meta.url)
);

// Browser calls same-origin /api/* so auth cookies are first-party.
// Next rewrites those to the real Express backend.
const backendUrl = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  // Parent folders (e.g. a home-directory lockfile) can confuse
  // Turbopack's workspace root and break nested App Router routes
  // like /kits/[id]/practice after a stale .next cache.
  turbopack: {
    root: projectRoot,
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
