"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, PenSquare, Search, Settings, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { LogoLockup } from "@/components/brand/Logo";
import { StreakBadge } from "@/components/streak/StreakBadge";

import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

interface HeaderProps {
  variant?: "app" | "admin";
  showAdminLink?: boolean;
}

export function Header({ variant = "app", showAdminLink = false }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:px-8"
      data-testid="header"
    >
      {/* Mobile branding + nav menu */}
      <div className="flex items-center gap-3 lg:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="메뉴 열기">
              <Menu className="h-5 w-5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {variant === "app" ? (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/app" className="flex items-center gap-2">
                    <Home className="h-4 w-4" aria-hidden />홈
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/today" className="flex items-center gap-2">
                    <PenSquare className="h-4 w-4" aria-hidden />오늘 메모
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/search" className="flex items-center gap-2">
                    <Search className="h-4 w-4" aria-hidden />검색
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" aria-hidden />설정
                  </Link>
                </DropdownMenuItem>
                {showAdminLink ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" aria-hidden />Admin
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="flex items-center gap-2">
                    <Home className="h-4 w-4" aria-hidden />대시보드
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/users" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" aria-hidden />사용자
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/app" className="flex items-center gap-2">
                    <Home className="h-4 w-4" aria-hidden />앱으로 돌아가기
                  </Link>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Link href="/app">
          <LogoLockup wordmarkSize="sm" />
          {variant === "admin" ? (
            <span className="ml-2 align-middle text-xs font-medium text-muted-foreground">
              Admin
            </span>
          ) : null}
        </Link>
      </div>

      {/* Spacer on desktop pushes the right cluster */}
      <div className="hidden lg:block" />

      <div className="flex items-center gap-1">
        {variant === "app" ? <StreakBadge /> : null}
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

// Re-export pathname helper for child consumers — not strictly needed but
// keeps imports tidy.
export { usePathname };
