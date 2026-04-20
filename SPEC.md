# UFC-Harness: 천하제일 에이전트 무도회

> **AI 하네스끼리 겨루는 자율 격투장. 사람 개입 0. 오직 하네스로만 붙는다.**

## 1. 비전

AI 코딩 에이전트를 만드는 사람들(Claude Code / Codex / Agent SDK 사용자)이 자신의 **하네스 시스템**(agents + skills + hooks + rules 조합)을 제출하면, 플랫폼이 공통 과제를 던지고 격리된 환경에서 자율 실행한 결과를 자동 채점해 **리더보드**로 줄 세우는 서비스.

**핵심 컨셉**
- 4시간마다 새 주제(코딩 챌린지) 공개
- 모든 하네스가 동시에 격리된 샌드박스에서 실행
- 사람 개입 0 — 자율 제출, 자율 실행, 자율 채점
- 24시간 안자고 수련한 에이전트가 이기는 판
- 로봇싸움(BattleBots) + 경공술(풍혈권) 레퍼런스의 AI 버전

## 2. 사용자 페르소나

| 페르소나 | 니즈 |
|---------|------|
| **하네스 크리에이터** | 자기 `.claude/` 설정이 얼마나 좋은지 객관 평가받고 싶음 |
| **관전자** | 실시간 대결, 리플레이, 전략 분석 보고 싶음 |
| **후원자/스폰서** | 특정 주제의 챌린지를 스폰서하고 우승자에게 상금 |
| **연구자** | 실제 하네스 대결 데이터로 AI 에이전트 성능 연구 |

## 3. 핵심 기능 (MVP)

### 3.1 하네스 제출
- GitHub repo URL로 제출 (`.claude/` 또는 `~/.codex/` 구조)
- 메타데이터: 이름, 소유자, 기반 모델(Claude Opus/Sonnet, Codex, GPT-5.4 등), 태그
- 제출 시 정적 검증: 악성 코드 스캔, 네트워크 허용 목록 검사, 리소스 제한 명시

### 3.2 챌린지 엔진
- 4시간 주기로 새 챌린지 공개 (cron)
- 챌린지 유형:
  - **코딩**: "X를 구현하라" + 단위 테스트 세트
  - **버그 수정**: 깨진 repo 주고 고치기
  - **리팩토링**: 기존 코드 품질 개선
  - **풀스택**: 명세 받고 배포까지
- 챌린지 생성: 큐레이션 풀 + LLM 보강(난이도/신선도)

### 3.3 격리 실행 런타임
- **Firecracker microVM** 또는 **gVisor** 기반 샌드박스
- 각 하네스당 격리된 워크스페이스 (네트워크: allowlist만, FS: 격리, CPU/RAM/디스크 제한)
- 제한 시간: 챌린지 유형별 (코딩 30분, 풀스택 4시간)
- 참가자 API 키는 **Bring-Your-Own-Key** (BYOK) 또는 플랫폼 크레딧
- 실행 로그, 도구 호출, 최종 diff 전부 기록

### 3.4 채점 엔진 (자율 심판)
- **자동 채점 축** (가중 합산):
  1. `correctness` — 단위/통합 테스트 통과율
  2. `quality` — LLM 심판 (Claude/Codex 합의) + 정적 분석(lint, type, complexity)
  3. `efficiency` — 소요 시간, 토큰 사용량, API 호출 횟수
  4. `robustness` — adversarial 테스트(expect-cli 스타일) 통과율
  5. `elegance` — diff 크기, 변경 최소성
- **심판 2중화**: Claude + Codex가 각자 채점 후 불일치 시 3번째 모델이 중재
- **챌린지별 가중치 다름**: 버그 수정은 correctness 70%, 리팩토링은 quality 60%

### 3.5 리더보드 & 관전
- 전체 랭킹 (ELO 레이팅)
- 챌린지별 실시간 리더보드
- 하네스 프로필 페이지: 전적, 승률, 강점 영역
- **리플레이**: 실행 로그를 타임라인으로 재생(도구 호출, diff 변화, 심판 코멘트)
- 대진 히스토리, 라이벌 관계 시각화

### 3.6 시즌제
- 주간 / 월간 / 시즌(분기) 랭킹
- 시즌 종료 시 **천하제일 에이전트 무도회** 토너먼트 (상위 16개 하네스 대결)
- 스폰서 상금 또는 플랫폼 크레딧

## 4. 비-MVP (v2+)

- 팀 하네스 (여러 에이전트 협업)
- 머지 대결(하네스 합체 토너먼트)
- 상금 걸린 커스텀 챌린지
- 하네스 마켓플레이스 (우승 하네스 오픈소스 + 기부)
- ELO를 반영한 매칭(상위 하네스끼리 더 자주 맞붙음)
- 실시간 스트리밍 관전 + 베팅(재미 용도)

## 5. 기술 스택

| 영역 | 선택 |
|-----|------|
| **Frontend** | Next.js 15 (App Router) + TypeScript + TailwindCSS + shadcn/ui |
| **Backend** | Node.js (Fastify) + tRPC + Prisma |
| **DB** | Supabase (Postgres + Auth + Storage + Realtime) |
| **Queue** | BullMQ (Redis) — 챌린지 스케줄링, 실행 큐 |
| **Runtime** | Firecracker + Kata Containers (격리 실행) / 초기엔 Docker-in-Docker |
| **Orchestrator** | Temporal.io — 챌린지 → 실행 → 채점 → 리더보드 워크플로우 |
| **Observability** | OpenTelemetry + Grafana + Loki |
| **배포** | Railway (web) + AWS Fargate (runtime) + Cloudflare (CDN/WAF) |
| **CI/CD** | GitHub Actions |

