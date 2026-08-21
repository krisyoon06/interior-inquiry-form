// 문의 폼(inquiry.html)에서 전송된 데이터를 스프레드시트에 한 행씩 기록합니다.
var SHEET_NAME = '문의내역';

var HEADERS = [
  '접수일시', '상담서비스', '성함', '이메일', '연락처',
  '우편번호', '기본주소', '상세주소',
  '면적(평)', '입주/오픈예정일', '예산(만원)',
  '공사시작가능일', '시공필요부분', '공간묘사',
  '유입경로', '통화가능시간대', '개인정보동의'
];

// HEADERS(접수일시 제외)와 같은 순서로, data 객체에서 읽어와 시트 행을 구성할 필드.
// 필드별 최대 길이도 함께 정의(구글 시트 셀당 5만자 제한을 넘기지 않도록, 그리고
// 스팸성 대용량 페이로드로 시트가 불필요하게 커지는 것을 막기 위한 상한).
var ROW_FIELDS = [
  { key: 'service', max: 50 }, { key: 'name', max: 50 },
  { key: 'email', max: 100 }, { key: 'phone', max: 30 },
  { key: 'zonecode', max: 20 }, { key: 'addressBase', max: 200 },
  { key: 'addressDetail', max: 100 }, { key: 'area', max: 20 },
  { key: 'moveInDate', max: 50 }, { key: 'budget', max: 20 },
  { key: 'constructionStart', max: 50 }, { key: 'constructionParts', max: 300 },
  { key: 'description', max: 2000 }, { key: 'referral', max: 50 },
  { key: 'callTime', max: 100 }, { key: 'consent', max: 10 }
];

// 순수 숫자로만 이루어지면 구글 시트가 자동으로 "숫자"로 인식해 앞자리 0을
// 지워버리는 필드(연락처, 우편번호 등). 내용과 무관하게 항상 텍스트로 저장한다.
var FORCE_TEXT_FIELDS = ['phone', 'zonecode'];

// 사람은 폼을 최소 이 정도 시간은 들여서 채운다고 가정하고, 그보다 빨리
// 들어오는 제출은 자동화된 스팸/봇으로 간주해 조용히 무시한다.
var MIN_FILL_TIME_MS = 3000;

// Slack Incoming Webhook URL은 코드(공개 저장소)에 직접 넣지 않고, Apps Script
// 프로젝트 설정 > 스크립트 속성(Script properties)의 SLACK_WEBHOOK_URL 키에서 읽어온다.
var PROP_WEBHOOK = 'SLACK_WEBHOOK_URL';

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse_({ result: 'error', message: 'invalid payload' });
  }

  // 허니팟: 화면에는 보이지 않아 실제 사용자는 채울 수 없는 필드.
  // 값이 채워져 있으면 자동화된 제출로 보고, 정상 처리된 것처럼 응답만 하고 무시한다.
  if (data.honeypot) {
    return jsonResponse_({ result: 'success' });
  }

  // loadedAt(폼이 로드된 시각) 대비 제출까지 걸린 시간이 너무 짧으면 봇으로 간주.
  if (data.loadedAt && (Date.now() - Number(data.loadedAt)) < MIN_FILL_TIME_MS) {
    return jsonResponse_({ result: 'success' });
  }

  if (!isValidSubmission_(data)) {
    return jsonResponse_({ result: 'error', message: 'missing required fields' });
  }

  var timestamp = formatTimestamp_(data.submittedAt);
  var sheet = getOrCreateSheet_();
  var row = [timestamp].concat(
    ROW_FIELDS.map(function (field) {
      var str = truncate_(data[field.key], field.max);
      return FORCE_TEXT_FIELDS.indexOf(field.key) !== -1
        ? forceText_(str)
        : sanitizeForSheet_(str);
    })
  );

  sheet.appendRow(row);

  // Slack 전송이 실패해도(웹훅 URL 미설정, 네트워크 오류 등) 폼 제출 자체는 이미
  // 시트에 기록됐으므로, 그 실패가 사용자에게 전달되는 성공 응답에 영향을 주지 않는다.
  try {
    sendSlackMessage_(buildSlackSummary_(data, timestamp));
  } catch (err) {
    Logger.log('Slack 알림 전송 실패: ' + err);
  }

  return jsonResponse_({ result: 'success' });
}

// 실제 상담에 필요한 최소 필수값만 서버에서도 다시 검증한다.
// (클라이언트 검증은 폼을 거치지 않은 직접 POST 요청에는 적용되지 않으므로)
function isValidSubmission_(data) {
  return !!(data.service && data.name && data.email && data.phone && data.addressBase && data.consent === 'Y');
}

function truncate_(value, max) {
  var str = (value === undefined || value === null) ? '' : String(value);
  return max ? str.slice(0, max) : str;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
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

// 앞에 항상 어퍼스트로피를 붙여 구글 시트가 숫자/날짜/수식 등으로 자동 해석하지
// 못하게 하고 무조건 텍스트로 저장되도록 강제한다(FORCE_TEXT_FIELDS 전용).
function forceText_(value) {
  var str = (value === undefined || value === null) ? '' : String(value);
  return str.length > 0 ? "'" + str : str;
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

// data(폼 원본 값)를 기준으로 Slack 요약 메시지를 만든다. 시트에 저장되는 값과 달리
// 어퍼스트로피 등 셀 서식용 접두어가 없는 원본 텍스트를 그대로 보여준다.
function buildSlackSummary_(data, timestamp) {
  var lines = ['*' + HEADERS[0] + '*: ' + timestamp];
  for (var i = 0; i < ROW_FIELDS.length; i++) {
    var field = ROW_FIELDS[i];
    var label = HEADERS[i + 1];
    var value = data[field.key];
    if (value === undefined || value === null || value === '') continue;
    lines.push('*' + label + '*: ' + truncate_(value, field.max));
  }
  return ':memo: *새 문의 접수*\n' + lines.join('\n');
}

function sendSlackMessage_(text) {
  var webhookUrl = PropertiesService.getScriptProperties().getProperty(PROP_WEBHOOK);
  if (!webhookUrl) {
    throw new Error('스크립트 속성에 SLACK_WEBHOOK_URL이 설정되지 않았습니다.');
  }

  UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ text: text })
  });
}
