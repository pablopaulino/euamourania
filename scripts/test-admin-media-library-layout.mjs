import { readFile } from "node:fs/promises";

const css = await readFile(new URL("../admin/media-upload.css", import.meta.url), "utf8");
const js = await readFile(new URL("../admin/media-upload.js", import.meta.url), "utf8");
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};

must(css.includes(".cms-library-picker .cms-library-picker-grid") && css.includes("display:flex!important"), "Seletor de biblioteca precisa usar flex explícito para impedir sobreposição.");
must(css.includes("flex-wrap:wrap!important"), "Seletor de biblioteca precisa quebrar cards em linhas reais.");
must(css.includes(".cms-library-picker .cms-library-picker-card") && css.includes("flex:0 1 calc(25% - .75rem)!important"), "Cards da biblioteca precisam ter largura responsiva estável.");
must(css.includes("min-height:342px!important"), "Cards da biblioteca precisam reservar altura mínima para imagem, informações e ações.");
must(css.includes(".cms-library-picker-card>img") && css.includes("height:150px!important"), "Imagens da biblioteca precisam ter altura fixa para evitar sobreposição.");
must(css.includes(".cms-library-picker-card[hidden]{display:none!important}"), "Filtro da biblioteca precisa esconder cards sem quebrar a grade.");
must(css.includes(".cms-library-card-actions{display:grid;grid-template-columns:1fr 1fr"), "Ações dos cards precisam permanecer alinhadas.");
must(css.includes(".media-library-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))"), "Página principal de mídia precisa usar grid responsivo.");
must(js.includes("openLibraryPicker") && js.includes("cms-library-picker-grid"), "Seletor de biblioteca precisa continuar renderizando o grid esperado.");
must(js.includes("close(item.url)") && js.includes("data-library-use"), "Seleção de imagem precisa fechar o modal após escolher.");

console.log("Layout da biblioteca de mídia validado: grid, cards, imagens e seleção estáveis.");
