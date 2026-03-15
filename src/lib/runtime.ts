export function isProductionBuild() {
  return process.env.NODE_ENV === "production";
}
