import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
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
