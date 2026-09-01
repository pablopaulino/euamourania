import { fetchPublicRows } from "./publicDataService.js";

export const APP_DOWNLOAD_PAGE_URL = "https://euamourania.com.br/app";
export const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=br.com.euamourania.app";

export const APP_DOWNLOAD_CONFIG = Object.freeze({
  googlePlayUrl: GOOGLE_PLAY_URL,
  appStoreUrl: "",
  appPageUrl: APP_DOWNLOAD_PAGE_URL
});

export async function getAppDownloadConfig() {
  const config = { ...APP_DOWNLOAD_CONFIG };
  try {
    const rows = await fetchPublicRows(
      "configuracoes_site",
      {
        select: "chave,valor",
        chave: "in.(link_google_play,link_app_store)"
      },
      { ttl: 300000, timeout: 5000 }
    );
    const values = Object.fromEntries(rows.map(item => [item.chave, item.valor || ""]));
    return {
      ...config,
      googlePlayUrl: values.link_google_play || config.googlePlayUrl,
      appStoreUrl: values.link_app_store || config.appStoreUrl
    };
  } catch {
    return config;
  }
}
