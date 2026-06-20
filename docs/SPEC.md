# WellNote 상세 기획서 (SPEC)

> 문서 버전: 1.0.0
> 최종 수정일: 2026-06-20
> 작성자: PM (Product Owner)
> 대상: 디자인, 백엔드, 웹, 모바일, QA, DevOps 엔지니어
> 원본 아이디어: `/IDEA.md`

---

## 1. 서비스 개요 & 핵심 가치 제안

### 1.1 한 줄 소개
**WellNote는 "오늘의 기록"에 집중하도록 설계된, 하루가 지나면 자동으로 봉인되는 마크다운 메모 서비스입니다.**

### 1.2 핵심 가치 제안 (Value Proposition)
1. **현재에 집중하는 기록** — 메모는 작성한 당일(KST 기준)에만 수정 가능하며, 자정이 지나면 자동으로 readonly 상태로 봉인됩니다. 사용자는 과거에 매달리지 않고 오늘에 집중합니다.
2. **시각적 활동 추적** — GitHub contribution grid 형태의 활동 그리드로 "내가 얼마나 꾸준히 기록했는가"를 한눈에 확인합니다.
3. **크래딧 게이미피케이션** — 꾸준한 기록은 크래딧으로 보상되고, 게으름은 크래딧 차감으로 페널티가 부여됩니다. 크래딧이 0이 되면 과거의 readonly 메모를 읽을 수 없습니다.
4. **프라이버시 우선** — 모든 메모 본문은 R2에 envelope encryption으로 암호화되어 저장됩니다. 운영자도 평문에 접근할 수 없습니다.
5. **크로스 플랫폼** — 웹과 모바일(iOS/Android)에서 동일한 데이터에 접근할 수 있습니다.

### 1.3 비즈니스 목표 (KPI 후보)
- DAU/MAU 비율 ≥ 0.4 (꾸준한 기록 습관 형성 검증)
- 가입 후 7일 retention ≥ 35%
- 가입 후 30일 retention ≥ 20%
- 평균 메모 작성 길이 ≥ 200자 (의미 있는 기록 검증)

---

## 2. 사용자 페르소나 & 시나리오

### 2.1 페르소나 A — "지수" (28세, UX 디자이너)
- **배경**: 매일 회고/일기 습관을 들이고 싶지만 노션은 무겁고 종이 다이어리는 검색이 안 됨.
- **목표**: 가볍게 매일 한 페이지씩 기록하고, 한 달 후 "내가 얼마나 썼는지" 시각적으로 확인하고 싶음.
- **고민**: 과거 기록을 자꾸 수정하다 보면 본질이 흐려짐.
- **사용 시나리오**:
  1. 출근길 지하철에서 모바일 앱으로 "오늘의 목표" 메모 작성 (5분)
  2. 점심에 짧게 추가 메모 (자동저장)
  3. 퇴근 후 회고 작성 (마크다운 리스트 활용)
  4. 다음 날 아침에 어제 메모는 읽기만 가능. 새로운 메모 시작.
  5. 주말에 웹에서 활동 그리드를 보며 한 주를 돌아봄

### 2.2 페르소나 B — "민호" (35세, 시니어 개발자)
- **배경**: 매일 학습 로그와 트러블슈팅 기록을 마크다운으로 남기고 싶음. 검색이 빨라야 함.
- **목표**: 코드 블록과 함께 그날의 인사이트를 남기고, 키워드로 빠르게 찾기.
- **고민**: 기존 도구는 너무 많아 한곳에 집중이 안 됨.
- **사용 시나리오**:
  1. 웹에서 마크다운으로 코드 블록 포함 메모 작성
  2. 자동저장 동작 확인
  3. 다음 날, 검색창에서 "redis"로 어제 메모 찾기
  4. readonly 상태에서 본문 복사하여 외부 공유

---

## 3. 기능 요구사항

### 3.1 인증 / 회원 (Auth)

#### 3.1.1 이메일 + 비밀번호 가입
- 입력: email, password, displayName (선택, 비어 있으면 email 로컬 파트로 채움)
- 비밀번호 정책: 최소 8자, 영문/숫자/특수문자 중 2종류 이상 포함
- 이메일 유효성 검증 (RFC 5322)
- **이메일 확인 메일 발송** (Cloudflare Email Routing or Resend 사용 — **결정: Resend 사용. Cloudflare 우선 전략과 일관성을 위해 Email Routing inbound는 사용하지 않음**)
- 가입 직후 자동 로그인 (이메일 미인증 상태로 7일 유예 기간; 7일 경과 후 미인증 시 로그인 차단)
- 가입 즉시 **크래딧 +100** 초기 부여

