import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Next bloque en développement les ressources demandées depuis une origine autre que « localhost ».
  // Ouvert sur 127.0.0.1, le site s'affichait sans jamais s'hydrater : plus aucun composant client
  // (liste des paroisses, formulaires d'avis) ne réagissait. Sans effet en production.
  allowedDevOrigins: ["127.0.0.1"],
  // Les fichiers de livres sont lus sur disque par cette route : on les inclut dans la fonction déployée.
  outputFileTracingIncludes: {
    "/api/books/[workId]/file": ["./storage/books/**/*"],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
