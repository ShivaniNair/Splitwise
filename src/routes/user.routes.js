const router = require('express').Router();
const userController = require('../controllers/user.controller');
const authenticate = require('../middlewares/authenticate.middleware');

router.get('/me', authenticate, userController.getProfile);
router.patch('/me', authenticate, userController.updateProfile);

module.exports = router;
