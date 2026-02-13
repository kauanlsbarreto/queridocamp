import mysql from 'mysql2/promise';

const poolConfig: mysql.PoolOptions = {
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  connectTimeout: 10000,
  maxPreparedStatements: 0,
  namedPlaceholders: false,
  decimalNumbers: true,
  ...({ forceTextProtocol: true } as any)
};

const cleanUri = (uri: string) => {
  try {
    const url = new URL(uri);
    url.searchParams.delete('ssl-mode');
    url.searchParams.delete('preparedStatements');
    url.searchParams.delete('cachePrepStmts');
    url.searchParams.delete('useServerPrepStmts');
    return url.toString();
  } catch {
    return uri;
  }
};

export const getPools = (env: any) => {
  const mainConnectionString = 
    env.DB_PRINCIPAL?.connectionString || 
    env.DB_PRINCIPAL || 
    'mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway';

  const jogadoresConnectionString = 
    env.DB_jogadores?.connectionString || 
    env.DB_jogadores || 
    'mysql://root:fDCcXUwqZhgwPRXMUKDTtrKiRARETYOE@hopper.proxy.rlwy.net:53994/railway';

  const mainPool = mysql.createPool({
    uri: cleanUri(mainConnectionString),
    ...poolConfig
  });

  const jogadoresPool = mysql.createPool({
    uri: cleanUri(jogadoresConnectionString),
    ...poolConfig
  });

  return { mainPool, jogadoresPool };
};