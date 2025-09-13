import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Docker runner can use `.next/standalone` with `server.js`
  output: "standalone",
  /* config options here */
};

export default nextConfig;
