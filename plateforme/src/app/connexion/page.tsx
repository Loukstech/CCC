import Link from "next/link";
import { ActionForm, Field } from "@/components/ActionForm";
import { AuthShell } from "@/components/AuthShell";
import { login } from "@/app/actions/auth";

export const metadata = { title: "Connexion — CCC" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Bon retour"
      subtitle="Connectez-vous pour retrouver votre bibliothèque."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href="/inscription" className="font-semibold text-brand underline-offset-4 hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <ActionForm action={login} submitLabel="Se connecter">
        <Field label="Adresse e-mail" name="email" type="email" />
        <Field label="Mot de passe" name="password" type="password" />
      </ActionForm>
    </AuthShell>
  );
}
