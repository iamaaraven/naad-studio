/* Naad — lyric video canvas preview + WebM / PNG export */
(function (global) {
  let canvas, ctx;
  let raf = null;
  let running = false;
  let arr = null;
  let startTs = 0;
  let recorder = null;
  let chunks = [];

  const MOOD_COLORS = {
    Joyful: ["#f59e0b", "#ec4899", "#a855f7"],
    Romantic: ["#ec4899", "#f472b6", "#7c3aed"],
    Melancholy: ["#6366f1", "#334155", "#0ea5e9"],
    Energetic: ["#ef4444", "#f59e0b", "#ec4899"],
    Chill: ["#14b8a6", "#6366f1", "#312e81"],
    Epic: ["#7c3aed", "#db2777", "#0f172a"]
  };

  function init(c) {
    canvas = c;
    ctx = canvas.getContext("2d");
    // Internal resolution for crisp export
    canvas.width = 540;
    canvas.height = 960;
  }

  function setArrangement(a) {
    arr = a;
  }

  function linesFromLyrics(text) {
    const raw = (text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (raw.length) return raw;
    return [
      arr ? arr.title : "Naad",
      "(add lyrics in Create)",
      "♪ demo lyric video ♪"
    ];
  }

  function drawFrame(progress) {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const mood = (arr && arr.mood) || "Joyful";
    const colors = MOOD_COLORS[mood] || MOOD_COLORS.Joyful;
    const t = progress;

    // Animated gradient background
    const g = ctx.createLinearGradient(0, 0, w, h);
    const shift = (Math.sin(t * 0.8) + 1) / 2;
    g.addColorStop(0, colors[0]);
    g.addColorStop(0.45 + shift * 0.1, colors[1]);
    g.addColorStop(1, colors[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Soft orbs
    for (let i = 0; i < 5; i++) {
      const x = w * (0.2 + 0.15 * i) + Math.sin(t + i) * 30;
      const y = h * (0.25 + 0.1 * (i % 3)) + Math.cos(t * 0.7 + i) * 40;
      const rg = ctx.createRadialGradient(x, y, 10, x, y, 120);
      rg.addColorStop(0, "rgba(255,255,255,0.22)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, 120, 0, Math.PI * 2);
      ctx.fill();
    }

    // Title card (first ~3s equivalent of progress cycle)
    const title = (arr && arr.title) || "Naad";
    const genre = (arr && arr.genre) || "";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(40, 80, w - 80, 120);
    ctx.fillStyle = "#fff";
    ctx.font = "700 42px DM Sans, system-ui, sans-serif";
    ctx.fillText(title.slice(0, 28), w / 2, 130);
    ctx.font = "500 20px DM Sans, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText((genre + (arr ? " · " + arr.bpm + " BPM" : "")).trim(), w / 2, 170);

    // Lyrics — scroll / highlight by BPM-ish progress
    const lines = linesFromLyrics(arr && arr.lyrics);
    const bpm = (arr && arr.bpm) || 100;
    const lineDur = (60 / bpm) * 4; // ~1 bar per line
    const total = lines.length * lineDur;
    const local = (t % Math.max(total, 1));
    const idx = Math.floor(local / lineDur) % lines.length;

    ctx.font = "600 28px DM Sans, system-ui, sans-serif";
    const baseY = h * 0.52;
    for (let i = -2; i <= 2; i++) {
      const li = (idx + i + lines.length * 10) % lines.length;
      const y = baseY + i * 56;
      const active = i === 0;
      ctx.globalAlpha = active ? 1 : 0.35;
      ctx.fillStyle = active ? "#fff" : "rgba(255,255,255,0.85)";
      ctx.font = active
        ? "700 32px DM Sans, system-ui, sans-serif"
        : "500 24px DM Sans, system-ui, sans-serif";
      wrapText(lines[li], w / 2, y, w - 80, 34);
    }
    ctx.globalAlpha = 1;

    // Footer watermark
    ctx.font = "500 14px DM Sans, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillText("Naad Studio · demo", w / 2, h - 36);
  }

  function wrapText(text, x, y, maxW, lineH) {
    const words = String(text).split(/\s+/);
    let line = "";
    const lines = [];
    words.forEach((word) => {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);
    const startY = y - ((lines.length - 1) * lineH) / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, startY + i * lineH));
  }

  function loop(ts) {
    if (!running) return;
    if (!startTs) startTs = ts;
    const progress = (ts - startTs) / 1000;
    drawFrame(progress);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (!canvas) return;
    running = true;
    startTs = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function downloadPNG() {
    if (!canvas) return;
    drawFrame(0.5);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = ((arr && arr.title) || "naad") + "-cover.png";
    a.click();
  }

  function canRecord() {
    return typeof MediaRecorder !== "undefined" && canvas && canvas.captureStream;
  }

  function startRecording(sec) {
    return new Promise((resolve, reject) => {
      if (!canRecord()) {
        reject(new Error("MediaRecorder/canvas.captureStream not available"));
        return;
      }
      chunks = [];
      const stream = canvas.captureStream(30);
      let mime = "video/webm;codecs=vp9";
      if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm";
      try {
        recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
      } catch (e) {
        recorder = new MediaRecorder(stream);
      }
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = ((arr && arr.title) || "naad") + "-lyric.webm";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        resolve(blob);
      };
      const wasRunning = running;
      if (!wasRunning) start();
      recorder.start(100);
      setTimeout(() => {
        try {
          recorder.stop();
        } catch (_) {}
        if (!wasRunning) stop();
      }, (sec || 8) * 1000);
    });
  }

  global.NaadVideo = {
    init: init,
    setArrangement: setArrangement,
    start: start,
    stop: stop,
    drawFrame: drawFrame,
    downloadPNG: downloadPNG,
    canRecord: canRecord,
    startRecording: startRecording
  };
})(typeof window !== "undefined" ? window : globalThis);
