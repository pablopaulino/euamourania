const URL = "https://omhcpbphvtihqwdkbsbf.supabase.co";
const KEY = "sb_publishable_m02B2sC8Ddh4fCtnvsGePg_TqwUanoM";
const PIXEL = Buffer.from("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=", "base64");
const uuidRe = /^[0-9a-f-]{36}$/i;

async function registerEvent(req, tipo) {
  const c = String(req.query.c || "");
  const t = String(req.query.t || "");
  if (!uuidRe.test(c) || !uuidRe.test(t)) return;
  await fetch(`${URL}/rest/v1/rpc/registrar_evento_newsletter`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_newsletter: c, p_token: t, p_tipo: tipo })
  }).catch(() => {});
}

function safeRedirectTarget(value) {
  try {
    const url = new URL(String(value || ""));
    if (["http:", "https:"].includes(url.protocol)) return url.href;
  } catch {}
  return "https://euamourania.com.br";
}

module.exports = async (req, res) => {
  const event = String(req.query.event || "");

  if (event === "click") {
    await registerEvent(req, "clique");
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, safeRedirectTarget(req.query.url));
  }

  await registerEvent(req, "abertura");
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).send(PIXEL);
};
