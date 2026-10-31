import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CCC — Le savoir prend vie",
  description:
    "Lire des livres, regarder des documentaires et des films, même hors connexion.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <Header />
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-zinc-200 bg-white py-6 text-center text-xs text-zinc-500">
          CCC — version de démonstration
        </footer>
      </body>
    </html>
  );
}
