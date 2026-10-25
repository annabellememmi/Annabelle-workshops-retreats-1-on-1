/* Hand-drawn tree-ring spiral ([data-spiral]) and rotating text ring ([data-ring]).
   Shared by every page. */
(function () {
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  /* ---------- hand-drawn tree-ring spiral (logo + badge) ---------- */
  const NS = "http://www.w3.org/2000/svg";
  function seeded(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
  function treeRing(el) {
    const rnd = seeded(el.dataset.spiral === "badge" ? 7 : 3);
    const ph = Array.from({ length: 4 }, () => rnd() * Math.PI * 2);
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("aria-hidden", "true");
    const line = (turns, rMax, jitter, width, opacity) => {
      let d = "";
      const steps = 700;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const a = t * turns * Math.PI * 2;
        // organic wobble so it reads like a hand-drawn tree ring
        const wob = 1 + 0.07 * Math.sin(a * 2 + ph[0]) + 0.05 * Math.sin(a * 3 + ph[1]) + 0.03 * Math.sin(a * 5 + ph[2]);
        const r = (2.2 + t * rMax) * wob + jitter * Math.sin(a * 7 + ph[3]);
        const cx = 50 + 2.2 * Math.sin(t * 3 + ph[0]), cy = 50 + 2.2 * Math.cos(t * 2.4 + ph[1]);
        d += (i ? "L" : "M") + (cx + r * Math.cos(a)).toFixed(2) + " " + (cy + r * Math.sin(a)).toFixed(2);
      }
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      p.setAttribute("class", "ring-line");
      p.setAttribute("stroke-width", width);
      p.setAttribute("opacity", opacity);
      svg.appendChild(p);
    };
    line(4.6, 41, 0.35, 2.1, 1);
    line(4.6, 39.5, 0.8, 1, 0.55);
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", "50.5"); dot.setAttribute("cy", "49.5"); dot.setAttribute("r", "2.4");
    dot.setAttribute("fill", "currentColor");
    svg.appendChild(dot);
    el.appendChild(svg);
    $$(".ring-line", svg).forEach((p) => p.style.setProperty("--len", Math.ceil(p.getTotalLength())));
  }
  $$("[data-spiral]").forEach(treeRing);

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
