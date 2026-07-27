const STORAGE_OBJECT_PUBLIC = "/storage/v1/object/public/";
const STORAGE_RENDER_PUBLIC = "/storage/v1/render/image/public/";

export function responsiveImage(value = "", options = {}) {
  if (!value) return "";
  let url;
  try {
    url = new URL(value, location.origin);
  } catch {
    return value;
  }

  if (!url.pathname.includes(STORAGE_OBJECT_PUBLIC)) {
    return url.href;
  }

  url.pathname = url.pathname.replace(STORAGE_OBJECT_PUBLIC, STORAGE_RENDER_PUBLIC);
  const width = Number(options.width || 0);
  const height = Number(options.height || 0);
  const quality = Number(options.quality || 0);
  if (width > 0) url.searchParams.set("width", String(width));
  if (height > 0) url.searchParams.set("height", String(height));
  if (quality > 0) url.searchParams.set("quality", String(Math.max(45, Math.min(90, quality))));
  url.searchParams.set("resize", options.resize || "cover");
  return url.href;
}
