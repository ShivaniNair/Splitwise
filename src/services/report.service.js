const pool = require('../config/db');
const { sendMail } = require('../utils/mailer');

const buildEmailHtml = (user, balances, month) => {
  const rows = balances.length
    ? balances.map(b => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd">${b.owedToName}</td>
          <td style="padding:8px;border:1px solid #ddd">${b.currency} ${parseFloat(b.amount).toFixed(2)}</td>
        </tr>`).join('')
    : `<tr><td colspan="2" style="padding:8px;text-align:center">No outstanding balances</td></tr>`;

  return `
    <h2>Monthly Balance Report — ${month}</h2>
    <p>Hi ${user.name}, here's your balance summary:</p>
    <table style="border-collapse:collapse;width:100%">
      <thead>
        <tr>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">You owe</th>
          <th style="padding:8px;border:1px solid #ddd;text-align:left">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:16px;color:#888;font-size:12px">This is an automated monthly report from Splitwise.</p>
  `;
};

exports.sendMonthlyReports = async () => {
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  // Get all users
  const [users] = await pool.query('SELECT id, name, email, currency FROM Users');

  for (const user of users) {
    // Get balances with the name of who they owe
    const [balances] = await pool.query(
      `SELECT b.amount, b.owedTo, u.name AS owedToName, ? AS currency
       FROM Balances b
       JOIN Users u ON u.id = b.owedTo
       WHERE b.userId = ? AND b.amount > 0`,
      [user.currency, user.id]
    );

    try {
      await sendMail({
        to: user.email,
        subject: `Your Monthly Balance Report — ${month}`,
        html: buildEmailHtml(user, balances, month),
      });
      console.log(`Report sent to ${user.email}`);
    } catch (err) {
      console.error(`Failed to send report to ${user.email}:`, err.message);
    }
  }
};
