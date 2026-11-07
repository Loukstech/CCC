"use client";

import { useState, type FormEvent } from "react";
import { inputClass } from "@/components/ActionForm";
import { t, type Lang } from "@/lib/i18n";

type Subject = { value: string; label: string };

/**
 * Formulaire de contact sans backend : il compose un `mailto:` prérempli et ouvre la messagerie
 * du visiteur. Avantage pour cette démo (hébergée sur Vercel, sans service d'e-mail) : aucun
 * message n'est perdu dans un log éphémère et aucune donnée n'est transmise à un tiers.
 * Pour un vrai accusé de réception serveur, il faudra brancher un service d'envoi ou une table
 * de messages + une boîte de réception dans /admin.
 */
export function ContactForm({
  lang,
  to,
  subjects,
}: {
  lang: Lang;
  to: string;
  subjects: Subject[];
}) {
  const [opened, setOpened] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const from = String(data.get("email") ?? "").trim();
    const subjectValue = String(data.get("subject") ?? "");
    const message = String(data.get("message") ?? "").trim();
    const label = subjects.find((s) => s.value === subjectValue)?.label ?? subjectValue;
    const body = [`Nom / Name : ${name}`, `E-mail : ${from}`, `Sujet / Subject : ${label}`, "", message].join("\n");
    const href = `mailto:${to}?subject=${encodeURIComponent(`[CCC] ${label} — ${name}`)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setOpened(true);
  }

  const labelClass = "flex flex-col gap-1 text-sm font-medium text-ink";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className={labelClass}>
        <span>{t(lang, "contact.name")}</span>
        <input name="name" type="text" autoComplete="name" required maxLength={80} className={inputClass} />
      </label>
      <label className={labelClass}>
        <span>{t(lang, "contact.email")}</span>
        <input name="email" type="email" autoComplete="email" required maxLength={160} className={inputClass} />
      </label>
      <label className={labelClass}>
        <span>{t(lang, "contact.subject")}</span>
        <select name="subject" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            {t(lang, "contact.subjectChoose")}
          </option>
          {subjects.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        <span>{t(lang, "contact.message")}</span>
        <textarea
          name="message"
          required
          rows={5}
          maxLength={2000}
          className={`${inputClass} h-auto py-3 leading-relaxed`}
        />
        <span className="text-xs font-normal text-muted">{t(lang, "contact.messageHint")}</span>
      </label>
      <button type="submit" className="btn btn-brand h-11 self-start">
        {t(lang, "contact.send")}
      </button>
      <p className="text-xs leading-relaxed text-muted">{t(lang, "contact.formLead")}</p>
      <p className="text-xs leading-relaxed text-muted">{t(lang, "contact.privacy")}</p>
      {opened && (
        <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800">
          {t(lang, "contact.mailtoNote", { email: to })}
        </p>
      )}
    </form>
  );
}
