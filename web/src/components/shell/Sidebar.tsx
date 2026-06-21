"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Icon } from "@phosphor-icons/react";
import {
  House,
  PencilSimple,
  MagnifyingGlass,
  Gear,
  Shield,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { LogoLockup } from "@/components/brand/Logo";

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  match: (p: string | null) => boolean;
}

const APP_ITEMS: NavItem[] = [
  {
    href: "/app",
    label: "홈",
    icon: House,
    match: (p) => p === "/app",
  },
  {
    href: "/app/today",
    label: "오늘 메모",
    icon: PencilSimple,
    match: (p) => !!p?.startsWith("/app/today"),
  },
  {
    href: "/app/search",
    label: "검색",
    icon: MagnifyingGlass,
    match: (p) => !!p?.startsWith("/app/search"),
  },
  {
    href: "/app/settings",
    label: "설정",
    icon: Gear,
    match: (p) => !!p?.startsWith("/app/settings"),
  },
];

const ADMIN_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "대시보드",
    icon: House,
    match: (p) => p === "/admin",
  },
  {
    href: "/admin/users",
    label: "사용자",
    icon: Shield,
    match: (p) => !!p?.startsWith("/admin/users"),
  },
];

interface SidebarProps {
  variant?: "app" | "admin";
  showAdminLink?: boolean;
}

export function Sidebar({ variant = "app", showAdminLink = false }: SidebarProps) {
  const pathname = usePathname();
  const items = variant === "admin" ? ADMIN_ITEMS : APP_ITEMS;

  return (
    <aside
      aria-label="사이드바"
      className="hidden w-60 shrink-0 border-r bg-card/40 lg:flex lg:flex-col"
      data-testid="sidebar"
    >
      <div className="flex h-16 items-center px-6">
        <Link href="/app" className="flex items-center gap-2">
          {variant === "admin" ? (
            <>
              <LogoLockup wordmarkSize="md" />
              <span className="text-xs font-medium text-muted-foreground">
                Admin
              </span>
            </>
          ) : (
            <LogoLockup wordmarkSize="md" />
          )}
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" weight="duotone" aria-hidden />
              {item.label}
            </Link>
          );
        })}
        {variant === "app" && showAdminLink ? (
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname?.startsWith("/admin")
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Shield className="h-4 w-4" weight="duotone" aria-hidden />
            Admin
          </Link>
        ) : null}
        {variant === "admin" ? (
          <Link
            href="/app"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <House className="h-4 w-4" weight="duotone" aria-hidden />
            앱으로 돌아가기
          </Link>
        ) : null}
      </nav>
      <div className="border-t px-6 py-4 text-xs text-muted-foreground">
        매일 한 페이지, 봉인되는 일기.
      </div>
    </aside>
  );
}
