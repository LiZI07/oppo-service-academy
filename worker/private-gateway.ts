import {accessIdentity, accessSettings} from '../app/lib/access-token';

export async function privateGateway(request: Request, env: Cloudflare.Env): Promise<Response | null> {
  // This legacy option is only for the trusted Sites ingress, never a public host.
  if (env.AUTH_PROVIDER === 'sites-trusted-proxy') return null;
  const headers = {'Cache-Control': 'private, no-store', 'Content-Type': 'text/plain; charset=utf-8'};
  if (env.AUTH_PROVIDER !== 'cloudflare-access' || !accessSettings(env)) {
    return new Response('Service Academy: private access is not configured. Contact the administrator.', {status: 503, headers});
  }
  if (!await accessIdentity(request.headers, env)) {
    return new Response('Sign in through the configured Cloudflare Access application.', {status: 401, headers});
  }
  return null;
}
