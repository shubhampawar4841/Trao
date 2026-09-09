import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(
  fileURLToPath(import.meta.url)
);

const nextConfig: NextConfig = {
  // Parent folders (e.g. a home-directory lockfile) can confuse
  // Turbopack's workspace root and break nested App Router routes
  // like /kits/[id]/practice after a stale .next cache.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
