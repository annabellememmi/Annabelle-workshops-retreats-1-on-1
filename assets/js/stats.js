/* Anonymous visit stats, sent to the same Google Sheet as registrations.
   Records: how long the visit lasted, how long each section was on screen,
   how far down she scrolled, the device type, the source (?src=...),
   and whether she opened the registration form. No names, no IP, no cookies.
   Open the page once with ?me=1 on your own devices to stop counting yourself
   (?me=0 turns counting back on). */
(function () {
  const EV = window.EVENT;
  if (!EV || !EV.sheetEndpoint) return;
  const qs = new URLSearchParams(location.search);
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  if (qs.get("me") === "1") store("stats-me", "1");
  if (qs.get("me") === "0") store("stats-me", "0");
  if (store("stats-me") === "1") return;

  const rnd = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  let visitor = store("stats-visitor"), returning = "1";
  if (!visitor) { visitor = rnd(); store("stats-visitor", visitor); returning = "0"; }
  const visit = rnd();
  const started = Date.now();
  const ref = document.referrer && !document.referrer.includes(location.host) ? new URL(document.referrer).hostname : "";
  const source = qs.get("src") || qs.get("utm_source") || ref || "ישיר / וואטסאפ";
  const device = matchMedia("(max-width: 899px)").matches ? "נייד" : "מחשב";

  // seconds each section was at least 40% on screen
  const ids = ["top", "story", "taste", "voices", "venue", "about", "agenda", "faq", "tickets", "contact"];
  const secs = {}, since = {};
  const tick = (id) => { if (since[id]) { secs[id] = (secs[id] || 0) + (Date.now() - since[id]) / 1000; since[id] = Date.now(); } };
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      const id = e.target.id;
      if (e.isIntersecting) since[id] = since[id] || Date.now();
      else { tick(id); delete since[id]; }
    }), { threshold: 0.4 });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }
  let maxScroll = 0;
  addEventListener("scroll", () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0) maxScroll = Math.max(maxScroll, Math.round(100 * scrollY / h));
  }, { passive: true });
  let opened = "0";
  document.addEventListener("click", (e) => { if (e.target.closest("[data-open-register]")) opened = "1"; });

  let active = Date.now(), activeSecs = 0;
  const send = () => {
    activeSecs += (Date.now() - active) / 1000; active = Date.now();
    Object.keys(since).forEach(tick);
    const body = new URLSearchParams({ action: "visit", event: EV.id, visit, visitor, returning, source, device,
      seconds: Math.round(activeSecs), scroll: maxScroll, opened });
    ids.forEach((id) => body.set("s_" + id, Math.round(secs[id] || 0)));
    // same way the registration form sends (works on iPhone/iPad); sendBeacon as a fallback
    try {
      fetch(EV.sheetEndpoint, { method: "POST", mode: "no-cors", keepalive: true, body })
        .catch(() => { if (navigator.sendBeacon) navigator.sendBeacon(EV.sheetEndpoint, body); });
    } catch (e) { if (navigator.sendBeacon) navigator.sendBeacon(EV.sheetEndpoint, body); }
  };
  // report early too, so a visit is saved even if the phone closes the page abruptly
  setTimeout(send, 8000);
  setTimeout(send, 40000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") send();
    else { active = Date.now(); Object.keys(since).forEach((id) => (since[id] = Date.now())); }
  });
  addEventListener("pagehide", () => { if (document.visibilityState !== "hidden") send(); });
  void started;
})();
