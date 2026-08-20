# 홈/상업공간 인테리어·스타일링 상담 문의 폼

인테리어·스타일링 업체의 웹/모바일 고객 문의 접수 페이지입니다. 요건 명세(`SNS 마케팅관리_new.pdf`, 내부 문서라 저장소에는 포함되지 않음)에 정의된 문항을 기반으로 하며, 제출된 문의는 Google Sheets에 자동으로 저장됩니다.

## 구성

- `inquiry.html` — 문의 폼 페이지 (정적 HTML/CSS/JS, 빌드 불필요)
- `google-apps-script/` — 제출 데이터를 Google Sheets에 저장하는 Apps Script 코드와 배포 가이드

## 주요 기능

- PDF 명세의 13개 문항 + 조건부 노출(1번 응답에 따라 10·10-1번 노출)
- 다음(Daum) 우편번호 API를 이용한 주소 검색 (모바일 호환을 위해 팝업 대신 인앱 레이어 방식 사용)
- 개인정보 수집·이용 동의 안내 및 필수 동의 체크
- Google Apps Script 웹훅을 통한 Google Sheets 자동 저장
- Sheets 포뮬러 인젝션(CSV Injection) 방어 처리

## 로컬 실행

Daum 우편번호 API는 `file://`로 직접 열면 동작하지 않으므로, 로컬 웹서버로 열어야 합니다.

```bash
python3 -m http.server 8765
# 이후 브라우저에서 http://localhost:8765/inquiry.html 접속
```

## Google Sheets 연동 배포

`google-apps-script/README.md` 참고. 배포 후 발급되는 웹앱 URL을 `inquiry.html`의 `SCRIPT_URL` 상수에 넣어야 실제 제출이 저장됩니다.
