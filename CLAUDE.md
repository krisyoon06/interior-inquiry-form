# CLAUDE.md

이 저장소는 홈/상업공간 인테리어·스타일링 업체의 **고객 문의 접수 웹/모바일 페이지**입니다. 빌드 시스템 없이 순수 HTML/CSS/JS로만 구성됩니다.

## 배경

요건은 저장소에 포함된 `SNS 마케팅관리_new.pdf`에 정의된 13개 문항(필수/선택 여부, 1번 응답에 따른 10·10-1번 조건부 노출 규칙 포함)을 기준으로 하되, 실제 개발 중 다음과 같이 요건이 조정됨:

- 4번(연락처): 정해진 형식(010-0000-0000) 강제하지 않음 — 숫자 7자리 이상이면 통과
- 5번(주소): 상세주소(아파트명/상호명)는 필수 아님
- 7번(구성원 수): 필수 → 선택 항목으로 변경
- 9번(예산): 문항 문구에 "스타일링의 경우 가구·소품 구매 비용" 힌트 추가
- 12번 "네이버" → "네이버 검색"으로 명칭 변경

## 구성 파일

- `inquiry.html` — 문의 폼 페이지 (제출 시 Google Apps Script로 POST)
- `thankyou.html` — 제출 성공 후 리다이렉트되는 완료 안내 페이지
- `google-apps-script/Code.gs` — 제출 데이터를 Google Sheets에 append하는 웹훅 스크립트
- `google-apps-script/README.md` — Sheets + Apps Script 배포 절차
- `SNS 마케팅관리_new.pdf` — 원본 요건 명세

## 알아둘 것 (구현 중 발견한 이슈)

- **다음(Daum) 우편번호 API는 `file://`로 직접 열면 동작 안 함.** 반드시 로컬 웹서버(`python3 -m http.server 8765` 등)로 `http://`를 통해 열어야 함. 실제 휴대폰으로 테스트할 땐 `localhost`가 아니라 같은 Wi-Fi의 PC LAN IP(`http://<LAN IP>:8765/inquiry.html`)로 접속해야 함.
- 주소 검색은 팝업(`window.open`) 대신 **인앱 레이어(embed) 모달** 방식 사용 — 모바일 브라우저에서 팝업이 결과 콜백을 못 받는 문제가 있었음.
- `closeAddressModal()`에서 모달 컨테이너의 `innerHTML`을 즉시 비우면 다음/카카오 라이브러리 자체의 iframe 정리 로직과 충돌해 `removeChild` 콘솔 에러가 남 — 그래서 모달을 숨기기만 하고, 다음 `openAddressModal()` 호출 시점에 비움.
- `google-apps-script/Code.gs`는 Google Sheets 포뮬러 인젝션(셀 값이 `=,+,-,@`로 시작하면 수식으로 해석되는 문제) 방어 로직(`sanitizeForSheet_`)을 포함함. 새 필드를 추가할 때도 이 sanitize를 거치도록 유지할 것.
- 개인정보 수집·이용 동의 문구의 보유기간(초안: 상담 종료 후 1년)은 placeholder이므로 실제 운영 정책에 맞게 조정 필요.
- iOS Safari 자동 확대 방지를 위해 모든 입력 필드 폰트는 16px 이상 유지.

## 남은 작업 (TODO)

- [ ] Google Apps Script를 실제로 배포하고, `inquiry.html`의 `SCRIPT_URL` 상수(현재 `YOUR_DEPLOYMENT_ID` placeholder)를 실제 웹앱 URL로 교체
- [ ] URL 연결 후 실제 제출 → Google Sheets 저장까지 end-to-end 테스트
- [ ] Apps Script가 "모든 사용자" 액세스로 배포되므로, URL 유출 시 스팸/어뷰징 가능성에 대한 추가 보안 검토(레이트 리밋, 캡차 등) 필요 여부 판단

## 로컬 실행/테스트

```bash
python3 -m http.server 8765
# 브라우저에서 http://localhost:8765/inquiry.html 접속
```

## Google Sheets 연동 배포

`google-apps-script/README.md` 참고.

## 커밋 컨벤션

커밋 메시지는 한글로 작성.
