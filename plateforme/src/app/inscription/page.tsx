import Link from "next/link";
import { ActionForm, Field } from "@/components/ActionForm";
import { signup } from "@/app/actions/auth";

export const metadata = { title: "Créer un compte — CCC" };

export default function SignupPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-[#14213D]">Créer un compte</h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <ActionForm action={signup} submitLabel="Créer mon compte">
          <Field label="Nom" name="name" />
          <Field label="Adresse e-mail" name="email" type="email" />
          <Field label="Mot de passe" name="password" type="password" hint="8 caractères au minimum." />
          <Field
            label="Pays"
            name="country"
            required={false}
            hint="Code à 2 lettres (BJ, TG, FR…). Sert à afficher les œuvres disponibles chez vous."
          />
        </ActionForm>
      </div>
      <p className="mt-4 text-center text-sm text-zinc-600">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className="font-semibold text-[#14213D] underline">
          Se connecter
        </Link>
      </p>
    </main>
  );
}
