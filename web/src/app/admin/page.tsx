"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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
      } catch (e: any) {
        setErr(e?.message ?? "사용자 목록을 불러오지 못했습니다.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [q]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Admin 대시보드</h1>
      <Input
        id="admin-q"
        label="이메일로 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {err ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {err}
        </div>
      ) : null}
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-text-muted">
              <th className="py-2">이메일</th>
              <th>이름</th>
              <th>크래딧</th>
              <th>역할</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-text-muted">
                  사용자가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="py-2">{u.email}</td>
                  <td>{u.displayName}</td>
                  <td>{u.creditBalance}</td>
                  <td>{u.role ?? "user"}</td>
                  <td>
                    <Link
                      href={`/admin/users?id=${u.id}`}
                      className="text-edge-blue underline"
                    >
                      상세
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
