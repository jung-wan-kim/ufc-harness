# UFC-Harness QA 테스트 계획서

## 프로젝트 정보

- **프로젝트**: UFC-Harness (천하제일 에이전트 무도회)
- **생성일**: 2026-04-21
- **요구사항 소스**: `SPEC.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/JUDGING.md`, `packages/db/prisma/schema.prisma`, Supabase migrations
- **인벤토리**: `.qa-inventory.json` (buttons: 14, forms: 1, modals: 0, api_endpoints: 9, db_entities: 24)
- **시나리오 변경 금지** — 요구사항 변경 시에만 수정

## 시나리오 요약

| 카테고리 | TC 수 | CRITICAL | HIGH | MEDIUM | LOW |
|---------|------|----------|------|--------|-----|
| AUTH | 12 | 5 | 4 | 2 | 1 |
| HARNESS-CRUD | 14 | 6 | 5 | 2 | 1 |
| HARNESS-CLICK | 8 | 3 | 4 | 1 | 0 |
| LEADERBOARD | 6 | 1 | 3 | 1 | 1 |
| EDGE-FUNC | 9 | 6 | 2 | 1 | 0 |
| CRON | 3 | 1 | 2 | 0 | 0 |
| SECURITY | 12 | 6 | 5 | 1 | 0 |
| DB-RLS | 8 | 5 | 3 | 0 | 0 |
| NAVIGATION | 4 | 0 | 2 | 2 | 0 |
| ACCESSIBILITY | 3 | 0 | 0 | 2 | 1 |
| **총계** | **79** | **33** | **30** | **12** | **4** |

## 공통 전제 조건

- Vercel prod: `https://ufc-harness.vercel.app`
- Supabase: `https://hihafrpktdotahsbcqfa.supabase.co`
- 테스트 계정: GitHub 계정 (실제 OAuth 필요)
- 로컬: `pnpm dev` 시 `portless`로 래핑
- agent-browser / curl 준비

## TC 커버리지 매트릭스

| 기능/페이지 | UI클릭 | API payload | DB직접 | modal | native confirm | console | toast |
|------------|:------:|:-----------:|:------:|:-----:|:--------------:|:-------:|:-----:|
| AUTH login | ✅ | ✅ | - | - | - | ✅ | ✅ |
| AUTH callback | - | ✅ | ✅ | - | - | ✅ | - |
| HARNESS submit 폼 | ✅ | ✅ | ✅ | - | - | ✅ | ✅ |
| HARNESS repo picker | ✅ | ✅ | - | - | - | ✅ | - |
| HARNESS 리스트 | ✅ | ✅ | ✅ | - | - | ✅ | - |
| LEADERBOARD | ✅ | ✅ | ✅ | - | - | ✅ | - |
| EDGE dispatch | - | ✅ | ✅ | - | - | - | - |
| EDGE upload-result | - | ✅ | ✅ | - | - | - | - |
| EDGE judge-submission | - | ✅ | ✅ | - | - | - | - |
| SECURITY RLS | - | ✅ | ✅ | - | - | - | - |

TC 커버리지: 총 79 TC, 모든 기능 3+ 차원 커버 (❌ 없음)

## 테스트 실행 순서

1. AUTH — 전체 전제 조건
2. EDGE-FUNC — 백엔드 무결성 (AUTH와 독립)
3. DB-RLS — 보안 기반
4. HARNESS-CRUD → HARNESS-CLICK
5. LEADERBOARD
6. SECURITY 횡단
7. NAVIGATION / ACCESSIBILITY / CRON

---

## 상세 시나리오

### AUTH: 인증/인가

#### TC-AUTH-001: 랜딩 페이지 렌더링
- **심각도**: HIGH
- **전제**: 미로그인
- **단계**: `GET /` → 200 + "천하제일 에이전트 무도회" 텍스트 + SiteHeader 렌더
- **검증 수준**: L1(UI), L4(console 0 error)
- **PASS**: HTTP 200 + `<title>UFC-Harness` + 로그인 버튼 노출
- **covers_inventory**: buttons[but-*hero], db_entities[-]

#### TC-AUTH-002: 로그인 페이지 렌더링
- **심각도**: HIGH
- **단계**: `GET /auth/login` → "GitHub으로 로그인" 버튼 + scopes 힌트 `read:user user:email repo`
- **검증**: L1, L4
- **PASS**: 매직링크 흔적 0, GitHub 버튼 1개, scopes 표기 확인

