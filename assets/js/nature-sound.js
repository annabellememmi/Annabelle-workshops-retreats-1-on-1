/* Gentle nature ambience generated live in the browser:
   a soft breeze plus occasional bird song. Nothing to download,
   and it only starts when the visitor presses the sound button.
   To use a real recording instead, set data-src on the button
   (e.g. data-src="../../assets/audio/nature.mp3"). */
(function () {
  const btn = document.querySelector("[data-sound-toggle]");
  if (!btn) return;

  let ctx, master, birdTimer, audioEl;
  let playing = false;

  function noiseBuffer(seconds) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        // brown-ish noise: soft and warm
        last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        d[i] = last * 3.2;
      }
    }
    return buf;
  }

  function startBreeze() {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(6);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 320;
    lfo.connect(lfoGain).connect(lp.frequency);
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(lp).connect(g).connect(master);
    src.start();
    lfo.start();
  }

  function chirp(t, f0, f1, dur, vol, pan) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan;
    o.connect(g).connect(p).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // a few "species" so it doesn't sound repetitive
  const songs = [
    (t, pan) => { // quick twitter
      const n = 3 + Math.floor(Math.random() * 5), base = 3200 + Math.random() * 1500;
      for (let i = 0; i < n; i++) chirp(t + i * 0.09, base, base * 1.35, 0.07, 0.05, pan);
    },
    (t, pan) => { // falling whistle
      const base = 2600 + Math.random() * 900;
      chirp(t, base * 1.5, base, 0.35, 0.045, pan);
      chirp(t + 0.45, base * 1.4, base * 0.95, 0.3, 0.035, pan);
    },
    (t, pan) => { // up-down song
      const base = 2200 + Math.random() * 800;
      [1, 1.25, 1.5, 1.2, 1.6].forEach((m, i) => chirp(t + i * 0.13, base * m, base * m * 1.08, 0.11, 0.04, pan));
    },
    (t, pan) => { // soft dove coo
      [0, 0.55, 0.9].forEach((d, i) => chirp(t + d, 520, i === 1 ? 470 : 430, 0.42, 0.06, pan));
    }
  ];

  function scheduleBirds() {
    const wait = 900 + Math.random() * 3200;
    birdTimer = setTimeout(() => {
      if (!playing) return;
      const song = songs[Math.floor(Math.random() * songs.length)];
      song(ctx.currentTime + 0.05, Math.random() * 1.6 - 0.8);
      scheduleBirds();
    }, wait);
  }

  function setUi(on) {
    btn.setAttribute("aria-pressed", String(on));
    const label = btn.querySelector("[data-sound-label]");
    if (label) label.textContent = on ? "צלילי טבע פועלים" : "צלילי טבע";
  }

  async function start() {
    if (btn.dataset.src) {
      audioEl = audioEl || Object.assign(new Audio(btn.dataset.src), { loop: true, volume: 0.6 });
      await audioEl.play();
    } else {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);
        startBreeze();
      }
      await ctx.resume();
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.7, ctx.currentTime, 0.8);
      scheduleBirds();
    }
    playing = true;
    setUi(true);
  }

  function stop() {
    playing = false;
    clearTimeout(birdTimer);
    if (audioEl) audioEl.pause();
    if (ctx) master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    setUi(false);
  }

  btn.addEventListener("click", () => (playing ? stop() : start().catch(() => setUi(false))));
  // pause the ambience while the vibe video plays with sound
  document.addEventListener("vibe-video-sound", (e) => { if (e.detail && playing) stop(); });
})();
