/**
 * Lecture à voix haute : synthèse vocale intégrée au navigateur.
 *
 * Aucun service payant n'est appelé. Chrome et Edge installent gratuitement des voix neuronales
 * (« Google … » et « Microsoft … Natural ») ; Safari et Firefox fournissent les voix du système.
 * Ce module classe les voix disponibles pour retenir la plus naturelle dans la langue du livre, et
 * laisse le lecteur en choisir une autre.
 *
 * Attention : les navigateurs remplissent la liste des voix de façon asynchrone (liste vide au
 * premier instant, puis événement « voiceschanged »). Il faut donc attendre, pas lire une seule fois.
 */

const NATURAL = /(natural|neural|premium|enhanced|wavenet|studio)/i;
const GOOGLE = /google/i;
const ONLINE = /online/i;

export type VoiceChoice = {
  voice: SpeechSynthesisVoice;
  /** Voix neuronale ou de synthèse moderne : le rendu est nettement plus naturel. */
  natural: boolean;
  label: string;
};

/** La synthèse vocale existe-t-elle dans ce navigateur ? */
export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

/**
 * Région attendue pour la langue du livre. L'anglais visé est celui de l'Afrique de l'Ouest,
 * donc britannique : les voix « Google UK English » et « Microsoft … (United Kingdom) » sont préférées.
 */
export function localeFor(bookLanguage: string): string {
  const l = bookLanguage.toLowerCase();
  if (l.startsWith("en")) return "en-gb";
  if (l.startsWith("es")) return "es-es";
  if (l.startsWith("pt")) return "pt-pt";
  return "fr-fr";
}

const normalize = (tag: string) => tag.toLowerCase().replace("_", "-");

/** Note une voix pour la langue visée ; -1 si elle ne parle pas cette langue. */
function score(voice: SpeechSynthesisVoice, locale: string): number {
  const lang = normalize(voice.lang);
  const base = locale.split("-")[0];
  if (!lang.startsWith(base)) return -1;

  let s = lang === locale ? 45 : 30;
  if (NATURAL.test(voice.name)) s += 55;
  if (GOOGLE.test(voice.name)) s += 35;
  if (ONLINE.test(voice.name)) s += 10;
  if (!voice.localService) s += 20; // voix réseau : bien plus naturelles que la synthèse locale
  if (voice.default) s += 5;
  return s;
}

export function voiceLabel(voice: SpeechSynthesisVoice): string {
  return `${voice.name} (${voice.lang})`;
}

/** Voix compatibles avec la langue du livre, la plus naturelle d'abord. */
export function rankVoices(voices: SpeechSynthesisVoice[], bookLanguage: string): VoiceChoice[] {
  const locale = localeFor(bookLanguage);
  return voices
    .map((voice) => ({ voice, points: score(voice, locale) }))
    .filter((v) => v.points >= 0)
    .sort((a, b) => b.points - a.points)
    .map(({ voice }) => ({
      voice,
      natural: NATURAL.test(voice.name) || GOOGLE.test(voice.name) || !voice.localService,
      label: voiceLabel(voice),
    }));
}

/**
 * Liste des voix, en attendant que le navigateur l'ait remplie.
 * Résout une liste vide si l'appareil n'a aucune voix (certains Linux sans speech-dispatcher).
 */
export function loadVoices(timeoutMs = 2500): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", finish);
    setTimeout(finish, timeoutMs);
  });
}
