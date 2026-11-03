/**
 * Saves registrations (and anonymous visit stats) from the event landing pages into a Google Sheet,
 * emails Annabelle on every sign-up, and adds a one-tap WhatsApp
 * confirmation link (to the personal confirmation page) for each registrant.
 * Works inside a sheet (Extensions > Apps Script) or as a standalone
 * project at script.google.com, where setup() creates the sheet itself.
 */
const SHEET_NAME = 'הרשמות';
const HEADERS = [
  'תאריך הרשמה', 'מזהה', 'אירוע', 'שם', 'טלפון', 'מאיפה', 'מה היית רוצה להעז',
  'מחיר', 'אמצעי תשלום', 'סטטוס', 'שולם ✔ (לסמן ידנית)', 'אישור נשלח', 'שליחת אישור בוואטסאפ', 'אימייל'
];
const COL = { id: 2, method: 9, status: 10, paid: 11, confirm: 13, email: 14 };

// Where sign-up alerts go
const NOTIFY_EMAIL = 'memmiconsulting@gmail.com';
// Special e-mail when the number of registrations reaches each of these
const MILESTONES = [20, 25, 30];
// Optional WhatsApp alerts to yourself via CallMeBot (leave empty to skip)
const CALLMEBOT_PHONE = '';   // e.g. '972525826993'
const CALLMEBOT_APIKEY = '';  // the key CallMeBot sends you

const SITE = 'https://annabellememmi.github.io/Annabelle-workshops-retreats-1-on-1/events/reconnect-nov-2026/';
const GROUP_LINK = 'https://chat.whatsapp.com/Dou0kksJlg2AmYRe2pUojQ';

// ---- anonymous visit stats ----
const VISITS_SHEET = 'כניסות לאתר';
const SECTIONS = [
  ['top', 'פתיחה'], ['story', 'מתי בפעם האחרונה'], ['venue', 'הלוקיישן'], ['taste', 'אירועים קודמים'],
  ['about', 'מי אני'], ['agenda', 'מהלך הערב'], ['faq', 'פרטים חשובים'], ['tickets', 'כרטיס ומחיר'], ['contact', 'שמירה על קשר'],
  ['voices', 'משתתפות משתפות'] // added later, so its column is last
];
// the order the sections appear on the page (for the e-mail report)
const PAGE_ORDER = ['top', 'story', 'taste', 'voices', 'venue', 'about', 'agenda', 'faq', 'tickets', 'contact'];
const VISIT_HEADERS = ['תאריך', 'מזהה ביקור', 'מבקרת', 'חוזרת?', 'מקור', 'מכשיר', 'שניות בדף', 'גלילה %', 'פתחה טופס?']
  .concat(SECTIONS.map(([, he]) => 'שניות: ' + he));

/** Run once from the editor: creates the sheet and its headers, and logs its link. */
function setup() {
  const sh = getSheet_();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#DAD8D1');
  sh.setFrozenRows(1);
  sh.setRightToLeft(true);
  sh.setColumnWidth(7, 280);
  sh.setColumnWidth(COL.confirm, 170);
  MailApp.getRemainingDailyQuota(); // asks for the e-mail permission now, not on the first sign-up
  Logger.log('הגיליון מוכן: ' + sh.getParent().getUrl());
}

function doPost(e) {
  if (e.parameter.action === 'visit') return recordVisit_(e.parameter);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let alert = null;
  try {
    const p = e.parameter;
    const sh = getSheet_();
    const row = findRow_(sh, p.id);

    if (p.action === 'register') {
      const values = [new Date(), p.id, p.event, p.name, "'" + p.phone, p.from, p.expectation, Number(p.price)];
      if (row) {
        sh.getRange(row, 1, 1, values.length).setValues([values]);
        sh.getRange(row, COL.email).setValue(p.email || '');
      } else {
        sh.appendRow(values.concat(['', 'נרשמה, טרם שילמה']));
        const r = sh.getLastRow();
        sh.getRange(r, COL.paid, 1, 2).insertCheckboxes();
        sh.getRange(r, COL.confirm).setFormula(confirmFormula_(p.name, p.phone));
        sh.getRange(r, COL.email).setValue(p.email || '');
        alert = {
          subject: '🌿 נרשמה חדשה: ' + p.name,
          body: 'נרשמה חדשה לערב "מתחברת חזרה לעצמך באהבה"\n\n' +
            'שם: ' + p.name + '\nטלפון: ' + p.phone + '\nאימייל: ' + (p.email || '') + '\nמאיפה: ' + p.from +
            '\nמה היית רוצה להעז: ' + p.expectation + '\nמחיר: ' + p.price + ' ₪\n\n' +
            'סה"כ נרשמות עד עכשיו: ' + (r - 1) + '\n\n' +
            'הגיליון: ' + sh.getParent().getUrl()
        };
      }
    } else if (row && p.action === 'payment_click') {
      sh.getRange(row, COL.method).setValue(p.method === 'bit' ? 'ביט' : 'פייבוקס');
      sh.getRange(row, COL.status).setValue('עברה לדף התשלום');
    } else if (row && p.action === 'paid_reported') {
      sh.getRange(row, COL.status).setValue('דיווחה ששילמה, לאמת');
      const name = sh.getRange(row, 4).getValue();
      const method = sh.getRange(row, COL.method).getValue() || 'ביט/פייבוקס';
      alert = {
        subject: '💳 ' + name + ' דיווחה ששילמה',
        body: name + ' דיווחה ששילמה ב' + method + '.\n\n' +
          '1. בדקי שהכסף הגיע\n2. סמני ✔ בעמודה "שולם"\n' +
          '3. לחצי על "שליחת אישור" באותה שורה כדי לשלוח לה את האישור בוואטסאפ\n\n' +
          'הגיליון: ' + sh.getParent().getUrl()
      };
    }
  } finally {
    lock.releaseLock();
  }
  if (alert) notify_(alert.subject, alert.body);
  checkMilestones_();
  return ContentService.createTextOutput('ok');
}

