// mysql2 v3.13.0 or later is required
import { createConnection, Connection } from "mysql2/promise";

export type HyperdriveBinding = {
  host: string;
  user: string;
  password: string;
  database: string;
  port: number;
};

export type Env = {
  DB_PRINCIPAL?: HyperdriveBinding;
  DB_JOGADORES?: HyperdriveBinding;
};

export async function connectToDB(binding: HyperdriveBinding): Promise<Connection> {
  if (!binding) {
    throw new Error("Binding para conexão MySQL não foi definido");
  }

  const { host, user, password, database, port } = binding;

  return createConnection({
    host,
    user,
    password,
    database,
    port,

    disableEval: true,
  });
}


export async function createMainConnection(env: Env): Promise<Connection> {
  if (!env.DB_PRINCIPAL) {
    throw new Error("Variável de ambiente DB_PRINCIPAL não configurada");
  }
  return connectToDB(env.DB_PRINCIPAL);
}

export async function createJogadoresConnection(env: Env): Promise<Connection> {
  if (!env.DB_JOGADORES) {
    throw new Error("Variável de ambiente DB_JOGADORES não configurada");
  }
  return connectToDB(env.DB_JOGADORES);
}
