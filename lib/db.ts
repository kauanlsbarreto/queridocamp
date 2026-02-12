import mysql from 'mysql2/promise'

const poolConfig = {
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  connectTimeout: 10000
}

export const getPools = (env: any) => {
  const mainPool = mysql.createPool({
    uri: env.DB_PRINCIPAL?.connectionString || 'mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway',
    ...poolConfig
  });

  const jogadoresPool = mysql.createPool({
    uri: env.DB_jogadores?.connectionString || 'mysql://root:fDCcXUwqZhgwPRXMUKDTtrKiRARETYOE@hopper.proxy.rlwy.net:53994/railway',
    ...poolConfig
  });

  return { mainPool, jogadoresPool };
}