#### 3.1.2 소셜 로그인
- **Google OAuth 2.0** (필수)
- **Apple Sign In** (필수, iOS 앱 스토어 정책 준수용)
- 향후 확장: Kakao, GitHub (v2)
- 신규 소셜 가입 시에도 크래딧 +100 부여
- 동일 이메일에 대해 이메일 가입과 소셜 가입은 **자동 연동** (이메일 기반 1:N 인증 메서드)
- 결정: Apple은 이메일을 hide 옵션으로 줄 수 있으므로 `apple_sub`을 primary key로 보조 저장

#### 3.1.3 로그아웃
- 현재 세션의 액세스 토큰/리프레시 토큰을 즉시 무효화 (KV에서 세션 키 삭제)
- 다른 디바이스의 세션은 유지됨 (전체 로그아웃은 별도 기능: "모든 디바이스에서 로그아웃")

#### 3.1.4 비밀번호 재설정
- 이메일로 1회용 토큰 링크 발송 (만료 30분)
- 토큰 사용 후 즉시 폐기, 모든 활성 세션도 무효화

#### 3.1.5 세션 / 토큰 정책
- 액세스 토큰: JWT, 만료 15분
- 리프레시 토큰: KV 저장, 만료 30일, rotating (사용 시 재발급)
- 디바이스당 1개 리프레시 토큰 유지 (탈취 방어)

### 3.2 메모 (Memo)

#### 3.2.1 작성
- 포맷: **GitHub Flavored Markdown (GFM)**
- 1일(KST 00:00~23:59:59) 사용자당 **단일 메모** (결정: 1일 1메모 모델 — 단순성, 활동 그리드 매핑과 정합성 확보)
  - 같은 날 추가 입력은 같은 메모에 append/edit
  - 새 날짜로 진입하면 새 메모 자동 생성
- 제목 자동 생성: 본문 첫 줄(최대 80자) → 비어 있으면 `YYYY-MM-DD` 형식
- 최대 본문 길이: **100,000자** (마크다운 raw 기준)

#### 3.2.2 자동저장
- 클라이언트 측 debounce **2초**
- 강제 저장 트리거: blur, 5분마다 정기, 페이지 unload 시 `navigator.sendBeacon` 또는 모바일 lifecycle hook
- 충돌 처리: 서버는 `updatedAt` 기반 optimistic lock; 클라이언트가 더 오래된 버전을 push하면 409 반환 + 최신 본문을 리스폰스에 동봉 (클라이언트 머지 UI 제공)

#### 3.2.3 수정
- **당일(KST) 메모만 수정 가능**
- 수정 가능 여부 판정 기준: `memo.dateKst === currentDateKst(now())`

#### 3.2.4 삭제
- **당일 메모만 삭제 가능** (지난 메모는 삭제 불가; 데이터 보존)
- 삭제 시: D1에서 `deletedAt` soft delete, R2 객체는 30일 후 라이프사이클로 영구 삭제
- 삭제된 당일 메모는 활동 그리드에서 제외

#### 3.2.5 Readonly 자동 전환
- KST 00:00에 Cron Trigger가 전일자 메모를 일괄 readonly로 전환
- 전환 처리:
  1. `is_readonly = true`, `readonly_at = now()` 업데이트
  2. **해당 사용자의 크래딧 -10 차감** (CreditTransaction에 사유: `READONLY_TRANSITION` 기록)
  3. **2일 연속 30자 이상 작성 확인** — 만족 시 크래딧 +20 추가 부여 (사유: `STREAK_BONUS`)
- 만약 메모를 작성하지 않은 날(빈 날)에는 차감/보너스 없음 (메모 자체가 없으니 readonly 전환 대상이 아님)
- **결정**: readonly 차감은 "메모를 작성한 날"에 한정. 작성하지 않은 날은 페널티 없음. 단, "2일 연속" streak 카운트는 작성한 날만 +1.

#### 3.2.6 조회
- 단일 메모 조회: 본인 메모만 (Admin은 별도 권한)
- 목록 조회: 페이지네이션 (cursor 기반, page size 30)

