import type { Metadata } from "next";
import { Suspense } from "react";
import { Fraunces, Geist } from "next/font/google";
import { StickyAdLoader } from "@/components/StickyAdLoader";
import { BottomNavLoader } from "@/components/BottomNavLoader";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE, COPYRIGHT_YEAR } from "@/lib/site";
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
  applicationName: SITE.name,
  // Crédit développeur et copyright également lisibles par les machines (pas seulement le pied de page).
  authors: [{ name: SITE.developer }],
  creator: SITE.developer,
  other: { copyright: `© ${COPYRIGHT_YEAR} ${SITE.name} — Tous droits réservés.` },
  // Site en préparation : pas d'indexation (à retirer au lancement, avec src/app/robots.ts).
  robots: { index: false, follow: false },
};

// Pose le thème (choix enregistré, sinon thème de l'appareil) avant le premier affichage : pas de clignotement.
const THEME_SCRIPT = `try{var m=localStorage.getItem("ccc-theme");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";var c=document.cookie.match(/ccc_lang=(fr|en)/);document.documentElement.lang=c?c[1]:((navigator.language||"").toLowerCase().indexOf("en")===0?"en":"fr")}catch(e){}`;

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
          <StickyAdLoader />
        </Suspense>
        <Suspense fallback={null}>
          <BottomNavLoader />
        </Suspense>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </body>
    </html>
  );
}
