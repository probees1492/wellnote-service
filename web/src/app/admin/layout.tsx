"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Header } from "@/components/shell/Header";
import { Sidebar } from "@/components/shell/Sidebar";
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
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        로딩 중...
      </div>
    );
  }
  if (user.role === "user") {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar variant="admin" />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header variant="admin" />
        <main className="flex-1 px-4 py-8 lg:px-8">
          <div className="mx-auto w-full max-w-5xl lg:w-4/5">{children}</div>
        </main>
      </div>
    </div>
  );
}
