/** Photo plein cadre utilisée comme fond d'un bandeau (décorative : alt vide). */
export function Backdrop({ src, className = "" }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={`absolute inset-0 size-full object-cover ${className}`} />
  );
}
