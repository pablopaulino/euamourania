const VIDEO_URL_RE = /^(https?:\/\/).*(\.(mp4|webm|ogg|mov|m4v)(\?|#|$)|res\.cloudinary\.com\/[^/]+\/video\/upload\/)/i;

const esc = (value = "") => String(value ?? "").replace(/[&<>'"]/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&#39;",
  '"': "&quot;"
}[char]));

function getEditor(editorElement) {
  return window.euamouraniaEditor || window.Quill?.find?.(editorElement) || null;
}

function insertVideoBlock(editor, url, caption) {
  const label = caption || "Vídeo da matéria";
  const range = editor.getSelection(true);
  const index = range?.index ?? Math.max(0, editor.getLength() - 1);
  const html = `<p><a href="${esc(url)}" title="${esc(label)}">${esc(label)}</a></p>`;
  editor.clipboard.dangerouslyPasteHTML(index, html, "user");
  editor.setSelection(index + label.length + 1, 0, "silent");
}

function attachVideoCaptionHelper() {
  const form = document.getElementById("news-form");
  const editorElement = form?.querySelector("#editor");
  if (!form || !editorElement || editorElement.dataset.videoCaptionHelper) return;
  editorElement.dataset.videoCaptionHelper = "true";

  const helper = document.createElement("section");
  helper.className = "news-video-helper";
  helper.innerHTML = `
    <div>
      <span>Vídeo da matéria</span>
      <p>Cole o link do Cloudinary/MP4 e escreva a legenda que aparecerá abaixo do player no site.</p>
    </div>
    <label>
      Link do vídeo
      <input type="url" data-video-url placeholder="https://res.cloudinary.com/.../video.mp4">
    </label>
    <label>
      Legenda do vídeo
      <input type="text" data-video-caption maxlength="180" placeholder="Ex.: Vídeo mostra o momento da ação">
    </label>
    <button type="button" class="admin-button secondary" data-insert-video>Inserir vídeo na matéria</button>
    <small data-video-message></small>
  `;

  editorElement.insertAdjacentElement("afterend", helper);

  helper.querySelector("[data-insert-video]").addEventListener("click", () => {
    const urlInput = helper.querySelector("[data-video-url]");
    const captionInput = helper.querySelector("[data-video-caption]");
    const message = helper.querySelector("[data-video-message]");
    const url = urlInput.value.trim();
    const caption = captionInput.value.trim();
    const editor = getEditor(editorElement);

    if (!editor) {
      message.textContent = "O editor ainda não está pronto.";
      message.className = "error";
      return;
    }
    if (!VIDEO_URL_RE.test(url)) {
      message.textContent = "Informe um link de vídeo válido, como Cloudinary ou arquivo .mp4.";
      message.className = "error";
      urlInput.focus();
      return;
    }

    insertVideoBlock(editor, url, caption);
    urlInput.value = "";
    captionInput.value = "";
    message.textContent = "Vídeo inserido. A legenda poderá ser editada diretamente no texto ou reinserida por aqui.";
    message.className = "success";
    form.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const observer = new MutationObserver(attachVideoCaptionHelper);
observer.observe(document.body, { childList: true, subtree: true });
attachVideoCaptionHelper();
