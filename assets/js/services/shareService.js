export function absoluteUrl(pathOrUrl = location.href) {
  try {
    return new URL(pathOrUrl, location.origin).href;
  } catch {
    return location.href;
  }
}

export async function sharePage({ title = document.title, text = "", url = location.href } = {}) {
  const shareUrl = absoluteUrl(url);
  if (navigator.share) {
    await navigator.share({ title, text, url: shareUrl }).catch(() => null);
    return true;
  }
  await navigator.clipboard?.writeText(shareUrl).catch(() => null);
  return false;
}

export function whatsappShareUrl({ text = "", url = location.href } = {}) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(`${text}${text ? " " : ""}${absoluteUrl(url)}`)}`;
}

