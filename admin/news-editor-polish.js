const app = document.getElementById("app-content");

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[char]));

const textOnly = (html = "") => {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return div.textContent?.replace(/\s+/g, " ").trim() || "";
};

const scoreStatus = (ok) => ok ? "ok" : "warn";

function field(form, name) {
  return form.elements?.[name] || null;
}

function value(form, name) {
  return field(form, name)?.value?.trim() || "";
}

function setCounter(input, max, label) {
  if (!input || input.dataset.counterReady) return;
  input.dataset.counterReady = "1";
  const counter = document.createElement("small");
  counter.className = "news-editor-counter";
  input.insertAdjacentElement("afterend", counter);
  const update = () => {
    const length = input.value.length;
    counter.textContent = `${label}: ${length}${max ? `/${max}` : ""}`;
    counter.classList.toggle("is-over", Boolean(max && length > max));
  };
  input.addEventListener("input", update);
  update();
}

function statusItem(label, ok, detail = "") {
  return `<li class="${scoreStatus(ok)}"><span>${ok ? "✓" : "!"}</span><div><strong>${esc(label)}</strong>${detail ? `<small>${esc(detail)}</small>` : ""}</div></li>`;
}

function articlePreview(form) {
  const title = value(form, "titulo") || "Título da notícia";
  const subtitle = value(form, "subtitulo");
  const summary = value(form, "resumo");
  const image = value(form, "imagem_url");
  const category = field(form, "categoria_id")?.selectedOptions?.[0]?.textContent?.trim() || "Notícias";
  const author = value(form, "autor") || "Eu Amo Urânia";
  const contentText = textOnly(window.euamouraniaEditor?.root?.innerHTML || document.querySelector("#editor .ql-editor")?.innerHTML || "");
  const words = contentText ? contentText.split(/\s+/).length : 0;

  return `<article class="news-editor-preview-card">
    <p class="eyebrow">${esc(category)}</p>
    <h1>${esc(title)}</h1>
    ${subtitle ? `<p class="preview-subtitle">${esc(subtitle)}</p>` : summary ? `<p class="preview-subtitle">${esc(summary)}</p>` : ""}
    ${image ? `<img src="${esc(image)}" alt="">` : `<div class="news-editor-image-empty">Imagem principal</div>`}
    <div class="preview-meta">Por ${esc(author)} · ${Math.max(1, Math.ceil(words / 220))} min de leitura</div>
  </article>`;
}

function updateAssistant(form) {
  const title = value(form, "titulo");
  const slug = value(form, "slug");
  const summary = value(form, "resumo");
  const image = value(form, "imagem_url");
  const seoTitle = value(form, "seo_titulo") || title;
  const seoDescription = value(form, "seo_descricao") || summary;
  const contentText = textOnly(window.euamouraniaEditor?.root?.innerHTML || document.querySelector("#editor .ql-editor")?.innerHTML || "");
  const words = contentText ? contentText.split(/\s+/).length : 0;
  const publicationDate = value(form, "publicacao_data");
  const publicationTime = value(form, "publicacao_hora");

  const assistant = form.querySelector("[data-news-editor-assistant]");
  if (!assistant) return;

  assistant.innerHTML = `
    <section class="news-editor-side-card">
      <span>Prévia rápida</span>
      ${articlePreview(form)}
    </section>
    <section class="news-editor-side-card">
      <span>Checklist editorial</span>
      <ul class="news-editor-checklist">
        ${statusItem("Título preenchido", title.length >= 12, "Tente ser claro e específico.")}
        ${statusItem("Slug amigável", slug.length >= 4 && !/\s/.test(slug), "Usado na URL pública.")}
        ${statusItem("Resumo curto", summary.length >= 60 && summary.length <= 300, "Ideal entre 60 e 300 caracteres.")}
        ${statusItem("Imagem principal", Boolean(image), "Ajuda SEO, WhatsApp e leitura.")}
        ${statusItem("Texto da matéria", words >= 80, `${words} palavra(s) no conteúdo.`)}
        ${statusItem("Publicação definida", Boolean(publicationDate && publicationTime), "Controla a ordem pública da notícia.")}
      </ul>
    </section>
    <section class="news-editor-side-card">
      <span>SEO e compartilhamento</span>
      <ul class="news-editor-checklist">
        ${statusItem("Título SEO", seoTitle.length >= 25 && seoTitle.length <= 70, `${seoTitle.length}/70 caracteres.`)}
        ${statusItem("Descrição SEO", seoDescription.length >= 80 && seoDescription.length <= 160, `${seoDescription.length}/160 caracteres.`)}
        ${statusItem("Imagem social", Boolean(value(form, "seo_imagem") || image), "Se vazio, a imagem principal será usada.")}
      </ul>
    </section>
  `;
}

function enhanceNewsForm(form) {
  if (!form || form.dataset.newsEditorPolished) return;
  if (!form.elements?.publicacao_data && !form.dataset.publicationFields) {
    window.setTimeout(() => enhanceNewsForm(form), 120);
    return;
  }
  form.dataset.newsEditorPolished = "1";
  form.classList.add("news-editor-pro");
  form.closest(".panel")?.classList.add("news-editor-panel");

  const intro = document.createElement("div");
  intro.className = "news-editor-intro";
  intro.innerHTML = `<div>
    <p class="eyebrow">Redação Eu Amo Urânia</p>
    <h2>Editor profissional de notícia</h2>
    <p>Escreva, revise SEO, escolha imagens e acompanhe se a matéria está pronta para publicação.</p>
  </div>
  <div class="news-editor-quicktips">
    <span>Ctrl+B: negrito</span>
    <span>Use subtítulos</span>
    <span>Resumo ajuda o Google</span>
  </div>`;
  form.prepend(intro);

  const body = document.createElement("div");
  body.className = "news-editor-workspace";
  const assistant = document.createElement("aside");
  assistant.className = "news-editor-assistant";
  assistant.dataset.newsEditorAssistant = "1";

  const sections = [...form.querySelectorAll(".cms-form-section")];
  if (sections.length) {
    const first = sections[0];
    first.before(body);
    sections.forEach((section) => body.append(section));
    body.append(assistant);
  }

  setCounter(field(form, "titulo"), 180, "Título");
  setCounter(field(form, "subtitulo"), 180, "Subtítulo");
  setCounter(field(form, "resumo"), 300, "Resumo");
  setCounter(field(form, "seo_titulo"), 70, "SEO title");
  setCounter(field(form, "seo_descricao"), 160, "SEO description");

  const editorBox = form.querySelector("#editor");
  if (editorBox) {
    editorBox.closest(".cms-form-section")?.classList.add("news-editor-content-section");
    setTimeout(() => {
      const editor = window.Quill?.find?.(editorBox);
      if (editor) window.euamouraniaEditor = editor;
      editor?.root?.setAttribute("data-placeholder", "Escreva a matéria aqui. Use subtítulos, listas, citações, imagens e vídeos quando fizer sentido.");
      editor?.on?.("text-change", () => updateAssistant(form));
      updateAssistant(form);
    }, 120);
  }

  form.addEventListener("input", () => updateAssistant(form));
  form.addEventListener("change", () => updateAssistant(form));
  updateAssistant(form);
}

const observer = new MutationObserver(() => {
  const form = app?.querySelector("#news-form");
  if (form) enhanceNewsForm(form);
});

if (app) {
  observer.observe(app, { childList: true, subtree: true });
  enhanceNewsForm(app.querySelector("#news-form"));
}
