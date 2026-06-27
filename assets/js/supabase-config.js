// Chaves publicáveis podem ficar no front-end. Nunca use secret/service_role aqui.
export const SUPABASE_URL = "https://omhcpbphvtihqwdkbsbf.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";

export function supabaseConfigurado() {
  return SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("COLE_AQUI") &&
    SUPABASE_PUBLISHABLE_KEY.length > 20 &&
    !SUPABASE_PUBLISHABLE_KEY.includes("COLE_AQUI");
}
