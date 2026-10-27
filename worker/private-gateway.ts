import {passwordIdentity,passwordEndpoint} from '../app/lib/password-auth';
import {loginPage} from '../app/lib/login-page';
import {accessIdentity, accessSettings} from '../app/lib/access-token';

export async function privateGateway(request: Request, env: Cloudflare.Env): Promise<Response | null> {
  // This legacy option is only for the trusted Sites ingress, never a public host.
  if (env.AUTH_PROVIDER === 'sites-trusted-proxy') return null;
  const path=new URL(request.url).pathname;
  if(env.AUTH_PROVIDER==='password'){
    try {
      if(path==='/login'&&['GET','HEAD'].includes(request.method))return new Response(request.method==='HEAD'?null:loginPage(),{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
      if(['/api/auth/login','/api/auth/reset','/api/auth/logout'].includes(path))return await passwordEndpoint(request,env);
      if(path==='/preview'||path.startsWith('/preview/'))return new Response('Not found',{status:404});
      if(await passwordIdentity(request.headers,env))return null;
      return path.startsWith('/api/')?Response.json({error:'SIGN_IN_REQUIRED'},{status:401,headers:{'Cache-Control':'private, no-store'}}):new Response(null,{status:303,headers:{Location:'/login','Cache-Control':'private, no-store'}});
    }catch{return new Response('Authentication temporarily unavailable.',{status:503,headers:{'Cache-Control':'private, no-store'}})}
  }
  const headers = {'Cache-Control': 'private, no-store', 'Content-Type': 'text/plain; charset=utf-8'};
  if (env.AUTH_PROVIDER !== 'cloudflare-access' || !accessSettings(env)) {
    return new Response('Service Academy: private access is not configured. Contact the administrator.', {status: 503, headers});
  }
  if (!await accessIdentity(request.headers, env)) {
    return new Response('Sign in through the configured Cloudflare Access application.', {status: 401, headers});
  }
  return null;
}
