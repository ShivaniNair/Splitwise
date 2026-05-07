const userService = require('../services/user.service');

exports.getProfile = async (req, res, next) => {
  try {
    const user = await userService.getById(req.user.id);
    res.json({ message: 'Profile fetched successfully', user });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await userService.update(req.user.id, req.body);
    res.json({ message: 'Profile updated successfully', user });
  } catch (err) { next(err); }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    await userService.remove(req.user.id);
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (err) { next(err); }
};
