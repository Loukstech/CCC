import Link from "next/link";
import { ActionForm, Field } from "@/components/ActionForm";
import { login } from "@/app/actions/auth";

export const metadata = { title: "Connexion — CCC" };

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold text-[#14213D]">Connexion</h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-6">
        <ActionForm action={login} submitLabel="Se connecter">
          <Field label="Adresse e-mail" name="email" type="email" />
          <Field label="Mot de passe" name="password" type="password" />
        </ActionForm>
      </div>
      <p className="mt-4 text-center text-sm text-zinc-600">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="font-semibold text-[#14213D] underline">
          Créer un compte
        </Link>
      </p>
    </main>
  );
}