### 3.3 저장 (Storage)

#### 3.3.1 본문 (R2)
- 객체 키: `users/{userId}/memos/{memoId}.md.enc`
- 암호화: **Envelope Encryption**
  - DEK (Data Encryption Key): 메모마다 새로 생성 (AES-256-GCM)
  - KEK (Key Encryption Key): 사용자별 마스터키 (Cloudflare Secrets Store 또는 별도 KMS 위임; **결정: Phase 1은 Cloudflare Secrets에 환경별 마스터키 저장, Phase 2에서 외부 KMS 도입 검토**)
  - DEK는 KEK로 wrap하여 D1 `memo.encrypted_dek` 컬럼에 저장
- 본문 변경 시 새 DEK 생성하지 않고 동일 DEK 재사용 (성능; 키 회전은 별도 배치)

#### 3.3.2 메타데이터 (D1)
- D1 SQLite — 사용자, 메모 메타, 크래딧 트랜잭션, 어드민 로그 등

### 3.4 크래딧 시스템 (Credit)

#### 3.4.1 적립/차감 규칙
| 이벤트 | 변동 | 비고 |
|---|---|---|
| 가입 | +100 | 1회만, `SIGNUP_BONUS` |
| 메모 readonly 전환 | -10 | 작성한 날만, `READONLY_TRANSITION` |
| 2일 연속 30자 이상 작성 | +20 | streak 종료/체크 시점에 부여, `STREAK_BONUS` |
| Admin 부여 | +N | `ADMIN_GRANT` |
| Admin 회수 | -N | `ADMIN_REVOKE` |

#### 3.4.2 잔액 규칙
- 잔액은 항상 **0 이상** 유지 (음수 진입 차단)
- Admin이 회수할 때 현재 잔액보다 큰 금액 회수 시도 → 현재 잔액만큼만 차감 (clamp), 트랜잭션 로그에는 실제 차감액 기록
- readonly 전환 시 잔액 < 10 → 잔액 0으로 clamp

#### 3.4.3 0 이하 시 동작
- **readonly 메모 읽기 차단** (당일 메모는 계속 작성/읽기 가능 — 사용자가 "오늘은 쓸 수 있다"는 동기 부여)
- **결정 (작성 가능 여부 명시화)**: 크래딧 0이라도 **당일 메모 작성/수정/저장은 가능**. 단지 어제 이전의 readonly 메모만 읽기가 잠긴다.
- UI: readonly 메모 클릭 시 "크래딧이 부족합니다. 오늘의 메모를 30자 이상 작성하여 streak 보너스를 얻거나, 관리자에게 문의하세요." 모달

#### 3.4.4 Streak 판정 상세
- "2일 연속 30자 이상 작성" = 어제 메모 본문 길이 ≥ 30 AND 그제 메모 본문 길이 ≥ 30 (3일 연속, 4일 연속에도 매번 +20 부여 — 즉 streak가 끊기지 않으면 매일 +20 적립)
- 30자 판정 기준: **마크다운 raw 문자 수** (공백 포함, 마크다운 기호 포함). 줄바꿈 1자.

### 3.5 활동 표시 (Activity Grid)

- **52주 × 7일 = 364칸** 그리드 (GitHub contribution graph 동일 레이아웃)
- 가로축: 주(week), 세로축: 요일 (월요일 시작 — 결정: 한국 일반 캘린더 관행)
- 색상 단계 (4단계 + empty):
  - empty (메모 없음): `#F1F5F9`
  - level 1 (1~99자): `#DBEAFE`
  - level 2 (100~499자): `#93C5FD`
  - level 3 (500~1499자): `#3B82F6`
  - level 4 (1500자 이상): `#1D4ED8`
- 칸 hover/tap: 날짜 + 본문 길이 툴팁
- 칸 클릭: 해당 일자 메모 보기(Readonly) 화면으로 이동. 단, 크래딧 < 1 이면 차단 모달.
- 기본 표시: 오늘 기준 과거 364일
- 데이터 소스: `memo` 테이블의 `(user_id, date_kst, char_count)` 집계 (D1에 미리 집계 컬럼 보유)

### 3.6 검색 (Search)

