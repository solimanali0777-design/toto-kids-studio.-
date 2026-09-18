import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'soly_owner_session';
const SESSION_LABEL = 'soly-owner-session-v1';

function text(value) {
  return String(value ?? '').trim();
}

export function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left ?? ''));
  const b = Buffer.from(String(right ?? ''));
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export function parseCookies(header = '') {
  const out = {};
  for (const pair of String(header || '').split(';')) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!key) continue;
    try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
  }
  return out;
}

function getHeader(headers = {}, name) {
  const lower = name.toLowerCase();
  return headers[lower] ?? headers[name] ?? '';
}

export function buildOwnerAuth({
  ownerToken = process.env.SOLY_OWNER_TOKEN,
  disabled = process.env.SOLY_AUTH_DISABLED === 'true',
  cookieName = COOKIE_NAME,
} = {}) {
  const token = text(ownerToken);
  const isDisabled = Boolean(disabled);

  const sessionValue = token
    ? createHmac('sha256', token).update(SESSION_LABEL).digest('base64url')
    : '';

  function bearerFrom(headers = {}) {
    const raw = text(getHeader(headers, 'authorization'));
    const match = raw.match(/^Bearer\s+(.+)$/i);
    return match ? text(match[1]) : '';
  }

  function cookieFrom(headers = {}) {
    const cookies = parseCookies(getHeader(headers, 'cookie'));
    return text(cookies[cookieName]);
  }

  function authenticated(headers = {}) {
    if (isDisabled) return true;
    if (!token) return false;
    return constantTimeEqual(bearerFrom(headers), token)
      || constantTimeEqual(cookieFrom(headers), sessionValue);
  }

  function assertAuthenticated(headers = {}) {
    if (isDisabled) return true;
    if (!token) {
      throw Object.assign(new Error('Owner authentication is not configured on the server'), {
        code: 'owner_auth_not_configured',
        status: 503,
      });
    }
    if (!authenticated(headers)) {
      throw Object.assign(new Error('Owner authentication is required'), {
        code: 'unauthorized',
        status: 401,
      });
    }
    return true;
  }

  function login(candidate) {
    if (isDisabled) return { ok: true, bypassed: true };
    if (!token) {
      throw Object.assign(new Error('Owner authentication is not configured on the server'), {
        code: 'owner_auth_not_configured',
        status: 503,
      });
    }
    if (!constantTimeEqual(text(candidate), token)) {
      throw Object.assign(new Error('Invalid owner token'), { code: 'unauthorized', status: 401 });
    }
    return { ok: true, sessionValue };
  }

  function cookie({ secure = false, maxAge = 86400 } = {}) {
    const parts = [
      `${cookieName}=${encodeURIComponent(sessionValue)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${Math.max(60, Number(maxAge) || 86400)}`,
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
  }

  function clearCookie({ secure = false } = {}) {
    const parts = [`${cookieName}=`, 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
    if (secure) parts.push('Secure');
    return parts.join('; ');
  }

  return {
    configured: Boolean(token),
    disabled: isDisabled,
    cookieName,
    authenticated,
    assertAuthenticated,
    login,
    cookie,
    clearCookie,
  };
}

export const __test = { getHeader, COOKIE_NAME, SESSION_LABEL };
