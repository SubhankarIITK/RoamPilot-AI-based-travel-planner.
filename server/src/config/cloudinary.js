import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import ApiError from '../utils/ApiError.js';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new ApiError(400, 'Only JPG, PNG, WEBP, and PDF files are allowed'));
    }
    return callback(null, true);
  },
});
export { cloudinary };
