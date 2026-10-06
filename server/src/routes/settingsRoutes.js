import { Router } from 'express';
import { githubController } from '../controllers/githubController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);
router.get('/repository', asyncHandler(githubController.getRepositoryPreference));
router.post('/repository', asyncHandler(githubController.setRepositoryPreference));
export default router;
