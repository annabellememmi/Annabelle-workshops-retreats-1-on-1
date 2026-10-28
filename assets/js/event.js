/* Shared behaviour for an event landing page.
   Each event page defines window.EVENT (prices, links, dates)
   before loading this file. */
(function () {
  const EV = window.EVENT;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  /* ---------- "now" (add ?date=2026-11-06 to the URL to preview another day) ---------- */
  const override = new URLSearchParams(location.search).get("date");
  const now = override ? new Date(override + "T12:00:00+02:00") : new Date();

  /* ---------- pricing tier ---------- */
  const isEarly = now < new Date(EV.earlyBird.until);
  const tier = isEarly ? EV.earlyBird : EV.regular;
  const tierName = isEarly ? "מחיר מוקדמות" : "מחיר כרטיס";
  // prices are final, including VAT
  $$("[data-price]").forEach((el) => (el.textContent = tier.price));
  $$("[data-price-label]").forEach((el) => (el.textContent = tierName));
  $$("[data-price-old]").forEach((el) => {
    if (isEarly) el.remove();
    else el.textContent = `מחיר מוקדמות ${EV.earlyBird.price} ₪`;
  });

  /* ---------- reveal on scroll ---------- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    $$(".reveal").forEach((el) => io.observe(el));
  } else {
    $$(".reveal").forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- floating CTA appears after the hero ---------- */
  const sticky = $(".float-cta");
  const hero = $(".hero");
  const tickets = $("#tickets");
  if (sticky && hero && "IntersectionObserver" in window) {
    let heroVisible = true, ticketsVisible = false;
    const update = () => {
      const show = !heroVisible && !ticketsVisible;
      sticky.classList.toggle("is-visible", show);
    };
    new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; update(); }).observe(hero);
    if (tickets) new IntersectionObserver(([e]) => { ticketsVisible = e.isIntersecting; update(); }, { threshold: 0.3 }).observe(tickets);
  }

  /* ---------- videos: autoplay muted, tap to hear (only one plays sound at a time) ---------- */
  const soundVideos = $$("[data-unmute]").map((btn) => {
    const video = btn.parentElement.querySelector("video");
    const label = () => (btn.textContent = video.muted ? "🔈 עם סאונד" : "🔇 בלי סאונד");
    btn.addEventListener("click", () => {
      const turnOn = video.muted;
      soundVideos.forEach((o) => { if (o.video !== video) { o.video.muted = true; o.label(); } });
      video.muted = !turnOn;
      if (turnOn) { video.currentTime = 0; video.play(); }
      label();
      document.dispatchEvent(new CustomEvent("vibe-video-sound", { detail: turnOn }));
    });
    return { video, label };
  });

  /* ---------- registration dialog ---------- */
  const dlg = $("#register");
  if (!dlg) return;
  const form = $("#reg-form", dlg);
  const stepEls = $$(".reg__step", dlg);
  const stepBars = $$(".steps i", dlg);
  let regId = null, regName = "";

  function showStep(n) {
    stepEls.forEach((el, i) => (el.hidden = i !== n));
    stepBars.forEach((el, i) => el.classList.toggle("is-done", i <= n));
    dlg.scrollTop = 0;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Form encoding keeps this a "simple" request (no preflight); Apps Script answers "ok"
  // and allows cross-origin reads, so we can confirm the row was saved and retry if not.
  // Re-sending is safe: the script updates the same row by id.
  async function send(payload, tries = 3) {
    if (!EV.sheetEndpoint) return true;
    const body = new URLSearchParams({ event: EV.id, ...payload });
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(EV.sheetEndpoint, { method: "POST", body });
        if ((await res.text()).trim() === "ok") return true;
      } catch (e) { /* network hiccup: retry */ }
      if (i < tries - 1) await wait(1200 * (i + 1));
    }
    return false;
  }

  // a registration that couldn't be saved is kept on the device and re-sent on the next visit
  const PENDING = "pending-registration";
  try {
    const pending = JSON.parse(localStorage.getItem(PENDING) || "null");
    if (pending) send(pending).then((ok) => { if (ok) localStorage.removeItem(PENDING); });
  } catch (e) {}

  $$("[data-open-register]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    if (!regId) showStep(0);
    setTimeout(() => { const f = $("input", dlg); if (f && !regId) f.focus(); }, 50);
  }));
  $(".reg__close", dlg).addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });

  // validation
  const normalizePhone = (v) => {
    let d = v.replace(/\D/g, "");
    if (d.startsWith("972")) d = "0" + d.slice(3);
    return d;
  };
  const rules = {
    name: (v) => v.trim().length >= 2 || "נשמח לשם מלא 🙂",
    phone: (v) => /^05\d{8}$/.test(normalizePhone(v)) || "מספר נייד לא תקין (לדוגמה 050-1234567)",
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "כתובת אימייל לא תקינה",
    from: (v) => v.trim().length >= 2 || "מאיפה את מגיעה?",
    expectation: (v) => v.trim().length >= 2 || "ספרי לי במילה או שתיים 💛"
  };
  function validate(input) {
    const res = input.type === "checkbox"
      ? input.checked || "יש לאשר את התקנון ומדיניות הפרטיות"
      : rules[input.name] ? rules[input.name](input.value) : true;
    const field = input.closest(".field");
    field.classList.toggle("has-error", res !== true);
    $(".field__error", field).textContent = res === true ? "" : res;
    return res === true;
  }
  $$("input, textarea", form).forEach((i) => {
    i.addEventListener("blur", () => i.type !== "checkbox" && i.value && validate(i));
    i.addEventListener("change", () => i.type === "checkbox" && validate(i));
    i.addEventListener("input", () => i.closest(".field").classList.contains("has-error") && validate(i));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputs = $$("input, textarea", form);
    const ok = inputs.map(validate).every(Boolean);
    if (!ok) { inputs.find((i) => i.closest(".has-error")).focus(); return; }
    const data = Object.fromEntries(new FormData(form));
    delete data.terms;
    data.phone = normalizePhone(data.phone);
    regName = data.name.trim().split(" ")[0];
    regId = regId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const btn = $("button[type=submit]", form);
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = "שומרת את הפרטים…";
    const payload = { action: "register", id: regId, price: tier.price, ...data };
    const saved = await send(payload);
    btn.disabled = false;
    btn.textContent = label;
    try {
      if (saved) localStorage.removeItem(PENDING);
      else localStorage.setItem(PENDING, JSON.stringify(payload));
    } catch (err) {}
    const backup = $("[data-backup]", dlg);
    if (backup) {
      backup.hidden = saved;
      const msg = "היי אנאבל, נרשמתי לערב ״מתחברת חזרה לעצמך באהבה״ 🌿\n" +
        "שם: " + data.name + "\nטלפון: " + data.phone + "\nאימייל: " + data.email +
        "\nמאיפה: " + data.from + "\nציפייה: " + data.expectation;
      $("a", backup).href = "https://wa.me/" + EV.whatsappPhone + "?text=" + encodeURIComponent(msg);
    }
    $$("[data-reg-name]", dlg).forEach((el) => (el.textContent = regName));
    showStep(1);
  });

  // payment links
  const payLinks = { bit: tier.bit, paybox: tier.paybox };
  $$("[data-pay]", dlg).forEach((a) => {
    const method = a.dataset.pay;
    if (payLinks[method]) a.href = payLinks[method];
    else a.hidden = true;
    a.addEventListener("click", () => {
      send({ action: "payment_click", id: regId, method });
      $(".pay-done", dlg).hidden = false;
    });
  });
  if (!payLinks.bit && !payLinks.paybox) {
    $(".pay-options", dlg).insertAdjacentHTML("afterend",
      `<p class="pay-tip">התשלום בקרוב יעלה לכאן. בינתיים <a href="https://wa.me/${EV.whatsappPhone}">כתבי לי בוואטסאפ</a> ואשמור לך מקום 💛</p>`);
  }
  $("[data-paid]", dlg).addEventListener("click", () => {
    send({ action: "paid_reported", id: regId });
    showStep(2);
  });
  $("[data-back]", dlg).addEventListener("click", () => showStep(0));
})();
