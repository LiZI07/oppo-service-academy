declare namespace Cloudflare {
  interface Env {
    AUTH_PROVIDER?: "disabled" | "sites-trusted-proxy" | "cloudflare-access";
    ACCESS_TEAM_DOMAIN?: string;
    ACCESS_AUD?: string;
    ASSETS?: Fetcher;
    BOOTSTRAP_ADMIN_EMAIL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
