# CLAUDE.md

이 저장소는 홈/상업공간 인테리어·스타일링 업체의 **고객 문의 접수 웹/모바일 페이지**입니다. 빌드 시스템 없이 순수 HTML/CSS/JS로만 구성됩니다.

## 배경

요건은 (저장소 public 전환 전 제거되어 로컬에만 보관 중인) `SNS 마케팅관리_new.pdf`에 정의된 13개 문항(필수/선택 여부, 1번 응답에 따른 10·10-1번 조건부 노출 규칙 포함)을 기준으로 하되, 실제 개발 중 다음과 같이 요건이 조정됨. 아래 문항 번호는 **PDF 원본 명세 기준 번호**이며, 현재 `inquiry.html`에 실제 표시되는 번호와는 다를 수 있음(구성원 문항 삭제로 8번 이후 문항이 한 칸씩 당겨짐 — 아래 참고):

- 4번(연락처): 정해진 형식(010-0000-0000) 강제하지 않음 — 숫자 7자리 이상이면 통과
- 5번(주소): 상세주소(아파트명/상호명)는 필수 아님
- 7번(구성원 수): 필수 → 선택 항목으로 변경했다가, 이후 문항 자체를 완전히 삭제함(**현재 폼에는 없음**). 이에 따라 원본 8~13번 문항이 화면상 7~12번으로 당겨져 표시되고, `google-apps-script/Code.gs`의 시트 헤더/append 로직에서도 `구성원수` 컬럼을 제거함
- 9번(예산): 문항 문구에 "스타일링의 경우 가구·소품 구매 비용" 힌트 추가
- 12번 "네이버" → "네이버 검색"으로 명칭 변경

## 구성 파일

- `inquiry.html` — 문의 폼 페이지 (제출 시 Google Apps Script로 POST)
- `thankyou.html` — 제출 성공 후 리다이렉트되는 완료 안내 페이지
- `google-apps-script/Code.gs` — 제출 데이터를 Google Sheets에 append하는 웹훅 스크립트
- `google-apps-script/README.md` — Sheets + Apps Script 배포 절차
- `SNS 마케팅관리_new.pdf` — 원본 요건 명세. 내부 기획 문서라 저장소 public 전환 시 제거함. 로컬 `~/Documents/interior-inquiry-form-private/`에 보관 중.

## 알아둘 것 (구현 중 발견한 이슈)

- **다음(Daum) 우편번호 API는 `file://`로 직접 열면 동작 안 함.** 반드시 로컬 웹서버(`python3 -m http.server 8765` 등)로 `http://`를 통해 열어야 함. 실제 휴대폰으로 테스트할 땐 `localhost`가 아니라 같은 Wi-Fi의 PC LAN IP(`http://<LAN IP>:8765/inquiry.html`)로 접속해야 함.
- 주소 검색은 팝업(`window.open`) 대신 **인앱 레이어(embed) 모달** 방식 사용 — 모바일 브라우저에서 팝업이 결과 콜백을 못 받는 문제가 있었음.
- `closeAddressModal()`에서 모달 컨테이너의 `innerHTML`을 즉시 비우면 다음/카카오 라이브러리 자체의 iframe 정리 로직과 충돌해 `removeChild` 콘솔 에러가 남 — 그래서 모달을 숨기기만 하고, 다음 `openAddressModal()` 호출 시점에 비움.
- `google-apps-script/Code.gs`는 Google Sheets 포뮬러 인젝션(셀 값이 `=,+,-,@`로 시작하면 수식으로 해석되는 문제) 방어 로직(`sanitizeForSheet_`)을 포함함. 새 필드를 추가할 때도 이 sanitize를 거치도록 유지할 것.
- 개인정보 수집·이용 동의 문구의 보유기간(초안: 상담 종료 후 1년)은 placeholder이므로 실제 운영 정책에 맞게 조정 필요.
- iOS Safari 자동 확대 방지를 위해 모든 입력 필드 폰트는 16px 이상 유지.

## 보안 (2026-08-20 점검)

저장소 public 전환 + 실 배포 이후, 배포된 웹훅(`SCRIPT_URL`)에 직접 curl로 침투 테스트를 진행함. 결과와 조치:

- **수식 인젝션**: `sanitizeForSheet_`로 이미 방어됨(값이 `=,+,-,@`로 시작하면 어퍼스트로피 접두 처리). 정상 동작 확인.
- **필드 길이 제한 없음** → `Code.gs`에 `ROW_FIELDS`별 `max` 길이 추가, `truncate_()`로 저장 전 잘라냄. 구글 시트 셀당 5만자 제한 보호 + 대용량 스팸 페이로드로 시트가 불필요하게 커지는 것 방지 목적.
- **서버 측 필수값 검증 없음**(클라이언트 검증은 폼을 거치지 않은 직접 POST에는 무력함) → `isValidSubmission_()` 추가, 필수 필드 없으면 저장 거부.
- **속도 제한 전무, 짧은 시간에 다량 제출 가능** → Apps Script 웹앱은 호출자 IP를 코드에서 알 수 없어 IP 기반 차단이 구조적으로 불가능함. 대신 다음 두 가지 경량 봇 차단 장치를 추가:
  - **허니팟 필드**(`inquiry.html`의 `#website`, CSS로 화면에서만 숨김): 실사용자는 채울 수 없고 자동입력 봇만 채움 → 값이 있으면 조용히 무시(성공 응답만 반환, 봇에게 신호 주지 않음)
  - **최소 작성 시간 체크**(`pageLoadedAt` → `Code.gs`의 `MIN_FILL_TIME_MS = 3000`): 폼 로드 후 3초 이내 제출은 봇으로 간주해 조용히 무시
  - 완전한 차단은 아니며(정교한 봇은 우회 가능), reCAPTCHA 같은 본격적인 대응은 별도 사이트키 발급이 필요해 보류 중
- **빈 body / GET 요청**: 내부 스택트레이스 등 민감 정보 노출 없음(구글 자체 에러 페이지로 처리). 다만 `doPost`에 `try/catch`를 추가해 malformed JSON도 깔끔한 에러 응답으로 처리하도록 보강.
- 프론트엔드(`inquiry.html`, `thankyou.html`) 쪽엔 `innerHTML` 등 DOM XSS 벡터 없음(사용자 입력이 어디에도 다시 렌더링되지 않음).

**⚠️ 중요**: 위 `Code.gs` 변경사항은 저장소 파일에만 반영되어 있고, **실제 배포된 Apps Script 웹앱에는 아직 반영 안 됨**. 사장님 Google Sheets의 Apps Script 편집기에서 `Code.gs` 최신 내용으로 교체 후 `배포 > 배포 관리 > 새 버전`으로 재배포해야 실제로 적용됨.

## 남은 작업 (TODO)

- [ ] 위 `Code.gs` 보안 개선사항을 실제 배포본에 반영(재배포)
- [ ] reCAPTCHA 등 본격적인 봇 차단 도입 여부 판단(사이트키 발급 필요)

## 로컬 실행/테스트

```bash
python3 -m http.server 8765
# 브라우저에서 http://localhost:8765/inquiry.html 접속
```

## Google Sheets 연동 배포

`google-apps-script/README.md` 참고.

## 커밋 컨벤션

커밋 메시지는 한글로 작성.
