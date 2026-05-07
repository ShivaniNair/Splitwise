const pool = require('../config/db');

exports.getById = async (id) => {
  const [rows] = await pool.query('SELECT id, name, email, createdAt FROM Users WHERE id = ?', [id]);
  if (!rows.length) throw Object.assign(new Error('User not found'), { status: 404 });
  return rows[0];
};

exports.update = async (id, { name }) => {
  await pool.query('UPDATE Users SET name = ? WHERE id = ?', [name, id]);
  return exports.getById(id);
};
