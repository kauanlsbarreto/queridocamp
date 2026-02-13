// mysql2 v3.13.0 or later is required
import { createConnection } from "mysql2/promise";

export type HyperdriveBinding = {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
};

export type Env = {
  DB_PRINCIPAL: HyperdriveBinding;
  DB_JOGADORES: HyperdriveBinding;
};

async function createHyperdriveConnection(binding: HyperdriveBinding) {
  return createConnection({
    host: binding.host,
    user: binding.user,
    password: binding.password,
    database: binding.database,
    port: binding.port,

    // Obrigatório para Cloudflare Workers
    disableEval: true,
  });
}

export async function createMainConnection(env: Env) {
  return createHyperdriveConnection(env.DB_PRINCIPAL);
}

export async function createJogadoresConnection(env: Env) {
  return createHyperdriveConnection(env.DB_JOGADORES);
}
