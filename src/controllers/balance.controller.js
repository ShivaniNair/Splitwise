const balanceService = require('../services/balance.service');

exports.getBalances = async (req, res, next) => {
  try {
    const balances = await balanceService.getForUser(req.user.id);
    res.json(balances);
  } catch (err) { next(err); }
};

exports.settle = async (req, res, next) => {
  try {
    const result = await balanceService.settle(req.user.id, req.body.owedTo, req.body.amount);
    res.json(result);
  } catch (err) { next(err); }
};
