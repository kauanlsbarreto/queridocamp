import type { RowDataPacket } from 'mysql2';

type DatabaseRow = RowDataPacket & { dbName?: string | null };
type UpdateTimeRow = RowDataPacket & { lastUpdate?: string | Date | null };
type MetadataRow = RowDataPacket & { value?: string | null };

export async function getDatabaseLastUpdate(connection: any): Promise<string> {
  try {
    const [dbRows] = await connection.query('SELECT DATABASE() AS dbName') as [DatabaseRow[], any];
    const dbName = dbRows?.[0]?.dbName;

    if (dbName) {
      const [rows] = await connection.query(
        `SELECT MAX(UPDATE_TIME) AS lastUpdate
         FROM information_schema.tables
         WHERE TABLE_SCHEMA = ?
           AND TABLE_TYPE = 'BASE TABLE'
           AND TABLE_NAME <> 'site_metadata'`,
        [dbName]
      ) as [UpdateTimeRow[], any];

      const latest = rows?.[0]?.lastUpdate;
      if (latest) {
        return new Date(latest).toISOString();
      }
    }
  } catch {
    // If information_schema is unavailable, fallback to metadata.
  }

  try {
    const [rows] = await connection.query(
      "SELECT value FROM site_metadata WHERE key_name = 'last_update'"
    ) as [MetadataRow[], any];

    const stored = rows?.[0]?.value;
    if (stored) return String(stored);
  } catch {
    // If metadata table is unavailable, use current time.
  }

  return new Date().toISOString();
}
