/**
 * Ghi 1 dòng nhật ký tồn kho; quantity_after đọc lại từ chính connection (đang trong transaction).
 */
exports.logStockMovement = async (connection, { medicineId, change, type, note, orderId, userId }) => {
  const [rows] = await connection.query('SELECT stock_quantity FROM Medicines WHERE id = ?', [medicineId]);
  await connection.query(
    `INSERT INTO Stock_Movements (medicine_id, change_qty, quantity_after, movement_type, note, order_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [medicineId, change, rows[0].stock_quantity, type, note || null, orderId || null, userId || null]
  );
};
