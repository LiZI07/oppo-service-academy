import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const env = {};
let requestHeaders = new Headers({
  'oai-authenticated-user-id': 'forged-id',
  'oai-authenticated-user-email': 'owner@example.test',
});
const module = {exports: {}};
const code = ts.transpileModule(fs.readFileSync('app/chatgpt-auth.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
const require = (name) => {
  if (name === 'cloudflare:workers') return {env};
  if (name === 'next/headers') return {headers: async () => requestHeaders};
  if (name === 'next/navigation') return {redirect: (to) => {throw Error(to)}};
  throw Error(`Unexpected dependency: ${name}`);
};
vm.runInNewContext(code, {module, exports: module.exports, require, URL});
const {getChatGPTUser, chatGPTSignInPath} = module.exports;
assert.equal(await getChatGPTUser(), null, 'A clean clone must reject user-controlled identity headers');
env.AUTH_PROVIDER = 'disabled';
assert.equal(await getChatGPTUser(), null);
env.AUTH_PROVIDER = 'unrecognized';
assert.equal(await getChatGPTUser(), null);
env.AUTH_PROVIDER = 'sites-trusted-proxy';
assert.equal((await getChatGPTUser()).email, 'owner@example.test');
requestHeaders = new Headers({'oai-authenticated-user-email': 'owner@example.test'});
assert.equal(await getChatGPTUser(), null, 'Trusted ingress still needs both identity fields');
assert.equal(chatGPTSignInPath('//attacker.test/'), '/signin-with-chatgpt?return_to=%2F');
assert.equal(chatGPTSignInPath('/signout-with-chatgpt'), '/signin-with-chatgpt?return_to=%2F');
console.log('PASS: exported identity adapter defaults closed, ignores forged headers until explicitly configured, requires complete identity and limits return URLs.');
