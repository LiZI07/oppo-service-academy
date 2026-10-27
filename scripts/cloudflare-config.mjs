export function validateCloudflareConfig(config) {
  const errors = [];
  if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/.test(config.name || '')) errors.push('Worker name is invalid.');
  if (config.main !== 'worker/index.ts') errors.push('main must use the authenticated worker/index.ts entrypoint.');
  if (!config.compatibility_flags?.includes('nodejs_compat')) errors.push('nodejs_compat is required.');
  if (config.preview_urls !== false) errors.push('Keep preview_urls=false until preview Access protection is configured.');
  if (config.assets?.run_worker_first !== true || config.assets?.binding !== 'ASSETS') errors.push('Private assets require ASSETS and run_worker_first=true.');
  if (!['cloudflare-access','password'].includes(config.vars?.AUTH_PROVIDER)) errors.push('Standalone deployment requires a supported authentication provider.');
  if (!/^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(config.vars?.ACCESS_TEAM_DOMAIN || '')) errors.push('Set the exact HTTPS Access team domain.');
  if (!/^[a-f0-9]{64}$/.test(config.vars?.ACCESS_AUD || '')) errors.push('Set the 64-character Access application AUD.');
  const db = config.d1_databases?.find(d => d.binding === 'DB');
  if (!db || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(db.database_id || '') || db.database_id === '00000000-0000-4000-8000-000000000000' || db.migrations_dir !== 'drizzle') errors.push('Set a real D1 DB ID and migrations_dir=drizzle.');
  if (!config.r2_buckets?.some(b => b.binding === 'BUCKET' && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(b.bucket_name || ''))) errors.push('Set the private R2 BUCKET binding.');
  if (config.vars?.BOOTSTRAP_ADMIN_EMAIL) errors.push('Use a Worker secret for BOOTSTRAP_ADMIN_EMAIL, not source configuration.');
  return errors;
}
