/**
     * BCP MONOPOLY 3D — Christchurch & BCP Edition
     * Main game controller. Board data, layout and gameplay systems are kept in
     * named sections so they can be edited without searching through the HTML.
     */
    import { MonopolyOnline } from './monopoly-online.js';

    (function () {
      "use strict";

      // =========================================================================
      // 1. AUDIO SYNTHESIZER (WEB AUDIO API)
      // =========================================================================
      const AudioEngine = (() => {
        let ctx = null;
        let muted = false;
        const music = new Audio("Music/BGM.mp3");
        music.loop = true;
        music.volume = 0.22;
        music.preload = "auto";
        const splashSound = new Audio("Music/Splash_SFX.mp3");
        splashSound.volume = 0.82;
        splashSound.preload = "auto";

        function ensure() {
          if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) ctx = new AC();
          }
          if (ctx && ctx.state === "suspended") {
            ctx.resume().catch(() => {});
          }
        }

        function tone(freq, endFreq, dur, type = "triangle", vol = 0.14) {
          if (muted) return;
          ensure();
          if (!ctx) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(freq, ctx.currentTime);
          if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), ctx.currentTime + dur);
          gain.gain.setValueAtTime(vol, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + dur);
        }

        return {
          init: ensure,
          startBgm() { if (!muted) music.play().catch(() => {}); },
          setMuted(m) {
            muted = m;
            music.muted = muted;
            splashSound.muted = muted;
            if (!muted) music.play().catch(() => {});
          },
          isMuted() { return muted; },
          splash() { if (muted) return; splashSound.currentTime = 0; splashSound.play().catch(() => {}); },
          diceTick() { tone(320 + Math.random() * 240, 180, 0.05, "square", 0.06); },
          step() { tone(440, 520, 0.06, "sine", 0.08); },
          buy() { tone(523, 784, 0.16, "triangle", 0.14); },
          rent() { tone(260, 140, 0.18, "sawtooth", 0.12); },
          card() { tone(587, 880, 0.14, "sine", 0.12); },
          build() { tone(392, 659, 0.15, "triangle", 0.14); },
          passGo() { tone(523, 1046, 0.25, "triangle", 0.16); }
        };
      })();

      // =========================================================================
      // 2. CHRISTCHURCH & BCP 40-TILE BOARD DATA & DECKS
      // =========================================================================
      const TEAMS = [
        { id: "Alpha", label: "Team Alpha", color: "#38bdf8", hex: 0x38bdf8 },
        { id: "Beta",  label: "Team Beta",  color: "#f97316", hex: 0xf97316 },
        { id: "Gamma", label: "Team Gamma", color: "#a855f7", hex: 0xa855f7 },
        { id: "Delta", label: "Team Delta", color: "#22c55e", hex: 0x22c55e }
      ];

      const CHARACTER_STYLES = [
        { id: "scholar", name: "Twynham Scholar", color: 0x1e3a8a, accent: 0xfacc15 },
        { id: "sailor",  name: "Mudeford Skipper", color: 0x0284c7, accent: 0xf8fafc },
        { id: "ranger",  name: "Stanpit Ranger",  color: 0x15803d, accent: 0x86efac },
        { id: "pilot",   name: "Hurn Aviator",    color: 0xb45309, accent: 0xfde68a },
        { id: "knight",  name: "Priory Warden",   color: 0x6d28d9, accent: 0xe9d5ff },
        { id: "surfer",  name: "Boscombe Surfer", color: 0xe11d48, accent: 0xfecdd3 },
        { id: "mayor",   name: "BCP Councillor",  color: 0x0f766e, accent: 0x99f6e4 },
        { id: "keeper",  name: "Highcliffe Host", color: 0xbe185d, accent: 0xfbcfe8 }
      ];

      const COLOR_SETS = {
        brown:    { name: "Christchurch Old Town", hex: "#7c4a2d", threeHex: 0x7c4a2d, houseCost: 50 },
        lightblue:{ name: "Stanpit & Quomps",      hex: "#38bdf8", threeHex: 0x38bdf8, houseCost: 50 },
        pink:     { name: "Mudeford & Highcliffe", hex: "#ec4899", threeHex: 0xec4899, houseCost: 100 },
        orange:   { name: "Southbourne & Tuckton", hex: "#f97316", threeHex: 0xf97316, houseCost: 100 },
        red:      { name: "Boscombe & Pokesdown",  hex: "#ef4444", threeHex: 0xef4444, houseCost: 150 },
        yellow:   { name: "Bournemouth & Charminster", hex: "#eab308", threeHex: 0xeab308, houseCost: 150 },
        green:    { name: "Poole & Sandbanks",     hex: "#16a34a", threeHex: 0x16a34a, houseCost: 200 },
        darkblue: { name: "Twynham & Sopers Lane", hex: "#1e3a8a", threeHex: 0x1e3a8a, houseCost: 200 }
      };

      // =========================================================================
      // 2B. PROCEDURAL PBR-STYLE CANVAS TEXTURES
      // =========================================================================
      const PBRTextures = (() => {
        const facadeCache = new Map();
        const roofCache = new Map();
        const woodCache = new Map();

        function makeCanvas(w, h) {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          return c;
        }

        function makeRand(seedInit) {
          let seed = seedInit >>> 0 || 1;
          return () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
          };
        }

        function registerTex(c, repeatX = 1, repeatY = 1, shared = true) {
          const tex = new THREE.CanvasTexture(c);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(repeatX, repeatY);
          tex.anisotropy = 8;
          tex.userData = { shared };
          return tex;
        }

        function heightToNormalCanvas(heights, size, strength = 2.4) {
          const c = makeCanvas(size, size);
          const ctx = c.getContext("2d");
          const img = ctx.createImageData(size, size);
          const d = img.data;
          for (let y = 0; y < size; y++) {
            const ym = (y - 1 + size) % size;
            const yp = (y + 1) % size;
            for (let x = 0; x < size; x++) {
              const xm = (x - 1 + size) % size;
              const xp = (x + 1) % size;
              const tl = heights[ym * size + xm];
              const l  = heights[y  * size + xm];
              const bl = heights[yp * size + xm];
              const t  = heights[ym * size + x];
              const b  = heights[yp * size + x];
              const tr = heights[ym * size + xp];
              const r  = heights[y  * size + xp];
              const br = heights[yp * size + xp];

              const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
              const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
              let nx = -dx * strength;
              let ny = -dy * strength;
              let nz = 1.0;
              const len = Math.hypot(nx, ny, nz) || 1;
              nx /= len; ny /= len; nz /= len;
              const idx = (y * size + x) * 4;
              d[idx]     = Math.round((nx * 0.5 + 0.5) * 255);
              d[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
              d[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
              d[idx + 3] = 255;
            }
          }
          ctx.putImageData(img, 0, 0);
          return c;
        }

        function heightToGrayCanvas(heights, size, minVal = 40, maxVal = 235) {
          const c = makeCanvas(size, size);
          const ctx = c.getContext("2d");
          const img = ctx.createImageData(size, size);
          const d = img.data;
          const span = maxVal - minVal;
          for (let i = 0; i < size * size; i++) {
            const v = Math.max(0, Math.min(255, Math.round(minVal + heights[i] * span)));
            const idx = i * 4;
            d[idx] = v;
            d[idx + 1] = v;
            d[idx + 2] = v;
            d[idx + 3] = 255;
          }
          ctx.putImageData(img, 0, 0);
          return c;
        }

        function buildPeriodicGrid(period, rand) {
          const g = new Float32Array(period * period);
          for (let i = 0; i < g.length; i++) g[i] = rand();
          return g;
        }

        function samplePeriodic(grid, period, u, v) {
          const gx = ((u * period) % period + period) % period;
          const gy = ((v * period) % period + period) % period;
          const x0 = Math.floor(gx);
          const y0 = Math.floor(gy);
          const x1 = (x0 + 1) % period;
          const y1 = (y0 + 1) % period;
          const fx = gx - x0;
          const fy = gy - y0;
          const sx = fx * fx * (3 - 2 * fx);
          const sy = fy * fy * (3 - 2 * fy);
          const a = grid[y0 * period + x0];
          const b = grid[y0 * period + x1];
          const c = grid[y1 * period + x0];
          const d = grid[y1 * period + x1];
          return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
        }

        function createPeriodicNoiseField(size, octaves, seedInit) {
          const rand = makeRand(seedInit);
          const grids = octaves.map(([period]) => buildPeriodicGrid(period, rand));
          const field = new Float32Array(size * size);
          let weightSum = 0;
          for (const [, amp] of octaves) weightSum += amp;
          for (let y = 0; y < size; y++) {
            const v = y / size;
            for (let x = 0; x < size; x++) {
              const u = x / size;
              let val = 0;
              for (let k = 0; k < octaves.length; k++) {
                val += samplePeriodic(grids[k], octaves[k][0], u, v) * octaves[k][1];
              }
              field[y * size + x] = val / (weightSum || 1);
            }
          }
          return field;
        }

        function createWaterTextures() {
          const size = 256;
          const field = new Float32Array(size * size);
          const noise = createPeriodicNoiseField(size, [[4, 0.5], [8, 0.3], [16, 0.2]], 4129);
          for (let y = 0; y < size; y++) {
            const v = (y / size) * Math.PI * 2;
            for (let x = 0; x < size; x++) {
              const u = (x / size) * Math.PI * 2;
              const n = noise[y * size + x];
              const w1 = Math.sin(u * 3 + v * 2 + n * 2.4) * 0.5 + 0.5;
              const w2 = Math.sin(u * 5 - v * 4 + n * 1.8) * 0.5 + 0.5;
              const w3 = Math.cos(u * 8 + v * 7 - n * 2.0) * 0.5 + 0.5;
              field[y * size + x] = w1 * 0.45 + w2 * 0.35 + w3 * 0.20;
            }
          }

          const c = makeCanvas(512, 512);
          const ctx = c.getContext("2d");
          const img = ctx.createImageData(512, 512);
          const d = img.data;
          for (let y = 0; y < 512; y++) {
            const sy = y >> 1;
            for (let x = 0; x < 512; x++) {
              const sx = x >> 1;
              const h = field[sy * size + sx];
              const caustic = Math.pow(Math.max(0, 1 - Math.abs(h - 0.62) * 4.2), 2.2);
              const crest = Math.pow(Math.max(0, (h - 0.72) / 0.28), 1.8);
              const idx = (y * 512 + x) * 4;
              d[idx]     = Math.min(255, Math.round(28 + h * 46 + caustic * 78 + crest * 62));
              d[idx + 1] = Math.min(255, Math.round(92 + h * 68 + caustic * 72 + crest * 54));
              d[idx + 2] = Math.min(255, Math.round(145 + h * 65 + caustic * 45 + crest * 40));
              d[idx + 3] = 255;
            }
          }
          ctx.putImageData(img, 0, 0);

          const rand = makeRand(9187);
          for (let i = 0; i < 360; i++) {
            const x = rand() * 512;
            const y = rand() * 512;
            const w = 18 + rand() * 46;
            ctx.strokeStyle = rand() > 0.35 ? "rgba(186, 230, 253, 0.16)" : "rgba(240, 249, 255, 0.22)";
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + w * 0.5, y - 4, x + w, y + 1);
            ctx.stroke();
          }

          const nCanvas = heightToNormalCanvas(field, size, 3.1);
          const rHeights = new Float32Array(size * size);
          for (let i = 0; i < rHeights.length; i++) {
            rHeights[i] = 1 - Math.min(1, field[i] * 0.85);
          }
          const rCanvas = heightToGrayCanvas(rHeights, size, 32, 130);

          return {
            map: registerTex(c, 18, 18),
            normalMap: registerTex(nCanvas, 18, 18),
            roughnessMap: registerTex(rCanvas, 18, 18)
          };
        }

        function createFountainWaterTextures() {
          const size = 256;
          const field = new Float32Array(size * size);
          const c = makeCanvas(size, size);
          const ctx = c.getContext("2d");
          const img = ctx.createImageData(size, size);
          const d = img.data;
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              const dx = x / size - 0.5;
              const dy = y / size - 0.5;
              const dist = Math.hypot(dx, dy);
              const wave = Math.sin(dist * 46) * 0.5 + 0.5;
              const swirl = Math.sin(Math.atan2(dy, dx) * 6 + dist * 22) * 0.5 + 0.5;
              const h = wave * 0.72 + swirl * 0.28;
              field[y * size + x] = h;
              const idx = (y * size + x) * 4;
              d[idx]     = Math.round(52 + h * 75);
              d[idx + 1] = Math.round(168 + h * 65);
              d[idx + 2] = Math.round(230 + h * 25);
              d[idx + 3] = 255;
            }
          }
          ctx.putImageData(img, 0, 0);
          return {
            map: registerTex(c, 1, 1),
            normalMap: registerTex(heightToNormalCanvas(field, size, 2.4), 1, 1)
          };
        }

        function createTurfTextures() {
          const size = 256;
          const baseNoise = createPeriodicNoiseField(size, [[4, 0.45], [10, 0.35], [24, 0.2]], 8821);
          const c = makeCanvas(512, 512);
          const ctx = c.getContext("2d");

          // Neutral-bright botanical palette so theme.ground tints accurately
          const img = ctx.createImageData(512, 512);
          const d = img.data;
          const bHeights = new Float32Array(size * size);
          for (let y = 0; y < 512; y++) {
            const sy = y >> 1;
            const stripe = Math.sin((y / 512) * Math.PI * 8) * 0.06;
            for (let x = 0; x < 512; x++) {
              const sx = x >> 1;
              const n = baseNoise[sy * size + sx];
              const idx = (y * 512 + x) * 4;
              const lum = 0.76 + n * 0.34 + stripe;
              d[idx]     = Math.min(255, Math.round(152 * lum));
              d[idx + 1] = Math.min(255, Math.round(212 * lum));
              d[idx + 2] = Math.min(255, Math.round(164 * lum));
              d[idx + 3] = 255;
              bHeights[sy * size + sx] = n;
            }
          }
          ctx.putImageData(img, 0, 0);

          const rand = makeRand(7741);
          for (let i = 0; i < 6500; i++) {
            const x = rand() * 512;
            const y = rand() * 512;
            const len = 3 + rand() * 5;
            const lean = (rand() - 0.5) * 2.2;
            ctx.strokeStyle = rand() > 0.45 ? "rgba(232, 250, 236, 0.26)" : "rgba(65, 118, 78, 0.28)";
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + lean, y - len);
            ctx.stroke();

            const bx = Math.floor(x / 2) % size;
            const by = Math.floor(y / 2) % size;
            bHeights[by * size + bx] = Math.min(1, bHeights[by * size + bx] + (rand() > 0.4 ? 0.22 : -0.15));
          }

          // Subtle coastal clover/flower speckles
          for (let i = 0; i < 95; i++) {
            ctx.fillStyle = rand() > 0.35 ? "rgba(255, 255, 240, 0.35)" : "rgba(253, 224, 71, 0.25)";
            ctx.beginPath();
            ctx.arc(rand() * 512, rand() * 512, 1.2 + rand() * 1.3, 0, Math.PI * 2);
            ctx.fill();
          }

          const rHeights = new Float32Array(size * size);
          for (let i = 0; i < rHeights.length; i++) rHeights[i] = 1 - bHeights[i] * 0.4;

          return {
            map: registerTex(c, 5, 5),
            bumpMap: registerTex(heightToGrayCanvas(bHeights, size, 60, 240), 5, 5),
            roughnessMap: registerTex(heightToGrayCanvas(rHeights, size, 165, 245), 5, 5)
          };
        }

        function createSlabTextures() {
          const size = 256;
          const field = createPeriodicNoiseField(size, [[4, 0.42], [10, 0.34], [24, 0.24]], 3319);
          const c = makeCanvas(512, 512);
          const ctx = c.getContext("2d");
          const img = ctx.createImageData(512, 512);
          const d = img.data;
          for (let y = 0; y < 512; y++) {
            const sy = y >> 1;
            for (let x = 0; x < 512; x++) {
              const sx = x >> 1;
              const n = field[sy * size + sx];
              const vein = Math.pow(Math.abs(Math.sin((x / 512) * Math.PI * 3 + n * 4.5)), 0.35);
              const v = Math.round(178 + n * 42 + vein * 28);
              const idx = (y * 512 + x) * 4;
              d[idx] = v;
              d[idx + 1] = Math.min(255, v + 4);
              d[idx + 2] = Math.min(255, v + 10);
              d[idx + 3] = 255;
            }
          }
          ctx.putImageData(img, 0, 0);
          return {
            map: registerTex(c, 3, 3),
            bumpMap: registerTex(heightToGrayCanvas(field, size, 80, 220), 3, 3),
            roughnessMap: registerTex(heightToGrayCanvas(field, size, 105, 195), 3, 3)
          };
        }

        function createBrassTextures() {
          const size = 256;
          const c = makeCanvas(size, size);
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#eceff4";
          ctx.fillRect(0, 0, size, size);
          const heights = new Float32Array(size * size);
          const rand = makeRand(6143);
          for (let y = 0; y < size; y++) {
            const streak = (rand() - 0.5) * 28;
            ctx.fillStyle = streak > 0 ? `rgba(255,255,255,${(streak / 90).toFixed(3)})` : `rgba(80,70,55,${(-streak / 120).toFixed(3)})`;
            ctx.fillRect(0, y, size, 1);
            const hVal = 0.5 + (streak / 60);
            for (let x = 0; x < size; x++) heights[y * size + x] = Math.max(0, Math.min(1, hVal));
          }
          return {
            map: registerTex(c, 8, 1),
            bumpMap: registerTex(heightToGrayCanvas(heights, size, 100, 210), 8, 1),
            roughnessMap: registerTex(heightToGrayCanvas(heights, size, 55, 130), 8, 1)
          };
        }

        function createPavingTextures() {
          const size = 256;
          const c = makeCanvas(512, 512);
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#7c8796";
          ctx.fillRect(0, 0, 512, 512);

          const heights = new Float32Array(size * size);
          const noise = createPeriodicNoiseField(size, [[8, 0.5], [20, 0.5]], 5527);
          const rand = makeRand(5528);

          const rows = 8;
          const rowH = 512 / rows;
          for (let r = 0; r < rows; r++) {
            const cols = 4;
            const colW = 512 / cols;
            const offset = (r % 2) * (colW * 0.5);
            for (let col = -1; col <= cols; col++) {
              const px = col * colW + offset + 3;
              const py = r * rowH + 3;
              const pw = colW - 6;
              const ph = rowH - 6;
              const tone = 192 + Math.floor(rand() * 34);
              const warm = Math.floor(rand() * 12);
              ctx.fillStyle = `rgb(${tone + warm}, ${tone + 4}, ${tone - 4})`;
              ctx.fillRect(px, py, pw, ph);
              ctx.fillStyle = "rgba(255,255,255,0.2)";
              ctx.fillRect(px, py, pw, 3);
              ctx.fillStyle = "rgba(15,23,42,0.18)";
              ctx.fillRect(px, py + ph - 3, pw, 3);
            }
          }

          for (let y = 0; y < size; y++) {
            const rowPos = ((y * 2) % rowH) / rowH;
            const rIdx = Math.floor((y * 2) / rowH);
            const colW = 512 / 4;
            const offset = (rIdx % 2) * (colW * 0.5);
            for (let x = 0; x < size; x++) {
              const colPos = (((x * 2) - offset + 512) % colW) / colW;
              const isMortar = rowPos < 0.08 || rowPos > 0.92 || colPos < 0.04 || colPos > 0.96;
              heights[y * size + x] = isMortar ? 0.15 : 0.68 + noise[y * size + x] * 0.32;
            }
          }

          return {
            map: registerTex(c, 2, 10),
            bumpMap: registerTex(heightToGrayCanvas(heights, size, 30, 235), 2, 10),
            roughnessMap: registerTex(heightToGrayCanvas(heights, size, 145, 235), 2, 10)
          };
        }

        function createFacadeTexture(baseHex, accentHex = "#e2e8f0", style = "town") {
          const key = `${baseHex}|${accentHex}|${style}`;
          if (facadeCache.has(key)) return facadeCache.get(key);

          const c = makeCanvas(512, 512);
          const ctx = c.getContext("2d");
          ctx.fillStyle = baseHex;
          ctx.fillRect(0, 0, 512, 512);

          const bCanvas = makeCanvas(256, 256);
          const bCtx = bCanvas.getContext("2d");
          bCtx.fillStyle = "#b8b8b8";
          bCtx.fillRect(0, 0, 256, 256);

          const rCanvas = makeCanvas(256, 256);
          const rCtx = rCanvas.getContext("2d");
          rCtx.fillStyle = "#d8d8d8";
          rCtx.fillRect(0, 0, 256, 256);

          const rand = makeRand(key.split("").reduce((a, ch) => a * 31 + ch.charCodeAt(0), 17));

          // Masonry / brick / ashlar courses
          const courseH = style === "priory" ? 28 : 20;
          for (let y = 0; y < 512; y += courseH) {
            ctx.fillStyle = "rgba(15, 23, 42, 0.11)";
            ctx.fillRect(0, y, 512, 2);
            bCtx.fillStyle = "#707070";
            bCtx.fillRect(0, y >> 1, 256, 1);

            const brickW = style === "priory" ? 56 : 36;
            const shift = ((y / courseH) % 2) * (brickW * 0.5);
            for (let x = -brickW; x < 512; x += brickW) {
              if (rand() > 0.4) {
                ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)";
                ctx.fillRect(x + shift, y + 2, brickW - 2, courseH - 2);
              }
              ctx.fillStyle = "rgba(15, 23, 42, 0.08)";
              ctx.fillRect(x + shift, y, 2, courseH);
            }
          }

          // Plinth & upper cornice shading
          const plinth = ctx.createLinearGradient(0, 440, 0, 512);
          plinth.addColorStop(0, "rgba(15, 23, 42, 0)");
          plinth.addColorStop(1, "rgba(15, 23, 42, 0.34)");
          ctx.fillStyle = plinth;
          ctx.fillRect(0, 440, 512, 72);

          ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
          ctx.fillRect(0, 0, 512, 16);
          ctx.fillStyle = "rgba(15, 23, 42, 0.22)";
          ctx.fillRect(0, 16, 512, 8);

          // Recessed framed windows with warm/sky glass & lintels
          const cols = 4;
          const rows = 3;
          for (let r = 0; r < rows; r++) {
            for (let col = 0; col < cols; col++) {
              const wx = 44 + col * 116;
              const wy = 54 + r * 138;
              const ww = 64;
              const wh = 86;

              // Stone lintel & sill
              ctx.fillStyle = accentHex;
              ctx.fillRect(wx - 8, wy - 12, ww + 16, 10);
              ctx.fillRect(wx - 6, wy + wh + 2, ww + 12, 10);
              bCtx.fillStyle = "#f2f2f2";
              bCtx.fillRect((wx - 8) >> 1, (wy - 12) >> 1, (ww + 16) >> 1, 5);
              bCtx.fillRect((wx - 6) >> 1, (wy + wh + 2) >> 1, (ww + 12) >> 1, 5);

              // Outer reveal
              ctx.fillStyle = "rgba(15, 23, 42, 0.62)";
              ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
              bCtx.fillStyle = "#323232";
              bCtx.fillRect((wx - 4) >> 1, (wy - 4) >> 1, (ww + 8) >> 1, (wh + 8) >> 1);

              // Glass pane gradient
              const lit = (r + col) % 3 === 0 || rand() > 0.65;
              const gGrad = ctx.createLinearGradient(wx, wy, wx + ww, wy + wh);
              if (lit) {
                gGrad.addColorStop(0, "#fef08a");
                gGrad.addColorStop(1, "#f59e0b");
              } else {
                gGrad.addColorStop(0, "#bae6fd");
                gGrad.addColorStop(0.55, "#38bdf8");
                gGrad.addColorStop(1, "#0c4a6e");
              }
              ctx.fillStyle = gGrad;
              ctx.fillRect(wx, wy, ww, wh);

              // Diagonal reflection glint
              ctx.fillStyle = "rgba(255, 255, 255, 0.26)";
              ctx.beginPath();
              ctx.moveTo(wx, wy);
              ctx.lineTo(wx + ww * 0.55, wy);
              ctx.lineTo(wx, wy + wh * 0.55);
              ctx.closePath();
              ctx.fill();

              // Smooth low roughness on window glass
              rCtx.fillStyle = "#262626";
              rCtx.fillRect(wx >> 1, wy >> 1, ww >> 1, wh >> 1);

              // Window mullions
              ctx.fillStyle = accentHex;
              ctx.fillRect(wx + ww * 0.5 - 2, wy, 4, wh);
              ctx.fillRect(wx, wy + wh * 0.45, ww, 4);
              bCtx.fillStyle = "#dcdcdc";
              bCtx.fillRect((wx + ww * 0.5 - 2) >> 1, wy >> 1, 2, wh >> 1);
            }
          }

          const bundle = {
            map: registerTex(c, 1, 1),
            bumpMap: registerTex(bCanvas, 1, 1),
            roughnessMap: registerTex(rCanvas, 1, 1)
          };
          facadeCache.set(key, bundle);
          return bundle;
        }

        function createRoofTextures(baseHex = "#475569") {
          if (roofCache.has(baseHex)) return roofCache.get(baseHex);
          const c = makeCanvas(256, 256);
          const ctx = c.getContext("2d");
          ctx.fillStyle = baseHex;
          ctx.fillRect(0, 0, 256, 256);

          const bCanvas = makeCanvas(256, 256);
          const bCtx = bCanvas.getContext("2d");
          bCtx.fillStyle = "#989898";
          bCtx.fillRect(0, 0, 256, 256);

          const rand = makeRand(baseHex.split("").reduce((a, ch) => a * 19 + ch.charCodeAt(0), 91));
          const rows = 12;
          const rowH = 256 / rows;
          const tileW = 24;
          for (let r = 0; r < rows; r++) {
            const y = r * rowH;
            const shift = (r % 2) * (tileW * 0.5);
            for (let x = -tileW; x < 256; x += tileW) {
              ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.09)" : "rgba(15,23,42,0.12)";
              ctx.fillRect(x + shift, y, tileW - 1, rowH - 1);
              ctx.fillStyle = "rgba(15,23,42,0.28)";
              ctx.fillRect(x + shift, y + rowH - 2, tileW, 2);
              bCtx.fillStyle = "#dedede";
              bCtx.fillRect(x + shift + 1, y + 1, tileW - 2, rowH - 3);
              bCtx.fillStyle = "#3a3a3a";
              bCtx.fillRect(x + shift, y + rowH - 2, tileW, 2);
            }
          }

          const bundle = {
            map: registerTex(c, 2, 2),
            bumpMap: registerTex(bCanvas, 2, 2)
          };
          roofCache.set(baseHex, bundle);
          return bundle;
        }

        function createWoodTextures(baseHex = "#9b6241") {
          if (woodCache.has(baseHex)) return woodCache.get(baseHex);
          const c = makeCanvas(256, 256);
          const ctx = c.getContext("2d");
          ctx.fillStyle = baseHex;
          ctx.fillRect(0, 0, 256, 256);

          const bCanvas = makeCanvas(256, 256);
          const bCtx = bCanvas.getContext("2d");
          bCtx.fillStyle = "#b8b8b8";
          bCtx.fillRect(0, 0, 256, 256);

          const rand = makeRand(baseHex.split("").reduce((a, ch) => a * 23 + ch.charCodeAt(0), 47));
          const planks = 6;
          const plankH = 256 / planks;
          for (let p = 0; p < planks; p++) {
            const py = p * plankH;
            ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.07)" : "rgba(15,23,42,0.09)";
            ctx.fillRect(0, py, 256, plankH);

            // Woodgrain lines
            for (let g = 0; g < 8; g++) {
              const gy = py + 4 + (g / 8) * (plankH - 8);
              ctx.strokeStyle = rand() > 0.4 ? "rgba(15,23,42,0.16)" : "rgba(255,245,220,0.12)";
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(0, gy);
              ctx.bezierCurveTo(85, gy + (rand() - 0.5) * 6, 170, gy + (rand() - 0.5) * 6, 256, gy);
              ctx.stroke();
            }

            // Plank seam & nail heads
            ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
            ctx.fillRect(0, py + plankH - 2, 256, 2);
            bCtx.fillStyle = "#303030";
            bCtx.fillRect(0, py + plankH - 2, 256, 2);
          }

          const bundle = {
            map: registerTex(c, 3, 1),
            bumpMap: registerTex(bCanvas, 3, 1)
          };
          woodCache.set(baseHex, bundle);
          return bundle;
        }

        function createSandTextures() {
          const size = 256;
          const field = new Float32Array(size * size);
          const noise = createPeriodicNoiseField(size, [[6, 0.45], [16, 0.35], [32, 0.2]], 3091);
          const c = makeCanvas(size, size);
          const ctx = c.getContext("2d");
          const img = ctx.createImageData(size, size);
          const d = img.data;
          for (let y = 0; y < size; y++) {
            const v = (y / size) * Math.PI * 2;
            for (let x = 0; x < size; x++) {
              const u = (x / size) * Math.PI * 2;
              const n = noise[y * size + x];
              const ripple = Math.sin(v * 14 + Math.sin(u * 2) * 1.6 + n * 2.5) * 0.5 + 0.5;
              const h = ripple * 0.65 + n * 0.35;
              field[y * size + x] = h;
              const idx = (y * size + x) * 4;
              d[idx]     = Math.min(255, Math.round(210 + h * 36));
              d[idx + 1] = Math.min(255, Math.round(182 + h * 36));
              d[idx + 2] = Math.min(255, Math.round(124 + h * 34));
              d[idx + 3] = 255;
            }
          }
          ctx.putImageData(img, 0, 0);
          return {
            map: registerTex(c, 4, 1),
            bumpMap: registerTex(heightToGrayCanvas(field, size, 65, 225), 4, 1)
          };
        }

        function createPrioryStoneTextures() {
          const base = createFacadeTexture("#cbb898", "#efe5d2", "priory");
          return base;
        }

        function createLighthouseTextures() {
          const c = makeCanvas(256, 256);
          const ctx = c.getContext("2d");
          const stripes = 5;
          const sh = 256 / stripes;
          for (let i = 0; i < stripes; i++) {
            ctx.fillStyle = i % 2 === 0 ? "#efe7d6" : "#c84b31";
            ctx.fillRect(0, i * sh, 256, sh);
          }
          // Stone course lines
          ctx.strokeStyle = "rgba(15, 23, 42, 0.16)";
          ctx.lineWidth = 2;
          for (let y = 16; y < 256; y += 22) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(256, y);
            ctx.stroke();
          }
          const bCanvas = makeCanvas(256, 256);
          const bCtx = bCanvas.getContext("2d");
          bCtx.fillStyle = "#c8c8c8";
          bCtx.fillRect(0, 0, 256, 256);
          bCtx.fillStyle = "#686868";
          for (let y = 16; y < 256; y += 22) bCtx.fillRect(0, y, 256, 2);
          return {
            map: registerTex(c, 1, 1),
            bumpMap: registerTex(bCanvas, 1, 1)
          };
        }

        function createSailTextures() {
          const c = makeCanvas(256, 256);
          const ctx = c.getContext("2d");
          const grad = ctx.createLinearGradient(0, 0, 256, 256);
          grad.addColorStop(0, "#fffdf5");
          grad.addColorStop(1, "#e8dcc0");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 256, 256);
          ctx.strokeStyle = "rgba(148, 125, 88, 0.35)";
          ctx.lineWidth = 2;
          for (let y = 32; y < 256; y += 44) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(256, y);
            ctx.stroke();
          }
          // Accent regatta stripe
          ctx.fillStyle = "#0284c7";
          ctx.fillRect(0, 148, 256, 18);
          return { map: registerTex(c, 1, 1) };
        }

        function createFoliageTextures() {
          const size = 256;
          const c = makeCanvas(size, size);
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#88c298";
          ctx.fillRect(0, 0, size, size);
          const rand = makeRand(6029);
          const bCanvas = makeCanvas(size, size);
          const bCtx = bCanvas.getContext("2d");
          bCtx.fillStyle = "#808080";
          bCtx.fillRect(0, 0, size, size);
          for (let i = 0; i < 650; i++) {
            const x = rand() * size;
            const y = rand() * size;
            const rx = 5 + rand() * 8;
            const ry = 3 + rand() * 5;
            const ang = rand() * Math.PI;
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(ang);
            ctx.fillStyle = rand() > 0.45 ? "rgba(215, 248, 222, 0.36)" : "rgba(38, 86, 52, 0.34)";
            ctx.beginPath();
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            bCtx.save();
            bCtx.translate(x, y);
            bCtx.rotate(ang);
            bCtx.fillStyle = rand() > 0.45 ? "#d8d8d8" : "#4a4a4a";
            bCtx.beginPath();
            bCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
            bCtx.fill();
            bCtx.restore();
          }
          return {
            map: registerTex(c, 2, 2),
            bumpMap: registerTex(bCanvas, 2, 2)
          };
        }

        function createClockFaceTexture() {
          const c = makeCanvas(256, 256);
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#172554";
          ctx.fillRect(0, 0, 256, 256);
          // Gold outer bezel
          ctx.fillStyle = "#facc15";
          ctx.beginPath();
          ctx.arc(128, 128, 108, 0, Math.PI * 2);
          ctx.fill();
          // Ivory face
          ctx.fillStyle = "#fefce8";
          ctx.beginPath();
          ctx.arc(128, 128, 94, 0, Math.PI * 2);
          ctx.fill();
          // Hour ticks
          ctx.strokeStyle = "#1e3a8a";
          for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            ctx.lineWidth = i % 3 === 0 ? 5 : 2.5;
            ctx.beginPath();
            ctx.moveTo(128 + Math.cos(a) * 70, 128 + Math.sin(a) * 70);
            ctx.lineTo(128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84);
            ctx.stroke();
          }
          // Clock hands (10:10)
          ctx.lineCap = "round";
          ctx.strokeStyle = "#0f172a";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(128, 128);
          ctx.lineTo(94, 96);
          ctx.stroke();
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(128, 128);
          ctx.lineTo(176, 86);
          ctx.stroke();
          ctx.fillStyle = "#ca8a04";
          ctx.beginPath();
          ctx.arc(128, 128, 7, 0, Math.PI * 2);
          ctx.fill();
          return registerTex(c, 1, 1);
        }

        function createCardstockMaps() {
          const size = 256;
          const bCanvas = makeCanvas(size, size);
          const bCtx = bCanvas.getContext("2d");
          bCtx.fillStyle = "#b0b0b0";
          bCtx.fillRect(0, 0, size, size);
          const rCanvas = makeCanvas(size, size);
          const rCtx = rCanvas.getContext("2d");
          rCtx.fillStyle = "#989898";
          rCtx.fillRect(0, 0, size, size);

          // Fine linen weave
          bCtx.strokeStyle = "rgba(255,255,255,0.18)";
          bCtx.lineWidth = 1;
          for (let i = 0; i < size; i += 4) {
            bCtx.beginPath();
            bCtx.moveTo(i, 0); bCtx.lineTo(i, size);
            bCtx.moveTo(0, i); bCtx.lineTo(size, i);
            bCtx.stroke();
          }
          // Glossy top color-band zone (less rough)
          rCtx.fillStyle = "#454545";
          rCtx.fillRect(8, 8, size - 16, 56);

          return {
            bumpMap: registerTex(bCanvas, 1, 1),
            roughnessMap: registerTex(rCanvas, 1, 1)
          };
        }

        function createSoftShadowTexture() {
          const c = makeCanvas(128, 128);
          const ctx = c.getContext("2d");
          const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
          grad.addColorStop(0, "rgba(2, 6, 23, 0.62)");
          grad.addColorStop(0.6, "rgba(2, 6, 23, 0.25)");
          grad.addColorStop(1, "rgba(2, 6, 23, 0)");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 128, 128);
          return registerTex(c, 1, 1);
        }

        function createDiceMaterials() {
          const pipLayouts = {
            1: [[0.5, 0.5]],
            2: [[0.28, 0.28], [0.72, 0.72]],
            3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
            4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
            5: [[0.26, 0.26], [0.74, 0.26], [0.5, 0.5], [0.26, 0.74], [0.74, 0.74]],
            6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]]
          };

          function makeFace(n) {
            const size = 256;
            const c = makeCanvas(size, size);
            const ctx = c.getContext("2d");
            const grad = ctx.createRadialGradient(128, 128, 20, 128, 128, 175);
            grad.addColorStop(0, "#ffffff");
            grad.addColorStop(0.75, "#f1f5f9");
            grad.addColorStop(1, "#cbd5e1");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, size, size);

            // Subtle beveled inner border
            ctx.strokeStyle = "rgba(148, 163, 184, 0.45)";
            ctx.lineWidth = 6;
            ctx.strokeRect(10, 10, size - 20, size - 20);

            const bCanvas = makeCanvas(size, size);
            const bCtx = bCanvas.getContext("2d");
            bCtx.fillStyle = "#e6e6e6";
            bCtx.fillRect(0, 0, size, size);
            bCtx.strokeStyle = "#b8b8b8";
            bCtx.lineWidth = 8;
            bCtx.strokeRect(6, 6, size - 12, size - 12);

            const pipR = n === 1 ? 26 : 19;
            for (const [px, py] of pipLayouts[n]) {
              const cx = px * size;
              const cy = py * size;
              // Recessed pip shadow ring
              ctx.fillStyle = "rgba(15, 23, 42, 0.2)";
              ctx.beginPath();
              ctx.arc(cx, cy + 2, pipR + 2, 0, Math.PI * 2);
              ctx.fill();

              const pGrad = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, pipR);
              pGrad.addColorStop(0, n === 1 ? "#ef4444" : "#334155");
              pGrad.addColorStop(1, n === 1 ? "#991b1b" : "#090d16");
              ctx.fillStyle = pGrad;
              ctx.beginPath();
              ctx.arc(cx, cy, pipR, 0, Math.PI * 2);
              ctx.fill();

              bCtx.fillStyle = "#222222";
              bCtx.beginPath();
              bCtx.arc(cx, cy, pipR, 0, Math.PI * 2);
              bCtx.fill();
            }

            return new THREE.MeshStandardMaterial({
              map: registerTex(c, 1, 1),
              bumpMap: registerTex(bCanvas, 1, 1),
              bumpScale: 0.045,
              roughness: 0.22,
              metalness: 0.06
            });
          }

          // Three.js BoxGeometry face order: +x, -x, +y, -y, +z, -z -> 3, 4, 1, 6, 2, 5
          return [3, 4, 1, 6, 2, 5].map(makeFace);
        }

        function createTokenFinishTextures() {
          const size = 128;
          const bCanvas = makeCanvas(size, size);
          const bCtx = bCanvas.getContext("2d");
          bCtx.fillStyle = "#c0c0c0";
          bCtx.fillRect(0, 0, size, size);
          const rand = makeRand(2291);
          for (let y = 0; y < size; y++) {
            const v = Math.floor(170 + rand() * 55);
            bCtx.fillStyle = `rgb(${v},${v},${v})`;
            bCtx.fillRect(0, y, size, 1);
          }
          return {
            bumpMap: registerTex(bCanvas, 2, 2)
          };
        }

        function createBoatHullTextures(colorHex) {
          const c = makeCanvas(256, 256);
          const ctx = c.getContext("2d");
          ctx.fillStyle = colorHex;
          ctx.fillRect(0, 0, 256, 256);
          // Horizontal hull strakes
          ctx.fillStyle = "rgba(15, 23, 42, 0.14)";
          for (let y = 24; y < 256; y += 28) ctx.fillRect(0, y, 256, 2);
          // Crisp waterline stripe
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 178, 256, 16);
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(0, 198, 256, 58);
          return { map: registerTex(c, 1, 1) };
        }

        function createBuildingPieceMaterials() {
          const houseFacade = createFacadeTexture("#e6f7ec", "#14532d", "cottage");
          const houseRoof = createRoofTextures("#15803d");
          const hotelFacade = createFacadeTexture("#fee2e2", "#991b1b", "hotel");
          const hotelRoof = createRoofTextures("#b91c1c");
          return {
            houseWall: new THREE.MeshStandardMaterial({
              map: houseFacade.map,
              bumpMap: houseFacade.bumpMap,
              bumpScale: 0.03,
              roughnessMap: houseFacade.roughnessMap,
              roughness: 0.55
            }),
            houseRoof: new THREE.MeshStandardMaterial({
              map: houseRoof.map,
              bumpMap: houseRoof.bumpMap,
              bumpScale: 0.035,
              roughness: 0.48
            }),
            hotelWall: new THREE.MeshStandardMaterial({
              map: hotelFacade.map,
              bumpMap: hotelFacade.bumpMap,
              bumpScale: 0.035,
              roughnessMap: hotelFacade.roughnessMap,
              roughness: 0.45
            }),
            hotelRoof: new THREE.MeshStandardMaterial({
              map: hotelRoof.map,
              bumpMap: hotelRoof.bumpMap,
              bumpScale: 0.04,
              roughness: 0.42
            })
          };
        }

        return {
          water: createWaterTextures(),
          fountainWater: createFountainWaterTextures(),
          turf: createTurfTextures(),
          slab: createSlabTextures(),
          brass: createBrassTextures(),
          paving: createPavingTextures(),
          sand: createSandTextures(),
          prioryStone: createPrioryStoneTextures(),
          lighthouse: createLighthouseTextures(),
          sail: createSailTextures(),
          foliage: createFoliageTextures(),
          clockFace: createClockFaceTexture(),
          cardstock: createCardstockMaps(),
          softShadow: createSoftShadowTexture(),
          diceMaterials: createDiceMaterials(),
          tokenFinish: createTokenFinishTextures(),
          buildingPieces: createBuildingPieceMaterials(),
          createFacadeTexture,
          createRoofTextures,
          createWoodTextures,
          createBoatHullTextures
        };
      })();

      function propTile(id, name, area, group, price, rents, desc) {
        return {
          id,
          name,
          area,
          type: "property",
          group,
          price,
          mortgage: Math.round(price * 0.5),
          rents, // [base, 1h, 2h, 3h, 4h, hotel]
          desc,
          ownerId: null,
          houses: 0, // 0..4 houses, 5 = hotel
          mortgaged: false
        };
      }

      function stationTile(id, name, area, desc) {
        return {
          id,
          name,
          area,
          type: "station",
          group: null,
          price: 200,
          mortgage: 100,
          desc,
          ownerId: null,
          mortgaged: false
        };
      }

      function utilityTile(id, name, area, desc) {
        return {
          id,
          name,
          area,
          type: "utility",
          group: null,
          price: 150,
          mortgage: 75,
          desc,
          ownerId: null,
          mortgaged: false
        };
      }

      const BOARD_TILES = [
        { id: 0,  name: "Christchurch Quay & Priory GO", area: "Christchurch", type: "go", desc: "Collect £200 each time you pass or land by Christchurch Priory & River Avon." },
        propTile(1, "Purewell High Street", "Christchurch", "brown", 60, [2, 10, 30, 90, 160, 250], "Bustling local shops and bakeries along Purewell."),
        { id: 2,  name: "BCP Community Chest", area: "BCP Council", type: "chest", desc: "Draw a BCP Community Chest card." },
        propTile(3, "Bargates", "Christchurch", "brown", 60, [4, 20, 60, 180, 320, 450], "Historic gateway route into central Christchurch."),
        { id: 4,  name: "BCP Council Tax", area: "BCP Council", type: "tax", amount: 200, desc: "Pay £200 towards local BCP civic services." },
        stationTile(5, "Christchurch Station", "Christchurch", "South Western Railway link serving Christchurch."),
        propTile(6, "Stanpit Marsh", "Christchurch", "lightblue", 100, [6, 30, 90, 270, 400, 550], "Scenic coastal nature reserve bordering Christchurch Harbour."),
        { id: 7,  name: "BCP Chance", area: "BCP Area", type: "chance", desc: "Draw a BCP Chance card." },
        propTile(8, "The Quomps", "Christchurch", "lightblue", 100, [6, 30, 90, 270, 400, 550], "Riverside lawns beside the Avon and Christchurch Priory."),
        propTile(9, "Christchurch Castle Ruins", "Christchurch", "lightblue", 120, [8, 40, 100, 300, 450, 600], "Norman keep ruins overlooking the Mill Stream."),
        { id: 10, name: "BCP Civic Detention", area: "BCP Civic", type: "jail", desc: "Just visiting or serving time in BCP Civic Detention." },
        propTile(11, "Tuckton Bridge", "Tuckton", "pink", 140, [10, 50, 150, 450, 625, 750], "River Stour crossing between Christchurch and Southbourne."),
        utilityTile(12, "Wessex Waterworks", "BCP Utility", "Coastal & river water supply across the BCP conurbation."),
        propTile(13, "Tuckton Riverfront", "Tuckton", "pink", 140, [10, 50, 150, 450, 625, 750], "Kayaks, tea gardens and riverside moorings."),
        propTile(14, "Iford Bridge", "Iford", "pink", 160, [12, 60, 180, 500, 700, 900], "Key river crossing linking Christchurch and Bournemouth."),
        stationTile(15, "Bournemouth Pier Approach", "Bournemouth", "Coastal transit hub near Bournemouth Pier & Gardens."),
        propTile(16, "Southbourne Grove", "Southbourne", "orange", 180, [14, 70, 200, 550, 750, 950], "Independent cafes, delis and lively Southbourne high street."),
        { id: 17, name: "BCP Community Chest", area: "BCP Council", type: "chest", desc: "Draw a BCP Community Chest card." },
        propTile(18, "Southbourne Clifftop", "Southbourne", "orange", 180, [14, 70, 200, 550, 750, 950], "Sweeping views across Poole Bay and the Isle of Wight."),
        propTile(19, "Christchurch Harbour Spit", "Christchurch", "orange", 200, [16, 80, 220, 600, 800, 1000], "Windy coastal path looking toward Hengistbury Head."),
        { id: 20, name: "Hengistbury Head Car Park", area: "Hengistbury Head", type: "parking", desc: "Collect the Hengistbury Head bonus pot accumulated from taxes & fines!" },
        propTile(21, "Boscombe Pier", "Boscombe", "red", 220, [18, 90, 250, 700, 875, 1050], "Iconic seaside pier and golden Boscombe sands."),
        { id: 22, name: "BCP Chance", area: "BCP Area", type: "chance", desc: "Draw a BCP Chance card." },
        propTile(23, "Pokesdown High Street", "Pokesdown", "red", 220, [18, 90, 250, 700, 875, 1050], "Vintage shops, eateries and vibrant Pokesdown."),
        propTile(24, "Boscombe Chine Gardens", "Boscombe", "red", 240, [20, 100, 300, 750, 925, 1100], "Lush wooded chine walking trail down to the beach."),
        stationTile(25, "Poole Quay Ferry", "Poole", "Harbour ferry & transit link across Poole Harbour."),
        propTile(26, "Bournemouth Square", "Bournemouth", "yellow", 260, [22, 110, 330, 800, 975, 1150], "Central plaza surrounded by Lower Gardens and town life."),
        propTile(27, "Charminster Road", "Charminster", "yellow", 260, [22, 110, 330, 800, 975, 1150], "Bustling street famous for global food and student life."),
        utilityTile(28, "Southern Electric Grid", "BCP Utility", "Power distribution serving Christchurch, Bournemouth & Poole."),
        propTile(29, "Westbourne Arcade", "Westbourne", "yellow", 280, [24, 120, 360, 850, 1025, 1200], "Boutiques, coffee houses and leafy Westbourne."),
        { id: 30, name: "Sent to BCP Detention!", area: "BCP Civic", type: "gotojail", desc: "Move directly to BCP Civic Detention. Do not collect £200." },
        propTile(31, "Mudeford Quay", "Mudeford", "green", 300, [26, 130, 390, 900, 1100, 1275], "Crabbing boats, harbour views and ferry to the Sandspit."),
        propTile(32, "Highcliffe Castle", "Highcliffe", "green", 300, [26, 130, 390, 900, 1100, 1275], "Historic clifftop castle set in coastal grounds."),
        { id: 33, name: "BCP Community Chest", area: "BCP Council", type: "chest", desc: "Draw a BCP Community Chest card." },
        propTile(34, "Sandbanks Peninsula", "Poole / Sandbanks", "green", 320, [28, 150, 450, 1000, 1200, 1400], "Prestigious coastal peninsula at the harbour entrance."),
        stationTile(35, "Hurn Airport Terminal", "Bournemouth / Hurn", "Bournemouth Airport regional transit hub."),
        { id: 36, name: "BCP Chance", area: "BCP Area", type: "chance", desc: "Draw a BCP Chance card." },
        propTile(37, "Priory Church Close", "Christchurch", "darkblue", 350, [35, 175, 500, 1100, 1300, 1500], "Historic stone close beside Christchurch Priory."),
        { id: 38, name: "Harbour & Beach Levy", area: "BCP Coastal", type: "tax", amount: 100, desc: "Pay £100 coastal maintenance levy." },
        propTile(39, "Twynham School", "Christchurch", "darkblue", 400, [50, 200, 600, 1400, 1700, 2000], "Dark Blue flagship Christchurch school landmark! Prestige rent & development.")
      ];

      const CHANCE_CARDS = [
        { title: "Hengistbury Express", text: "Advance to Hengistbury Head Car Park and collect any bonus pot!", action: { type: "moveTo", tileId: 20 } },
        { title: "School Run Rush", text: "Advance straight to Twynham School (Dark Blue)! Collect £200 if passing GO.", action: { type: "moveTo", tileId: 39 } },
        { title: "Priory Morning", text: "Advance to Christchurch Quay & Priory GO and collect £200.", action: { type: "moveTo", tileId: 0 } },
        { title: "Mudeford Crabbing Win", text: "You win the Mudeford Quay crabbing contest! Collect £120.", action: { type: "money", amount: 120 } },
        { title: "Coastal Gale Repair", text: "Seafront storm repairs: pay £25 per house and £100 per hotel.", action: { type: "repairs", perHouse: 25, perHotel: 100 } },
        { title: "Speeding on Bargates", text: "Fined £60 for rushing through Bargates. Paid to Hengistbury Pot.", action: { type: "payPot", amount: 60 } },
        { title: "Free Ferry Ticket", text: "Take a quick trip back 3 spaces to inspect coastal routes.", action: { type: "moveRel", steps: -3 } },
        { title: "BCP Civic Inspection", text: "Go directly to BCP Civic Detention. Do not collect £200.", action: { type: "gotoJail" } },
        { title: "Get Out of Detention Free", text: "Keep this card. Use it to leave BCP Civic Detention without paying.", action: { type: "getOutJail" } }
      ];

      const CHEST_CARDS = [
        { title: "BCP Council Grant", text: "Community grant approved! Collect £150 from the bank.", action: { type: "money", amount: 150 } },
        { title: "Stanpit Marsh Clean-Up", text: "Volunteer conservation reward! Collect £75.", action: { type: "money", amount: 75 } },
        { title: "Beach Hut Permit", text: "Pay £50 coastal permit fee to Hengistbury Pot.", action: { type: "payPot", amount: 50 } },
        { title: "Twynham Alumni Gala", text: "Charity gala at Twynham School! Collect £50 from each other player.", action: { type: "fromEach", amount: 50 } },
        { title: "Cream Tea at The Quomps", text: "Treat everyone to tea by the river: pay £30 to each other player.", action: { type: "toEach", amount: 30 } },
        { title: "Harbour Mooring Refund", text: "Overcharged mooring fee refunded! Collect £100.", action: { type: "money", amount: 100 } },
        { title: "School Term Books", text: "Pay £80 for textbooks and lab supplies.", action: { type: "money", amount: -80 } },
        { title: "Return to Purewell", text: "Head back to Purewell High Street for a quick coffee.", action: { type: "moveTo", tileId: 1 } },
        { title: "Get Out of Detention Free", text: "Keep this card. Use it to leave BCP Civic Detention without paying.", action: { type: "getOutJail" } }
      ];

      // =========================================================================
      // 3. THREE.JS SCENE, BOARD, VISUAL BUILDINGS & CHARACTER MODELS
      // =========================================================================
      const MAP_THEMES = {
        christchurch: { label: "Christchurch Quay", sky: 0x071829, fog: 0x071829, trim: 0xd97706, slab: 0x0f253b, sea: 0xffffff, accent: 0x38bdf8, ground: 0x1d5636 },
        bournemouth: { label: "Bournemouth Seafront", sky: 0x103047, fog: 0x103047, trim: 0xf0b34c, slab: 0x18384b, sea: 0xc5efff, accent: 0xffb86b, ground: 0x2b6945 },
        poole: { label: "Poole Harbour", sky: 0x09243a, fog: 0x09243a, trim: 0x62bdc2, slab: 0x103349, sea: 0x9cdeea, accent: 0x77e0d0, ground: 0x245744 }
      };
      let activeMapId = "christchurch";
      const canvas = document.getElementById("board-canvas");
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x071829);
      scene.fog = new THREE.FogExp2(0x071829, 0.0042);

      const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.2, 360);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.16;

      const hemiLight = new THREE.HemisphereLight(0xcbe5ff, 0x1b4332, 1.0);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xfff5e4, 1.75);
      dirLight.position.set(30, 52, 28);
      dirLight.castShadow = true;
      dirLight.shadow.mapSize.set(2048, 2048);
      dirLight.shadow.camera.near = 6;
      dirLight.shadow.camera.far = 150;
      dirLight.shadow.bias = -0.0005;
      const sc = 38;
      dirLight.shadow.camera.left = -sc;
      dirLight.shadow.camera.right = sc;
      dirLight.shadow.camera.top = sc;
      dirLight.shadow.camera.bottom = -sc;
      scene.add(dirLight);

      const rimAccentLight = new THREE.PointLight(0x38bdf8, 1.2, 42);
      rimAccentLight.position.set(16, 8, 16);
      scene.add(rimAccentLight);

      // Harbour & coastal sea plane with procedural ripples & tangent-space normal map
      const seaMesh = new THREE.Mesh(
        new THREE.CircleGeometry(180, 72),
        new THREE.MeshStandardMaterial({
          map: PBRTextures.water.map,
          normalMap: PBRTextures.water.normalMap,
          normalScale: new THREE.Vector2(0.58, 0.58),
          roughnessMap: PBRTextures.water.roughnessMap,
          roughness: 0.24,
          metalness: 0.42
        })
      );
      seaMesh.rotation.x = -Math.PI / 2;
      seaMesh.position.y = -0.75;
      seaMesh.receiveShadow = true;
      scene.add(seaMesh);

      // Board base slab with bevelled trim
      const BOARD_SIZE = 34;
      const TILE_SIZE = 3.0;
      const boardGroup = new THREE.Group();
      scene.add(boardGroup);

      const slabMesh = new THREE.Mesh(
        new THREE.BoxGeometry(BOARD_SIZE + 2.4, 0.9, BOARD_SIZE + 2.4),
        new THREE.MeshStandardMaterial({
          color: 0x0f253b,
          map: PBRTextures.slab.map,
          bumpMap: PBRTextures.slab.bumpMap,
          bumpScale: 0.04,
          roughnessMap: PBRTextures.slab.roughnessMap,
          roughness: 0.55,
          metalness: 0.28
        })
      );
      slabMesh.position.y = -0.4;
      slabMesh.receiveShadow = true;
      slabMesh.castShadow = true;
      boardGroup.add(slabMesh);

      const brassTrim = new THREE.Mesh(
        new THREE.BoxGeometry(BOARD_SIZE + 2.55, 0.14, BOARD_SIZE + 2.55),
        new THREE.MeshStandardMaterial({
          color: 0xd97706,
          map: PBRTextures.brass.map,
          bumpMap: PBRTextures.brass.bumpMap,
          bumpScale: 0.02,
          roughnessMap: PBRTextures.brass.roughnessMap,
          roughness: 0.34,
          metalness: 0.74
        })
      );
      brassTrim.position.y = 0.04;
      boardGroup.add(brassTrim);

      const innerLawn = new THREE.Mesh(
        new THREE.BoxGeometry(BOARD_SIZE - TILE_SIZE * 1.85, 0.28, BOARD_SIZE - TILE_SIZE * 1.85),
        new THREE.MeshStandardMaterial({
          map: PBRTextures.turf.map,
          bumpMap: PBRTextures.turf.bumpMap,
          bumpScale: 0.045,
          roughnessMap: PBRTextures.turf.roughnessMap,
          roughness: 0.85,
          metalness: 0.04
        })
      );
      innerLawn.position.y = 0.09;
      innerLawn.receiveShadow = true;
      boardGroup.add(innerLawn);

      // Decorative courtyard walkways & fountain basin
      const pathMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        map: PBRTextures.paving.map,
        bumpMap: PBRTextures.paving.bumpMap,
        bumpScale: 0.045,
        roughnessMap: PBRTextures.paving.roughnessMap,
        roughness: 0.78
      });
      const pathGeo = new THREE.BoxGeometry(1.4, 0.05, BOARD_SIZE - TILE_SIZE * 2.2);
      const pathNS = new THREE.Mesh(pathGeo, pathMat);
      pathNS.position.y = 0.24;
      pathNS.receiveShadow = true;
      boardGroup.add(pathNS);

      const pathEW = new THREE.Mesh(pathGeo, pathMat);
      pathEW.rotation.y = Math.PI / 2;
      pathEW.position.y = 0.24;
      pathEW.receiveShadow = true;
      boardGroup.add(pathEW);

      const fountainBasin = new THREE.Mesh(
        new THREE.CylinderGeometry(2.1, 2.35, 0.45, 24),
        new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          map: PBRTextures.paving.map,
          bumpMap: PBRTextures.paving.bumpMap,
          bumpScale: 0.04,
          roughness: 0.58
        })
      );
      fountainBasin.position.set(0, 0.42, 0);
      fountainBasin.castShadow = true;
      fountainBasin.receiveShadow = true;
      boardGroup.add(fountainBasin);

      const fountainWater = new THREE.Mesh(
        new THREE.CylinderGeometry(1.82, 1.82, 0.1, 24),
        new THREE.MeshStandardMaterial({
          color: 0x7dd3fc,
          map: PBRTextures.fountainWater.map,
          normalMap: PBRTextures.fountainWater.normalMap,
          normalScale: new THREE.Vector2(0.5, 0.5),
          roughness: 0.14,
          metalness: 0.32
        })
      );
      fountainWater.position.set(0, 0.63, 0);
      boardGroup.add(fountainWater);

      // Compute 3D world position for tile index 0..39 around perimeter
      function getTileWorldPos(index) {
        const half = BOARD_SIZE * 0.5 - TILE_SIZE * 0.5;
        if (index >= 0 && index <= 10) {
          const t = index / 10;
          return new THREE.Vector3(half - t * (BOARD_SIZE - TILE_SIZE), 0.16, half);
        }
        if (index > 10 && index <= 20) {
          const t = (index - 10) / 10;
          return new THREE.Vector3(-half, 0.16, half - t * (BOARD_SIZE - TILE_SIZE));
        }
        if (index > 20 && index <= 30) {
          const t = (index - 20) / 10;
          return new THREE.Vector3(-half + t * (BOARD_SIZE - TILE_SIZE), 0.16, -half);
        }
        const t = (index - 30) / 10;
        return new THREE.Vector3(half, 0.16, -half + t * (BOARD_SIZE - TILE_SIZE));
      }

      // Create crisp high-DPI canvas texture for each tile face
      function makeTileTexture(tile) {
        const c = document.createElement("canvas");
        c.width = 512;
        c.height = 512;
        const ctx = c.getContext("2d");

        const isTwynham = tile.id === 39;
        const bgGrad = ctx.createLinearGradient(0, 0, 512, 512);
        if (isTwynham) {
          bgGrad.addColorStop(0, "#eff6ff");
          bgGrad.addColorStop(0.55, "#dbeafe");
          bgGrad.addColorStop(1, "#bfdbfe");
        } else if (tile.type === "go") {
          bgGrad.addColorStop(0, "#fffbeb");
          bgGrad.addColorStop(1, "#dcfce7");
        } else if (tile.type === "chance") {
          bgGrad.addColorStop(0, "#f0f9ff");
          bgGrad.addColorStop(1, "#e0f2fe");
        } else if (tile.type === "chest") {
          bgGrad.addColorStop(0, "#fefce8");
          bgGrad.addColorStop(1, "#fef3c7");
        } else {
          bgGrad.addColorStop(0, "#fdfcf9");
          bgGrad.addColorStop(1, "#eaeff4");
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 512, 512);

        // Subtle cardstock grain dots
        let seed = (tile.id + 1) * 7919;
        const rand = () => {
          seed = (seed * 16807) % 2147483647;
          return (seed - 1) / 2147483646;
        };
        for (let i = 0; i < 650; i++) {
          ctx.fillStyle = rand() > 0.5 ? "rgba(15,23,42,0.025)" : "rgba(255,255,255,0.22)";
          ctx.fillRect(rand() * 512, rand() * 512, 2, 2);
        }

        // Outer border & inner hairline frame
        ctx.strokeStyle = isTwynham ? "#1e3a8a" : "#64748b";
        ctx.lineWidth = isTwynham ? 18 : 11;
        ctx.strokeRect(8, 8, 496, 496);
        ctx.strokeStyle = isTwynham ? "#eab308" : "rgba(15, 23, 42, 0.16)";
        ctx.lineWidth = isTwynham ? 4 : 2;
        ctx.strokeRect(20, 20, 472, 472);

        function wrapTileTitle(text, maxChars = 15) {
          const words = text.split(" ");
          const out = [];
          let cur = "";
          for (const w of words) {
            const test = cur ? `${cur} ${w}` : w;
            if (test.length > maxChars && cur) {
              out.push(cur);
              cur = w;
            } else {
              cur = test;
            }
          }
          if (cur) out.push(cur);
          return out;
        }

        // Corner & special tile illustrations
        if (tile.type === "go") {
          ctx.fillStyle = "#b91c1c";
          ctx.font = "900 128px Fredoka, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("GO", 256, 205);

          // Sweeping arrow
          ctx.fillStyle = "#dc2626";
          ctx.beginPath();
          ctx.moveTo(410, 315);
          ctx.lineTo(170, 315);
          ctx.lineTo(170, 282);
          ctx.lineTo(92, 336);
          ctx.lineTo(170, 390);
          ctx.lineTo(170, 357);
          ctx.lineTo(410, 357);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = "#facc15";
          ctx.lineWidth = 4;
          ctx.stroke();

          ctx.fillStyle = "#065f46";
          ctx.font = "bold 32px Inter, sans-serif";
          ctx.fillText("COLLECT £200", 256, 256);
          ctx.fillStyle = "#334155";
          ctx.font = "bold 24px Inter, sans-serif";
          ctx.fillText("CHRISTCHURCH QUAY", 256, 448);
        } else if (tile.type === "jail") {
          // Orange inner cell block
          ctx.fillStyle = "#f97316";
          ctx.fillRect(156, 44, 312, 312);
          ctx.strokeStyle = "#0f172a";
          ctx.lineWidth = 8;
          ctx.strokeRect(156, 44, 312, 312);
          // Prison bars
          ctx.fillStyle = "#1e293b";
          for (let bx = 196; bx <= 428; bx += 46) {
            ctx.fillRect(bx, 60, 12, 224);
          }
          ctx.fillRect(184, 158, 256, 12);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 30px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("DETENTION", 312, 326);

          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 30px Fredoka, sans-serif";
          ctx.fillText("JUST VISITING", 256, 446);
        } else if (tile.type === "parking") {
          ctx.fillStyle = "#0284c7";
          ctx.beginPath();
          ctx.arc(256, 210, 102, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#facc15";
          ctx.lineWidth = 8;
          ctx.stroke();

          // Cliff & wave emblem
          ctx.fillStyle = "#fef08a";
          ctx.beginPath();
          ctx.moveTo(176, 245);
          ctx.lineTo(232, 162);
          ctx.lineTo(290, 198);
          ctx.lineTo(336, 245);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 46px Fredoka, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("P", 256, 168);

          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 34px Fredoka, sans-serif";
          ctx.fillText("HENGISTBURY", 256, 368);
          ctx.fillStyle = "#0369a1";
          ctx.font = "bold 30px Inter, sans-serif";
          ctx.fillText("FREE PARKING", 256, 422);
        } else if (tile.type === "gotojail") {
          ctx.fillStyle = "#991b1b";
          ctx.beginPath();
          ctx.arc(256, 210, 96, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 7;
          ctx.stroke();

          ctx.fillStyle = "#fef2f2";
          ctx.font = "bold 88px Fredoka, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("!", 256, 242);

          ctx.fillStyle = "#7f1d1d";
          ctx.font = "bold 38px Fredoka, sans-serif";
          ctx.fillText("SENT TO BCP", 256, 368);
          ctx.fillText("DETENTION!", 256, 418);
        } else {
          // Top header banner for standard tiles
          if (tile.group && COLOR_SETS[tile.group]) {
            const hex = COLOR_SETS[tile.group].hex;
            const hGrad = ctx.createLinearGradient(0, 16, 0, 130);
            hGrad.addColorStop(0, hex);
            hGrad.addColorStop(1, hex);
            ctx.fillStyle = hGrad;
            ctx.fillRect(16, 16, 480, 112);
            ctx.fillStyle = "rgba(255,255,255,0.28)";
            ctx.fillRect(16, 16, 480, 22);
            ctx.fillStyle = "rgba(15,23,42,0.22)";
            ctx.fillRect(16, 120, 480, 8);
            if (isTwynham) {
              ctx.fillStyle = "#facc15";
              ctx.font = "bold 22px Inter, sans-serif";
              ctx.textAlign = "center";
              ctx.fillText("★ FLAGSHIP LANDMARK ★", 256, 84);
            }
          } else if (tile.type === "station") {
            ctx.fillStyle = "#0f172a";
            ctx.fillRect(16, 16, 480, 84);
            ctx.fillStyle = "#38bdf8";
            ctx.font = "bold 30px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("BCP TRANSIT", 256, 69);
          } else if (tile.type === "utility") {
            ctx.fillStyle = "#0369a1";
            ctx.fillRect(16, 16, 480, 84);
            ctx.fillStyle = "#e0f2fe";
            ctx.font = "bold 30px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("BCP UTILITY", 256, 69);
          } else if (tile.type === "chance") {
            ctx.fillStyle = "#0284c7";
            ctx.fillRect(16, 16, 480, 84);
            ctx.fillStyle = "#fef08a";
            ctx.font = "bold 30px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("BCP CHANCE", 256, 69);
          } else if (tile.type === "chest") {
            ctx.fillStyle = "#b45309";
            ctx.fillRect(16, 16, 480, 84);
            ctx.fillStyle = "#fef3c7";
            ctx.font = "bold 27px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("COMMUNITY CHEST", 256, 69);
          } else if (tile.type === "tax") {
            ctx.fillStyle = "#991b1b";
            ctx.fillRect(16, 16, 480, 84);
            ctx.fillStyle = "#fee2e2";
            ctx.font = "bold 30px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("BCP CIVIC TAX", 256, 69);
          }

          // Center emblem icons for non-property tiles
          if (tile.type === "chance") {
            ctx.fillStyle = "rgba(14, 165, 233, 0.14)";
            ctx.beginPath();
            ctx.arc(256, 290, 96, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#0284c7";
            ctx.font = "900 185px Fredoka, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("?", 256, 355);
          } else if (tile.type === "chest") {
            // Treasure chest illustration
            ctx.fillStyle = "#d97706";
            ctx.fillRect(166, 240, 180, 112);
            ctx.fillStyle = "#92400e";
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(156, 198, 200, 56, 22) : ctx.fillRect(156, 198, 200, 56);
            ctx.fill();
            ctx.fillStyle = "#facc15";
            ctx.fillRect(166, 246, 180, 14);
            ctx.fillRect(240, 232, 32, 42);
            ctx.strokeStyle = "#451a03";
            ctx.lineWidth = 6;
            ctx.strokeRect(166, 240, 180, 112);
          } else if (tile.type === "station") {
            ctx.fillStyle = "#1e293b";
            if (tile.id === 35) {
              // Plane silhouette
              ctx.beginPath();
              ctx.moveTo(256, 250);
              ctx.lineTo(356, 324);
              ctx.lineTo(356, 346);
              ctx.lineTo(272, 316);
              ctx.lineTo(272, 368);
              ctx.lineTo(304, 390);
              ctx.lineTo(256, 382);
              ctx.lineTo(208, 390);
              ctx.lineTo(240, 368);
              ctx.lineTo(240, 316);
              ctx.lineTo(156, 346);
              ctx.lineTo(156, 324);
              ctx.closePath();
              ctx.fill();
            } else if (tile.id === 25) {
              // Ferry hull & funnel
              ctx.fillRect(216, 260, 26, 36);
              ctx.fillRect(184, 290, 144, 34);
              ctx.beginPath();
              ctx.moveTo(156, 324);
              ctx.lineTo(356, 324);
              ctx.lineTo(330, 368);
              ctx.lineTo(182, 368);
              ctx.closePath();
              ctx.fill();
            } else {
              // Classic locomotive front
              ctx.fillRect(192, 264, 128, 96);
              ctx.fillStyle = "#38bdf8";
              ctx.fillRect(214, 282, 84, 36);
              ctx.fillStyle = "#facc15";
              ctx.beginPath();
              ctx.arc(220, 340, 10, 0, Math.PI * 2);
              ctx.arc(292, 340, 10, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (tile.type === "utility") {
            if (tile.id === 12) {
              // Water droplet
              ctx.fillStyle = "#0284c7";
              ctx.beginPath();
              ctx.moveTo(256, 248);
              ctx.quadraticCurveTo(324, 325, 256, 384);
              ctx.quadraticCurveTo(188, 325, 256, 248);
              ctx.fill();
              ctx.fillStyle = "rgba(255,255,255,0.45)";
              ctx.beginPath();
              ctx.arc(240, 336, 14, 0, Math.PI * 2);
              ctx.fill();
            } else {
              // Lightning bolt
              ctx.fillStyle = "#eab308";
              ctx.beginPath();
              ctx.moveTo(272, 246);
              ctx.lineTo(212, 322);
              ctx.lineTo(256, 322);
              ctx.lineTo(234, 390);
              ctx.lineTo(304, 306);
              ctx.lineTo(258, 306);
              ctx.closePath();
              ctx.fill();
              ctx.strokeStyle = "#854d0e";
              ctx.lineWidth = 4;
              ctx.stroke();
            }
          } else if (tile.type === "tax") {
            ctx.fillStyle = "#f59e0b";
            ctx.beginPath();
            ctx.arc(256, 315, 52, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#b45309";
            ctx.lineWidth = 6;
            ctx.stroke();
            ctx.fillStyle = "#fffbeb";
            ctx.font = "bold 54px Fredoka, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("£", 256, 334);
          }

          // Title text
          if (tile.type !== "chance" && tile.type !== "chest") {
            ctx.fillStyle = "#0f172a";
            ctx.font = isTwynham ? "bold 44px Fredoka, sans-serif" : "bold 38px Fredoka, sans-serif";
            ctx.textAlign = "center";
            const lines = wrapTileTitle(tile.name, 15);
            let y = tile.group ? 186 : 158;
            for (const line of lines.slice(0, 3)) {
              ctx.fillText(line, 256, y);
              y += 46;
            }
            if (tile.group && tile.area) {
              ctx.fillStyle = "#475569";
              ctx.font = "600 22px Inter, sans-serif";
              ctx.fillText(tile.area.toUpperCase(), 256, Math.min(365, y + 12));
            }
          }

          if (tile.price) {
            ctx.fillStyle = isTwynham ? "rgba(30,58,138,0.1)" : "rgba(4,120,87,0.09)";
            ctx.fillRect(126, 404, 260, 62);
            ctx.fillStyle = isTwynham ? "#1e3a8a" : "#047857";
            ctx.font = "bold 42px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`£${tile.price}`, 256, 450);
          } else if (tile.amount) {
            ctx.fillStyle = "rgba(185,28,28,0.1)";
            ctx.fillRect(116, 404, 280, 62);
            ctx.fillStyle = "#b91c1c";
            ctx.font = "bold 38px Inter, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`PAY £${tile.amount}`, 256, 449);
          }
        }

        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = 8;
        return tex;
      }

      const tileMeshes = [];
      const tileOwnerRings = [];
      const tileBuildingGroups = [];
      let twynhamCrestMesh = null;

      BOARD_TILES.forEach((tile) => {
        const pos = getTileWorldPos(tile.id);
        const isCorner = tile.id % 10 === 0;
        const w = isCorner ? TILE_SIZE * 1.18 : TILE_SIZE * 0.94;
        const d = isCorner ? TILE_SIZE * 1.18 : TILE_SIZE * 0.94;

        const topMat = new THREE.MeshStandardMaterial({
          map: makeTileTexture(tile),
          bumpMap: PBRTextures.cardstock.bumpMap,
          bumpScale: 0.015,
          roughnessMap: PBRTextures.cardstock.roughnessMap,
          roughness: 0.52,
          metalness: 0.04
        });
        const sideMat = new THREE.MeshStandardMaterial({
          color: tile.id === 39 ? 0x1e3a8a : 0xdbe3ec,
          map: PBRTextures.slab.map,
          bumpMap: PBRTextures.slab.bumpMap,
          bumpScale: 0.02,
          roughness: 0.58
        });

        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.24, d), [
          sideMat, sideMat, topMat, sideMat, sideMat, sideMat
        ]);
        mesh.position.copy(pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { tileId: tile.id };
        boardGroup.add(mesh);
        tileMeshes.push(mesh);

        // Owner ring indicator on tile
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.68, 0.86, 24),
          new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, visible: false })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(pos.x, pos.y + 0.13, pos.z);
        boardGroup.add(ring);
        tileOwnerRings.push(ring);

        // Houses/Hotel container
        const bGroup = new THREE.Group();
        bGroup.position.set(pos.x, pos.y + 0.12, pos.z);
        boardGroup.add(bGroup);
        tileBuildingGroups.push(bGroup);

        // Special 3D visual-only landmark for Twynham School (Dark Blue #39)
        if (tile.id === 39) {
          const schoolBuilding = new THREE.Group();
          schoolBuilding.position.set(pos.x - 1.5, pos.y + 0.12, pos.z);

          const schoolFacade = PBRTextures.createFacadeTexture("#1e3a8a", "#93c5fd", "school");
          const mainHall = new THREE.Mesh(
            new THREE.BoxGeometry(1.45, 1.5, 2.25),
            new THREE.MeshStandardMaterial({
              map: schoolFacade.map,
              bumpMap: schoolFacade.bumpMap,
              bumpScale: 0.035,
              roughnessMap: schoolFacade.roughnessMap,
              roughness: 0.48,
              metalness: 0.2
            })
          );
          mainHall.position.y = 0.75;
          mainHall.castShadow = true;
          mainHall.receiveShadow = true;
          schoolBuilding.add(mainHall);

          const towerFacade = PBRTextures.createFacadeTexture("#172554", "#facc15", "school");
          const towerBodyMat = new THREE.MeshStandardMaterial({
            map: towerFacade.map,
            bumpMap: towerFacade.bumpMap,
            bumpScale: 0.03,
            roughnessMap: towerFacade.roughnessMap,
            roughness: 0.45,
            metalness: 0.25
          });
          const clockFaceMat = new THREE.MeshStandardMaterial({
            map: PBRTextures.clockFace,
            roughness: 0.3,
            metalness: 0.25
          });
          const clockTower = new THREE.Mesh(
            new THREE.BoxGeometry(0.65, 2.1, 0.65),
            [clockFaceMat, towerBodyMat, towerBodyMat, towerBodyMat, clockFaceMat, towerBodyMat]
          );
          clockTower.position.set(0.25, 1.05, 0.75);
          clockTower.castShadow = true;
          schoolBuilding.add(clockTower);

          const schoolRoof = PBRTextures.createRoofTextures("#0ea5e9");
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(1.42, 0.85, 4),
            new THREE.MeshStandardMaterial({
              map: schoolRoof.map,
              bumpMap: schoolRoof.bumpMap,
              bumpScale: 0.035,
              roughness: 0.38,
              metalness: 0.18
            })
          );
          roof.position.y = 1.92;
          roof.rotation.y = Math.PI / 4;
          roof.castShadow = true;
          schoolBuilding.add(roof);

          twynhamCrestMesh = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.4, 0),
            new THREE.MeshStandardMaterial({
              color: 0xfacc15,
              emissive: 0xca8a04,
              emissiveIntensity: 0.55,
              roughness: 0.2,
              metalness: 0.65
            })
          );
          twynhamCrestMesh.position.y = 2.75;
          twynhamCrestMesh.castShadow = true;
          schoolBuilding.add(twynhamCrestMesh);

          boardGroup.add(schoolBuilding);
        }
      });

      // The center scenery changes with the selected local map; tile rules stay the same.
      let townSceneryGroup = null;
      function addSceneryMesh(group, geometry, color, position, options = {}) {
        const material = new THREE.MeshStandardMaterial({
          color,
          map: options.map || null,
          bumpMap: options.bumpMap || null,
          bumpScale: options.bumpScale ?? 0.03,
          roughnessMap: options.roughnessMap || null,
          normalMap: options.normalMap || null,
          roughness: options.roughness ?? 0.62,
          metalness: options.metalness ?? 0.08,
          emissive: options.emissive ?? 0x000000,
          emissiveIntensity: options.emissiveIntensity ?? 0
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position[0], position[1], position[2]);
        mesh.castShadow = options.castShadow !== false;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
      }

      function addPalmTree(group, x, z, leafColor = 0x238c68) {
        const palmBark = PBRTextures.createWoodTextures("#9a683d");
        const trunk = addSceneryMesh(group, new THREE.CylinderGeometry(0.12, 0.22, 2.5, 9), 0xffffff, [x, 1.25, z], {
          map: palmBark.map,
          bumpMap: palmBark.bumpMap,
          roughness: 0.85
        });
        trunk.rotation.z = x < 0 ? -0.08 : 0.08;
        for (let i = 0; i < 7; i++) {
          const frond = addSceneryMesh(
            group,
            new THREE.ConeGeometry(0.28, 1.7, 5),
            leafColor,
            [x + Math.cos(i * 0.9) * 0.52, 2.45, z + Math.sin(i * 0.9) * 0.52],
            { map: PBRTextures.foliage.map, bumpMap: PBRTextures.foliage.bumpMap, roughness: 0.72 }
          );
          frond.rotation.z = Math.cos(i * 0.9) * 0.95;
          frond.rotation.x = Math.sin(i * 0.9) * 0.95;
        }
      }

      function buildDecorativeTownScenery(mapId = activeMapId) {
        if (townSceneryGroup) {
          boardGroup.remove(townSceneryGroup);
          townSceneryGroup.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach((mat) => {
                for (const key of ["map", "bumpMap", "normalMap", "roughnessMap"]) {
                  if (mat[key] && !mat[key].userData?.shared) mat[key].dispose();
                }
                mat.dispose();
              });
            }
          });
        }
        const group = new THREE.Group();
        townSceneryGroup = group;
        const districtSets = {
          christchurch: [
            [-7.1, -6.8, 3.0, 3.4, 2.8, "#c5a981", "#684b36"], [7.0, -6.6, 2.8, 2.7, 2.8, "#d5c29c", "#803c2b"],
            [-7.0, 6.8, 2.8, 2.2, 2.6, "#c7b38e", "#80563a"], [7.0, 6.7, 2.9, 2.8, 2.8, "#d6c09b", "#634a38"]
          ],
          bournemouth: [
            [-7.1, -6.8, 3.2, 3.8, 2.8, "#f0d7ae", "#984d3d"], [7.0, -6.6, 3.0, 3.0, 2.8, "#f5e5c4", "#3b7080"],
            [-7.0, 6.8, 3.0, 2.8, 2.6, "#fff0cf", "#d06d4c"], [7.0, 6.7, 3.0, 3.2, 2.8, "#e8d0b6", "#406e87"]
          ],
          poole: [
            [-7.1, -6.8, 3.2, 3.0, 2.8, "#d7c39b", "#69533b"], [7.0, -6.6, 3.0, 3.4, 2.8, "#d7e0d0", "#536c71"],
            [-7.0, 6.8, 2.8, 2.5, 2.6, "#c8b994", "#7a5740"], [7.0, 6.7, 3.0, 3.1, 2.8, "#dbe2d5", "#536c71"]
          ]
        };
        for (const [x, z, w, h, d, facade, roofHex] of districtSets[mapId] || districtSets.christchurch) {
          const facadeTex = PBRTextures.createFacadeTexture(facade);
          addSceneryMesh(group, new THREE.BoxGeometry(w, h, d), 0xffffff, [x, 0.22 + h / 2, z], {
            map: facadeTex.map,
            bumpMap: facadeTex.bumpMap,
            bumpScale: 0.035,
            roughnessMap: facadeTex.roughnessMap,
            roughness: 0.67
          });
          const roofTex = PBRTextures.createRoofTextures(roofHex);
          addSceneryMesh(group, new THREE.BoxGeometry(w + 0.28, 0.28, d + 0.28), 0xffffff, [x, 0.36 + h, z], {
            map: roofTex.map,
            bumpMap: roofTex.bumpMap,
            bumpScale: 0.035,
            roughness: 0.52
          });
          for (let win = -1; win <= 1; win++) {
            addSceneryMesh(group, new THREE.BoxGeometry(0.34, 0.48, 0.04), 0x9ed9eb, [x + win * 0.72, 0.95 + h * 0.42, z + d / 2 + 0.025], {
              emissive: 0x154457,
              emissiveIntensity: 0.22,
              roughness: 0.15,
              metalness: 0.2
            });
          }
        }

        if (mapId === "christchurch") {
          // Christchurch Priory: Purbeck ashlar limestone, slate nave roof, buttresses & tower.
          const prioryTex = PBRTextures.prioryStone;
          const prioryRoof = PBRTextures.createRoofTextures("#4b5b52");
          addSceneryMesh(group, new THREE.BoxGeometry(5.8, 1.8, 2.5), 0xffffff, [0, 1.15, -5.1], {
            map: prioryTex.map,
            bumpMap: prioryTex.bumpMap,
            bumpScale: 0.04,
            roughnessMap: prioryTex.roughnessMap,
            roughness: 0.72
          });
          const naveRoof = addSceneryMesh(group, new THREE.ConeGeometry(2.3, 1.2, 4), 0xffffff, [0, 2.65, -5.1], {
            map: prioryRoof.map,
            bumpMap: prioryRoof.bumpMap,
            bumpScale: 0.04,
            roughness: 0.55
          });
          naveRoof.rotation.y = Math.PI / 4;
          addSceneryMesh(group, new THREE.BoxGeometry(1.18, 3.5, 1.25), 0xe6dac5, [-2.25, 1.95, -5.1], {
            map: prioryTex.map,
            bumpMap: prioryTex.bumpMap,
            bumpScale: 0.04,
            roughnessMap: prioryTex.roughnessMap,
            roughness: 0.72
          });
          addSceneryMesh(group, new THREE.ConeGeometry(0.9, 1.6, 4), 0x8ea8a6, [-2.25, 4.4, -5.1], {
            map: prioryRoof.map,
            bumpMap: prioryRoof.bumpMap,
            roughness: 0.48
          });
          for (let i = -2; i <= 2; i++) {
            addSceneryMesh(group, new THREE.BoxGeometry(0.16, 0.58, 0.05), 0x68b8d1, [i * 0.9, 1.25, -3.82], {
              emissive: 0x0e7490,
              emissiveIntensity: 0.28,
              roughness: 0.18
            });
          }
          const trunkTex = PBRTextures.createWoodTextures("#5a4029");
          for (const [x, z] of [[-5.7, 1.2], [5.8, -1.5], [-5.8, -2.2], [5.5, 2.0]]) {
            addSceneryMesh(group, new THREE.CylinderGeometry(0.07, 0.08, 2.2, 8), 0xffffff, [x, 1.3, z], {
              map: trunkTex.map,
              bumpMap: trunkTex.bumpMap,
              roughness: 0.85
            });
            const crown = addSceneryMesh(group, new THREE.SphereGeometry(0.8, 11, 9), 0x3b8e61, [x, 2.6, z], {
              map: PBRTextures.foliage.map,
              bumpMap: PBRTextures.foliage.bumpMap,
              bumpScale: 0.04,
              roughness: 0.78
            });
            crown.scale.y = 1.25;
          }
        } else if (mapId === "bournemouth") {
          // Pier timber planking, weathered pilings, golden rippled beach & seafront wheel.
          const pierWood = PBRTextures.createWoodTextures("#9b6241");
          const pilingWood = PBRTextures.createWoodTextures("#70513e");
          addSceneryMesh(group, new THREE.BoxGeometry(9.0, 0.34, 1.15), 0xffffff, [0, 0.68, -5.6], {
            map: pierWood.map,
            bumpMap: pierWood.bumpMap,
            bumpScale: 0.04,
            roughness: 0.74
          });
          for (let x = -4; x <= 4; x += 1.35) {
            addSceneryMesh(group, new THREE.CylinderGeometry(0.09, 0.13, 1.25, 7), 0xffffff, [x, 0.18, -5.6], {
              map: pilingWood.map,
              bumpMap: pilingWood.bumpMap,
              roughness: 0.82
            });
          }
          const wheel = addSceneryMesh(group, new THREE.TorusGeometry(1.55, 0.12, 8, 32), 0xf2bd62, [4.6, 2.55, -5.35], {
            map: PBRTextures.brass.map,
            metalness: 0.62,
            roughness: 0.28,
            emissive: 0x684014,
            emissiveIntensity: 0.18
          });
          wheel.rotation.y = Math.PI / 2;
          addSceneryMesh(group, new THREE.CylinderGeometry(0.14, 0.14, 3.2, 12), 0x73513e, [4.6, 1.25, -5.35], {
            map: PBRTextures.brass.map,
            metalness: 0.5
          });
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            const spoke = addSceneryMesh(group, new THREE.CylinderGeometry(0.035, 0.035, 3.0, 6), 0xffe7a4, [4.6 + Math.sin(a) * 0.7, 2.55 + Math.cos(a) * 0.7, -5.35], {
              castShadow: false,
              metalness: 0.55
            });
            spoke.rotation.z = -a;
          }
          addPalmTree(group, -4.8, -1.8);
          addPalmTree(group, 6.0, 1.5);
          addSceneryMesh(group, new THREE.BoxGeometry(10.5, 0.06, 1.7), 0xffffff, [0, 0.28, 5.9], {
            map: PBRTextures.sand.map,
            bumpMap: PBRTextures.sand.bumpMap,
            bumpScale: 0.045,
            roughness: 0.92,
            castShadow: false
          });
        } else {
          // Poole lighthouse masonry stripes, timber quay & stitched canvas sailboat.
          addSceneryMesh(group, new THREE.CylinderGeometry(0.78, 1.05, 3.3, 14), 0xffffff, [-4.6, 1.95, -5.3], {
            map: PBRTextures.lighthouse.map,
            bumpMap: PBRTextures.lighthouse.bumpMap,
            bumpScale: 0.035,
            roughness: 0.62
          });
          addSceneryMesh(group, new THREE.CylinderGeometry(0.83, 0.83, 0.45, 14), 0xd66b50, [-4.6, 3.72, -5.3], {
            map: PBRTextures.brass.map,
            roughness: 0.45
          });
          addSceneryMesh(group, new THREE.CylinderGeometry(0.42, 0.48, 0.8, 10), 0xffe08b, [-4.6, 4.28, -5.3], {
            emissive: 0xc88a21,
            emissiveIntensity: 0.72,
            roughness: 0.15
          });
          const capRoof = PBRTextures.createRoofTextures("#344c59");
          addSceneryMesh(group, new THREE.ConeGeometry(0.6, 0.55, 10), 0xffffff, [-4.6, 4.95, -5.3], {
            map: capRoof.map,
            bumpMap: capRoof.bumpMap
          });
          const quayWood = PBRTextures.createWoodTextures("#806344");
          addSceneryMesh(group, new THREE.BoxGeometry(7.0, 0.28, 1.2), 0xffffff, [3.5, 0.55, -5.8], {
            map: quayWood.map,
            bumpMap: quayWood.bumpMap,
            bumpScale: 0.04,
            roughness: 0.75
          });
          for (let x = 0.6; x <= 6.2; x += 1.4) {
            addSceneryMesh(group, new THREE.BoxGeometry(0.13, 1.0, 0.13), 0x513c2e, [x, 0.18, -5.8], {
              map: quayWood.map,
              bumpMap: quayWood.bumpMap
            });
          }
          const hullWood = PBRTextures.createBoatHullTextures("#f0eee2");
          addSceneryMesh(group, new THREE.BoxGeometry(2.0, 0.3, 0.75), 0xffffff, [2.0, 0.84, 2.7], {
            map: hullWood.map,
            roughness: 0.42
          });
          addSceneryMesh(group, new THREE.CylinderGeometry(0.045, 0.045, 2.5, 8), 0x493b31, [2.0, 2.05, 2.7], {
            map: quayWood.map
          });
          const sail = addSceneryMesh(group, new THREE.ConeGeometry(0.88, 1.9, 3), 0xffffff, [2.5, 2.05, 2.72], {
            map: PBRTextures.sail.map,
            roughness: 0.7
          });
          sail.rotation.z = -Math.PI / 2;
          addSceneryMesh(group, new THREE.BoxGeometry(9.0, 0.04, 1.05), 0x7dd3fc, [2.0, 0.27, 3.4], {
            map: PBRTextures.water.map,
            normalMap: PBRTextures.water.normalMap,
            roughness: 0.24,
            metalness: 0.42,
            castShadow: false
          });
        }
        boardGroup.add(group);
      }
      buildDecorativeTownScenery();

      function applyMapTheme(mapId) {
        activeMapId = MAP_THEMES[mapId] ? mapId : "christchurch";
        const theme = MAP_THEMES[activeMapId];
        slabMesh.material.color.setHex(theme.slab);
        brassTrim.material.color.setHex(theme.trim);
        innerLawn.material.color.setHex(theme.ground);
        buildDecorativeTownScenery(activeMapId);
        applySceneTheme(document.documentElement.dataset.theme || "dark");
      }

      function applySceneTheme(mode) {
        const map = MAP_THEMES[activeMapId];
        const light = mode === "light";
        scene.background.setHex(light ? 0xc5d4cf : map.sky);
        scene.fog.color.setHex(light ? 0xc5d4cf : map.fog);
        seaMesh.material.color.setHex(light ? 0xa6d1d1 : map.sea);
        rimAccentLight.color.setHex(light ? 0x4a9e8a : map.accent);
        renderer.toneMappingExposure = light ? 1.12 : 1.16;
      }
      window.addEventListener("koops-games-theme-change", (event) => applySceneTheme(event.detail.theme));
      applySceneTheme(document.documentElement.dataset.theme || "dark");

      // Animated harbour boats around the board
      const harbourBoats = [];
      const boatHullColors = ["#f8fafc", "#0284c7", "#eab308"];
      const boatCabinFacade = PBRTextures.createFacadeTexture("#e2e8f0", "#334155", "cabin");
      const boatDeckWood = PBRTextures.createWoodTextures("#b48352");
      for (let b = 0; b < 3; b++) {
        const boat = new THREE.Group();
        const hullTex = PBRTextures.createBoatHullTextures(boatHullColors[b]);
        const hullSideMat = new THREE.MeshStandardMaterial({
          map: hullTex.map,
          bumpMap: boatDeckWood.bumpMap,
          bumpScale: 0.02,
          roughness: 0.36
        });
        const hullDeckMat = new THREE.MeshStandardMaterial({
          map: boatDeckWood.map,
          bumpMap: boatDeckWood.bumpMap,
          bumpScale: 0.025,
          roughness: 0.55
        });
        const hull = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.45, 2.6),
          [hullSideMat, hullSideMat, hullDeckMat, hullSideMat, hullSideMat, hullSideMat]
        );
        hull.position.y = 0.2;
        hull.castShadow = true;
        boat.add(hull);

        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(0.75, 0.42, 1.1),
          new THREE.MeshStandardMaterial({
            map: boatCabinFacade.map,
            bumpMap: boatCabinFacade.bumpMap,
            bumpScale: 0.02,
            roughnessMap: boatCabinFacade.roughnessMap,
            roughness: 0.35
          })
        );
        cabin.position.set(0, 0.58, -0.15);
        boat.add(cabin);

        scene.add(boat);
        harbourBoats.push({
          mesh: boat,
          radius: 26 + b * 4.5,
          speed: (b % 2 === 0 ? 1 : -1) * (0.14 + b * 0.04),
          phase: b * 2.1
        });
      }

      // Animated 3D Dice with 6-face textured ivory resin & recessed pips
      const diceGroup = new THREE.Group();
      diceGroup.position.set(0, 1.25, 0);
      scene.add(diceGroup);

      function createDieMesh(offsetX) {
        const die = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 1.2, 1.2),
          PBRTextures.diceMaterials
        );
        die.position.set(offsetX, 0, 0);
        die.castShadow = true;
        die.receiveShadow = true;
        return die;
      }
      function setDieFaceRotation(dieMesh, value, spin = 0.2) {
        switch (value) {
          case 1: dieMesh.rotation.set(0, spin, 0); break;
          case 2: dieMesh.rotation.set(-Math.PI / 2, 0, spin); break;
          case 3: dieMesh.rotation.set(0, spin, Math.PI / 2); break;
          case 4: dieMesh.rotation.set(0, spin, -Math.PI / 2); break;
          case 5: dieMesh.rotation.set(Math.PI / 2, 0, spin); break;
          case 6: dieMesh.rotation.set(Math.PI, spin, 0); break;
          default: dieMesh.rotation.set(0, spin, 0);
        }
      }
      const die1Mesh = createDieMesh(-0.98);
      const die2Mesh = createDieMesh(0.98);
      diceGroup.add(die1Mesh, die2Mesh);

      // Enhanced multi-part 3D Character Model Builder with soft radial shadow disc
      function createCharacterMesh(style) {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({
          color: style.color,
          bumpMap: PBRTextures.tokenFinish.bumpMap,
          bumpScale: 0.015,
          roughness: 0.36,
          metalness: 0.22
        });
        const accentMat = new THREE.MeshStandardMaterial({
          color: style.accent,
          bumpMap: PBRTextures.tokenFinish.bumpMap,
          bumpScale: 0.012,
          roughness: 0.3,
          metalness: 0.28
        });

        const shadowDisc = new THREE.Mesh(
          new THREE.CircleGeometry(0.74, 24),
          new THREE.MeshBasicMaterial({
            map: PBRTextures.softShadow,
            transparent: true,
            depthWrite: false
          })
        );
        shadowDisc.rotation.x = -Math.PI / 2;
        shadowDisc.position.y = 0.02;
        g.add(shadowDisc);

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.62, 1.15, 18), bodyMat);
        base.position.y = 0.575;
        base.castShadow = true;
        base.receiveShadow = true;
        g.add(base);

        const collar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 10, 20), accentMat);
        collar.rotation.x = Math.PI / 2;
        collar.position.y = 1.14;
        g.add(collar);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 18), accentMat);
        head.position.y = 1.46;
        head.castShadow = true;
        g.add(head);

        if (style.id === "scholar") {
          const mortar = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.08, 0.78), bodyMat);
          mortar.position.y = 1.84;
          mortar.castShadow = true;
          g.add(mortar);
        } else if (style.id === "sailor" || style.id === "pilot") {
          const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 0.07, 16), bodyMat);
          brim.position.y = 1.76;
          brim.castShadow = true;
          g.add(brim);
        } else {
          const crest = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.48, 10), bodyMat);
          crest.position.y = 1.96;
          crest.castShadow = true;
          g.add(crest);
        }

        return g;
      }

      // =========================================================================
      // 4. GAME STATE, SETUP UI & CAMERA CONTROLLER
      // =========================================================================
      const game = {
        started: false,
        playerCount: 4,
        setupConfigs: [
          { name: "Player 1", isBot: false, teamId: "Alpha", charId: "scholar" },
          { name: "BCP Bot 2", isBot: true, teamId: "Beta", charId: "sailor" },
          { name: "Player 3", isBot: false, teamId: "Alpha", charId: "ranger" },
          { name: "BCP Bot 4", isBot: true, teamId: "Beta", charId: "pilot" }
        ],
        players: [],
        turnIndex: 0,
        hasRolled: false,
        isMoving: false,
        diceRollingTimer: 0,
        lastDice: [0, 0],
        parkingPot: 0,
        cameraMode: "follow", // "follow" | "zoom" | "overview" | "twynham"
        camLookAt: new THREE.Vector3(0, 1, 0),
        camDesiredPos: new THREE.Vector3(0, 28, 32),
        orbitYaw: 0.45,
        orbitPitch: 0.72,
        orbitDistance: 36,
        logs: [],
        consecutiveDoubles: 0,
        extraTurn: false,
        bankruptcyAnimating: false,
        mapId: "christchurch",
        houseRules: { freeParking: false, auctions: true, doubleGo: false, startingCash: 1500 },
        onlineMode: false,
        applyingOnlineState: false,
        onlineSyncTimer: null,
        onlineLastRevision: 0,
        onlineRoom: null,
        onlineStartedFromRoom: false,
        onlineLocalSetupBackup: null,
        seenTradeRequests: new Set(),
        processedTradeRequests: new Set(),
        seenAuctionPrompts: new Set(),
        processedAuctionResponses: new Set(),
        onlineAuctionCallbacks: new Map()
      };

      const monopolyOnline = new MonopolyOnline({
        onRoom: receiveOnlineRoom,
        onError: (message) => setOnlineStatus(message, true)
      });

      function setOnlineStatus(message, isError = false) {
        const el = document.getElementById("online-room-status");
        if (!el) return;
        el.textContent = message;
        el.classList.toggle("text-rose-300", isError);
        el.classList.toggle("text-slate-300", !isError);
      }

      function getOnlineSeats(room) {
        return [1, 2, 3, 4].map((seat) => room?.players?.[`seat${seat}`]).filter(Boolean);
      }

      function getOnlineSettings() {
        return { mapId: game.mapId, houseRules: { ...game.houseRules } };
      }

      function backupLocalSetup() {
        if (game.onlineLocalSetupBackup) return;
        game.onlineLocalSetupBackup = {
          playerCount: game.playerCount,
          setupConfigs: game.setupConfigs.map((player) => ({ ...player })),
          mapId: game.mapId,
          houseRules: { ...game.houseRules }
        };
      }

      function restoreLocalSetup() {
        const backup = game.onlineLocalSetupBackup;
        if (!backup) return;
        game.playerCount = backup.playerCount;
        game.setupConfigs = backup.setupConfigs;
        game.mapId = backup.mapId;
        game.houseRules = backup.houseRules;
        game.onlineLocalSetupBackup = null;
        renderSetupRows();
        document.querySelectorAll(".map-choice").forEach((choice) => {
          choice.classList.toggle("active-map", choice.dataset.map === game.mapId);
          choice.setAttribute("aria-pressed", String(choice.dataset.map === game.mapId));
        });
        document.getElementById("selected-map-label").textContent = MAP_THEMES[game.mapId].label;
        document.getElementById("board-map-name").textContent = MAP_THEMES[game.mapId].label;
        document.getElementById("rule-free-parking").checked = game.houseRules.freeParking;
        document.getElementById("rule-auctions").checked = game.houseRules.auctions;
        document.getElementById("rule-double-go").checked = game.houseRules.doubleGo;
        document.getElementById("rule-start-cash").value = game.houseRules.startingCash;
        document.getElementById("house-rules-preset").value = "custom";
        document.getElementById("starting-cash-summary").textContent = `Starting cash: £${game.houseRules.startingCash}`;
        applyMapTheme(game.mapId);
      }

      function renderOnlineRoom(room) {
        game.onlineRoom = room;
        const code = room.code || monopolyOnline.code || "";
        const label = document.getElementById("online-room-code-label");
        const value = document.getElementById("online-room-code-value");
        const members = document.getElementById("online-room-members");
        const startBtn = document.getElementById("online-start-btn");
        const hostBtn = document.getElementById("online-host-btn");
        const joinBtn = document.getElementById("online-join-btn");
        const copyBtn = document.getElementById("online-copy-btn");
        const shareBtn = document.getElementById("online-share-btn");
        const leaveBtn = document.getElementById("online-leave-btn");
        if (label && code) label.classList.remove("hidden");
        if (value) value.textContent = code;
        if (copyBtn) copyBtn.classList.toggle("hidden", !code);
        if (shareBtn) shareBtn.classList.toggle("hidden", !code);
        if (leaveBtn) leaveBtn.classList.toggle("hidden", !code);
        if (hostBtn) hostBtn.disabled = Boolean(code);
        if (joinBtn) joinBtn.disabled = Boolean(code);
        document.querySelectorAll(".map-choice, #house-rules-preset, #rule-free-parking, #rule-auctions, #rule-double-go, #rule-start-cash").forEach((input) => { input.disabled = Boolean(code); });
        if (members) {
          const seats = getOnlineSeats(room);
          members.innerHTML = [1, 2, 3, 4].map((seat) => {
            const player = seats.find((p) => p.seat === seat);
            return `<div class="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-slate-200"><span class="text-sky-300 font-bold">Seat ${seat}</span><span class="ml-2">${player ? escapeHtml(player.name) : "Waiting for player…"}</span>${player ? `<span class="ml-2 text-[10px] ${player.connected === false ? "text-rose-300" : "text-emerald-300"}">${player.connected === false ? "OFFLINE" : "ONLINE"}</span>` : ""}${player?.uid === room.hostUid ? '<span class="float-right text-amber-200">HOST</span>' : ""}</div>`;
          }).join("");
        }
        if (startBtn) {
          startBtn.classList.toggle("hidden", !monopolyOnline.isHost || room.status !== "waiting");
          startBtn.disabled = getOnlineSeats(room).length < 2;
        }
        if (room.status === "waiting") setOnlineStatus(`${getOnlineSeats(room).length}/4 players joined. The host can start with at least 2.`);
        else if (room.status === "playing") setOnlineStatus(`Room ${code} is in progress. Rejoin with this code if you refresh.`);
      }

      function serializeOnlineState() {
        return {
          revision: game.onlineLastRevision,
          turnIndex: game.turnIndex,
          turnUid: game.players[game.turnIndex]?.uid || null,
          hasRolled: game.hasRolled,
          lastDice: [...game.lastDice],
          parkingPot: game.parkingPot,
          consecutiveDoubles: game.consecutiveDoubles,
          extraTurn: game.extraTurn,
          mapId: game.mapId,
          houseRules: { ...game.houseRules },
          logs: game.logs.slice(0, 25),
          winnerUid: game.winnerUid || null,
          players: game.players.map((player) => ({
            uid: player.uid, id: player.id, name: player.name, teamId: player.teamId,
            charId: player.charId, cash: player.cash, pos: player.pos, inJail: player.inJail,
            jailTurns: player.jailTurns || 0, jailCards: player.jailCards || 0,
            jailChoiceMade: Boolean(player.jailChoiceMade), bankrupt: Boolean(player.bankrupt),
            debtCreditorId: player.debtCreditorId || null
          })),
          tiles: BOARD_TILES.map((tile) => ({ ownerId: tile.ownerId, houses: tile.houses || 0, mortgaged: Boolean(tile.mortgaged) }) )
        };
      }

      function scheduleOnlinePublish() {
        if (!game.onlineMode || game.applyingOnlineState || !game.started) return;
        clearTimeout(game.onlineSyncTimer);
        game.onlineSyncTimer = setTimeout(async () => {
          try {
            const published = await monopolyOnline.publishState(serializeOnlineState());
            if (published) game.onlineLastRevision = Number(published.revision) || game.onlineLastRevision;
          } catch (error) {
            setOnlineStatus(error.message || "Could not sync this turn.", true);
          }
        }, 550);
      }

      function applyOnlineState(state) {
        if (!state || Number(state.revision) <= game.onlineLastRevision) return;
        // Firebase echoes a player's own committed snapshot through onValue.
        // Applying it replaces player objects while their movement callbacks
        // still hold references to the originals, which can snap the token back.
        if (state.updatedBy && state.updatedBy === monopolyOnline.user?.uid) {
          game.onlineLastRevision = Number(state.revision) || game.onlineLastRevision;
          return;
        }
        game.applyingOnlineState = true;
        game.onlineLastRevision = Number(state.revision) || game.onlineLastRevision;
        game.turnIndex = Number(state.turnIndex) || 0;
        game.hasRolled = Boolean(state.hasRolled);
        game.lastDice = Array.isArray(state.lastDice) ? state.lastDice.slice(0, 2) : [0, 0];
        game.parkingPot = Number(state.parkingPot) || 0;
        game.consecutiveDoubles = Number(state.consecutiveDoubles) || 0;
        game.extraTurn = Boolean(state.extraTurn);
        game.mapId = state.mapId || game.mapId;
        game.houseRules = { ...game.houseRules, ...(state.houseRules || {}) };
        game.logs = Array.isArray(state.logs) ? state.logs.slice(0, 25) : [];
        const logEl = document.getElementById("event-log");
        logEl.innerHTML = game.logs.map((entry) => `<div class="${safeLogClass(entry.colorClass)} leading-snug">• ${escapeHtml(entry.msg)}</div>`).join("");
        game.winnerUid = state.winnerUid || null;
        applyMapTheme(game.mapId);

        const currentByUid = new Map(game.players.map((player) => [player.uid, player]));
        const newlyBankrupt = [];
        game.players = (state.players || []).map((saved) => {
          const player = currentByUid.get(saved.uid);
          const mesh = player?.mesh || createCharacterMesh(CHARACTER_STYLES.find((style) => style.id === saved.charId) || CHARACTER_STYLES[0]);
          if (!player) scene.add(mesh);
          if (player && saved.bankrupt && !player.bankrupt) newlyBankrupt.push(mesh);
          mesh.visible = !saved.bankrupt;
          return { ...player, ...saved, isBot: false, animatingStep: false, mesh };
        });
        for (let i = 0; i < BOARD_TILES.length; i++) {
          const saved = state.tiles?.[i];
          BOARD_TILES[i].ownerId = saved?.ownerId || null;
          BOARD_TILES[i].houses = Number(saved?.houses) || 0;
          BOARD_TILES[i].mortgaged = Boolean(saved?.mortgaged);
        }
        updateTokenPositions();
        refreshBoardVisuals();
        updateHUD();
        game.applyingOnlineState = false;
        newlyBankrupt.forEach((mesh) => {
          mesh.visible = true;
          launchBankruptcyJump({ mesh }, () => {});
        });
        if (game.winnerUid && !game.onlineWinnerShown) {
          game.onlineWinnerShown = true;
          const winner = game.players.find((player) => player.uid === game.winnerUid);
          openModal("Match Complete", `${winner?.name || "A player"} Wins!`, "BCP Monopoly 3D Championship", "The online match has ended.", [{ label: "Close", cls: "bg-emerald-400 text-slate-950" }]);
        }
      }

      function receiveOnlineRoom(room) {
        renderOnlineRoom(room);
        if (room.status !== "playing" || !room.state) {
          handleOnlineTradeUpdates(room);
          handleOnlineAuctionUpdates(room);
          return;
        }
        if (!game.onlineStartedFromRoom) {
          game.onlineStartedFromRoom = true;
          backupLocalSetup();
          game.onlineMode = true;
          game.playerCount = getOnlineSeats(room).length;
          game.mapId = room.settings?.mapId || "christchurch";
          game.houseRules = { ...game.houseRules, ...(room.settings?.houseRules || {}) };
          document.getElementById("board-map-name").textContent = MAP_THEMES[game.mapId]?.label || game.mapId;
          game.setupConfigs = getOnlineSeats(room).map((player, index) => ({
            uid: player.uid, name: player.name, isBot: false,
            teamId: ["Alpha", "Beta", "Gamma", "Delta"][index],
            charId: ["scholar", "sailor", "ranger", "pilot"][index]
          }));
          startNewMatch(game.setupConfigs);
          game.onlineLastRevision = -1;
          applyOnlineState({ ...room.state, revision: 0 });
          const setup = document.getElementById("setup-modal");
          setup.classList.add("hidden");
          document.getElementById("game-hud").classList.remove("hidden");
          document.getElementById("bottom-hud").classList.remove("hidden");
          game.onlineLastRevision = Number(room.state.revision) || 0;
          handleOnlineTradeUpdates(room);
          handleOnlineAuctionUpdates(room);
          return;
        }
        applyOnlineState(room.state);
        handleOnlineTradeUpdates(room);
        handleOnlineAuctionUpdates(room);
      }

      function handleOnlineAuctionUpdates(room) {
        const uid = monopolyOnline.user?.uid;
        if (!uid || !room?.auctionPrompts) return;
        const responses = room.auctionResponses || {};
        for (const [promptId, prompt] of Object.entries(room.auctionPrompts)) {
          if (prompt.targetUid === uid && !responses[promptId] && !game.seenAuctionPrompts.has(promptId)) {
            game.seenAuctionPrompts.add(promptId);
            const player = game.players.find((entry) => entry.uid === uid);
            openModal("Property Auction", `Bid on ${escapeHtml(prompt.tileName)}?`, `Current bid £${prompt.highBid}. Your next bid is £${prompt.minimum}.`, `<p>Your cash: £${player?.cash ?? "—"}.</p>`, [
              { label: `Bid £${prompt.minimum}`, cls: "bg-emerald-400 text-slate-950", disabled: !player || player.cash < prompt.minimum, onClick: async () => {
                try { await monopolyOnline.respondToAuction(promptId, true); }
                catch (error) { setOnlineStatus(error.message || "Could not send your auction bid.", true); }
              } },
              { label: "Pass", cls: "bg-white/15 text-white", onClick: async () => {
                try { await monopolyOnline.respondToAuction(promptId, false); }
                catch (error) { setOnlineStatus(error.message || "Could not pass in the auction.", true); }
              } }
            ]);
          }

          const response = responses[promptId];
          const callback = game.onlineAuctionCallbacks.get(promptId);
          if (prompt.hostTurnUid === uid && response && callback && !game.processedAuctionResponses.has(promptId)) {
            game.processedAuctionResponses.add(promptId);
            game.onlineAuctionCallbacks.delete(promptId);
            callback(Boolean(response.raise));
          }
        }
      }

      function handleOnlineTradeUpdates(room) {
        const uid = monopolyOnline.user?.uid;
        if (!uid || !room?.tradeRequests) return;
        const responses = room.tradeResponses || {};
        for (const [requestId, offer] of Object.entries(room.tradeRequests)) {
          if (offer.targetUid === uid && !responses[requestId] && !game.seenTradeRequests.has(requestId)) {
            game.seenTradeRequests.add(requestId);
            const give = (offer.giveTiles || []).map((id) => BOARD_TILES[Number(id)]?.name).filter(Boolean).join(", ") || "no properties";
            const get = (offer.getTiles || []).map((id) => BOARD_TILES[Number(id)]?.name).filter(Boolean).join(", ") || "no properties";
            const details = `<p><strong>${escapeHtml(offer.offererName || "A player")} offers:</strong> £${Number(offer.giveCash) || 0} and ${escapeHtml(give)}.</p><p class="mt-2"><strong>In exchange:</strong> £${Number(offer.getCash) || 0} and ${escapeHtml(get)}.</p>`;
            openModal("Online Trade Offer", "A player has sent you a trade", "Accept or decline. The proposer will apply the trade if the assets are still available.", details, [
              { label: "Accept Trade", cls: "bg-emerald-400 text-slate-950", onClick: async () => {
                try { await monopolyOnline.respondToTrade(requestId, true); setOnlineStatus("Trade accepted. Waiting for the proposer to apply it."); }
                catch (error) { setOnlineStatus(error.message || "Could not respond to the trade.", true); }
              } },
              { label: "Decline", cls: "bg-white/15 text-white", onClick: async () => {
                try { await monopolyOnline.respondToTrade(requestId, false); }
                catch (error) { setOnlineStatus(error.message || "Could not respond to the trade.", true); }
              } }
            ]);
          }

          const response = responses[requestId];
          if (offer.offererUid !== uid || !response || game.processedTradeRequests.has(requestId)) continue;
          game.processedTradeRequests.add(requestId);
          const activePlayer = game.players.find((player) => player.uid === offer.offererUid);
          const targetPlayer = game.players.find((player) => player.uid === offer.targetUid);
          const giveTiles = (offer.giveTiles || []).map(Number);
          const getTiles = (offer.getTiles || []).map(Number);
          const roomTurnStillOurs = room.state?.turnUid === offer.offererUid;
          const valid = roomTurnStillOurs && activePlayer && targetPlayer &&
            activePlayer.cash >= offer.giveCash && targetPlayer.cash >= offer.getCash &&
            giveTiles.every((id) => BOARD_TILES[id]?.ownerId === activePlayer.id && BOARD_TILES[id].houses === 0) &&
            getTiles.every((id) => BOARD_TILES[id]?.ownerId === targetPlayer.id && BOARD_TILES[id].houses === 0);
          if (response.accepted && valid) {
            activePlayer.cash += Number(offer.getCash) - Number(offer.giveCash);
            targetPlayer.cash += Number(offer.giveCash) - Number(offer.getCash);
            giveTiles.forEach((id) => { BOARD_TILES[id].ownerId = targetPlayer.id; });
            getTiles.forEach((id) => { BOARD_TILES[id].ownerId = activePlayer.id; });
            addLog(`${activePlayer.name} and ${targetPlayer.name} completed an online trade.`, "text-indigo-300");
            refreshBoardVisuals();
            updateHUD();
          } else if (!roomTurnStillOurs) {
            setOnlineStatus("An online trade response arrived after the offerer's turn ended; it was not applied.", true);
          } else {
            addLog(response.accepted ? "An online trade expired because the turn or offer changed." : `${targetPlayer?.name || "The player"} declined the online trade.`, "text-amber-300");
            updateHUD();
          }
        }
      }

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
      }

      function safeLogClass(value) {
        return /^text-(slate|sky|emerald|rose|amber|indigo)-[0-9]{3}$/.test(String(value || "")) ? value : "text-slate-200";
      }

      function addLog(msg, colorClass = "text-slate-200") {
        game.logs.unshift({ msg, colorClass });
        if (game.logs.length > 25) game.logs.pop();
        const logEl = document.getElementById("event-log");
        logEl.innerHTML = game.logs
          .map((l) => `<div class="${safeLogClass(l.colorClass)} leading-snug">• ${escapeHtml(l.msg)}</div>`)
          .join("");
        scheduleOnlinePublish();
      }

      function renderSetupRows() {
        const container = document.getElementById("setup-player-rows");
        container.innerHTML = "";

        for (let i = 0; i < game.playerCount; i++) {
          const cfg = game.setupConfigs[i];
          const row = document.createElement("div");
          row.className = "rounded-2xl bg-white/5 border border-white/10 p-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2";

          const teamOpts = TEAMS.map(
            (t) => `<option value="${t.id}" ${cfg.teamId === t.id ? "selected" : ""}>${t.label}</option>`
          ).join("");

          const charOpts = CHARACTER_STYLES.map(
            (c) => `<option value="${c.id}" ${cfg.charId === c.id ? "selected" : ""}>${c.name}</option>`
          ).join("");

          row.innerHTML = `
            <div class="flex items-center gap-2 min-w-[130px]">
              <span class="font-display text-xs font-bold px-2 py-1 rounded-lg bg-sky-500/20 text-sky-300">P${i + 1}</span>
              <input type="text" data-idx="${i}" class="p-name-input bg-slate-900/80 border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white w-28 focus:outline-none focus:border-sky-400" value="${cfg.name}" />
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <button type="button" data-idx="${i}" class="p-type-btn btn-3d px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${cfg.isBot ? "bg-amber-500/25 text-amber-200 border border-amber-400/40" : "bg-emerald-500/25 text-emerald-200 border border-emerald-400/40"}">
                ${cfg.isBot ? "AI Bot" : "Local Human"}
              </button>
              <select data-idx="${i}" class="p-team-select bg-slate-900/90 border border-white/15 rounded-lg px-2 py-1 text-xs text-white">
                ${teamOpts}
              </select>
              <select data-idx="${i}" class="p-char-select bg-slate-900/90 border border-white/15 rounded-lg px-2 py-1 text-xs text-white">
                ${charOpts}
              </select>
            </div>
          `;
          container.appendChild(row);
        }

        container.querySelectorAll(".p-name-input").forEach((inp) => {
          inp.addEventListener("input", (e) => {
            const idx = Number(e.target.dataset.idx);
            game.setupConfigs[idx].name = e.target.value.trim() || `Player ${idx + 1}`;
          });
        });

        container.querySelectorAll(".p-type-btn").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            const idx = Number(e.target.dataset.idx);
            game.setupConfigs[idx].isBot = !game.setupConfigs[idx].isBot;
            renderSetupRows();
          });
        });

        container.querySelectorAll(".p-team-select").forEach((sel) => {
          sel.addEventListener("change", (e) => {
            const idx = Number(e.target.dataset.idx);
            game.setupConfigs[idx].teamId = e.target.value;
          });
        });

        container.querySelectorAll(".p-char-select").forEach((sel) => {
          sel.addEventListener("change", (e) => {
            const idx = Number(e.target.dataset.idx);
            game.setupConfigs[idx].charId = e.target.value;
          });
        });
      }

      document.querySelectorAll(".pcount-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          game.playerCount = Number(btn.dataset.pcount);
          document.querySelectorAll(".pcount-btn").forEach((b) => {
            const active = Number(b.dataset.pcount) === game.playerCount;
            b.className = active
              ? "pcount-btn btn-3d px-3 py-1 rounded-lg text-xs font-bold bg-sky-500 text-slate-950 border border-sky-300 cursor-pointer"
              : "pcount-btn btn-3d px-3 py-1 rounded-lg text-xs font-bold bg-white/10 text-slate-200 border border-white/15 cursor-pointer";
          });
          renderSetupRows();
        });
      });

      renderSetupRows();

      document.querySelectorAll(".map-choice").forEach((button) => button.addEventListener("click", () => {
        game.mapId = button.dataset.map;
        document.querySelectorAll(".map-choice").forEach((choice) => {
          const active = choice.dataset.map === game.mapId;
          choice.classList.toggle("active-map", active);
          choice.setAttribute("aria-pressed", String(active));
        });
        document.getElementById("selected-map-label").textContent = MAP_THEMES[game.mapId].label;
        document.getElementById("board-map-name").textContent = MAP_THEMES[game.mapId].label;
        applyMapTheme(game.mapId);
      }));

      function clearPlayersFromScene() {
        for (const p of game.players) {
          if (p.mesh) scene.remove(p.mesh);
        }
        game.players = [];
        for (const t of BOARD_TILES) {
          t.ownerId = null;
          t.houses = 0;
          t.mortgaged = false;
        }
        for (let i = 0; i < 40; i++) {
          tileOwnerRings[i].material.visible = false;
          while (tileBuildingGroups[i].children.length > 0) {
            tileBuildingGroups[i].remove(tileBuildingGroups[i].children[0]);
          }
        }
      }

      function getCurrentPlayer() {
        return game.players[game.turnIndex];
      }

      function getTeamById(id) {
        return TEAMS.find((t) => t.id === id) || TEAMS[0];
      }

      function updateTokenPositions() {
        const byTile = {};
        for (const p of game.players) {
          if (p.bankrupt) continue;
          if (!byTile[p.pos]) byTile[p.pos] = [];
          byTile[p.pos].push(p);
        }

        for (const tileKey of Object.keys(byTile)) {
          const list = byTile[tileKey];
          const basePos = getTileWorldPos(Number(tileKey));
          list.forEach((p, idx) => {
            const angle = (idx / Math.max(1, list.length)) * Math.PI * 2;
            const spread = list.length > 1 ? 0.55 : 0;
            const targetX = basePos.x + Math.cos(angle) * spread;
            const targetZ = basePos.z + Math.sin(angle) * spread;
            if (!p.animatingStep) {
              p.mesh.position.x = targetX;
              p.mesh.position.z = targetZ;
              p.mesh.position.y = basePos.y + 0.12;
            }
          });
        }
      }

      const SHARED_BUILDING_GEOS = {
        houseWall: new THREE.BoxGeometry(0.42, 0.34, 0.42),
        houseRoof: new THREE.ConeGeometry(0.35, 0.24, 4),
        hotelWall: new THREE.BoxGeometry(0.92, 0.72, 0.88),
        hotelRoof: new THREE.ConeGeometry(0.76, 0.36, 4)
      };

      function refreshBoardVisuals() {
        for (let i = 0; i < 40; i++) {
          const tile = BOARD_TILES[i];
          const topMat = tileMeshes[i]?.material?.[2];
          if (topMat) {
            topMat.color.setHex(tile.mortgaged ? 0x94a3b8 : 0xffffff);
          }

          const ring = tileOwnerRings[i];
          if (tile.ownerId) {
            const owner = game.players.find((p) => p.id === tile.ownerId);
            if (owner) {
              const team = getTeamById(owner.teamId);
              ring.material.color.setHex(team.hex);
              ring.material.visible = true;
            }
          } else {
            ring.material.visible = false;
          }

          const bGroup = tileBuildingGroups[i];
          while (bGroup.children.length > 0) {
            bGroup.remove(bGroup.children[0]);
          }

          if (tile.type === "property" && tile.houses > 0) {
            if (tile.houses === 5) {
              const hotel = new THREE.Group();
              const body = new THREE.Mesh(SHARED_BUILDING_GEOS.hotelWall, PBRTextures.buildingPieces.hotelWall);
              body.position.y = 0.36;
              body.castShadow = true;
              body.receiveShadow = true;
              const roof = new THREE.Mesh(SHARED_BUILDING_GEOS.hotelRoof, PBRTextures.buildingPieces.hotelRoof);
              roof.position.y = 0.9;
              roof.rotation.y = Math.PI / 4;
              roof.castShadow = true;
              hotel.add(body, roof);
              hotel.position.set(0, 0.01, -0.75);
              bGroup.add(hotel);
            } else {
              for (let h = 0; h < tile.houses; h++) {
                const house = new THREE.Group();
                const body = new THREE.Mesh(SHARED_BUILDING_GEOS.houseWall, PBRTextures.buildingPieces.houseWall);
                body.position.y = 0.17;
                body.castShadow = true;
                body.receiveShadow = true;
                const roof = new THREE.Mesh(SHARED_BUILDING_GEOS.houseRoof, PBRTextures.buildingPieces.houseRoof);
                roof.position.y = 0.45;
                roof.rotation.y = Math.PI / 4;
                roof.castShadow = true;
                house.add(body, roof);
                house.position.set(-0.6 + h * 0.42, 0.01, -0.75);
                bGroup.add(house);
              }
            }
          }
        }
      }

      function updateHUD() {
        document.getElementById("parking-pot-badge").textContent = `Hengistbury Pot: £${game.parkingPot}`;

        const bar = document.getElementById("players-bar");
        bar.innerHTML = "";

        game.players.forEach((p, idx) => {
          const team = getTeamById(p.teamId);
          const isTurn = idx === game.turnIndex && !p.bankrupt;
          const card = document.createElement("button");
          card.type = "button";
          card.className = `btn-3d glass-card rounded-2xl px-3 py-1.5 text-left flex items-center gap-2.5 cursor-pointer ${
            isTurn ? "ring-2 ring-sky-400 bg-sky-950/70" : ""
          } ${p.bankrupt ? "opacity-45" : ""}`;
          card.title = `Click to focus camera on ${p.name}`;
          card.addEventListener("click", () => {
            game.cameraMode = "zoom";
            game.camLookAt.copy(p.mesh.position);
          });

          card.innerHTML = `
            <span class="w-3 h-8 rounded-full inline-block" style="background:${team.color}"></span>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-display text-xs font-bold text-white">${escapeHtml(p.name)}</span>
                <span class="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300">${p.isBot ? "BOT" : "P" + (idx + 1)}</span>
              </div>
              <div class="text-[11px] font-display font-bold text-emerald-300 tabular-nums">£${p.cash} <span class="text-[10px] font-normal text-slate-400">• ${team.id}</span></div>
            </div>
          `;
          bar.appendChild(card);
        });

        const cur = getCurrentPlayer();
        if (!cur) return;
        const curTeam = getTeamById(cur.teamId);
        const badge = document.getElementById("active-player-badge");
        badge.textContent = `P${game.turnIndex + 1}`;
        badge.style.backgroundColor = `${curTeam.color}33`;
        badge.style.color = curTeam.color;

        document.getElementById("turn-player-name").textContent = `${cur.name} (${curTeam.label})`;
        document.getElementById("turn-status-text").textContent = cur.inJail
          ? "In BCP Civic Detention"
          : game.onlineMode && cur.uid !== monopolyOnline.user?.uid
          ? `Waiting for ${cur.name} to take their turn`
          : game.isMoving
          ? "Moving around BCP..."
          : game.hasRolled
          ? `Landed on ${BOARD_TILES[cur.pos].name}`
          : cur.isBot
          ? "AI Bot thinking..."
          : "Roll the dice to move";

        document.getElementById("dice-readout").textContent =
          game.lastDice[0] > 0 ? `${game.lastDice[0]} + ${game.lastDice[1]}` : "- + -";

        const rollBtn = document.getElementById("roll-btn");
        const endTurnBtn = document.getElementById("end-turn-btn");
        const buildBtn = document.getElementById("build-btn");
        const tradeBtn = document.getElementById("trade-btn");
        const skipOfflineBtn = document.getElementById("skip-offline-btn");

        const humanTurn = !cur.isBot && !cur.bankrupt && !game.isMoving && !game.bankruptcyAnimating &&
          (!game.onlineMode || cur.uid === monopolyOnline.user?.uid);
        buildBtn.textContent = cur.cash < 0 ? "Raise Cash" : "Build";
        rollBtn.disabled = !humanTurn || game.hasRolled;
        endTurnBtn.disabled = !humanTurn || !game.hasRolled || game.extraTurn;
        buildBtn.disabled = !humanTurn;
        tradeBtn.disabled = !humanTurn || game.players.filter((x) => !x.bankrupt && x.id !== cur.id).length === 0;
        const currentRoomSeat = getOnlineSeats(game.onlineRoom).find((player) => player.uid === cur.uid);
        const canHostSkip = game.onlineMode && monopolyOnline.isHost && currentRoomSeat?.connected === false;
        skipOfflineBtn.classList.toggle("hidden", !canHostSkip);
        skipOfflineBtn.disabled = game.isMoving || game.bankruptcyAnimating || game.isTransitioning;
        scheduleOnlinePublish();
      }

      // =========================================================================
      // 5. MODALS: TILE INSPECTOR, PROPERTY BUY, CARDS, BUILD & TRADE
      // =========================================================================
      const actionModal = document.getElementById("action-modal");
      const modalTag = document.getElementById("modal-tag");
      const modalTitle = document.getElementById("modal-title");
      const modalSubtitle = document.getElementById("modal-subtitle");
      const modalBody = document.getElementById("modal-body");
      const modalActions = document.getElementById("modal-actions");

      function openModal(tag, title, subtitle, bodyHtml, buttons) {
        modalTag.textContent = tag;
        modalTitle.textContent = title;
        modalSubtitle.textContent = subtitle;
        modalBody.innerHTML = bodyHtml;
        modalActions.innerHTML = "";

        for (const b of buttons) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = b.label;
          btn.disabled = Boolean(b.disabled);
          btn.className = `btn-3d px-4 py-2 rounded-xl font-display font-bold text-xs uppercase tracking-wider cursor-pointer ${b.cls || "bg-white/15 text-white"}`;
          btn.addEventListener("click", () => {
            closeModal();
            if (b.onClick) b.onClick();
          });
          modalActions.appendChild(btn);
        }

        const hubLink = document.createElement("a");
        hubLink.href = "../index.html";
        hubLink.textContent = "Game Hub";
        hubLink.className = "btn-3d px-4 py-2 rounded-xl font-display font-bold text-xs uppercase tracking-wider text-slate-200 bg-white/10 hover:bg-white/15";
        modalActions.appendChild(hubLink);

        actionModal.classList.remove("hidden");
        actionModal.classList.add("flex");
      }

      function showLandingEvent(player, tile, message, onDone) {
        if (player.isBot) { if (onDone) onDone(); return; }
        openModal("You landed on", tile.name, `${tile.area} • Space #${tile.id}`,
          `<p class="text-slate-200">${message}</p><p class="text-xs text-slate-400">${tile.desc}</p>`,
          [{ label: "Continue", cls: "bg-sky-500 text-slate-950", onClick: onDone }]);
      }

      const presetSelect = document.getElementById("house-rules-preset");
      function applyRulePreset(value) {
        const rules = {
          classic: { freeParking: false, auctions: true, doubleGo: false, startingCash: 1500 },
          "free-parking": { freeParking: true, auctions: true, doubleGo: false, startingCash: 1500 },
          quick: { freeParking: true, auctions: true, doubleGo: true, startingCash: 2000 }
        };
        if (!rules[value]) return;
        game.houseRules = { ...rules[value] };
        document.getElementById("rule-free-parking").checked = game.houseRules.freeParking;
        document.getElementById("rule-auctions").checked = game.houseRules.auctions;
        document.getElementById("rule-double-go").checked = game.houseRules.doubleGo;
        document.getElementById("rule-start-cash").value = game.houseRules.startingCash;
        document.getElementById("starting-cash-summary").textContent = `Starting cash: £${game.houseRules.startingCash}`;
      }
      presetSelect.addEventListener("change", () => applyRulePreset(presetSelect.value));
      [["rule-free-parking", "freeParking", "checked"], ["rule-auctions", "auctions", "checked"], ["rule-double-go", "doubleGo", "checked"], ["rule-start-cash", "startingCash", "value"]].forEach(([id, key, prop]) => {
        document.getElementById(id).addEventListener("input", (event) => {
          game.houseRules[key] = prop === "checked" ? event.target.checked : Math.max(500, Math.min(5000, Number(event.target.value) || 1500));
          presetSelect.value = "custom";
          document.getElementById("starting-cash-summary").textContent = `Starting cash: £${game.houseRules.startingCash}`;
        });
      });
      applyRulePreset("classic");

      function closeModal() {
        actionModal.classList.add("hidden");
        actionModal.classList.remove("flex");
      }

      function inspectTile(tileId) {
        const tile = BOARD_TILES[tileId];
        if (!tile) return;

        const owner = tile.ownerId ? game.players.find((p) => p.id === tile.ownerId) : null;
        const ownerLabel = owner
          ? `<span class="font-bold text-white">${owner.name}</span> (${getTeamById(owner.teamId).label})`
          : `<span class="text-emerald-300 font-semibold">Unowned</span>`;

        let details = `<p class="text-slate-300">${tile.desc}</p>`;
        details += `<div class="rounded-xl bg-white/5 p-3 space-y-1 border border-white/10">`;
        details += `<div><span class="text-slate-400">Area:</span> <strong>${tile.area}</strong></div>`;
        details += `<div><span class="text-slate-400">Owner:</span> ${ownerLabel}</div>`;

        if (tile.price) {
          details += `<div><span class="text-slate-400">Purchase Price:</span> <strong class="text-emerald-300">£${tile.price}</strong> • Mortgage: £${tile.mortgage}</div>`;
        }

        if (tile.group && COLOR_SETS[tile.group]) {
          const cs = COLOR_SETS[tile.group];
          details += `<div><span class="text-slate-400">Set:</span> <strong style="color:${cs.hex}">${cs.name}</strong> • House Cost: £${cs.houseCost}</div>`;
          details += `<div class="pt-1 grid grid-cols-3 gap-1 text-[11px] text-slate-300">
            <div>Base: <strong>£${tile.rents[0]}</strong></div>
            <div>1 House: <strong>£${tile.rents[1]}</strong></div>
            <div>2 Houses: <strong>£${tile.rents[2]}</strong></div>
            <div>3 Houses: <strong>£${tile.rents[3]}</strong></div>
            <div>4 Houses: <strong>£${tile.rents[4]}</strong></div>
            <div>Hotel: <strong class="text-amber-300">£${tile.rents[5]}</strong></div>
          </div>`;
        } else if (tile.type === "station") {
          details += `<div class="text-[11px] text-slate-300 pt-1">Rent scales with stations owned by player/team: £25 / £50 / £100 / £200.</div>`;
        } else if (tile.type === "utility") {
          details += `<div class="text-[11px] text-slate-300 pt-1">Rent is 4x dice roll (or 10x if owning both BCP utilities).</div>`;
        }

        if (tile.mortgaged) {
          details += `<div class="text-rose-300 font-semibold">Currently Mortgaged</div>`;
        }
        details += `</div>`;

        const actions = [{ label: "Close", cls: "bg-sky-500 text-slate-950" }];
        const current = getCurrentPlayer();
        const canManageCurrentDeed = current && !current.isBot && (!game.onlineMode || current.uid === monopolyOnline.user?.uid);
        if (canManageCurrentDeed && tile.ownerId === current.id && tile.mortgage) {
          const groupHasBuildings = tile.group && BOARD_TILES.some((t) => t.group === tile.group && t.houses > 0);
          if (!tile.mortgaged && !groupHasBuildings) {
            actions.unshift({ label: `Mortgage +£${tile.mortgage}`, cls: "bg-amber-400 text-slate-950", onClick: () => {
              tile.mortgaged = true; current.cash += tile.mortgage;
              addLog(`${current.name} mortgaged ${tile.name} for £${tile.mortgage}.`, "text-amber-300");
              refreshBoardVisuals(); updateHUD(); closeModal();
            }});
          } else if (tile.mortgaged) {
            const repay = Math.ceil(tile.mortgage * 1.1);
            actions.unshift({ label: `Lift mortgage (£${repay})`, disabled: current.cash < repay, cls: "bg-emerald-400 text-slate-950", onClick: () => {
              current.cash -= repay; tile.mortgaged = false;
              addLog(`${current.name} lifted the mortgage on ${tile.name} for £${repay}.`, "text-emerald-300");
              refreshBoardVisuals(); updateHUD(); closeModal();
            }});
          }
        }
        openModal(
          tile.id === 39 ? "Dark Blue Landmark" : "Tile Inspector",
          tile.name,
          `${tile.area} • Tile #${tile.id}`,
          details,
          actions
        );
      }

      // Raycasting on board canvas to inspect clicked tiles
      const raycaster = new THREE.Raycaster();
      const pointerNDC = new THREE.Vector2();
      let pointerDownPos = { x: 0, y: 0 };

      canvas.addEventListener("pointerdown", (e) => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
      });

      canvas.addEventListener("pointerup", (e) => {
        const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (moved > 6 || !game.started) return;

        pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
        pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointerNDC, camera);
        const hits = raycaster.intersectObjects(tileMeshes, false);
        if (hits.length > 0 && hits[0].object.userData && hits[0].object.userData.tileId !== undefined) {
          inspectTile(hits[0].object.userData.tileId);
        }
      });

      function promptBuyProperty(player, tile, onDone) {
        if (player.isBot) {
          if (player.cash >= tile.price + 120) {
            player.cash -= tile.price;
            tile.ownerId = player.id;
            AudioEngine.buy();
            addLog(`${player.name} bought ${tile.name} for £${tile.price}.`, "text-emerald-300");
            refreshBoardVisuals();
          }
          if (onDone) onDone();
          return;
        }

        const canAfford = player.cash >= tile.price;
        openModal(
          tile.group === "darkblue" ? "Dark Blue Prestige" : "Available Property",
          tile.name,
          `${tile.area} • Price: £${tile.price}`,
          `<p>${tile.desc}</p>
           <p class="text-xs text-slate-300">Your Cash: <strong class="text-emerald-300">£${player.cash}</strong> • Base Rent: <strong>£${tile.rents ? tile.rents[0] : 25}</strong></p>`,
          [
            {
              label: `Buy (£${tile.price})`,
              disabled: !canAfford,
              cls: canAfford ? "bg-emerald-400 text-slate-950" : "bg-white/10 text-slate-500",
              onClick: () => {
                player.cash -= tile.price;
                tile.ownerId = player.id;
                AudioEngine.buy();
                addLog(`${player.name} purchased ${tile.name} for £${tile.price}!`, "text-emerald-300");
                refreshBoardVisuals();
                updateHUD();
                if (onDone) onDone();
              }
            },
            {
              label: "Pass",
              cls: "bg-white/15 text-white",
              onClick: () => {
                if (game.houseRules.auctions) runPropertyAuction(player, tile, onDone);
                else if (onDone) onDone();
              }
            }
          ]
        );
      }

      function runPropertyAuction(firstPlayer, tile, onDone) {
        const bidders = game.players.filter((p) => !p.bankrupt && p.cash >= 10);
        const firstIndex = Math.max(0, bidders.findIndex((p) => p.id === firstPlayer.id));
        const ordered = bidders.slice(firstIndex + 1).concat(bidders.slice(0, firstIndex + 1));
        let eligible = ordered.slice();
        let highBid = 0;
        let highBidder = null;
        function nextBid() {
          if (eligible.length <= 1 && highBidder) {
            highBidder.cash -= highBid;
            tile.ownerId = highBidder.id;
            addLog(`${highBidder.name} won the auction for ${tile.name} at £${highBid}.`, "text-emerald-300");
            refreshBoardVisuals(); updateHUD();
            if (onDone) onDone();
            return;
          }
          if (eligible.length === 0) { if (onDone) onDone(); return; }
          const bidder = eligible[0];
          const minimum = highBid + 10;
          const finishBid = (raise) => {
            if (raise && bidder.cash >= minimum) {
              highBid = minimum; highBidder = bidder;
              eligible = eligible.slice(1).concat(bidder);
            }
            else eligible = eligible.filter((p) => p !== bidder);
            nextBid();
          };
          if (bidder.isBot) {
            finishBid(bidder.cash >= minimum && (highBid === 0 ? bidder.cash > tile.price * 0.7 : bidder.cash > minimum + 80));
          } else if (game.onlineMode && bidder.uid !== monopolyOnline.user?.uid) {
            monopolyOnline.createAuctionPrompt({
              targetUid: bidder.uid,
              tileId: tile.id,
              tileName: tile.name,
              highBid,
              minimum
            }).then((promptId) => {
              game.onlineAuctionCallbacks.set(promptId, finishBid);
              setOnlineStatus(`Waiting for ${bidder.name} to bid or pass on ${tile.name}…`);
              if (game.onlineRoom?.auctionResponses?.[promptId]) handleOnlineAuctionUpdates(game.onlineRoom);
            }).catch((error) => {
              setOnlineStatus(error.message || "Auction response failed; treating this as a pass.", true);
              finishBid(false);
            });
          } else {
            openModal("Property Auction", tile.name, `Current bid: £${highBid}${highBidder ? ` by ${highBidder.name}` : " • no bids yet"}`,
              `<p>Your cash: £${bidder.cash}. The minimum next bid is £${minimum}.</p>`,
              [{ label: `Bid £${minimum}`, disabled: bidder.cash < minimum, cls: "bg-emerald-400 text-slate-950", onClick: () => finishBid(true) },
               { label: "Pass", cls: "bg-white/15 text-white", onClick: () => finishBid(false) }]);
          }
        }
        nextBid();
      }

      function computeRent(tile, owner, diceSum) {
        if (tile.mortgaged) return 0;
        if (tile.type === "property") {
          const rent = tile.rents[tile.houses] || tile.rents[0];
          const sameGroup = BOARD_TILES.filter((t) => t.group === tile.group);
          const ownsAll = sameGroup.every((t) => t.ownerId === owner.id);
          return tile.houses === 0 && ownsAll ? rent * 2 : rent;
        }
        if (tile.type === "station") {
          const count = BOARD_TILES.filter((t) => t.type === "station" && t.ownerId === owner.id).length;
          return 25 * Math.pow(2, Math.max(0, count - 1));
        }
        if (tile.type === "utility") {
          const count = BOARD_TILES.filter((t) => t.type === "utility" && t.ownerId === owner.id).length;
          return (count >= 2 ? 10 : 4) * Math.max(2, diceSum);
        }
        return 0;
      }

      function handleTileLanding(player, tile, diceSum, onDone) {
        if (tile.type === "go") {
          const goMoney = game.houseRules.doubleGo ? 400 : 200;
          player.cash += goMoney;
          addLog(`${player.name} landed on Christchurch Quay & Priory GO and collected £${goMoney}.`, "text-emerald-300");
          updateHUD();
          showLandingEvent(player, tile, `You landed directly on GO and collected £${goMoney}.`, onDone);
          return;
        }

        if (tile.type === "tax") {
          const amt = tile.amount || 100;
          player.cash -= amt;
          if (game.houseRules.freeParking) game.parkingPot += amt;
          AudioEngine.rent();
          addLog(`${player.name} paid £${amt} (${tile.name})${game.houseRules.freeParking ? " to Hengistbury Pot" : " to the bank"}.`, "text-rose-300");
          updateHUD();
          showLandingEvent(player, tile, `You paid £${amt}${game.houseRules.freeParking ? "; it was added to the Free Parking pot." : " to the bank."}`, onDone);
          return;
        }

        if (tile.type === "parking") {
          let parkingMessage = "The Free Parking pot is empty.";
          if (game.parkingPot > 0) {
            const won = game.parkingPot;
            parkingMessage = `You collected £${won} from Free Parking.`;
            player.cash += won;
            game.parkingPot = 0;
            AudioEngine.passGo();
            addLog(`${player.name} collected £${won} from Free Parking!`, "text-amber-300");
          } else {
            addLog(`${player.name} enjoys coastal views at Hengistbury Head Car Park.`);
          }
          updateHUD();
          showLandingEvent(player, tile, parkingMessage, onDone);
          return;
        }

        if (tile.type === "jail") {
          showLandingEvent(player, tile, player.inJail ? "You are serving your detention." : "Just visiting. No action is needed.", onDone);
          return;
        }

        if (tile.type === "gotojail") {
          player.pos = 10;
          player.inJail = true;
          player.jailTurns = 0;
          updateTokenPositions();
          AudioEngine.rent();
          addLog(`${player.name} was sent to BCP Civic Detention!`, "text-rose-300");
          updateHUD();
          showLandingEvent(player, tile, "You have been sent to detention. Your turn ends here.", onDone);
          return;
        }

        if (tile.type === "chance" || tile.type === "chest") {
          const deck = tile.type === "chance" ? CHANCE_CARDS : CHEST_CARDS;
          const card = deck[Math.floor(Math.random() * deck.length)];
          AudioEngine.card();
          addLog(`${player.name} drew ${tile.type === "chance" ? "Chance" : "Chest"}: ${card.title}`, "text-sky-300");

          const applyCard = () => {
            const act = card.action;
            if (act.type === "money") {
              player.cash += act.amount;
            } else if (act.type === "payPot") {
              player.cash -= act.amount;
              if (game.houseRules.freeParking) game.parkingPot += act.amount;
            } else if (act.type === "moveTo") {
              if (act.tileId < player.pos && act.tileId !== 20) {
                const goMoney = game.houseRules.doubleGo ? 400 : 200;
                player.cash += goMoney;
                addLog(`${player.name} passed GO and collected £${goMoney}!`, "text-emerald-300");
              }
              player.pos = act.tileId;
              updateTokenPositions();
            } else if (act.type === "moveRel") {
              player.pos = (player.pos + act.steps + 40) % 40;
              updateTokenPositions();
            } else if (act.type === "gotoJail") {
              player.pos = 10;
              player.inJail = true;
              player.jailTurns = 0;
              updateTokenPositions();
            } else if (act.type === "getOutJail") {
              player.jailCards = (player.jailCards || 0) + 1;
            } else if (act.type === "fromEach") {
              for (const other of game.players) {
                if (other.id !== player.id && !other.bankrupt) {
                  other.cash -= act.amount;
                  player.cash += act.amount;
                }
              }
            } else if (act.type === "toEach") {
              for (const other of game.players) {
                if (other.id !== player.id && !other.bankrupt) {
                  player.cash -= act.amount;
                  other.cash += act.amount;
                }
              }
            } else if (act.type === "repairs") {
              let cost = 0;
              for (const t of BOARD_TILES) {
                if (t.ownerId === player.id && t.houses > 0) {
                  cost += t.houses === 5 ? act.perHotel : t.houses * act.perHouse;
                }
              }
              player.cash -= cost;
            }
            updateHUD();
            if (act.type === "moveTo" || act.type === "moveRel") {
              handleTileLanding(player, BOARD_TILES[player.pos], diceSum, onDone);
              return;
            }
            if (onDone) onDone();
          };

          if (player.isBot) {
            applyCard();
          } else {
            openModal(
              tile.type === "chance" ? "BCP Chance" : "BCP Community Chest",
              card.title,
              card.text,
              "",
              [{ label: "OK", cls: "bg-sky-500 text-slate-950", onClick: applyCard }]
            );
          }
          return;
        }

        if (tile.type === "property" || tile.type === "station" || tile.type === "utility") {
          if (!tile.ownerId) {
            promptBuyProperty(player, tile, onDone);
            return;
          }

          if (tile.ownerId === player.id) {
            showLandingEvent(player, tile, "You own this property. No rent is due.", onDone);
            return;
          }

          const owner = game.players.find((p) => p.id === tile.ownerId);
          if (!owner || owner.bankrupt) {
            showLandingEvent(player, tile, "This space is currently unowned.", onDone);
            return;
          }

          let rent = computeRent(tile, owner, diceSum);
          if (player.cash - rent < 0) player.debtCreditorId = owner.id;
          if (owner.teamId === player.teamId) {
            rent = Math.round(rent * 0.25);
            player.cash -= rent;
            owner.cash += rent;
            addLog(`${player.name} paid friendly 25% teammate rent (£${rent}) to ${owner.name}.`, "text-indigo-300");
          } else {
            player.cash -= rent;
            owner.cash += rent;
            AudioEngine.rent();
            addLog(`${player.name} paid £${rent} rent to ${owner.name} at ${tile.name}.`, "text-rose-300");
          }

          updateHUD();
          showLandingEvent(player, tile, `${player.name} paid £${rent} rent to ${owner.name}${owner.teamId === player.teamId ? " at the teammate rate" : ""}.`, onDone);
        }
      }

      // =========================================================================
      // 6. DICE ROLL, STEP MOVEMENT & TURN FLOW
      // =========================================================================
      function moveStepsAnimated(player, steps, onComplete) {
        if (steps <= 0) {
          if (onComplete) onComplete();
          return;
        }
        game.isMoving = true;
        player.animatingStep = true;
        updateHUD();

        let remaining = steps;
        function stepOnce() {
          if (remaining <= 0) {
            player.animatingStep = false;
            game.isMoving = false;
            updateTokenPositions();
            updateHUD();
            if (onComplete) onComplete();
            return;
          }

          const prevPos = player.pos;
          player.pos = (player.pos + 1) % 40;
          if (prevPos > player.pos) {
            const goMoney = game.houseRules.doubleGo ? 400 : 200;
            player.cash += goMoney;
            AudioEngine.passGo();
            addLog(`${player.name} passed Christchurch Quay GO and collected £${goMoney}!`, "text-emerald-300");
          } else {
            AudioEngine.step();
          }

          const target = getTileWorldPos(player.pos);
          player.mesh.position.x = target.x;
          player.mesh.position.z = target.z;
          player.mesh.position.y = target.y + 0.55;

          remaining -= 1;
          setTimeout(stepOnce, 150);
        }

        stepOnce();
      }

      function continueAfterRoll(player) {
        if (player.isBot) {
          if (!game.started || getCurrentPlayer() !== player || player.bankrupt) return;
          if (game.extraTurn) {
            game.extraTurn = false;
            game.hasRolled = false;
            updateHUD();
            window.setTimeout(() => {
              if (game.started && getCurrentPlayer() === player && !player.bankrupt) rollDiceForCurrentPlayer();
            }, 550);
          } else {
            window.setTimeout(() => {
              if (game.started && getCurrentPlayer() === player && !player.bankrupt) endTurn();
            }, 350);
          }
        } else if (game.extraTurn) {
          game.hasRolled = false;
          updateHUD();
        }
      }

      function startBotTurn(player) {
        window.setTimeout(() => {
          if (game.started && getCurrentPlayer() === player && !player.bankrupt) rollDiceForCurrentPlayer();
        }, 650);
      }

      function rollDiceForCurrentPlayer() {
        const player = getCurrentPlayer();
        if (!player || player.bankrupt || game.hasRolled || game.isMoving) return;
        if (game.onlineMode && player.uid !== monopolyOnline.user?.uid) return;
        if (player.inJail && player.jailCards > 0 && !player.jailChoiceMade) {
          if (player.isBot) {
            player.jailCards -= 1; player.inJail = false;
          } else {
            openModal("BCP Civic Detention", "Choose how to leave", "You have a Get Out of Detention Free card.",
              `<p>Use your card now, or try rolling doubles.</p>`,
              [{ label: "Use card", cls: "bg-emerald-400 text-slate-950", onClick: () => {
                player.jailCards -= 1; player.inJail = false; rollDiceForCurrentPlayer();
              } }, { label: "Try doubles", cls: "bg-white/15 text-white", onClick: () => {
                player.jailChoiceMade = true; rollDiceForCurrentPlayer();
              } }]);
            return;
          }
        }

        game.extraTurn = false;
        game.hasRolled = true;
        game.diceRollingTimer = 0.55;
        updateHUD();

        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        game.lastDice = [d1, d2];

        let ticks = 0;
        const tickInterval = setInterval(() => {
          AudioEngine.diceTick();
          ticks++;
          if (ticks >= 6) clearInterval(tickInterval);
        }, 85);

        setTimeout(() => {
          player.jailChoiceMade = false;
          setDieFaceRotation(die1Mesh, d1, 0.22);
          setDieFaceRotation(die2Mesh, d2, -0.18);
          updateHUD();

          if (player.inJail) {
            if (d1 === d2) {
              player.inJail = false;
              player.jailTurns = 0;
              addLog(`${player.name} rolled doubles (${d1}+${d2}) and left BCP Civic Detention!`, "text-emerald-300");
              moveStepsAnimated(player, d1 + d2, () => {
                handleTileLanding(player, BOARD_TILES[player.pos], d1 + d2, () => continueAfterRoll(player));
              });
            } else {
              player.jailTurns = (player.jailTurns || 0) + 1;
              if (player.jailTurns < 3) {
                addLog(`${player.name} did not roll doubles and stays in detention (${player.jailTurns}/3 attempts).`, "text-amber-300");
                updateHUD();
                continueAfterRoll(player);
                return;
              }
              player.cash -= 50;
              if (game.houseRules.freeParking) game.parkingPot += 50;
              player.inJail = false;
              addLog(`${player.name} paid the £50 release fine after three attempts.`, "text-amber-300");
              moveStepsAnimated(player, d1 + d2, () => handleTileLanding(player, BOARD_TILES[player.pos], d1 + d2, () => continueAfterRoll(player)));
            }
          } else {
            addLog(`${player.name} rolled ${d1} + ${d2} (${d1 + d2}).`);
            if (d1 === d2) {
              game.consecutiveDoubles += 1;
              if (game.consecutiveDoubles >= 3) {
                player.pos = 10; player.inJail = true; player.jailTurns = 0;
                game.consecutiveDoubles = 0;
                updateTokenPositions(); updateHUD();
                showLandingEvent(player, BOARD_TILES[10], "Three doubles in one turn sends you directly to detention.", () => continueAfterRoll(player));
                return;
              }
              game.extraTurn = true;
            } else game.consecutiveDoubles = 0;
            moveStepsAnimated(player, d1 + d2, () => {
              handleTileLanding(player, BOARD_TILES[player.pos], d1 + d2, () => continueAfterRoll(player));
            });
          }
        }, 560);
      }

      function canSellBuilding(tile, player) {
        if (!tile || tile.type !== "property" || tile.ownerId !== player.id || tile.houses <= 0) return false;
        const set = BOARD_TILES.filter((t) => t.group === tile.group && t.ownerId === player.id);
        if (set.length !== BOARD_TILES.filter((t) => t.group === tile.group).length) return false;
        const maxBuilt = Math.max(...set.map((t) => t.houses));
        if (tile.houses !== maxBuilt) return false;
        return tile.houses !== 5 || set.filter((t) => t.id !== tile.id).every((t) => t.houses >= 4);
      }

      function sellBuilding(tile, player) {
        if (!canSellBuilding(tile, player)) return false;
        const refund = Math.floor(COLOR_SETS[tile.group].houseCost / 2);
        tile.houses -= 1;
        player.cash += refund;
        AudioEngine.build();
        addLog(`${player.name} sold ${tile.houses === 4 ? "a hotel" : "a house"} at ${tile.name} for £${refund}.`, "text-amber-300");
        refreshBoardVisuals(); updateHUD();
        return true;
      }

      function openBuildMenu() {
        const player = getCurrentPlayer();
        if (!player || player.isBot || (game.onlineMode && player.uid !== monopolyOnline.user?.uid)) return;

        const canDevelop = (tile) => {
          if (tile.type !== "property" || tile.ownerId !== player.id || tile.mortgaged || tile.houses >= 5) return false;
          const set = BOARD_TILES.filter((t) => t.group === tile.group);
          if (!set.every((t) => t.ownerId === player.id && !t.mortgaged)) return false;
          return tile.houses === Math.min(...set.map((t) => t.houses));
        };
        const ownedProps = BOARD_TILES.filter((t) => t.type === "property" && t.ownerId === player.id &&
          (player.cash < 0 ? canSellBuilding(t, player) : t.houses < 5 && BOARD_TILES.filter((x) => x.group === t.group).every((x) => x.ownerId === player.id)));

        if (ownedProps.length === 0) {
          openModal(
            "Property Development",
            player.cash < 0 ? "No Buildings Available to Sell" : "No Buildable Properties",
            player.cash < 0 ? `You still owe £${Math.abs(player.cash)}. Check your properties to mortgage an eligible deed.` : "Own every property in a colour set to construct evenly spaced houses or hotels.",
            `<p class="text-slate-300">${player.cash < 0 ? "Mortgage options are available from the tile inspector." : "Click a tile to inspect its set and house costs."}</p>`,
            [{ label: "Close", cls: "bg-sky-500 text-slate-950" }]
          );
          return;
        }

        const listHtml = ownedProps
          .map((t) => {
            const cost = COLOR_SETS[t.group].houseCost;
            const selling = player.cash < 0;
            const nextLabel = t.houses === 4 ? "Hotel" : `House (${t.houses + 1}/4)`;
            const refund = Math.floor(COLOR_SETS[t.group].houseCost / 2);
            return `<div class="flex items-center justify-between rounded-xl bg-white/5 p-2.5 border border-white/10">
              <div>
                <div class="font-bold text-white">${t.name}</div>
                <div class="text-[11px] text-slate-400">Current: ${t.houses === 5 ? "Hotel" : t.houses + " Houses"} • Next: ${nextLabel} (£${cost})</div>
              </div>
              <button data-tid="${t.id}" class="build-item-btn btn-3d px-3 py-1.5 rounded-lg text-xs font-bold ${selling ? "bg-amber-400" : "bg-emerald-400"} text-slate-950 cursor-pointer" ${selling ? "" : player.cash < cost || !canDevelop(t) ? "disabled" : ""}>
                ${selling ? `Sell for £${refund}` : `Build £${cost}`}
              </button>
            </div>`;
          })
          .join("");

        openModal(
          player.cash < 0 ? "Debt Relief" : "Property Development",
          player.cash < 0 ? "Sell Houses & Hotels" : "Build Houses & Hotels",
          `Your Cash: £${player.cash}`,
          `<div class="space-y-2 max-h-60 overflow-y-auto">${listHtml}</div>`,
          [{ label: "Close", cls: "bg-white/15 text-white" }]
        );

        modalBody.querySelectorAll(".build-item-btn").forEach((b) => {
          b.addEventListener("click", () => {
            const tid = Number(b.dataset.tid);
            const prop = BOARD_TILES[tid];
            const cost = COLOR_SETS[prop.group].houseCost;
            if (player.cash < 0) {
              sellBuilding(prop, player);
              openBuildMenu();
              return;
            }
            if (player.cash >= cost && canDevelop(prop)) {
              player.cash -= cost;
              prop.houses += 1;
              AudioEngine.build();
              addLog(`${player.name} built ${prop.houses === 5 ? "a Hotel" : "a House"} at ${prop.name}!`, "text-emerald-300");
              refreshBoardVisuals();
              updateHUD();
              closeModal();
            }
          });
        });
      }

      function openTradeMenu() {
        const player = getCurrentPlayer();
        if (!player || player.isBot || (game.onlineMode && player.uid !== monopolyOnline.user?.uid)) return;

        const others = game.players.filter((p) => !p.bankrupt && p.id !== player.id);
        if (others.length === 0) return;
        let targetId = others[0].id;
        let giveCash = 0;
        let getCash = 0;
        let giveTiles = [];
        let getTiles = [];
        const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
        function renderOffer() {
          const target = others.find((p) => p.id === targetId) || others[0];
          targetId = target.id;
          const ourDeeds = BOARD_TILES.filter((t) => t.ownerId === player.id && t.houses === 0);
          const theirDeeds = BOARD_TILES.filter((t) => t.ownerId === target.id && t.houses === 0);
          const deedOptions = (list, side, selected) => list.length ? list.map((t) => `<label class="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-xs"><input type="checkbox" data-trade-side="${side}" data-trade-tile="${t.id}" ${selected.includes(t.id) ? "checked" : ""} class="accent-sky-400"><span class="flex-1">${escapeHtml(t.name)}${t.mortgaged ? " <span class='text-amber-300'>(mortgaged)</span>" : ""}</span><span class="text-slate-400">£${t.price}</span></label>`).join("") : `<div class="text-[11px] text-slate-500">No available deeds.</div>`;
          const options = others.map((p) => `<option value="${p.id}" ${p.id === target.id ? "selected" : ""}>${escapeHtml(p.name)} · ${getTeamById(p.teamId).label}</option>`).join("");
          openModal("Property Exchange", `Trade with ${target.name}`, "Select deeds and cash for each side of the offer.",
            `<label class="block text-xs text-slate-300 mb-3">Trading partner<select id="trade-target" class="mt-1 w-full rounded-lg bg-slate-800 border border-white/15 p-2 text-white">${options}</select></label>
             <div class="grid sm:grid-cols-2 gap-3"><div class="space-y-2"><div class="font-display font-bold text-xs text-sky-200">${escapeHtml(player.name)} gives</div><label class="block text-[11px] text-slate-300">Cash £<input id="trade-give-cash" type="number" min="0" step="10" value="${giveCash}" class="mt-1 w-full rounded-lg bg-slate-800 border border-white/15 p-2 text-white"></label><div class="trade-property-list space-y-1">${deedOptions(ourDeeds, "give", giveTiles)}</div></div>
             <div class="space-y-2"><div class="font-display font-bold text-xs text-amber-200">${escapeHtml(target.name)} gives</div><label class="block text-[11px] text-slate-300">Cash £<input id="trade-get-cash" type="number" min="0" step="10" value="${getCash}" class="mt-1 w-full rounded-lg bg-slate-800 border border-white/15 p-2 text-white"></label><div class="trade-property-list space-y-1">${deedOptions(theirDeeds, "get", getTiles)}</div></div></div>
             <p class="text-[10px] text-slate-500 mt-3">Properties with houses or hotels must be cleared before trading. The other player will review and confirm the offer.</p>`,
            [{ label: "Review Offer", cls: "bg-indigo-400 text-slate-950", onClick: reviewOffer }, { label: "Cancel", cls: "bg-white/15 text-white" }]);
          document.getElementById("trade-target").addEventListener("change", (event) => {
            giveCash = Number(document.getElementById("trade-give-cash").value) || 0;
            getCash = Number(document.getElementById("trade-get-cash").value) || 0;
            giveTiles = Array.from(modalBody.querySelectorAll('[data-trade-side="give"]:checked')).map((el) => Number(el.dataset.tradeTile));
            targetId = event.target.value; getTiles = []; renderOffer();
          });
          document.getElementById("trade-give-cash").addEventListener("input", (e) => { giveCash = Math.max(0, Number(e.target.value) || 0); });
          document.getElementById("trade-get-cash").addEventListener("input", (e) => { getCash = Math.max(0, Number(e.target.value) || 0); });
          modalBody.querySelectorAll("[data-trade-side]").forEach((el) => el.addEventListener("change", () => {
            giveTiles = Array.from(modalBody.querySelectorAll('[data-trade-side="give"]:checked')).map((x) => Number(x.dataset.tradeTile));
            getTiles = Array.from(modalBody.querySelectorAll('[data-trade-side="get"]:checked')).map((x) => Number(x.dataset.tradeTile));
          }));
        }
        function reviewOffer() {
          const target = game.players.find((p) => p.id === targetId && !p.bankrupt);
          const validGive = giveTiles.every((id) => BOARD_TILES[id].ownerId === player.id && BOARD_TILES[id].houses === 0);
          const validGet = getTiles.every((id) => BOARD_TILES[id].ownerId === target?.id && BOARD_TILES[id].houses === 0);
          if (!target || giveCash < 0 || getCash < 0 || giveCash > Math.max(0, player.cash) || getCash > Math.max(0, target.cash) || !validGive || !validGet) {
            openModal("Trade Not Available", "The offer has changed", "Check the cash and property selections and try again.", "", [{ label: "Back to Offer", cls: "bg-indigo-400 text-slate-950", onClick: renderOffer }]);
            return;
          }
          const deedNames = (ids) => ids.length ? ids.map((id) => escapeHtml(BOARD_TILES[id].name)).join(", ") : "no properties";
          const summary = `<div class="space-y-3 text-sm"><div class="rounded-xl bg-sky-500/10 border border-sky-400/20 p-3"><strong>${escapeHtml(player.name)} gives</strong><p class="text-slate-300">£${giveCash} and ${deedNames(giveTiles)}</p></div><div class="rounded-xl bg-amber-500/10 border border-amber-400/20 p-3"><strong>${escapeHtml(target.name)} gives</strong><p class="text-slate-300">£${getCash} and ${deedNames(getTiles)}</p></div><p class="text-xs text-slate-400">${escapeHtml(target.name)}, accept or decline this exchange.</p></div>`;
          if (game.onlineMode && !target.isBot) {
            openModal("Online Trade", "Send this offer to your opponent?", "They can accept or decline it on their device.", summary, [
              { label: "Send Offer", cls: "bg-indigo-400 text-slate-950", onClick: async () => {
                try {
                  await monopolyOnline.createTradeRequest({
                    offererName: player.name,
                    targetUid: target.uid,
                    giveCash,
                    getCash,
                    giveTiles,
                    getTiles
                  });
                  setOnlineStatus(`Trade offer sent to ${target.name}. They must accept it before it takes effect.`);
                } catch (error) {
                  setOnlineStatus(error.message || "Could not send the trade offer.", true);
                }
              } },
              { label: "Keep Editing", cls: "bg-white/15 text-white", onClick: renderOffer }
            ]);
            return;
          }
          const valueOf = (tileId, receiver, incoming) => {
            const tile = BOARD_TILES[tileId];
            let value = tile.price * (tile.mortgaged ? 0.35 : 0.65);
            if (tile.group) {
              const set = BOARD_TILES.filter((t) => t.group === tile.group);
              const held = set.filter((t) => t.ownerId === receiver.id || incoming.includes(t.id)).length;
              if (held === set.length) value += tile.price * 0.45;
            }
            return value;
          };
          const botAccepts = !target.isBot || giveCash + giveTiles.reduce((sum, id) => sum + valueOf(id, target, giveTiles), 0) >=
            getCash + getTiles.reduce((sum, id) => sum + valueOf(id, player, getTiles), 0);
          const responseText = target.isBot ? botAccepts ? `${target.name} accepts this offer.` : `${target.name} declines; the offer is too costly for the bot.` : `${target.name}, accept or decline this exchange.`;
          const confirmButtons = botAccepts ? [{ label: target.isBot ? "Complete AI-Accepted Trade" : "Accept Trade", cls: "bg-emerald-400 text-slate-950", onClick: () => {
              if (player.cash < giveCash || target.cash < getCash || !giveTiles.every((id) => BOARD_TILES[id].ownerId === player.id) || !getTiles.every((id) => BOARD_TILES[id].ownerId === target.id)) { updateHUD(); return; }
              player.cash += getCash - giveCash; target.cash += giveCash - getCash;
              giveTiles.forEach((id) => { BOARD_TILES[id].ownerId = target.id; });
              getTiles.forEach((id) => { BOARD_TILES[id].ownerId = player.id; });
              addLog(`${player.name} and ${target.name} completed a property trade.`, "text-indigo-300");
              refreshBoardVisuals(); updateHUD();
            } }] : [];
          confirmButtons.push({ label: target.isBot ? "Close" : "Decline", cls: "bg-white/15 text-white" });
          openModal("Trade Confirmation", "Review the exchange", responseText, summary, confirmButtons);
        }
        renderOffer();
      }

      function declareBankruptcy(player) {
        const creditor = game.players.find((p) => p.id === player.debtCreditorId && !p.bankrupt && p.id !== player.id);
        player.bankrupt = true;
        for (const tile of BOARD_TILES) {
          if (tile.ownerId === player.id) {
            tile.ownerId = creditor ? creditor.id : null;
            tile.houses = 0;
          }
        }
        addLog(`${player.name} declared bankruptcy${creditor ? `; their deeds went to ${creditor.name}` : " and returned their deeds to the bank"}.`, "text-rose-400");
        const eliminationBanner = document.getElementById("elimination-banner");
        document.getElementById("elimination-player-name").textContent = player.name;
        eliminationBanner.classList.remove("hidden");
        eliminationBanner.classList.add("elimination-show");
        refreshBoardVisuals();
        game.isMoving = true;
        game.bankruptcyAnimating = true;
        updateHUD();
        launchBankruptcyJump(player, () => {
          eliminationBanner.classList.remove("elimination-show");
          eliminationBanner.classList.add("hidden");
          game.isMoving = false;
          game.bankruptcyAnimating = false;
          endTurn();
        });
      }

      const bankruptcyJumps = [];
      const waterSplashAnimations = [];
      function makeWaterSplash(position, onComplete) {
        AudioEngine.splash();
        const group = new THREE.Group();
        group.position.set(position.x, -0.58, position.z);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.075, 8, 36), new THREE.MeshBasicMaterial({ color: 0x9befff, transparent: true, opacity: 0.9 }));
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);
        const droplets = [];
        for (let i = 0; i < 12; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.4 + Math.random() * 2.5;
          const size = 0.08 + Math.random() * 0.1;
          const bead = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 7), new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0xe0fbff : 0x38bdf8, transparent: true, opacity: 0.88 }));
          bead.position.set(Math.cos(angle) * 0.35, 0.1, Math.sin(angle) * 0.35);
          group.add(bead);
          droplets.push({ mesh: bead, vx: Math.cos(angle) * speed, vy: 2.8 + Math.random() * 1.7, vz: Math.sin(angle) * speed });
        }
        scene.add(group);
        waterSplashAnimations.push({ group, ring, droplets, elapsed: 0, duration: 0.95, onComplete });
      }

      function launchBankruptcyJump(player, onComplete) {
        const mesh = player.mesh;
        const start = mesh.position.clone();
        const outward = new THREE.Vector3(start.x, 0, start.z);
        if (outward.lengthSq() < 0.01) outward.set(0, 0, 1);
        outward.normalize();
        const destination = new THREE.Vector3(start.x + outward.x * 10, -0.5, start.z + outward.z * 10);
        const previousCamera = game.cameraMode;
        game.cameraMode = "zoom";
        bankruptcyJumps.push({ mesh, start, destination, elapsed: 0, duration: 1.35, onSplash: () => {
          mesh.visible = false;
          scene.remove(mesh);
          makeWaterSplash(destination, () => {
            game.cameraMode = previousCamera;
            if (onComplete) onComplete();
          });
        } });
      }

      function showDebtResolution(player) {
        const saleTiles = BOARD_TILES.filter((t) => canSellBuilding(t, player));
        const mortgagable = BOARD_TILES.filter((t) => t.ownerId === player.id && t.mortgage && !t.mortgaged &&
          (!t.group || !BOARD_TILES.some((other) => other.group === t.group && other.houses > 0)));
        const choices = [];
        saleTiles.forEach((tile) => {
          const refund = Math.floor(COLOR_SETS[tile.group].houseCost / 2);
          choices.push(`<button type="button" data-sell-tile="${tile.id}" class="debt-action btn-3d w-full rounded-xl px-3 py-2 text-left text-xs text-amber-100">Sell ${tile.houses === 5 ? "hotel" : "house"} at <strong>${tile.name}</strong><span class="float-right text-emerald-300">+£${refund}</span></button>`);
        });
        mortgagable.forEach((tile) => {
          choices.push(`<button type="button" data-mortgage-tile="${tile.id}" class="debt-action btn-3d w-full rounded-xl px-3 py-2 text-left text-xs text-amber-100">Mortgage <strong>${tile.name}</strong><span class="float-right text-emerald-300">+£${tile.mortgage}</span></button>`);
        });
        const stillOwes = player.cash < 0;
        const buttons = [{ label: stillOwes ? "Declare Bankruptcy" : "Finish Turn", cls: stillOwes ? "bg-rose-500 text-white" : "bg-emerald-400 text-slate-950", onClick: () => stillOwes ? declareBankruptcy(player) : endTurn() }];
        openModal("Debt Settlement", stillOwes ? `${player.name} owes £${Math.abs(player.cash)}` : "Debt paid off", "Sell buildings or mortgage properties to raise cash.",
          `<div class="space-y-2 max-h-64 overflow-y-auto pr-1">${choices.length ? choices.join("") : "<p class='text-slate-300'>No houses or unmortgaged deeds are available to sell or mortgage.</p>"}</div>
           <p class="mt-3 text-xs text-slate-400">A house or hotel sells for half its building cost. Buildings must be sold evenly within each colour set. A mortgaged property earns no rent.</p>`, buttons);
        modalBody.querySelectorAll("[data-sell-tile]").forEach((button) => button.addEventListener("click", () => {
          sellBuilding(BOARD_TILES[Number(button.dataset.sellTile)], player);
          showDebtResolution(player);
        }));
        modalBody.querySelectorAll("[data-mortgage-tile]").forEach((button) => button.addEventListener("click", () => {
          const tile = BOARD_TILES[Number(button.dataset.mortgageTile)];
          tile.mortgaged = true; player.cash += tile.mortgage;
          addLog(`${player.name} mortgaged ${tile.name} for £${tile.mortgage}.`, "text-amber-300");
          refreshBoardVisuals(); updateHUD(); showDebtResolution(player);
        }));
      }

      function endTurn() {
        const cur = getCurrentPlayer();
        if (game.onlineMode && cur?.uid !== monopolyOnline.user?.uid) return;
        if (game.extraTurn && cur) {
          game.extraTurn = false;
          game.hasRolled = false;
          updateHUD();
          if (cur.isBot) setTimeout(() => { if (game.started && getCurrentPlayer() === cur) rollDiceForCurrentPlayer(); }, 450);
          return;
        }
        game.consecutiveDoubles = 0;
        if (cur && !cur.bankrupt && cur.cash < 0) {
          if (cur.isBot) {
            while (cur.cash < 0) {
              const sale = BOARD_TILES.find((tile) => canSellBuilding(tile, cur));
              if (!sale) break;
              sellBuilding(sale, cur);
            }
            const mortgages = BOARD_TILES.filter((tile) => tile.ownerId === cur.id && tile.mortgage && !tile.mortgaged &&
              (!tile.group || !BOARD_TILES.some((other) => other.group === tile.group && other.houses > 0)));
            for (const tile of mortgages) {
              if (cur.cash >= 0) break;
              tile.mortgaged = true; cur.cash += tile.mortgage;
            }
            if (cur.cash < 0) { declareBankruptcy(cur); return; }
            refreshBoardVisuals(); updateHUD();
          } else {
          showDebtResolution(cur);
          return;
          }
        }

        const active = game.players.filter((p) => !p.bankrupt);
        const activeTeams = new Set(active.map((p) => p.teamId));
        if (active.length <= 1 || activeTeams.size <= 1) {
          const winner = active[0];
          game.winnerUid = winner?.uid || null;
          updateHUD();
          openModal(
            "Match Complete",
            winner ? `${winner.name} (${getTeamById(winner.teamId).label}) Wins!` : "Game Over",
            "BCP Monopoly 3D Championship",
            `<p class="text-slate-200">Final Cash: <strong class="text-emerald-300">£${winner ? winner.cash : 0}</strong> • Hengistbury Pot: £${game.parkingPot}</p>`,
            [{ label: "Play Again", cls: "bg-emerald-400 text-slate-950", onClick: () => startNewMatch() }]
          );
          return;
        }

        let nextIdx = (game.turnIndex + 1) % game.players.length;
        while (game.players[nextIdx].bankrupt) {
          nextIdx = (nextIdx + 1) % game.players.length;
        }

        game.turnIndex = nextIdx;
        game.hasRolled = false;
        game.extraTurn = false;
        game.consecutiveDoubles = 0;
        game.lastDice = [0, 0];
        updateHUD();

        const nextPlayer = getCurrentPlayer();
        if (nextPlayer && nextPlayer.isBot) startBotTurn(nextPlayer);
      }

      function skipOfflinePlayerTurn() {
        const current = getCurrentPlayer();
        const roomSeat = getOnlineSeats(game.onlineRoom).find((player) => player.uid === current?.uid);
        if (!game.onlineMode || !monopolyOnline.isHost || roomSeat?.connected !== false || game.isMoving || game.bankruptcyAnimating) return;
        let nextIndex = (game.turnIndex + 1) % game.players.length;
        while (game.players[nextIndex].bankrupt && nextIndex !== game.turnIndex) nextIndex = (nextIndex + 1) % game.players.length;
        if (nextIndex === game.turnIndex) return;
        game.turnIndex = nextIndex;
        game.hasRolled = false;
        game.extraTurn = false;
        game.consecutiveDoubles = 0;
        game.lastDice = [0, 0];
        addLog(`The host skipped ${current.name}'s turn because they disconnected.`, "text-amber-300");
        updateHUD();
      }

      function startNewMatch(remoteConfigs = null) {
        AudioEngine.init();
        AudioEngine.startBgm();
        clearPlayersFromScene();

        if (Array.isArray(remoteConfigs)) {
          game.setupConfigs = remoteConfigs;
          game.playerCount = remoteConfigs.length;
        }

        game.started = true;
        game.winnerUid = null;
        game.onlineWinnerShown = false;
        game.turnIndex = 0;
        game.hasRolled = false;
        game.isMoving = false;
        game.extraTurn = false;
        game.consecutiveDoubles = 0;
        game.lastDice = [0, 0];
        game.parkingPot = 0;
        game.logs = [];
        game.cameraMode = "follow";

        for (let i = 0; i < game.playerCount; i++) {
          const cfg = game.setupConfigs[i];
          const charStyle = CHARACTER_STYLES.find((c) => c.id === cfg.charId) || CHARACTER_STYLES[i % CHARACTER_STYLES.length];
          const mesh = createCharacterMesh(charStyle);
          scene.add(mesh);

          game.players.push({
            id: cfg.uid || `p_${i + 1}`,
            uid: cfg.uid || null,
            name: cfg.name,
            isBot: cfg.isBot,
            teamId: cfg.teamId,
            charId: cfg.charId,
            cash: game.houseRules.startingCash,
            pos: 0,
            inJail: false,
            bankrupt: false,
            animatingStep: false,
            mesh
          });
        }

        updateTokenPositions();
        refreshBoardVisuals();
        updateHUD();

        const setupModal = document.getElementById("setup-modal");
        setupModal.classList.remove("menu-entry");
        setupModal.classList.add("menu-exit");
        window.setTimeout(() => {
          setupModal.classList.add("hidden");
          setupModal.classList.remove("menu-exit");
        }, 430);
        document.getElementById("game-hud").classList.remove("hidden");
        document.getElementById("bottom-hud").classList.remove("hidden");

        addLog("Welcome to BCP Monopoly 3D! Twynham School is Dark Blue (#39).", "text-sky-300");

        const first = getCurrentPlayer();
        if (first && first.isBot) startBotTurn(first);
      }

      // =========================================================================
      // 7. CAMERA CONTROLS, BUTTON LISTENERS & MAIN RENDER LOOP
      // =========================================================================
      function setSetupMode(isOnline) {
        document.getElementById("online-lobby-panel").classList.toggle("hidden", !isOnline);
        document.getElementById("local-player-setup").classList.toggle("hidden", isOnline);
        document.getElementById("start-match-btn").classList.toggle("hidden", isOnline);
        document.querySelector(".setup-columns").style.gridTemplateColumns = isOnline ? "1fr" : "";
        document.getElementById("online-mode-btn").className = isOnline
          ? "btn-3d rounded-xl px-4 py-2 text-xs font-bold bg-sky-500 text-slate-950"
          : "btn-3d rounded-xl px-4 py-2 text-xs font-bold bg-white/10 text-white border border-white/15";
        document.getElementById("local-mode-btn").className = !isOnline
          ? "btn-3d rounded-xl px-4 py-2 text-xs font-bold bg-sky-500 text-slate-950"
          : "btn-3d rounded-xl px-4 py-2 text-xs font-bold bg-white/10 text-white border border-white/15";
      }

      async function hostOnlineRoom() {
        const button = document.getElementById("online-host-btn");
        button.disabled = true;
        setOnlineStatus("Connecting to Firebase and creating a room…");
        try {
          const code = await monopolyOnline.create(document.getElementById("online-player-name").value, getOnlineSettings());
          document.getElementById("online-room-code").value = code;
          setOnlineStatus(`Room ${code} created. Share the code and wait for at least one more player.`);
        } catch (error) {
          setOnlineStatus(onlineErrorMessage(error), true);
        } finally {
          button.disabled = false;
        }
      }

      async function joinOnlineRoom() {
        const button = document.getElementById("online-join-btn");
        button.disabled = true;
        setOnlineStatus("Looking for the room…");
        try {
          const code = await monopolyOnline.join(document.getElementById("online-room-code").value, document.getElementById("online-player-name").value);
          document.getElementById("online-room-code").value = code;
          const cleanInviteUrl = new URL(window.location.href);
          cleanInviteUrl.searchParams.delete("room");
          window.history.replaceState({}, "", cleanInviteUrl);
          setOnlineStatus(`Joined room ${code}.`);
        } catch (error) {
          setOnlineStatus(onlineErrorMessage(error), true);
        } finally {
          button.disabled = false;
        }
      }

      function onlineErrorMessage(error) {
        const message = String(error?.message || "");
        if (/permission_denied|permission denied/i.test(message)) {
          return "Firebase denied the room request. Publish the latest full database.rules.json (including monopolyRooms) and enable Anonymous sign-in.";
        }
        return message || "The online room request failed. Check Firebase setup and your connection.";
      }

      async function startOnlineMatch() {
        const room = game.onlineRoom;
        const seats = getOnlineSeats(room);
        if (!room || !monopolyOnline.isHost || seats.length < 2) {
          setOnlineStatus("The host can start once at least two players have joined.", true);
          return;
        }
        backupLocalSetup();
        game.onlineMode = true;
        game.onlineStartedFromRoom = true;
        game.onlineLastRevision = 0;
        game.onlineWinnerShown = false;
        game.mapId = room.settings?.mapId || game.mapId;
        game.houseRules = { ...game.houseRules, ...(room.settings?.houseRules || {}) };
        game.setupConfigs = seats.map((player, index) => ({
          uid: player.uid, name: player.name, isBot: false,
          teamId: ["Alpha", "Beta", "Gamma", "Delta"][index],
          charId: ["scholar", "sailor", "ranger", "pilot"][index]
        }));
        game.playerCount = seats.length;
        game.applyingOnlineState = true;
        startNewMatch(game.setupConfigs);
        game.applyingOnlineState = false;
        clearTimeout(game.onlineSyncTimer);
        const initialState = serializeOnlineState();
        initialState.revision = 1;
        game.onlineLastRevision = 1;
        try {
          await monopolyOnline.start(initialState);
          setOnlineStatus("Match started. The room host takes the first turn.");
        } catch (error) {
          setOnlineStatus(error.message || "Could not start the online match.", true);
        }
      }

      document.getElementById("local-mode-btn").addEventListener("click", () => setSetupMode(false));
      document.getElementById("online-mode-btn").addEventListener("click", () => setSetupMode(true));
      document.getElementById("online-host-btn").addEventListener("click", hostOnlineRoom);
      document.getElementById("online-join-btn").addEventListener("click", joinOnlineRoom);
      document.getElementById("online-start-btn").addEventListener("click", startOnlineMatch);
      document.getElementById("online-copy-btn").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(monopolyOnline.code || "");
          setOnlineStatus("Room code copied to clipboard.");
        } catch {
          setOnlineStatus("Select and copy the room code shown above.", true);
        }
      });
      document.getElementById("online-share-btn").addEventListener("click", async () => {
        if (!monopolyOnline.code) return;
        const inviteUrl = new URL(window.location.href);
        inviteUrl.searchParams.set("room", monopolyOnline.code);
        try {
          await navigator.clipboard.writeText(inviteUrl.toString());
          setOnlineStatus("Invite link copied. Your friend can set a temporary name and join.");
        } catch {
          setOnlineStatus(`Copy this invite link: ${inviteUrl.toString()}`);
        }
      });
      document.getElementById("online-leave-btn").addEventListener("click", async () => {
        const wasWaiting = game.onlineRoom?.status === "waiting";
        const wasHost = monopolyOnline.isHost;
        try {
          await monopolyOnline.leave();
        } catch (error) {
          setOnlineStatus(error.message || "Could not leave the waiting room.", true);
          return;
        }
        restoreLocalSetup();
        game.onlineMode = false;
        game.onlineStartedFromRoom = false;
        game.onlineRoom = null;
        game.onlineLastRevision = 0;
        game.started = false;
        document.getElementById("online-room-members").innerHTML = "";
        document.getElementById("online-room-code-label").classList.add("hidden");
        document.getElementById("online-copy-btn").classList.add("hidden");
        document.getElementById("online-share-btn").classList.add("hidden");
        document.getElementById("online-leave-btn").classList.add("hidden");
        document.getElementById("online-start-btn").classList.add("hidden");
        document.getElementById("online-host-btn").disabled = false;
        document.getElementById("online-join-btn").disabled = false;
        document.querySelectorAll(".map-choice, #house-rules-preset, #rule-free-parking, #rule-auctions, #rule-double-go, #rule-start-cash").forEach((input) => { input.disabled = false; });
        setOnlineStatus(wasWaiting ? wasHost ? "Room closed. Its waiting players have been disconnected." : "You left the waiting room and freed your seat." : "Disconnected from the active match. Your seat is reserved so you can reconnect with the same room code.");
      });

      document.getElementById("start-match-btn").addEventListener("click", () => startNewMatch());

      const inviteCode = new URLSearchParams(window.location.search).get("room")?.trim().toUpperCase();
      if (/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(inviteCode || "")) {
        setSetupMode(true);
        document.getElementById("online-room-code").value = inviteCode;
        setOnlineStatus("You were invited to this room. Set your temporary name, check the host's map and house rules, then join.");
        requestAnimationFrame(() => document.getElementById("online-player-name")?.focus());
      }
      document.getElementById("new-game-btn").addEventListener("click", () => {
        game.started = false;
        document.getElementById("game-hud").classList.add("hidden");
        document.getElementById("bottom-hud").classList.add("hidden");
        const setupModal = document.getElementById("setup-modal");
        setupModal.classList.remove("hidden", "menu-exit", "menu-entry");
        void setupModal.offsetWidth;
        setupModal.classList.add("menu-entry");
        setSetupMode(game.onlineMode);
      });

      document.getElementById("roll-btn").addEventListener("click", rollDiceForCurrentPlayer);
      document.getElementById("build-btn").addEventListener("click", openBuildMenu);
      document.getElementById("trade-btn").addEventListener("click", openTradeMenu);
      document.getElementById("end-turn-btn").addEventListener("click", endTurn);
      document.getElementById("skip-offline-btn").addEventListener("click", skipOfflinePlayerTurn);

      document.getElementById("cam-follow-btn").addEventListener("click", () => {
        game.cameraMode = "follow";
      });
      document.getElementById("cam-zoom-btn").addEventListener("click", () => {
        game.cameraMode = "zoom";
        const cur = getCurrentPlayer();
        if (cur) game.camLookAt.copy(cur.mesh.position);
      });
      document.getElementById("cam-overview-btn").addEventListener("click", () => {
        game.cameraMode = "overview";
      });
      document.getElementById("cam-twynham-btn").addEventListener("click", () => {
        game.cameraMode = "twynham";
      });

      document.getElementById("mute-btn").addEventListener("click", () => {
        const m = !AudioEngine.isMuted();
        AudioEngine.setMuted(m);
        document.getElementById("icon-sound-on").classList.toggle("hidden", m);
        document.getElementById("icon-sound-off").classList.toggle("hidden", !m);
      });

      let draggingOrbit = false;
      let prevPointer = { x: 0, y: 0 };

      canvas.addEventListener("mousedown", (e) => {
        draggingOrbit = true;
        prevPointer = { x: e.clientX, y: e.clientY };
      });
      window.addEventListener("mouseup", () => {
        draggingOrbit = false;
      });
      window.addEventListener("mousemove", (e) => {
        if (!draggingOrbit) return;
        const dx = e.clientX - prevPointer.x;
        const dy = e.clientY - prevPointer.y;
        prevPointer = { x: e.clientX, y: e.clientY };
        game.orbitYaw -= dx * 0.006;
        game.orbitPitch = Math.max(0.22, Math.min(1.38, game.orbitPitch + dy * 0.006));
      });
      canvas.addEventListener("wheel", (e) => {
        game.orbitDistance = Math.max(8, Math.min(68, game.orbitDistance + e.deltaY * 0.02));
      }, { passive: true });

      window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      });

      let lastNow = performance.now();
      function animate(now) {
        requestAnimationFrame(animate);
        const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
        lastNow = now;

        for (let i = bankruptcyJumps.length - 1; i >= 0; i--) {
          const jump = bankruptcyJumps[i];
          jump.elapsed += dt;
          const t = Math.min(1, jump.elapsed / jump.duration);
          jump.mesh.position.lerpVectors(jump.start, jump.destination, t);
          jump.mesh.position.y += Math.sin(t * Math.PI) * 5.2;
          jump.mesh.rotation.x += dt * 3.8;
          jump.mesh.rotation.z += dt * 5.2;
          if (t >= 1) {
            bankruptcyJumps.splice(i, 1);
            jump.onSplash();
          }
        }

        for (let i = waterSplashAnimations.length - 1; i >= 0; i--) {
          const splash = waterSplashAnimations[i];
          splash.elapsed += dt;
          const t = Math.min(1, splash.elapsed / splash.duration);
          splash.ring.scale.setScalar(1 + t * 3.3);
          splash.ring.material.opacity = 0.9 * (1 - t);
          for (const drop of splash.droplets) {
            drop.mesh.position.x += drop.vx * dt;
            drop.mesh.position.y += drop.vy * dt;
            drop.mesh.position.z += drop.vz * dt;
            drop.vy -= 5.8 * dt;
            drop.mesh.material.opacity = 0.9 * (1 - t);
          }
          if (t >= 1) {
            waterSplashAnimations.splice(i, 1);
            scene.remove(splash.group);
            splash.group.traverse((obj) => {
              if (obj.geometry) obj.geometry.dispose();
              if (obj.material) obj.material.dispose();
            });
            if (splash.onComplete) splash.onComplete();
          }
        }

        // Rotate Twynham School crest
        if (twynhamCrestMesh) {
          twynhamCrestMesh.rotation.y += dt * 1.9;
          twynhamCrestMesh.position.y = 2.75 + Math.sin(now * 0.0032) * 0.14;
        }

        // Animate harbour boats & multi-layer water scroll
        PBRTextures.water.map.offset.x = (now * 0.000018) % 1;
        PBRTextures.water.map.offset.y = (now * 0.000012) % 1;
        PBRTextures.water.normalMap.offset.x = (now * -0.000014) % 1;
        PBRTextures.water.normalMap.offset.y = (now * 0.000021) % 1;
        PBRTextures.water.roughnessMap.offset.copy(PBRTextures.water.map.offset);
        PBRTextures.fountainWater.normalMap.offset.x = Math.sin(now * 0.0012) * 0.03;
        PBRTextures.fountainWater.normalMap.offset.y = Math.cos(now * 0.001) * 0.03;
        for (const hb of harbourBoats) {
          const ang = now * 0.00025 * hb.speed + hb.phase;
          hb.mesh.position.x = Math.cos(ang) * hb.radius;
          hb.mesh.position.z = Math.sin(ang) * hb.radius;
          hb.mesh.position.y = -0.68 + Math.sin(now * 0.003 + hb.phase) * 0.06;
          hb.mesh.rotation.y = -ang + (hb.speed > 0 ? 0 : Math.PI);
        }

        // Dice tumble animation
        if (game.diceRollingTimer > 0) {
          game.diceRollingTimer -= dt;
          diceGroup.position.y = 1.35 + Math.abs(Math.sin(now * 0.02)) * 1.4;
          die1Mesh.rotation.x += dt * 18;
          die1Mesh.rotation.y += dt * 15;
          die2Mesh.rotation.x -= dt * 16;
          die2Mesh.rotation.z += dt * 14;
        } else {
          diceGroup.position.y = 1.25 + Math.sin(now * 0.0025) * 0.08;
        }

        // Camera preset transitions
        const cur = getCurrentPlayer();
        if (game.cameraMode === "twynham") {
          const twPos = getTileWorldPos(39);
          game.camLookAt.lerp(twPos, Math.min(1, dt * 5));
          game.camDesiredPos.set(twPos.x + 8, 8.5, twPos.z + 8);
        } else if (game.cameraMode === "zoom" && cur) {
          game.camLookAt.lerp(cur.mesh.position, Math.min(1, dt * 6));
          game.camDesiredPos.set(cur.mesh.position.x + 5.5, 5.2, cur.mesh.position.z + 5.5);
        } else if (game.cameraMode === "overview") {
          game.camLookAt.lerp(new THREE.Vector3(0, 0.5, 0), Math.min(1, dt * 5));
          game.camDesiredPos.set(0, 44, 24);
        } else {
          const focus = cur ? cur.mesh.position : new THREE.Vector3(0, 0, 0);
          game.camLookAt.lerp(focus.clone().multiplyScalar(0.35), Math.min(1, dt * 4));
          const dist = game.orbitDistance;
          game.camDesiredPos.set(
            game.camLookAt.x + Math.sin(game.orbitYaw) * Math.cos(game.orbitPitch) * dist,
            Math.max(4, Math.sin(game.orbitPitch) * dist),
            game.camLookAt.z + Math.cos(game.orbitYaw) * Math.cos(game.orbitPitch) * dist
          );
        }

        camera.position.lerp(game.camDesiredPos, Math.min(1, dt * 6));
        camera.lookAt(game.camLookAt);

        renderer.render(scene, camera);
      }

      requestAnimationFrame(animate);
    })();
