import type { MetadataRoute } from "next";

/** Site en préparation : on demande aux moteurs de recherche de ne pas l'indexer. À retirer au lancement. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
