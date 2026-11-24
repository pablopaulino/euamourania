const media = "https://omhcpbphvtihqwdkbsbf.supabase.co/storage/v1/object/public/cms-media/";
const thumbnails = new Map([
  [media + "turismo/2026/07/e6fd7fe2-6faf-4b09-9c9e-6fded939b8ea.png", "/assets/card-images/igreja-matriz-sao-benedito.webp"],
  [media + "guia/2026/07/eda401d8-3afa-4019-8305-08f67976cd34.png", "/assets/card-images/moveis-santa-luzia.webp"]
]);

export function cardImage(value) {
  return thumbnails.get(value) ?? value;
}
