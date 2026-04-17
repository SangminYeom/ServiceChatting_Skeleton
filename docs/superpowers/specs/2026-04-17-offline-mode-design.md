# 오프라인 모드 설계

> 작성일: 2026-04-17

## 목표

업무 시간(평일 09:00~18:00 KST) 외에 "상담사 연결" 버튼을 비활성화하고 안내문을 표시하여, 고객이 상담 불가 시간임을 즉시 알 수 있도록 한다.

## 업무 시간 기준

- **온라인:** 평일(월~금) 09:00~18:00 KST
- **오프라인:** 주말, 공휴일 여부와 무관하게 시간 기준만 적용 (평일이라도 18:00 이후는 오프라인)
- 서버(Vercel, UTC) 기준으로 KST 변환하여 판단

## API

### `GET /api/consultation/status`

업무 시간 여부를 반환한다.

**Response:**
```json
{ "online": true }
```
또는
```json
{ "online": false }
```

**판단 로직:**
```
KST = UTC + 9시간
평일(getDay() !== 0 && getDay() !== 6) && 09:00 <= KST 시각 < 18:00
→ online: true
그 외 → online: false
```

## 프론트엔드 동작

`ConsultationForm` 마운트 시 `GET /api/consultation/status` 호출:

- **로딩 중:** 버튼 비활성화 (`loading` 상태)
- **online: true:** 기존과 동일하게 동작
- **online: false:** "상담사 연결" 버튼 비활성화 + 안내문 표시:
  > "현재 상담 가능 시간이 아닙니다 (평일 09:00~18:00)."
- **API 에러:** 안전하게 `online: true`로 폴백 (상담 연결 가능 유지)

## 파일 구조

```
src/
  app/api/consultation/status/
    route.ts              — 신규: GET, 업무 시간 판단 및 응답
  components/
    consultation-form.tsx — 수정: 마운트 시 status 조회, 오프라인 UI
```

## DB / 환경 변수 변경

없음.

## 에러 처리

- status API 호출 실패 시: `online: true` 폴백 (상담 연결 기회를 막지 않음)
- status API 응답 지연 시: 버튼 로딩 상태 유지 후 응답 수신 시 반영
