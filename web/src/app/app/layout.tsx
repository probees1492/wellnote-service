"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-store";

const NAV: { label: string; href: string }[] = [
  { label: "홈", href: "/app" },
  { label: "오늘 메모", href: "/app/today" },
  { label: "검색", href: "/app/search" },
  { label: "설정", href: "/app/settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, hydrated, hydrate, logout, refreshMe } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    } else if (hydrated && user) {
      // refresh user info from /auth/me on entry
      refreshMe();
    }
  }, [hydrated, user, router, refreshMe]);

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-muted">
        로딩 중...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-bg-primary">
      <aside
        className="hidden md:flex w-60 flex-col gap-1 border-r border-border bg-bg-secondary p-4"
        data-testid="sidebar"
      >
        <div className="mb-4 flex items-center gap-2 px-2 py-2">
          <div className="h-7 w-7 rounded-md bg-edge-blue" aria-hidden />
          <span className="text-base font-bold text-text-primary">
            WellNote
          </span>
        </div>
        {NAV.map((n) => {
          const active =
            n.href === "/app"
              ? pathname === "/app"
              : pathname?.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                "block rounded-md px-3 py-2 text-sm",
                active
                  ? "bg-edge-blue-soft text-edge-blue border-l-[3px] border-edge-blue"
                  : "text-text-secondary hover:bg-bg-tertiary",
              )}
            >
              {n.label}
            </Link>
          );
        })}
        {user.role !== "user" ? (
          <Link
            href="/admin"
            className={clsx(
              "block rounded-md px-3 py-2 text-sm",
              pathname?.startsWith("/admin")
                ? "bg-edge-blue-soft text-edge-blue border-l-[3px] border-edge-blue"
                : "text-text-secondary hover:bg-bg-tertiary",
            )}
          >
            Admin
          </Link>
        ) : null}
        <div className="mt-auto rounded-md border border-border bg-bg-primary p-3 text-xs text-text-muted">
          <div className="text-text-primary font-medium" data-testid="me-name">
            {user.displayName}
          </div>
          <div className="text-text-muted truncate" data-testid="me-email">
            {user.email}
          </div>
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="mt-2 text-edge-blue underline"
            data-testid="logout-btn"
          >
            로그아웃
          </button>
        </div>
      </aside>
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