- 검색 대상: 본인 메모만
- 검색 필드: **제목**, **본문(평문, 검색 인덱스 한정)**, **날짜 범위**
- 인덱스 전략:
  - 본문은 R2에 암호화되어 있으므로 서버에서 평문 인덱싱 불가
  - **결정**: 검색을 위해 **클라이언트 측 평문 캐시 + D1에 keyword digest 인덱스**를 함께 유지
    - D1 `memo_search_index` 테이블: `memo_id`, `tokens TEXT` (공백 분리 토큰의 lowercase 형태, 토큰 hash 아님; 사용자 본인의 D1 인덱스만 그 사용자에 노출되므로 평문 토큰 저장)
    - 토큰 생성: 2~30자 단어 단위, 한글/영문/숫자 추출, lowercase, 중복 제거
    - 이는 envelope encryption의 "본문 자체"는 R2에 암호화 보장이지만 **검색 가능한 토큰은 D1에 평문**으로 둔다는 trade-off — Phase 2에서 deterministic encryption / blind index로 강화
- 결과: 페이지네이션 (cursor 기반, 20개씩)
- 날짜 범위: `from`, `to` (KST 날짜)
- 정렬: `dateKst DESC` 기본

### 3.7 Admin

#### 3.7.1 접근 제어
- 별도 admin 도메인/경로: `/admin/*`
- 역할 `admin` 또는 `superadmin` (users.role)
- 모든 admin 액션은 `admin_actions` 테이블에 기록 (감사 로그)

#### 3.7.2 사용자 목록
- 페이지네이션 (50개씩)
- 검색: email, displayName, userId
- 필터: 가입일 범위, 크래딧 범위, 역할, 활성 여부
- 정렬: 가입일 DESC 기본

#### 3.7.3 사용자 상세
- 기본 정보, 크래딧 잔액, 최근 활동 30일, 메모 수, readonly 수, 누적 크래딧 이력
- **크래딧 부여/회수**: 사유(필수, 10~200자) 입력 후 +N / -N
- **메모 readonly 강제**: 특정 메모를 강제로 readonly로 전환 (사유 필수)
- **계정 정지/해제**: `is_suspended` 토글, 정지 시 모든 API 401
- **로그인 강제 종료**: 모든 디바이스 세션 무효화

#### 3.7.4 통계 대시보드
- 전체 가입자 수, 일간/주간 활성자, 일간 작성된 메모 수, 평균 본문 길이, 크래딧 총량/평균

---

## 4. 비기능 요구사항

### 4.1 성능
- API p50 응답 < 150ms, p95 < 500ms (Cloudflare Workers edge 기준)
- 메모 저장 자동저장 round-trip < 300ms (p95)
- 활동 그리드 초기 로딩 < 500ms

### 4.2 가용성
- 가용성 목표: 99.9% (월 다운타임 약 43분 이내)
- 의존성: Cloudflare Workers, D1, R2, KV — 동일 가용성 정책 상속
- Cron 실패 시 재시도: KST 00:00 readonly 전환 작업이 실패하면 최대 3회 재시도, 모두 실패 시 운영자 알림

### 4.3 보안

#### 4.3.1 암호화 키 관리
- KEK는 Cloudflare Secrets Store에 환경별(dev/stage/prod) 분리 저장
- DEK는 메모별 생성, KEK로 wrap 후 D1에 저장
- 키 회전: 분기별 KEK 회전 (배치로 모든 DEK 재wrap)

#### 4.3.2 인증 토큰
- Access token: HS256 JWT, secret은 Cloudflare Secrets, 만료 15분
- Refresh token: KV에 hash 저장 (raw 노출 방지), 만료 30일
- HTTPS 강제, HSTS 1년, Secure/HttpOnly/SameSite=Strict 쿠키 (웹), 모바일은 secure storage (Keychain/Keystore)

#### 4.3.3 RBAC
- 역할: `user`, `admin`, `superadmin`
- `admin`: 사용자 목록/상세, 크래딧 부여/회수
- `superadmin`: 위 + 다른 admin 임명/해임, 시스템 설정 변경

#### 4.3.4 기타
- Rate limiting: 사용자당 분당 60 req, 게스트 IP당 분당 20 req
- Audit log: 모든 admin 액션 + 인증 실패 + 권한 거부 90일 보존
- OWASP Top 10 대응, CSRF 토큰(웹 폼), CSP 헤더

### 4.4 접근성 / 국제화
- WCAG 2.1 AA 준수 목표
- 1차 언어: 한국어, 2차: 영어 (Phase 2)
- 다크모드: Phase 2 (MVP는 라이트 모드만)

