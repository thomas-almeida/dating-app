import type { NextConfig } from "next";

// Muda a cada deploy. Com isso, quem navega numa versão antiga recarrega a página inteira.
const deploymentId =
  process.env.VERCEL_DEPLOYMENT_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.E2E_DEPLOYMENT_ID;

const nextConfig: NextConfig = {
  // A regressão usa um build próprio, apontado para o backend falso.
  ...(process.env.E2E_DIST_DIR ? { distDir: process.env.E2E_DIST_DIR } : {}),
  ...(deploymentId ? { deploymentId, env: { NEXT_PUBLIC_DEPLOYMENT_ID: deploymentId } } : {}),
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
