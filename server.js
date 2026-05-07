require('dotenv').config();
const app = require('./src/app');
const pool = require('./src/config/db');
const cron = require('node-cron');
const { sendMonthlyReports } = require('./src/services/report.service');

const PORT = process.env.PORT || 3000;

// Runs at 8:00 AM on the 1st of every month
cron.schedule('0 8 1 * *', () => {
  console.log('Running monthly balance report...');
  sendMonthlyReports();
});

pool.getConnection()
  .then(conn => {
    conn.release();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('DB connection failed:', err));