#### TC-AUTH-003: GitHub OAuth 리다이렉트 시작
- **심각도**: CRITICAL
- **단계**: 로그인 버튼 클릭 → `signInWithOAuth({provider:'github'})` 호출 → GitHub authorize URL 이동
- **검증**: L2 (Supabase API 응답), redirectTo가 `/auth/callback?next=/submit` 포함
- **PASS**: `github.com/login/oauth/authorize` URL로 이동

#### TC-AUTH-004: 콜백 성공 — 정상 흐름
- **심각도**: CRITICAL
- **단계**: GitHub 승인 → `/auth/callback?code=xxx` → `exchangeCodeForSession` → `save_github_token` Edge Function → `/submit` 리다이렉트
- **검증**: L3 (private.user_github_tokens row 생성), L4
- **PASS**: 쿠키 세션 설정 + `private.user_github_tokens.user_id = auth.uid()` 존재

#### TC-AUTH-005: 콜백 실패 — no_code
- **심각도**: CRITICAL
- **단계**: `/auth/callback` (code 없음) → `/auth/error?reason=no_code`
- **검증**: L1 (error 페이지 reason 표시)
- **PASS**: 리다이렉트 + "OAuth 코드가 없다" 표시

#### TC-AUTH-006: 콜백 실패 — exchange_failed
- **심각도**: HIGH
- **단계**: 만료된/잘못된 code → `/auth/error?reason=exchange_failed`
- **검증**: L1
- **PASS**: reason 메시지 표시 + 재로그인 링크 노출

#### TC-AUTH-007: 콜백 실패 — token_save_failed
- **심각도**: CRITICAL
- **단계**: user-action Edge Function 5xx 시 signOut + `/auth/error?reason=token_save_failed`
- **검증**: L2 (saveRes.ok=false 감지), L3 (auth 쿠키 무효화)
- **PASS**: 에러 swallow 없음 — 사용자에게 가시적 실패

#### TC-AUTH-008: 콜백 실패 — no_provider_token
- **심각도**: HIGH
- **단계**: GitHub이 provider_token 미반환 시 signOut + reason=no_provider_token
- **검증**: L1, L2
- **PASS**: 재로그인 유도

#### TC-AUTH-009: 세션 유지 — middleware refresh
- **심각도**: CRITICAL
- **단계**: 로그인 후 `/submit` 접속 → middleware가 쿠키 refresh + `Cache-Control: private, no-store` 헤더 설정
- **검증**: L2 (응답 헤더), L4
- **PASS**: 모든 응답 `Cache-Control: private, no-store`

#### TC-AUTH-010: 로그아웃
- **심각도**: MEDIUM
- **단계**: UserMenu 열기 → "로그아웃" 클릭 → `signOut()` → `router.push('/')` + refresh
- **검증**: L1 (헤더에 로그인 버튼 재노출), L2
- **PASS**: 쿠키 제거 + 리다이렉트

#### TC-AUTH-011: 미로그인 보호 라우트
- **심각도**: HIGH
- **단계**: 미로그인 상태 `/submit` 접근 → 307 리다이렉트 → `/auth/login?next=/submit`
- **검증**: L2
- **PASS**: redirect location 정확

#### TC-AUTH-012: 로그인 시 UserMenu 노출 (접근성)
- **심각도**: LOW
- **단계**: 로그인 → 헤더 우측 avatar + handle 노출 → 클릭 → 드롭다운
- **검증**: L1, L4
- **PASS**: avatar, email, handle, GitHub 링크 모두 가시

---

### HARNESS-CRUD: 하네스 등록/조회

#### TC-HARNESS-CRUD-001: /submit 미로그인 리다이렉트
- **심각도**: HIGH
- **단계**: 미로그인 `/submit` → `/auth/login?next=/submit`
- **검증**: L2
- **PASS**: 307

#### TC-HARNESS-CRUD-002: /submit 로그인 렌더링
- **심각도**: CRITICAL
- **단계**: 로그인 후 `/submit` → 내 하네스 리스트 + 참전 폼 노출
- **검증**: L1, L2 (`get_github_token_status` 200), L4
- **PASS**: hasGithubToken 서버 판정이 true일 때 repo picker 노출

