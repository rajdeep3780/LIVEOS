import { Router } from 'express';
import * as authController from '../controllers/authController.ts';
import * as dashboardController from '../controllers/dashboardController.ts';
import * as matterController from '../controllers/matterController.ts';
import * as notificationController from '../controllers/notificationController.ts';
import * as spaceController from '../controllers/spaceController.ts';
import { requireAuth, verifyLogoutCookieOrigin } from '../middleware/auth.ts';
import { loginRateLimiter, registerRateLimiter } from '../middleware/rateLimit.ts';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Authentication
router.post('/auth/register', registerRateLimiter, authController.register);
router.post('/auth/login', loginRateLimiter, authController.login);
router.post('/auth/logout', verifyLogoutCookieOrigin, authController.logout);
router.get('/auth/me', requireAuth, authController.me);
router.patch('/auth/profile', requireAuth, authController.updateProfile);

// Dashboard
router.get('/dashboard', requireAuth, dashboardController.getDashboard);

// Spaces
router.get('/spaces', requireAuth, spaceController.listSpaces);
router.post('/spaces', requireAuth, spaceController.createNewSpace);
router.get('/spaces/:id', requireAuth, spaceController.getSpace);
router.post('/spaces/:id/members', requireAuth, spaceController.inviteMember);
router.patch(
  '/spaces/:id/members/:userId',
  requireAuth,
  spaceController.changeMemberRole
);
router.delete(
  '/spaces/:id/members/:userId',
  requireAuth,
  spaceController.deleteMember
);

// Space-scoped Matters
router.get('/spaces/:id/matters', requireAuth, matterController.listSpaceMatters);
router.post('/spaces/:id/matters', requireAuth, matterController.createSpaceMatter);

// Matters & Timeline
router.get('/matters', requireAuth, matterController.listAllMatters);
router.get('/matters/:id', requireAuth, matterController.getMatter);
router.put('/matters/:id', requireAuth, matterController.editMatter);
router.delete('/matters/:id', requireAuth, matterController.removeMatter);
router.post('/matters/:id/updates', requireAuth, matterController.postMatterUpdate);
router.get('/timeline', requireAuth, matterController.listTimeline);

// Notifications
router.get('/notifications', requireAuth, notificationController.getNotifications);
router.patch(
  '/notifications/read-all',
  requireAuth,
  notificationController.readAllNotifications
);
router.patch(
  '/notifications/:id/read',
  requireAuth,
  notificationController.readNotification
);

export default router;
