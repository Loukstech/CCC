"use client";

import { createContext, useActionState, useContext } from "react";
import type { FormState } from "@/lib/form";

const ValuesContext = createContext<Record<string, string> | undefined>(undefined);

export function ActionForm({
  action,
  submitLabel,
  children,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <ValuesContext value={state?.values}>{children}</ValuesContext>
      {state?.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-md bg-[#14213D] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1d3159] disabled:opacity-60"
      >
        {pending ? "Un instant…" : submitLabel}
      </button>
    </form>
  );
}

const inputClass =
  "h-11 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-[#14213D] focus:ring-2 focus:ring-[#14213D]/20";

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
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={kept?.[name] ?? defaultValue}
        className={inputClass}
      />
      {hint && <span className="text-xs font-normal text-zinc-500">{hint}</span>}
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
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-800">
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

export function CheckField({ label, name }: { label: string; name: string }) {
  const kept = useContext(ValuesContext);
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" name={name} defaultChecked={kept?.[name] === "on"} /> {label}
    </label>
  );
}
