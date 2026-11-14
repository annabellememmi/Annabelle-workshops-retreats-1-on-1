/* "Not sure yet? Remind me": the inline form and the exit pop-up.
   Saves name + phone to the "ביקשו תזכורת" tab of the Google Sheet (action "remind"). */
(function () {
  const EV = window.EVENT;
  if (!EV) return;
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const store = (k, v) => {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  };
  const DONE = "remind-" + EV.id, SHOWN = "exit-shown-" + EV.id, REG = "registered-" + EV.id, PENDING = "pending-remind";

  // only a script that knows "remind" answers "ok:remind"; anything else is kept on the device and re-sent later
  async function send(payload, tries = 3) {
    if (!EV.sheetEndpoint) return false;
    const body = new URLSearchParams({ event: EV.id, action: "remind", ...payload });
    for (let i = 0; i < tries; i++) {
      try {
        const res = await fetch(EV.sheetEndpoint, { method: "POST", body });
        if ((await res.text()).trim() === "ok:remind") return true;
      } catch (e) { /* retry */ }
      await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
    }
    return false;
  }
  try {
    const pending = JSON.parse(store(PENDING) || "null");
    if (pending) send(pending, 1).then((ok) => ok && store(PENDING, null));
  } catch (e) {}

  const normalizePhone = (v) => {
    let d = v.replace(/\D/g, "");
    if (d.startsWith("972")) d = "0" + d.slice(3);
    return d;
  };
  const rules = {
    name: (v) => v.trim().length >= 2 || "איך קוראים לך? 🙂",
    phone: (v) => /^05\d{8}$/.test(normalizePhone(v)) || "מספר נייד לא תקין (לדוגמה 050-1234567)"
  };
  function validate(input) {
    const res = rules[input.name] ? rules[input.name](input.value) : true;
    const field = input.closest(".field");
    field.classList.toggle("has-error", res !== true);
    $(".field__error", field).textContent = res === true ? "" : res;
    return res === true;
  }
  const showDone = () => $$(".remind").forEach((box) => {
    const f = $(".remind__form", box), d = $(".remind__done", box);
    if (f && d) { f.hidden = true; d.hidden = false; }
  });
  if (store(DONE)) showDone();

  $$("[data-remind-form]").forEach((form) => {
    $$("input", form).forEach((i) => i.addEventListener("input", () => i.closest(".has-error") && validate(i)));
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputs = $$("input", form);
      if (!inputs.map(validate).every(Boolean)) { inputs.find((i) => i.closest(".has-error")).focus(); return; }
      const data = Object.fromEntries(new FormData(form));
      const payload = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: data.name.trim(), phone: normalizePhone(data.phone), source: form.dataset.remindForm
      };
      const btn = $("button[type=submit]", form);
      btn.disabled = true;
      const saved = await send(payload);
      btn.disabled = false;
      store(DONE, "1");
      if (!saved) store(PENDING, JSON.stringify(payload));
      showDone();
    });
  });

  /* ---------- exit pop-up: once per visitor, never for someone who registered or already asked ---------- */
  const dlg = $("#exit-remind");
  if (!dlg) return;
  const reg = $("#register");
  const start = Date.now();
  const qs = new URLSearchParams(location.search);
  const blocked = () => store(DONE) || store(SHOWN) || store(REG) || qs.has("register") || qs.has("with") ||
    (reg && reg.hasAttribute("open")) || document.querySelector("dialog[open]") || Date.now() - start < 12000;
  function show() {
    if (blocked()) return;
    store(SHOWN, "1");
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }
  $(".reg__close", dlg).addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  $$("[data-open-register]", dlg).forEach((a) => a.addEventListener("click", () => dlg.close()));

  // computer: the mouse leaves through the top of the window (toward the tabs / close button)
  document.addEventListener("mouseout", (e) => { if (!e.relatedTarget && e.clientY <= 0) show(); });
  // phone: after reading for a while, a quick scroll back up (the usual "on my way out" gesture)
  let lastY = scrollY, lastT = Date.now(), maxScroll = 0;
  addEventListener("scroll", () => {
    const y = scrollY, t = Date.now();
    maxScroll = Math.max(maxScroll, y / Math.max(1, document.documentElement.scrollHeight - innerHeight));
    if (maxScroll > 0.3 && Date.now() - start > 25000 && lastY - y > 250 && t - lastT < 350) show();
    if (t - lastT > 350) { lastY = y; lastT = t; }
  }, { passive: true });
})();
