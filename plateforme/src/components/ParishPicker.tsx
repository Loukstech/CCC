"use client";

import { useId, useState } from "react";
import { inputClass, useKeptValues } from "@/components/ActionForm";

export type ParishOption = { id: string; name: string; city: string | null };
export type DioceseOption = { id: string; name: string; parishes: ParishOption[] };

/**
 * Choix du diocèse puis de la paroisse. Le référentiel est petit (quelques dizaines de lignes) et
 * chargé avec la page : le filtrage se fait en mémoire, sans aller-retour serveur.
 *
 * Sans JavaScript, les deux listes restent soumises ensemble et la validation serveur vérifie que
 * la paroisse appartient bien au diocèse choisi.
 */
export function ParishPicker({
  dioceses,
  labels,
}: {
  dioceses: DioceseOption[];
  labels: {
    diocese: string;
    parish: string;
    chooseDiocese: string;
    chooseParish: string;
    chooseParishFirst: string;
  };
}) {
  const kept = useKeptValues();
  const [dioceseId, setDioceseId] = useState(kept?.dioceseId ?? "");
  const [parishId, setParishId] = useState(kept?.parishId ?? "");
  const parishHintId = useId();

  const parishes = dioceses.find((d) => d.id === dioceseId)?.parishes ?? [];

  return (
    <>
      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        {labels.diocese}
        <select
          name="dioceseId"
          value={dioceseId}
          onChange={(e) => {
            setDioceseId(e.target.value);
            setParishId(""); // une paroisse d'un autre diocèse n'a plus de sens
          }}
          required
          className={inputClass}
        >
          <option value="">{labels.chooseDiocese}</option>
          {dioceses.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium text-ink">
        {labels.parish}
        <select
          name="parishId"
          value={parishId}
          onChange={(e) => setParishId(e.target.value)}
          required
          disabled={!dioceseId}
          aria-describedby={parishHintId}
          className={inputClass}
        >
          <option value="">{labels.chooseParish}</option>
          {parishes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.city ? `${p.name} — ${p.city}` : p.name}
            </option>
          ))}
        </select>
        {!dioceseId && (
          <span id={parishHintId} className="text-xs font-normal text-muted">
            {labels.chooseParishFirst}
          </span>
        )}
      </label>
    </>
  );
}
