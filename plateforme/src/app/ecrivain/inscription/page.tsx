import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, Field, SelectField } from "@/components/ActionForm";
import { AuthShell } from "@/components/AuthShell";
import { PageFallback } from "@/components/PageFallback";
import { ParishPicker } from "@/components/ParishPicker";
import { COUNTRIES, countryName } from "@/lib/countries";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { partnerCodesRequired } from "@/lib/partner-codes";
import { signupWriter } from "@/app/actions/partner-signup";

export const metadata = { title: "Espace écrivain — CCC" };

export default function WriterSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ acces?: string }>;
}) {
  return (
    <Suspense fallback={<PageFallback />}>
      <WriterSignupContent searchParams={searchParams} />
    </Suspense>
  );
}

async function WriterSignupContent({ searchParams }: { searchParams: Promise<{ acces?: string }> }) {
  const lang = await getLang();
  const gated = partnerCodesRequired();
  const denied = (await searchParams).acces === "refuse";
  // Un compte deja connecte mais non approuve ne doit pas voir un formulaire d'inscription :
  // son adresse existe deja et la soumission echouerait. On explique la situation a la place.
  const user = denied ? await getCurrentUser() : null;
  const dioceses = await db.diocese.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      parishes: {
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, city: true },
      },
    },
  });

  return (
    <AuthShell
      lang={lang}
      title={t(lang, "part.signupTitle")}
      subtitle={t(lang, "part.signupSub")}
      footer={
        <>
          {t(lang, "auth.haveAccount")}{" "}
          <Link href="/connexion" className="font-semibold text-brand underline-offset-4 hover:underline">
            {t(lang, "auth.login")}
          </Link>
          <span className="mt-3 block text-xs">
            <Link href="/inscription" className="font-semibold text-brand underline-offset-4 hover:underline">
              {t(lang, "part.standardSignup")}
            </Link>
          </span>
        </>
      }
    >
      {user ? (
        <div className="flex flex-col gap-4">
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-relaxed text-red-700 ring-1 ring-red-200">
            {t(lang, "part.accessDenied")}
          </p>
          <p className="text-sm text-muted">
            {t(lang, "part.blockedBody", { email: user.email ?? user.name ?? "" })}
          </p>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-line px-4 text-sm font-medium hover:bg-brand/5"
          >
            {t(lang, "part.blockedBack")}
          </Link>
        </div>
      ) : (
        <>
      {denied && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-700 ring-1 ring-red-200">
          {t(lang, "part.accessDenied")}
        </p>
      )}
      <p className="rounded-xl bg-gold-soft/50 p-3 text-xs leading-relaxed text-muted ring-1 ring-line">
        {t(lang, gated ? "part.codeRequiredNote" : "part.codeDemoNote")}
      </p>
      <ActionForm action={signupWriter} lang={lang} submitLabel={t(lang, "part.submit")}>
        <Field label={t(lang, "auth.name")} name="name" />
        <Field label={t(lang, "auth.email")} name="email" type="email" />
        <Field label={t(lang, "auth.password")} name="password" type="password" hint={t(lang, "auth.passwordHint")} />
        <Field label={t(lang, "auth.passwordConfirm")} name="passwordConfirm" type="password" />
        <SelectField
          label={t(lang, "auth.country")}
          name="country"
          options={[
            { value: "", label: t(lang, "auth.chooseCountry") },
            ...COUNTRIES.map((c) => ({ value: c.code, label: countryName(c.code, lang) })),
          ]}
        />
        <ParishPicker
          dioceses={dioceses}
          labels={{
            diocese: t(lang, "auth.diocese"),
            parish: t(lang, "auth.parish"),
            chooseDiocese: t(lang, "auth.chooseDiocese"),
            chooseParish: t(lang, "auth.chooseParish"),
            chooseParishFirst: t(lang, "auth.chooseParishFirst"),
          }}
        />
        <label className="flex items-start gap-2.5 rounded-xl bg-gold-soft/50 p-3 text-xs leading-relaxed text-muted ring-1 ring-line">
          <input type="checkbox" name="parishConsent" required className="mt-0.5 size-4 shrink-0 accent-brand" />
          <span>{t(lang, "auth.consent")}</span>
        </label>
        <Field
          label={t(lang, "part.code")}
          name="partnerCode"
          required={gated}
          hint={t(lang, gated ? "part.codeHintRequired" : "part.codeHintDemo")}
        />
      </ActionForm>
        </>
      )}
    </AuthShell>
  );
}
