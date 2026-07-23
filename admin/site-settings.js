import { getSupabase } from "../assets/js/services/supabaseClient.js";
import { EDITORIAL_POLICY_PAGES } from "../assets/js/editorialPolicies.js";

const db = getSupabase();
const esc = (v = "") =>
  String(v ?? "").replace(/[&<>'"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[c]);

const mojibakePattern = /Ã|Â|â[€„€¦™œ€œ˜]/;

function repairEncoding(value = "") {
  const text = String(value ?? "");
  if (!mojibakePattern.test(text)) return text;
  try {
    const bytes = Uint8Array.from([...text].map((char) => char.charCodeAt(0) & 255));
    const repaired = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return (repaired.match(mojibakePattern) || []).length < (text.match(mojibakePattern) || []).length
      ? repaired
      : text;
  } catch {
    return text;
  }
}

const defaultValues = {
  imagem_compartilhamento: "/assets/compartilhamento-logo.png",
  urania_hero_imagem: "/assets/AD3A1763-min (1).jpg",
  urania_historia_imagem: "/assets/3Q2A7854-min-min.jpg",
  urania_hero_eyebrow: "Cidade do Noroeste Paulista",
  urania_hero_titulo: "Urânia, uma cidade feita de histórias próximas.",
  urania_hero_texto:
    "Entre a força do campo, o comércio local, o turismo rural e o orgulho de quem vive aqui, Urânia guarda uma identidade acolhedora: pequena no tamanho, grande no sentimento de comunidade.",
  urania_historia_titulo: "De povoado a município, uma cidade planejada para crescer.",
  urania_historia_intro:
    "A história de Urânia é marcada por iniciativa, desenvolvimento rápido e pela força de moradores que ajudaram a transformar o antigo povoado em cidade.",
  urania_historia_texto:
    "O território que deu origem à cidade aparece ligado ao antigo povoado de Tupilândia. A partir da década de 1940, a região passou por um processo de organização e desenvolvimento, impulsionado por novos loteamentos, pelo trabalho no campo e pela chegada de estruturas que aproximavam Urânia de outras localidades do Noroeste Paulista.\n\nSegundo registros históricos divulgados sobre o município, Benedito Pinto Ferreira Braga, conhecido como Zico Braga, teve papel importante nesse processo de formação. A cidade se consolidou como distrito na década de 1950 e posteriormente alcançou sua emancipação político-administrativa.\n\nMais do que datas, a história de Urânia é a história de famílias, trabalhadores, comerciantes, agricultores, educadores e visitantes que ajudaram a construir uma cidade de convivência próxima e identidade forte.",
  urania_cta_titulo: "Tem uma memória, foto ou história da cidade?",
  urania_cta_texto: "Ajude o Eu Amo Urânia a construir uma página cada vez mais completa sobre a nossa cidade.",
  urania_cta_botao: "Enviar pelo WhatsApp",
};

for (const page of EDITORIAL_POLICY_PAGES) {
  defaultValues[`${page.key}_titulo`] = page.title;
  defaultValues[`${page.key}_descricao`] = page.description;
  defaultValues[`${page.key}_html`] = page.html;
  defaultValues[`${page.key}_atualizado_em`] = page.updatedAt;
}

const groups = [
  [
    "Imagens do site",
    "Imagens públicas que podem ser trocadas pela biblioteca do CMS sem alterar o código.",
    [
      ["imagem_compartilhamento", "Imagem padrão de compartilhamento", "image", "midia/compartilhamento", "social"],
      ["imagem_padrao_noticia", "Imagem padrão de notícias", "image", "midia/padroes", "wide"],
      ["imagem_padrao_guia", "Imagem padrão do Guia", "image", "midia/padroes", "card"],
      ["imagem_padrao_turismo", "Imagem padrão de Turismo", "image", "midia/padroes", "wide"],
      ["imagem_padrao_evento", "Imagem padrão de Eventos", "image", "midia/padroes", "wide"],
      ["home_hero_imagem", "Imagem principal da Home", "image", "home/hero", "square"],
      ["home_turismo_imagem_1", "Imagem do bloco Turismo 1", "image", "home/turismo", "wide"],
      ["home_turismo_imagem_2", "Imagem do bloco Turismo 2", "image", "home/turismo", "wide"],
      ["urania_hero_imagem", "Imagem principal da página Urânia", "image", "urania/hero", "square"],
      ["urania_historia_imagem", "Imagem da história de Urânia", "image", "urania/historia", "wide"],
    ],
  ],
  [
    "Informações principais",
    "Dados simples que aparecem no site e ajudam o visitante a entender o portal.",
    [
      ["nome_site", "Nome do site"],
      ["slogan", "Slogan"],
      ["descricao_site", "Descrição institucional", "textarea"],
      ["texto_rodape", "Texto do rodapé", "textarea"],
    ],
  ],
  [
    "Contato e redes sociais",
    "Canais oficiais usados em botões, rodapé e áreas de contato.",
    [
      ["email_contato", "E-mail de contato", "email"],
      ["whatsapp", "WhatsApp principal"],
      ["whatsapp_canal", "Canal do WhatsApp", "url"],
      ["instagram", "Instagram", "url"],
      ["facebook", "Facebook", "url"],
      ["youtube", "YouTube", "url"],
      ["tiktok", "TikTok", "url"],
    ],
  ],
  [
    "Home",
    "Textos principais da página inicial. Imagens, cores e cards ficam protegidos no projeto.",
    [
      ["home_hero_eyebrow", "Chamada superior"],
      ["home_hero_titulo", "Título principal"],
      ["home_hero_destaque", "Título em destaque"],
      ["home_hero_texto", "Texto de apoio", "textarea"],
      ["home_botao_1_texto", "Botão principal"],
      ["home_botao_1_link", "Link do botão principal", "url"],
      ["home_botao_2_texto", "Botão secundário"],
      ["home_botao_2_link", "Link do botão secundário", "url"],
      ["home_essencia_titulo", "Título da seção Nossa essência"],
      ["home_essencia_texto_1", "Texto Nossa essência 1", "textarea"],
      ["home_essencia_texto_2", "Texto Nossa essência 2", "textarea"],
      ["newsletter_titulo", "Título da newsletter"],
      ["newsletter_texto", "Texto da newsletter", "textarea"],
    ],
  ],
  [
    "Quem somos",
    "Conteúdo institucional da página Quem Somos.",
    [
      ["quem_eyebrow", "Chamada superior"],
      ["quem_titulo", "Título"],
      ["quem_subtitulo", "Subtítulo", "textarea"],
      ["quem_bloco_titulo", "Título principal"],
      ["quem_texto_1", "Primeiro texto", "textarea"],
      ["quem_texto_2", "Segundo texto", "textarea"],
      ["quem_botao_texto", "Texto do botão"],
      ["quem_botao_link", "Link do botão", "url"],
      ["quem_cta_titulo", "Título da chamada final"],
      ["quem_cta_texto", "Texto da chamada final", "textarea"],
      ["quem_cta_botao", "Botão da chamada final"],
    ],
  ],
  [
    "Página Urânia",
    "Textos editáveis da página da cidade. As imagens e cores ficam protegidas para manter o visual consistente.",
    [
      ["urania_hero_eyebrow", "Chamada superior"],
      ["urania_hero_titulo", "Título principal"],
      ["urania_hero_destaque", "Destaque do título"],
      ["urania_hero_texto", "Texto do topo", "textarea"],
      ["urania_historia_titulo", "Título da história"],
      ["urania_historia_intro", "Introdução da história", "textarea"],
      ["urania_historia_texto", "Texto principal da história", "textarea"],
      ["urania_cta_titulo", "Título da chamada final"],
      ["urania_cta_texto", "Texto da chamada final", "textarea"],
      ["urania_cta_botao", "Botão da chamada final"],
    ],
  ],
  [
    "SEO básico",
    "Informações globais para mecanismos de busca e compartilhamentos.",
    [
      ["seo_titulo_padrao", "Título padrão"],
      ["seo_descricao_padrao", "Descrição padrão", "textarea"],
      ["seo_palavras_chave", "Palavras-chave"],
      ["seo_autor", "Autor"],
      ["seo_publicador", "Publicador"],
      ["dominio_principal", "Domínio principal", "url"],
    ],
  ],
  [
    "Aplicativo Viva Urânia",
    "Links oficiais usados pelo aplicativo para compartilhar e receber avaliações nas lojas.",
    [
      ["link_google_play", "Link do app na Google Play", "url"],
      ["link_app_store", "Link do app na App Store", "url"],
    ],
  ],
  [
    "Políticas editoriais",
    "Páginas públicas da área de notícias sobre publicações, correções, transparência e contato editorial.",
    EDITORIAL_POLICY_PAGES.flatMap((page) => [
      [`${page.key}_titulo`, `${page.title} — título`],
      [`${page.key}_descricao`, `${page.title} — descrição`, "textarea"],
      [`${page.key}_html`, `${page.title} — conteúdo`, "html"],
      [`${page.key}_atualizado_em`, `${page.title} — última atualização`],
    ]),
  ],
  [
    "Páginas legais",
    "Textos institucionais. Use apenas conteúdo simples; scripts são removidos no site.",
    [
      ["termos_html", "Termos de serviço", "html"],
      ["privacidade_html", "Política de privacidade", "html"],
    ],
  ],
];

const editableGlobalImages = new Set("urania_hero_imagem|urania_historia_imagem".split("|"));

function getVisibleGroups() {
  return groups
    .map(([title, description, fields]) => {
      const visibleFields = fields.filter(([key, , type]) => type !== "image" || editableGlobalImages.has(key));
      if (!visibleFields.length) return null;
      if (title === "Imagens do site") {
        return [
          "Imagens da página Urânia",
          "Somente imagens que aparecem visualmente na página pública da cidade.",
          visibleFields,
        ];
      }
      return [title, description, visibleFields];
    })
    .filter(Boolean);
}

function toast(message, type = "success") {
  let stack = document.getElementById("toasts");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toasts";
    stack.className = "toast-stack";
    document.body.append(stack);
  }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.append(el);
  setTimeout(() => el.remove(), 3500);
}

function validSiteReference(value) {
  if (!value) return true;
  if (/^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|\.{1,2}\/|#)/i.test(value)) return true;
  return /^[\w.-]+(?:\/[\w\-./%~:+?#[\]@!$&'()*+,;=]*)?$/u.test(value) && !/^javascript:/i.test(value);
}

function field([key, label, type = "text"], value) {
  const full = ['textarea', 'html'].includes(type);
  const hint =
    type === "html"
      ? "<small>HTML institucional permitido. Evite colar códigos externos.</small>"
      : type === "url"
        ? "<small>Aceita link completo ou caminho interno, como /pagina.html.</small>"
        : "";
  const inputType = type === "url" ? "text" : type;
  const inputMode = type === "url" ? ' inputmode="url" data-type="url"' : "";
  const cleanValue = repairEncoding(value);

  return `<div class="cms-field ${full ? "full" : ""}">
    <label for="cfg-${key}">${label}</label>
    ${full
      ? `<textarea id="cfg-${key}" name="${key}" data-type="${type}" rows="${type === "html" ? 10 : 4}">${esc(cleanValue)}</textarea>`
      : `<input id="cfg-${key}" name="${key}" type="${inputType}"${inputMode} value="${esc(cleanValue)}">`}
    ${hint}
  </div>`;
}

function configField([key, label, type = "text", folder = "configuracoes/imagens", preset = "wide"], value) {
  const full = ['textarea', 'html'].includes(type);
  const hint =
    type === "html"
      ? "<small>HTML institucional permitido. Evite colar códigos externos.</small>"
      : ['url', 'image'].includes(type)
        ? "<small>Aceita link completo, caminho interno ou imagem escolhida na biblioteca.</small>"
        : "";
  const inputType = ['url', 'image'].includes(type) ? "text" : type;
  const inputMode = ['url', 'image'].includes(type) ? ` inputmode="url" data-type="${type}"` : "";
  const mediaAttrs = type === "image" ? ` data-cms-image="true" data-media-folder="${esc(folder)}" data-media-preset="${esc(preset)}"` : "";
  const cleanValue = repairEncoding(value);

  return `<div class="cms-field ${full ? "full" : ""}">
    <label for="cfg-${key}">${label}</label>
    ${full
      ? `<textarea id="cfg-${key}" name="${key}" data-type="${type}" rows="${type === "html" ? 10 : 4}">${esc(cleanValue)}</textarea>`
      : `<input id="cfg-${key}" name="${key}" type="${inputType}"${inputMode}${mediaAttrs} value="${esc(cleanValue)}">`}
    ${hint}
  </div>`;
}

async function enhance(form) {
  if (form.dataset.globalSettings) return;
  form.dataset.globalSettings = "1";

  const { data, error } = await db.from("configuracoes_site").select("chave,valor,tipo");
  if (error) {
    toast(error.message, "error");
    return;
  }

  const savedValues = Object.fromEntries((data || []).map((i) => [i.chave, repairEncoding(i.valor || "")]));
  const values = { ...defaultValues, ...savedValues };

  form.innerHTML =
    `<div class="cms-settings-intro">
      <p class="eyebrow">Configurações seguras</p>
      <h2>Edite apenas o essencial do portal</h2>
      <p>Logos, favicons, imagens estruturais, menus, cores e blocos técnicos ficam protegidos no projeto. Aqui entram textos, contatos, SEO básico e páginas institucionais.</p>
    </div>` +
    getVisibleGroups()
      .map(
        ([title, description, fields]) => `<section class="cms-form-section">
          <div class="cms-section-head compact">
            <div>
              <h3>${title}</h3>
              <p>${description}</p>
            </div>
          </div>
          <div class="cms-form">${fields.map((f) => configField(f, values[f[0]] || "")).join("")}</div>
        </section>`,
      )
      .join("") +
    `<div class="cms-sticky-actions"><button class="admin-button" type="submit">Salvar configurações</button></div>`;

  form.addEventListener("input", (event) => event.stopPropagation(), true);
}

new MutationObserver(() => {
  const form = document.getElementById("settings-form");
  if (form) enhance(form);
}).observe(document.getElementById("app-content"), { childList: true, subtree: true });

document.addEventListener(
  "submit",
  async (event) => {
    const form = event.target;
    if (form.id !== "settings-form" || !form.dataset.globalSettings) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const button = event.submitter;
    const fd = new FormData(form);
    const rows = [];

    for (const [, , fields] of getVisibleGroups()) {
      for (const [key, , type = "text"] of fields) {
        const value = repairEncoding(String(fd.get(key) || "").trim());
        if (['url', 'image'].includes(type) && !validSiteReference(value)) {
          toast(`Link ou caminho inválido no campo: ${key}`, "error");
          document.getElementById(`cfg-${key}`)?.focus();
          return;
        }
        rows.push({ chave: key, valor: value, tipo: type });
      }
    }

    button.disabled = true;
    button.textContent = "Salvando…";

    const { error } = await db.from("configuracoes_site").upsert(rows, { onConflict: "chave" });
    if (error) toast(error.message, "error");
    else toast("Configurações publicadas. O site refletirá as mudanças ao recarregar.");

    button.disabled = false;
    button.textContent = "Salvar configurações";
  },
  true,
);
