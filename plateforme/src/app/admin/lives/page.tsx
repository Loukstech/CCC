import Link from "next/link";
import { Suspense } from "react";
import { ActionForm, Field, SelectField, TextAreaField } from "@/components/ActionForm";
import { LIVE_ROLES, requireStaff } from "@/lib/dal";
import { db } from "@/lib/db";
import { t, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/lang";
import {
  createLiveEvent, deleteLiveEvent, grantLiveBadge, revokeLiveBadge, setLiveStatus,
} from "@/app/actions/lives";

export const instant = false;

export async function generateMetadata() {
  const lang = await getLang();
  return { title: `${t(lang, "liveAdm.title")} — CCC` };
}

const when = (d: Date, lang: Lang) =>
  d.toLocaleString(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }) + " UTC";

export default async function LivesAdminPage() {
  const lang = await getLang();
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
      <Link href="/admin" className="text-sm text-muted hover:text-brand">
        {t(lang, "mod.back")}
      </Link>
      <h1 className="mt-2 mb-2 font-display text-3xl font-semibold text-brand">{t(lang, "liveAdm.title")}</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted">{t(lang, "liveAdm.lead")}</p>
      <Suspense fallback={<p className="text-muted">{t(lang, "adm.loading")}</p>}>
        <LivesContent />
      </Suspense>
    </main>
  );
}

