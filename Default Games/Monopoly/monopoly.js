/**
     * BCP MONOPOLY 3D — Christchurch & BCP Edition
     * Main game controller. Board data, layout and gameplay systems are kept in
     * named sections so they can be edited without searching through the HTML.
     */
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
        function makeCanvas(w, h) {
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          return c;
        }

        function createWaterTextures() {
          const c = makeCanvas(512, 512);
          const ctx = c.getContext("2d");
          const grad = ctx.createLinearGradient(0, 0, 512, 512);
          grad.addColorStop(0, "#092a46");
          grad.addColorStop(0.5, "#0e436e");
          grad.addColorStop(1, "#072138");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 512, 512);

          let seed = 4129;
          const rand = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
          };

          for (let i = 0; i < 420; i++) {
            const x = rand() * 512;
            const y = rand() * 512;
            const w = 18 + rand() * 44;
            ctx.strokeStyle = rand() > 0.35 ? "rgba(125, 211, 252, 0.14)" : "rgba(224, 242, 254, 0.18)";
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + w * 0.5, y - 4, x + w, y + 1);
            ctx.stroke();
          }

          const map = new THREE.CanvasTexture(c);
          map.wrapS = map.wrapT = THREE.RepeatWrapping;
          map.repeat.set(18, 18);
          return { map };
        }

        function createTurfTextures() {
          const c = makeCanvas(512, 512);
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#1d5636";
          ctx.fillRect(0, 0, 512, 512);

          let seed = 8821;
          const rand = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
          };

          for (let i = 0; i < 4500; i++) {
            const x = rand() * 512;
            const y = rand() * 512;
            ctx.fillStyle = rand() > 0.5 ? "rgba(74, 222, 128, 0.12)" : "rgba(15, 46, 28, 0.22)";
            ctx.fillRect(x, y, 2, 5);
          }

          const rCanvas = makeCanvas(256, 256);
          const rCtx = rCanvas.getContext("2d");
          rCtx.fillStyle = "#c4c4c4";
          rCtx.fillRect(0, 0, 256, 256);
          for (let i = 0; i < 900; i++) {
            const v = Math.floor(170 + rand() * 75);
            rCtx.fillStyle = `rgb(${v},${v},${v})`;
            rCtx.fillRect(rand() * 256, rand() * 256, 4, 4);
          }

          const map = new THREE.CanvasTexture(c);
          map.wrapS = map.wrapT = THREE.RepeatWrapping;
          map.repeat.set(4, 4);

          const roughnessMap = new THREE.CanvasTexture(rCanvas);
          roughnessMap.wrapS = roughnessMap.wrapT = THREE.RepeatWrapping;
          roughnessMap.repeat.set(4, 4);

          return { map, roughnessMap };
        }

        function createFacadeTexture(baseHex, accentHex = "#e2e8f0") {
          const c = makeCanvas(256, 256);
          const ctx = c.getContext("2d");
          ctx.fillStyle = baseHex;
          ctx.fillRect(0, 0, 256, 256);

          ctx.strokeStyle = "rgba(15, 23, 42, 0.14)";
          ctx.lineWidth = 2;
          for (let y = 16; y < 256; y += 24) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(256, y);
            ctx.stroke();
          }

          const cols = 4;
          const rows = 3;
          for (let r = 0; r < rows; r++) {
            for (let col = 0; col < cols; col++) {
              const wx = 26 + col * 56;
              const wy = 34 + r * 66;
              ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
              ctx.fillRect(wx - 2, wy - 2, 32, 40);
              ctx.fillStyle = (r + col) % 3 === 0 ? "#fef08a" : "#7dd3fc";
              ctx.fillRect(wx, wy, 28, 36);

              ctx.fillStyle = accentHex;
              ctx.fillRect(wx + 13, wy, 2, 36);
              ctx.fillRect(wx, wy + 17, 28, 2);
            }
          }

          const tex = new THREE.CanvasTexture(c);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          return tex;
        }

        return {
          water: createWaterTextures(),
          turf: createTurfTextures(),
          createFacadeTexture
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

      // Harbour & coastal sea plane with procedural ripples
      const seaMesh = new THREE.Mesh(
        new THREE.CircleGeometry(180, 72),
        new THREE.MeshStandardMaterial({
          map: PBRTextures.water.map,
          roughness: 0.28,
          metalness: 0.45
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
        new THREE.MeshStandardMaterial({ color: 0x0f253b, roughness: 0.52, metalness: 0.32 })
      );
      slabMesh.position.y = -0.4;
      slabMesh.receiveShadow = true;
      slabMesh.castShadow = true;
      boardGroup.add(slabMesh);

      const brassTrim = new THREE.Mesh(
        new THREE.BoxGeometry(BOARD_SIZE + 2.55, 0.14, BOARD_SIZE + 2.55),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.72 })
      );
      brassTrim.position.y = 0.04;
      boardGroup.add(brassTrim);

      const innerLawn = new THREE.Mesh(
        new THREE.BoxGeometry(BOARD_SIZE - TILE_SIZE * 1.85, 0.28, BOARD_SIZE - TILE_SIZE * 1.85),
        new THREE.MeshStandardMaterial({
          map: PBRTextures.turf.map,
          roughnessMap: PBRTextures.turf.roughnessMap,
          roughness: 0.85,
          metalness: 0.04
        })
      );
      innerLawn.position.y = 0.09;
      innerLawn.receiveShadow = true;
      boardGroup.add(innerLawn);

      // Decorative courtyard walkways & fountain basin
      const pathMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78 });
      const pathNS = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, BOARD_SIZE - TILE_SIZE * 2.2), pathMat);
      pathNS.position.y = 0.24;
      pathNS.receiveShadow = true;
      boardGroup.add(pathNS);

      const pathEW = new THREE.Mesh(new THREE.BoxGeometry(BOARD_SIZE - TILE_SIZE * 2.2, 0.05, 1.4), pathMat);
      pathEW.position.y = 0.24;
      pathEW.receiveShadow = true;
      boardGroup.add(pathEW);

      const fountainBasin = new THREE.Mesh(
        new THREE.CylinderGeometry(2.1, 2.35, 0.45, 24),
        new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5 })
      );
      fountainBasin.position.set(0, 0.42, 0);
      fountainBasin.castShadow = true;
      fountainBasin.receiveShadow = true;
      boardGroup.add(fountainBasin);

      const fountainWater = new THREE.Mesh(
        new THREE.CylinderGeometry(1.82, 1.82, 0.1, 24),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.15, metalness: 0.3 })
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
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
        if (isTwynham) {
          bgGrad.addColorStop(0, "#eff6ff");
          bgGrad.addColorStop(1, "#dbeafe");
        } else {
          bgGrad.addColorStop(0, "#ffffff");
          bgGrad.addColorStop(1, "#eef2f6");
        }
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 512, 512);

        ctx.strokeStyle = isTwynham ? "#1e3a8a" : "#94a3b8";
        ctx.lineWidth = isTwynham ? 18 : 10;
        ctx.strokeRect(8, 8, 496, 496);

        if (tile.group && COLOR_SETS[tile.group]) {
          ctx.fillStyle = COLOR_SETS[tile.group].hex;
          ctx.fillRect(16, 16, 480, 112);
          ctx.fillStyle = "rgba(255,255,255,0.22)";
          ctx.fillRect(16, 16, 480, 18);
        } else if (tile.type === "station") {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(16, 16, 480, 88);
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 32px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("BCP TRANSIT", 256, 70);
        } else if (tile.type === "utility") {
          ctx.fillStyle = "#0369a1";
          ctx.fillRect(16, 16, 480, 88);
          ctx.fillStyle = "#e0f2fe";
          ctx.font = "bold 32px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("BCP UTILITY", 256, 70);
        }

        ctx.fillStyle = "#0f172a";
        ctx.font = isTwynham ? "bold 46px Fredoka, sans-serif" : "bold 40px Fredoka, sans-serif";
        ctx.textAlign = "center";

        const words = tile.name.split(" ");
        const lines = [];
        let cur = "";
        for (const w of words) {
          const test = cur ? `${cur} ${w}` : w;
          if (test.length > 15 && cur) {
            lines.push(cur);
            cur = w;
          } else {
            cur = test;
          }
        }
        if (cur) lines.push(cur);

        let y = tile.group ? 192 : 168;
        for (const line of lines.slice(0, 3)) {
          ctx.fillText(line, 256, y);
          y += 50;
        }

        if (tile.price) {
          ctx.fillStyle = isTwynham ? "#1e3a8a" : "#047857";
          ctx.font = "bold 42px Inter, sans-serif";
          ctx.fillText(`£${tile.price}`, 256, 452);
        } else if (tile.amount) {
          ctx.fillStyle = "#b91c1c";
          ctx.font = "bold 38px Inter, sans-serif";
          ctx.fillText(`Pay £${tile.amount}`, 256, 452);
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
          roughness: 0.45,
          metalness: 0.05
        });
        const sideMat = new THREE.MeshStandardMaterial({
          color: tile.id === 39 ? 0x1e3a8a : 0xe2e8f0,
          roughness: 0.6
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

          const mainHall = new THREE.Mesh(
            new THREE.BoxGeometry(1.45, 1.5, 2.25),
            new THREE.MeshStandardMaterial({
              map: PBRTextures.createFacadeTexture("#1e3a8a", "#93c5fd"),
              roughness: 0.4,
              metalness: 0.25
            })
          );
          mainHall.position.y = 0.75;
          mainHall.castShadow = true;
          mainHall.receiveShadow = true;
          schoolBuilding.add(mainHall);

          const clockTower = new THREE.Mesh(
            new THREE.BoxGeometry(0.65, 2.1, 0.65),
            new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.45, metalness: 0.3 })
          );
          clockTower.position.set(0.25, 1.05, 0.75);
          clockTower.castShadow = true;
          schoolBuilding.add(clockTower);

          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(1.42, 0.85, 4),
            new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.35, metalness: 0.2 })
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
              metalness: 0.6
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
          color, roughness: options.roughness ?? 0.62, metalness: options.metalness ?? 0.08,
          emissive: options.emissive ?? 0x000000, emissiveIntensity: options.emissiveIntensity ?? 0
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position[0], position[1], position[2]);
        mesh.castShadow = options.castShadow !== false;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
      }

      function addPalmTree(group, x, z, leafColor = 0x238c68) {
        const trunk = addSceneryMesh(group, new THREE.CylinderGeometry(0.12, 0.22, 2.5, 9), 0x9a683d, [x, 1.25, z]);
        trunk.rotation.z = x < 0 ? -0.08 : 0.08;
        for (let i = 0; i < 7; i++) {
          const frond = addSceneryMesh(group, new THREE.ConeGeometry(0.28, 1.7, 5), leafColor, [x + Math.cos(i * 0.9) * 0.52, 2.45, z + Math.sin(i * 0.9) * 0.52]);
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
              mats.forEach((mat) => { if (mat.map) mat.map.dispose(); mat.dispose(); });
            }
          });
        }
        const group = new THREE.Group();
        townSceneryGroup = group;
        const map = MAP_THEMES[mapId] || MAP_THEMES.christchurch;
        const districtSets = {
          christchurch: [
            [-7.1, -6.8, 3.0, 3.4, 2.8, "#c5a981", 0x684b36], [7.0, -6.6, 2.8, 2.7, 2.8, "#d5c29c", 0x803c2b],
            [-7.0, 6.8, 2.8, 2.2, 2.6, "#c7b38e", 0x80563a], [7.0, 6.7, 2.9, 2.8, 2.8, "#d6c09b", 0x634a38]
          ],
          bournemouth: [
            [-7.1, -6.8, 3.2, 3.8, 2.8, "#f0d7ae", 0x984d3d], [7.0, -6.6, 3.0, 3.0, 2.8, "#f5e5c4", 0x3b7080],
            [-7.0, 6.8, 3.0, 2.8, 2.6, "#fff0cf", 0xd06d4c], [7.0, 6.7, 3.0, 3.2, 2.8, "#e8d0b6", 0x406e87]
          ],
          poole: [
            [-7.1, -6.8, 3.2, 3.0, 2.8, "#d7c39b", 0x69533b], [7.0, -6.6, 3.0, 3.4, 2.8, "#d7e0d0", 0x536c71],
            [-7.0, 6.8, 2.8, 2.5, 2.6, "#c8b994", 0x7a5740], [7.0, 6.7, 3.0, 3.1, 2.8, "#dbe2d5", 0x536c71]
          ]
        };
        for (const [x, z, w, h, d, facade, roof] of districtSets[mapId] || districtSets.christchurch) {
          const body = addSceneryMesh(group, new THREE.BoxGeometry(w, h, d), 0xffffff, [x, 0.22 + h / 2, z]);
          body.material.map = PBRTextures.createFacadeTexture(facade);
          body.material.roughness = 0.67;
          addSceneryMesh(group, new THREE.BoxGeometry(w + 0.28, 0.28, d + 0.28), roof, [x, 0.36 + h, z], { roughness: 0.48 });
          for (let win = -1; win <= 1; win++) {
            addSceneryMesh(group, new THREE.BoxGeometry(0.34, 0.48, 0.04), 0x9ed9eb, [x + win * 0.72, 0.95 + h * 0.42, z + d / 2 + 0.025], { emissive: 0x154457, emissiveIntensity: 0.18 });
          }
        }

        if (mapId === "christchurch") {
          // Christchurch Priory: nave, pitched roof, buttresses and a compact tower.
          addSceneryMesh(group, new THREE.BoxGeometry(5.8, 1.8, 2.5), 0xb8a17e, [0, 1.15, -5.1]);
          const naveRoof = addSceneryMesh(group, new THREE.ConeGeometry(2.3, 1.2, 4), 0x566552, [0, 2.65, -5.1]); naveRoof.rotation.y = Math.PI / 4;
          addSceneryMesh(group, new THREE.BoxGeometry(1.18, 3.5, 1.25), 0x9c876b, [-2.25, 1.95, -5.1]);
          addSceneryMesh(group, new THREE.ConeGeometry(0.9, 1.6, 4), 0x435a59, [-2.25, 4.4, -5.1]);
          for (let i = -2; i <= 2; i++) addSceneryMesh(group, new THREE.BoxGeometry(0.16, 0.58, 0.05), 0x68b8d1, [i * 0.9, 1.25, -3.82]);
          for (const [x, z] of [[-5.7, 1.2], [5.8, -1.5], [-5.8, -2.2], [5.5, 2.0]]) {
            addSceneryMesh(group, new THREE.CylinderGeometry(0.07, 0.08, 2.2, 8), 0x5a4029, [x, 1.3, z]);
            const crown = addSceneryMesh(group, new THREE.SphereGeometry(0.8, 9, 7), 0x2f7951, [x, 2.6, z]); crown.scale.y = 1.25;
          }
        } else if (mapId === "bournemouth") {
          // Pier deck, repeated supports and a lit seafront wheel.
          addSceneryMesh(group, new THREE.BoxGeometry(9.0, 0.34, 1.15), 0x9b6241, [0, 0.68, -5.6]);
          for (let x = -4; x <= 4; x += 1.35) addSceneryMesh(group, new THREE.CylinderGeometry(0.09, 0.13, 1.25, 7), 0x70513e, [x, 0.18, -5.6]);
          const wheel = addSceneryMesh(group, new THREE.TorusGeometry(1.55, 0.12, 8, 32), 0xf2bd62, [4.6, 2.55, -5.35], { metalness: 0.55, emissive: 0x684014, emissiveIntensity: 0.15 });
          wheel.rotation.y = Math.PI / 2;
          addSceneryMesh(group, new THREE.CylinderGeometry(0.14, 0.14, 3.2, 12), 0x73513e, [4.6, 1.25, -5.35]);
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            const spoke = addSceneryMesh(group, new THREE.CylinderGeometry(0.035, 0.035, 3.0, 6), 0xffe7a4, [4.6 + Math.sin(a) * 0.7, 2.55 + Math.cos(a) * 0.7, -5.35], { castShadow: false });
            spoke.rotation.z = -a;
          }
          addPalmTree(group, -4.8, -1.8); addPalmTree(group, 6.0, 1.5);
          const beach = addSceneryMesh(group, new THREE.BoxGeometry(10.5, 0.06, 1.7), 0xe4c992, [0, 0.28, 5.9], { roughness: 0.95, castShadow: false });
        } else {
          // Poole lighthouse, quay warehouses and a small sailboat on the harbour.
          addSceneryMesh(group, new THREE.CylinderGeometry(0.78, 1.05, 3.3, 12), 0xe5ddc7, [-4.6, 1.95, -5.3]);
          addSceneryMesh(group, new THREE.CylinderGeometry(0.83, 0.83, 0.45, 12), 0xd66b50, [-4.6, 3.72, -5.3]);
          addSceneryMesh(group, new THREE.CylinderGeometry(0.42, 0.48, 0.8, 10), 0xffe08b, [-4.6, 4.28, -5.3], { emissive: 0xc88a21, emissiveIntensity: 0.65 });
          addSceneryMesh(group, new THREE.ConeGeometry(0.6, 0.55, 10), 0x344c59, [-4.6, 4.95, -5.3]);
          addSceneryMesh(group, new THREE.BoxGeometry(7.0, 0.28, 1.2), 0x806344, [3.5, 0.55, -5.8]);
          for (let x = 0.6; x <= 6.2; x += 1.4) addSceneryMesh(group, new THREE.BoxGeometry(0.13, 1.0, 0.13), 0x513c2e, [x, 0.18, -5.8]);
          addSceneryMesh(group, new THREE.BoxGeometry(2.0, 0.3, 0.75), 0xf0eee2, [2.0, 0.84, 2.7]);
          addSceneryMesh(group, new THREE.CylinderGeometry(0.045, 0.045, 2.5, 8), 0x493b31, [2.0, 2.05, 2.7]);
          const sail = addSceneryMesh(group, new THREE.ConeGeometry(0.88, 1.9, 3), 0xfff6d7, [2.5, 2.05, 2.72]); sail.rotation.z = -Math.PI / 2;
          const waterline = addSceneryMesh(group, new THREE.BoxGeometry(9.0, 0.04, 1.05), 0x3e9eae, [2.0, 0.27, 3.4], { roughness: 0.28, metalness: 0.4, castShadow: false });
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
      for (let b = 0; b < 3; b++) {
        const boat = new THREE.Group();
        const hull = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.45, 2.6),
          new THREE.MeshStandardMaterial({ color: b === 0 ? 0xf8fafc : b === 1 ? 0x0284c7 : 0xeab308, roughness: 0.4 })
        );
        hull.position.y = 0.2;
        hull.castShadow = true;
        boat.add(hull);

        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(0.75, 0.42, 1.1),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 })
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

      // Animated 3D Dice with sculpted pips
      const diceGroup = new THREE.Group();
      diceGroup.position.set(0, 1.25, 0);
      scene.add(diceGroup);

      function createDieMesh(offsetX) {
        const die = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, 1.2, 1.2),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.08 })
        );
        die.position.set(offsetX, 0, 0);
        die.castShadow = true;
        die.receiveShadow = true;

        const pipMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
        const topPip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), pipMat);
        topPip.position.set(0, 0.61, 0);
        die.add(topPip);

        const sidePipA = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), pipMat);
        sidePipA.position.set(-0.25, 0.22, 0.61);
        die.add(sidePipA);

        const sidePipB = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), pipMat);
        sidePipB.position.set(0.25, -0.22, 0.61);
        die.add(sidePipB);
        return die;
      }
      const die1Mesh = createDieMesh(-0.98);
      const die2Mesh = createDieMesh(0.98);
      diceGroup.add(die1Mesh, die2Mesh);

      // Enhanced multi-part 3D Character Model Builder with ground shadow ring
      function createCharacterMesh(style) {
        const g = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: style.color, roughness: 0.42, metalness: 0.15 });
        const accentMat = new THREE.MeshStandardMaterial({ color: style.accent, roughness: 0.35, metalness: 0.2 });

        const shadowDisc = new THREE.Mesh(
          new THREE.CircleGeometry(0.68, 20),
          new THREE.MeshBasicMaterial({ color: 0x020617, transparent: true, opacity: 0.38 })
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
        houseRules: { freeParking: false, auctions: true, doubleGo: false, startingCash: 1500 }
      };

      function addLog(msg, colorClass = "text-slate-200") {
        game.logs.unshift({ msg, colorClass });
        if (game.logs.length > 25) game.logs.pop();
        const logEl = document.getElementById("event-log");
        logEl.innerHTML = game.logs
          .map((l) => `<div class="${l.colorClass} leading-snug">• ${l.msg}</div>`)
          .join("");
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

      function refreshBoardVisuals() {
        for (let i = 0; i < 40; i++) {
          const tile = BOARD_TILES[i];
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
              const hotel = new THREE.Mesh(
                new THREE.BoxGeometry(0.95, 0.95, 0.95),
                new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 })
              );
              hotel.position.set(0, 0.48, -0.75);
              hotel.castShadow = true;
              bGroup.add(hotel);
            } else {
              for (let h = 0; h < tile.houses; h++) {
                const house = new THREE.Mesh(
                  new THREE.BoxGeometry(0.42, 0.45, 0.42),
                  new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.45 })
                );
                house.position.set(-0.6 + h * 0.42, 0.24, -0.75);
                house.castShadow = true;
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
                <span class="font-display text-xs font-bold text-white">${p.name}</span>
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

        const humanTurn = !cur.isBot && !cur.bankrupt && !game.isMoving && !game.bankruptcyAnimating;
        buildBtn.textContent = cur.cash < 0 ? "Raise Cash" : "Build";
        rollBtn.disabled = !humanTurn || game.hasRolled;
        endTurnBtn.disabled = !humanTurn || !game.hasRolled || game.extraTurn;
        buildBtn.disabled = !humanTurn;
        tradeBtn.disabled = !humanTurn || game.players.filter((x) => !x.bankrupt && x.id !== cur.id).length === 0;
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
        if (current && !current.isBot && tile.ownerId === current.id && tile.mortgage) {
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
          die1Mesh.rotation.set(d1 * 0.5, d1 * 0.3, 0);
          die2Mesh.rotation.set(d2 * 0.4, d2 * 0.6, 0);
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
        if (!player || player.isBot) return;

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
        if (!player || player.isBot) return;

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

      function startNewMatch() {
        AudioEngine.init();
        AudioEngine.startBgm();
        clearPlayersFromScene();

        game.started = true;
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
            id: `p_${i + 1}`,
            name: cfg.name,
            isBot: cfg.isBot,
            teamId: cfg.teamId,
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
      document.getElementById("start-match-btn").addEventListener("click", startNewMatch);
      document.getElementById("new-game-btn").addEventListener("click", () => {
        game.started = false;
        document.getElementById("game-hud").classList.add("hidden");
        document.getElementById("bottom-hud").classList.add("hidden");
        const setupModal = document.getElementById("setup-modal");
        setupModal.classList.remove("hidden", "menu-exit", "menu-entry");
        void setupModal.offsetWidth;
        setupModal.classList.add("menu-entry");
      });

      document.getElementById("roll-btn").addEventListener("click", rollDiceForCurrentPlayer);
      document.getElementById("build-btn").addEventListener("click", openBuildMenu);
      document.getElementById("trade-btn").addEventListener("click", openTradeMenu);
      document.getElementById("end-turn-btn").addEventListener("click", endTurn);

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

        // Animate harbour boats & water scroll
        PBRTextures.water.map.offset.x = (now * 0.000018) % 1;
        PBRTextures.water.map.offset.y = (now * 0.000012) % 1;
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
