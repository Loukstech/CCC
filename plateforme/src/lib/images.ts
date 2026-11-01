const STOCK = /^https:\/\/images\.(pexels|unsplash)\.com\//;

/** Photo de banque d'images (démo) : utilisable comme fond de bandeau, contrairement à une vraie couverture. */
export const isStockPhoto = (url: string | null | undefined): url is string => !!url && STOCK.test(url);

/** Version paysage d'une photo de banque d'images (le CDN Pexels redimensionne via ?w=&h=). */
export function backdropUrl(url: string | null | undefined, w = 1400, h = 800): string | null {
  if (!isStockPhoto(url)) return null;
  return url.replace(/([?&])h=\d+/, `$1h=${h}`).replace(/([?&])w=\d+/, `$1w=${w}`);
}
