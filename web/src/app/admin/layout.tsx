"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-store";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, hydrated, hydrate } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    } else if (hydrated && user && user.role === "user") {
      router.replace("/app");
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-text-muted">
        로딩 중...
      </div>
    );
  }
  if (user.role === "user") {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-bg-primary">
      <aside className="hidden md:flex w-60 flex-col gap-1 border-r border-border bg-bg-secondary p-4">
        <div className="mb-4 flex items-center gap-2 px-2 py-2">
          <div className="h-7 w-7 rounded-md bg-edge-blue" aria-hidden />
          <span className="text-base font-bold">WellNote · Admin</span>
        </div>
        <Link
          href="/admin"
          className="block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
        >
          대시보드
        </Link>
        <Link
          href="/app"
          className="block rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
        >
          앱으로 돌아가기
        </Link>
      </aside>
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
