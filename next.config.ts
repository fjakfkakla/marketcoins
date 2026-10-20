import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// RPC Solana joint depuis le navigateur (HTTP + WebSocket pour les confirmations).
// Même valeur par défaut que src/lib/solana/config.ts.
const RPC_DEFAULTS: Record<string, string> = {
  localnet: "http://127.0.0.1:8899",
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};
const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC || RPC_DEFAULTS[process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet"] || RPC_DEFAULTS.devnet;
const rpcUrl = new URL(rpc);
const rpcOrigin = rpcUrl.origin;
// web3.js ouvre le WebSocket sur le port + 1 quand l'URL en précise un (validateur local : 8899 → 8900).
const rpcWs = `${rpcUrl.protocol.replace("http", "ws")}//${rpcUrl.hostname}${rpcUrl.port ? `:${Number(rpcUrl.port) + 1}` : ""}`;

// Content Security Policy. 'unsafe-inline' is required by Next.js for its
// bootstrap scripts; 'unsafe-eval' is only needed by the dev server (HMR).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // data: pour les icônes de wallets, https: pour les avatars fournis par la base.
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${rpcOrigin} ${rpcWs}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // Simple app: everything is rendered at request time, no partial prerendering.
  cacheComponents: false,
  partialPrefetching: false,
  // Native module, must not be bundled.
  serverExternalPackages: ["better-sqlite3"],
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
