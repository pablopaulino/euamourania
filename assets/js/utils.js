export function gerarSlug(texto = "") {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-");
}

export function formatarData(data) {
  if (!data) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(data));
}

export function textoPuro(html = "") {
  const elemento = document.createElement("div");
  elemento.innerHTML = html;
  return elemento.textContent || "";
}

export function definirMeta({ titulo, descricao, imagem, url = window.location.href }) {
  document.title = titulo;
  const valores = {
    description: descricao,
    "og:title": titulo,
    "og:description": descricao,
    "og:image": imagem,
    "og:url": url,
    "twitter:card": "summary_large_image",
    "twitter:title": titulo,
    "twitter:description": descricao,
    "twitter:image": imagem
  };
  Object.entries(valores).forEach(([nome, conteudo]) => {
    if (!conteudo) return;
    const property = nome.startsWith("og:");
    let meta = document.head.querySelector(`meta[${property ? "property" : "name"}="${nome}"]`);
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute(property ? "property" : "name", nome); document.head.appendChild(meta); }
    meta.content = conteudo;
  });
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
  canonical.href = url;
}
