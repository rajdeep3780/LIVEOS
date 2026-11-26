import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService.ts';
import { handleControllerError } from './errorHandler.ts';

export async function getNotifications(req: AuthRequest, res: Response) {
  try {
    const data = await listNotifications(req.user!.id);
    return res.json(data);
  } catch (error) {
    return handleControllerError(res, error, 'Failed to load notifications.');
  }
}

export async function readNotification(req: AuthRequest, res: Response) {
  try {
    const notification = await markNotificationRead(req.user!.id, req.params.id);
    return res.json({ notification });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to update notification.');
  }
}

export async function readAllNotifications(req: AuthRequest, res: Response) {
  try {
    const result = await markAllNotificationsRead(req.user!.id);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Failed to mark notifications as read.');
  }
}
