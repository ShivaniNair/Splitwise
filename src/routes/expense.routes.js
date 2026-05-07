const router = require('express').Router();
const expenseController = require('../controllers/expense.controller');
const authenticate = require('../middlewares/authenticate.middleware');

router.use(authenticate);
router.post('/', expenseController.create);
router.get('/', expenseController.getAll);
router.get('/:id', expenseController.getOne);
router.delete('/:id', expenseController.remove);

module.exports = router;
