import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.ts';
import {
  addSpaceMember,
  createSpace,
  getSpaceById,
  listUserSpaces,
  removeSpaceMember,
  updateSpaceMemberRole,
} from '../services/spaceService.ts';
import { handleControllerError } from './errorHandler.ts';

export async function listSpaces(req: AuthRequest, res: Response) {
  try {
    const spaces = await listUserSpaces(req.user!.id);
    return res.json({ spaces });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to load spaces.');
  }
}

export async function createNewSpace(req: AuthRequest, res: Response) {
  try {
    const { name, type, description } = req.body as {
      name?: string;
      type?: string;
      description?: string;
    };
    const space = await createSpace(req.user!.id, {
      name: name || '',
      type: type || '',
      description,
    });
    return res.status(201).json({ space });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to create space.');
  }
}

export async function getSpace(req: AuthRequest, res: Response) {
  try {
    const space = await getSpaceById(req.user!.id, req.params.id);
    return res.json({ space });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to load space details.');
  }
}

export async function inviteMember(req: AuthRequest, res: Response) {
  try {
    const { email, role } = req.body as { email?: string; role?: string };
    const member = await addSpaceMember(req.user!.id, req.params.id, {
      email: email || '',
      role,
    });
    return res.status(201).json({ member });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to invite member.');
  }
}

export async function changeMemberRole(req: AuthRequest, res: Response) {
  try {
    const { role } = req.body as { role?: string };
    const updated = await updateSpaceMemberRole(
      req.user!.id,
      req.params.id,
      req.params.userId,
      role || ''
    );
    return res.json({ membership: updated });
  } catch (error) {
    return handleControllerError(res, error, 'Failed to update member role.');
  }
}

export async function deleteMember(req: AuthRequest, res: Response) {
  try {
    const result = await removeSpaceMember(
      req.user!.id,
      req.params.id,
      req.params.userId
    );
    return res.json(result);
  } catch (error) {
    return handleControllerError(res, error, 'Failed to remove member.');
  }
}
