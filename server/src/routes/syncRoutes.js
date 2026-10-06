import { Router } from 'express';
import { syncController } from '../controllers/syncController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);
router.post('/', asyncHandler(syncController.sync));
router.get('/history', asyncHandler(syncController.history));
export default router;
