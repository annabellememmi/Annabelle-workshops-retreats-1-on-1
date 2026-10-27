/**
 * Saves registrations from the event landing pages into a Google Sheet,
 * emails Annabelle on every sign-up, and adds a one-tap WhatsApp
 * confirmation link (to the personal confirmation page) for each registrant.
 * Works inside a sheet (Extensions > Apps Script) or as a standalone
 * project at script.google.com, where setup() creates the sheet itself.
 */
const SHEET_NAME = 'הרשמות';
const HEADERS = [
  'תאריך הרשמה', 'מזהה', 'אירוע', 'שם', 'טלפון', 'מאיפה', 'ציפייה מהערב',
  'מחיר', 'אמצעי תשלום', 'סטטוס', 'שולם ✔ (לסמן ידנית)', 'אישור נשלח', 'שליחת אישור בוואטסאפ'
];
const COL = { id: 2, method: 9, status: 10, paid: 11, confirm: 13 };

// Where sign-up alerts go
const NOTIFY_EMAIL = 'memmiconsulting@gmail.com';
// Optional WhatsApp alerts to yourself via CallMeBot (leave empty to skip)
const CALLMEBOT_PHONE = '';   // e.g. '972525826993'
const CALLMEBOT_APIKEY = '';  // the key CallMeBot sends you

const SITE = 'https://annabellememmi.github.io/Annabelle-workshops-retreats-1-on-1/events/reconnect-nov-2026/';
const GROUP_LINK = 'https://chat.whatsapp.com/Dou0kksJlg2AmYRe2pUojQ';

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
      } else {
        sh.appendRow(values.concat(['', 'נרשמה, טרם שילמה']));
        const r = sh.getLastRow();
        sh.getRange(r, COL.paid, 1, 2).insertCheckboxes();
        sh.getRange(r, COL.confirm).setFormula(confirmFormula_(p.name, p.phone));
        alert = {
          subject: '🌿 נרשמה חדשה: ' + p.name,
          body: 'נרשמה חדשה לערב "מתחברת חזרה לעצמך באהבה"\n\n' +
            'שם: ' + p.name + '\nטלפון: ' + p.phone + '\nמאיפה: ' + p.from +
            '\nציפייה מהערב: ' + p.expectation + '\nמחיר: ' + p.price + ' ₪\n\n' +
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
  return ContentService.createTextOutput('ok');
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
    'היי ' + first + ' 🤍 התשלום התקבל ואת רשומה לערב! ' +
    'כל הפרטים, הצהרת הבריאות וקבוצת העדכונים כאן:\n' +
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
