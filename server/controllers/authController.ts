import type { Request, Response } from 'express';
import { signSessionToken, verifySessionToken } from '../lib/auth-crypto.ts';
import {
  type AuthRequest,
  clearSessionCookie,
  parseCookies,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  verifyCookieMutationOrigin,
} from '../middleware/auth.ts';
import { revokeSessionToken } from '../services/sessionService.ts';
import {
  loginWithPassword,
  registerWithPassword,
  updateUserDisplayName,
} from '../services/userService.ts';
import { handleControllerError } from './errorHandler.ts';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(req: Request, res: Response) {
  try {
    const { displayName, email, password } = req.body as {
      displayName?: string;
      email?: string;
      password?: string;
    };

    if (!displayName || displayName.trim().length < 2 || displayName.trim().length > 60) {
      return res
        .status(400)
        .json({ error: 'Display name must be between 2 and 60 characters.' });
    }
    if (!email || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!password || password.length < 8 || password.length > 128) {
      return res
        .status(400)
        .json({ error: 'Password must be between 8 and 128 characters.' });
    }

    const user = await registerWithPassword(displayName, email, password);
    const token = signSessionToken(user.id);
    setSessionCookie(req, res, token);

    return res.status(201).json({ user, token });
  } catch (error) {
    return handleControllerError(res, error, 'Unable to complete registration.');
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required.' });
    }

    const user = await loginWithPassword(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signSessionToken(user.id);
    setSessionCookie(req, res, token);

    return res.json({ user, token });
  } catch (error) {
    return handleControllerError(res, error, 'Unable to sign in.');
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : '';
    const bearerSession = bearerToken ? verifySessionToken(bearerToken) : null;

    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[SESSION_COOKIE_NAME];
    const cookieOriginValid = verifyCookieMutationOrigin(req);

    if (cookieToken && !bearerSession && !cookieOriginValid) {
      return res.status(403).json({ error: 'Forbidden: Cross-site request blocked.' });
    }

    const sessionsToRevoke = new Map<string, NonNullable<typeof bearerSession>>();
    if (bearerSession) {
      sessionsToRevoke.set(bearerSession.jti, bearerSession);
    }
    if (cookieToken && cookieOriginValid) {
      const cookieSession = verifySessionToken(cookieToken);
      if (cookieSession) {
        sessionsToRevoke.set(cookieSession.jti, cookieSession);
      }
    }

    for (const session of sessionsToRevoke.values()) {
      await revokeSessionToken(session);
    }

    clearSessionCookie(req, res);
    return res.json({ ok: true });
  } catch (error) {
    clearSessionCookie(req, res);
    return handleControllerError(res, error, 'Unable to sign out.');
  }
}

export async function me(req: AuthRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  return res.json({ user: req.user });
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated.' });
    }
    const { displayName } = req.body as { displayName?: string };
    if (!displayName || displayName.trim().length < 2 || displayName.trim().length > 60) {
      return res
        .status(400)
        .json({ error: 'Display name must be between 2 and 60 characters.' });
    }

    const user = await updateUserDisplayName(req.user.id, displayName);
    return res.json({ user });
  } catch (error) {
    return handleControllerError(res, error, 'Unable to update profile.');
  }
}
