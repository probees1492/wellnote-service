"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth-store";

export function UserMenu() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [signingOut, setSigningOut] = React.useState(false);

  const initials = React.useMemo(() => {
    const source = user?.displayName || user?.email || "";
    return source.slice(0, 2).toUpperCase() || "?";
  }, [user?.displayName, user?.email]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  }

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2"
          aria-label="사용자 메뉴 열기"
          data-testid="user-menu-trigger"
        >
          <span
            aria-hidden
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium"
          >
            {initials}
          </span>
          <span
            className="hidden text-sm sm:inline-block"
            data-testid="me-name"
          >
            {user.displayName || user.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p
              className="text-sm font-medium leading-none"
              data-testid="me-displayname"
            >
              {user.displayName || user.email}
            </p>
            <p
              className="text-xs leading-none text-muted-foreground"
              data-testid="me-email"
            >
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/app/settings" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" aria-hidden />
            프로필
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" aria-hidden />
            설정
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-2"
          data-testid="logout-btn"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
