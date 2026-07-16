const DEFAULT_ALLOWED_TAGS = [
  "A",
  "B",
  "BLOCKQUOTE",
  "BR",
  "EM",
  "FIGCAPTION",
  "FIGURE",
  "H2",
  "H3",
  "H4",
  "HR",
  "I",
  "IMG",
  "LI",
  "OL",
  "P",
  "STRONG",
  "U",
  "UL",
];

const DEFAULT_ALLOWED_ATTRS = [
  "alt",
  "height",
  "href",
  "loading",
  "rel",
  "src",
  "target",
  "title",
  "width",
];

const BLOCKED_SELECTOR = "script,style,object,embed,form,input,button,textarea,select,link,meta";

function isSafeUrl(value = "", { image = false } = {}) {
  if (!value) return false;
  const url = String(value).trim();
  if (/^javascript:/i.test(url) || /^data:/i.test(url)) return false;
  if (image) return /^(https?:|\/?assets\/|\/uploads\/|\/storage\/)/i.test(url);
  return /^(https?:|mailto:|tel:|\/|#)/i.test(url);
}

export function sanitizeHtml(value = "", options = {}) {
  const allowedTags = new Set(options.allowedTags || DEFAULT_ALLOWED_TAGS);
  const allowedAttrs = new Set(options.allowedAttrs || DEFAULT_ALLOWED_ATTRS);
  const allowedIframeSources = options.allowedIframeSources || [];
  const html = String(value || "");
  const parsed = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = parsed.body.firstElementChild;
  if (!root) return "";

  root.querySelectorAll(BLOCKED_SELECTOR).forEach((node) => node.remove());
  root.querySelectorAll("*").forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }

    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (/^on/i.test(name) || !allowedAttrs.has(name)) {
        node.removeAttribute(attribute.name);
      }
    });

    if (node.tagName === "A") {
      const href = node.getAttribute("href") || "";
      if (!isSafeUrl(href)) node.removeAttribute("href");
      if (node.target === "_blank") node.rel = "noopener noreferrer";
    }

    if (node.tagName === "IMG") {
      const src = node.getAttribute("src") || "";
      if (!isSafeUrl(src, { image: true })) node.remove();
      else {
        node.loading = node.loading || "lazy";
        node.decoding = "async";
      }
    }

    if (node.tagName === "IFRAME") {
      const src = node.getAttribute("src") || "";
      const allowed = allowedIframeSources.some((pattern) => pattern.test(src));
      if (!allowed) node.remove();
      else node.loading = "lazy";
    }
  });

  return root.innerHTML;
}

export function sanitizeArticleHtml(value = "") {
  return sanitizeHtml(value, {
    allowedTags: [...DEFAULT_ALLOWED_TAGS, "IFRAME"],
    allowedAttrs: [...DEFAULT_ALLOWED_ATTRS, "allow", "allowfullscreen", "frameborder"],
    allowedIframeSources: [/^https:\/\/(www\.)?(youtube(-nocookie)?\.com|player\.vimeo\.com)\//i],
  });
}

export function sanitizeInstitutionalHtml(value = "") {
  return sanitizeHtml(value, {
    allowedTags: DEFAULT_ALLOWED_TAGS.filter((tag) => tag !== "IMG"),
    allowedAttrs: DEFAULT_ALLOWED_ATTRS.filter((attr) => !["src", "alt", "width", "height", "loading"].includes(attr)),
  });
}
