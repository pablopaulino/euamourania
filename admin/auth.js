import { getSupabase, supabaseConfigurado } from "../assets/js/services/supabaseClient.js";

export async function entrar(email, password) {
  if (!supabaseConfigurado()) throw new Error("Configure o Supabase antes de entrar.");
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
  const autorizado = await verificarAdministrador(data.user.id);
  if (!autorizado) { await getSupabase().auth.signOut({ scope: "local" }); throw new Error("Usuário sem permissão de administrador."); }
  return data;
}

export async function verificarAdministrador(userId) {
  const { data, error } = await getSupabase().from("usuarios_admin").select("id,ativo,nome,email").eq("id", userId).eq("ativo", true).maybeSingle();
  if (error) throw error;
  return data;
}

export async function exigirAdministrador() {
  if (!supabaseConfigurado()) return { configurado: false, user: null, admin: null };
  const { data: { session } } = await getSupabase().auth.getSession();
  if (!session) { location.replace("login.html"); return null; }
  const admin = await verificarAdministrador(session.user.id);
  if (!admin) { await getSupabase().auth.signOut({ scope: "local" }); location.replace("login.html?erro=sem-permissao"); return null; }
  return { configurado: true, user: session.user, admin };
}

export async function sair() {
  await getSupabase().auth.signOut({ scope: "local" });
  location.replace("login.html");
}
