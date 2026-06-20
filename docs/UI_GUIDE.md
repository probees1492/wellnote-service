# WellNote UI/UX 가이드 (UI_GUIDE)

> 문서 버전: 1.0.0
> 디자인 컨셉: **화이트 베이스 + 블루 엣지** — 깨끗한 노트지 위에 절제된 블루 액센트로 포커스를 가이드하는 디자인.
> 본 가이드는 웹과 모바일(Flutter)에 공통으로 적용됩니다.

---

## 1. 디자인 원칙

### 1.1 핵심 원칙
1. **여백 우선 (White-first)** — 컨텐츠가 호흡할 수 있는 충분한 여백. 노트의 종이 느낌.
2. **블루 엣지 액센트 (Blue edge accents)** — 액션, 포커스, 상태 표시에만 블루 사용. 과한 블루 면적은 지양.
3. **타이포그래피 중심** — 마크다운 본문이 주인공. 시각 요소는 보조.
4. **즉각적 피드백** — 자동저장, 상태 전환 등은 200ms 이내 시각적 응답.
5. **일관성** — 웹/모바일 토큰 1:1 매핑.
6. **접근성** — WCAG 2.1 AA, 키보드 내비, 4.5:1 대비.

### 1.2 톤 & 보이스
- 마이크로카피: 친근하고 간결한 한국어 ("저장됨", "내일이 되면 오늘의 메모는 봉인됩니다")
- 에러: 비난 X, 가이드 O ("크래딧이 부족해요. 30자만 더 작성해보세요")

---

## 2. 디자인 토큰

### 2.1 색상 (Color Tokens)

#### 기본 팔레트
| 토큰 | 값 | 용도 |
|---|---|---|
| `--bg-primary` | `#FFFFFF` | 메인 배경 |
| `--bg-secondary` | `#F7F9FC` | 카드/섹션 배경 |
| `--bg-tertiary` | `#EEF2F7` | hover 배경 |
| `--edge-blue` | `#2563EB` | 액션 / 포커스 / 링크 / 액센트 보더 |
| `--edge-blue-hover` | `#1D4ED8` | hover 시 |
| `--edge-blue-soft` | `#DBEAFE` | 선택/하이라이트 배경 (옅은 블루) |
| `--text-primary` | `#0F172A` | 본문 텍스트 |
| `--text-secondary` | `#334155` | 보조 텍스트 |
| `--text-muted` | `#64748B` | 메타 정보, 플레이스홀더 |
| `--text-on-blue` | `#FFFFFF` | 블루 위 텍스트 |
| `--border-default` | `#E2E8F0` | 일반 보더 |
| `--border-strong` | `#CBD5E1` | 강조 보더 |
| `--danger` | `#EF4444` | 위험 / 삭제 |
| `--danger-hover` | `#DC2626` | |
| `--warning` | `#F59E0B` | 경고 |
| `--success` | `#10B981` | 성공 |

#### 활동 그리드 색상
| 토큰 | 값 | 의미 |
|---|---|---|
| `--grid-empty` | `#F1F5F9` | 메모 없음 |
| `--grid-l1` | `#DBEAFE` | 1~99자 |
| `--grid-l2` | `#93C5FD` | 100~499자 |
| `--grid-l3` | `#3B82F6` | 500~1499자 |
| `--grid-l4` | `#1D4ED8` | 1500자+ |

### 2.2 타이포그래피

