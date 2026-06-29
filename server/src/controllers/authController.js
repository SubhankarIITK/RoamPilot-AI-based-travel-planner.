import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

export const signup = asyncHandler(async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  const { password } = req.body;
  if (!name || !email || !password) throw new ApiError(400, 'All fields required');
  if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');
  const exists = await User.findOne({ email });
  if (exists) throw new ApiError(409, 'Email already registered');
  const user = await User.create({ name, email, password });
  const token = generateToken(user._id);
  res.status(201).json(new ApiResponse(201, { user: { _id: user._id, name: user.name, email: user.email }, token }, 'Account created'));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) throw new ApiError(401, 'Invalid credentials');
  const token = generateToken(user._id);
  res.json(new ApiResponse(200, { user: { _id: user._id, name: user.name, email: user.email }, token }, 'Login successful'));
});

export const getMe = asyncHandler(async (req, res) => {
  res.json(new ApiResponse(200, req.user));
});

export const updateMe = asyncHandler(async (req, res) => {
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();
  if (!name || !email) throw new ApiError(400, 'Name and email are required');

  const exists = await User.findOne({
    email,
    _id: { $ne: req.user._id },
  });
  if (exists) throw new ApiError(409, 'Email already registered');

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name, email },
    { new: true, runValidators: true },
  ).select('-password');

  res.json(new ApiResponse(200, user, 'Account updated'));
});
