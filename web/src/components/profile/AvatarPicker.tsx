"use client";

import { Camera, Trash, UserCircle } from "@phosphor-icons/react/dist/ssr";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { api, avatarSrc, type ApiUser } from "@/lib/api";

interface Props {
  user: ApiUser;
  onChanged: (next: ApiUser) => void;
}

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Square avatar surface with a hidden file input and a Trash button. Uses the
 * native file picker (mobile browsers expose camera + gallery automatically).
 */
export function AvatarPicker({ user, onChanged }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = avatarSrc(user);
  const initials = (user.displayName || user.email || "?")
    .trim()
    .slice(0, 1)
    .toUpperCase();

  async function handleFile(file: File) {
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("JPEG, PNG, WEBP만 업로드할 수 있어요.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("이미지는 2 MiB 이하만 업로드할 수 있어요.");
      return;
    }
    setBusy(true);
    try {
      const r = await api.uploadAvatar(file);
      onChanged(r.user);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "업로드에 실패했어요.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      const r = await api.deleteAvatar();
      onChanged(r.user);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "삭제에 실패했어요.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4" data-testid="avatar-picker">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="프로필 사진 변경"
        className="relative h-20 w-20 overflow-hidden rounded-full border bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="프로필 사진"
            className="h-full w-full object-cover"
            data-testid="avatar-image"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-serif text-2xl text-muted-foreground">
            {initials || <UserCircle weight="duotone" className="h-10 w-10" />}
          </div>
        )}
        <span className="absolute bottom-0 right-0 m-1 rounded-full bg-background/90 p-1 text-foreground shadow">
          <Camera className="h-4 w-4" weight="duotone" />
        </span>
      </button>

      <div className="flex flex-col gap-2 text-sm">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            data-testid="avatar-upload-button"
          >
            {busy ? "처리 중..." : src ? "사진 변경" : "사진 등록"}
          </Button>
          {src ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={handleRemove}
              data-testid="avatar-remove-button"
            >
              <Trash className="mr-1 h-4 w-4" weight="duotone" />
              제거
            </Button>
          ) : null}
        </div>
        {error ? (
          <span className="text-xs text-destructive" data-testid="avatar-error">
            {error}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            JPEG·PNG·WEBP, 최대 2 MiB.
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        data-testid="avatar-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
    </div>
  );
}
