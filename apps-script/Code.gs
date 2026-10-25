/**
 * Saves registrations from the event landing pages into this Google Sheet.
 * Setup steps (Hebrew) are in apps-script/README.md.
 */
const SHEET_NAME = 'הרשמות';
const HEADERS = [
  'תאריך הרשמה', 'מזהה', 'אירוע', 'שם', 'טלפון', 'מאיפה', 'ציפייה מהערב',
  'מחיר', 'אמצעי תשלום', 'סטטוס', 'שולם ✔ (לסמן ידנית)', 'אישור נשלח'
];
const COL = { id: 2, method: 9, status: 10, paid: 11 };

/** Run once from the editor to create the sheet with headers and checkboxes. */
function setup() {
  const sh = getSheet_();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#DAD8D1');
  sh.setFrozenRows(1);
  sh.setRightToLeft(true);
  sh.getRange(2, COL.paid, sh.getMaxRows() - 1, 2).insertCheckboxes();
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = e.parameter;
    const sh = getSheet_();
    const row = findRow_(sh, p.id);

    if (p.action === 'register') {
      const values = [new Date(), p.id, p.event, p.name, "'" + p.phone, p.from, p.expectation, Number(p.price)];
      if (row) {
        sh.getRange(row, 1, 1, values.length).setValues([values]);
      } else {
        sh.appendRow(values.concat(['', 'נרשמה – טרם שילמה']));
        sh.getRange(sh.getLastRow(), COL.paid, 1, 2).insertCheckboxes();
      }
    } else if (row && p.action === 'payment_click') {
      sh.getRange(row, COL.method).setValue(p.method === 'bit' ? 'ביט' : 'פייבוקס');
      sh.getRange(row, COL.status).setValue('עברה לדף התשלום');
    } else if (row && p.action === 'paid_reported') {
      sh.getRange(row, COL.status).setValue('דיווחה ששילמה – לאמת');
    }
    return ContentService.createTextOutput('ok');
  } finally {
    lock.releaseLock();
  }
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function findRow_(sh, id) {
  if (!id || sh.getLastRow() < 2) return null;
  const ids = sh.getRange(2, COL.id, sh.getLastRow() - 1, 1).getValues();
  const i = ids.findIndex((r) => r[0] === id);
  return i === -1 ? null : i + 2;
}
