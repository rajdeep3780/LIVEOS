import crypto from 'node:crypto';

export const MIN_SESSION_SECRET_LENGTH = 16;

let devFallbackSecret: string | null = null;

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function validateSessionSecretConfig(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= MIN_SESSION_SECRET_LENGTH) {
    return configured;
  }

  if (isProductionEnv()) {
    throw new Error(
      `Missing or invalid SESSION_SECRET in production. Set SESSION_SECRET to a persistent secret of at least ${MIN_SESSION_SECRET_LENGTH} characters.`
    );
  }

  if (!devFallbackSecret) {
    devFallbackSecret = crypto.randomBytes(32).toString('hex');
  }
  return devFallbackSecret;
}

function getSessionSecret(): string {
  return validateSessionSecretConfig();
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  if (!salt || !originalHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export interface SessionPayload {
  sub: string;
  jti: string;
  exp: number;
}

export function signSessionToken(userId: string): string {
  const payload: SessionPayload = {
    sub: userId,
    jti: crypto.randomUUID(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, providedSig] = parts;
    if (!encodedPayload || !providedSig) return null;

    const expectedSig = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encodedPayload)
      .digest('base64url');

    const a = Buffer.from(providedSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as SessionPayload;

    if (
      !parsed.sub ||
      typeof parsed.jti !== 'string' ||
      parsed.jti.length === 0 ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
