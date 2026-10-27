import {readFileSync, existsSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateCloudflareConfig} from './cloudflare-config.mjs';

const command = process.argv[2];
if (!['check', 'build', 'deploy', 'migrate'].includes(command)) throw Error('Use check, build, deploy or migrate.');
const configPath = resolve(process.env.ACADEMY_DEPLOY_CONFIG || 'cloudflare.config.json');
// Cloudflare Workers Builds can supply public resource IDs as build variables.
// The generated local file is ignored by Git; runtime secrets stay in Workers.
if (!existsSync(configPath) && !process.env.ACADEMY_DEPLOY_CONFIG && process.env.ACADEMY_D1_ID) {
  const generated = JSON.parse(readFileSync('cloudflare.config.example.json', 'utf8'));
  generated.vars.AUTH_PROVIDER = process.env.ACADEMY_AUTH_PROVIDER || 'cloudflare-access';
  generated.vars.ACCESS_TEAM_DOMAIN = process.env.ACCESS_TEAM_DOMAIN || '';
  generated.vars.ACCESS_AUD = process.env.ACCESS_AUD || '';
  generated.d1_databases[0].database_id = process.env.ACADEMY_D1_ID;
  generated.r2_buckets[0].bucket_name = process.env.ACADEMY_R2_BUCKET || 'oppo-service-academy-private';
  writeFileSync(configPath, JSON.stringify(generated, null, 2) + '\n', {mode: 0o600});
}
if (!existsSync(configPath)) throw Error('Copy cloudflare.config.example.json to cloudflare.config.json and fill the account-specific settings first.');
const source = JSON.parse(readFileSync(configPath, 'utf8'));
const errors = validateCloudflareConfig(source);
if (errors.length) throw Error(errors.join('\n'));
console.log('Private Cloudflare configuration passed validation.');
if (command === 'check') process.exit(0);
const env = {...process.env, ACADEMY_DEPLOY_CONFIG: configPath, WRANGLER_SEND_METRICS: 'false'};
function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {env, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (command === 'migrate') {
  run('node_modules/wrangler/bin/wrangler.js', ['d1', 'migrations', 'apply', 'DB', '--remote', '--config', configPath]);
} else {
  run('scripts/run-framework.mjs', ['build']);
  const generatedPath = 'dist/server/wrangler.json';
  const built = JSON.parse(readFileSync(generatedPath, 'utf8'));
  if (built.vars?.AUTH_PROVIDER !== source.vars.AUTH_PROVIDER || built.vars?.ACCESS_AUD !== source.vars.ACCESS_AUD || built.d1_databases?.find(d => d.binding === 'DB')?.database_id !== source.d1_databases.find(d => d.binding === 'DB').database_id || built.assets?.run_worker_first !== true || built.assets?.binding !== 'ASSETS') throw Error('Generated deployment configuration does not match the private source configuration.');
  if (command === 'deploy') run('node_modules/wrangler/bin/wrangler.js', ['deploy', '--config', generatedPath]);
}