/** Saves (or updates) one row per visit. A visit may report several times; the row is overwritten. */
function recordVisit_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = getVisitsSheet_();
    const row = [new Date(), p.visit, p.visitor, p.returning === '1' ? 'כן' : 'לא', p.source || '', p.device || '',
      Number(p.seconds) || 0, Number(p.scroll) || 0, p.opened === '1' ? 'כן' : 'לא']
      .concat(SECTIONS.map(([id]) => Number(p['s_' + id]) || 0));
    const last = sh.getLastRow();
    let r = 0;
    if (last > 1) {
      const n = Math.min(last - 1, 300); // only recent rows are checked
      const ids = sh.getRange(last - n + 1, 2, n, 1).getValues();
      const i = ids.map((x) => x[0]).lastIndexOf(p.visit);
      if (i !== -1) r = last - n + 1 + i;
    }
    if (r) { row[0] = sh.getRange(r, 1).getValue(); sh.getRange(r, 1, 1, row.length).setValues([row]); }
    else sh.appendRow(row);
  } finally { lock.releaseLock(); }
  return ContentService.createTextOutput('ok');
}

function getVisitsSheet_() {
  const ss = getSheet_().getParent();
  let sh = ss.getSheetByName(VISITS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(VISITS_SHEET);
    sh.getRange(1, 1, 1, VISIT_HEADERS.length).setValues([VISIT_HEADERS]).setFontWeight('bold').setBackground('#DAD8D1');
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
  } else if (sh.getLastColumn() < VISIT_HEADERS.length) {
    sh.getRange(1, 1, 1, VISIT_HEADERS.length).setValues([VISIT_HEADERS]).setFontWeight('bold').setBackground('#DAD8D1');
  }
  return sh;
}

/** Builds the stats summary for visits since `from` (a Date). */
function visitSummary_(from) {
  const sh = getVisitsSheet_();
  const last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, VISIT_HEADERS.length).getValues().filter((r) => r[0] >= from) : [];
  if (!rows.length) return 'אין כניסות בתקופה הזו.';
  const people = new Set(rows.map((r) => r[2])).size;
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const secs = rows.map((r) => r[6]);
  const opened = rows.filter((r) => r[8] === 'כן').length;
  const mobile = rows.filter((r) => r[5] === 'נייד').length;
  const sources = {};
  rows.forEach((r) => (sources[r[4]] = (sources[r[4]] || 0) + 1));
  const bySection = PAGE_ORDER.map((id) => {
    const i = SECTIONS.findIndex(([x]) => x === id);
    const col = rows.map((r) => Number(r[9 + i]) || 0);
    return [SECTIONS[i][1], avg(col), col.filter((v) => v >= 2).length];
  });
  const fmt = (s) => (s >= 60 ? Math.floor(s / 60) + ' דק׳ ' + Math.round(s % 60) + ' שנ׳' : Math.round(s) + ' שנ׳');
  return 'כניסות: ' + rows.length + '\n' +
    'מבקרות שונות: ' + people + '\n' +
    'זמן ממוצע בדף: ' + fmt(avg(secs)) + '\n' +
    'גלילה ממוצעת: ' + Math.round(avg(rows.map((r) => r[7]))) + '%\n' +
    'פתחו את טופס ההרשמה: ' + opened + ' (' + Math.round(100 * opened / rows.length) + '%)\n' +
    'מנייד: ' + Math.round(100 * mobile / rows.length) + '%\n\n' +
    'כמה זמן התעכבו בכל חלק (ממוצע) · כמה הגיעו אליו:\n' +
    bySection.map(([he, a, n]) => '• ' + he + ': ' + fmt(a) + ' · ' + Math.round(100 * n / rows.length) + '%').join('\n') + '\n\n' +
    'מאיפה הגיעו:\n' +
    Object.entries(sources).sort((a, b) => b[1] - a[1]).map(([k, v]) => '• ' + k + ': ' + v).join('\n');
}

