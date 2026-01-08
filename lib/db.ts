import mysql from 'mysql2/promise';

const pool = mysql.createPool("mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway");

export default pool;
