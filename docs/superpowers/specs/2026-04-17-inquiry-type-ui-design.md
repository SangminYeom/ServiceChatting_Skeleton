# 문의 유형 선택 UI 설계

> 작성일: 2026-04-17

## 목표

상담사 연결 전 고객이 문의 유형을 선택하도록 하여, Chatwoot 대화에 라벨을 자동 부착한다. 상담사가 대기열에서 문의 유형을 한눈에 파악할 수 있다.

## 문의 유형

| 표시 텍스트 | Chatwoot 라벨 슬러그 |
|------------|-------------------|
| 사용법 문의 | `usage` |
| 오류/장애 신고 | `error` |
| 결제 문의 | `billing` |
| 원격 요청 | `remote` |

## UI 방식: 인라인 확장

기존 폼(이름, 병원명) 아래에 문의 유형 선택 버튼 4개를 인라인으로 배치한다.

- 유형 미선택 시 "상담사 연결" 버튼 비활성화
- 선택된 유형 버튼은 강조 표시
- 선택 후 "상담사 연결" 클릭 → API 호출

## 데이터 흐름

1. 고객이 문의 유형 선택
2. `POST /api/consultation/start` 에 `inquiryType` 추가 전달
3. API Route: Conversation 생성 후 → Chatwoot Labels API 호출 (`addLabel`)
4. Chatwoot 대화에 라벨 부착 완료
5. 프론트: 위젯 오픈

## 변경 파일

- `src/components/consultation-form.tsx` — 문의 유형 선택 UI 추가, `inquiryType` state 관리
- `src/app/api/consultation/start/route.ts` — `inquiryType` 파라미터 수신, `addLabel()` 호출
- `src/lib/chatwoot-api.ts` — `addLabel(conversationId, labels)` 함수 추가

## 수동 사전 작업

Chatwoot 대시보드에서 라벨 4개 생성 필요:
- Settings → Labels → Add Label
- 슬러그: `usage`, `error`, `billing`, `remote`

## 향후 연동 (별도 작업)

바로바로 앱에서 고객 정보(이름, 병원명)를 자동으로 전달하는 방식(postMessage 또는 URL 파라미터)은 바로바로 앱 구조 확정 후 별도 태스크로 처리한다. 현재 테스트 환경은 폼 입력 방식 유지.
