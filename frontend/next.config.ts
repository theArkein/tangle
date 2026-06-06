import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.GITHUB_SHA?.slice(0, 7) ?? "dev",
  },
};

export default nextConfig;