#### 폰트 패밀리
- **본문/UI**: System sans-serif 우선
  - 웹: `-apple-system, BlinkMacSystemFont, "Pretendard Variable", Pretendard, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
  - Flutter: `SF Pro Text` (iOS), `Roboto` (Android), 우선 Pretendard 동봉 시 우선 사용
- **마크다운 본문**: 위와 동일, 사용자 가독성 우선
- **코드 블록**: `"JetBrains Mono", "Menlo", "Consolas", monospace`

#### 텍스트 스타일
| 토큰 | size / line-height / weight | 용도 |
|---|---|---|
| `--text-display` | 32px / 40px / 700 | 랜딩 헤드라인 |
| `--text-h1` | 24px / 32px / 700 | 페이지 제목 |
| `--text-h2` | 20px / 28px / 600 | 섹션 제목 |
| `--text-h3` | 18px / 26px / 600 | 카드 제목 |
| `--text-body-lg` | 16px / 24px / 400 | 메모 본문 기본 |
| `--text-body` | 14px / 20px / 400 | UI 기본 |
| `--text-body-sm` | 13px / 18px / 400 | 보조 |
| `--text-caption` | 12px / 16px / 500 | 메타/캡션 |

### 2.3 간격 (Spacing) — 4px 그리드
| 토큰 | 값 |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-10` | 40px |
| `--space-12` | 48px |
| `--space-16` | 64px |

### 2.4 라운드 (Radius)
| 토큰 | 값 | 용도 |
|---|---|---|
| `--radius-sm` | 8px | Input, Tag, 작은 버튼 |
| `--radius-md` | 12px | Button, Card, Modal 내부 요소 |
| `--radius-lg` | 16px | 큰 카드, Modal 외곽 |
| `--radius-full` | 9999px | Avatar, Pill |

### 2.5 그림자 (Shadow) — Subtle
| 토큰 | 값 | 용도 |
|---|---|---|
| `--shadow-none` | none | 기본 |
| `--shadow-xs` | `0 1px 2px rgba(15, 23, 42, 0.04)` | 카드 호버 |
| `--shadow-sm` | `0 2px 8px rgba(15, 23, 42, 0.06)` | Modal, Dropdown |
| `--shadow-md` | `0 4px 16px rgba(15, 23, 42, 0.08)` | Floating panel |
| `--shadow-focus` | `0 0 0 3px rgba(37, 99, 235, 0.25)` | 포커스 링 (블루) |

### 2.6 모션
- duration tokens: `--motion-fast: 120ms`, `--motion: 200ms`, `--motion-slow: 320ms`
- easing: `cubic-bezier(0.2, 0.8, 0.2, 1)` (ease-out-quart)
- hover transition: 120ms
- modal open: 200ms slide-up + fade
- 자동저장 표시: 100ms fade

---

## 3. 컴포넌트 인벤토리

### 3.1 Button

#### Variants
- **Primary**
  - bg: `--edge-blue`, text: `--text-on-blue`
  - hover: `--edge-blue-hover`
  - active: `--edge-blue-hover` + scale(0.98)
  - disabled: opacity 0.4, cursor not-allowed
- **Secondary**
  - bg: `--bg-primary`, border 1px `--border-strong`, text: `--text-primary`
  - hover: bg `--bg-tertiary`, border `--edge-blue`
- **Ghost**
  - 배경 투명, hover에 `--bg-tertiary`
- **Danger**
  - bg: `--danger`, text white, hover `--danger-hover`

#### Sizes
- sm: height 32px, padding 0 12px, text 13px
- md (기본): height 40px, padding 0 16px, text 14px
- lg: height 48px, padding 0 20px, text 16px

#### 공통
- border-radius: `--radius-md`
- focus: `--shadow-focus`
- 아이콘 + 텍스트 간격: 8px

### 3.2 Input
- height: 40px (md), 48px (lg)
- bg: `--bg-primary`, border 1px `--border-default`, radius `--radius-sm`
- placeholder: `--text-muted`
- focus: border `--edge-blue` + `--shadow-focus`
- error: border `--danger`, helper text `--danger`
- 패스워드: 오른쪽 아이콘 토글
- Label: 위에 12px gap, `--text-body-sm` `--text-secondary`
- Helper text: 아래 6px, `--text-caption`

### 3.3 Textarea / Editor
- 메모 에디터: Tiptap (웹) / 자체 위젯 (Flutter)
- 보더 없음, focus시 좌측 4px `--edge-blue` 라인 (블루 엣지 컨셉 강조)
- 폰트 `--text-body-lg`, 줄간격 1.6
- 자동저장 상태 우상단: "저장 중..." → "저장됨 · HH:MM" (`--text-muted` `--text-caption`)

