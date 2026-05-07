const router = require('express').Router();
const expenseController = require('../controllers/expense.controller');
const authenticate = require('../middlewares/authenticate.middleware');

router.use(authenticate);
router.get('/activity', expenseController.getActivityLog);
router.post('/', expenseController.create);
router.get('/', expenseController.getAll);
router.get('/:id', expenseController.getOne);
router.patch('/:id', expenseController.update);
router.delete('/:id', expenseController.remove);

module.exports = router;
