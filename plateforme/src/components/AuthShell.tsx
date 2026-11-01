/** Mise en page des écrans de connexion et d'inscription : panneau de marque + formulaire. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main className="grid flex-1 lg:grid-cols-2">
      <aside className="hero-bg relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-end lg:p-14">
        <div className="film-strip absolute inset-0 opacity-30" aria-hidden />
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Lire · Regarder · Transmettre</p>
          <p className="font-display mt-4 max-w-md text-4xl leading-tight font-semibold">
            Le savoir <em className="text-gold not-italic">prend vie</em>
          </p>
          <p className="mt-4 max-w-sm text-white/70">
            Votre bibliothèque et votre cinéma, toujours avec vous.
          </p>
        </div>
      </aside>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-semibold text-brand">{title}</h1>
          <p className="mt-1 mb-7 text-sm text-muted">{subtitle}</p>
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">{children}</div>
          <p className="mt-5 text-center text-sm text-muted">{footer}</p>
        </div>
      </div>
    </main>
  );
}