### 3.4 Card
- bg: `--bg-primary`, border 1px `--border-default`, radius `--radius-lg`
- padding: `--space-6`
- hover (interactive): `--shadow-xs` + border `--edge-blue` 좌측 2px 액센트 강조 옵션
- title: `--text-h3`, body: `--text-body`

### 3.5 MemoGridCell (활동 그리드 칸)
- 크기: 12px × 12px (웹), 모바일은 화면 폭에 맞춰 자동
- 간격: 3px gap
- border-radius: 2px
- 색상: `--grid-empty` / `--grid-l1~l4`
- hover/focus: 1px outline `--edge-blue` + tooltip
- 클릭 가능 칸: cursor pointer
- 비활성 (미래 일자): opacity 0.3 + cursor not-allowed

### 3.6 Modal
- backdrop: rgba(15, 23, 42, 0.4)
- container: bg `--bg-primary`, radius `--radius-lg`, padding `--space-6`, max-width 480px (default), `--shadow-sm`
- header: title `--text-h2` + close 버튼 (Ghost icon button)
- footer: 우정렬 액션 버튼들, gap 8px
- 모바일: 하단 sheet 형태 (slide-up), 상단에 16px 라운드만 적용

### 3.7 Toast
- 위치: 웹 우하단 / 모바일 하단 중앙
- bg: `--text-primary` (다크), text 화이트
- radius `--radius-md`, padding 12px 16px
- variants: default / success / danger / warning (좌측 4px 컬러 라인)
- 표시 시간: 3초 (액션 포함 시 5초)
- 자동저장 인디케이터는 toast가 아닌 inline status

### 3.8 Avatar
- 크기: 24 / 32 / 40 / 64px
- radius: `--radius-full`
- fallback: 이니셜 + bg `--edge-blue-soft`, text `--edge-blue`

### 3.9 Tag / Badge
- 작은 pill, padding 2px 8px, text 12px
- 색상 variants:
  - default: `--bg-tertiary` / `--text-secondary`
  - blue: `--edge-blue-soft` / `--edge-blue`
  - danger: `#FEE2E2` / `--danger`
- "Readonly" 배지: blue variant, "Today" 배지: success

### 3.10 Navigation
- **웹 데스크탑**: 좌측 사이드바 240px 고정
  - bg: `--bg-secondary`
  - 활성 메뉴: 좌측 3px `--edge-blue` 라인 + bg `--edge-blue-soft`
- **웹 모바일**: 상단 헤더 56px + 햄버거 → 드로어
- **Flutter**: BottomNavigationBar 3탭 (홈/활동/설정)

### 3.11 EmptyState
- 중앙 정렬, 일러스트 또는 단색 아이콘
- 제목 `--text-h3`, 설명 `--text-body` `--text-muted`
- CTA Button primary

### 3.12 Skeleton Loader
- bg: `--bg-tertiary`
- shimmer animation (1.5s loop)

---

## 4. 화면 목록 (Screen Inventory)

### 4.1 공통 레이아웃
- 웹 데스크탑: 사이드바(240) + 컨텐츠(max-width 880, centered)
- 웹 모바일: 헤더(56) + 풀폭 컨텐츠
- Flutter: AppBar + 본문 + BottomNavigationBar

### 4.2 화면 정의

#### 4.2.1 랜딩 (`/`) — 비로그인
- 헤더: 로고 + "로그인" / "시작하기" 버튼
- Hero: 한 줄 카피 ("매일 한 페이지, 봉인되는 일기.") + CTA primary "무료로 시작하기"
- 데모 이미지: 활동 그리드 미니
- 가치 제안 3-card 섹션
- 푸터: 이용약관, 개인정보처리방침, 문의

