import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.get('/github', authController.initiateOAuth);
router.get('/github/callback', asyncHandler(authController.handleCallback));
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', requireAuth, asyncHandler(authController.logout));
export default router;
