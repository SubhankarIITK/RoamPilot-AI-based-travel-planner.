import multer from 'multer';
import ApiError from '../utils/ApiError.js';

const allowedAudioTypes = new Set([
  'audio/flac',
  'audio/mp3',
  'audio/mp4',
  'audio/mpeg',
  'audio/mpga',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
]);

const speechUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    const mimeType = String(file.mimetype || '').split(';')[0].toLowerCase();
    if (!allowedAudioTypes.has(mimeType)) {
      return callback(new ApiError(
        400,
        'Use a supported audio recording: WEBM, WAV, MP3, MP4, M4A, OGG, or FLAC.',
      ));
    }
    return callback(null, true);
  },
});

export const uploadSpeechAudio = (req, res, next) => {
  speechUpload.single('audio')(req, res, error => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(413, 'The voice recording is too large. Keep it under 45 seconds.'));
    }
    return next(error);
  });
};
