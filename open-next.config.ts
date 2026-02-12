import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: {
    runtime: "edge",
  },
  // Se você tiver rotas específicas que usam Node.js pesado, o OpenNext as tratará automaticamente
};

export default config;