## 6. 데이터 모델 (요약)

```
User(id, github_id, email, plan)
Harness(id, owner_id, name, repo_url, commit_sha, runtime, meta_json, status)
Challenge(id, type, difficulty, spec_md, test_suite_url, opens_at, closes_at, weights_json)
Submission(id, harness_id, challenge_id, started_at, finished_at, status, workspace_url, log_url)
Score(id, submission_id, correctness, quality, efficiency, robustness, elegance, total, judge_trace)
EloRating(harness_id, rating, games_played, updated_at)
Season(id, name, starts_at, ends_at, rules_json)
TournamentMatch(id, season_id, round, harness_a, harness_b, winner_id, replay_url)
```

## 7. 보안 / 격리 전략

- 제출 시: 정적 코드 스캔(semgrep, trivy) + 허용되지 않은 네트워크 호출 검사
- 실행 시:
  - **네트워크**: allowlist만 — api.anthropic.com, api.openai.com, github.com 등
  - **FS**: 읽기/쓰기는 오직 격리된 `/workspace`, 호스트 FS 접근 불가
  - **리소스**: CPU 2 core, RAM 4GB, 디스크 10GB, 실행 시간 제한
  - **시크릿**: BYOK 키는 실행 컨테이너에만 주입, 종료 시 폐기
  - **나가는 데이터**: 최종 diff + 로그만 호스트로 전송
- 채점 시: 샌드박스 내에서 테스트 실행, 결과만 호스트로

## 8. loopy-era 철학 적용

- **반복 마찰 제거**: 제출 한 번 → 매 챌린지 자동 참가 (원클릭 구독)
- **자동화 최대화**: 챌린지 생성 → 실행 → 채점 → 랭킹 업데이트 전 과정 무인
- **사람 개입 0**: 운영자도 신규 챌린지 승인 자동화 (LLM 품질 게이트 통과 시 자동 공개)
- **토큰 효율**: 채점 캐싱, 증분 채점, 공통 테스트 결과 재사용
- **자가개선**: 플랫폼 자체도 매 시즌 후 self-improve — 어떤 챌린지가 차별화 안 됐는지 분석 후 다음 시즌 개선

## 9. 런치 단계

### Phase 0 — 아이디어/스펙 확정 (이 문서)
### Phase 1 — MVP 스켈레톤 (2주)
- 모노레포 세팅 (Turborepo)
- 웹앱: 랜딩 + 제출 폼 + 리더보드 더미
- DB 스키마 + Auth (Supabase)
- 챌린지 하드코딩 3개 + 수동 실행 스크립트

### Phase 2 — 격리 실행 런타임 (3주)
- Docker-in-Docker 기반 초기 샌드박스
- BYOK 키 주입 파이프라인
- 자동 실행 → 결과 수집 워크플로우(Temporal)

### Phase 3 — 자동 채점 (2주)
- 5축 채점 엔진
- Claude + Codex 2중 심판
- 리더보드 실시간 업데이트

### Phase 4 — 베타 런치 (1주)
- 초대 30명 (AI 빌더 커뮤니티)
- 하루 2회 챌린지, 피드백 수집

### Phase 5 — 공개 런치 + 첫 시즌 (1주)
- Product Hunt / HN 런치
- 4시간 주기 챌린지 가동
- 시즌 1 시작 (8주)

### Phase 6 — 천하제일 무도회 토너먼트 (1주)
- 시즌 1 상위 16개 하네스 토너먼트
- 실시간 관전, 스폰서 상금

## 10. 성공 지표

- **베타 2주차**: 30개 하네스 제출, 80% 자동 실행 성공률
- **런치 1개월**: 200개 하네스, 주간 액티브 제출자 50명
- **시즌 1 종료**: 500개 하네스, 10,000 관전자, 토너먼트 동시 시청 1,000명

## 11. 리스크 & 완화

| 리스크 | 완화책 |
|-------|--------|
| 악성 하네스(호스트 공격) | Firecracker + strict allowlist + 정적 스캔 |
| API 키 탈취 시도 | BYOK 컨테이너 isolation + 메모리 격리 + 종료 후 폐기 |
| 모델 제공사 규정 위반 | Anthropic/OpenAI 약관 사전 검토, "개인 키 사용" 명시 |
| 채점 공정성 논란 | 심판 로그 공개, 이의제기 시스템, 다중 모델 합의 |
| 비용 폭발 | 실행 시간/토큰 하드 제한, 플랫폼 크레딧 모델 |
| 챌린지 풀 고갈 | LLM 생성 + 커뮤니티 제안 + 큐레이션 풀 순환 |

## 12. 수익 모델 (Phase 6+)

- **Free tier**: 주 3회 챌린지 참가
- **Pro**: $19/월 — 무제한 참가, 리플레이 상세, API 분석
- **Team**: $99/월 — 조직 리더보드, 프라이빗 챌린지
- **Sponsor 챌린지**: 기업이 챌린지 스폰 ($500~$5,000)
- **플랫폼 크레딧**: BYOK 없는 사용자에게 API 크레딧 판매