#### TC-HARNESS-CRUD-003: repo 목록 로딩
- **심각도**: CRITICAL
- **단계**: `/submit` 접속 시 `GET /api/github/repos` → Edge Function `user-action{action:'github_repos'}` → GitHub API proxy
- **검증**: L2 (200 + repos 배열), L4
- **PASS**: 최대 100개 repo, 정렬 pushed desc, 필드만 {id, full_name, html_url, description, private, default_branch, pushed_at, language}

#### TC-HARNESS-CRUD-004: repo 검색 필터
- **심각도**: MEDIUM
- **단계**: 검색창 입력 → `repos.filter(r.full_name includes search)` 클라이언트 필터
- **검증**: L1
- **PASS**: 검색어에 매칭되는 repo만 노출

#### TC-HARNESS-CRUD-005: repo 선택 → 폼 필드 자동 채움
- **심각도**: HIGH
- **단계**: repo 클릭 → 이름 기본값 = repo.name, description 기본값 = repo.description
- **검증**: L1
- **PASS**: selected repo 카드 표시 + 폼 필드 pre-fill

#### TC-HARNESS-CRUD-006: 필수값 validation
- **심각도**: CRITICAL
- **단계**: repo 미선택 상태에서 저장 클릭 → "하네스 repo를 골라라" 에러 표시
- **검증**: L1 (toast/inline error)
- **PASS**: 폼 제출 차단 + 에러 메시지

#### TC-HARNESS-CRUD-007: 정상 등록 — 라운드트립
- **심각도**: CRITICAL
- **단계**:
  1. repo 선택 + 이름/runtime/entrypoint 입력
  2. "참전" 클릭
  3. POST `/api/harnesses` → zod validate → invokeUserAction('create_harness') → Edge Function → GH repo verify → repo.permissions.push 확인 → INSERT
- **검증**:
  - L2: 200 + `{id, slug}` 반환
  - L3 (DB 직접): `harnesses` 테이블에 owner_id=auth.uid(), repo_url=GH API.html_url, commit_sha=branch.commit.sha 저장
  - L3 (트리거): `elo_ratings` row 자동 생성 (rating=1500)
- **PASS**: 3개 검증 모두 통과

#### TC-HARNESS-CRUD-008: repo 권한 없음 거부
- **심각도**: CRITICAL
- **단계**: push 권한 없는 repo 선택 → 등록 시도 → Edge Function이 repo.permissions 체크 → 403 `{error:'insufficient_repo_permission'}`
- **검증**: L2
- **PASS**: 등록 차단 + 에러 메시지 노출

#### TC-HARNESS-CRUD-009: 가짜 github_repo_id 거부 (repo-target injection)
- **심각도**: CRITICAL
- **단계**: 클라이언트가 위조한 `github_repo_id` (다른 사용자 repo) → `GET /repositories/{id}` 서버 검증 → 403
- **검증**: L2
- **PASS**: 서버가 GH API로 repo 재검증 → 권한 없으면 거부

#### TC-HARNESS-CRUD-010: zod 스키마 실패 (잘못된 payload)
- **심각도**: HIGH
- **단계**: POST `/api/harnesses` with `{name: "x"}` (nameToo short) → 400 `{error:'invalid_body'}`
- **검증**: L2
- **PASS**: zod issues 배열 포함

#### TC-HARNESS-CRUD-011: action override 차단 (reserved key strip)
- **심각도**: CRITICAL
- **단계**: POST `/api/harnesses` with `{action:'save_github_token', github_repo_id:1,...}` → invokeUserAction이 RESERVED_KEYS 필터링 → 서버 action=create_harness 고정
- **검증**: L2 (server forwards action=create_harness)
- **PASS**: save_github_token으로 우회 불가

#### TC-HARNESS-CRUD-012: 리스트 조회 — 본인 하네스만
- **심각도**: HIGH
- **단계**: `/submit` 로딩 시 `SELECT * FROM harnesses WHERE owner_id = auth.uid()`
- **검증**: L3 (다른 사용자 row 미포함)
- **PASS**: RLS policy `harnesses_owner_all` 강제

#### TC-HARNESS-CRUD-013: ELO 표시
- **심각도**: HIGH
- **단계**: 리스트에 `elo_ratings` join → rating/wins/losses 표시
- **검증**: L1, L3
- **PASS**: 기본값 1500/0/0

