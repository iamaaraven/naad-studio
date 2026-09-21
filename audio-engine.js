/* Naad — Web Audio synthesis + demo tune effect */
(function (global) {
  let ctx = null;
  let master = null;
  let tuneGain = null;
  let dryGain = null;
  let playing = false;
  let timer = null;
  let step = 0;
  let arrangement = null;
  let layerOn = {};
  let songTune = 0; // -12..12 semitone-ish via playback detune on oscillators
  let voiceEl = null;
  let voiceSource = null;
  let micStream = null;
  let micNode = null;
  let voiceGain = null;
  let voiceWet = null;
  let voiceDry = null;
  let tuneAmount = 0.7;
  let onBeat = null;

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      tuneGain = ctx.createGain();
      tuneGain.gain.value = 1;
      dryGain = ctx.createGain();
      dryGain.gain.value = 1;
      // Parallel path for slight "tuned" brightness vs dry — song tune uses detune
      tuneGain.connect(master);
      dryGain.connect(master);
      master.connect(ctx.destination);
      voiceGain = ctx.createGain();
      voiceGain.gain.value = 0.9;
      voiceDry = ctx.createGain();
      voiceWet = ctx.createGain();
      voiceDry.gain.value = 0.35;
      voiceWet.gain.value = 0.65;
      voiceGain.connect(voiceDry);
      voiceGain.connect(voiceWet);
      voiceDry.connect(master);
      voiceWet.connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function env(gainNode, t, a, d, s, r, peak) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + a);
    g.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    g.exponentialRampToValueAtTime(0.0001, t + a + d + r);
  }

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function detuned(freq) {
    // songTune: -1..1 maps to ~±100 cents, plus stepped "quantize" feel
    const cents = songTune * 100;
    return freq * Math.pow(2, cents / 1200);
  }

  function playTone(freq, dur, type, peak, dest) {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(detuned(freq), t);
    env(g, t, 0.01, 0.08, 0.4, Math.max(0.05, dur * 0.6), peak);
    o.connect(g);
    g.connect(dest || tuneGain);
    o.start(t);
    o.stop(t + dur + 0.3);
  }

  function playNoise(dur, peak, bpFreq, dest) {
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = bpFreq || 800;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    env(g, t, 0.001, 0.04, 0.2, dur * 0.5, peak);
    src.connect(bp);
    bp.connect(g);
    g.connect(dest || dryGain);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // Instrument voices
  const Instruments = {
    piano(midi, beats, beatSec) {
      const f = midiToFreq(midi);
      const dur = beats * beatSec * 0.9;
      playTone(f, dur, "triangle", 0.22);
      playTone(f * 2, dur * 0.7, "sine", 0.08);
    },
    guitar(midi, beats, beatSec) {
      const f = midiToFreq(midi);
      const dur = beats * beatSec * 0.7;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(detuned(f), t);
      env(g, t, 0.002, 0.12, 0.15, dur, 0.12);
      const f2 = ctx.createBiquadFilter();
      f2.type = "lowpass";
      f2.frequency.value = 2200;
      o.connect(f2);
      f2.connect(g);
      g.connect(tuneGain);
      o.start(t);
      o.stop(t + dur + 0.2);
    },
    bass(midi, beats, beatSec) {
      const f = midiToFreq(midi - 12);
      playTone(f, beats * beatSec * 0.85, "sine", 0.35);
      playTone(f, beats * beatSec * 0.5, "square", 0.06);
    },
    pad(midi, beats, beatSec) {
      const f = midiToFreq(midi);
      const dur = beats * beatSec;
      playTone(f, dur, "sine", 0.1);
      playTone(f * 1.5, dur, "sine", 0.05);
      playTone(f * 2.01, dur, "triangle", 0.04);
    },
    synth(midi, beats, beatSec) {
      const f = midiToFreq(midi + 12);
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const o2 = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o2.type = "sawtooth";
      o.frequency.setValueAtTime(detuned(f), t);
      o2.frequency.setValueAtTime(detuned(f * 1.005), t);
      env(g, t, 0.02, 0.1, 0.5, beats * beatSec * 0.6, 0.1);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1800 + songTune * 200;
      o.connect(lp);
      o2.connect(lp);
      lp.connect(g);
      g.connect(tuneGain);
      o.start(t);
      o2.start(t);
      o.stop(t + beats * beatSec + 0.2);
      o2.stop(t + beats * beatSec + 0.2);
    },
    sitar(midi, beats, beatSec) {
      const f = midiToFreq(midi);
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(detuned(f), t);
      // slight pitch bend
      o.frequency.linearRampToValueAtTime(detuned(f * 1.02), t + 0.05);
      o.frequency.linearRampToValueAtTime(detuned(f), t + 0.15);
      env(g, t, 0.005, 0.2, 0.25, beats * beatSec, 0.1);
      // drone sympathetic
      const d = ctx.createOscillator();
      const dg = ctx.createGain();
      d.type = "sine";
      d.frequency.value = detuned(f / 2);
      dg.gain.value = 0.04;
      d.connect(dg);
      dg.connect(tuneGain);
      o.connect(g);
      g.connect(tuneGain);
      o.start(t);
      d.start(t);
      o.stop(t + beats * beatSec + 0.3);
      d.stop(t + beats * beatSec + 0.3);
    },
    flute(midi, beats, beatSec) {
      const f = midiToFreq(midi + 12);
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(detuned(f), t);
      env(g, t, 0.06, 0.1, 0.6, beats * beatSec * 0.7, 0.12);
      // breath noise
      playNoise(0.08, 0.03, f, dryGain);
      o.connect(g);
      g.connect(tuneGain);
      o.start(t);
      o.stop(t + beats * beatSec + 0.2);
    },
    drums(midi, beats, beatSec, stepIdx) {
      const s = stepIdx % 16;
      // kick
      if (s % 4 === 0) {
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        env(g, t, 0.001, 0.08, 0.01, 0.15, 0.5);
        o.connect(g);
        g.connect(dryGain);
        o.start(t);
        o.stop(t + 0.25);
      }
      // snare
      if (s % 8 === 4) playNoise(0.12, 0.25, 1800, dryGain);
      // hat
      if (s % 2 === 0) playNoise(0.03, 0.08, 8000, dryGain);
    },
    djembe(midi, beats, beatSec, stepIdx) {
      const s = stepIdx % 8;
      if (s === 0 || s === 3 || s === 6) {
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.setValueAtTime(180 + (s === 0 ? 40 : 0), t);
        o.frequency.exponentialRampToValueAtTime(60, t + 0.1);
        env(g, t, 0.001, 0.06, 0.05, 0.12, 0.28);
        o.connect(g);
        g.connect(dryGain);
        o.start(t);
        o.stop(t + 0.2);
        playNoise(0.06, 0.12, 600, dryGain);
      }
    }
  };

  function flattenPattern(arr) {
    // 16th-note grid over intro+verse+chorus (loop verse+chorus mainly)
    const sections = arr.structure;
    const events = []; // {step, chordRoot, melodyMidi, section}
    let stepCount = 0;
    sections.forEach((sec) => {
      let localBeat = 0;
      sec.chords.forEach((ch) => {
        const steps = Math.max(1, Math.round(ch.beats * 4)); // 16ths
        for (let i = 0; i < steps; i++) {
          events.push({
            step: stepCount++,
            chordRoot: ch.rootMidi,
            chordLabel: ch.label,
            section: sec.name,
            isDownbeat: i === 0
          });
        }
        localBeat += ch.beats;
      });
      // melody overlays on quarter grid
      sec.melody.forEach((m, mi) => {
        const idx = events.length - sec.melody.length * 4 + mi * 4;
        // attach melody to nearest events in this section — simpler: store separately
      });
    });
    // Build compact loop: use verse+chorus only for preview (~32–64 steps)
    const loop = [];
    let st = 0;
    ["Verse", "Chorus"].forEach((name) => {
      const sec = sections.find((s) => s.name === name);
      if (!sec) return;
      let melIdx = 0;
      sec.chords.forEach((ch) => {
        const steps = Math.max(1, Math.round(ch.beats * 4));
        for (let i = 0; i < steps; i++) {
          const mel = sec.melody[melIdx % sec.melody.length];
          loop.push({
            step: st++,
            chordRoot: ch.rootMidi,
            melody: mel ? mel.midi : ch.rootMidi + 12,
            section: name,
            hit: i === 0 || i === 2
          });
          if (i % 4 === 3) melIdx++;
        }
      });
    });
    return loop.length ? loop : events;
  }

  function tick() {
    if (!playing || !arrangement) return;
    const bpm = arrangement.bpm || 100;
    const beatSec = 60 / bpm;
    const stepSec = beatSec / 4;
    const loop = arrangement._loop || (arrangement._loop = flattenPattern(arrangement));
    const ev = loop[step % loop.length];
    if (onBeat) onBeat(step, ev, loop.length);

    const layers = layerOn;
    if (layers.piano && ev.hit) Instruments.piano(ev.chordRoot + 12, 1, beatSec);
    if (layers.guitar && ev.hit) Instruments.guitar(ev.chordRoot + 12, 0.8, beatSec);
    if (layers.bass && (step % 4 === 0)) Instruments.bass(ev.chordRoot, 1, beatSec);
    if (layers.pad && step % 8 === 0) Instruments.pad(ev.chordRoot, 2, beatSec);
    if (layers.synth && ev.hit) Instruments.synth(ev.melody, 0.5, beatSec);
    if (layers.sitar && (step % 4 === 0 || step % 8 === 3)) Instruments.sitar(ev.melody, 0.8, beatSec);
    if (layers.flute && step % 4 === 2) Instruments.flute(ev.melody, 0.6, beatSec);
    if (layers.drums) Instruments.drums(0, 0.25, beatSec, step);
    if (layers.djembe) Instruments.djembe(0, 0.25, beatSec, step);

    step++;
    timer = setTimeout(tick, stepSec * 1000);
  }

  function setArrangement(arr) {
    arrangement = arr;
    arrangement._loop = null;
    layerOn = Object.assign({}, arr.layers || {});
  }

  function setLayer(id, on) {
    layerOn[id] = !!on;
  }

  function getLayers() {
    return Object.assign({}, layerOn);
  }

  function play() {
    ensureCtx();
    if (!arrangement) return false;
    playing = true;
    step = 0;
    tick();
    return true;
  }

  function stop() {
    playing = false;
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function isPlaying() {
    return playing;
  }

  function setSongTune(v) {
    // v in [-1, 1]
    songTune = Math.max(-1, Math.min(1, v));
  }

  function setTuneMix(wet) {
    tuneAmount = Math.max(0, Math.min(1, wet));
    if (voiceWet && voiceDry) {
      voiceWet.gain.value = tuneAmount;
      voiceDry.gain.value = 1 - tuneAmount * 0.7;
    }
  }

  /** Demo tune: snap Audio element playbackRate toward nearest scale degree ratio */
  function quantizePlaybackRate(baseRate, scaleIntervals, strength) {
    // Approximate: nudge rate to ratios of 2^(semitone/12) for scale degrees
    const centsOptions = scaleIntervals.map((s) => Math.pow(2, s / 12));
    let best = 1;
    let bestDiff = Infinity;
    centsOptions.forEach((r) => {
      const d = Math.abs(r - 1);
      // pick gentle pull toward unison with scale color via LFO-less static choice
      if (d < bestDiff) {
        bestDiff = d;
        best = r;
      }
    });
    // Mix toward a slight scale-colored rate (demo effect)
    const target = 1 + (best - 1) * 0.15 * strength;
    return baseRate * (1 + (target - 1) * strength);
  }

  function attachVoiceElement(audioEl, scaleIntervals) {
    ensureCtx();
    detachVoice();
    voiceEl = audioEl;
    voiceEl.loop = true;
    try {
      voiceSource = ctx.createMediaElementSource(voiceEl);
      voiceSource.connect(voiceGain);
    } catch (e) {
      // already connected
      console.warn(e);
    }
    applyVoiceTune(scaleIntervals || [0, 2, 4, 5, 7, 9, 11]);
  }

  function applyVoiceTune(scaleIntervals) {
    if (!voiceEl) return;
    const strength = tuneAmount;
    // Demo: playbackRate quantization toward scale
    const rate = quantizePlaybackRate(1, scaleIntervals || [0, 2, 4, 5, 7, 9, 11], strength);
    // Also blend with songTune
    voiceEl.playbackRate = Math.max(0.5, Math.min(2, rate * Math.pow(2, (songTune * 2) / 12)));
    setTuneMix(tuneAmount);
  }

  async function startMic() {
    ensureCtx();
    detachMic();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micNode = ctx.createMediaStreamSource(micStream);
    // Demo "tune": bandpass + slight pitch via WaveShaper-less path — route through wet/dry
    const bp = ctx.createBiquadFilter();
    bp.type = "peaking";
    bp.frequency.value = 880;
    bp.Q.value = 2;
    bp.gain.value = 6 * tuneAmount;
    micNode.connect(bp);
    bp.connect(voiceGain);
    return true;
  }

  function detachMic() {
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    micNode = null;
  }

  function detachVoice() {
    if (voiceEl) {
      voiceEl.pause();
      voiceEl = null;
    }
    voiceSource = null;
  }

  function playVoice() {
    if (voiceEl) {
      ensureCtx();
      voiceEl.play();
    }
  }

  function stopVoice() {
    if (voiceEl) voiceEl.pause();
  }

  global.NaadAudio = {
    ensureCtx,
    setArrangement,
    setLayer,
    getLayers,
    play,
    stop,
    isPlaying,
    setSongTune,
    setTuneMix,
    attachVoiceElement,
    applyVoiceTune,
    startMic,
    detachMic,
    detachVoice,
    playVoice,
    stopVoice,
    onBeat(fn) {
      onBeat = fn;
    },
    getCtx: () => ctx,
    Instruments
  };
})(typeof window !== "undefined" ? window : globalThis);

