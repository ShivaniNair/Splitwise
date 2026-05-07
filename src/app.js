require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/expenses', require('./routes/expense.routes'));
app.use('/api/balances', require('./routes/balance.routes'));

// Error handler (must be last)
app.use(require('./middlewares/error.middleware'));

module.exports = app;
