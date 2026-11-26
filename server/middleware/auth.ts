import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySessionToken } from '../lib/auth-crypto.ts';
import {
  getUserById,
  type PublicUser,
  upsertFirebaseUser,
} from '../services/userService.ts';

export const SESSION_COOKIE_NAME = 'lifeos_session';

export interface AuthRequest extends Request {
  user?: PublicUser;
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function verifyCookieMutationOrigin(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return true;
  }
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      return originHost === host;
    } catch {
      return false;
    }
  }
  return false;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
  });
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();

      // 1. Check custom HMAC session token
      const session = verifySessionToken(token);
      if (session) {
        const user = await getUserById(session.sub);
        if (user) {
          req.user = user;
          return next();
        }
      }

      // 2. Otherwise verify Firebase ID token
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        const email = decoded.email || `${decoded.uid}@firebase.local`;
        const user = await upsertFirebaseUser(
          decoded.uid,
          email,
          decoded.name || undefined
        );
        req.user = user;
        return next();
      } catch {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
      }
    }

    // 3. Check HttpOnly session cookie
    const cookies = parseCookies(req.headers.cookie);
    const cookieToken = cookies[SESSION_COOKIE_NAME];
    if (cookieToken) {
      if (!verifyCookieMutationOrigin(req)) {
        return res.status(403).json({ error: 'Forbidden: Cross-site request blocked.' });
      }
      const session = verifySessionToken(cookieToken);
      if (session) {
        const user = await getUserById(session.sub);
        if (user) {
          req.user = user;
          return next();
        }
      }
    }

    return res.status(401).json({ error: 'Unauthorized: Please sign in to continue.' });
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({ error: 'Authentication verification failed.' });
  }
};
