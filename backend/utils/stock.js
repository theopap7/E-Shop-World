async function restoreStock(conn, items) {
  for (const item of items) {
    await conn.query('UPDATE products SET stock = stock + ? WHERE id = ?', [item.quantity, item.product_id]);
    if (item.size) {
      await conn.query(
        'UPDATE product_size_stock SET stock = stock + ? WHERE product_id = ? AND size = ?',
        [item.quantity, item.product_id, item.size]
      );
    }
  }
}

module.exports = { restoreStock };
