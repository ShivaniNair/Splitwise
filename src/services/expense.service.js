const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');

exports.create = async (userId, { name, amount, currency = 'USD', date, participants, splitType = 'equal' }) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const expenseId = uuidv4();
    await conn.query(
      'INSERT INTO Expenses (id, name, amount, currency, date, createdBy, splitType) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [expenseId, name, amount, currency, date, userId, splitType]
    );

    const share = splitType === 'equal'
      ? (amount / participants.length).toFixed(2)
      : null;

    for (const p of participants) {
      const participantShare = p.share ?? share;
      await conn.query(
        'INSERT INTO ExpenseParticipants (id, expenseId, userId, share) VALUES (?, ?, ?, ?)',
        [uuidv4(), expenseId, p.userId, participantShare]
      );

      if (p.userId !== userId) {
        const [existing] = await conn.query(
          'SELECT id FROM Balances WHERE userId = ? AND owedTo = ?',
          [p.userId, userId]
        );
        if (existing.length) {
          await conn.query(
            'UPDATE Balances SET amount = amount + ? WHERE id = ?',
            [participantShare, existing[0].id]
          );
        } else {
          await conn.query(
            'INSERT INTO Balances (id, userId, owedTo, amount) VALUES (?, ?, ?, ?)',
            [uuidv4(), p.userId, userId, participantShare]
          );
        }
      }
    }

    await conn.query(
      'INSERT INTO ActivityLogs (id, userId, action, meta) VALUES (?, ?, ?, ?)',
      [uuidv4(), userId, 'EXPENSE_CREATED', JSON.stringify({ expenseId, name })]
    );

    await conn.commit();
    return exports.getById(expenseId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

exports.getAll = async (userId) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT e.* FROM Expenses e
     JOIN ExpenseParticipants ep ON ep.expenseId = e.id
     WHERE ep.userId = ? OR e.createdBy = ?
     ORDER BY e.date DESC`,
    [userId, userId]
  );
  return rows;
};

exports.getById = async (id) => {
  const [expenses] = await pool.query('SELECT * FROM Expenses WHERE id = ?', [id]);
  if (!expenses.length) throw Object.assign(new Error('Expense not found'), { status: 404 });

  const [participants] = await pool.query(
    'SELECT * FROM ExpenseParticipants WHERE expenseId = ?', [id]
  );
  return { ...expenses[0], participants };
};

exports.update = async (id, userId, { name, amount, currency, date, splitType }) => {
  const [rows] = await pool.query('SELECT * FROM Expenses WHERE id = ?', [id]);
  if (!rows.length) throw Object.assign(new Error('Expense not found'), { status: 404 });
  if (rows[0].createdBy !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

  const fields = [];
  const values = [];

  if (name !== undefined)      { fields.push('name = ?');      values.push(name); }
  if (amount !== undefined)    { fields.push('amount = ?');    values.push(amount); }
  if (currency !== undefined)  { fields.push('currency = ?');  values.push(currency); }
  if (date !== undefined)      { fields.push('date = ?');      values.push(date); }
  if (splitType !== undefined) { fields.push('splitType = ?'); values.push(splitType); }

  if (!fields.length) throw Object.assign(new Error('Nothing to update'), { status: 400 });

  values.push(id);
  await pool.query(`UPDATE Expenses SET ${fields.join(', ')} WHERE id = ?`, values);
  return exports.getById(id);
};

exports.remove = async (id, userId) => {
  const [rows] = await pool.query('SELECT * FROM Expenses WHERE id = ?', [id]);
  if (!rows.length) throw Object.assign(new Error('Expense not found'), { status: 404 });
  if (rows[0].createdBy !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  await pool.query('DELETE FROM Expenses WHERE id = ?', [id]);
};

exports.getActivityLog = async (userId, { from, to } = {}) => {
  // Default: current month
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultTo   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const startDate = from || defaultFrom;
  const endDate   = to   || defaultTo;

  const [rows] = await pool.query(
    `SELECT al.*, e.name AS expenseName, e.amount, e.currency
     FROM ActivityLogs al
     LEFT JOIN Expenses e ON JSON_UNQUOTE(JSON_EXTRACT(al.meta, '$.expenseId')) = e.id
     WHERE al.userId = ?
       AND DATE(al.createdAt) BETWEEN ? AND ?
     ORDER BY al.createdAt DESC`,
    [userId, startDate, endDate]
  );

  // Group by month label
  const groups = {};
  for (const row of rows) {
    const d = new Date(row.createdAt);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(row);
  }

  return groups;
};
