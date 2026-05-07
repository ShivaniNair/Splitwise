require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { sendMonthlyReports } = require('../services/report.service');

console.log('Running monthly report cron manually...');
sendMonthlyReports()
  .then(() => console.log('Done.'))
  .catch(err => console.error('Error:', err.message));
