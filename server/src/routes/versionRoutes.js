import express from 'express';
import { protect } from '../middlewares/authMiddleware.js';
import { getTripVersions, getVersion, deleteVersion, restoreVersion } from '../controllers/versionController.js';

const router = express.Router();
router.use(protect);
router.get('/trip/:tripId', getTripVersions);
router.get('/:id', getVersion);
router.post('/:id/restore', restoreVersion);
router.delete('/:id', deleteVersion);
export default router;
