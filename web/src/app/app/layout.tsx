"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Header } from "@/components/shell/Header";
import { Sidebar } from "@/components/shell/Sidebar";
import { useAuth } from "@/lib/auth-store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, hydrated, hydrate, refreshMe } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    } else if (hydrated && user) {
      refreshMe();
    }
  }, [hydrated, user, router, refreshMe]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        로딩 중...
      </div>
    );
  }

  const showAdminLink = user.role !== "user";

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar variant="app" showAdminLink={showAdminLink} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header variant="app" showAdminLink={showAdminLink} />
        <main className="flex-1 px-4 py-8 lg:px-8">
          <div className="mx-auto w-full max-w-5xl lg:w-4/5">{children}</div>
        </main>
      </div>
    </div>
  );
}
