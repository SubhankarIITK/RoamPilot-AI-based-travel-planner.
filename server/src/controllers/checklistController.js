import ChecklistItem from '../models/ChecklistItem.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import getOwnedTrip from '../utils/getOwnedTrip.js';

export const getTripChecklist = asyncHandler(async (req, res) => {
  const items = await ChecklistItem.find({ tripId: req.params.tripId, userId: req.user._id }).sort({ category: 1 });
  res.json(new ApiResponse(200, items));
});

export const addChecklistItem = asyncHandler(async (req, res) => {
  await getOwnedTrip(req.body.tripId, req.user._id);
  const { userId, ...itemData } = req.body;
  const item = await ChecklistItem.create({ ...itemData, userId: req.user._id });
  res.status(201).json(new ApiResponse(201, item, 'Item added'));
});

export const toggleChecklistItem = asyncHandler(async (req, res) => {
  const item = await ChecklistItem.findOne({ _id: req.params.id, userId: req.user._id });
  if (!item) throw new ApiError(404, 'Item not found');
  item.isDone = !item.isDone;
  await item.save();
  res.json(new ApiResponse(200, item, 'Item toggled'));
});

export const deleteChecklistItem = asyncHandler(async (req, res) => {
  const item = await ChecklistItem.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!item) throw new ApiError(404, 'Item not found');
  res.json(new ApiResponse(200, null, 'Item deleted'));
});
