const expenseService = require('../services/expense.service');

exports.create = async (req, res, next) => {
  try {
    const expense = await expenseService.create(req.user.id, req.body);
    res.status(201).json(expense);
  } catch (err) { next(err); }
};

exports.getAll = async (req, res, next) => {
  try {
    const expenses = await expenseService.getAll(req.user.id);
    res.json(expenses);
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const expense = await expenseService.getById(req.params.id);
    res.json(expense);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await expenseService.remove(req.params.id, req.user.id);
    res.status(204).send();
  } catch (err) { next(err); }
};