#### 4.2.2 로그인 (`/login`)
- 중앙 카드 (max-width 400)
- "WellNote" 로고
- Email Input + Password Input + Primary Button "로그인"
- "비밀번호 찾기" 링크 (right-aligned `--text-body-sm`)
- 디바이더 "또는"
- "Google로 계속하기" Secondary Button (Google logo)
- "Apple로 계속하기" Secondary Button (Apple logo)
- 하단: "계정이 없으신가요? 가입하기"

#### 4.2.3 가입 (`/signup`)
- 로그인과 유사. email, password, password confirm, displayName(선택)
- 비밀번호 정책 inline helper
- "가입하기" Primary Button
- 약관 동의 체크박스 (필수: 서비스/개인정보, 선택: 마케팅)

#### 4.2.4 메모 목록 / 홈 (`/home`)
- 상단: 인사말 + 오늘 날짜
- 활동 그리드 (52주 × 7일) 카드
- "오늘의 메모" 진입 CTA (큰 카드, 좌측 4px `--edge-blue`)
- "최근 메모" 리스트 (5개, 더보기)
- 우상단: 검색 아이콘, 알림(추후), 아바타

#### 4.2.5 메모 작성 (`/memo/today` 또는 `/memo/:id` 당일)
- 헤더: 날짜 (큰 `--text-h1`) + Readonly 배지 (없음) + "저장됨 · HH:MM"
- Tiptap 마크다운 에디터 (풀폭, 좌측 4px 블루 라인 focus)
- 글자수 카운터 우하단 (`--text-caption`)
- 모바일: 키보드 위 툴바 (B, I, link, list, code 등)

#### 4.2.6 메모 보기 readonly (`/memo/:id`)
- 헤더: 날짜 + "Readonly" 배지 (blue)
- 마크다운 렌더 영역 (react-markdown / flutter_markdown)
- 좌하단: 크래딧 잔액 표시
- 액션: 복사 버튼만 (편집 비활성)

#### 4.2.7 검색 (`/search`)
- 상단 검색바 (자동 포커스)
- 필터 칩: 날짜 범위(date range picker)
- 결과 카드 리스트 (제목, 발췌, 날짜)
- 키워드 highlight: bg `--edge-blue-soft`, text `--edge-blue`
- 빈 상태: EmptyState

#### 4.2.8 설정 (`/settings`)
- 섹션: 프로필 (avatar, displayName 편집), 이메일 (인증 상태), 비밀번호 변경, 연결된 소셜 계정, 크래딧 (잔액 + 거래내역 링크), 알림(추후), 데이터 (export Phase 2), 계정 (로그아웃, 회원탈퇴)

#### 4.2.9 Admin 대시보드 (`/admin`)
- 통계 카드 4개 가로 (총 가입자, DAU, 오늘 메모 수, 평균 크래딧)
- 가입 추이 차트
- 최근 admin 액션 5건

#### 4.2.10 Admin 사용자 목록 (`/admin/users`)
- 검색바, 필터 (역할, 정지여부, 가입일 범위)
- 테이블: email, displayName, credit, role, status, 가입일, [상세]
- 페이지네이션 (50/page)

#### 4.2.11 Admin 사용자 상세 (`/admin/users/:id`)
- 기본 정보 카드
- 크래딧 카드 (잔액 + [부여] [회수] 버튼)
- 활동 미니 그리드 (90일)
- 크래딧 트랜잭션 테이블
- 위험 액션 영역 (Danger Zone, 빨간 보더): [정지/해제] [세션 종료] [메모 강제 readonly (메모 선택)]

#### 4.2.12 Admin 감사 로그 (`/admin/audit-log`, superadmin)
- 필터 + 테이블 + 페이지네이션

#### 4.2.13 인증 콜백 / 에러
- `/auth/callback/google`, `/auth/callback/apple` — 자동 처리 로딩 화면
- `/error` — 에러 화면, 홈으로 돌아가기

---

## 5. 로고 가이드

