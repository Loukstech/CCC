import Link from "next/link";
import { ActionForm, Field, SelectField } from "@/components/ActionForm";
import { COUNTRIES } from "@/lib/countries";
import { AuthShell } from "@/components/AuthShell";
import { signup } from "@/app/actions/auth";

export const metadata = { title: "Créer un compte — CCC" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Rejoindre CCC"
      subtitle="Un compte gratuit pour lire, regarder et télécharger."
      footer={
        <>
          Déjà inscrit ?{" "}
          <Link href="/connexion" className="font-semibold text-brand underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </>
      }
    >
      <ActionForm action={signup} submitLabel="Créer mon compte">
        <Field label="Nom" name="name" />
        <Field label="Adresse e-mail" name="email" type="email" />
        <Field label="Mot de passe" name="password" type="password" hint="8 caractères au minimum." />
        <SelectField
          label="Pays"
          name="country"
          options={[
            { value: "", label: "Choisir mon pays" },
            ...COUNTRIES.map((c) => ({ value: c.code, label: c.name })),
          ]}
        />
      </ActionForm>
    </AuthShell>
  );
}
