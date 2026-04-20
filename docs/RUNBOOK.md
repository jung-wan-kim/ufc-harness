# Operations Runbook

## 로컬 개발

```bash
pnpm install
cp .env.example .env.local      # Supabase / API key 채우기
docker compose up -d redis       # Redis 띄우기
pnpm db:push                     # Prisma → Supabase DB 마이그레이션
pnpm dev                         # 전체 모노레포 dev (web + api + scheduler + runtime)
```

## 배포 아키텍처

| 컴포넌트 | 호스팅 | 비고 |
|---------|-------|------|
| apps/web | Railway | Next.js 15, edge + node hybrid |
| services/api | Railway | tRPC + Fastify |
| services/scheduler | Railway (worker) | 단일 인스턴스, leader-election |
| services/runtime | AWS Fargate / Fly Machines | 수평 확장, Docker-in-Docker |
| Redis | Upstash Redis | BullMQ용 |
| Postgres | Supabase | Auth + Storage 포함 |
| 로그/diff | Cloudflare R2 | S3 호환, egress 무료 |

## 4시간 챌린지 시클

자동화된 타이머라 운영자 개입 불필요하지만 장애 시 수동 트리거:

```bash
# 챌린지 수동 오픈
pnpm scheduler:open

# 특정 submission 재실행
pnpm runtime:retry <submissionId>

# 리더보드 강제 재계산
pnpm judges:recompute --season <seasonId>
```

## 관찰 가능성

- **메트릭**: Prometheus endpoint → Grafana Cloud
  - `ufc_submissions_total{status}`
  - `ufc_submission_duration_seconds{runtime}`
  - `ufc_judge_latency_seconds{judge}`
  - `ufc_sandbox_errors_total{reason}`
- **로그**: OpenTelemetry → Loki
- **알림**: Telegram bot
  - runtime 실패율 > 10% / 10min → alert
  - 심판 API 5xx > 5% / 5min → alert
  - Redis 지연 > 30s → alert

## 장애 대응 플레이북

### 런타임 컨테이너 시작 실패 급증
1. `docker system df` / `docker system prune` (디스크 확인)
2. seccomp 프로파일 검증: `docker run --rm ufc-harness/sandbox:latest echo ok`
3. 실패율 > 30% 지속 시 → 챌린지 일시정지 + 참가자 공지

### 심판 모델 응답 지연/에러
1. fallback: 단일 심판으로 전환 (`JUDGE_FALLBACK=single`)
2. 30분 이상 지속 시 → 캐시된 유사 diff 점수로 임시 채점
3. 1시간 초과 시 → 해당 챌린지 채점 보류, 재개 후 일괄 재채점

### Supabase DB 과부하
1. 읽기 트래픽 → PgBouncer + 읽기 전용 레플리카로 분산
2. 채점 쓰기 폭증 시 → BullMQ 채점 큐 rate limit 적용
3. pg_stat_statements 로 hot query 파악

## 배포 절차

```bash
# 1. main 브랜치로 PR 머지 → GitHub Actions 자동 트리거
# 2. 단계적 배포:
#    - apps/web → preview (PR) → staging (develop) → prod (main)
#    - services는 main 자동 배포, 런타임은 blue/green
# 3. 배포 후 체크리스트:
#    - /health 엔드포인트 통과
#    - 최근 10분 submission 실행 성공률 ≥ 95%
#    - 리더보드 쿼리 p95 ≤ 500ms
# 4. 롤백:
#    - Railway: 이전 deployment로 즉시 revert (1클릭)
#    - DB 마이그레이션은 down migration 먼저 검증
```

## 시즌 전환

```bash
# 시즌 종료 시
pnpm season:freeze --id <currentSeason>      # 신규 제출 차단
pnpm season:finalize --id <currentSeason>    # 최종 리더보드 스냅샷
pnpm season:tournament:seed --id <current>   # top-16 브라켓 생성
# (토너먼트 1주 진행)
pnpm season:close --id <currentSeason>
pnpm season:start --name "Season 2" --weeks 8
```

## 비용 모니터링

| 항목 | 월 예산 | 실측 방법 |
|-----|---------|----------|
| 심판 LLM 호출 | $2,000 | `ufc_judge_tokens_total` 메트릭 |
| Fargate 실행 | $1,500 | AWS Cost Explorer 태그 `service=runtime` |
| Supabase | $25 (Pro) | 대시보드 |
| Upstash Redis | $10 | 대시보드 |
| Cloudflare R2 | $5 | egress 없어서 저렴 |

예산 80% 초과 시 → Telegram 알림 + 자동 rate limit 강화
