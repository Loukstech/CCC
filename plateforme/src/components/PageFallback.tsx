/** Cadre affiché pendant que le contenu d'une page se charge (évite un saut de mise en page). */
export function PageFallback() {
  return (
    <main className="flex-1" aria-busy="true">
      <div className="hero-bg h-[26rem] sm:h-[32rem]" />
    </main>
  );
}
