import ApiError from '../utils/ApiError.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import { transcribeGroqAudio } from '../services/groqService.js';

const normalizeLanguage = value => {
  const language = String(value || '').trim().toLowerCase().split('-')[0];
  return /^[a-z]{2}$/.test(language) ? language : undefined;
};

export const transcribeSpeech = asyncHandler(async (req, res) => {
  if (!req.file?.buffer?.length) {
    throw new ApiError(400, 'Record some speech before requesting transcription.');
  }

  try {
    const transcript = await transcribeGroqAudio({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      fileName: req.file.originalname,
      language: normalizeLanguage(req.body?.language),
    });
    const text = String(transcript || '').trim().slice(0, 5000);
    if (!text) {
      throw new ApiError(422, 'No speech was detected. Try again in a quieter place.');
    }
    res.json(new ApiResponse(200, { text }, 'Voice transcription complete'));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.status === 429 || error?.code === 429) {
      throw new ApiError(429, 'Voice transcription is temporarily busy. Wait briefly and try again.');
    }
    throw new ApiError(502, 'Voice transcription is temporarily unavailable. You can still type your answer.');
  }
});

export { normalizeLanguage };