#### TC-HARNESS-CRUD-014: 등록 후 리디렉트 (UX)
- **심각도**: LOW
- **단계**: 등록 성공 → 4초 후 `/leaderboard`로 자동 이동
- **검증**: L1
- **PASS**: "링에 올랐다" 메시지 + 템플릿 링크 노출

---

### HARNESS-CLICK: 인터랙션 테스트

#### TC-HARNESS-CLICK-001: 저장 버튼 — 빈 폼 validation
- **심각도**: CRITICAL
- **단계**: repo 선택 후 이름 빈값 → 저장 → HTML `required` 유효성 차단
- **검증**: L1 (browser native validation popup)
- **PASS**: 폼 제출 0회 (API 호출 없음)

#### TC-HARNESS-CLICK-002: 저장 버튼 — 정상 제출 → response payload
- **심각도**: CRITICAL
- **단계**: 완전한 폼 → 저장 → POST `/api/harnesses`
- **검증**: L2 (response body: `{id, slug}`, id는 UUID, slug는 lowercase+hyphen)
- **PASS**: id != null, slug.length > 0

#### TC-HARNESS-CLICK-003: 저장 버튼 — 서버 에러 처리
- **심각도**: HIGH
- **단계**: 서버 500 → 에러 배너 노출 + 폼 유지
- **검증**: L1
- **PASS**: form state 유지 + error 메시지 가시

#### TC-HARNESS-CLICK-004: repo 변경 버튼
- **심각도**: HIGH
- **단계**: 선택된 repo 카드의 "변경" 클릭 → selectedRepo=null → repo 리스트 재노출
- **검증**: L1
- **PASS**: 검색창 + 리스트 다시 노출

#### TC-HARNESS-CLICK-005: 홈 링크
- **심각도**: HIGH
- **단계**: "← 홈" 링크 클릭 → `/`
- **검증**: L1
- **PASS**: 랜딩 렌더

#### TC-HARNESS-CLICK-006: UserMenu 드롭다운
- **심각도**: HIGH
- **단계**: avatar 클릭 → 드롭다운 렌더 → 외부 클릭 → 닫힘
- **검증**: L1
- **PASS**: useRef + document mousedown 동작

#### TC-HARNESS-CLICK-007: GitHub 프로필 링크
- **심각도**: MEDIUM
- **단계**: 드롭다운 GitHub 링크 클릭 → 새 탭 `github.com/{handle}`
- **검증**: L1 (`target="_blank"` + `rel="noreferrer"`)
- **PASS**: 새 탭 열림

#### TC-HARNESS-CLICK-008: 로그아웃 버튼
- **심각도**: CRITICAL
- **단계**: 드롭다운 "로그아웃" → sb.auth.signOut() + redirect `/`
- **검증**: L1, L2
- **PASS**: 쿠키 무효화 + UI 상태 초기화

---

### LEADERBOARD

#### TC-LB-001: /leaderboard 렌더링 — 빈 상태
- **심각도**: HIGH
- **단계**: 하네스 0개 상태 접속 → "첫 번째 도전자를 기다린다" 빈 상태 UI
- **검증**: L1, L3 (`elo_ratings` empty)
- **PASS**: "참전 신청 →" CTA 노출

#### TC-LB-002: /leaderboard 렌더링 — 데이터 있음
- **심각도**: CRITICAL
- **단계**: 하네스 5개 등록 상태 → elo_ratings 조회 → 테이블 표시
- **검증**: L1 (테이블), L2 (Supabase query), L3
- **PASS**: 상위 50위 rating desc 정렬

#### TC-LB-003: 승률 계산
- **심각도**: HIGH
- **단계**: `wins + losses > 0` → `(wins/(wins+losses))*100` + "%" 표기, 0이면 "—"
- **검증**: L1
- **PASS**: 분모 0 처리 정확

#### TC-LB-004: 하네스 이름 링크 (미구현 상태 확인)
- **심각도**: MEDIUM
- **단계**: 하네스명 클릭 → `/harness/{name}` → 404 (미구현) 또는 상세
- **검증**: L1, L2
- **PASS**: 404 깨끗하게 (KO 페이지)

#### TC-LB-005: 시즌 표기
- **심각도**: LOW
- **단계**: 헤더에 "SEASON 01 / LIVE" 노출
- **검증**: L1
- **PASS**: 하드코딩된 텍스트 정확

