import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { uploadDocument, getTripDocuments, deleteDocument } from '../controllers/documentController.js';
import { upload } from '../config/cloudinary.js';

const router = express.Router();
router.use(protect);
router.post('/upload', upload.single('file'), uploadDocument);
router.get('/trip/:tripId', getTripDocuments);
router.delete('/:id', deleteDocument);
export default router;