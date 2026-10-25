/* Rotating text ring ([data-ring]) and rotating text ring ([data-ring]).
   Shared by every page. */
(function () {
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  /* ---------- rotating text ring (Hebrew reads counter-clockwise across the top) ---------- */
  $$("[data-ring]").forEach((el) => {
    const chars = [...el.dataset.ring];
    const step = 360 / chars.length;
    chars.forEach((ch, i) => {
      const span = document.createElement("span");
      span.textContent = ch;
      span.style.transform = `rotate(${-i * step}deg)`;
      el.appendChild(span);
    });
  });
})();
