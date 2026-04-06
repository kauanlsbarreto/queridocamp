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
  webpack: (config) => {
    // O SDK mercadopago usa node-fetch internamente, que chama https.request.
    // No Cloudflare Workers (unenv) https.request nao esta implementado.
    // Apontamos node-fetch para sua variante browser que usa globalThis.fetch nativo.
    config.resolve.alias = {
      ...config.resolve.alias,
      "node-fetch": "node-fetch/browser.js",
    };
    return config;
  },
};

export default nextConfig;