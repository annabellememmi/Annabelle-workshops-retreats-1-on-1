# האירועים של אנאבל ממי

דפי נחיתה לאירועים, סדנאות וריטריטים — בעברית, מותאמים לנייד, באוויר בחינם דרך GitHub Pages.

## מה יש כאן

| קובץ / תיקייה | מה זה |
|---|---|
| `index.html` | עמוד הבית — רשימת האירועים הקרובים |
| `events/reconnect-nov-2026/` | דף הנחיתה של "מתחברת חזרה לעצמך בכיף" (12.11) |
| `assets/css/style.css` | העיצוב המשותף לכל האירועים (צבעים, פונטים) |
| `assets/js/event.js` | טופס ההרשמה, מדרגות המחיר, הספירלה |
| `assets/js/nature-sound.js` | צלילי הטבע (ציוצים ורוח) — מופעלים בלחיצה |
| `assets/img`, `assets/video` | תמונות וסרטונים |
| `apps-script/` | חיבור ההרשמות לגוגל שיטס — הוראות ב־`apps-script/README.md` |

## הגדרות האירוע

בראש הקובץ `events/reconnect-nov-2026/index.html` יש בלוק `window.EVENT`:
- **earlyBird** — מחיר מוקדמות לפני מע״מ, עד מתי הוא בתוקף (5.11 בחצות), וקישורי ביט / פייבוקס.
- **vat** — שיעור המע״מ. בדף מוצג המחיר הסופי כולל מע״מ.
- **regular** — המחיר הרגיל לפני מע״מ (200) וקישורי התשלום שלו.
- **sheetEndpoint** — הקישור לגוגל שיטס (ראי `apps-script/README.md`).

מ־5 בנובמבר הדף מציג אוטומטית קו על מחיר המוקדמות ואת המחיר החדש.
כדי לראות איך הדף ייראה בתאריך אחר, מוסיפים לכתובת: `?date=2026-11-06`.

## הוספת אירוע חדש

1. מעתיקים את התיקייה `events/reconnect-nov-2026` לתיקייה חדשה (למשל `events/retreat-2027-03`).
2. מעדכנים את הטקסטים, התאריכים והמחירים בקובץ החדש.
3. מוסיפים כרטיס לאירוע ב־`index.html` הראשי.

(או פשוט מבקשים ממני 🙂)

## פרסום ב־GitHub Pages — פעם אחת

1. **Settings ← General**, למטה ב־Danger Zone — **Change visibility ← Public** (GitHub Pages בחינם עובד רק למאגר ציבורי).
2. **Settings ← Pages** — תחת Branch לבחור `main` ותיקייה `/ (root)` ← Save.
3. אחרי דקה–שתיים הדף באוויר:
   - עמוד הבית: `https://annabellememmi.github.io/Annabelle-workshops-retreats-1-on-1/`
   - האירוע: `https://annabellememmi.github.io/Annabelle-workshops-retreats-1-on-1/events/reconnect-nov-2026/`
