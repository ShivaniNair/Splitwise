const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');

exports.getForUser = async (userId) => {
  const [rows] = await pool.query('SELECT * FROM Balances WHERE userId = ?', [userId]);
  return rows;
};

exports.settle = async (userId, owedTo, amount) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM Balances WHERE userId = ? AND owedTo = ?',
      [userId, owedTo]
    );
    if (!rows.length) throw Object.assign(new Error('No balance found'), { status: 404 });

    const newAmount = Math.max(0, parseFloat(rows[0].amount) - parseFloat(amount));
    await conn.query('UPDATE Balances SET amount = ? WHERE id = ?', [newAmount, rows[0].id]);

    await conn.query(
      'INSERT INTO ActivityLogs (id, userId, action, meta) VALUES (?, ?, ?, ?)',
      [uuidv4(), userId, 'BALANCE_SETTLED', JSON.stringify({ owedTo, amount })]
    );

    await conn.commit();
    return { ...rows[0], amount: newAmount };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
