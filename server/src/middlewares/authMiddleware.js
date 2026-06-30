import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : '';
  // Bearer remains first during migration; HttpOnly cookie is the new default.
  const token = bearerToken || req.cookies?.token;
  if (!token) {
    throw new ApiError(401, 'Not authorized, no token');
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(decoded.id).select('-password +passwordChangedAt');
  if (!req.user) throw new ApiError(401, 'User not found');
  if (req.user.isEmailVerified === false) {
    throw new ApiError(403, 'Verify your email before continuing.');
  }
  if (
    req.user.passwordChangedAt &&
    decoded.iat * 1000 < req.user.passwordChangedAt.getTime() - 1000
  ) {
    throw new ApiError(401, 'Your session expired after a password change. Please sign in again.');
  }
  next();
});
