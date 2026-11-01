// Fabrique de courtes vidéos de démonstration (cartes-titres animées, originales, sans droits) avec FFmpeg.
//
//   npm run demo:videos        (nécessite FFmpeg sur votre PC ; les vidéos produites sont versionnées)
//
// Elles servent uniquement à montrer le lecteur : ce ne sont pas de vraies œuvres.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "demo-video");

const FONT_CANDIDATES = [
  "C:/Windows/Fonts/arial.ttf",
  "/Library/Fonts/Arial.ttf",
  "/System/Library/Fonts/Supplemental/Arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
];
const font = FONT_CANDIDATES.find((f) => existsSync(f));
if (!font) throw new Error("Aucune police trouvée pour écrire les titres.");

const SECONDS = 24;
const CLIPS = [
  { slug: "exemple-documentaire", title: "Aux sources de la foi", color: "0x0a3d91" },
  { slug: "demo-documentaire-histoire", title: "Mémoire et héritage de l’Église", color: "0x0e5a73" },
  { slug: "demo-documentaire-gratuit", title: "Visages de la communauté", color: "0x14407a" },
  { slug: "demo-documentaire-chants", title: "Chants de louange", color: "0x0d4a66" },
  { slug: "demo-film-1", title: "Le berger et la lumière", color: "0x1b1b3a" },
  { slug: "demo-film-2", title: "Le retour du fils", color: "0x2a2f6e" },
  { slug: "demo-film-3", title: "La route de l’espérance", color: "0x1d2a4f" },
  { slug: "demo-film-4", title: "Veillée de nuit", color: "0x101a33" },
];

mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "ccc-video-"));
copyFileSync(font, join(work, "font.ttf"));

try {
  for (const clip of CLIPS) {
    writeFileSync(join(work, "title.txt"), clip.title, "utf8");
    writeFileSync(join(work, "sub.txt"), "Vidéo de démonstration", "utf8");
    const text = (file, size, y, extra = "") =>
      `drawtext=fontfile=font.ttf:textfile=${file}:fontcolor=white:fontsize=${size}:x=(w-text_w)/2:y=${y}${extra}`;
    const filter = [
      `fade=t=in:st=0:d=1`,
      text("title.txt", 34, "(h-text_h)/2-24", ":alpha='min(1,t/1.2)'"),
      text("sub.txt", 18, "(h/2)+24", ":fontcolor=0xd4a017"),
      "drawtext=fontfile=font.ttf:text='%{pts\\:hms}':fontcolor=white@0.7:fontsize=16:x=16:y=h-30",
    ].join(",");
    const out = join(outDir, `${clip.slug}.mp4`);
    const res = spawnSync(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", `color=c=${clip.color}:s=640x360:d=${SECONDS}:r=24`,
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-t", String(SECONDS), "-vf", filter,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "30", "-preset", "veryfast",
        "-c:a", "aac", "-b:a", "48k", "-shortest", "-movflags", "+faststart",
        out,
      ],
      { cwd: work, encoding: "utf8" },
    );
    if (res.status !== 0) throw new Error(`FFmpeg a échoué pour ${clip.slug} : ${res.stderr || res.error}`);
    console.log(`Vidéo de démonstration : ${clip.slug}.mp4`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
