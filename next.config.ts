import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Serverové knihovny, které se nemají bundlovat (Playwright má nativní binárky)
  serverExternalPackages: ["playwright", "playwright-core", "imapflow", "mailparser", "nodemailer"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      // Codespaces posílá požadavky přes proxy *.app.github.dev
      allowedOrigins: ["localhost:3000", "*.app.github.dev"],
    },
  },
};

export default nextConfig;
