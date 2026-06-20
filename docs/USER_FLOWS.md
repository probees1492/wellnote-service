# WellNote 주요 사용자 플로우 (USER_FLOWS)

> 문서 버전: 1.0.0
> 본 문서는 SPEC.md의 기능 요구사항을 기반으로 사용자 여정을 단계별로 기술합니다.
> 각 단계는 [화면] / [사용자 액션] / [시스템 처리 + 데이터 변화] 3축으로 설명합니다.

---

## 플로우 1 — 신규 가입 → 첫 메모 작성 → 다음날 readonly 전환

### 1.1 신규 가입 (이메일 + 비밀번호)

```
[1] 랜딩 화면
    └─ 사용자: "시작하기" 버튼 클릭
    └─ 시스템: /signup 라우트로 이동

[2] 가입 화면
    └─ 사용자: email, password, displayName 입력 후 "가입" 클릭
    └─ 시스템:
         (a) 클라이언트 검증 (이메일 형식, 비밀번호 정책)
         (b) POST /auth/signup
         (c) 서버: User row INSERT (credit_balance=100)
         (d) 서버: CreditTransaction INSERT (delta=+100, reason=SIGNUP_BONUS, balance_after=100)
         (e) 서버: AuthMethod INSERT (provider=email)
         (f) 서버: EmailVerificationToken 생성 + Resend로 인증메일 발송
         (g) 서버: access_token + refresh_token 발급, KV에 Session 저장
         (h) 응답 200 + tokens + user

[3] 환영 화면 (인증 메일 안내 배너)
    └─ 사용자: "오늘의 메모 시작하기" 클릭
    └─ 시스템: /today 라우트로 이동
```

데이터 변화:
- D1: User(+1), AuthMethod(+1), CreditTransaction(+1)
- KV: Session(+1)
- 외부: Resend 이메일 발송 1건

### 1.2 첫 메모 작성

```
[4] 메모 작성 화면 (오늘 날짜)
    └─ 시스템: GET /memos/today
         (a) 서버: 해당 user + dateKst 메모 조회 (없음)
         (b) 서버: 빈 Memo row INSERT (char_count=0, is_readonly=false)
         (c) R2: 빈 본문 객체 PUT (envelope encryption, DEK 생성/wrap)
         (d) 응답 200 + memo (body는 평문으로 복호화 후 반환)

[5] 사용자: 본문 입력 시작
    └─ 클라이언트:
         (a) 2초 debounce 후 PATCH /memos/:id (body, expectedUpdatedAt)
         (b) 시스템: dateKst 검증 → 본인 + 당일 OK
         (c) 서버: 본문 암호화 후 R2 PUT (overwrite, 동일 DEK)
         (d) D1: Memo 업데이트 (char_count, title 갱신, updated_at)
         (e) D1: MemoSearchIndex 업데이트 (tokens 재생성)
         (f) 응답 200 + updatedAt
    └─ UI: 우상단 "저장됨 · 12:34" 표시

[6] 사용자: blur (탭 전환) 또는 5분 정기 자동저장
    └─ 동일 처리 반복
```

데이터 변화:
- D1: Memo(+1) → 업데이트 N회, MemoSearchIndex 동기 갱신
- R2: 객체 1개 (반복 PUT으로 overwrite)

### 1.3 다음날 readonly 전환

```
[7] KST 23:55 ~ 23:59 (자정 임박)
    └─ 클라이언트: 토스트 "5분 후 새 날짜로 전환됩니다. 저장 중..."
    └─ 클라이언트: 강제 저장 1회

[8] KST 00:00 (Cron Trigger 발동)
    └─ Cloudflare Cron: "0 15 * * *" UTC → KST 00:00
    └─ 서버 배치:
         (a) 어제(KST) 작성된 모든 Memo where is_readonly=false 조회
         (b) 각 메모:
              - Memo.is_readonly = true, readonly_at = now()
              - CreditTransaction (delta=-10, reason=READONLY_TRANSITION, reference_id=memo_id)
              - User.credit_balance -= 10 (MAX 0)
         (c) 각 사용자 streak 확인:
              - 어제 char_count ≥ 30 AND 그제 char_count ≥ 30 → +20
              - CreditTransaction (delta=+20, reason=STREAK_BONUS)
         (d) 실패한 사용자 ID는 retry queue로

[9] 사용자: 다음날 아침 앱 진입
    └─ 클라이언트: GET /memos/today
         (a) 서버: 새 dateKst의 빈 Memo INSERT (없으면 자동 생성)
         (b) 응답 200 + 새 빈 메모
    └─ UI: 오늘의 빈 메모. 좌측 사이드바에 "어제의 메모(readonly)" 링크 표시

[10] 사용자: 어제 메모 클릭
    └─ 시스템: /memos/by-date/2026-06-19
         (a) GET /memos/by-date/2026-06-19
         (b) 응답: memo(is_readonly=true), body decrypted
    └─ UI: 읽기 전용 뷰 (수정/저장 버튼 비활성)
```

