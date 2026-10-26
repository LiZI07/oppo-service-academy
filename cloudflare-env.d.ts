declare namespace Cloudflare {
  interface Env {
    AUTH_PROVIDER?: "disabled" | "sites-trusted-proxy";
    BOOTSTRAP_ADMIN_EMAIL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
