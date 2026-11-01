import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

/**
 * Stockage privé des fichiers de livres. Aujourd'hui : un dossier du serveur (hors de `public/`, donc jamais
 * servi directement). Pour changer d'hébergement (stockage objet, CDN…), seule cette fonction est à remplacer.
 */
const ROOT = process.env.STORAGE_DIR ?? join(process.cwd(), "storage");

export async function saveBookFile(fileKey: string, data: Buffer): Promise<void> {
  await mkdir(join(ROOT, "books"), { recursive: true });
  await writeFile(join(ROOT, "books", basename(fileKey)), data);
}

export async function readBookFile(fileKey: string): Promise<Buffer | null> {
  try {
    // basename : une clé ne peut jamais sortir du dossier des livres.
    return await readFile(join(ROOT, "books", basename(fileKey)));
  } catch {
    return null;
  }
}
