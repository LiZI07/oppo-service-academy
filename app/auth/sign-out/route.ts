import {env} from 'cloudflare:workers';
import {chatGPTSignOutPath} from '../../chatgpt-auth';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (request.headers.get('sec-fetch-site') === 'cross-site') return new Response(null, {status: 403});
  if (request.headers.has('next-router-prefetch') || /prefetch/i.test(request.headers.get('purpose') || request.headers.get('sec-purpose') || '')) return new Response(null, {status: 204});
  const target = env.AUTH_PROVIDER === 'cloudflare-access' ? '/cdn-cgi/access/logout' :
    env.AUTH_PROVIDER === 'sites-trusted-proxy' ? chatGPTSignOutPath('/login') : null;
  if (!target) return new Response('Authentication is not configured.', {status: 503});
  return new Response(null, {status: 303, headers: {Location: new URL(target, url.origin).toString(), 'Cache-Control': 'private, no-store'}});
}