데이터 변화:
- D1: Memo (is_readonly=true), CreditTransaction(+1 또는 +2), User.credit_balance 갱신
- 사용자 잔액: 100 → 90 (readonly -10) [streak 미충족 가정]

---

## 플로우 2 — 소셜 로그인 (Google)

```
[1] 로그인 화면
    └─ 사용자: "Google로 계속하기" 클릭
    └─ 시스템: Google OAuth 인가 페이지로 이동 (state, nonce 생성)

[2] Google 동의 화면
    └─ 사용자: 동의 → Google이 redirect_uri로 code 전달

[3] 웹: /auth/callback/google
    └─ 클라이언트:
         (a) code를 서버로 전달: POST /auth/social/google { code }
         (b) 서버: Google token endpoint에서 ID token 교환
         (c) 서버: ID token 검증 (issuer, audience, signature, expiry, nonce)
         (d) 서버: email + provider_sub 추출

[4] 분기 처리
    (4a) 신규 가입:
         - User 생성 (credit_balance=100, email_verified_at=now if email_verified by Google)
         - AuthMethod(provider=google, provider_sub=sub) INSERT
         - CreditTransaction(+100, SIGNUP_BONUS)
    (4b) 기존 사용자 동일 google 계정:
         - 로그인 처리
    (4c) 기존 이메일 사용자 (provider=email)와 동일 email:
         - 자동 연동: AuthMethod(provider=google) 추가
         - 로그인 처리

[5] 토큰 발급
    └─ 서버: access_token + refresh_token 발급, Session KV 저장
    └─ 응답 200 + tokens + user

[6] 메모 화면으로 이동
```

데이터 변화: D1 User(±1), AuthMethod(±1), CreditTransaction(±1) / KV Session(+1)

### 2.1 Apple 차이점

```
[2-Apple] Apple Sign In
    └─ Apple은 첫 가입 시에만 email/name 반환
    └─ "Hide my email"이면 email = privaterelay 주소
    └─ provider_sub만 unique 식별자로 신뢰
    └─ id_token 검증 (Apple JWKS) — issuer https://appleid.apple.com
```

---

## 플로우 3 — 크래딧 소진 → 차단 → 보충

### 3.1 크래딧 소진 진행

```
[가정] 사용자 잔액: 30, 매일 메모 작성하지만 매번 25자 (streak 미충족)

[Day N → N+1 자정]
    └─ readonly 전환 -10 → 잔액 20

[Day N+1 → N+2 자정]
    └─ readonly 전환 -10 → 잔액 10

[Day N+2 → N+3 자정]
    └─ readonly 전환 -10 → 잔액 0

[Day N+3 → N+4 자정]
    └─ readonly 전환 시도 -10 → clamp 0 (음수 진입 차단)
    └─ CreditTransaction(delta=-10, balance_after=0) 기록은 정상 (감사용)
    └─ 실질 차감액: 10 (D11 결정 — 다른 안: 0만 차감해야 정확)
    └─ 결정 보완: 잔액보다 큰 차감 시도 시 가능한 만큼만 실제 차감.
       즉, 잔액 0이면 delta=0 으로 트랜잭션 기록 후 종료.
```

### 3.2 차단 경험

