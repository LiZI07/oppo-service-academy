import {createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey} from 'jose';

export type AccessConfig = {ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string};
export type AccessUser = {userId: string; email: string; displayName: string; fullName: string | null};
let cachedIssuer = '';
let cachedKeys: ReturnType<typeof createRemoteJWKSet>;

export function accessSettings(config: AccessConfig) {
  const issuer = config.ACCESS_TEAM_DOMAIN || '';
  const audience = config.ACCESS_AUD || '';
  // The configured issuer, never a claim supplied by the requester, owns JWKS.
  if (!/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(issuer) ||
      !/^[a-f0-9]{64}$/.test(audience)) return null;
  return {issuer, audience};
}

function remoteKeys(issuer: string) {
  if (cachedIssuer !== issuer) {
    cachedKeys = createRemoteJWKSet(new URL(issuer + '/cdn-cgi/access/certs'), {
      timeoutDuration: 5000, cooldownDuration: 30_000, cacheMaxAge: 600_000,
    });
    cachedIssuer = issuer;
  }
  return cachedKeys;
}

export async function accessIdentity(requestHeaders: Headers, config: AccessConfig, keys?: JWTVerifyGetKey): Promise<AccessUser | null> {
  const settings = accessSettings(config);
  if (!settings) return null;
  const token = requestHeaders.get('cf-access-jwt-assertion');
  if (!token || token.length > 24_000) return null;
  try {
    const {payload} = await jwtVerify(token, keys || remoteKeys(settings.issuer), {
      issuer: settings.issuer, audience: settings.audience, algorithms: ['RS256'],
      requiredClaims: ['sub', 'email', 'exp', 'iat', 'aud', 'iss'], clockTolerance: 0,
    });
    // Access service tokens are not employee accounts.
    if (payload.type !== 'app' || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 200 ||
        typeof payload.email !== 'string' || payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
        typeof payload.iat !== 'number' || payload.iat > Date.now() / 1000 + 30) return null;
    const email = payload.email.toLowerCase();
    const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.slice(0, 160) : null;
    return {userId: 'cf-access:' + payload.sub, email, displayName: name || email, fullName: name};
  } catch {
    // Never return token contents, key material or upstream errors to clients.
    return null;
  }
}
