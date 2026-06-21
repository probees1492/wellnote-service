"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type AdminUserRow } from "@/lib/api";

export default function AdminDashboard() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.adminListUsers({ q });
        if (!alive) return;
        setRows(r.items);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "사용자 목록을 불러오지 못했습니다.";
        setErr(msg);
      }
    })();
    return () => {
      alive = false;
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Admin 대시보드</h1>
      <div className="flex flex-col gap-2">
        <Label htmlFor="admin-q">이메일로 검색</Label>
        <Input
          id="admin-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {err ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </div>
      ) : null}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">이메일</th>
                <th className="px-4 py-3 font-medium">필명</th>
                <th className="px-4 py-3 font-medium">크래딧</th>
                <th className="px-4 py-3 font-medium">역할</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    사용자가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.displayName}</td>
                    <td className="px-4 py-3">{u.creditBalance}</td>
                    <td className="px-4 py-3">{u.role ?? "user"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users?id=${u.id}`}
                        className="font-medium underline"
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
