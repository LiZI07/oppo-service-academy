import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import * as jose from 'jose';
import * as nodeCrypto from 'node:crypto';
import {validateCloudflareConfig} from '../scripts/cloudflare-config.mjs';

const {privateKey, publicKey} = await jose.generateKeyPair('RS256', {extractable: true});
const key = {...await jose.exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig'};
const keys = jose.createLocalJWKSet({keys: [key]});
const issuer = 'https://academy-test.cloudflareaccess.com', audience = 'a'.repeat(64);
const now = Math.floor(Date.now() / 1000);
const config = {AUTH_PROVIDER: 'cloudflare-access', ACCESS_TEAM_DOMAIN: issuer, ACCESS_AUD: audience};
const claims = {sub: 'employee-1', email: 'Owner@Example.test', type: 'app', iss: issuer, aud: audience, iat: now, exp: now + 300};
const sign = (overrides = {}, secret = privateKey) => new jose.SignJWT({...claims, ...overrides}).setProtectedHeader({alg: 'RS256', kid: 'test-key'}).sign(secret);
const token = await sign();
let requestHeaders = new Headers();
const env = {...config};
let assetReads = 0, appReads = 0;
const cache = new Map();
function load(filename) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename);
  const module = {exports: {}};
  const require = name => {
    if (name === 'node:crypto') return nodeCrypto;
    if (name === 'jose') return jose;
    if (name === 'cloudflare:workers') return {env};
    if (name === 'next/headers') return {headers: async () => requestHeaders};
    if (name === 'next/navigation') return {redirect() {throw Error('Unexpected redirect')}};
    if (name === 'vinext/server/fetch-handler') return {fetch: async () => {appReads++; return new Response('app')}};
    if (name === '../lib/connector-context') return {runWithConnectorBinding: (_binding, fn) => fn()};
    const dependency = load(path.resolve(path.dirname(filename), name) + '.ts');
    if (name.endsWith('access-token')) return {...dependency, accessIdentity: (h, c) => dependency.accessIdentity(h, c, keys)};
    return dependency;
  };
  const source = fs.readFileSync(filename, 'utf8').replaceAll('import.meta.env.DEV', 'false');
  const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}}).outputText;
  vm.runInNewContext(code, {module, exports: module.exports, require, URL, Headers, Request, Response, Date, console});
  cache.set(filename, module.exports);
  return module.exports;
}
const auth = load('app/lib/access-token.ts');
const validHeaders = new Headers({'cf-access-jwt-assertion': token});
const user = await auth.accessIdentity(validHeaders, config, keys);
assert.equal(user.email, 'owner@example.test');
assert.equal(user.userId, 'cf-access:employee-1');
for (const overrides of [{exp: now - 1}, {nbf: now + 300}, {iat: now + 120}, {aud: 'other-app'}, {iss: 'https://other.cloudflareaccess.com'}, {sub: ''}, {email: ''}, {email: 'invalid'}, {type: 'service'}, {exp: undefined}]) {
  assert.equal(await auth.accessIdentity(new Headers({'cf-access-jwt-assertion': await sign(overrides)}), config, keys), null, JSON.stringify(overrides));
}
const other = await jose.generateKeyPair('RS256');
assert.equal(await auth.accessIdentity(new Headers({'cf-access-jwt-assertion': await sign({}, other.privateKey)}), config, keys), null);
const unsigned = token.split('.').slice(0, 2).join('.') + '.';
assert.equal(await auth.accessIdentity(new Headers({'cf-access-jwt-assertion': unsigned}), config, keys), null);
assert.equal(await auth.accessIdentity(new Headers({'oai-authenticated-user-id': 'admin', 'oai-authenticated-user-email': 'owner@example.test'}), config, keys), null);
assert.equal(await auth.accessIdentity(validHeaders, {...config, ACCESS_TEAM_DOMAIN: 'https://127.0.0.1'}, keys), null);

requestHeaders = validHeaders;
const adapter = load('app/chatgpt-auth.ts');
assert.equal((await adapter.getChatGPTUser()).email, 'owner@example.test');
env.AUTH_PROVIDER = 'disabled';
assert.equal(await adapter.getChatGPTUser(), null);
env.AUTH_PROVIDER = 'cloudflare-access';
requestHeaders = new Headers({'oai-authenticated-user-id': 'admin', 'oai-authenticated-user-email': 'owner@example.test'});
assert.equal(await adapter.getChatGPTUser(), null);

const worker = load('worker/index.ts').default;
const bindings = {...config, ASSETS: {fetch: async () => {assetReads++; return new Response('private learning file')}}};
for (const target of ['/preview?role=admin', '/training-process-source.png', '/_next/static/chunks/app.js', '/api/training']) {
  const r = await worker.fetch(new Request('https://academy.example' + target), bindings, {});
  assert.equal(r.status, 401, target);
}
assert.equal(assetReads, 0);assert.equal(appReads, 0);
assert.equal((await worker.fetch(new Request('https://academy.example/preview'), {}, {})).status, 503);
let response = await worker.fetch(new Request('https://academy.example/training-process-source.png', {headers: validHeaders}), bindings, {});
assert.equal(response.status, 200);assert.equal(assetReads, 1);
assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
response = await worker.fetch(new Request('https://academy.example/api/training', {headers: validHeaders}), bindings, {});
assert.equal(await response.text(), 'app');assert.equal(appReads, 1);

const login = load('app/auth/sign-in/route.ts'), logout = load('app/auth/sign-out/route.ts');
for (const unsafe of ['//attacker.test', '/\\attacker.test', '/\t/attacker.test', '/a/../auth/sign-in']) {
  const r = await login.GET(new Request('https://academy.example/auth/sign-in?return_to=' + encodeURIComponent(unsafe)));
  assert.equal(r.headers.get('Location'), 'https://academy.example/', unsafe);
}
assert.equal((await logout.GET(new Request('https://academy.example/auth/sign-out'))).headers.get('Location'), 'https://academy.example/cdn-cgi/access/logout');
assert.equal((await logout.GET(new Request('https://academy.example/auth/sign-out', {headers: {'sec-fetch-site': 'cross-site'}}))).status, 403);
assert.equal((await logout.GET(new Request('https://academy.example/auth/sign-out', {headers: {purpose: 'prefetch'}}))).status, 204);

const template = JSON.parse(fs.readFileSync('cloudflare.config.example.json', 'utf8'));
assert(validateCloudflareConfig(template).length > 0);
const deploy = {...template, vars: {...config}, d1_databases: [{binding: 'DB', database_id: '11111111-1111-4111-8111-111111111111', migrations_dir: 'drizzle'}]};
assert.equal(validateCloudflareConfig(deploy).length, 0);
assert(validateCloudflareConfig({...deploy, assets: {binding: 'ASSETS', run_worker_first: false}}).length > 0);
assert(validateCloudflareConfig({...deploy, vars: {...config, AUTH_PROVIDER: 'sites-trusted-proxy'}}).length > 0);
assert(validateCloudflareConfig({...deploy, vars: {...config, BOOTSTRAP_ADMIN_EMAIL: 'owner@example.test'}}).length > 0);
console.log('PASS: real signed Access JWT validation, forged/expired/wrong-audience/service-token rejection, private pages/assets before rendering, account adapter, logout, safe redirects and deployment configuration safeguards.');
