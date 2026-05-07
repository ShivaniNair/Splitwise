const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');

exports.create = async (userId, { name, amount, currency = 'USD', date, participants, splitType = 'equal' }) => {
  // Validate custom split totals
  if (splitType === 'custom') {
    const total = participants.reduce((sum, p) => sum + parseFloat(p.share || 0), 0);
    if (Math.abs(total - parseFloat(amount)) > 0.01) {
      throw Object.assign(
        new Error(`Custom shares total (${total}) does not match expense amount (${amount})`),
        { status: 400 }
      );
    }
  }
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

    const result = await exports.getById(expenseId, conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

exports.getAll = async (userId) => {
  const [rows] = await pool.query(
    `SELECT DISTINCT e.*, u.name AS createdByName
     FROM Expenses e
     JOIN ExpenseParticipants ep ON ep.expenseId = e.id
     LEFT JOIN Users u ON e.createdBy = u.id
     WHERE ep.userId = ? OR e.createdBy = ?
     ORDER BY e.date DESC`,
    [userId, userId]
  );
  return rows;
};

exports.getById = async (id, conn = null) => {
  const db = conn || pool;
  const [expenses] = await db.query('SELECT * FROM Expenses WHERE id = ?', [id]);
  if (!expenses.length) throw Object.assign(new Error('Expense not found'), { status: 404 });
  const [participants] = await db.query(
    `SELECT ep.*, u.name AS userName, u.email AS userEmail
     FROM ExpenseParticipants ep
     LEFT JOIN Users u ON ep.userId = u.id
     WHERE ep.expenseId = ?`, [id]
  );
  return { ...expenses[0], participants };
};

exports.update = async (id, userId, { name, amount, currency, date, splitType, participants }) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT * FROM Expenses WHERE id = ?', [id]);
    if (!rows.length) throw Object.assign(new Error('Expense not found'), { status: 404 });
    if (rows[0].createdBy !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

    const existing = rows[0];

    // Update expense-level fields if provided
    const fields = [];
    const values = [];
    if (name !== undefined)      { fields.push('name = ?');      values.push(name); }
    if (amount !== undefined)    { fields.push('amount = ?');    values.push(amount); }
    if (currency !== undefined)  { fields.push('currency = ?');  values.push(currency); }
    if (date !== undefined)      { fields.push('date = ?');      values.push(date); }
    if (splitType !== undefined) { fields.push('splitType = ?'); values.push(splitType); }

    if (!fields.length && !participants) throw Object.assign(new Error('Nothing to update'), { status: 400 });

    if (fields.length) {
      values.push(id);
      await conn.query(`UPDATE Expenses SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    // Update participants if provided
    if (participants && participants.length) {
      const finalAmount = amount ?? existing.amount;
      const finalSplit  = splitType ?? existing.splitType;

      // Validate custom split
      if (finalSplit === 'custom') {
        const total = participants.reduce((sum, p) => sum + parseFloat(p.share || 0), 0);
        if (Math.abs(total - parseFloat(finalAmount)) > 0.01) {
          throw Object.assign(
            new Error(`Custom shares total (${total}) does not match expense amount (${finalAmount})`),
            { status: 400 }
          );
        }
      }

      const equalShare = finalSplit === 'equal'
        ? (finalAmount / participants.length).toFixed(2)
        : null;

      // Fetch old participants to reverse their balances
      const [oldParticipants] = await conn.query(
        'SELECT * FROM ExpenseParticipants WHERE expenseId = ?', [id]
      );

      // Reverse old balances (subtract old shares)
      for (const op of oldParticipants) {
        if (op.userId === userId) continue;
        await conn.query(
          'UPDATE Balances SET amount = GREATEST(0, amount - ?) WHERE userId = ? AND owedTo = ?',
          [op.share, op.userId, userId]
        );
      }

      // Delete old participants
      await conn.query('DELETE FROM ExpenseParticipants WHERE expenseId = ?', [id]);
    //  console.log(`[UPDATE] Deleted old participants for expense ${id}`);

      // Insert new participants and apply new balances
      for (const p of participants) {
        const participantShare = p.share ?? equalShare;
     //   console.log(`[UPDATE] Inserting participant ${p.userId} with share ${participantShare}`);
        await conn.query(
          'INSERT INTO ExpenseParticipants (id, expenseId, userId, share) VALUES (?, ?, ?, ?)',
          [uuidv4(), id, p.userId, participantShare]
        );

        if (p.userId !== userId) {
          const [bal] = await conn.query(
            'SELECT id FROM Balances WHERE userId = ? AND owedTo = ?',
            [p.userId, userId]
          );
          if (bal.length) {
            await conn.query(
              'UPDATE Balances SET amount = amount + ? WHERE id = ?',
              [participantShare, bal[0].id]
            );
          } else {
            await conn.query(
              'INSERT INTO Balances (id, userId, owedTo, amount) VALUES (?, ?, ?, ?)',
              [uuidv4(), p.userId, userId, participantShare]
            );
          }
        }
      }
    }

    await conn.query(
      'INSERT INTO ActivityLogs (id, userId, action, meta) VALUES (?, ?, ?, ?)',
      [uuidv4(), userId, 'EXPENSE_UPDATED', JSON.stringify({ expenseId: id })]
    );

    await conn.commit();

    // Read AFTER commit to avoid REPEATABLE READ stale snapshot
    const result = await exports.getById(id);
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

exports.remove = async (id, userId) => {
  const [rows] = await pool.query('SELECT * FROM Expenses WHERE id = ?', [id]);
  if (!rows.length) throw Object.assign(new Error('Expense not found'), { status: 404 });
  if (rows[0].createdBy !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  await pool.query('DELETE FROM Expenses WHERE id = ?', [id]);
};

exports.getActivityLog = async (userId, { from, to, preset } = {}) => {
  const now = new Date();

  let startDate, endDate;

  if (preset === 'lastMonth') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    startDate = d.toISOString().split('T')[0];
    endDate   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
  } else if (from && to) {
    startDate = from;
    endDate   = to;
  } else {
    // default: current month
    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    endDate   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  // Fetch logs for expenses the user is part of (as creator OR participant)
  const [rows] = await pool.query(
    `SELECT DISTINCT al.*, e.name AS expenseName, e.amount, e.currency, e.createdBy,
            u.name AS actorName
     FROM ActivityLogs al
     LEFT JOIN Expenses e ON JSON_UNQUOTE(JSON_EXTRACT(al.meta, '$.expenseId')) = e.id
     LEFT JOIN Users u ON al.userId = u.id
     WHERE DATE(al.createdAt) BETWEEN ? AND ?
       AND (
         al.userId = ?
         OR e.id IN (
           SELECT expenseId FROM ExpenseParticipants WHERE userId = ?
         )
       )
     ORDER BY al.createdAt DESC`,
    [startDate, endDate, userId, userId]
  );

  // Group by month label
  const groups = {};
  for (const row of rows) {
    const d = new Date(row.createdAt);
    const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!groups[label]) groups[label] = [];
    groups[label].push(row);
  }

  return { range: { from: startDate, to: endDate }, logs: groups };
};
