const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');

exports.create = async (userId, { description, amount, participants, splitType = 'equal' }) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const expenseId = uuidv4();
    await conn.query(
      'INSERT INTO Expenses (id, description, amount, createdBy, splitType) VALUES (?, ?, ?, ?, ?)',
      [expenseId, description, amount, userId, splitType]
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
          'SELECT id, amount FROM Balances WHERE userId = ? AND owedTo = ?',
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
      [uuidv4(), userId, 'EXPENSE_CREATED', JSON.stringify({ expenseId })]
    );

    await conn.commit();
    return { id: expenseId, description, amount, splitType };
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
     WHERE ep.userId = ? OR e.createdBy = ?`,
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

exports.remove = async (id, userId) => {
  const [rows] = await pool.query('SELECT * FROM Expenses WHERE id = ?', [id]);
  if (!rows.length) throw Object.assign(new Error('Expense not found'), { status: 404 });
  if (rows[0].createdBy !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  await pool.query('DELETE FROM Expenses WHERE id = ?', [id]);
};
