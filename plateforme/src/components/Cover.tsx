import { TypeIcon } from "@/components/icons";
import { isStockPhoto } from "@/lib/images";

type WorkType = "BOOK" | "FILM" | "DOCUMENTARY";

const THEME: Record<WorkType, string> = {
  BOOK: "from-[#0a3d91] via-[#0d4cb5] to-[#061f4d]",
  FILM: "from-[#1b1b3a] via-[#2a2f6e] to-[#0b0f24]",
  DOCUMENTARY: "from-[#0e5a73] via-[#0a3d91] to-[#061f4d]",
};


/**
 * Affiche 2:3. Une vraie couverture est affichée telle quelle ; une photo de banque d'images
 * reçoit un voile et le titre ; sans image, une affiche aux couleurs de la marque est générée.
 */
export function Cover({
  type,
  title,
  author,
  coverUrl,
  className = "",
}: {
  type: WorkType;
  title: string;
  author?: string | null;
  coverUrl?: string | null;
  className?: string;
}) {
  const photo = isStockPhoto(coverUrl);
  return (
    <div
      className={`relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-gradient-to-br ${THEME[type]} ${className}`}
    >
      {photo && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
          <div
            className="absolute inset-0 bg-gradient-to-t from-brand-night via-brand-night/55 to-brand-deep/30"
            aria-hidden
          />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-[#f3d27a] to-gold" aria-hidden />
          <div className="relative flex h-full flex-col justify-between p-[7%] text-white">
            <TypeIcon type={type} className="size-[18%] min-w-6 text-gold" />
            <div>
              <p className="font-display text-[clamp(0.8rem,1.1vw+0.4rem,1.25rem)] leading-tight font-semibold text-balance">
                {title}
              </p>
              {author && (
                <p className="mt-2 text-[10px] tracking-wide text-white/75 uppercase sm:text-xs">{author}</p>
              )}
            </div>
          </div>
        </>
      )}
      {photo ? null : coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverUrl} alt={`Couverture : ${title}`} className="size-full object-cover" loading="lazy" />
      ) : (
        <>
          <div className="film-strip absolute inset-0 opacity-60" aria-hidden />
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold via-[#f3d27a] to-gold" aria-hidden />
          <div className="relative flex h-full flex-col justify-between p-[7%] text-white">
            <TypeIcon type={type} className="size-[18%] min-w-6 text-gold" />
            <div>
              <p className="font-display text-[clamp(0.8rem,1.1vw+0.4rem,1.25rem)] leading-tight font-semibold text-balance">
                {title}
              </p>
              {author && (
                <p className="mt-2 text-[10px] tracking-wide text-white/70 uppercase sm:text-xs">{author}</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
