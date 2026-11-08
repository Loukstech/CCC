"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Pages à grand visuel en tête : l'en-tête flotte transparent par-dessus l'image. */
const isOverlayRoute = (path: string) =>
  path === "/" || path === "/livres" || path === "/films" || path === "/documentaires" || path.startsWith("/oeuvres/");

/**
 * Coque de l'en-tête. L'état « flottant » vient de la route (et non de la présence d'un élément dans la
 * page : Next garde en mémoire les pages déjà visitées). Dès que l'on défile, il prend un fond plein.
 */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [pathname]);

  return (
    <header
      className="site-header ccc-site-chrome"
      data-overlay={isOverlayRoute(pathname) ? "" : undefined}
      data-scrolled={scrolled ? "" : undefined}
    >
      {children}
    </header>
  );
}
