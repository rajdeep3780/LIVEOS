import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import { getDashboardData } from '../services/dashboardService.ts';
import { handleControllerError } from './errorHandler.ts';

export async function getDashboard(req: AuthRequest, res: Response) {
  try {
    const data = await getDashboardData(req.user!.id);
    return res.json(data);
  } catch (error) {
    return handleControllerError(res, error, 'Failed to load dashboard.');
  }
}
