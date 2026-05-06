type CleanupSummary = {
  deletedPaymentIds: number[];
  deletedLogs: number;
};

export async function deleteStalePendingPayments(connection: any, olderThanMinutes = 30): Promise<CleanupSummary> {
  const [rows] = await connection.query(
    `SELECT id
     FROM loja_pagamentos
     WHERE UPPER(status) IN ('PENDING', 'WAITING', 'IN_ANALYSIS')
       AND (
         created_at <= (NOW() - INTERVAL ? MINUTE)
         OR (expires_at IS NOT NULL AND expires_at <= NOW())
       )`,
    [olderThanMinutes],
  );

  const paymentIds = Array.isArray(rows)
    ? rows
        .map((row: any) => Number(row?.id || 0))
        .filter((id: number) => Number.isFinite(id) && id > 0)
    : [];

  if (!paymentIds.length) {
    return {
      deletedPaymentIds: [],
      deletedLogs: 0,
    };
  }

  const placeholders = paymentIds.map(() => "?").join(",");
  const [deleteLogsResult] = await connection.query(
    `DELETE FROM loja_pagamentos_logs WHERE payment_id IN (${placeholders})`,
    paymentIds,
  );
  await connection.query(
    `DELETE FROM loja_pagamentos WHERE id IN (${placeholders})`,
    paymentIds,
  );

  return {
    deletedPaymentIds: paymentIds,
    deletedLogs: Number((deleteLogsResult as any)?.affectedRows || 0),
  };
}