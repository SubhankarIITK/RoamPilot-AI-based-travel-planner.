import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { addExpense, getTripExpenses, updateExpense, deleteExpense, getExpenseSummary } from '../controllers/expenseController.js';

const router = express.Router();
router.use(protect);
router.post('/', addExpense);
router.get('/trip/:tripId', getTripExpenses);
router.get('/trip/:tripId/summary', getExpenseSummary);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);
export default router;