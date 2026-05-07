const router = require('express').Router();
const userController = require('../controllers/user.controller');
const authenticate = require('../middlewares/authenticate.middleware');

router.use(authenticate);
router.get('/me', userController.getProfile);
router.patch('/me', userController.updateProfile);
router.delete('/me', userController.deleteAccount);

module.exports = router;
