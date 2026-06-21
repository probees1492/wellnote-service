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
  PushPin,
  Users,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";
import { LogoWordmark } from "@/components/brand/Logo";

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
    href: "/app/pins",
    label: "핀",
    icon: PushPin,
    match: (p) => !!p?.startsWith("/app/pins"),
  },
  {
    href: "/app/buddies",
    label: "버디",
    icon: Users,
    match: (p) => !!p?.startsWith("/app/buddies"),
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

/**
 * Cloudflare-dashboard-style sidebar:
 *  - Always reserves a narrow icon rail in the layout (so content doesn't
 *    reflow when hovered).
 *  - The actual aside grows on hover via a width transition; while expanded
 *    it overlays the main content with a soft shadow.
 *  - Touch users: no hover events fire, so they get the wider rail by tapping
 *    a header toggle (kept minimal — phones/tablets use the Header dropdown).
 */
export function Sidebar({ variant = "app", showAdminLink = false }: SidebarProps) {
  const pathname = usePathname();
  const items = variant === "admin" ? ADMIN_ITEMS : APP_ITEMS;
  const [expanded, setExpanded] = React.useState(false);

  return (
    // Outer slot is a pure layout placeholder so the main content has a
    // stable left margin. The aside itself is `fixed` against the viewport
    // — that guarantees full height even when the absolute child renders
    // before content has measured the parent flex item.
    <div
      className="hidden w-14 shrink-0 lg:block"
      data-testid="sidebar-slot"
      aria-hidden="true"
    >
      <aside
        aria-label="사이드바"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={(e) => {
          // collapse when focus actually leaves the aside, not when it moves
          // between two child links.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
            setExpanded(false);
          }
        }}
        data-testid="sidebar"
        data-state={expanded ? "expanded" : "collapsed"}
        // z-50 keeps the expanded panel above the sticky Header (z-30).
        // `fixed` over `absolute` so height is always = full viewport.
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen flex-col border-r bg-card backdrop-blur-sm",
          "overflow-hidden transition-[width] duration-200 ease-out",
          expanded ? "w-60 shadow-lg" : "w-14",
        )}
      >
        <div className="flex h-16 items-center px-3">
          <Link
            href="/app"
            className="flex items-center gap-2 overflow-hidden"
            aria-label="WellNote 홈"
          >
            {/* Always-visible launcher icon (same image as the mobile app
                icon — cream background + W' brush). 32×32 sits perfectly
                inside the 56px collapsed rail. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark-1024.png"
              alt=""
              aria-hidden
              className="h-8 w-8 shrink-0 rounded-md"
            />
            <span
              className={cn(
                "flex items-center gap-2 whitespace-nowrap transition-opacity duration-200",
                expanded ? "opacity-100 delay-75" : "pointer-events-none opacity-0",
              )}
              aria-hidden={!expanded}
            >
              <LogoWordmark size="md" />
              {variant === "admin" ? (
                <span className="text-xs font-medium text-muted-foreground">
                  Admin
                </span>
              ) : null}
            </span>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-4">
          {items.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={item.match(pathname)}
              expanded={expanded}
            />
          ))}
          {variant === "app" && showAdminLink ? (
            <SidebarLink
              href="/admin"
              label="Admin"
              icon={Shield}
              active={!!pathname?.startsWith("/admin")}
              expanded={expanded}
            />
          ) : null}
          {variant === "admin" ? (
            <SidebarLink
              href="/app"
              label="앱으로 돌아가기"
              icon={House}
              active={false}
              expanded={expanded}
            />
          ) : null}
        </nav>
        <div
          className={cn(
            "border-t px-3 py-4 text-xs text-muted-foreground transition-opacity duration-150",
            expanded ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          aria-hidden={!expanded}
        >
          <span className="whitespace-nowrap">매일 한 페이지, 봉인되는 일기.</span>
        </div>
      </aside>
    </div>
  );
}

function SidebarLink({
  href,
  label,
  icon: IconComponent,
  active,
  expanded,
}: {
  href: string;
  label: string;
  icon: Icon;
  active: boolean;
  expanded: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      <IconComponent className="h-4 w-4 shrink-0" weight="duotone" aria-hidden />
      <span
        className={cn(
          "whitespace-nowrap transition-opacity duration-150",
          expanded ? "opacity-100 delay-75" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!expanded}
      >
        {label}
      </span>
    </Link>
  );
}
