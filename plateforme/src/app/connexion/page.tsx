import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, Field } from "@/components/ActionForm";
import { AuthShell } from "@/components/AuthShell";
import { PageFallback } from "@/components/PageFallback";
import { login } from "@/app/actions/auth";
import { t } from "@/lib/i18n";
import { getLang } from "@/lib/lang";

export const metadata = { title: "CCC" };

export default function LoginPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <LoginContent />
    </Suspense>
  );
}

async function LoginContent() {
  const lang = await getLang();
  return (
    <AuthShell
      lang={lang}
      title={t(lang, "auth.welcomeTitle")}
      subtitle={t(lang, "auth.welcomeSub")}
      footer={
        <>
          {t(lang, "auth.noAccount")}{" "}
          <Link href="/inscription" className="font-semibold text-brand underline-offset-4 hover:underline">
            {t(lang, "auth.signup")}
          </Link>
          <span className="mt-2 block">
            <Link href="/diocese/inscription" className="font-semibold text-brand underline-offset-4 hover:underline">
              {t(lang, "dio.loginLink")}
            </Link>
          </span>
        </>
      }
    >
      <ActionForm action={login} lang={lang} submitLabel={t(lang, "auth.submitLogin")}>
        <Field label={t(lang, "auth.email")} name="email" type="email" />
        <Field label={t(lang, "auth.password")} name="password" type="password" />
      </ActionForm>
    </AuthShell>
  );
}
