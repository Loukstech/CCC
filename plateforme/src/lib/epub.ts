import "server-only";
import JSZip from "jszip";

export const MAX_EPUB_BYTES = 50 * 1024 * 1024;

export type EpubError = "vide" | "taille" | "format" | "illisible";

export const EPUB_ERROR_TEXT: Record<EpubError, string> = {
  vide: "Le fichier est vide.",
  taille: "Le fichier dépasse 50 Mo.",
  format: "Ce n’est pas un fichier EPUB valide.",
  illisible: "Le fichier EPUB est illisible ou abîmé.",
};

/** Contrôle qu'un fichier envoyé est bien un EPUB (archive ZIP avec `mimetype` et `container.xml`). */
export async function validateEpub(data: Buffer): Promise<EpubError | null> {
  if (data.length === 0) return "vide";
  if (data.length > MAX_EPUB_BYTES) return "taille";
  if (data[0] !== 0x50 || data[1] !== 0x4b) return "format"; // signature « PK » d'un ZIP
  try {
    const zip = await JSZip.loadAsync(data);
    const mimetype = await zip.file("mimetype")?.async("string");
    if (mimetype?.trim() !== "application/epub+zip") return "format";
    if (!zip.file("META-INF/container.xml")) return "format";
    return null;
  } catch {
    return "illisible";
  }
}