### 4.5 시간대
- **모든 비즈니스 로직의 "오늘"은 KST(UTC+9) 고정**
- 사용자 로컬 시간대는 표시용으로만 (메모 작성 시각 등)
- 데이터베이스는 UTC ISO8601로 저장하되, `date_kst` 컬럼은 `YYYY-MM-DD` (KST) 별도 유지

---

## 5. 도메인 모델 개요

### 5.1 엔티티 목록

#### User
- `id` (UUID v7)
- `email` (unique)
- `email_verified_at` (nullable)
- `display_name`
- `password_hash` (nullable, 소셜만 가입한 경우)
- `role` (`user` | `admin` | `superadmin`)
- `credit_balance` (integer, ≥ 0, 캐시된 잔액; source of truth는 CreditTransaction 합계)
- `is_suspended` (boolean)
- `created_at`, `updated_at`

#### AuthMethod
- `id`
- `user_id` (FK User)
- `provider` (`email` | `google` | `apple`)
- `provider_sub` (소셜의 unique 식별자)
- `created_at`
- unique(provider, provider_sub)

#### Memo
- `id` (UUID v7)
- `user_id` (FK User)
- `date_kst` (DATE, `YYYY-MM-DD`)
- `title` (자동 생성, 최대 80자)
- `char_count` (integer, 본문 평문 길이)
- `r2_object_key` (string)
- `encrypted_dek` (bytes, base64)
- `dek_algo` (`aes-256-gcm`)
- `iv` (bytes)
- `is_readonly` (boolean)
- `readonly_at` (nullable timestamp)
- `deleted_at` (nullable timestamp, soft delete)
- `created_at`, `updated_at`
- unique(user_id, date_kst) where deleted_at IS NULL

#### MemoSearchIndex
- `memo_id` (PK, FK Memo)
- `user_id` (FK User, denormalized for query)
- `tokens` (TEXT, 공백 분리 토큰 lowercase)
- 인덱스: FTS5 가상 테이블 활용 (D1 지원)

#### CreditTransaction
- `id` (UUID v7)
- `user_id` (FK User)
- `delta` (integer, 양/음)
- `reason` (`SIGNUP_BONUS` | `READONLY_TRANSITION` | `STREAK_BONUS` | `ADMIN_GRANT` | `ADMIN_REVOKE`)
- `reference_id` (nullable, e.g. memo_id, admin_action_id)
- `balance_after` (integer)
- `created_at`

#### AdminAction
- `id`
- `actor_user_id` (FK User, admin/superadmin)
- `target_user_id` (FK User)
- `action_type` (`GRANT_CREDIT` | `REVOKE_CREDIT` | `FORCE_READONLY` | `SUSPEND_USER` | `UNSUSPEND_USER` | `KICK_SESSIONS`)
- `payload` (JSON, action별 상세)
- `reason` (TEXT, 10~200자)
- `created_at`

#### Session
- `id` (UUID, hashed refresh token)
- `user_id` (FK User)
- `device_label` (e.g. "Chrome on macOS")
- `ip` (denormalized, 최초 발급 IP)
- `expires_at`
- `created_at`, `last_used_at`
- 저장 위치: Cloudflare KV (`session:{hash}` → JSON)

#### PasswordResetToken
- `token_hash` (PK)
- `user_id`
- `expires_at`
- `used_at` (nullable)

#### EmailVerificationToken
- 동일 구조 (목적만 다름)

### 5.2 관계 다이어그램 (텍스트)

```
User 1 ---- N AuthMethod
User 1 ---- N Memo
User 1 ---- N CreditTransaction
User 1 ---- N Session
User 1 ---- N AdminAction (target)
User 1 ---- N AdminAction (actor; admin만)
Memo 1 ---- 1 MemoSearchIndex
Memo 1 ---- N CreditTransaction (reference_id)
```

---

## 6. API 엔드포인트 목록

> Base URL: `https://api.wellnote.app` (prod), `https://api.stage.wellnote.app`, `https://api.dev.wellnote.app`
> 인증: `Authorization: Bearer <access_token>` 헤더
> 응답: JSON, 에러는 `{ error: { code, message, details? } }`

