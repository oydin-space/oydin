import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const api = process.env.API_URL ?? "http://127.0.0.1:8010";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*/` }];
  },
};

export default nextConfig;
