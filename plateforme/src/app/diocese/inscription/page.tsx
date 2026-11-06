import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, Field, SelectField } from "@/components/ActionForm";
import { AuthShell } from "@/components/AuthShell";
import { PageFallback } from "@/components/PageFallback";
import { registerDioceseAccount } from "@/app/actions/dioceses";
import { db } from "@/lib/db";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import { partnerCodesRequired } from "@/lib/partner-codes";

export const metadata = { title: "Accès diocèse — CCC" };

export default function DioceseSignupPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <DioceseSignupContent />
    </Suspense>
  );
}

async function DioceseSignupContent() {
  const lang = await getLang();
  const gated = partnerCodesRequired();
  const dioceses = await db.diocese.findMany({
    where: { active: true },
    orderBy: [{ country: "asc" }, { name: "asc" }],
    select: { id: true, name: true, country: true },
  });

  return (
    <AuthShell
      lang={lang}
      title={t(lang, "dio.title")}
      subtitle={t(lang, "dio.subtitle")}
      footer={
        <>
          {t(lang, "dio.haveAccount")}{" "}
          <Link href="/connexion" className="font-semibold text-brand underline-offset-4 hover:underline">
            {t(lang, "dio.signIn")}
          </Link>
        </>
      }
    >
      {dioceses.length === 0 ? (
        <p className="text-sm text-muted">{t(lang, "dio.empty")}</p>
      ) : (
        <ActionForm action={registerDioceseAccount} lang={lang} submitLabel={t(lang, "dio.submit")}>
          <p className="rounded-xl bg-gold-soft/50 p-3 text-xs leading-relaxed text-muted ring-1 ring-line">
            {t(lang, gated ? "part.codeRequiredNote" : "part.codeDemoNote")}
          </p>
          <SelectField
            label={t(lang, "dio.diocese")}
            name="dioceseId"
            options={dioceses.map((d) => ({ value: d.id, label: `${d.name} (${d.country})` }))}
          />
          <Field label={t(lang, "dio.name")} name="name" />
          <Field label={t(lang, "auth.email")} name="email" type="email" />
          <Field label={t(lang, "auth.password")} name="password" type="password" />
          <Field label={t(lang, "auth.passwordConfirm")} name="passwordConfirm" type="password" />
          <Field
            label={t(lang, "part.code")}
            name="partnerCode"
            required={gated}
            hint={t(lang, gated ? "part.codeHintRequired" : "part.codeHintDemo")}
          />
        </ActionForm>
      )}
    </AuthShell>
  );
}
