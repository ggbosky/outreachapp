import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serverové knihovny, které se nemají bundlovat (Playwright má nativní binárky)
  serverExternalPackages: ["playwright", "playwright-core", "imapflow", "mailparser", "nodemailer"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
