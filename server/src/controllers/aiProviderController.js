import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { getAIProviderConfiguration } from '../services/aiService.js';

export const getAIProviders = asyncHandler(async (_req, res) => {
  res.json(new ApiResponse(
    200,
    getAIProviderConfiguration(),
    'AI provider configuration loaded',
  ));
});