```
[1] 사용자: 활동 그리드에서 과거 일자 칸 클릭
    └─ 시스템: GET /memos/by-date/2026-06-15
    └─ 서버: User.credit_balance 조회 → 0
    └─ 서버: 403 INSUFFICIENT_CREDIT 응답

[2] UI: 모달 표시
    제목: "크래딧이 부족합니다"
    본문: "지난 메모를 읽으려면 크래딧이 1 이상 필요해요.
           오늘의 메모를 30자 이상 작성하고 내일까지 이어가면
           +20 크래딧이 적립됩니다."
    버튼: "오늘 메모 쓰러 가기" / "닫기"
```

### 3.3 보충

```
[Day M] 사용자: 오늘 메모 50자 작성
    └─ 클라이언트 자동저장
    └─ 서버: Memo.char_count=50 갱신
    └─ (당일 메모는 readonly가 아니므로 즉시 적립 없음)

[Day M → M+1 자정]
    └─ readonly 전환 -10 → 잔액 0 (이미 0이라 clamp; 실차감 0)
    └─ streak 확인:
         - 어제(=Day M) char_count=50 ≥ 30 OK
         - 그제 char_count=25 < 30 FAIL
    └─ streak 보너스 없음 → 잔액 0 유지

[Day M+1] 사용자: 또 50자 작성

[Day M+1 → M+2 자정]
    └─ readonly 전환 -10 (clamp 0)
    └─ streak 확인:
         - 어제 50, 그제 50 → 둘 다 30 이상 OK
         - +20 STREAK_BONUS → 잔액 20

[Day M+2 아침]
    └─ 사용자: 잔액 20 확인 → 과거 readonly 메모 읽기 가능
```

데이터 변화 핵심:
- 잔액 진행: 30 → 20 → 10 → 0 → 0 → 0 → 0 → 20

### 3.4 Admin 보충 (대안 경로)

```
[1] 사용자: 고객 지원 요청
[2] Admin: 사용자 검색 → 상세 → "크래딧 부여 +30, 사유: 신규 캠페인 참여"
[3] 시스템:
    - AdminAction INSERT
    - CreditTransaction(+30, ADMIN_GRANT, reference_id=admin_action_id)
    - User.credit_balance += 30
[4] 사용자: 다음 요청에서 401 → 잔액 30 확인 → 정상 사용
```

---

## 플로우 4 — Admin이 사용자 크래딧 조정

### 4.1 Admin 로그인 및 진입

```
[1] Admin 로그인 화면 (/admin/login)
    └─ 사용자: email + password
    └─ 서버: 일반 인증 + role IN (admin, superadmin) 확인
    └─ 미충족 시 403

[2] Admin 대시보드 (/admin)
    └─ 시스템: GET /admin/stats/overview
    └─ UI: 가입자 수, DAU, 신규/탈퇴, 메모 수, 평균 크래딧 등 카드
```

### 4.2 사용자 검색 → 상세

```
[3] /admin/users 이동
    └─ 시스템: GET /admin/users?query=jisoo&page=1&size=50
    └─ UI: 테이블 (email, displayName, credit_balance, role, is_suspended, created_at, [상세] 버튼)

[4] [상세] 클릭 → /admin/users/:id
    └─ 시스템: GET /admin/users/:id
    └─ UI:
         - 기본 정보 카드
         - 크래딧 카드 (현재 잔액, 누적 적립/차감, [부여] [회수] 버튼)
         - 최근 활동 30일 (활동 그리드 미니)
         - 크래딧 트랜잭션 테이블 (페이지네이션)
         - 위험 액션 영역: [정지] [세션 종료] [메모 강제 readonly]
```

### 4.3 크래딧 부여

```
[5] [부여] 버튼 클릭 → 모달 열림
    └─ 입력: amount (1~10,000), reason (10~200자)
    └─ 확인 → POST /admin/users/:id/credit/grant { amount, reason }
    └─ 서버:
         (a) admin role 확인
         (b) AdminAction INSERT (action_type=GRANT_CREDIT, payload={amount}, reason)
         (c) CreditTransaction INSERT (delta=+amount, reason=ADMIN_GRANT, reference_id=admin_action_id, balance_after=new)
         (d) User.credit_balance += amount (atomic)
         (e) 응답 200 + 새 잔액
    └─ UI: 토스트 "크래딧 +30 부여 완료. 새 잔액 80"
    └─ 트랜잭션 테이블 자동 새로고침
```

