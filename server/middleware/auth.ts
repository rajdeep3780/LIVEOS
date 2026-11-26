import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySessionToken } from '../lib/auth-crypto.ts';
import {
  getUserById,
  type PublicUser,
  upsertFirebaseUser,
} from '../services/userService.ts';
import { isSessionRevoked } from '../services/sessionService.ts';

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

export function verifyCookieMutationOrigin(req: Request): boolean {
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

export function verifyLogoutCookieOrigin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';
  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];

  if (cookieToken && !bearerToken && !verifyCookieMutationOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden: Cross-site request blocked.' });
  }
  return next();
}

export function isHttpsRequest(req: Request): boolean {
  return Boolean(req.secure);
}

export function getSessionCookieOptions(req: Request): CookieOptions {
  if (isHttpsRequest(req)) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
    };
  }
  return {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
  };
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions(req));
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
        if (await isSessionRevoked(session.jti)) {
          return res.status(401).json({ error: 'Unauthorized: Session has been revoked.' });
        }
        const user = await getUserById(session.sub);
        if (user) {
          req.user = user;
          return next();
        }
      }

      // 2. Otherwise verify Firebase ID token
      let decoded;
      try {
        decoded = await adminAuth.verifyIdToken(token);
      } catch {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
      }

      if (decoded.email_verified !== true || !decoded.email) {
        return res.status(403).json({
          error:
            'Email verification is required. Please verify your email address before signing in.',
        });
      }

      try {
        const user = await upsertFirebaseUser(
          decoded.uid,
          decoded.email,
          decoded.name || undefined
        );
        req.user = user;
        return next();
      } catch (err) {
        if (err instanceof Error && err.message === 'AUTH_UID_MISMATCH') {
          return res.status(409).json({
            error: 'This email address is already linked to a different account.',
          });
        }
        throw err;
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
        if (await isSessionRevoked(session.jti)) {
          clearSessionCookie(req, res);
          return res.status(401).json({ error: 'Unauthorized: Session has been revoked.' });
        }
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
