// Secrets that are optional (added once email is set up), so they are not in
// .dev.vars.example and `wrangler types` may not see them
interface __BaseEnv_Env {
  SCW_SECRET_KEY?: string;
  SCW_PROJECT_ID?: string;
}
