/** Note en étoiles. Purement visuelle : la valeur chiffrée est toujours affichée à côté. */
export function Stars({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className={`tracking-tight ${className}`} aria-hidden>
      <span className="text-gold">{"★".repeat(full)}</span>
      <span className="text-line">{"★".repeat(5 - full)}</span>
    </span>
  );
}
