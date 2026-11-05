/**
 * Référentiel fourni par le client (réponse du 04/11/2026).
 *
 * Attention : cette liste est l'échantillon transmis par le client, pas le référentiel complet.
 * Il l'a lui-même qualifiée de « liste officielle à fournir ». Les entrées peuvent être
 * complétées ou corrigées depuis /admin/dioceses sans redéploiement.
 */
export type ParishSeed = { name: string; city: string | null };
export type DioceseSeed = { slug: string; name: string; country: string; parishes: ParishSeed[] };

export const DIOCESES: DioceseSeed[] = [
  {
    slug: "benin",
    name: "Diocèse Bénin",
    country: "BJ",
    parishes: [
      { name: "Paroisse Mont Sinaï", city: "Vodjè, Cotonou" },
      { name: "Paroisse Cadjèhoun", city: "Cotonou" },
      { name: "Paroisse Saint Samuel", city: "Hindé, Cotonou" },
      { name: "Paroisse Saint Michel de Tanto", city: "Tanto, Cotonou" },
    ],
  },
  {
    slug: "togo",
    name: "Diocèse Togo",
    country: "TG",
    parishes: [
      { name: "Paroisse Temple d'Israël", city: "Nyékonakpoè, Lomé" },
      { name: "Paroisse Elohim d'Israël", city: "Tsévié" },
      { name: "Paroisse Mahanaïm I", city: "Togblékopé" },
      // La ville n'a pas été précisée par le client : à compléter dans l'administration.
      { name: "Paroisse Saint Michel Archange", city: null },
    ],
  },
  {
    slug: "nigeria",
    name: "Diocèse Nigeria",
    country: "NG",
    parishes: [
      { name: "CCC National Headquarters", city: "Makoko, Lagos" },
      { name: "CCC International Headquarters", city: "Ikosi-Ketu, Lagos" },
      { name: "Celestial City – Imeko", city: "Imeko-Afon, État d'Ogun" },
      { name: "CCC Elisha Parish", city: "Lagos" },
    ],
  },
];
