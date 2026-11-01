// Prépare les logos du site à partir du logo couleur d'origine (assetes/logo).
// Le fichier fourni a un damier « transparent » dessiné dans l'image : on le retire en
// estimant la transparence de chaque pixel (le logo est coloré, le damier est gris neutre).
//
//   npm run logos
//
// Produit : public/logo-color.png, public/logo-white.png, src/app/icon.png, src/app/apple-icon.png
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logoDir = join(root, "..", "assetes", "logo");
const source = join(logoDir, readdirSync(logoDir).find((n) => n.startsWith("Logo CCC avec croix")));

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const color = Buffer.alloc(width * height * 4);
const white = Buffer.alloc(width * height * 4);

for (let p = 0; p < width * height; p++) {
  const r = data[p * 3];
  const g = data[p * 3 + 1];
  const b = data[p * 3 + 2];
  const min = Math.min(r, g, b);
  const chroma = Math.max(r, g, b) - min;
  // Gris neutres du damier : chroma faible -> transparent. Contours : fondu entre la couleur et le blanc.
  const alpha = clamp((255 - min) / 235) * clamp((chroma - 12) / 30);
  const o = p * 4;
  if (alpha > 0) {
    const unmix = (c) => Math.round(clamp((c - (1 - alpha) * 255) / alpha, 0, 255));
    color[o] = unmix(r);
    color[o + 1] = unmix(g);
    color[o + 2] = unmix(b);
  }
  color[o + 3] = Math.round(alpha * 255);
  white[o] = white[o + 1] = white[o + 2] = 255;
  white[o + 3] = color[o + 3];
}

const raw = { raw: { width, height, channels: 4 } };
const pad = { top: 8, bottom: 8, left: 8, right: 8, background: { r: 0, g: 0, b: 0, alpha: 0 } };

const colorPng = await sharp(color, raw).trim().extend(pad).resize({ width: 900 }).png({ compressionLevel: 9 }).toBuffer();
const whitePng = await sharp(white, raw).trim().extend(pad).resize({ width: 900 }).png({ compressionLevel: 9 }).toBuffer();
await sharp(colorPng).toFile(join(root, "public", "logo-color.png"));
await sharp(whitePng).toFile(join(root, "public", "logo-white.png"));

// Icône de l'application : logo blanc sur carré bleu profond (comme dans la présentation de marque).
async function icon(size, radius, file) {
  const inner = Math.round(size * 0.78);
  const logo = await sharp(whitePng).resize({ width: inner, height: inner, fit: "inside" }).toBuffer();
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a56b8"/><stop offset="1" stop-color="#0a3d91"/></linearGradient></defs><rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/></svg>`,
  );
  await sharp(bg).composite([{ input: logo, gravity: "center" }]).png().toFile(join(root, "src", "app", file));
}
await icon(512, 112, "icon.png");
await icon(180, 0, "apple-icon.png");

const meta = await sharp(colorPng).metadata();
console.log(`Logos prêts (${meta.width}×${meta.height}) : public/logo-color.png, public/logo-white.png, icônes dans src/app/`);
