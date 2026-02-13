import mysql from "mysql2";

export function createMainConnection(env: any) {
  if (!env?.DB_PRINCIPAL?.connectionString) {
    throw new Error("Hyperdrive binding DB_PRINCIPAL não encontrado.");
  }

  return mysql.createConnection({
    uri: env.DB_PRINCIPAL.connectionString,
    decimalNumbers: true,
  });
}

export function createJogadoresConnection(env: any) {
  if (!env?.DB_jogadores?.connectionString) {
    throw new Error("Hyperdrive binding DB_jogadores não encontrado.");
  }

  return mysql.createConnection({
    uri: env.DB_jogadores.connectionString,
    decimalNumbers: true,
  });
}
