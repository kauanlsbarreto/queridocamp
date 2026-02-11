import mysql from 'mysql2/promise'

declare global {
  var mainPool: mysql.Pool | undefined
  var jogadoresPool: mysql.Pool | undefined
}

const pool =
  global.mainPool ||
  mysql.createPool({
    uri: 'mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,       
    keepAliveInitialDelay: 10000  
  })

const dbPoolJogadores =
  global.jogadoresPool ||
  mysql.createPool({
    uri: 'mysql://root:fDCcXUwqZhgwPRXMUKDTtrKiRARETYOE@hopper.proxy.rlwy.net:53994/railway',
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  })

if (process.env.NODE_ENV !== 'production') {
  global.mainPool = pool
  global.jogadoresPool = dbPoolJogadores
}

export { pool, dbPoolJogadores }