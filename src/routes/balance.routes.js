const router = require('express').Router();
const balanceController = require('../controllers/balance.controller');
const authenticate = require('../middlewares/authenticate.middleware');

router.use(authenticate);
router.get('/', balanceController.getBalances);
router.post('/settle', balanceController.settle);

module.exports = router;