#### TC-LB-006: ELO desc 정렬 보장
- **심각도**: HIGH
- **단계**: `.order('rating', { ascending: false }).limit(50)`
- **검증**: L3 (DB 직접 쿼리)
- **PASS**: rank 1 = max(rating)

---

### EDGE-FUNC: Supabase Edge Functions

#### TC-EDGE-001: dispatch-challenge — 인증 실패
- **심각도**: CRITICAL
- **단계**: `POST /functions/v1/dispatch-challenge` (secret 없음) → 401
- **검증**: L2
- **PASS**: `x-internal-secret` 불일치 시 401

#### TC-EDGE-002: dispatch-challenge — 정상 실행
- **심각도**: CRITICAL
- **단계**: 올바른 internal secret + 활성 챌린지 존재 → 200 + `{challenge_id, dispatched, errors}`
- **검증**: L2, L3 (`submissions` row 생성, `submission_tokens` row)
- **PASS**: dispatched >= 0, 등록된 auto_submit 하네스에 repository_dispatch fan-out

#### TC-EDGE-003: dispatch-challenge — no_active_challenge
- **심각도**: HIGH
- **단계**: 활성 챌린지 없을 때 → 404 `{error:'no_active_challenge'}`
- **검증**: L2
- **PASS**: 404

#### TC-EDGE-004: upload-result — 토큰 없음 401
- **심각도**: CRITICAL
- **단계**: POST `/upload-result` without `x-submission-token` → 401 `{error:'missing_token'}`
- **검증**: L2
- **PASS**: 401

#### TC-EDGE-005: upload-result — 만료 토큰 거부
- **심각도**: CRITICAL
- **단계**: `expires_at < now` 인 토큰 → 401 `{error:'invalid_or_expired_token'}`
- **검증**: L2, L3 (`used_at IS NULL AND expires_at >= NOW()` 조건)
- **PASS**: 만료 토큰 거부

#### TC-EDGE-006: upload-result — 토큰 재사용 차단
- **심각도**: CRITICAL
- **단계**: 유효 토큰 1회 사용 (`used_at` 업데이트) → 재사용 시 401
- **검증**: L3
- **PASS**: 단발 토큰

#### TC-EDGE-007: upload-result — 정상 실행 + judge 트리거
- **심각도**: CRITICAL
- **단계**: 유효 토큰 + `{diff_b64, log_b64, exit_code:0}` → 200 + artifacts Storage 업로드 + `submissions.status='EVALUATING'` + judge-submission 비동기 호출
- **검증**: L2, L3 (submissions UPDATE), L3 (Storage path: `submissions/{id}/diff.patch`)
- **PASS**: diff_url/log_url 설정, diff_hash 계산

#### TC-EDGE-008: judge-submission — 5축 채점 통합
- **심각도**: CRITICAL
- **단계**: POST `/judge-submission {submission_id}` → 쿼리 + GET diff_url → 결정론 점수(efficiency/elegance) + LLM 호출(Claude sonnet + GPT-4o) → 평균 → 가중합 → scores INSERT + submissions.status=COMPLETED
- **검증**: L2, L3 (scores row 생성, judge_trace jsonb에 claude/codex 둘 다 포함)
- **PASS**: total 계산 정확 + COMPLETED 전환

#### TC-EDGE-009: judge-submission — submission not_found
- **심각도**: HIGH
- **단계**: 존재하지 않는 submission_id → 404
- **검증**: L2
- **PASS**: 404

---

### CRON: pg_cron 자동 스케줄

#### TC-CRON-001: pg_cron job 등록 확인
- **심각도**: CRITICAL
- **단계**: `SELECT * FROM cron.job WHERE jobname='ufc-dispatch-every-4h'`
- **검증**: L3
- **PASS**: schedule='0 */4 * * *', command 포함

#### TC-CRON-002: cron_dispatch_challenge 함수 실행
- **심각도**: HIGH
- **단계**: `SELECT public.cron_dispatch_challenge()` → net.http_post 호출 → request_id 반환
- **검증**: L3 (pg_net 로그)
- **PASS**: bigint request_id 반환

#### TC-CRON-003: cron_dispatch 권한 제한
- **심각도**: HIGH
- **단계**: anon/authenticated로 `SELECT public.cron_dispatch_challenge()` → permission denied
- **검증**: L3
- **PASS**: service_role만 EXECUTE

---

### SECURITY: 보안 횡단