### 6.1 인증
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/auth/signup` | X | 이메일+비밀번호 가입 |
| POST | `/auth/login` | X | 이메일+비밀번호 로그인 |
| POST | `/auth/social/google` | X | Google ID token 검증 후 로그인/가입 |
| POST | `/auth/social/apple` | X | Apple identity token 검증 후 로그인/가입 |
| POST | `/auth/logout` | O | 현재 세션 무효화 |
| POST | `/auth/logout/all` | O | 모든 디바이스 세션 무효화 |
| POST | `/auth/refresh` | refresh | 액세스 토큰 재발급 |
| POST | `/auth/password/reset/request` | X | 재설정 메일 발송 |
| POST | `/auth/password/reset/confirm` | X | 토큰으로 비밀번호 재설정 |
| POST | `/auth/email/verify/request` | O | 이메일 인증 메일 재발송 |
| POST | `/auth/email/verify/confirm` | X | 토큰으로 이메일 인증 |
| GET | `/auth/me` | O | 현재 사용자 정보 |

### 6.2 메모
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/memos/today` | O | 오늘(KST) 메모 조회 (없으면 빈 메모 생성 후 반환) |
| GET | `/memos/by-date/:dateKst` | O | 특정 일자 메모 조회 (readonly 포함) |
| GET | `/memos/:id` | O | 메모 단건 조회 |
| PATCH | `/memos/:id` | O | 메모 본문/제목 수정 (당일만) |
| DELETE | `/memos/:id` | O | 메모 soft delete (당일만) |
| GET | `/memos` | O | 메모 목록 (cursor 페이지네이션) |
| GET | `/memos/search` | O | 검색 (`q`, `from`, `to`, `cursor`) |

### 6.3 활동
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/activity/grid` | O | 활동 그리드 데이터 (기본 과거 364일) |

### 6.4 크래딧
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/credit/balance` | O | 현재 잔액 |
| GET | `/credit/transactions` | O | 거래 내역 (페이지네이션) |

