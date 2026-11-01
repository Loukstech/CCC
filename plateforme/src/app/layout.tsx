import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Fraunces, Geist } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { ThemeSegment } from "@/components/ThemeToggle";
import { Header } from "@/components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CCC — Le savoir prend vie",
  description:
    "Lire des livres, regarder des documentaires et des films, même hors connexion.",
  // Site en préparation : pas d'indexation (à retirer au lancement, avec src/app/robots.ts).
  robots: { index: false, follow: false },
};

// Pose le thème (choix enregistré, sinon thème de l'appareil) avant le premier affichage : pas de clignotement.
const THEME_SCRIPT = `try{var m=localStorage.getItem("ccc-theme");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body suppressHydrationWarning className="flex min-h-full flex-col bg-paper text-ink">
        <Suspense fallback={null}>
          <Header />
        </Suspense>
        <div className="flex flex-1 flex-col pb-16 md:pb-0">{children}</div>
        <Suspense fallback={null}>
          <BottomNav />
        </Suspense>
        <footer className="bg-brand-night text-white/70">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-5 sm:py-12 md:grid-cols-[1.4fr_1fr_1fr] md:gap-10">
            <div>
              <Image
                src="/logo-white.png"
                alt="CCC — Le savoir prend vie"
                width={916}
                height={582}
                className="h-20 w-auto"
              />
              <p className="mt-4 max-w-sm text-sm leading-relaxed">
                Lire des livres, regarder des documentaires et des films, où que vous soyez, même hors connexion.
              </p>
            </div>
            <nav aria-label="Explorer">
              <p className="text-sm font-semibold text-white">Explorer</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/livres" className="hover:text-gold">Livres</Link></li>
                <li><Link href="/documentaires" className="hover:text-gold">Documentaires</Link></li>
                <li><Link href="/films" className="hover:text-gold">Films</Link></li>
                <li><Link href="/recherche" className="hover:text-gold">Recherche</Link></li>
              </ul>
            </nav>
            <nav aria-label="Mon compte">
              <p className="text-sm font-semibold text-white">Mon compte</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link href="/connexion" className="hover:text-gold">Connexion</Link></li>
                <li><Link href="/inscription" className="hover:text-gold">Créer un compte</Link></li>
              </ul>
            </nav>
            <div className="md:col-span-3">
              <p className="mb-2 text-sm font-semibold text-white">Affichage</p>
              <ThemeSegment />
            </div>
          </div>
          <div className="border-t border-white/10">
            <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-white/50 sm:px-5">
              © CCC — Lire · Regarder · Transmettre — version de démonstration · Photos d’illustration :{" "}
              <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gold">
                Pexels
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
