const pool = require('../config/db');

exports.getById = async (id) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, currency, createdAt FROM Users WHERE id = ?', [id]
  );
  if (!rows.length) throw Object.assign(new Error('User not found'), { status: 404 });
  return rows[0];
};

exports.update = async (id, { name, email, currency }) => {
  const fields = [];
  const values = [];

  if (name !== undefined)     { fields.push('name = ?');     values.push(name); }
  if (email !== undefined)    { fields.push('email = ?');    values.push(email); }
  if (currency !== undefined) { fields.push('currency = ?'); values.push(currency); }

  if (!fields.length) throw Object.assign(new Error('Nothing to update'), { status: 400 });

  values.push(id);
  await pool.query(`UPDATE Users SET ${fields.join(', ')} WHERE id = ?`, values);
  return exports.getById(id);
};

exports.remove = async (id) => {
  const [rows] = await pool.query('SELECT id FROM Users WHERE id = ?', [id]);
  if (!rows.length) throw Object.assign(new Error('User not found'), { status: 404 });
  await pool.query('DELETE FROM Users WHERE id = ?', [id]);
};
