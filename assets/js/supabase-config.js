// Chaves publicáveis podem ficar no front-end. Nunca use secret/service_role aqui.
export const SUPABASE_URL = "COLE_AQUI_SUA_SUPABASE_URL";
export const SUPABASE_PUBLISHABLE_KEY = "COLE_AQUI_SUA_SUPABASE_PUBLISHABLE_KEY";

export function supabaseConfigurado() {
  return SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("COLE_AQUI") &&
    SUPABASE_PUBLISHABLE_KEY.length > 20 &&
    !SUPABASE_PUBLISHABLE_KEY.includes("COLE_AQUI");
}
