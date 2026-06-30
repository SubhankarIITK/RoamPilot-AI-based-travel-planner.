import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';

const getJwtMaxAgeMs = () => {
  const value = String(process.env.JWT_EXPIRES_IN || '7d').trim().toLowerCase();
  const match = value.match(/^(\d+)\s*(ms|s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return Number(match[1]) * multipliers[match[2]];
};

const authCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: getJwtMaxAgeMs(),
});

const publicUser = user => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

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
  res.cookie('token', token, authCookieOptions());
  res.status(201).json(new ApiResponse(201, { user: publicUser(user) }, 'Account created'));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !(await user.matchPassword(password))) throw new ApiError(401, 'Invalid credentials');
  const token = generateToken(user._id);
  res.cookie('token', token, authCookieOptions());
  res.json(new ApiResponse(200, { user: publicUser(user) }, 'Login successful'));
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json(new ApiResponse(200, null, 'Logout successful'));
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
