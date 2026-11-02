"use client";

import { createContext, useActionState, useContext } from "react";
import type { FormState } from "@/lib/form";
import { t, type Lang } from "@/lib/i18n";

const ValuesContext = createContext<Record<string, string> | undefined>(undefined);

export function ActionForm({
  action,
  submitLabel,
  lang = "fr",
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  lang?: Lang;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ValuesContext value={state?.values}>{children}</ValuesContext>
      {state?.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-brand h-11 disabled:opacity-60"
      >
        {pending ? t(lang, "form.pending") : submitLabel}
      </button>
    </form>
  );
}

const inputClass =
  "h-11 rounded-xl border border-line bg-paper/50 px-3.5 text-base text-ink outline-none transition focus:border-brand-light focus:bg-surface focus:ring-4 focus:ring-brand-light/15";

export function Field({
  label,
  name,
  type = "text",
  required = true,
  hint,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
}) {
  const kept = useContext(ValuesContext);
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={kept?.[name] ?? defaultValue}
        className={inputClass}
      />
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
}) {
  const kept = useContext(ValuesContext);
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink">
      {label}
      <select name={name} defaultValue={kept?.[name]} className={inputClass}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckField({
  label,
  name,
  defaultChecked = false,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  const kept = useContext(ValuesContext);
  const checked = kept ? kept[name] === "on" : defaultChecked;
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" name={name} defaultChecked={checked} className="size-4 accent-brand" /> {label}
    </label>
  );
}

/** Plusieurs cases à cocher pour un même champ (ex. liste de pays). */
export function CheckGroup({
  label,
  name,
  options,
  defaultValues = [],
  hint,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValues?: string[];
  hint?: string;
}) {
  const kept = useContext(ValuesContext);
  const selected = new Set(kept ? (kept[name] ?? "").split(",").filter(Boolean) : defaultValues);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={o.value} defaultChecked={selected.has(o.value)} className="size-4 accent-brand" />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </fieldset>
  );
}
