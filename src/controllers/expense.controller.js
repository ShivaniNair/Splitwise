const expenseService = require('../services/expense.service');

exports.create = async (req, res, next) => {
  try {
    const expense = await expenseService.create(req.user.id, req.body);
    res.status(201).json({ message: 'Expense created successfully', expense });
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const expenses = await expenseService.getAll(req.user.id);
    res.json({ message: 'Expenses fetched successfully', expenses });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const expense = await expenseService.getById(req.params.id);
    res.json({ message: 'Expense fetched successfully', expense });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const expense = await expenseService.update(req.params.id, req.user.id, req.body);
    res.json({ message: 'Expense updated successfully', expense });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await expenseService.remove(req.params.id, req.user.id);
    res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (err) { next(err); }
};

exports.getActivityLog = async (req, res, next) => {
  try {
    const { from, to, preset } = req.query;
    const log = await expenseService.getActivityLog(req.user.id, { from, to, preset });
    res.json({ message: 'Activity log fetched successfully', ...log });
  } catch (err) { next(err); }
};
