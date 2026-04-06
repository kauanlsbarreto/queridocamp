/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['mysql2'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  assetPrefix: undefined,
  // O SDK mercadopago usa node-fetch internamente, que chama https.request.
  // No Cloudflare Workers (unenv) https.request nao esta implementado.
  // Apontamos node-fetch para sua variante browser que usa globalThis.fetch nativo.
  turbopack: {
    resolveAlias: {
      "node-fetch": "node-fetch/browser.js",
    },
  },
};

export default nextConfig;