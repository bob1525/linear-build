export function showDemoCredentials(env: { NODE_ENV?: string; NORTHSTAR_SHOW_DEMO?: string } = process.env): boolean {
  if (env.NORTHSTAR_SHOW_DEMO === "1") return true;
  if (env.NORTHSTAR_SHOW_DEMO === "0") return false;
  return env.NODE_ENV !== "production";
}