데이터 변화: AdminAction(+1), CreditTransaction(+1), User.credit_balance(+amount)

### 4.4 크래딧 회수

```
[6] [회수] 버튼 클릭 → 모달
    └─ 입력: amount (1~10,000), reason (10~200자)
    └─ 확인 → POST /admin/users/:id/credit/revoke { amount, reason }
    └─ 서버:
         (a) actualDelta = MIN(amount, currentBalance)
         (b) AdminAction INSERT (payload={requested: amount, actual: actualDelta})
         (c) CreditTransaction (delta=-actualDelta, reason=ADMIN_REVOKE)
         (d) User.credit_balance -= actualDelta
         (e) 응답 200 + new balance + actualDelta
    └─ UI: 회수 요청량과 실제 회수량이 다를 경우 토스트로 안내
         "요청 50, 실제 회수 30 (잔액 0)"
```

### 4.5 메모 강제 readonly

```
[7] 사용자 상세 → "오늘 메모 보기" 링크 → 메모 ID 확인
    └─ Admin: [강제 readonly] 클릭 → reason 입력 → 확인
    └─ POST /admin/memos/:id/force-readonly { reason }
    └─ 서버:
         (a) Memo.is_readonly = true, readonly_at = now()
         (b) AdminAction INSERT (action_type=FORCE_READONLY)
         (c) 크래딧 차감 없음 (일반 readonly 전환과 구분)
    └─ 사용자가 다음에 접근하면 readonly 상태로 표시
```

### 4.6 감사 로그

```
[8] superadmin: /admin/audit-log
    └─ 시스템: GET /admin/audit-log?actor=&target=&from=&to=
    └─ UI: 모든 admin 액션 시간순 테이블
         (actor → target, action_type, payload, reason, created_at)
```

---

## 플로우 5 — 검색

```
[1] 메모 목록 화면 상단 검색바
    └─ 사용자: "redis" 입력
    └─ 클라이언트: 300ms debounce 후 GET /memos/search?q=redis
    └─ 서버:
         (a) 본인 user_id로 MemoSearchIndex FTS5 검색
         (b) hit memo_id 리스트
         (c) Memo 메타 join → 제목, 날짜, 발췌
    └─ 응답: { items: [...], nextCursor }
    └─ UI: 검색 결과 카드 리스트, 키워드 highlight

[2] 결과 카드 클릭
    └─ 시스템: /memos/:id (readonly 또는 editable)
    └─ 크래딧 < 1 + readonly → 차단 모달
```

---

## 플로우 6 — 비밀번호 재설정

```
[1] 로그인 화면 → "비밀번호를 잊으셨나요?"
    └─ 입력: email → POST /auth/password/reset/request
    └─ 서버: PasswordResetToken 생성 (30분 유효), Resend로 메일 발송
    └─ UI: "이메일이 발송되었습니다" (이메일 존재 여부 노출 X)

[2] 사용자: 메일의 링크 클릭 → /reset?token=...
    └─ UI: 새 비밀번호 입력 (2회)
    └─ POST /auth/password/reset/confirm { token, newPassword }
    └─ 서버:
         (a) 토큰 검증 (해시, 만료, used_at IS NULL)
         (b) User.password_hash 업데이트
         (c) PasswordResetToken.used_at = now()
         (d) 모든 Session KV 삭제 (전체 로그아웃)
    └─ UI: "비밀번호가 변경되었습니다. 다시 로그인하세요"
```

---

## 플로우 7 — 활동 그리드 진입 및 탐색

```
[1] 홈/대시보드 화면
    └─ 시스템: GET /activity/grid?from=&to=
    └─ 서버: Memo 집계 (user_id, dateKst, char_count) 364일치
    └─ 응답: { cells: [{ date, level, charCount, memoId }] }

[2] UI: 52주 × 7일 그리드 렌더 (요일 시작 = 월요일)
    └─ 색상 4단계 + empty (SPEC §3.5)

[3] 사용자: 칸 hover → 툴팁 (날짜 + 글자수)
    └─ 사용자: 칸 클릭
    └─ 클라이언트: 크래딧 확인
         - readonly 일자 AND 크래딧 < 1 → 차단 모달
         - else → /memos/by-date/:date 이동
```

---

문서 끝.
