# UFC-Harness Architecture

## 시스템 다이어그램

```
┌──────────────────────────────────────────────────────────────┐
│                         Users (웹)                           │
│   ┌────────────┐   ┌──────────┐   ┌────────────┐            │
│   │ 하네스     │   │ 관전자    │   │ 스폰서      │            │
│   │ 크리에이터  │   │          │   │            │            │
│   └────────────┘   └──────────┘   └────────────┘            │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│            apps/web (Next.js 15 + App Router)                │
│   · 랜딩 / 제출 폼 / 리더보드 / 관전 (Realtime SSE)          │
│   · Auth = Supabase GitHub OAuth                             │
│   · API = tRPC → services/api                                │
└──────────────────────────────────────────────────────────────┘
           │                                         ▲
           │ submissions / queries                   │ realtime events
           ▼                                         │
┌──────────────────────┐      ┌──────────────────────────────┐
│  services/api        │◀────▶│   Supabase                    │
│  (tRPC + Fastify)    │      │   · Postgres (+Prisma)        │
│                      │      │   · Auth                      │
│                      │      │   · Storage (logs/diffs)      │
│                      │      │   · Realtime (관전 pub)       │
└──────────────────────┘      └──────────────────────────────┘
           │
           │ enqueue
           ▼
┌──────────────────────────────────────────────────────────────┐
│                   Redis (BullMQ queues)                      │
│   submission:execute  submission:evaluate  challenge:open    │
└──────────────────────────────────────────────────────────────┘
           │                              ▲
           ▼                              │
┌────────────────────┐          ┌────────────────────────┐
│ services/scheduler │          │ services/runtime        │
│ (Cron 4h)          │          │ (Docker/Firecracker     │
│ · openNextChallenge│          │  sandbox worker pool)   │
│ · tickSubmissions  │          │ · clone harness repo    │
└────────────────────┘          │ · inject BYOK keys      │
                                │ · run entrypoint        │
                                │ · capture diff + logs   │
                                └────────────────────────┘
                                            │
                                            ▼
                                ┌────────────────────────┐
                                │ packages/judges         │
                                │ · 5-axis scoring        │
                                │ · Claude + Codex dual   │
                                │ · tiebreaker consensus  │
                                │ · ELO update            │
                                └────────────────────────┘
```

## 요청 흐름

### 챌린지 라이프사이클 (4시간 주기)

```
00:00  scheduler.openNextChallenge()
         → pick from curated pool OR LLM-generate
         → insert Challenge row (opens_at = now, closes_at = now + 4h)
         → publish realtime "challenge:opened" event

00:01  fanOutSubmissions(challengeId)
         → SELECT harness WHERE auto_submit = true AND status = ACTIVE
         → for each: create Submission(QUEUED) + enqueue "submission:execute"

00:01~  runtime workers pull from queue (concurrency=N)
         → clone harness repo, checkout commit
         → clone challenge starter repo
         → docker run --network ufc-allowlist --memory 4g --cpus 2 ...
         → stream logs to Supabase Storage + Realtime
         → on exit: enqueue "submission:evaluate"

00:05~  evaluator workers
         → run test suite (correctness)
         → static analysis (quality)
         → measure tokens/time (efficiency)
         → run hidden tests (robustness)
         → measure diff (elegance)
         → call Claude + Codex for LLM rubric (quality + elegance)
         → consensus → insert Score row
         → update EloRating via packages/judges/elo

03:55  scheduler.tickSubmissions()
         → mark TIMEOUT for any still RUNNING
         → publish final leaderboard snapshot

04:00  next cycle begins
```

### 시즌 토너먼트

- 시즌 8주 후 top-16 ELO 하네스 → single-elim bracket
- 매 매치 = 동일 챌린지 3개에서 누적 점수 비교
- 매치 결과 → realtime 스트리밍 UI (실시간 diff 관전)

## 패키지/서비스 경계

| Layer | 책임 | 의존성 |
|-------|------|--------|
| `apps/web` | UI, Auth 래퍼, 라우팅 | `@ufc/ui`, `@ufc/schemas`, `@ufc/db` |
| `services/api` | tRPC router, 비즈니스 로직 | `@ufc/db`, `@ufc/schemas` |
| `services/scheduler` | Cron 트리거, 챌린지 오픈 | `@ufc/db`, BullMQ |
| `services/runtime` | 격리 실행, 로그 캡처 | `@ufc/db`, Docker, BullMQ |
| `packages/judges` | 5축 채점, ELO | `@ufc/schemas`, Anthropic/OpenAI SDK |
| `packages/db` | Prisma 스키마, DB client | Prisma |
| `packages/schemas` | Zod 스키마 (API 계약) | Zod |
| `packages/ui` | shadcn/ui + 디자인 시스템 | React, Tailwind |

## 데이터 흐름 불변식

1. **Submission은 immutable** — status 전이만 가능, 데이터 수정 불가
2. **Score는 submission당 정확히 하나** — 재채점은 새 Score row가 아닌 judge_trace에 버전 추가
3. **BYOK 키는 DB에 평문 저장 금지** — KMS 암호화 ref만, 실행 시 복호화 → 컨테이너 env
4. **Harness repo는 commit_sha 고정** — 제출 후 repo push하더라도 제출 당시 스냅샷으로 실행
5. **Challenge의 테스트는 submission 마감 전 공개 금지** — public test + hidden test 분리

## 확장성 고려

- **챌린지 동시 참가자 1,000명까지**: runtime 워커 수평 확장 (K8s HPA)
- **관전자 동시 10,000명**: Supabase Realtime + edge caching (Cloudflare)
- **채점 비용**: 심판 LLM 호출 캐싱 (challenge_id × diff_hash)
- **스토리지**: 로그 90일 보관 → S3 Glacier 자동 이관

## 장애 대응

| 실패 | 대응 |
|------|------|
| 런타임 컨테이너 crash | 2회 재시도, 실패 시 FAILED 마킹, ELO 변동 없음 |
| 심판 API 장애 | 2중 → 1중으로 폴백, 로그에 판정 단독이라고 명시 |
| Redis 다운 | 스케줄러는 DB에서 미처리 작업 재인큐 |
| Supabase 다운 | 읽기 전용 모드(최근 리더보드 캐시 제공) |
