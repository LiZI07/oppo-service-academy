import {env} from 'cloudflare:workers';
import {chatGPTSignInPath} from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get('return_to') || '/';
  let safe = '/';
  try {
    const parsed = new URL(requested, url.origin);
    if (requested.startsWith('/') && !/[\u0000-\u0020\u007f\\]/.test(requested) && parsed.origin === url.origin &&
        !parsed.pathname.startsWith('/auth/') && !parsed.pathname.startsWith('/cdn-cgi/')) safe = parsed.pathname + parsed.search + parsed.hash;
  } catch {}
  const target = env.AUTH_PROVIDER === 'cloudflare-access' ? safe :
    env.AUTH_PROVIDER === 'sites-trusted-proxy' ? chatGPTSignInPath(safe) : null;
  if (!target) return new Response('Authentication is not configured.', {status: 503});
  return new Response(null, {status: 303, headers: {Location: new URL(target, url.origin).toString(), 'Cache-Control': 'private, no-store'}});
}