#### TC-SEC-001: CSRF — cross-origin POST 차단
- **심각도**: CRITICAL
- **단계**: 외부 origin에서 `POST /api/harnesses` (Origin=`evil.com`) → 403 `{error:'cross_origin_not_allowed'}`
- **검증**: L2
- **PASS**: enforceSameOrigin 차단

#### TC-SEC-002: CSRF — Origin 누락 차단
- **심각도**: CRITICAL
- **단계**: Origin/Referer 헤더 둘 다 없음 → 403
- **검증**: L2
- **PASS**: 403

#### TC-SEC-003: Rate Limit — 10회 초과 429
- **심각도**: HIGH
- **단계**: `/api/harnesses` 연속 11회 POST → 11번째 429 + Retry-After 헤더
- **검증**: L2
- **PASS**: capacity=10 정확

#### TC-SEC-004: Rate Limit — 버킷 refill
- **심각도**: MEDIUM
- **단계**: 429 후 10초 대기 → 1회 추가 요청 → 200
- **검증**: L2
- **PASS**: refillPerSec=0.1 (10초당 1개)

#### TC-SEC-005: provider_token 브라우저 격리
- **심각도**: CRITICAL
- **단계**: 로그인 후 브라우저 devtools `sb.auth.getSession()` → `session.provider_token` 확인
- **검증**: L4 (값이 없거나 최초 1회 후 소실)
- **PASS**: 지속 브라우저 접근 불가 — DB에만 저장

#### TC-SEC-006: Cache-Control — 인증 응답 no-store
- **심각도**: HIGH
- **단계**: 로그인 상태 모든 응답 헤더 → `Cache-Control: private, no-store`
- **검증**: L2 (curl -I)
- **PASS**: 모든 auth-cookie-refreshing 응답에 헤더

#### TC-SEC-007: service_role 비노출
- **심각도**: CRITICAL
- **단계**: Vercel build env 확인 → `SUPABASE_SERVICE_ROLE_KEY` 없음
- **검증**: L4 (Vercel project API)
- **PASS**: service_role은 Edge Function 내부에만

#### TC-SEC-008: next 파라미터 allowlist
- **심각도**: CRITICAL
- **단계**: `/auth/callback?code=X&next=//evil.com` → safeNext가 `/submit` 강제
- **검증**: L2
- **PASS**: 리다이렉트가 `evil.com` 아님

#### TC-SEC-009: SQL injection — setup script
- **심각도**: CRITICAL
- **단계**: `./setup-github-oauth.sh` 실행 시 CLIENT_ID에 `foo'; DROP TABLE users; --` → jq 이스케이프
- **검증**: L3 (public.users 정상)
- **PASS**: 정상 JSON escape

#### TC-SEC-010: argv secret leak
- **심각도**: HIGH
- **단계**: setup-github-oauth.sh 실행 중 `ps eww -o command=` 검사
- **검증**: L1 (shell audit)
- **PASS**: Authorization/PAT 문자열 없음 (curl -K 사용)

#### TC-SEC-011: hardcoded keys grep
- **심각도**: HIGH
- **단계**: `grep -rE "sk-(ant|proj)|gho_[a-zA-Z0-9]{30,}" apps/ packages/`
- **검증**: L4
- **PASS**: 0건 (env.local 제외)

#### TC-SEC-012: localStorage 미사용
- **심각도**: MEDIUM
- **단계**: `grep -rn "localStorage\." apps/web/src/`
- **검증**: L4
- **PASS**: 0건

---

### DB-RLS: Row Level Security

#### TC-RLS-001: harnesses INSERT — 본인만
- **심각도**: CRITICAL
- **단계**: 유저A JWT로 `{owner_id:'other-user'}` INSERT → RLS `harnesses_insert_self` WITH CHECK 거부
- **검증**: L3 (policyWithcheck=`auth.uid() = owner_id`)
- **PASS**: 42501 permission denied

#### TC-RLS-002: harnesses UPDATE — 본인만
- **심각도**: CRITICAL
- **단계**: 유저A → 유저B 하네스 UPDATE 시도 → 거부
- **검증**: L3
- **PASS**: RLS 차단

#### TC-RLS-003: harnesses DELETE — 본인만
- **심각도**: CRITICAL
- **단계**: 유저A → 유저B 하네스 DELETE → 거부
- **검증**: L3
- **PASS**: RLS 차단

