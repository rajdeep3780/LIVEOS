import type { Response } from 'express';

export function handleControllerError(
  res: Response,
  error: unknown,
  fallbackMessage: string
) {
  if (error instanceof Error) {
    if (error.message.startsWith('VALIDATION:')) {
      return res.status(400).json({
        error: error.message.replace('VALIDATION:', '').trim(),
      });
    }
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Requested resource was not found.' });
    }
    if (error.message === 'FORBIDDEN') {
      return res.status(403).json({ error: 'You do not have access to this space.' });
    }
    if (error.message === 'FORBIDDEN_ROLE') {
      return res
        .status(403)
        .json({ error: 'Insufficient permissions for this action.' });
    }
    if (error.message === 'PERSONAL_SPACE_PRIVATE') {
      return res
        .status(403)
        .json({ error: 'Personal Spaces are private and cannot have additional members.' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res
        .status(404)
        .json({ error: 'No registered LIFEOS user found with that email address.' });
    }
    if (error.message === 'ALREADY_MEMBER') {
      return res
        .status(409)
        .json({ error: 'This user is already a member of this space.' });
    }
    if (error.message === 'EMAIL_EXISTS') {
      return res
        .status(409)
        .json({ error: 'An account with this email already exists.' });
    }
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ error: fallbackMessage });
}
