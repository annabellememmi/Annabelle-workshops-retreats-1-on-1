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

  $$("[data-price]").forEach((el) => (el.textContent = tier.price));
  $$("[data-price-label]").forEach((el) => (el.textContent = tierName));
  $$("[data-price-old]").forEach((el) => {
    if (isEarly) el.remove();
    else el.textContent = `מחיר מוקדמות ${EV.earlyBird.price} ₪`;
  });

  /* ---------- hero spiral ---------- */
  const spiral = $("[data-spiral]");
  if (spiral) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 400 400");
    svg.setAttribute("aria-hidden", "true");
    const path = (turns, rMax, phase, wobble) => {
      let d = "";
      const steps = 900;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = t * turns * Math.PI * 2 + phase;
        const r = 3 + Math.pow(t, 0.92) * rMax * (1 + wobble * Math.sin(a * 3.1) * 0.03);
        d += (i ? "L" : "M") + (200 + r * Math.cos(a)).toFixed(2) + " " + (200 + r * Math.sin(a)).toFixed(2);
      }
      return d;
    };
    [["main", 5.2, 188, 0, 1], ["echo", 5.2, 176, Math.PI * 0.85, 1.6]].forEach(([kind, turns, r, ph, w]) => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", path(turns, r, ph, w));
      p.setAttribute("class", "spiral-line spiral-line--" + kind);
      svg.appendChild(p);
    });
    // little seeds scattered along the outer arms
    for (let i = 0; i < 26; i++) {
      const t = 0.35 + Math.random() * 0.65;
      const a = t * 5.2 * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const r = 3 + t * 188 + (Math.random() * 16 - 8);
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", (200 + r * Math.cos(a)).toFixed(1));
      c.setAttribute("cy", (200 + r * Math.sin(a)).toFixed(1));
      c.setAttribute("r", (0.8 + Math.random() * 1.8).toFixed(1));
      c.setAttribute("class", "spiral-seed");
      c.style.animationDelay = (1.5 + t * 3).toFixed(2) + "s";
      svg.appendChild(c);
    }
    spiral.appendChild(svg);
    $$(".spiral-line", svg).forEach((p) => p.style.setProperty("--len", Math.ceil(p.getTotalLength())));
  }

  /* ---------- reveal on scroll ---------- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }), { threshold: 0.12 });
    $$(".reveal").forEach((el) => io.observe(el));
  } else {
    $$(".reveal").forEach((el) => el.classList.add("is-in"));
  }

  /* ---------- sticky CTA appears after the hero ---------- */
  const sticky = $(".sticky-cta");
  const hero = $(".hero");
  const tickets = $("#tickets");
  if (sticky && hero && "IntersectionObserver" in window) {
    let heroVisible = true, ticketsVisible = false;
    const update = () => sticky.classList.toggle("is-visible", !heroVisible && !ticketsVisible);
    new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; update(); }).observe(hero);
    if (tickets) new IntersectionObserver(([e]) => { ticketsVisible = e.isIntersecting; update(); }, { threshold: 0.3 }).observe(tickets);
  }

  /* ---------- vibe video: autoplay muted, tap to hear ---------- */
  const video = $("[data-vibe-video]");
  const unmute = $("[data-unmute]");
  if (video && unmute) {
    unmute.addEventListener("click", () => {
      video.muted = !video.muted;
      if (!video.muted) { video.currentTime = 0; video.play(); }
      unmute.textContent = video.muted ? "🔈 עם סאונד" : "🔇 בלי סאונד";
      document.dispatchEvent(new CustomEvent("vibe-video-sound", { detail: !video.muted }));
    });
  }

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

  function send(payload) {
    if (!EV.sheetEndpoint) return Promise.resolve();
    const body = new URLSearchParams({ event: EV.id, ...payload });
    // no-cors + form encoding = no preflight; Apps Script receives e.parameter
    return fetch(EV.sheetEndpoint, { method: "POST", mode: "no-cors", body }).catch(() => {});
  }

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
    from: (v) => v.trim().length >= 2 || "מאיפה את מגיעה?",
    expectation: (v) => v.trim().length >= 2 || "ספרי לי במילה או שתיים 💛"
  };
  function validate(input) {
    const res = rules[input.name] ? rules[input.name](input.value) : true;
    const field = input.closest(".field");
    field.classList.toggle("has-error", res !== true);
    $(".field__error", field).textContent = res === true ? "" : res;
    return res === true;
  }
  $$("input, textarea", form).forEach((i) => {
    i.addEventListener("blur", () => i.value && validate(i));
    i.addEventListener("input", () => i.closest(".field").classList.contains("has-error") && validate(i));
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputs = $$("input, textarea", form);
    const ok = inputs.map(validate).every(Boolean);
    if (!ok) { inputs.find((i) => i.closest(".has-error")).focus(); return; }
    const data = Object.fromEntries(new FormData(form));
    data.phone = normalizePhone(data.phone);
    regName = data.name.trim().split(" ")[0];
    regId = regId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const btn = $("button[type=submit]", form);
    btn.disabled = true;
    await send({ action: "register", id: regId, price: tier.price, ...data });
    btn.disabled = false;
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
