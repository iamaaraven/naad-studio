/* Naad — rule-based AI-assisted arrangement (demo, not a paid generative API) */
(function (global) {
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const MINOR = [0, 2, 3, 5, 7, 8, 10];
  const PENT_MAJ = [0, 2, 4, 7, 9];
  const PENT_MIN = [0, 3, 5, 7, 10];

  const GENRE_PRESETS = {
    Bollywood: { key: "D", mode: "major", layers: ["piano", "sitar", "flute", "bass", "drums", "pad"], pattern: "bolly" },
    Pop: { key: "C", mode: "major", layers: ["piano", "guitar", "bass", "drums", "pad"], pattern: "pop" },
    "Hip-hop": { key: "A", mode: "minor", layers: ["bass", "drums", "pad", "synth", "piano"], pattern: "hip" },
    EDM: { key: "F", mode: "minor", layers: ["synth", "bass", "drums", "pad"], pattern: "edm" },
    Folk: { key: "G", mode: "major", layers: ["guitar", "flute", "djembe", "bass"], pattern: "folk" },
    "Lo-fi": { key: "Bb", mode: "minor", layers: ["piano", "pad", "bass", "drums"], pattern: "lofi" }
  };

  const MOOD_SHIFT = {
    Joyful: { modeBias: "major", bpmDelta: 8, energy: 0.9 },
    Romantic: { modeBias: "major", bpmDelta: -6, energy: 0.55 },
    Melancholy: { modeBias: "minor", bpmDelta: -12, energy: 0.4 },
    Energetic: { modeBias: "major", bpmDelta: 16, energy: 1 },
    Chill: { modeBias: "minor", bpmDelta: -10, energy: 0.35 },
    Epic: { modeBias: "minor", bpmDelta: 4, energy: 0.85 }
  };

  const PROGRESSIONS = {
    bolly: {
      intro: [[0, 4], [5, 4], [3, 4], [4, 4]],
      verse: [[0, 4], [5, 4], [3, 4], [4, 4]],
      chorus: [[0, 4], [4, 4], [5, 4], [3, 4]]
    },
    pop: {
      intro: [[0, 4], [4, 4], [5, 4], [3, 4]],
      verse: [[0, 4], [5, 4], [3, 4], [4, 4]],
      chorus: [[5, 4], [3, 4], [0, 4], [4, 4]]
    },
    hip: {
      intro: [[0, 4], [0, 4], [3, 4], [4, 4]],
      verse: [[0, 4], [5, 4], [0, 4], [3, 4]],
      chorus: [[0, 4], [3, 4], [5, 4], [4, 4]]
    },
    edm: {
      intro: [[0, 4], [0, 4], [5, 4], [5, 4]],
      verse: [[0, 4], [5, 4], [3, 4], [4, 4]],
      chorus: [[0, 2], [0, 2], [5, 2], [5, 2], [3, 2], [3, 2], [4, 4]]
    },
    folk: {
      intro: [[0, 4], [4, 4], [0, 4], [5, 4]],
      verse: [[0, 4], [3, 4], [4, 4], [0, 4]],
      chorus: [[5, 4], [4, 4], [0, 4], [4, 4]]
    },
    lofi: {
      intro: [[1, 4], [4, 4], [0, 4], [3, 4]],
      verse: [[1, 4], [4, 4], [0, 4], [5, 4]],
      chorus: [[0, 4], [3, 4], [1, 4], [4, 4]]
    }
  };

  function keyIndex(key) {
    const map = { Bb: "A#", Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#" };
    return NOTES.indexOf(map[key] || key);
  }

  function scaleFor(mode, moodBias) {
    let m = mode;
    if (moodBias === "major") m = "major";
    if (moodBias === "minor") m = "minor";
    return m === "minor" ? MINOR : MAJOR;
  }

  function chordName(rootIdx, degree, mode) {
    const scale = mode === "minor" ? MINOR : MAJOR;
    const deg = degree % 7;
    const note = NOTES[(rootIdx + scale[deg]) % 12];
    const triad = mode === "minor"
      ? (deg === 0 || deg === 3 || deg === 4 ? "m" : "")
      : (deg === 1 || deg === 2 || deg === 5 ? "m" : "");
    return note + triad;
  }

  function melodyFromChords(chords, rootIdx, scale, seed) {
    const seq = [];
    let rng = seed;
    const next = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 0xffffffff; };
    chords.forEach(([deg]) => {
      const base = scale[deg % scale.length];
      for (let i = 0; i < 4; i++) {
        const pick = scale[Math.floor(next() * scale.length)];
        const octave = next() > 0.7 ? 1 : 0;
        seq.push({ midi: 60 + base + (pick - base) + octave * 12 + (rootIdx % 12), dur: 0.25 });
      }
    });
    return seq;
  }

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function generate(opts) {
    const genre = opts.genre || "Pop";
    const mood = opts.mood || "Joyful";
    const title = (opts.title || "Untitled").trim() || "Untitled";
    const lyrics = (opts.lyrics || "").trim();
    let bpm = Math.max(60, Math.min(180, Number(opts.bpm) || 100));
    const preset = GENRE_PRESETS[genre] || GENRE_PRESETS.Pop;
    const moodP = MOOD_SHIFT[mood] || MOOD_SHIFT.Joyful;
    bpm = Math.max(60, Math.min(180, bpm + moodP.bpmDelta));
    const mode = moodP.modeBias || preset.mode;
    const rootIdx = keyIndex(preset.key);
    const scale = scaleFor(preset.mode, moodP.modeBias);
    const prog = PROGRESSIONS[preset.pattern] || PROGRESSIONS.pop;
    const seed = hashSeed(title + "|" + genre + "|" + mood + "|" + lyrics.slice(0, 40));

    function section(name, bars) {
      const chords = bars.map(([deg, beats]) => ({
        label: chordName(rootIdx, deg, mode === "minor" ? "minor" : "major"),
        degree: deg,
        beats,
        rootMidi: 48 + ((rootIdx + scale[deg % scale.length]) % 12)
      }));
      return {
        name,
        bars: bars.length,
        chords,
        chordStr: chords.map((c) => c.label).join(" – "),
        melody: melodyFromChords(bars, rootIdx, scale, seed ^ name.length)
      };
    }

    const structure = [
      section("Intro", prog.intro),
      section("Verse", prog.verse),
      section("Chorus", prog.chorus)
    ];

    const defaultLayers = {};
    ["piano", "guitar", "bass", "drums", "sitar", "flute", "pad", "synth", "djembe"].forEach((id) => {
      defaultLayers[id] = preset.layers.includes(id);
    });

    return {
      title, genre, mood, bpm,
      key: preset.key,
      mode,
      energy: moodP.energy,
      scale: scale.map((s) => NOTES[(rootIdx + s) % 12]),
      scaleIntervals: scale,
      rootIdx,
      structure,
      layers: defaultLayers,
      lyrics,
      generatedAt: new Date().toISOString(),
      engine: "naad-rules-v1"
    };
  }

  global.NaadArrange = { generate, GENRE_PRESETS, MOOD_SHIFT, NOTES, MAJOR, MINOR, PENT_MAJ, PENT_MIN };
})(typeof window !== "undefined" ? window : globalThis);
