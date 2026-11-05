export type FormState =
  | {
      error?: string;
      /** Message de réussite à afficher (ex. mot de passe provisoire d'un compte créé). */
      notice?: string;
      values?: Record<string, string>;
    }
  | undefined;

/** Valeurs saisies à réafficher après une erreur (jamais le mot de passe). */
export function keep(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}
