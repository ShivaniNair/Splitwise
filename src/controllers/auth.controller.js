const authService = require('../services/auth.service');

exports.register = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ message: 'Registration successful', user });
  } catch (err) { next(err); }
};

exports.login = async (req, res, next) => {
  try {
    const token = await authService.login(req.body);
    res.json({ message: 'Login successful', token });
  } catch (err) { next(err); }
};
