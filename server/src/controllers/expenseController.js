import Expense from '../models/Expense.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import getOwnedTrip from '../utils/getOwnedTrip.js';

export const addExpense = asyncHandler(async (req, res) => {
  const trip = await getOwnedTrip(req.body.tripId, req.user._id);
  const { userId, ...expenseData } = req.body;
  const expense = await Expense.create({
    ...expenseData,
    currency: trip.currency,
    userId: req.user._id,
  });
  res.status(201).json(new ApiResponse(201, expense, 'Expense added'));
});

export const getTripExpenses = asyncHandler(async (req, res) => {
  const expenses = await Expense.find({ tripId: req.params.tripId, userId: req.user._id }).sort({ date: -1 });
  res.json(new ApiResponse(200, expenses));
});

export const updateExpense = asyncHandler(async (req, res) => {
  const { userId, _id, ...updates } = req.body;
  if (updates.tripId) await getOwnedTrip(updates.tripId, req.user._id);
  const expense = await Expense.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    updates,
    { new: true, runValidators: true }
  );
  if (!expense) throw new ApiError(404, 'Expense not found');
  res.json(new ApiResponse(200, expense, 'Expense updated'));
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!expense) throw new ApiError(404, 'Expense not found');
  res.json(new ApiResponse(200, null, 'Expense deleted'));
});

export const getExpenseSummary = asyncHandler(async (req, res) => {
  const expenses = await Expense.find({ tripId: req.params.tripId, userId: req.user._id });
  const totalsByCurrency = expenses.reduce((acc, expense) => {
    acc[expense.currency] = (acc[expense.currency] || 0) + expense.amount;
    return acc;
  }, {});
  const byCategory = expenses.reduce((acc, expense) => {
    if (!acc[expense.category]) acc[expense.category] = {};
    acc[expense.category][expense.currency] =
      (acc[expense.category][expense.currency] || 0) + expense.amount;
    return acc;
  }, {});
  res.json(new ApiResponse(200, { totalsByCurrency, byCategory, count: expenses.length }));
});
