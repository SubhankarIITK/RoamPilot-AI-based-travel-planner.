import Notification from '../models/Notification.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const notes = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(30);
  res.json(new ApiResponse(200, notes));
});

export const markRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { isRead: true },
    { new: true },
  );
  if (!notification) throw new ApiError(404, 'Notification not found');
  res.json(new ApiResponse(200, null, 'Marked as read'));
});
