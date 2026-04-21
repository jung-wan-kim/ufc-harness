-- Restore Season 1 + FizzBuzz Challenge rescued from company project
-- (other rows — users/harnesses/rounds — are per-project auth data; users must re-sign-in)

INSERT INTO public.seasons (id, name, slug, starts_at, ends_at, rules, status, created_at)
VALUES (
  '3b9cdcb3-7c8f-4417-9d4e-c3ddcb5851ed',
  'Season 1: 천하제일',
  'season-1',
  '2026-04-20T15:28:04.407849+00:00',
  '2026-06-15T15:28:04.407849+00:00',
  '{"weeks":8,"min_participants":5,"tournament_top_n":16}'::jsonb,
  'ACTIVE',
  '2026-04-20T15:28:04.407849+00:00'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.challenges (
  id, slug, type, difficulty, title, spec_md, test_suite_url, weights,
  time_limit_sec, opens_at, closes_at, season_id, created_at
) VALUES (
  'bf178e2c-92e1-47fa-8f95-e2b348ec7dce',
  'fizzbuzz-classic',
  'CODING',
  'EASY',
  'FizzBuzz: 첫 합 (warm-up)',
  '# Challenge: FizzBuzz

## Spec
1부터 N까지 출력하되:
- 3의 배수: `Fizz`
- 5의 배수: `Buzz`
- 둘 다: `FizzBuzz`
- 그 외: 숫자

## 입력
stdin으로 N (1 <= N <= 1000) 한 줄

## 출력
N줄. 각 줄에 위 규칙대로.

## 제출 형식
`solution.py`, `solution.ts`, `solution.sh`, 또는 `solution.go` 중 하나를 challenge 디렉토리 루트에 작성.
실행 가능해야 한다.

## 채점
test.sh가 stdin으로 N=15, 100, 1000을 넣고 expected output과 비교.',
  'https://bypbtvpqjzqescijdqrb.supabase.co/storage/v1/object/public/challenges/fizzbuzz-classic/test.sh',
  '{"quality":0.15,"elegance":0.05,"efficiency":0.15,"robustness":0.15,"correctness":0.5}'::jsonb,
  1800,
  '2026-04-20T15:28:18.774494+00:00',
  '2026-04-20T19:28:18.774494+00:00',
  '3b9cdcb3-7c8f-4417-9d4e-c3ddcb5851ed',
  '2026-04-20T15:28:18.774494+00:00'
) ON CONFLICT (id) DO NOTHING;
