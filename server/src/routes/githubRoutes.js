import { Router } from 'express';
import { githubController } from '../controllers/githubController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);
router.get('/user', asyncHandler(githubController.getUser));
router.get('/repositories', asyncHandler(githubController.listRepositories));
export default router;
