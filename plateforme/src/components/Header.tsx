import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/app/actions/auth";

async function UserNav() {
  const user = await getCurrentUser();
  const link = "rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100";
  if (!user) {
    return (
      <>
        <Link href="/connexion" className={link}>
          Connexion
        </Link>
        <Link
          href="/inscription"
          className="rounded-md bg-[#14213D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d3159]"
        >
          Créer un compte
        </Link>
      </>
    );
  }
  return (
    <>
      {user.staffRole && (
        <Link href="/admin" className={link}>
          Administration
        </Link>
      )}
      <span className="hidden text-sm text-zinc-500 sm:inline">{user.name ?? user.email}</span>
      <form action={logout}>
        <button type="submit" className={link}>
          Déconnexion
        </button>
      </form>
    </>
  );
}

export function Header() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" aria-label="CCC — accueil" className="flex items-center">
          <Image src="/logo.png" alt="CCC — Le savoir prend vie" width={126} height={70} className="h-14 w-auto" priority />
        </Link>
        <nav className="flex items-center gap-1">
          <Suspense fallback={<span className="h-9 w-24" />}>
            <UserNav />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
