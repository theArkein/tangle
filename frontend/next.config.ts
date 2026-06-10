import type { NextConfig } from "next";
import { execSync } from "child_process";

function getVersion(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // output: "export" breaks rewrites, so only set it for production builds
  ...(isDev ? {} : { output: "export" }),
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: getVersion(),
    ...(isDev ? { NEXT_PUBLIC_WS_HOST: `${process.env.LAN_IP ?? 'localhost'}:8787` } : {}),
  },
  ...(isDev
    ? {
        async rewrites() {
          // trailingSlash:true redirects /api/me → /api/me/ before rewrites run,
          // so match the slashed form and strip it in the destination.
          return [
            {
              source: "/api/:path*/",
              destination: "http://localhost:8787/api/:path*",
            },
            {
              source: "/api/:path*",
              destination: "http://localhost:8787/api/:path*",
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
