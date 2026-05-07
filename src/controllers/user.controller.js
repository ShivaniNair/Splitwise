const userService = require('../services/user.service');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await userService.getById(req.user.id);
    res.json(user);
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await userService.update(req.user.id, req.body);
    res.json(user);
  } catch (err) { next(err); }
};
