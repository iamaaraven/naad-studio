/* Naad Studio — multi-step SPA UI */
(function () {
  const STEPS = ["create", "instruments", "tune", "video", "publish"];
  let step = "create";
  let arrangement = null;
  let voiceObjectUrl = null;

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2600);
  }

  function showStep(id) {
    step = id;
    $$(".panel").forEach((p) => p.classList.toggle("hidden", p.id !== "view-" + id));
    $$(".nav button").forEach((b) => b.classList.toggle("on", b.dataset.step === id));
    $$(".step-pill").forEach((b) => {
      const i = STEPS.indexOf(b.dataset.step);
      const cur = STEPS.indexOf(id);
      b.classList.toggle("on", b.dataset.step === id);
      b.classList.toggle("done", i < cur && !!arrangement);
    });
    if (id === "video" && arrangement) {
      NaadVideo.setArrangement(arrangement);
      NaadVideo.start();
    } else {
      NaadVideo.stop();
    }
    if (id === "publish") renderPack();
  }

  function readCreateForm() {
    return {
      title: $("#title").value.trim() || "Untitled Naad",
      genre: $(".chip.on[data-genre]")?.dataset.genre || "Pop",
      mood: $(".chip.on[data-mood]")?.dataset.mood || "Joyful",
      bpm: Number($("#bpm").value) || 100,
      lyrics: $("#lyrics").value
    };
  }

  function generate() {
    const opts = readCreateForm();
    arrangement = NaadArrange.generate(opts);
    NaadAudio.setArrangement(arrangement);
    renderStructure();
    syncLayerToggles();
    $("#structureBox").classList.remove("hidden");
    $("#btnToInstruments").disabled = false;
    toast("Arrangement ready — " + arrangement.key + " " + arrangement.mode + " · " + arrangement.bpm + " BPM");
  }

  function renderStructure() {
    const box = $("#structure");
    box.innerHTML = "";
    arrangement.structure.forEach((sec) => {
      const d = document.createElement("div");
      d.className = "sec";
      d.innerHTML =
        '<div class="name">' +
        sec.name +
        '</div><div class="meta">' +
        sec.bars +
        " bars · " +
        arrangement.key +
        " " +
        arrangement.mode +
        '</div><div class="chords">' +
        sec.chordStr +
        "</div>";
      box.appendChild(d);
    });
    $("#arrMeta").textContent =
      arrangement.title +
      " · " +
      arrangement.genre +
      " · " +
      arrangement.mood +
      " · scale " +
      arrangement.scale.join(" ");
  }

  function syncLayerToggles() {
    const layers = arrangement.layers;
    $$(".layer .toggle").forEach((btn) => {
      const id = btn.dataset.layer;
      const on = !!layers[id];
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      NaadAudio.setLayer(id, on);
    });
  }

  function togglePlay() {
    if (!arrangement) {
      toast("Generate an arrangement first");
      return;
    }
    NaadAudio.ensureCtx();
    if (NaadAudio.isPlaying()) {
      NaadAudio.stop();
      $("#btnPlay").textContent = "▶ Play loop";
    } else {
      NaadAudio.setArrangement(arrangement);
      // refresh layers from UI
      $$(".layer .toggle").forEach((btn) => {
        NaadAudio.setLayer(btn.dataset.layer, btn.classList.contains("on"));
      });
      NaadAudio.play();
      $("#btnPlay").textContent = "■ Stop";
    }
  }

  NaadAudio.onBeat(function (step, ev, len) {
    const pct = ((step % len) / len) * 100;
    $("#meterFill").style.width = pct + "%";
  });

  function onVoiceFile(file) {
    if (!file) return;
    if (voiceObjectUrl) URL.revokeObjectURL(voiceObjectUrl);
    voiceObjectUrl = URL.createObjectURL(file);
    const audio = $("#voiceAudio");
    audio.src = voiceObjectUrl;
    audio.classList.remove("hidden");
    try {
      NaadAudio.attachVoiceElement(audio, arrangement ? arrangement.scaleIntervals : undefined);
      toast("Voice loaded — adjust Tune mix & play");
    } catch (e) {
      toast("Voice attached (play with browser controls)");
    }
  }

  async function useMic() {
    try {
      NaadAudio.ensureCtx();
      await NaadAudio.startMic();
      toast("Mic live — demo EQ tune path (wet/dry)");
      $("#micStatus").textContent = "Mic on";
    } catch (e) {
      toast("Mic permission denied or unavailable");
      $("#micStatus").textContent = "Mic off";
    }
  }

  function applyTuneUI() {
    const song = Number($("#songTune").value);
    const mix = Number($("#tuneMix").value);
    $("#songTuneVal").textContent = (song > 0 ? "+" : "") + song.toFixed(2);
    $("#tuneMixVal").textContent = Math.round(mix * 100) + "%";
    NaadAudio.setSongTune(song);
    NaadAudio.setTuneMix(mix);
    if (arrangement) NaadAudio.applyVoiceTune(arrangement.scaleIntervals);
  }

  function renderPack() {
    if (!arrangement) {
      $("#packPreview").textContent = "Generate a song in Create first.";
      return;
    }
    const a = arrangement;
    const hashtags = buildHashtags(a);
    const desc = buildDescription(a);
    const pack = {
      title: a.title,
      genre: a.genre,
      mood: a.mood,
      bpm: a.bpm,
      key: a.key,
      mode: a.mode,
      scale: a.scale,
      lyrics: a.lyrics,
      structure: a.structure.map((s) => ({ name: s.name, chords: s.chordStr })),
      suggestedHashtags: hashtags,
      youtubeDescription: desc.youtube,
      instagramCaption: desc.ig,
      spotifyNotes: "Upload via DistroKid / TuneCore / your distributor — Naad does not upload.",
      disclaimer:
        "Naad prepares assets only. You need your own platform accounts. Not affiliated with Spotify, YouTube, Apple, DistroKid, or TuneCore.",
      generatedAt: a.generatedAt,
      engine: a.engine
    };
    $("#packPreview").textContent = JSON.stringify(pack, null, 2);
    window._naadPack = pack;
  }

  function buildHashtags(a) {
    const base = ["#NaadStudio", "#NewMusic", "#IndieArtist", "#" + a.genre.replace(/\s/g, "")];
    if (a.genre === "Bollywood") base.push("#BollywoodMusic", "#DesiBeats");
    if (a.mood) base.push("#" + a.mood);
    base.push("#LyricVideo", "#MusicDemo");
    return base;
  }

  function buildDescription(a) {
    const yt =
      a.title +
      " — original demo arranged in Naad Studio.\n\nGenre: " +
      a.genre +
      " | Mood: " +
      a.mood +
      " | " +
      a.bpm +
      " BPM | Key: " +
      a.key +
      " " +
      a.mode +
      "\n\nLyrics:\n" +
      (a.lyrics || "(instrumental)") +
      "\n\n---\nCreated with Naad (browser demo). Not affiliated with YouTube.";
    const ig =
      a.title +
      " ✨ " +
      a.mood +
      " " +
      a.genre +
      " vibes\n" +
      buildHashtags(a).slice(0, 8).join(" ");
    return { youtube: yt, ig };
  }

  function downloadPack(kind) {
    if (!window._naadPack) renderPack();
    const pack = window._naadPack;
    if (!pack || !arrangement) {
      toast("Generate first");
      return;
    }
    let blob, name;
    if (kind === "json") {
      blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
      name = pack.title.replace(/\W+/g, "_") + "-release-pack.json";
    } else {
      const txt = [
        "NAAD RELEASE PACK",
        "=================",
        "Title: " + pack.title,
        "Genre: " + pack.genre,
        "Mood: " + pack.mood,
        "BPM: " + pack.bpm,
        "Key: " + pack.key + " " + pack.mode,
        "",
        "LYRICS",
        "------",
        pack.lyrics || "(none)",
        "",
        "STRUCTURE",
        pack.structure.map((s) => s.name + ": " + s.chords).join("\n"),
        "",
        "YOUTUBE DESCRIPTION",
        pack.youtubeDescription,
        "",
        "INSTAGRAM",
        pack.instagramCaption,
        "",
        "HASHTAGS",
        pack.suggestedHashtags.join(" "),
        "",
        pack.disclaimer
      ].join("\n");
      blob = new Blob([txt], { type: "text/plain" });
      name = pack.title.replace(/\W+/g, "_") + "-release-pack.txt";
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    toast("Downloaded " + name);
  }

  async function exportVideo() {
    if (!arrangement) {
      toast("Generate first");
      return;
    }
    NaadVideo.setArrangement(arrangement);
    if (NaadVideo.canRecord()) {
      toast("Recording ~8s WebM…");
      try {
        await NaadVideo.startRecording(8);
        toast("WebM download started");
      } catch (e) {
        fallbackVideoExport();
      }
    } else {
      fallbackVideoExport();
    }
  }

  function fallbackVideoExport() {
    NaadVideo.downloadPNG();
    // Also lyrics text
    const a = document.createElement("a");
    const lyrics = (arrangement.lyrics || "") + "\n\n— " + arrangement.title;
    a.href = URL.createObjectURL(new Blob([lyrics], { type: "text/plain" }));
    a.download = arrangement.title.replace(/\W+/g, "_") + "-lyrics.txt";
    a.click();
    toast("Cover PNG + lyrics saved. Tip: record screen or CapCut for full video.");
    $("#videoTip").classList.remove("hidden");
  }

  function bind() {
    $$(".nav button, .step-pill").forEach((b) =>
      b.addEventListener("click", () => showStep(b.dataset.step))
    );

    $$(".chip[data-genre]").forEach((c) =>
      c.addEventListener("click", () => {
        $$(".chip[data-genre]").forEach((x) => x.classList.remove("on"));
        c.classList.add("on");
      })
    );
    $$(".chip[data-mood]").forEach((c) =>
      c.addEventListener("click", () => {
        $$(".chip[data-mood]").forEach((x) => x.classList.remove("on"));
        c.classList.add("on");
      })
    );

    $("#bpm").addEventListener("input", () => {
      $("#bpmVal").textContent = $("#bpm").value;
    });

    $("#btnGenerate").addEventListener("click", generate);
    $("#btnToInstruments").addEventListener("click", () => showStep("instruments"));
    $("#btnPlay").addEventListener("click", togglePlay);

    $$(".layer .toggle").forEach((btn) =>
      btn.addEventListener("click", () => {
        btn.classList.toggle("on");
        const on = btn.classList.contains("on");
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        NaadAudio.setLayer(btn.dataset.layer, on);
      })
    );

    $("#voiceFile").addEventListener("change", (e) => onVoiceFile(e.target.files[0]));
    $("#btnMic").addEventListener("click", useMic);
    $("#btnVoicePlay").addEventListener("click", () => {
      applyTuneUI();
      NaadAudio.playVoice();
    });
    $("#btnVoiceStop").addEventListener("click", () => NaadAudio.stopVoice());
    $("#songTune").addEventListener("input", applyTuneUI);
    $("#tuneMix").addEventListener("input", applyTuneUI);

    $("#btnPreviewVideo").addEventListener("click", () => {
      if (!arrangement) return toast("Generate first");
      NaadVideo.setArrangement(arrangement);
      NaadVideo.start();
      toast("Lyric preview playing");
    });
    $("#btnExportVideo").addEventListener("click", exportVideo);
    $("#btnCoverPng").addEventListener("click", () => {
      if (!arrangement) return toast("Generate first");
      NaadVideo.setArrangement(arrangement);
      NaadVideo.downloadPNG();
    });

    $("#btnPackJson").addEventListener("click", () => downloadPack("json"));
    $("#btnPackTxt").addEventListener("click", () => downloadPack("txt"));

    NaadVideo.init($("#lyricCanvas"));
    showStep("create");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
})();