### 6.5 Admin
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/admin/users` | O (admin+) | 사용자 목록 |
| GET | `/admin/users/:id` | O (admin+) | 사용자 상세 |
| POST | `/admin/users/:id/credit/grant` | O (admin+) | 크래딧 부여 |
| POST | `/admin/users/:id/credit/revoke` | O (admin+) | 크래딧 회수 |
| POST | `/admin/users/:id/suspend` | O (admin+) | 계정 정지 |
| POST | `/admin/users/:id/unsuspend` | O (admin+) | 정지 해제 |
| POST | `/admin/users/:id/sessions/kick` | O (admin+) | 모든 세션 종료 |
| POST | `/admin/memos/:id/force-readonly` | O (admin+) | 메모 강제 readonly |
| GET | `/admin/stats/overview` | O (admin+) | 대시보드 통계 |
| GET | `/admin/audit-log` | O (superadmin) | 감사 로그 |

### 6.6 시스템
| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| GET | `/health` | X | 헬스체크 |
| GET | `/version` | X | 빌드 버전 |

### 6.7 Cron (내부)
| 트리거 | 설명 |
|---|---|
| `0 15 * * *` (UTC 15:00 = KST 00:00) | 일별 readonly 전환 + 크래딧 정산 배치 |
| `0 * * * *` (매시 0분) | 만료된 세션/토큰 정리 |
| `0 18 * * 0` (KST 일요일 03:00) | 통계 집계 |

---

## 7. 에지케이스와 비즈니스 규칙

### 7.1 시간대 (KST 고정)
- 클라이언트가 어느 timezone이든 서버는 KST로 정규화
- 사용자가 KST 23:59에 작성 시작 → KST 00:00 넘기면? **저장 시점 timestamp의 KST 날짜**를 기준으로 함. 23:59:50에 작성하다가 00:00:10에 저장하면 새로운 날짜의 메모로 분류됨. 클라이언트는 KST 자정 임박 시 토스트 알림 ("곧 새로운 날의 메모로 전환됩니다") 표시 (자정 5분 전부터).

### 7.2 동시 작성 충돌
- 동일 사용자가 웹+모바일에서 동시에 작성 시
- 서버는 `updatedAt`을 optimistic lock으로 사용
- 클라이언트가 보낸 `expectedUpdatedAt`과 DB의 `updatedAt`이 다르면 409 Conflict, 최신 본문을 응답에 동봉
- 클라이언트는 머지 UI 표시 (사용자 선택: "내 변경사항 유지" / "서버 버전 사용" / "수동 머지")

### 7.3 크래딧 음수 방지
- 모든 차감 트랜잭션은 SQL 레벨에서 `MAX(balance - delta, 0)`로 clamp
- D1 트랜잭션 내에서 atomic 처리: balance 업데이트 + CreditTransaction insert를 동일 트랜잭션으로

### 7.4 Readonly 우회 시도 차단
- 메모 수정 API는 서버 측에서 `memo.date_kst === currentDateKst()` 검증 (클라이언트 신호 무시)
- 클라이언트가 `is_readonly=false`로 위조해서 보내도 무시 (서버에서 다시 판정)
- Readonly 메모 조회 시 크래딧 < 1 → 403 Forbidden, `error.code = "INSUFFICIENT_CREDIT"`

### 7.5 가입 직후 메모 작성 전 readonly 전환
- 가입했지만 첫 메모를 작성하지 않은 사용자에게는 KST 00:00 배치가 아무 영향 없음 (메모가 없으므로 차감/streak 평가 대상 아님)

### 7.6 동일 이메일 계정 통합
- 이메일 가입 후 동일 이메일로 Google 로그인 → 동일 User에 AuthMethod 추가 (자동 연동)
- Apple "hide email"로 가입한 경우 → 별도 User로 처리 (실제 이메일 미상)

### 7.7 메모 길이 초과
- 100,000자 초과 입력 시 클라이언트에서 차단 + 토스트
- 서버도 검증, 초과 시 413 Payload Too Large

### 7.8 R2 객체 미스매치 / 손상
- 본문 fetch 시 R2 404 → D1 메타와 불일치 → 500 + 운영자 알림 (Sentry), 사용자에게는 "메모를 불러올 수 없습니다. 재시도하세요" 메시지
- 무결성: 본문 저장 시 SHA-256 hash를 D1에 기록, 조회 시 검증

### 7.9 Admin이 자신의 크래딧 조작
- 허용 (감사 로그에는 남음). 단, `superadmin`만 자신의 role 변경 가능, `admin`은 자신을 강등할 수 없음.

### 7.10 계정 정지 사용자
- 모든 API 401 (`ACCOUNT_SUSPENDED` 코드)
- 다만 `/auth/me`만 200 + 정지 상태 표시 (사용자가 자기 상태를 알아야 하므로)
- 정지 중 readonly 전환 배치는 그대로 동작 (크래딧 차감 등) — 또는 stop 결정 필요. **결정: 정지 중에는 차감/streak 평가 모두 일시 중지. 해제 후 정상 재개.**

### 7.11 Streak 계산 시 timezone 분기
- 정확히 KST 기준으로 어제/그제 판정. 사용자 로컬 시간대 무관.

---

## 8. 권장 기술 스택 (Rationale)

### 8.1 백엔드
- **Cloudflare Workers (TypeScript)** + **Hono** 프레임워크
  - Rationale: IDEA.md에서 R2 명시. Cloudflare 스택과 정합성 + edge 글로벌 저지연
  - Hono: 가벼움, Workers-friendly, OpenAPI 어댑터 지원
- **D1 (SQLite)** for relational data
  - Rationale: Cloudflare 통합, 무료 티어, FTS5 지원으로 검색 가능
- **R2** for memo body (encrypted blobs)
  - Rationale: IDEA.md 명시
- **KV** for sessions and rate limit counters
  - Rationale: 짧은 TTL과 빠른 read에 최적
- **Cloudflare Cron Triggers** for KST 00:00 배치
- **Cloudflare Secrets Store** for KEK/JWT secret
- **Cloudflare Email Routing** + **Resend** for 트랜잭션 메일
  - 결정: 발송은 Resend (deliverability + 템플릿), DNS는 Cloudflare

### 8.2 웹
- **Next.js 15 (App Router) → Cloudflare Pages (Workers runtime)**
  - **결정: Next.js 채택**
  - Rationale: SSR/SSG 유연성, SEO(랜딩 페이지), 인증 콜백 처리 편의성, Cloudflare Pages 호환
  - 대안 Vite+React SPA는 더 가볍지만 인증 콜백, OG 태그, 랜딩 SSR 등에서 Next.js 우위
- 마크다운 에디터: `@uiw/react-md-editor` 또는 `Tiptap` (결정: **Tiptap** + Markdown 확장; UX 우수)
- 마크다운 렌더: `react-markdown` + `remark-gfm`
- 상태관리: `Zustand`
- 데이터 페칭: `TanStack Query`
- 스타일: `Tailwind CSS` + `shadcn/ui` (디자인 토큰 매핑 용이)

### 8.3 모바일
- **Flutter 3.x** (Dart)
  - Rationale: IDEA.md 명시. 단일 코드베이스로 iOS/Android
- 패키지: `flutter_riverpod` (상태), `dio` (HTTP), `flutter_secure_storage` (토큰), `flutter_markdown` (렌더), `markdown_editor_plus` 또는 자체 위젯 (에디터)
- 푸시(v2): Firebase Cloud Messaging

### 8.4 테스트
- 백엔드: **Vitest** + Miniflare/wrangler dev (Workers 모의 환경)
- 웹 E2E: **Playwright**
- 모바일: **`integration_test`** + Patrol (선택)
- 부하 테스트: k6 (Cloudflare 환경 기준)

### 8.5 CI/CD
- GitHub Actions
- 환경: `dev` → `stage` → `prod` 순차 배포
- 백엔드/웹: Cloudflare Wrangler deploy
- 모바일: Codemagic 또는 GitHub Actions + Fastlane (TestFlight, Play Internal)

### 8.6 모니터링
- Cloudflare Workers Logs + Analytics Engine
- Sentry (앱/웹 에러)
- Better Stack (Uptime + 알림)

---

## 9. MVP 범위와 v2 후순위

### 9.1 MVP (Phase 1 — 8주 목표)
- 이메일/Google/Apple 인증
- 1일 1메모 작성/수정/삭제, 자동저장
- KST 자정 readonly 전환 + 크래딧 차감/보너스 배치
- 크래딧 시스템 (가입/readonly/streak)
- 활동 그리드
- 검색 (제목/본문/날짜)
- Admin: 사용자 목록/상세/크래딧 부여·회수/계정 정지
- 웹 (Next.js + Cloudflare Pages)
- 모바일 (Flutter, iOS/Android)
- dev/stage/prod CICD

### 9.2 v2 (Phase 2)
- 다크모드
- 영어 i18n
- 푸시 알림 (자정 5분 전, streak 위험 알림)
- 이미지 첨부 (R2 별도 객체)
- 메모 공유 링크 (읽기 전용 공개 URL)
- 외부 KMS (AWS KMS / Vault) 도입
- Blind index 검색 (deterministic encryption)
- Kakao/GitHub 소셜 로그인
- 크래딧 상점 (배경 테마 구매 등)
- 데이터 export (zip of markdown)

### 9.3 명시적 OUT OF SCOPE (MVP)
- 협업/공유
- 댓글
- 이미지 업로드
- 결제
- 푸시 알림
- 다국어
- 오프라인 모드 (모바일은 일부 캐시만)

---

## 10. 결정 요약 (Decision Log)

| # | 결정 사항 | 근거 |
|---|---|---|
| D1 | 1일 1메모 모델 | 활동 그리드 매핑/단순성 |
| D2 | KST 고정 (UTC+9) | 한국 사용자 우선 |
| D3 | 크래딧 0 시 readonly 읽기만 차단, 작성은 가능 | 사용자 동기부여 |
| D4 | Envelope encryption, KEK는 Cloudflare Secrets | MVP 단순성, Phase 2에 외부 KMS |
| D5 | 검색 토큰은 D1 평문 저장 (사용자 본인 격리) | MVP 검색 가능성 확보, Phase 2 강화 |
| D6 | 메일 발송 Resend | 템플릿/deliverability |
| D7 | 웹은 Next.js | SSR/콜백/SEO 우위 |
| D8 | Streak: 매일 streak 유지 시 매일 +20 | 단순 규칙, 동기부여 강화 |
| D9 | 메모 삭제는 당일만 | 과거 기록 보존 원칙 |
| D10 | 정지 사용자는 차감/streak 평가 일시 중지 | 부당 페널티 방지 |
| D11 | 활동 그리드 시작 요일 = 월요일 | 한국 캘린더 관행 |
| D12 | 본문 최대 100,000자 | 마크다운 일기로 충분 |
| D13 | Tiptap 에디터 채택 | UX 우수 |
| D14 | Apple은 `apple_sub` 별도 저장 | hide email 대응 |

---

문서 끝.
