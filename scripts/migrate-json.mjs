import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Defina SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, ADMIN_EMAIL e ADMIN_PASSWORD neste terminal local.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function slugify(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function plainText(html = "") {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

async function upsert(table, rows) {
  if (!rows.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: "slug" });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`${table}: ${rows.length} registros importados.`);
}

const noticiasAntigas = await readJson("news-data.json");
const noticias = noticiasAntigas.map((item) => {
  const resumo = plainText(item.content).slice(0, 240);
  return {
    titulo: item.title,
    slug: slugify(item.title),
    resumo,
    conteudo_html: item.content || "",
    imagem_url: item.image || null,
    categoria_nome: "Notícias",
    autor: (item.author || "Equipe Eu Amo Urânia").replace(/^\s*Por\s+/i, ""),
    status: "publicado",
    destaque: item.id === 1,
    publicado_em: item.date ? `${item.date}T12:00:00-03:00` : new Date().toISOString(),
    seo_titulo: item.title,
    seo_descricao: resumo.slice(0, 160)
  };
});

const guiaAntigo = await readJson("guia-data.json");
const guia = guiaAntigo.map((item) => ({
  nome: item.nome,
  slug: slugify(item.nome),
  categoria_nome: item.categoria || "Outros",
  descricao: item.descricao || "",
  imagem_url: item.imagem || null,
  whatsapp: item.whatsapp || null,
  instagram: item.instagram || null,
  endereco: item.endereco || null,
  recomendado: Boolean(item.destaque),
  status: "publicado",
  seo_titulo: item.nome,
  seo_descricao: plainText(item.descricao || "").slice(0, 160)
}));

try {
  const { data: login, error: loginError } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });
  if (loginError) throw new Error(`Login: ${loginError.message}`);

  const { data: admin, error: adminError } = await supabase
    .from("usuarios_admin")
    .select("id,ativo")
    .eq("id", login.user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (adminError) throw adminError;
  if (!admin) throw new Error("O usuário autenticado ainda não está ativo em usuarios_admin.");

  await upsert("noticias", noticias);
  await upsert("guia_comercial", guia);
  console.log("Migração concluída. Confira os registros no painel.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await supabase.auth.signOut({ scope: "local" });
}
