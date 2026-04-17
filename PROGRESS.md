# 개발 진행 현황

> 마지막 업데이트: 2026-04-16

## 완료된 작업

- [x] 시스템 설계서 작성 (`docs/superpowers/specs/2026-04-16-service-chatting-design.md`)
- [x] 아키텍처 다이어그램 3종 작성 (`docs/superpowers/specs/diagrams/`)
- [x] CLAUDE.md 개발 가이드라인 작성
- [x] 테스트 환경 설계 — Chatwoot Cloud + Vercel + Neon.tech (`docs/superpowers/specs/2026-04-16-test-env-design.md`)
- [x] 테스트 환경 구현 계획 작성 (`docs/superpowers/plans/2026-04-16-test-env-implementation.md`)
- [x] CLAUDE.md 환경 변수 업데이트 (NEXT_PUBLIC_* 추가, @chatwoot/sdk → 스크립트 태그로 수정)

## 현재 진행 중

- 없음

## 다음 할 일

### 테스트 환경 구현 (계획서 참조)

사전 준비 (수동):
- [x] Chatwoot Cloud 가입 + Inbox/Token 발급 + 상담사 계정 생성
- [x] Neon.tech 프로젝트 생성 + 연결 문자열 확보

구현:
- [x] Task 1: Next.js 프로젝트 초기화
- [x] Task 2: DB 스키마 + 클라이언트
- [x] Task 3: Chatwoot API 클라이언트
- [x] Task 4: 상담 시작 API Route
- [x] Task 5: 프론트엔드 (Chatwoot 위젯 + 테스트 페이지)
- [x] Task 6: Vercel 배포 — https://service-chatting.vercel.app (2026-04-17)

### 이후 단계 (테스트 환경 완료 후)

- [x] Task 1: Chatwoot API 클라이언트에 addLabel 함수 추가 (2026-04-17)
- [x] Task 2: API Route에 inquiryType 파라미터 추가 (2026-04-17)
- [x] Task 3: 프론트엔드 — 문의 유형 선택 UI 추가 (2026-04-17)
- [x] Task 1: Chatwoot API 클라이언트에 addConversationNote 함수 추가 (2026-04-17)
- [x] Task 2: API Route에 chatHistory 처리 추가 (2026-04-17)
- [x] Task 3: 프론트엔드 — 테스트용 chatHistory 입력 추가 (2026-04-17)
- [ ] HMAC 인증 (Identity Validation) 추가
- [ ] Webhook 수신 처리
- [ ] 오프라인 모드

## 메모

- Chatwoot 위젯은 공식 npm 패키지 없음. 스크립트 태그 + `window.$chatwoot` API로 연동.
- 테스트 환경에서는 HMAC Identity Validation 비활성화 (Inbox 설정).
- 사전 준비(Chatwoot Cloud, Neon.tech) 완료 후 Task 1부터 시작.
