import mysql from 'mysql2/promise'

const poolConfig = {
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
  connectTimeout: 10000,
  noPreparedStatements: true, 
  forceTextProtocol: true, 
}
export const getPools = (env: any) => {
  const cleanUri = (uri: string) => {
    try {
      const url = new URL(uri);
      url.searchParams.delete('ssl-mode');
      url.searchParams.delete('preparedStatements'); 
      return url.toString();
    } catch {
      return uri;
    }
  };

  const mainPool = mysql.createPool({
    uri: cleanUri(env.DB_PRINCIPAL?.connectionString || 'mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway'),
    ...poolConfig
  });

  const jogadoresPool = mysql.createPool({
    uri: cleanUri(env.DB_jogadores?.connectionString || 'mysql://root:fDCcXUwqZhgwPRXMUKDTtrKiRARETYOE@hopper.proxy.rlwy.net:53994/railway'),
    ...poolConfig
  });

  return { mainPool, jogadoresPool };
}