async function LivesContent() {
  await requireStaff(LIVE_ROLES);
  const lang = await getLang();

  const [events, badges] = await Promise.all([
    db.liveEvent.findMany({
      orderBy: { startsAt: "desc" },
      take: 60,
      select: {
        id: true, slug: true, title: true, status: true, visibility: true,
        provider: true, embedUrl: true, playbackId: true, startsAt: true,
        broadcaster: { select: { user: { select: { name: true, email: true } } } },
      },
    }),
    db.liveBroadcaster.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        userId: true, note: true, revokedAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);
  const activeBadges = badges.filter((b) => !b.revokedAt);
  const card = "rounded-2xl border border-line bg-surface p-5 shadow-sm";
  const h2 = "font-display text-xl font-semibold text-brand";
  const statuses = ["DRAFT", "SCHEDULED", "LIVE", "ENDED", "ARCHIVED"] as const;
  const defaultStart = new Date().toISOString().slice(0, 16);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <section>
        <h2 className={`${h2} mb-3`}>{t(lang, "liveAdm.listTitle", { n: events.length })}</h2>
        {events.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-surface p-6 text-sm text-muted">
            {t(lang, "liveAdm.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((e) => (
              <li key={e.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{e.title}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      /live/{e.slug} · {t(lang, `live.status.${e.status}`)} ·{" "}
                      {t(lang, `live.visibility.${e.visibility}`)} · {t(lang, `live.provider.${e.provider}`)} ·{" "}
                      {when(e.startsAt, lang)}
                    </p>
                    {e.broadcaster?.user && (
                      <p className="mt-1 text-xs text-muted">
                        {t(lang, "live.broadcaster", { name: e.broadcaster.user.name ?? e.broadcaster.user.email ?? "—" })}
                      </p>
                    )}
                  </div>
                  <Link href={`/live/${e.slug}`} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-brand/5">
                    {t(lang, "liveAdm.open")}
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <ActionForm action={setLiveStatus} lang={lang} submitLabel={t(lang, "liveAdm.saveStatus")}>
                    <input type="hidden" name="id" value={e.id} />
                    <SelectField
                      label={t(lang, "liveAdm.setStatus")}
                      name="status"
                      defaultValue={e.status}
                      options={statuses.map((s) => ({ value: s, label: t(lang, `live.status.${s}`) }))}
                    />
                  </ActionForm>
                  <form action={deleteLiveEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <button type="submit" className="h-11 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700 hover:bg-red-50">
                      {t(lang, "liveAdm.delete")}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-6">
        <section className={`${card} h-fit`}>
          <h2 className={`${h2} mb-4`}>{t(lang, "liveAdm.new")}</h2>
          <ActionForm action={createLiveEvent} lang={lang} submitLabel={t(lang, "liveAdm.create")}>
            <Field label={t(lang, "liveAdm.fieldTitle")} name="title" />
            <Field label={t(lang, "liveAdm.fieldSlug")} name="slug" required={false} hint={t(lang, "liveAdm.hintSlug")} />
            <TextAreaField label={t(lang, "liveAdm.fieldDescription")} name="description" rows={2} />
            <SelectField
              label={t(lang, "liveAdm.fieldProvider")}
              name="provider"
              options={[
                { value: "EMBED", label: t(lang, "live.provider.EMBED") },
                { value: "MUX", label: t(lang, "live.provider.MUX") },
              ]}
            />
            <Field label={t(lang, "liveAdm.fieldEmbedUrl")} name="embedUrl" type="url" required={false} hint={t(lang, "liveAdm.hintEmbed")} />
            <Field label={t(lang, "liveAdm.fieldPlaybackId")} name="playbackId" required={false} hint={t(lang, "liveAdm.hintPlayback")} />
            <Field label={t(lang, "liveAdm.fieldReplayUrl")} name="replayUrl" type="url" required={false} />
            <Field label={t(lang, "liveAdm.fieldStartsAt")} name="startsAt" type="datetime-local" defaultValue={defaultStart} hint={t(lang, "liveAdm.hintStarts")} />
            <SelectField
              label={t(lang, "liveAdm.fieldVisibility")}
              name="visibility"
              options={[
                { value: "PUBLIC", label: t(lang, "live.visibility.PUBLIC") },
                { value: "AUTHENTICATED", label: t(lang, "live.visibility.AUTHENTICATED") },
                { value: "SUBSCRIBERS", label: t(lang, "live.visibility.SUBSCRIBERS") },
              ]}
            />
            <SelectField
              label={t(lang, "liveAdm.fieldStatus")}
              name="status"
              options={statuses.map((s) => ({ value: s, label: t(lang, `live.status.${s}`) }))}
            />
            <SelectField
              label={t(lang, "liveAdm.fieldBroadcaster")}
              name="broadcasterId"
              options={[
                { value: "", label: t(lang, "liveAdm.noBroadcaster") },
                ...activeBadges.map((b) => ({
                  value: b.userId,
                  label: b.user.name ?? b.user.email ?? b.userId,
                })),
              ]}
            />
          </ActionForm>
        </section>

        <section className={`${card} h-fit`}>
          <h2 className={`${h2} mb-1`}>{t(lang, "liveAdm.badgesTitle", { n: activeBadges.length })}</h2>
          <p className="mb-4 text-xs text-muted">{t(lang, "liveAdm.badgesLead")}</p>
          <ActionForm action={grantLiveBadge} lang={lang} submitLabel={t(lang, "liveAdm.grant")}>
            <Field label={t(lang, "liveAdm.badgeEmail")} name="email" type="email" />
            <Field label={t(lang, "liveAdm.badgeNote")} name="note" required={false} />
          </ActionForm>
          {badges.length > 0 && (
            <ul className="mt-4 divide-y divide-line">
              {badges.map((b) => (
                <li key={b.userId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="font-medium text-ink">{b.user.name ?? b.user.email ?? b.userId}</span>
                    <span className="block text-xs text-muted">
                      {b.user.email} {b.revokedAt ? `· ${t(lang, "part.status.revoked")}` : ""}
                      {b.note ? ` · ${b.note}` : ""}
                    </span>
                  </span>
                  {!b.revokedAt && (
                    <form action={revokeLiveBadge}>
                      <input type="hidden" name="userId" value={b.userId} />
                      <button type="submit" className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:border-red-300 hover:text-red-700">
                        {t(lang, "liveAdm.revoke")}
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
