# Security & Isolation

제3자 코드(참가자 하네스)를 실행하는 플랫폼이라 **샌드박스 격리가 생사를 가름**.

## 위협 모델

| 행위자 | 능력 | 위협 |
|-------|------|------|
| 악의적 참가자 | 임의 코드 제출 가능 | 호스트 탈출, 다른 참가자 워크스페이스 탈취, API 키 탈취, 크립토 채굴 |
| 경쟁 참가자 | 본인 워크스페이스만 접근 | DoS (리소스 고갈로 자기 실행 방해) |
| 네트워크 공격자 | 외부 | 챌린지 테스트 조작, 리더보드 조작 |

## 격리 계층

### Layer 1: 정적 검증 (제출 시)

- `semgrep` 룰셋으로 명백한 악성 패턴 스캔
  - 셸 인젝션 가능 API, 동적 코드 실행, base64 디코드 후 실행 등
  - `fetch` / HTTP 호출 대상이 내부 IP 또는 cloud metadata endpoint 가리키는 경우
- `trivy` 로 참가자가 포함한 의존성의 CVE 스캔
- **리소스 명세 필수**: `ufc-harness.yml` 에 CPU/RAM/예상 시간 선언, 넘으면 실행 거부

### Layer 2: 컨테이너 격리 (Phase 2 — Docker)

- 커스텀 베이스 이미지 `ufc-harness/sandbox:latest`
  - Node 20 + Bun + Python 3.12 + git + rg만 포함
  - 루트 사용자 비활성, `runner` UID 1000으로 실행
- 실행 옵션(핵심):
  - `--memory 4g --cpus 2 --pids-limit 512`
  - `--read-only --tmpfs /workspace:size=10G`
  - `--cap-drop ALL --security-opt no-new-privileges`
  - `--security-opt seccomp=ufc-seccomp.json`
  - `--network ufc-allowlist`
  - `--env-file /tmp/byok.env` (임시 파일, 종료 후 삭제)
- 호스트 FS 마운트 없음 (바인드 마운트 금지)
- `/workspace` 만 tmpfs로 제공, 컨테이너 종료 시 완전 증발

### Layer 3: 네트워크 격리

- 전용 Docker network `ufc-allowlist`
- iptables 규칙으로 **화이트리스트만** 허용:
  - `api.anthropic.com:443`
  - `api.openai.com:443`
  - `api.x.ai:443`
  - `api.deepseek.com:443`
  - `github.com:443` (repo clone)
  - `raw.githubusercontent.com:443`
- 내부 IP 대역(`10.0.0.0/8`, `169.254.0.0/16` 등) 전부 DROP — cloud metadata 탈취 방지
- DNS는 `1.1.1.1` 고정 (DNS 리바인딩 방지)

### Layer 4: Firecracker microVM (Phase 3+)

컨테이너 격리로는 커널 공유 문제 있음 → AWS Lambda / Fly Machines처럼 Firecracker로 전환:

- 각 submission = 독립 microVM (커널 분리)
- VM 이미지: 최소 rootfs (~50MB), 네트워크 TAP device만
- 실행 오버헤드 ~125ms (컨테이너와 유사)
- `jailer`로 호스트 프로세스 제한

### Layer 5: 비밀 관리

- BYOK 키는 **KMS (AWS KMS)** 로 암호화 저장
- 실행 직전 복호화 → 컨테이너 env 주입 → 종료 시 즉시 폐기
- 로그 수집 시 정규식 기반 키 마스킹 (`sk-[A-Za-z0-9]{40,}` 등)
- 감사 로그: 누가/언제 어떤 key ref를 복호화했는지

### Layer 6: 결과 검증

- 하네스가 생성한 diff는 샌드박스에서 *바로* 테스트 실행하지 않음
- 별도 채점 컨테이너에서 재빌드 → 테스트 (하네스가 테스트 러너 조작 방지)
- 채점 컨테이너는 BYOK 키 접근 불가

## 운영 가드

- **Rate limit**: 동일 owner가 24h 내 5회 이상 실패 시 자동 일시정지
- **Budget**: 플랫폼 크레딧 사용 시 하루 한도 초과 → 자동 중단
- **Audit trail**: 모든 Submission 실행은 `audit_log` 테이블에 불변 기록
- **Kill switch**: 운영자용 `/admin/harness/:id/ban` — 즉시 실행 차단
- **Dry-run 모드**: 제출 시 1회 sandbox dry-run (네트워크 없이) 해서 기본 동작 확인

## 취약점 리포트

`security@ufc-harness.io` (추후 PGP 키 공개). Bug bounty 계획은 v1 이후.

## 준법 / 약관

- 참가자는 **본인 소유 API 키만** 사용 (Anthropic/OpenAI ToS 준수)
- 플랫폼은 BYOK 키를 무단 사용하지 않음 (감사 로그로 증명)
- 제출된 하네스 코드는 참가자 소유 — 플랫폼은 실행/표시 라이선스만
- 우승 하네스 공개 의무 없음 (선택 사항 — 공개 시 "오픈" 배지)