### 5.1 WellNote 로고
- **타입**: 워드마크 + 심볼
- **심볼**: 둥근 사각형 노트 모서리에 블루 엣지 (왼쪽 위 30도 코너)
- **컬러 배리에이션**:
  - Primary on white: 심볼 `--edge-blue`, 워드마크 `--text-primary`
  - Inverted: 심볼 white, 워드마크 white (블루 배경 위)
  - Mono: 모두 `--text-primary`
- **최소 크기**: 헤더 24px, favicon 16px
- **클리어스페이스**: 워드마크 높이의 50% 이상

---

## 6. 인터랙션 패턴

### 6.1 포커스 처리
- 모든 인터랙티브 요소는 `--shadow-focus` 적용
- 키보드 사용자 우선 (`:focus-visible`)
- skip-to-content 링크 (웹)

### 6.2 자동저장 인디케이터
- 상태 머신: idle → saving → saved → error
- 우상단 inline text:
  - "저장 중..." (회색 + 작은 spinner)
  - "저장됨 · 12:34" (success 컬러 점)
  - "저장 실패. 재시도" (danger 컬러 + 클릭 가능)

### 6.3 KST 자정 임박 경고
- 5분 전: 토스트 (warning), "5분 후 새 날짜로 전환됩니다"
- 1분 전: 모달 (선택), 강제 저장 진행 상황 표시

### 6.4 크래딧 차감/적립 알림
- 자정 이후 첫 로그인 시:
  - 모달: "어제의 메모가 봉인되었어요"
  - 잔액 변화 시각화 (Before → After, +20 / -10 표시)
  - streak 달성 시 confetti micro-animation

### 6.5 오류 처리
- 네트워크 오류: 상단 sticky bar "오프라인" + 재연결 시도
- 409 conflict: 머지 모달 (3개 선택지)
- 403 INSUFFICIENT_CREDIT: 전용 모달

---

## 7. 반응형 브레이크포인트

| 이름 | 폭 |
|---|---|
| mobile | < 640px |
| tablet | 640~1023px |
| desktop | ≥ 1024px |

- 사이드바: ≥ 1024px만 노출. tablet/mobile은 드로어.
- 활동 그리드: 모바일은 가로 스크롤 (52주 전체 유지)

---

## 8. 다크모드 (Phase 2)
- 토큰 매핑은 미리 정의하되 구현은 v2:
  - `--bg-primary` → `#0F172A`
  - `--bg-secondary` → `#1E293B`
  - `--text-primary` → `#F1F5F9`
  - `--edge-blue` → `#3B82F6` (유지)

---

## 9. 모바일/웹 공통 원칙

1. **컴포넌트 1:1 매핑** — 웹의 Button = Flutter Button. 시각 일관성.
2. **터치 타깃 최소 44×44px** — 모바일 가이드라인 준수
3. **하단 액션 우선** — 모바일 주요 액션은 하단 (엄지 도달 영역)
4. **로딩은 skeleton 우선** — 무한 spinner 지양
5. **에러는 인라인 우선** — 폼 에러는 input 아래에 표시. 토스트는 글로벌 액션 결과에만.
6. **다국어 대비** — 모든 문자열은 i18n 키로 (한국어 기본). 텍스트 길이 50% 여유.

---

## 10. 자산 / 폴더 구조 (참고)

```
/web
  /app
    /(public)
      /              # 랜딩
      /login
      /signup
    /(authed)
      /home
      /memo
      /search
      /settings
    /(admin)
      /admin
      /admin/users
      /admin/users/[id]
  /components
    /ui (Button, Input, Card, Modal, Toast, ...)
    /memo (Editor, GridCell, ActivityGrid, ...)
    /admin (Table, UserDetail, ...)
  /lib
    /api, /auth, /tokens

/mobile (Flutter)
  /lib
    /core (tokens.dart, theme.dart)
    /widgets (app_button.dart, app_card.dart, ...)
    /features
      /auth
      /memo
      /activity
      /settings
```

---

문서 끝.