#### TC-RLS-004: harnesses public SELECT — ACTIVE만
- **심각도**: HIGH
- **단계**: 유저A가 유저B의 status=PAUSED 하네스 조회 → empty result
- **검증**: L3
- **PASS**: `harnesses_public_read WHERE status='ACTIVE'`

#### TC-RLS-005: elo_ratings 클라이언트 INSERT 차단
- **심각도**: CRITICAL
- **단계**: 클라이언트 JWT로 `INSERT INTO elo_ratings (rating:9999)` → 42501
- **검증**: L3
- **PASS**: policy 부재로 anon/authenticated 차단

#### TC-RLS-006: elo_ratings 트리거 자동 생성
- **심각도**: HIGH
- **단계**: harness INSERT → `on_harness_created` trigger → elo_ratings 자동 row
- **검증**: L3
- **PASS**: rating=1500 기본값

#### TC-RLS-007: private.secrets 완전 비노출
- **심각도**: CRITICAL
- **단계**: anon/authenticated `SELECT * FROM private.secrets` → 42501
- **검증**: L3
- **PASS**: REVOKE ALL 효과

#### TC-RLS-008: submission_tokens 클라이언트 읽기 차단
- **심각도**: HIGH
- **단계**: `SELECT * FROM submission_tokens` (user JWT) → 빈 결과
- **검증**: L3
- **PASS**: RLS enabled + no policy

---

### NAVIGATION

#### TC-NAV-001: 헤더 navigation 링크
- **심각도**: MEDIUM
- **단계**: SiteHeader의 "리더보드"/"참전"/"GitHub" 각 링크 클릭 → 해당 경로
- **검증**: L1
- **PASS**: hover 시 ufc-gold, 클릭 시 라우팅

#### TC-NAV-002: 404 페이지
- **심각도**: HIGH
- **단계**: 존재하지 않는 경로 접속 → `/_not-found` 렌더
- **검증**: L2
- **PASS**: "KNOCKOUT / 404 / 이 하네스는 링에 오르지 못했습니다."

#### TC-NAV-003: /harness/:name 미구현 404
- **심각도**: MEDIUM
- **단계**: `/harness/any-name` → 404
- **검증**: L2
- **PASS**: 깨지지 않음 (500 없음)

#### TC-NAV-004: 홈 링크 (헤더 로고)
- **심각도**: HIGH
- **단계**: 로고 클릭 → `/`
- **검증**: L1
- **PASS**: 랜딩 페이지

---

### ACCESSIBILITY

#### TC-A11Y-001: 키보드 탐색 — 로그인 버튼
- **심각도**: MEDIUM
- **단계**: Tab 키로 GitHub 로그인 버튼 포커스 → Enter → OAuth 시작
- **검증**: L1
- **PASS**: focus ring 가시 + Enter 작동

#### TC-A11Y-002: aria 라벨 — UserMenu
- **심각도**: MEDIUM
- **단계**: UserMenu 버튼에 `aria-expanded` / `aria-haspopup`
- **검증**: L4 (DOM)
- **PASS**: 스크린리더 호환

#### TC-A11Y-003: 색상 대비 — 본문 텍스트
- **심각도**: LOW
- **단계**: text-zinc-400 on bg-ufc-black contrast 검증
- **검증**: L4
- **PASS**: WCAG AA (4.5:1 이상)

---

## 검증 기준

```json
{
  "pass_criteria": {
    "critical_findings": 0,
    "high_findings": 0,
    "medium_max": 5,
    "codex_rounds_critical_high": 0,
    "browser_test_executed": true,
    "scenarios_pass_rate": 1.0,
    "console_errors": 0,
    "rls_tc_pass_rate": 1.0
  },
  "commit_allowed": "CRITICAL=0 AND HIGH=0 AND (codex round convergence)",
  "push_allowed": "commit_allowed AND auto-adversarial-review PASS"
}
```

## 시나리오 변경 정책

| 상황 | 수정 | 승인 |
|------|------|------|
| 코드가 TC 통과 못함 | **코드 수정** | 불필요 |
| 요구사항 변경 | TC 수정 | 사용자 승인 |
| 신규 기능 | TC 추가 | 불필요 |
| 기능 삭제 | TC 삭제 | 사용자 승인 |

## 변경 이력

| 날짜 | 변경 | 내용 | 사유 |
|------|------|------|------|
| 2026-04-21 | 최초 생성 | 79 TC | Phase 0-4 구현 완료 시점 계약화 |
