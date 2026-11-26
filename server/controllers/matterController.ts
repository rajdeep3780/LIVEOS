import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  addMatterUpdate,
  createMatter,
  deleteMatter,
  getGlobalTimeline,
  getMatterById,
  listMatters,
  updateMatter,
} from '../services/matterService.ts';
import { handleControllerError } from './errorHandler.ts';

export async function listAllMatters(req: AuthRequest, res: Response) {
  try {
    const { spaceId, status, priority, assignedToMe, search, includeArchived } =
      req.query as Record<string, string | undefined>;

    const matters = await listMatters(req.user!.id, {
      spaceId,
      status,
      priority,
      assignedToMe: assignedToMe === 'true',
      search,
      includeArchived: includeArchived === 'true',
    });

    return res.json({ matters });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to load matters.');
  }
}

export async function listSpaceMatters(req: AuthRequest, res: Response) {
  try {
    const { status, priority, assignedToMe, search, includeArchived } =
      req.query as Record<string, string | undefined>;

    const matters = await listMatters(req.user!.id, {
      spaceId: req.params.id,
      status,
      priority,
      assignedToMe: assignedToMe === 'true',
      search,
      includeArchived: includeArchived === 'true',
    });

    return res.json({ matters });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to load space matters.');
  }
}

export async function createSpaceMatter(req: AuthRequest, res: Response) {
  try {
    const matter = await createMatter(req.user!.id, req.params.id, req.body);
    return res.status(201).json({ matter });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to create matter.');
  }
}

export async function getMatter(req: AuthRequest, res: Response) {
  try {
    const matter = await getMatterById(req.user!.id, req.params.id);
    return res.json({ matter });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to load matter details.');
  }
}

export async function editMatter(req: AuthRequest, res: Response) {
  try {
    const matter = await updateMatter(req.user!.id, req.params.id, req.body);
    return res.json({ matter });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to update matter.');
  }
}

export async function removeMatter(req: AuthRequest, res: Response) {
  try {
    const result = await deleteMatter(req.user!.id, req.params.id);
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Failed to delete matter.');
  }
}

export async function postMatterUpdate(req: AuthRequest, res: Response) {
  try {
    const update = await addMatterUpdate(req.user!.id, req.params.id, req.body);
    return res.status(201).json({ update });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to add update.');
  }
}

export async function listTimeline(req: AuthRequest, res: Response) {
  try {
    const { spaceId, limit } = req.query as Record<string, string | undefined>;
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 60, 1), 200) : 60;
    const events = await getGlobalTimeline(req.user!.id, {
      spaceId,
      limit: parsedLimit,
    });
    return res.json({ events });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to load timeline.');
  }
}
