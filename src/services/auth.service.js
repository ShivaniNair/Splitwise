const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');

exports.register = async ({ name, email, password }) => {
  const [rows] = await pool.query('SELECT id FROM Users WHERE email = ?', [email]);
  if (rows.length) throw Object.assign(new Error('Email already in use'), { status: 409 });

  const id = uuidv4();
  const hashed = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO Users (id, name, email, password) VALUES (?, ?, ?, ?)', [id, name, email, hashed]);

  return { id, name, email };
};

exports.login = async ({ email, password }) => {
  const [rows] = await pool.query('SELECT * FROM Users WHERE email = ?', [email]);
  const user = rows[0];
  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};
