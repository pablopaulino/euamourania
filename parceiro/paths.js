export const PARTNER_HOST = 'parceiros.euamourania.com.br';
export const onPartnerHost = location.hostname === PARTNER_HOST;

export function partnerPath(path = '') {
  const suffix = String(path).replace(/^\/+/, '');
  return onPartnerHost ? `/${suffix}` : `/parceiro${suffix ? `/${suffix}` : ''}`;
}

export function normalizePartnerLinks(root = document) {
  if (!onPartnerHost) return;
  root.querySelectorAll('a[href^="/parceiro"]').forEach(link => {
    const href = link.getAttribute('href');
    link.setAttribute('href', href.replace(/^\/parceiro(?=\/|$)/, '') || '/');
  });
}
