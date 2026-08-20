// 문의 폼(inquiry.html)에서 전송된 데이터를 스프레드시트에 한 행씩 기록합니다.
var SHEET_NAME = '문의내역';

var HEADERS = [
  '접수일시', '상담서비스', '성함', '이메일', '연락처',
  '우편번호', '기본주소', '상세주소',
  '면적(평)', '입주/오픈예정일', '예산(만원)',
  '공사시작가능일', '시공필요부분', '공간묘사',
  '유입경로', '통화가능시간대', '개인정보동의'
];

function doPost(e) {
  var sheet = getOrCreateSheet_();
  var data = JSON.parse(e.postData.contents);

  var row = [
    formatTimestamp_(data.submittedAt),
    data.service, data.name, data.email, data.phone,
    data.zonecode, data.addressBase, data.addressDetail,
    data.area, data.moveInDate, data.budget,
    data.constructionStart, data.constructionParts, data.description,
    data.referral, data.callTime, data.consent
  ].map(sanitizeForSheet_);

  sheet.appendRow(row);

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// 셀 값이 =, +, -, @ 로 시작하면 Google Sheets가 수식으로 해석해버리는
// 포뮬러 인젝션(CSV Injection)을 막기 위해, 앞에 어퍼스트로피(')를 붙여
// 항상 텍스트로만 저장되도록 한다. (엔드포인트는 인증 없이 호출 가능하므로
// 폼을 거치지 않은 임의 POST 요청에 대해서도 방어적으로 처리)
var FORMULA_TRIGGER_CHARS = ['=', '+', '-', '@', '\t', '\r'];

function sanitizeForSheet_(value) {
  var str = (value === undefined || value === null) ? '' : String(value);
  if (str.length > 0 && FORMULA_TRIGGER_CHARS.indexOf(str.charAt(0)) !== -1) {
    return "'" + str;
  }
  return str;
}

function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function formatTimestamp_(iso) {
  var d = iso ? new Date(iso) : new Date();
  return Utilities.formatDate(d, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}