/** Daily e-mail: yesterday's visits plus totals since the start. Runs from the trigger made by setupDailyReport(). */
function dailyReport() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const body = '📊 24 השעות האחרונות\n' + visitSummary_(dayAgo) +
    '\n\n📈 מאז ההתחלה\n' + visitSummary_(new Date(0)) +
    '\n\nכל הנתונים בלשונית "' + VISITS_SHEET + '": ' + getSheet_().getParent().getUrl();
  MailApp.sendEmail(NOTIFY_EMAIL, '📊 עדכון יומי: כניסות לדף "מתחברת חזרה לעצמך באהבה"', body);
}

/** Run once from the editor: sends the stats e-mail every morning at 8:00. */
function setupDailyReport() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'dailyReport').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyReport').timeBased().everyDays(1).atHour(8).inTimezone('Asia/Jerusalem').create();
  getVisitsSheet_();
  Logger.log('העדכון היומי הופעל: כל בוקר ב־8:00');
}

/** Sends one celebratory e-mail per milestone (20, 25, 30 registrations). Each is sent only once. */
function checkMilestones_() {
  try {
    const sh = getSheet_();
    const last = sh.getLastRow();
    if (last < 2) return;
    const count = sh.getRange(2, 4, last - 1, 1).getValues().filter((r) => String(r[0]).trim()).length;
    const props = PropertiesService.getScriptProperties();
    const sent = JSON.parse(props.getProperty('MILESTONES_SENT') || '[]');
    MILESTONES.filter((m) => count >= m && sent.indexOf(m) === -1).forEach((m) => {
      MailApp.sendEmail(NOTIFY_EMAIL, '🎉 יש ' + m + ' נרשמות לערב!',
        'מזל טוב! הגעת ל־' + m + ' נרשמות לערב "מתחברת חזרה לעצמך באהבה" 🌿\n\n' +
        'סה"כ שורות בגיליון כרגע: ' + count + '\n\nהגיליון: ' + sh.getParent().getUrl());
      sent.push(m);
    });
    props.setProperty('MILESTONES_SENT', JSON.stringify(sent));
  } catch (err) { console.error(err); }
}

/** E-mail (and optionally WhatsApp) alert to Annabelle. Never blocks a registration. */
function notify_(subject, body) {
  try { MailApp.sendEmail(NOTIFY_EMAIL, subject, body); } catch (err) { console.error(err); }
  if (CALLMEBOT_PHONE && CALLMEBOT_APIKEY) {
    try {
      UrlFetchApp.fetch('https://api.callmebot.com/whatsapp.php?phone=' + CALLMEBOT_PHONE +
        '&text=' + encodeURIComponent(subject + '\n' + body.split('\n\nהגיליון')[0]) +
        '&apikey=' + CALLMEBOT_APIKEY, { muteHttpExceptions: true });
    } catch (err) { console.error(err); }
  }
}

/** A cell link that opens WhatsApp to the registrant with the confirmation ready to send. */
function confirmFormula_(name, phone) {
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '972' + digits.slice(1);
  const first = String(name).trim().split(/\s+/)[0];
  const text =
    'היי ' + first + ' 🤍 התשלום התקבל ואת רשומה לערב!\n\n' +
    '*שני דברים חשובים:*\n' +
    '1. למלא הצהרת בריאות לפני האירוע\n' +
    '2. להצטרף לקבוצת העדכונים, שם אשלח ביום האירוע את המיקום המדויק ופרטים חשובים\n\n' +
    'הכול כאן:\n' +
    SITE + 'confirmed.html?n=' + encodeURIComponent(first);
  const url = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text);
  return '=HYPERLINK("' + url.replace(/"/g, '""') + '","📲 שליחת אישור")';
}

/**
 * Run from the editor to rebuild the "שליחת אישור" link for every existing row
 * (e.g. after changing the message text). Safe to run any time.
 */
function refreshConfirmLinks() {
  const sh = getSheet_();
  sh.getRange(1, COL.confirm).setValue(HEADERS[COL.confirm - 1]);
  const last = sh.getLastRow();
  if (last < 2) return;
  const rows = sh.getRange(2, 4, last - 1, 2).getValues(); // name, phone
  sh.getRange(2, COL.confirm, last - 1, 1).setFormulas(rows.map(([name, phone]) => [name ? confirmFormula_(name, phone) : '']));
}

function getSheet_() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    const props = PropertiesService.getScriptProperties();
    const id = props.getProperty('SHEET_ID');
    if (id) {
      ss = SpreadsheetApp.openById(id);
    } else {
      ss = SpreadsheetApp.create('הרשמות לאירועים');
      props.setProperty('SHEET_ID', ss.getId());
    }
  }
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function findRow_(sh, id) {
  if (!id || sh.getLastRow() < 2) return null;
  const ids = sh.getRange(2, COL.id, sh.getLastRow() - 1, 1).getValues();
  const i = ids.findIndex((r) => r[0] === id);
  return i === -1 ? null : i + 2;
}
