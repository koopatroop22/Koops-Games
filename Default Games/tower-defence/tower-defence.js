/**
 * KOOPS GAMES — TOWER DEFENCE 3D
 * Three-dimensional tower defence with live waves, tower combat, upgrades,
 * enemy abilities, maps, economy, and the tactical hub.
 */
(() => {
  'use strict';

  // ===========================================================================
  // 1. DESIGN CATALOG & MAP DEFINITIONS
  // ===========================================================================
  const WORLD_W = 18;
  const WORLD_D = 11.5;

  const TOWER_BLUEPRINTS = {
    archer: {
      id: 'archer',
      name: 'Archer Bastion',
      role: 'Rapid · Balanced',
      cost: 100,
      damage: 14,
      range: 2.8,
      glyph: '➶',
      accentHex: 0x34d399,
      desc: 'Timber-and-stone bastion crowned with a twin-limb repeater bow.',
      fireRate: 0.72, projectileSpeed: 11, projectileColor: 0x34d399
    },
    cannon: {
      id: 'cannon',
      name: 'Siege Cannon',
      role: 'Heavy · Splash',
      cost: 165,
      damage: 42,
      range: 2.35,
      glyph: '✹',
      accentHex: 0xfb923c,
      desc: 'Armoured iron-banded turret housing a heavy coastal mortar barrel.',
      fireRate: 1.7, projectileSpeed: 7, projectileColor: 0xfb923c
    },
    frost: {
      id: 'frost',
      name: 'Frost Spire',
      role: 'Cryo · Control',
      cost: 145,
      damage: 8,
      range: 2.55,
      glyph: '❄',
      accentHex: 0x38bdf8,
      desc: 'Levitating glacial prism framed by four resonant cryo-emitter vanes.',
      fireRate: 0.88, projectileSpeed: 10, projectileColor: 0x38bdf8
    },
    sniper: {
      id: 'sniper',
      name: 'Rail Watchtower',
      role: 'Long Range · Precision',
      cost: 210,
      damage: 85,
      range: 4.3,
      glyph: '⌖',
      accentHex: 0xfacc15,
      desc: 'High-elevation lookout spire fitted with a long-barrel precision rail.',
      fireRate: 2.25, projectileSpeed: 18, projectileColor: 0xfacc15
    }
  };

  const ENEMY_SILHOUETTES = [
    { type: 'scout',  name: 'Scout',        color: 0xf87171, progress: 0.14 },
    { type: 'runner', name: 'Runner',       color: 0xfbbf24, progress: 0.28 },
    { type: 'shield', name: 'Shield Guard', color: 0x60a5fa, progress: 0.44 },
    { type: 'brute',  name: 'Iron Brute',   color: 0xc084fc, progress: 0.61 },
    { type: 'boss',   name: 'Siege Titan',  color: 0xf43f5e, progress: 0.78 }
  ];

  const MAPS = {
    harbour: {
      id: 'harbour',
      name: 'Harbour Hold',
      groundHex: '#2f654c',
      cliffHex: '#334155',
      roadHex: '#c6b489',
      skyDark: 0x071519,
      skyLight: 0xd6e6df,
      waterDark: 0x0c4a6e,
      waterLight: 0x67b7d1,
      path: [
        [-8.6, -2.5], [-4.4, -2.5], [-4.4, 2.4], [0.2, 2.4],
        [0.2, -1.6], [4.5, -1.6], [4.5, 2.7], [8.0, 2.7]
      ],
      trees: [
        [-7.2, -4.3, 0.72], [-6.1, 3.8, 0.85], [-1.9, -4.0, 0.65],
        [-2.0, 4.2, 0.78], [2.4, -4.1, 0.82], [6.6, -3.7, 0.75], [6.9, 0.4, 0.62]
      ],
      rocks: [[-7.0, 1.0, 0.45], [2.4, 0.6, 0.48], [6.8, 4.4, 0.5]],
      sampleTowers: [
        { type: 'archer', x: -2.2, z: 0.2, level: 2 },
        { type: 'cannon', x: 2.3, z: 0.5, level: 1 },
        { type: 'frost', x: 6.2, z: 0.9, level: 2 }
      ]
    },
    pinewood: {
      id: 'pinewood',
      name: 'Pinewood Pass',
      groundHex: '#2b5b3d',
      cliffHex: '#3f362d',
      roadHex: '#bfa678',
      skyDark: 0x091612,
      skyLight: 0xd9e8db,
      waterDark: 0x0e4459,
      waterLight: 0x6bb0be,
      path: [
        [-8.6, 3.4], [-4.5, 3.4], [-4.5, -3.1], [-0.2, -3.1],
        [-0.2, 3.0], [4.4, 3.0], [4.4, -2.2], [8.0, -2.2]
      ],
      trees: [
        [-7.2, -1.6, 0.92], [-6.5, -3.8, 0.85], [-2.4, 0.2, 0.95],
        [-2.2, 4.1, 0.78], [2.1, -0.4, 0.9], [2.3, -4.1, 0.82],
        [6.8, 1.4, 0.95], [7.1, 3.7, 0.8]
      ],
      rocks: [[-6.8, 1.1, 0.42], [2.1, 4.3, 0.52], [6.6, -4.2, 0.46]],
      sampleTowers: [
        { type: 'frost', x: -2.3, z: -0.9, level: 2 },
        { type: 'sniper', x: 2.2, z: 0.8, level: 3 },
        { type: 'archer', x: 6.1, z: -0.2, level: 1 }
      ]
    },
    clifftop: {
      id: 'clifftop',
      name: 'Clifftop Run',
      groundHex: '#435e4a',
      cliffHex: '#475569',
      roadHex: '#cab98e',
      skyDark: 0x0c1720,
      skyLight: 0xdce7e4,
      waterDark: 0x0b3f5e,
      waterLight: 0x70bad2,
      path: [
        [-8.6, 0.2], [-5.4, 0.2], [-5.4, -3.4], [-1.6, -3.4],
        [-1.6, 3.1], [2.2, 3.1], [2.2, -1.2], [5.7, -1.2], [5.7, 3.3], [8.0, 3.3]
      ],
      trees: [
        [-7.2, -3.8, 0.64], [-7.0, 3.8, 0.68], [-3.5, 0.0, 0.72],
        [0.4, -4.2, 0.65], [4.0, -3.7, 0.75], [7.4, -3.3, 0.68]
      ],
      rocks: [[-3.6, 3.8, 0.58], [0.3, 0.2, 0.56], [4.0, 1.2, 0.62], [7.4, 0.2, 0.54]],
      sampleTowers: [
        { type: 'sniper', x: -3.5, z: -1.4, level: 2 },
        { type: 'cannon', x: 0.3, z: 1.2, level: 2 },
        { type: 'frost', x: 4.0, z: 0.9, level: 1 }
      ]
    }
  };

  // ===========================================================================
  // 2. PROCEDURAL TERRAIN HEIGHTMAP
  // ===========================================================================

  /**
   * Returns the terrain surface Y at world (x, z) for the given map.
   * Uses layered sinusoids — no external noise library needed.
   * The road corridor (within ~1.1 units of any path point) is flattened so
   * the road tube never clips through or floats above the ground.
   *
   * @param {number} x  World X position
   * @param {number} z  World Z position
   * @param {string} mapId  One of 'harbour' | 'pinewood' | 'clifftop'
   * @param {Array}  pathPts  Optional raw [[x,z]...] array for corridor flattening.
   *                          Pass MAPS[mapId].path when curve isn't built yet.
   * @returns {number} Surface Y (0 = flat ground reference)
   */
  function getTerrainY(x, z, mapId, pathPts) {
    let raw = 0;

    if (mapId === 'harbour') {
      // Gentle coastal lowlands — slight undulation, low amplitude
      raw = 0.28 * Math.sin(x * 0.42 + 0.6) * Math.cos(z * 0.55 + 0.3)
          + 0.18 * Math.sin(x * 0.78 + z * 0.35 + 1.1)
          + 0.12 * Math.cos(x * 1.1  - z * 0.6  + 0.8);
    } else if (mapId === 'pinewood') {
      // Rolling hills with one prominent central ridge
      raw = 0.52 * Math.sin(x * 0.38 + 0.4) * Math.sin(z * 0.44 + 0.7)
          + 0.38 * Math.cos(x * 0.62 + 0.9)
          + 0.22 * Math.sin(x * 0.95 + z * 0.5  + 2.0)
          + 0.14 * Math.cos(x * 1.4  - z * 0.8  + 1.3);
    } else {
      // clifftop — dramatic terraced plateaus
      const shelf = 0.55 * Math.sin(x * 0.44 + 0.5) + 0.45 * Math.cos(z * 0.5 + 1.0);
      const fine  = 0.18 * Math.sin(x * 1.0  + z * 0.7 + 1.8)
                  + 0.12 * Math.cos(x * 1.5  - z * 0.9 + 0.6);
      // Apply a soft-step to create plateau feel without harsh edges
      const stepped = Math.tanh(shelf * 1.6) * 0.72;
      raw = stepped + fine;
    }

    // Flatten the road corridor so the tube rides smoothly on the surface
    if (pathPts) {
      let minDist = Infinity;
      for (let i = 0; i < pathPts.length - 1; i++) {
        const ax = pathPts[i][0], az = pathPts[i][1];
        const bx = pathPts[i + 1][0], bz = pathPts[i + 1][1];
        const dx = bx - ax, dz = bz - az;
        const len2 = dx * dx + dz * dz;
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
        const cx = ax + t * dx, cz = az + t * dz;
        minDist = Math.min(minDist, Math.hypot(x - cx, z - cz));
      }
      // Smooth blend: fully flat within 0.7u of path, full height beyond 1.6u
      const blend = THREE.MathUtils.smoothstep(minDist, 0.7, 1.6);
      raw *= blend;
    }

    return raw;
  }

  // ===========================================================================
  // 3. PROCEDURAL PBR TEXTURES
  // ===========================================================================
  const Textures = (() => {
    function makeCanvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }

    function makeRand(seedInit) {
      let s = seedInit >>> 0 || 1;
      return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    }

    function register(c, rx = 1, ry = 1) {
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(rx, ry);
      tex.anisotropy = 8;
      return tex;
    }

    function createWaterTextures() {
      const c = makeCanvas(512, 512);
      const ctx = c.getContext('2d');
      const grad = ctx.createLinearGradient(0, 0, 512, 512);
      grad.addColorStop(0, '#5ea8cc');
      grad.addColorStop(0.5, '#86cbe6');
      grad.addColorStop(1, '#529bc2');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 512);

      const rand = makeRand(3119);
      for (let i = 0; i < 420; i++) {
        const x = rand() * 512;
        const y = rand() * 512;
        const w = 16 + rand() * 44;
        ctx.strokeStyle = rand() > 0.4 ? 'rgba(255, 255, 255, 0.22)' : 'rgba(14, 116, 144, 0.16)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + w * 0.5, y - 4, x + w, y + 1);
        ctx.stroke();
      }

      const bCanvas = makeCanvas(256, 256);
      const bCtx = bCanvas.getContext('2d');
      bCtx.fillStyle = '#808080';
      bCtx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 320; i++) {
        const x = rand() * 256;
        const y = rand() * 256;
        bCtx.strokeStyle = rand() > 0.5 ? '#c8c8c8' : '#4a4a4a';
        bCtx.lineWidth = 1.5;
        bCtx.beginPath();
        bCtx.moveTo(x, y);
        bCtx.quadraticCurveTo(x + 12, y - 3, x + 24, y + 1);
        bCtx.stroke();
      }

      return {
        map: register(c, 16, 16),
        bumpMap: register(bCanvas, 16, 16)
      };
    }

    function createTerrainTexture(baseHex, seedInit = 1901) {
      const c = makeCanvas(512, 512);
      const ctx = c.getContext('2d');
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, 512, 512);

      const bCanvas = makeCanvas(256, 256);
      const bCtx = bCanvas.getContext('2d');
      bCtx.fillStyle = '#909090';
      bCtx.fillRect(0, 0, 256, 256);

      const rand = makeRand(seedInit);
      for (let i = 0; i < 4200; i++) {
        const x = rand() * 512;
        const y = rand() * 512;
        ctx.fillStyle = rand() > 0.45 ? 'rgba(255,255,255,0.09)' : 'rgba(10,25,18,0.14)';
        ctx.fillRect(x, y, 2, 5);
        bCtx.fillStyle = rand() > 0.45 ? '#d0d0d0' : '#585858';
        bCtx.fillRect((x >> 1), (y >> 1), 1.5, 3);
      }

      return {
        map: register(c, 4, 3),
        bumpMap: register(bCanvas, 4, 3)
      };
    }

    function createRoadTexture(baseHex = '#c6b489') {
      const c = makeCanvas(512, 256);
      const ctx = c.getContext('2d');
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, 512, 256);

      const bCanvas = makeCanvas(256, 128);
      const bCtx = bCanvas.getContext('2d');
      bCtx.fillStyle = '#505050';
      bCtx.fillRect(0, 0, 256, 128);

      const rand = makeRand(7433);
      const rows = 4;
      const cols = 10;
      const cw = 512 / cols;
      const ch = 256 / rows;
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (cw * 0.5);
        for (let col = -1; col <= cols; col++) {
          const x = col * cw + offset + 3;
          const y = r * ch + 3;
          ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.11)' : 'rgba(40,30,15,0.1)';
          ctx.fillRect(x, y, cw - 6, ch - 6);
          ctx.strokeStyle = 'rgba(30, 25, 18, 0.25)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, cw - 6, ch - 6);

          bCtx.fillStyle = '#d4d4d4';
          bCtx.fillRect((x >> 1) + 1, (y >> 1) + 1, (cw >> 1) - 4, (ch >> 1) - 4);
        }
      }

      return {
        map: register(c, 10, 1),
        bumpMap: register(bCanvas, 10, 1)
      };
    }

    function createWoodTexture(baseHex = '#7c5338') {
      const c = makeCanvas(256, 256);
      const ctx = c.getContext('2d');
      ctx.fillStyle = baseHex;
      ctx.fillRect(0, 0, 256, 256);
      const rand = makeRand(5107);
      for (let y = 0; y < 256; y += 32) {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(15,10,5,0.14)';
        ctx.fillRect(0, y, 256, 30);
        ctx.fillStyle = 'rgba(15,10,5,0.4)';
        ctx.fillRect(0, y + 30, 256, 2);
      }
      return register(c, 2, 1);
    }

    return {
      water: createWaterTextures(),
      wood: createWoodTexture(),
      createTerrainTexture,
      createRoadTexture
    };
  })();

  // ===========================================================================
  // 4. THREE.JS SCENE, LIGHTING & DAMPED CAMERA CONTROLLER
  // ===========================================================================
  const canvas = document.getElementById('battlefield');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x071519);
  scene.fog = new THREE.FogExp2(0x071519, 0.015);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.2, 220);

  const hemiLight = new THREE.HemisphereLight(0xdff7ea, 0x1a2e26, 0.95);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff1d6, 1.75);
  sunLight.position.set(-12, 24, 15);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 4;
  sunLight.shadow.camera.far = 70;
  sunLight.shadow.camera.left = -16;
  sunLight.shadow.camera.right = 16;
  sunLight.shadow.camera.top = 14;
  sunLight.shadow.camera.bottom = -14;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);

  const rimLight = new THREE.DirectionalLight(0x5eead4, 0.45);
  rimLight.position.set(14, 10, -14);
  scene.add(rimLight);

  // Endless coastal sea surrounding the diorama island
  const seaMat = new THREE.MeshStandardMaterial({
    color: 0x0c4a6e,
    map: Textures.water.map,
    bumpMap: Textures.water.bumpMap,
    bumpScale: 0.04,
    roughness: 0.26,
    metalness: 0.42
  });
  const seaMesh = new THREE.Mesh(new THREE.CircleGeometry(110, 64), seaMat);
  seaMesh.rotation.x = -Math.PI / 2;
  seaMesh.position.y = -1.1;
  seaMesh.receiveShadow = true;
  scene.add(seaMesh);

  // Ambient drifting mist/firefly particles
  const particleCount = 90;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 20;
    particlePositions[i * 3 + 1] = 0.5 + Math.random() * 4.5;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 14;
  }
  const particleGeo = new THREE.BufferGeometry();
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({ color: 0xa7f3d0, size: 0.09, transparent: true, opacity: 0.55 });
  const ambientDust = new THREE.Points(particleGeo, particleMat);
  scene.add(ambientDust);

  const worldGroup = new THREE.Group();
  const towerGroup = new THREE.Group();
  const unitGroup = new THREE.Group();
  const combatGroup = new THREE.Group();
  const projectileGroup = new THREE.Group();
  scene.add(worldGroup, towerGroup, unitGroup, combatGroup, projectileGroup);

  const camCtrl = {
    yaw: 0.45,
    pitch: 0.66,
    distance: 21.5,
    targetYaw: 0.45,
    targetPitch: 0.66,
    targetDistance: 21.5,
    lookAt: new THREE.Vector3(0, 0.3, 0),
    targetLookAt: new THREE.Vector3(0, 0.3, 0)
  };

  function setCameraPreset(preset) {
    const map = MAPS[state.mapId];
    if (preset === 'core') {
      const end = map.path[map.path.length - 1];
      camCtrl.targetLookAt.set(end[0], 0.8, end[1]);
      camCtrl.targetDistance = 9.5;
      camCtrl.targetPitch = 0.55;
    } else if (preset === 'spawn') {
      const start = map.path[0];
      camCtrl.targetLookAt.set(start[0] + 1.4, 0.7, start[1]);
      camCtrl.targetDistance = 10.0;
      camCtrl.targetPitch = 0.56;
    } else {
      camCtrl.targetLookAt.set(0, 0.3, 0);
      camCtrl.targetDistance = 21.5;
      camCtrl.targetPitch = 0.66;
    }
    document.querySelectorAll('.cam-btn[data-cam]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.cam === preset);
    });
  }

  // ===========================================================================
  // 4. SHARED MATERIALS & CLEANUP HELPERS
  // ===========================================================================
  const sharedMaterials = {
    stone: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.72, metalness: 0.08 }),
    darkStone: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.68, metalness: 0.14 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.28, metalness: 0.78 }),
    wood: new THREE.MeshStandardMaterial({ map: Textures.wood, roughness: 0.68 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0x2f7d4f, roughness: 0.88 }),
    pine: new THREE.MeshStandardMaterial({ color: 0x1f5a3e, roughness: 0.86 }),
    coreCrystal: new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xd97706,
      emissiveIntensity: 0.9,
      roughness: 0.18,
      metalness: 0.3
    })
  };
  const sharedMaterialSet = new Set(Object.values(sharedMaterials));

  function clearGroup(group) {
    while (group.children.length > 0) {
      const child = group.children[group.children.length - 1];
      group.remove(child);
      child.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const list = Array.isArray(obj.material) ? obj.material : [obj.material];
          list.forEach((m) => {
            if (sharedMaterialSet.has(m)) return;
            if (m.map && m.map !== Textures.wood) m.map.dispose();
            if (m.bumpMap) m.bumpMap.dispose();
            m.dispose();
          });
        }
      });
    }
  }

  function addMesh(geo, mat, parent, pos = [0, 0, 0], scale = null) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ===========================================================================
  // 5. STATE & 3D MAP DIORAMA BUILDER
  // ===========================================================================
  const state = {
    mapId: 'harbour',
    selectedBlueprint: null,
    selectedTower: null,
    showcaseUnits: true,
    paused: false,
    speed: 1,
    towers: [],
    showcaseEntities: [],
    enemies: [],
    projectiles: [],
    cash: 420,
    health: 25,
    maxHealth: 25,
    wave: 0,
    waveActive: false,
    gameStarted: false,
    gameOver: false,
    spawnRemaining: 0,
    spawnTimer: 0,
    waveKills: 0,
    totalKills: 0,
    mapCurve: null,
    terrainMesh: null,
    coreCrystal: null,
    coreRing: null,
    spawnPortal: null,
    harbourBoat: null,
    previewGroup: null,
    pointerWorld: new THREE.Vector3(999, 0, 999),
    toastTimer: 0
  };

  function distanceToPath(x, z) {
    if (!state.mapCurve) return Infinity;
    let best = Infinity;
    for (let i = 0; i <= 100; i++) {
      const pt = state.mapCurve.getPointAt(i / 100);
      best = Math.min(best, Math.hypot(x - pt.x, z - pt.z));
    }
    return best;
  }

  function buildMapDiorama(mapId) {
    state.mapId = MAPS[mapId] ? mapId : 'harbour';
    const map = MAPS[state.mapId];

    clearGroup(worldGroup);
    clearGroup(towerGroup);
    clearGroup(unitGroup);
    clearGroup(combatGroup);
    clearGroup(projectileGroup);
    state.towers = [];
    state.showcaseEntities = [];
    state.enemies = [];
    state.projectiles = [];
    state.selectedTower = null;
    state.harbourBoat = null;
    state.terrainMesh = null;
    state.cash = 420;
    state.health = state.maxHealth;
    state.wave = 0;
    state.totalKills = 0;
    state.waveActive = false;
    state.gameStarted = false;
    state.gameOver = false;
    ui.dioramaBtn.disabled = false;

    // 1. Floating Diorama Island Plinth
    addMesh(
      new THREE.BoxGeometry(WORLD_W + 0.8, 0.95, WORLD_D + 0.8),
      new THREE.MeshStandardMaterial({ color: map.cliffHex, roughness: 0.88 }),
      worldGroup,
      [0, -0.58, 0]
    );
    addMesh(
      new THREE.BoxGeometry(WORLD_W + 1.1, 0.25, WORLD_D + 1.1),
      sharedMaterials.darkStone,
      worldGroup,
      [0, -0.96, 0]
    );

    const terrainTex = Textures.createTerrainTexture(map.groundHex, map.id.length * 1013);
    // Build subdivided terrain plane and displace vertices by heightmap
    const terrGeo = new THREE.PlaneGeometry(WORLD_W, WORLD_D, 72, 46);
    terrGeo.rotateX(-Math.PI / 2);
    const posAttr = terrGeo.attributes.position;
    for (let vi = 0; vi < posAttr.count; vi++) {
      const vx = posAttr.getX(vi);
      const vz = posAttr.getZ(vi);
      const vy = getTerrainY(vx, vz, state.mapId, map.path);
      posAttr.setY(vi, vy);
    }
    posAttr.needsUpdate = true;
    terrGeo.computeVertexNormals();
    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTex.map,
      bumpMap: terrainTex.bumpMap,
      bumpScale: 0.06,
      roughness: 0.92
    });
    const terrainMesh = new THREE.Mesh(terrGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = false;
    worldGroup.add(terrainMesh);
    state.terrainMesh = terrainMesh;

    // Subtle tactical placement grid overlay
    const gridPts = [];
    for (let x = -8; x <= 8; x += 1) {
      gridPts.push(new THREE.Vector3(x, 0.045, -5.5), new THREE.Vector3(x, 0.045, 5.5));
    }
    for (let z = -5; z <= 5; z += 1) {
      gridPts.push(new THREE.Vector3(-8.5, 0.045, z), new THREE.Vector3(8.5, 0.045, z));
    }
    const gridLines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(gridPts),
      new THREE.LineBasicMaterial({ color: 0xa7f3d0, transparent: true, opacity: 0.1 })
    );
    worldGroup.add(gridLines);

    // 2. Smooth 3D Stone Road & Curbstones — curve follows terrain surface
    const curvePts = map.path.map(([x, z]) => {
      const ty = getTerrainY(x, z, state.mapId, map.path);
      return new THREE.Vector3(x, ty + 0.08, z);
    });
    state.mapCurve = new THREE.CatmullRomCurve3(curvePts, false, 'centripetal', 0.45);
    const roadTex = Textures.createRoadTexture(map.roadHex);

    const roadBorder = addMesh(
      new THREE.TubeGeometry(state.mapCurve, 220, 0.56, 10, false),
      sharedMaterials.darkStone,
      worldGroup,
      [0, -0.02, 0]
    );
    roadBorder.scale.y = 0.22;

    const roadDeck = addMesh(
      new THREE.TubeGeometry(state.mapCurve, 220, 0.46, 12, false),
      new THREE.MeshStandardMaterial({
        map: roadTex.map,
        bumpMap: roadTex.bumpMap,
        bumpScale: 0.035,
        roughness: 0.86
      }),
      worldGroup,
      [0, 0.01, 0]
    );
    roadDeck.scale.y = 0.22;

    // 3. Spawn Gate Arch (Path Start)
    const startPt = state.mapCurve.getPointAt(0);
    const startTan = state.mapCurve.getTangentAt(0);
    const gateGroup = new THREE.Group();
    gateGroup.position.set(startPt.x, startPt.y, startPt.z);
    gateGroup.rotation.y = Math.atan2(startTan.x, startTan.z);
    addMesh(new THREE.BoxGeometry(0.26, 1.35, 0.34), sharedMaterials.darkStone, gateGroup, [-0.62, 0.68, 0]);
    addMesh(new THREE.BoxGeometry(0.26, 1.35, 0.34), sharedMaterials.darkStone, gateGroup, [0.62, 0.68, 0]);
    addMesh(new THREE.BoxGeometry(1.64, 0.28, 0.42), sharedMaterials.stone, gateGroup, [0, 1.42, 0]);
    const portalRing = addMesh(
      new THREE.TorusGeometry(0.42, 0.055, 10, 28),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xe11d48, emissiveIntensity: 0.85, roughness: 0.25 }),
      gateGroup,
      [0, 0.72, 0]
    );
    state.spawnPortal = portalRing;
    worldGroup.add(gateGroup);

    // 4. Nexus Core Citadel (Path End)
    const endPt = state.mapCurve.getPointAt(1);
    const citadel = new THREE.Group();
    citadel.position.set(endPt.x, endPt.y, endPt.z);
    addMesh(new THREE.CylinderGeometry(0.88, 1.05, 0.24, 8), sharedMaterials.darkStone, citadel, [0, 0.12, 0]);
    addMesh(new THREE.CylinderGeometry(0.68, 0.76, 0.16, 8), sharedMaterials.stone, citadel, [0, 0.3, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      addMesh(new THREE.BoxGeometry(0.12, 0.78, 0.12), sharedMaterials.brass, citadel, [Math.cos(a) * 0.64, 0.68, Math.sin(a) * 0.64]);
    }
    const coreRing = addMesh(new THREE.TorusGeometry(0.58, 0.045, 10, 32), sharedMaterials.brass, citadel, [0, 0.76, 0]);
    coreRing.rotation.x = Math.PI / 2;
    const crystal = addMesh(new THREE.OctahedronGeometry(0.38, 0), sharedMaterials.coreCrystal, citadel, [0, 0.92, 0]);
    const coreGlow = new THREE.PointLight(0xfacc15, 1.4, 7.5);
    coreGlow.position.set(0, 1.15, 0);
    citadel.add(coreGlow);
    state.coreCrystal = crystal;
    state.coreRing = coreRing;
    worldGroup.add(citadel);

    // 5. Biome Scenery Props (Trees, Rocks, Map Landmarks)
    const sphereGeo = new THREE.SphereGeometry(1, 12, 10);
    const coneGeo = new THREE.ConeGeometry(1, 1.7, 8);
    map.trees.forEach(([tx, tz, s]) => {
      const tree = new THREE.Group();
      const ty = getTerrainY(tx, tz, state.mapId, map.path);
      tree.position.set(tx, ty, tz);
      addMesh(new THREE.CylinderGeometry(0.08 * s, 0.14 * s, 0.65 * s, 8), sharedMaterials.wood, tree, [0, 0.32 * s, 0]);
      if (map.id === 'pinewood') {
        addMesh(coneGeo, sharedMaterials.pine, tree, [0, 0.98 * s, 0], [0.58 * s, 0.75 * s, 0.58 * s]);
        addMesh(coneGeo, sharedMaterials.leaves, tree, [0, 1.42 * s, 0], [0.42 * s, 0.62 * s, 0.42 * s]);
      } else {
        addMesh(sphereGeo, sharedMaterials.leaves, tree, [0, 0.85 * s, 0], [0.52 * s, 0.56 * s, 0.52 * s]);
        addMesh(sphereGeo, sharedMaterials.pine, tree, [0.22 * s, 0.72 * s, 0.14 * s], [0.34 * s, 0.38 * s, 0.34 * s]);
      }
      worldGroup.add(tree);
    });

    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    map.rocks.forEach(([rx, rz, s], idx) => {
      const ry = getTerrainY(rx, rz, state.mapId, map.path);
      const rock = addMesh(rockGeo, sharedMaterials.stone, worldGroup, [rx, ry + 0.14 * s, rz], [s, s * 0.68, s * 0.85]);
      rock.rotation.y = idx * 1.1;
    });

    if (map.id === 'harbour') {
      // Timber coastal dock & anchored skiff on the water edge
      addMesh(new THREE.BoxGeometry(3.4, 0.12, 1.3), sharedMaterials.wood, worldGroup, [-5.6, getTerrainY(-5.6, 6.2, 'harbour', map.path) + 0.12, 6.2]);
      for (const px of [-6.9, -4.3]) {
        addMesh(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 10), sharedMaterials.wood, worldGroup, [px, -0.35, 6.65]);
      }
      const boat = new THREE.Group();
      addMesh(new THREE.BoxGeometry(1.4, 0.28, 0.65), sharedMaterials.wood, boat, [0, 0, 0]);
      addMesh(new THREE.CylinderGeometry(0.03, 0.03, 1.25, 8), sharedMaterials.brass, boat, [0, 0.65, 0]);
      const sail = addMesh(
        new THREE.ConeGeometry(0.45, 0.95, 3),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 }),
        boat,
        [0.24, 0.68, 0]
      );
      sail.rotation.z = -Math.PI / 2;
      boat.position.set(-2.5, -0.92, 7.6);
      state.harbourBoat = boat;
      worldGroup.add(boat);
    } else if (map.id === 'clifftop') {
      // Coastal watch-ruin stone arch on the highland ridge
      const ruin = new THREE.Group();
      const ruinY = getTerrainY(-1.5, -4.6, 'clifftop', map.path);
      ruin.position.set(-1.5, ruinY + 0.04, -4.6);
      addMesh(new THREE.BoxGeometry(0.32, 1.1, 0.32), sharedMaterials.stone, ruin, [-0.65, 0.55, 0]);
      addMesh(new THREE.BoxGeometry(0.32, 0.85, 0.32), sharedMaterials.stone, ruin, [0.65, 0.42, 0]);
      addMesh(new THREE.BoxGeometry(1.7, 0.24, 0.38), sharedMaterials.darkStone, ruin, [0, 1.15, 0]);
      worldGroup.add(ruin);
    }

    // 6. Battlefield showcase units remain visual only until a match starts.
    rebuildShowcaseUnits();
    ensurePlacementPreview();
    applySceneTheme(document.documentElement.dataset.theme || 'dark');
    updateHud();
  }

  // ===========================================================================
  // 6. TOWER & ENEMY 3D ASSET FACTORIES
  // ===========================================================================
  function createTowerMesh(tower) {
    const bp = TOWER_BLUEPRINTS[tower.type];
    const g = new THREE.Group();
    // Sit tower base on the actual terrain surface
    const terrainY = getTerrainY(tower.x, tower.z, state.mapId, MAPS[state.mapId].path);
    tower.terrainY = terrainY;
    g.position.set(tower.x, terrainY, tower.z);

    // Octagonal stone plinth & brass collar
    addMesh(new THREE.CylinderGeometry(0.42, 0.5, 0.2, 8), sharedMaterials.darkStone, g, [0, 0.1, 0]);
    addMesh(new THREE.CylinderGeometry(0.34, 0.4, 0.14, 8), sharedMaterials.stone, g, [0, 0.26, 0]);

    const head = new THREE.Group();
    head.position.y = 0.62;
    g.add(head);

    const accentMat = new THREE.MeshStandardMaterial({
      color: bp.accentHex,
      emissive: bp.accentHex,
      emissiveIntensity: 0.28,
      roughness: 0.3,
      metalness: 0.35
    });

    if (tower.type === 'archer') {
      addMesh(new THREE.CylinderGeometry(0.24, 0.28, 0.44, 8), sharedMaterials.wood, g, [0, 0.5, 0]);
      addMesh(new THREE.SphereGeometry(0.22, 14, 12), accentMat, head, [0, 0.14, 0]);
      const bow = addMesh(new THREE.TorusGeometry(0.28, 0.032, 8, 18, Math.PI), sharedMaterials.brass, head, [0, 0.14, 0.06]);
      bow.rotation.x = Math.PI / 2;
      addMesh(new THREE.CylinderGeometry(0.03, 0.04, 0.56, 8), sharedMaterials.darkStone, head, [0, 0.14, 0.26]).rotation.x = Math.PI / 2;
    } else if (tower.type === 'cannon') {
      addMesh(new THREE.CylinderGeometry(0.28, 0.34, 0.36, 12), sharedMaterials.darkStone, g, [0, 0.46, 0]);
      addMesh(new THREE.SphereGeometry(0.27, 16, 12), accentMat, head, [0, 0.06, 0]);
      const barrel = addMesh(new THREE.CylinderGeometry(0.13, 0.17, 0.62, 14), sharedMaterials.darkStone, head, [0, 0.08, 0.3]);
      barrel.rotation.x = Math.PI / 2;
      addMesh(new THREE.TorusGeometry(0.15, 0.035, 8, 16), sharedMaterials.brass, head, [0, 0.08, 0.58]);
    } else if (tower.type === 'frost') {
      addMesh(new THREE.CylinderGeometry(0.16, 0.26, 0.48, 6), sharedMaterials.stone, g, [0, 0.52, 0]);
      const prism = addMesh(new THREE.OctahedronGeometry(0.28, 0), accentMat, head, [0, 0.28, 0]);
      prism.scale.y = 1.35;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const fin = addMesh(new THREE.BoxGeometry(0.06, 0.36, 0.12), sharedMaterials.brass, head, [Math.cos(a) * 0.3, 0.15, Math.sin(a) * 0.3]);
        fin.rotation.y = -a;
      }
    } else {
      // Rail Watchtower (sniper)
      addMesh(new THREE.CylinderGeometry(0.16, 0.26, 0.72, 6), sharedMaterials.wood, g, [0, 0.64, 0]);
      head.position.y = 0.98;
      addMesh(new THREE.BoxGeometry(0.42, 0.16, 0.42), sharedMaterials.darkStone, head, [0, 0, 0]);
      addMesh(new THREE.SphereGeometry(0.16, 12, 10), accentMat, head, [0, 0.14, 0]);
      const rail = addMesh(new THREE.CylinderGeometry(0.045, 0.065, 0.95, 10), sharedMaterials.brass, head, [0, 0.14, 0.45]);
      rail.rotation.x = Math.PI / 2;
    }

    // Tier indicator pips on front pedestal
    const pips = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const pip = addMesh(new THREE.SphereGeometry(0.042, 8, 6), sharedMaterials.brass, pips, [-0.18 + i * 0.12, 0.18, 0.43]);
      pip.visible = i < tower.level;
    }
    g.add(pips);

    // 3D Range Ring (visible when tower is selected)
    const rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(bp.range - 0.08, bp.range, 56),
      new THREE.MeshBasicMaterial({ color: bp.accentHex, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
    );
    rangeRing.rotation.x = -Math.PI / 2;
    rangeRing.position.set(tower.x, terrainY + 0.07, tower.z);
    rangeRing.visible = false;
    towerGroup.add(rangeRing);

    towerGroup.add(g);
    tower.mesh = g;
    tower.head = head;
    tower.pips = pips;
    tower.rangeRing = rangeRing;
  }

  function createEnemySilhouette(spec, parent = unitGroup) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: spec.color,
      emissive: spec.color,
      emissiveIntensity: 0.16,
      roughness: 0.36,
      metalness: 0.18
    });

    if (spec.type === 'runner') {
      addMesh(new THREE.ConeGeometry(0.2, 0.52, 7), mat, g, [0, 0.3, 0]);
      addMesh(new THREE.SphereGeometry(0.11, 10, 8), sharedMaterials.brass, g, [0, 0.56, 0.02]);
    } else if (spec.type === 'shield') {
      addMesh(new THREE.IcosahedronGeometry(0.25, 1), mat, g, [0, 0.32, 0]);
      const shield = addMesh(
        new THREE.CylinderGeometry(0.3, 0.3, 0.07, 14),
        new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.65, metalness: 0.3 }),
        g,
        [0, 0.34, 0.24]
      );
      shield.rotation.x = Math.PI / 2;
    } else if (spec.type === 'brute') {
      addMesh(new THREE.DodecahedronGeometry(0.32, 0), mat, g, [0, 0.36, 0]);
      addMesh(new THREE.BoxGeometry(0.46, 0.16, 0.26), sharedMaterials.darkStone, g, [0, 0.58, 0]);
    } else if (spec.type === 'boss') {
      addMesh(new THREE.DodecahedronGeometry(0.44, 1), mat, g, [0, 0.5, 0]);
      for (const s of [-1, 1]) {
        const horn = addMesh(new THREE.ConeGeometry(0.11, 0.36, 7), sharedMaterials.brass, g, [s * 0.26, 0.92, 0]);
        horn.rotation.z = -s * 0.45;
      }
      const aura = addMesh(new THREE.TorusGeometry(0.52, 0.035, 8, 24), sharedMaterials.brass, g, [0, 0.2, 0]);
      aura.rotation.x = Math.PI / 2;
    } else {
      addMesh(new THREE.SphereGeometry(0.22, 14, 10), mat, g, [0, 0.28, 0]);
      addMesh(new THREE.SphereGeometry(0.11, 10, 8), sharedMaterials.brass, g, [0, 0.48, 0.08]);
    }

    parent.add(g);
    return { ...spec, mesh: g, t: spec.progress };
  }

  function rebuildShowcaseUnits() {
    clearGroup(unitGroup);
    state.showcaseEntities = [];
    if (!state.showcaseUnits) return;
    ENEMY_SILHOUETTES.forEach((spec) => {
      state.showcaseEntities.push(createEnemySilhouette(spec));
    });
  }

  function ensurePlacementPreview() {
    if (state.previewGroup) {
      scene.remove(state.previewGroup);
    }
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1.0, 48),
      new THREE.MeshBasicMaterial({ color: 0x34d399, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.07;
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.48, 0.55, 12),
      new THREE.MeshStandardMaterial({ color: 0x34d399, transparent: true, opacity: 0.55, roughness: 0.4 })
    );
    disc.position.y = 0.32;
    g.add(ring, disc);
    g.userData.ring = ring;
    g.userData.disc = disc;
    g.visible = false;
    scene.add(g);
    state.previewGroup = g;
  }

  function isPlacementValid(x, z) {
    if (Math.abs(x) > WORLD_W * 0.5 - 0.7 || Math.abs(z) > WORLD_D * 0.5 - 0.7) return false;
    if (distanceToPath(x, z) < 0.95) return false;
    return state.towers.every((t) => Math.hypot(t.x - x, t.z - z) > 1.05);
  }

  function placePreviewTower(type, x, z, level = 1, silent = false) {
    const tower = { type, x, z, level, angle: Math.random() * Math.PI * 2, cooldown: Math.random() * 0.3 };
    createTowerMesh(tower);
    state.towers.push(tower);
    if (!silent) {
      selectTower(tower);
      showToast(`${TOWER_BLUEPRINTS[type].name} deployed`);
    }
    return tower;
  }

  // ===========================================================================
  // 7. HUD & GAMEPLAY MECHANICS
  // ===========================================================================
  const ui = {
    mapName: document.getElementById('hud-map-name'),
    buildHint: document.getElementById('build-hint'),
    inspectorTitle: document.getElementById('inspector-title'),
    inspectorDesc: document.getElementById('inspector-desc'),
    inspectorGlyph: document.getElementById('inspector-glyph'),
    inspectorTier: document.getElementById('inspector-tier'),
    inspectorStats: document.getElementById('inspector-stats'),
    inspectorActions: document.getElementById('inspector-actions'),
    upgradeButton: document.getElementById('upgrade-btn'),
    removeButton: document.getElementById('remove-btn'),
    statRole: document.getElementById('stat-role'),
    statRange: document.getElementById('stat-range'),
    statDamage: document.getElementById('stat-damage'),
    fieldReport: document.getElementById('field-report'),
    health: document.getElementById('hud-health'),
    healthFill: document.getElementById('hud-health-fill'),
    cash: document.getElementById('hud-cash'),
    wave: document.getElementById('hud-wave'),
    waveButton: document.getElementById('wave-btn'),
    toast: document.getElementById('toast'),
    setupScreen: document.getElementById('setup-screen'),
    beginBtn: document.getElementById('begin-btn'),
    dioramaBtn: document.getElementById('btn-diorama-toggle')
  };

  function showToast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    state.toastTimer = 2.4;
  }

  function selectTower(tower) {
    state.selectedTower = tower;
    state.towers.forEach((t) => {
      if (t.rangeRing) t.rangeRing.visible = t === tower;
    });
    if (tower?.rangeRing) tower.rangeRing.scale.setScalar(1 + (tower.level - 1) * 0.06);
    updateHud();
  }

  function updateHud() {
    ui.mapName.textContent = MAPS[state.mapId].name;
    ui.health.textContent = `${state.health} / ${state.maxHealth}`;
    ui.healthFill.style.width = `${(state.health / state.maxHealth) * 100}%`;
    ui.cash.textContent = `$${state.cash}`;
    ui.wave.textContent = state.gameOver ? 'Breached' : state.waveActive ? `Wave ${state.wave}` : state.wave ? `Wave ${state.wave} clear` : 'Ready';
    ui.waveButton.querySelector('span').textContent = state.waveActive ? 'Wave In Progress' : state.gameOver ? 'Play Again' : state.wave ? 'Next Wave' : 'Start Wave';
    ui.waveButton.querySelector('small').textContent = state.waveActive ? `${state.spawnRemaining + state.enemies.length} Hostiles` : `Wave ${state.wave + 1}`;
    ui.waveButton.disabled = state.waveActive;

    document.querySelectorAll('.tower-card').forEach((card) => {
      card.classList.toggle('selected', card.dataset.tower === state.selectedBlueprint);
    });

    ui.buildHint.textContent = state.selectedBlueprint
      ? `${TOWER_BLUEPRINTS[state.selectedBlueprint].name} selected · click clear ground to deploy (Esc to cancel)`
      : 'Select a blueprint to place a tower';

    const t = state.selectedTower;
    if (!t) {
      ui.inspectorGlyph.textContent = '✦';
      ui.inspectorTitle.textContent = 'Select a 3D Tower';
      ui.inspectorDesc.textContent = 'Select a tower blueprint and place it off the road. Towers automatically target the furthest enemy in range.';
      ui.inspectorTier.classList.add('hidden');
      ui.inspectorStats.classList.add('hidden');
      ui.inspectorActions.classList.add('hidden');
    } else {
      const bp = TOWER_BLUEPRINTS[t.type];
      ui.inspectorGlyph.textContent = bp.glyph;
      ui.inspectorTitle.textContent = bp.name;
      ui.inspectorDesc.textContent = bp.desc;
      ui.inspectorTier.textContent = `TIER ${t.level}/4`;
      ui.inspectorTier.classList.remove('hidden');
      ui.statRole.textContent = bp.role;
      ui.statRange.textContent = `${(bp.range * (1 + (t.level - 1) * 0.06)).toFixed(1)}u`;
      ui.statDamage.textContent = `${Math.round(bp.damage * Math.pow(1.45, t.level - 1))}`;
      ui.inspectorStats.classList.remove('hidden');
      ui.inspectorActions.classList.remove('hidden');
      const nextCost = Math.round(bp.cost * (0.68 + t.level * 0.45));
      ui.upgradeButton.textContent = t.level >= 4 ? 'Max Tier' : `Upgrade · $${nextCost}`;
      ui.upgradeButton.disabled = t.level >= 4 || state.cash < nextCost;
      ui.removeButton.textContent = `Sell · $${Math.floor(bp.cost * (0.55 + (t.level - 1) * 0.28))}`;
    }
  }

  function disposeObject(object) {
    if (!object) return;
    object.parent?.remove(object);
    object.traverse((part) => {
      part.geometry?.dispose();
      if (part.material) (Array.isArray(part.material) ? part.material : [part.material]).forEach((material) => material.dispose());
    });
  }

  const ENEMY_RULES = {
    scout: { hp: 0.75, speed: 1.18, leak: 1, reward: 8, color: 0xf87171, name: 'Scout' },
    runner: { hp: 0.5, speed: 1.8, leak: 1, reward: 7, color: 0xfbbf24, name: 'Runner' },
    shield: { hp: 1.5, speed: 0.78, leak: 2, reward: 12, color: 0x60a5fa, name: 'Shield Guard' },
    brute: { hp: 2.6, speed: 0.57, leak: 3, reward: 18, color: 0xc084fc, name: 'Iron Brute' },
    boss: { hp: 8, speed: 0.42, leak: 8, reward: 65, color: 0xf43f5e, name: 'Siege Titan' }
  };

  function spawnEnemy() {
    const ordinal = state.waveTotal - state.spawnRemaining;
    const kind = ordinal === state.waveTotal - 1 && state.wave % 5 === 0
      ? 'boss'
      : (state.wave >= 3 && ordinal % 5 === 4 ? 'brute' : state.wave >= 2 && ordinal % 3 === 2 ? 'shield' : ordinal % 4 === 3 ? 'runner' : 'scout');
    const rules = ENEMY_RULES[kind];
    const maxHp = Math.round(42 * Math.pow(1.27, state.wave - 1) * rules.hp);
    const enemy = createEnemySilhouette({ type: kind, name: rules.name, color: rules.color, progress: 0 }, combatGroup);
    enemy.hp = maxHp;
    enemy.maxHp = maxHp;
    enemy.speed = rules.speed * (1 + state.wave * 0.018);
    enemy.leak = rules.leak;
    enemy.reward = rules.reward + Math.floor(state.wave * 1.5);
    enemy.slowTimer = 0;
    const bar = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.09), new THREE.MeshBasicMaterial({ color: 0x450a0a, side: THREE.DoubleSide }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.055), new THREE.MeshBasicMaterial({ color: 0x4ade80, side: THREE.DoubleSide }));
    fill.position.z = 0.006;
    fill.position.x = 0;
    bar.add(back, fill);
    bar.position.y = kind === 'boss' ? 1.35 : 0.92;
    enemy.mesh.add(bar);
    enemy.healthFill = fill;
    enemy.healthBar = bar;
    enemy.mesh.scale.setScalar(kind === 'boss' ? 1.25 : 1);
    state.enemies.push(enemy);
  }

  function finishEnemy(enemy, leaked = false) {
    const index = state.enemies.indexOf(enemy);
    if (index < 0) return;
    state.enemies.splice(index, 1);
    disposeObject(enemy.mesh);
    if (leaked) {
      state.health = Math.max(0, state.health - enemy.leak);
      showToast(`${enemy.name} reached the Nexus (−${enemy.leak} integrity)`);
      if (state.health <= 0) endGame();
    } else {
      state.cash += enemy.reward;
      state.waveKills++;
      state.totalKills++;
    }
  }

  function damageEnemy(enemy, amount, slow = false) {
    if (!state.enemies.includes(enemy)) return;
    const armor = enemy.type === 'shield' ? 0.78 : enemy.type === 'boss' ? 0.9 : 1;
    enemy.hp -= amount * armor;
    if (slow) enemy.slowTimer = Math.max(enemy.slowTimer, 1.8);
    if (enemy.healthFill) enemy.healthFill.scale.x = Math.max(0.001, enemy.hp / enemy.maxHp);
    if (enemy.healthFill) enemy.healthFill.position.x = -0.32 * (1 - Math.max(0, enemy.hp / enemy.maxHp));
    if (enemy.hp <= 0) finishEnemy(enemy);
  }

  function createShot(tower, target) {
    const bp = TOWER_BLUEPRINTS[tower.type];
    const material = new THREE.MeshBasicMaterial({ color: bp.projectileColor });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(tower.type === 'cannon' ? 0.13 : 0.075, 8, 8), material);
    // Fire from the tower head height, offset by terrain Y
    const fireY = (tower.terrainY || 0) + (tower.type === 'sniper' ? 1.35 : 0.9);
    mesh.position.set(tower.x, fireY, tower.z);
    projectileGroup.add(mesh);
    state.projectiles.push({ mesh, target, tower, speed: bp.projectileSpeed });
  }

  function resolveShot(projectile) {
    const { target, tower } = projectile;
    if (!state.enemies.includes(target)) return;
    const bp = TOWER_BLUEPRINTS[tower.type];
    const damage = bp.damage * Math.pow(1.38, tower.level - 1);
    if (tower.type === 'cannon') {
      state.enemies.slice().forEach((enemy) => {
        if (Math.hypot(enemy.mesh.position.x - target.mesh.position.x, enemy.mesh.position.z - target.mesh.position.z) <= 0.95) damageEnemy(enemy, damage);
      });
    } else {
      damageEnemy(target, damage, tower.type === 'frost');
    }
  }

  function updateCombat(step) {
    if (!state.gameStarted || state.gameOver) return;
    if (state.waveActive && state.spawnRemaining > 0) {
      state.spawnTimer -= step;
      if (state.spawnTimer <= 0) {
        spawnEnemy();
        state.spawnRemaining--;
        state.spawnTimer = Math.max(0.38, 0.92 - state.wave * 0.018);
      }
    }
    state.enemies.slice().forEach((enemy) => {
      enemy.slowTimer = Math.max(0, enemy.slowTimer - step);
      enemy.t += (enemy.speed * (enemy.slowTimer > 0 ? 0.52 : 1) * step) / state.mapCurve.getLength();
      if (enemy.t >= 1) {
        finishEnemy(enemy, true);
        return;
      }
      const pos = state.mapCurve.getPointAt(enemy.t);
      const tan = state.mapCurve.getTangentAt(enemy.t);
      // pos.y already includes terrain height; add a small hover above road
      enemy.mesh.position.set(pos.x, pos.y + Math.sin(performance.now() * 0.006 + enemy.t * 8) * 0.035, pos.z);
      enemy.mesh.rotation.y = Math.atan2(tan.x, tan.z);
      if (enemy.healthBar) enemy.healthBar.quaternion.copy(camera.quaternion);
    });
    state.towers.forEach((tower) => {
      tower.cooldown = Math.max(0, (tower.cooldown || 0) - step);
      const bp = TOWER_BLUEPRINTS[tower.type];
      const target = state.enemies.filter((enemy) => Math.hypot(enemy.mesh.position.x - tower.x, enemy.mesh.position.z - tower.z) <= bp.range * (1 + (tower.level - 1) * 0.06)).sort((a, b) => b.t - a.t)[0];
      if (!target) return;
      tower.head.rotation.y = Math.atan2(target.mesh.position.x - tower.x, target.mesh.position.z - tower.z);
      if (tower.cooldown <= 0) {
        createShot(tower, target);
        tower.cooldown = bp.fireRate * Math.pow(0.88, tower.level - 1);
      }
    });
    state.projectiles.slice().forEach((shot) => {
      if (!state.enemies.includes(shot.target)) {
        state.projectiles.splice(state.projectiles.indexOf(shot), 1);
        disposeObject(shot.mesh);
        return;
      }
      const destination = shot.target.mesh.position.clone().add(new THREE.Vector3(0, 0.35, 0));
      const delta = destination.sub(shot.mesh.position);
      const travel = shot.speed * step;
      if (delta.length() <= travel) {
        resolveShot(shot);
        state.projectiles.splice(state.projectiles.indexOf(shot), 1);
        disposeObject(shot.mesh);
      } else {
        shot.mesh.position.add(delta.normalize().multiplyScalar(travel));
      }
    });
    if (state.waveActive && state.spawnRemaining === 0 && state.enemies.length === 0) {
      state.waveActive = false;
      const bonus = 28 + state.wave * 8;
      state.cash += bonus;
      showToast(`Wave ${state.wave} cleared · $${bonus} supply bonus`);
      ui.fieldReport.textContent = `Wave ${state.wave} cleared · ${state.waveKills} enemies defeated · +$${bonus}`;
    }
    updateHud();
  }

  function endGame() {
    state.gameOver = true;
    state.waveActive = false;
    state.paused = false;
    document.getElementById('pause-btn').textContent = 'Pause';
    document.getElementById('game-over-wave').textContent = `You reached wave ${state.wave} and defeated ${state.totalKills} enemies.`;
    document.getElementById('game-over-screen').classList.remove('hidden');
  }

  function startMatch() {
    if (state.gameOver) {
      document.getElementById('game-over-screen').classList.add('hidden');
      buildMapDiorama(state.mapId);
    }
    state.gameStarted = true;
    state.gameOver = false;
    state.showcaseUnits = false;
    ui.dioramaBtn.classList.remove('active');
    ui.dioramaBtn.disabled = true;
    rebuildShowcaseUnits();
    ui.setupScreen.classList.add('hidden');
    if (state.wave === 0) showToast(`${MAPS[state.mapId].name} · place towers, then launch Wave 1`);
    else showToast('Defences reset · prepare for the next assault');
    updateHud();
  }

  // Match mechanics
  const MechanicsHooks = {
    startWave() {
      if (state.gameOver) {
        startMatch();
        return;
      }
      if (!state.gameStarted) startMatch();
      if (state.gameOver) return;
      if (state.waveActive) {
        showToast('Finish the current wave before launching another.');
        return;
      }
      state.wave++;
      state.waveKills = 0;
      state.waveTotal = 5 + state.wave * 2;
      state.spawnRemaining = state.waveTotal;
      state.spawnTimer = 0.1;
      state.waveActive = true;
      ui.fieldReport.textContent = `Wave ${state.wave} incoming · ${state.waveTotal} hostiles detected`;
      updateHud();
    },
    upgradeTower(tower) {
      if (!tower) return;
      if (tower.level >= 4) return showToast('This tower is already at maximum tier.');
      const cost = Math.round(TOWER_BLUEPRINTS[tower.type].cost * (0.68 + tower.level * 0.45));
      if (state.cash < cost) return showToast(`Upgrade requires $${cost}.`);
      state.cash -= cost;
      tower.level++;
      tower.pips.children.forEach((pip, i) => { pip.visible = i < tower.level; });
      if (tower.rangeRing) tower.rangeRing.scale.setScalar(1 + (tower.level - 1) * 0.06);
      showToast(`${TOWER_BLUEPRINTS[tower.type].name} upgraded to tier ${tower.level} · −$${cost}`);
      updateHud();
    },
    removeTower(tower) {
      if (!tower) return;
      disposeObject(tower.mesh);
      disposeObject(tower.rangeRing);
      state.towers = state.towers.filter((item) => item !== tower);
      const refund = Math.floor(TOWER_BLUEPRINTS[tower.type].cost * (0.55 + (tower.level - 1) * 0.28));
      state.cash += refund;
      selectTower(null);
      showToast(`Tower sold for $${refund}.`);
    },
    toggleSpeed() {
      state.speed = state.speed === 1 ? 2 : 1;
      document.getElementById('speed-btn').textContent = `${state.speed}× Speed`;
      showToast(`Battle speed set to ${state.speed}×`);
    },
    togglePause() {
      state.paused = !state.paused;
      document.getElementById('pause-btn').textContent = state.paused ? 'Resume' : 'Pause';
    }
  };

  // ===========================================================================
  // 8. THEME SYNC & INPUT EVENTS
  // ===========================================================================
  function applySceneTheme(mode) {
    const light = mode === 'light';
    const map = MAPS[state.mapId];
    const sky = light ? map.skyLight : map.skyDark;
    scene.background.setHex(sky);
    scene.fog.color.setHex(sky);
    seaMat.color.setHex(light ? map.waterLight : map.waterDark);
    hemiLight.intensity = light ? 1.25 : 0.95;
    sunLight.intensity = light ? 2.0 : 1.75;
    renderer.toneMappingExposure = light ? 1.08 : 1.14;
  }

  window.addEventListener('koops-games-theme-change', (e) => applySceneTheme(e.detail.theme));

  // Orbit, Zoom & Ground Raycast
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  // Fallback flat plane used only when terrain mesh is unavailable
  const fallbackGroundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.04);
  const hitPoint = new THREE.Vector3();

  let dragging = false;
  let dragStart = { x: 0, y: 0 };
  let lastPointer = { x: 0, y: 0 };

  function updatePointerGround(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    // Prefer hitting the actual terrain mesh for accurate XZ world position
    if (state.terrainMesh) {
      const hits = raycaster.intersectObject(state.terrainMesh, false);
      if (hits.length > 0) {
        state.pointerWorld.copy(hits[0].point);
        return;
      }
    }
    // Fallback: intersect flat plane
    if (raycaster.ray.intersectPlane(fallbackGroundPlane, hitPoint)) {
      state.pointerWorld.copy(hitPoint);
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    lastPointer = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('pointermove', (e) => {
    updatePointerGround(e.clientX, e.clientY);
    if (!dragging) return;
    const dx = e.clientX - lastPointer.x;
    const dy = e.clientY - lastPointer.y;
    lastPointer = { x: e.clientX, y: e.clientY };
    camCtrl.targetYaw -= dx * 0.0055;
    camCtrl.targetPitch = THREE.MathUtils.clamp(camCtrl.targetPitch + dy * 0.0045, 0.34, 1.32);
  });

  window.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    const moveDist = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
    if (moveDist > 6 || e.target !== canvas) return;

    updatePointerGround(e.clientX, e.clientY);
    const px = state.pointerWorld.x;
    const pz = state.pointerWorld.z;

    const hitTower = state.towers.slice().reverse().find((t) => Math.hypot(t.x - px, t.z - pz) < 0.72);
    if (hitTower) {
      state.selectedBlueprint = null;
      selectTower(hitTower);
      return;
    }

    if (state.selectedBlueprint) {
      if (!state.gameStarted) {
        showToast('Enter the battlefield before placing towers.');
        return;
      }
      const blueprint = TOWER_BLUEPRINTS[state.selectedBlueprint];
      if (state.cash < blueprint.cost) {
        showToast(`${blueprint.name} costs $${blueprint.cost}; earn more reserves first.`);
        return;
      }
      if (!isPlacementValid(px, pz)) {
        showToast('Choose clear ground away from the road and other towers.');
        return;
      }
      const type = state.selectedBlueprint;
      state.selectedBlueprint = null;
      state.cash -= TOWER_BLUEPRINTS[type].cost;
      placePreviewTower(type, px, pz, 1, false);
      showToast(`${TOWER_BLUEPRINTS[type].name} deployed · −$${TOWER_BLUEPRINTS[type].cost}`);
      updateHud();
      return;
    }

    selectTower(null);
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camCtrl.targetDistance = THREE.MathUtils.clamp(camCtrl.targetDistance + e.deltaY * 0.012, 8.5, 32);
  }, { passive: false });

  // UI Listeners
  document.querySelectorAll('.tower-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.tower;
      if (!state.gameStarted) {
        showToast('Choose a sector and enter the battlefield first.');
        return;
      }
      state.selectedBlueprint = state.selectedBlueprint === id ? null : id;
      if (state.selectedBlueprint && state.cash < TOWER_BLUEPRINTS[id].cost) {
        state.selectedBlueprint = null;
        showToast(`${TOWER_BLUEPRINTS[id].name} costs $${TOWER_BLUEPRINTS[id].cost}.`);
      }
      if (state.selectedBlueprint) selectTower(null);
      else updateHud();
    });
  });

  document.querySelectorAll('.map-card').forEach((card) => {
    card.addEventListener('click', () => {
      const mapId = card.dataset.map;
      document.querySelectorAll('.map-card').forEach((c) => c.classList.toggle('selected', c.dataset.map === mapId));
      ui.beginBtn.querySelector('span').textContent = `Enter ${MAPS[mapId].name}`;
      buildMapDiorama(mapId);
    });
  });

  ui.beginBtn.addEventListener('click', () => {
    startMatch();
  });

  document.getElementById('open-maps-btn').addEventListener('click', () => {
    ui.setupScreen.classList.remove('hidden');
  });

  document.querySelectorAll('.cam-btn[data-cam]').forEach((btn) => {
    btn.addEventListener('click', () => setCameraPreset(btn.dataset.cam));
  });

  document.getElementById('rotate-view-btn').addEventListener('click', () => {
    camCtrl.targetYaw += Math.PI / 2;
  });

  ui.dioramaBtn.addEventListener('click', () => {
    state.showcaseUnits = !state.showcaseUnits && !state.gameStarted;
    ui.dioramaBtn.classList.toggle('active', state.showcaseUnits);
    rebuildShowcaseUnits();
  });

  document.getElementById('upgrade-btn').addEventListener('click', () => MechanicsHooks.upgradeTower(state.selectedTower));
  document.getElementById('remove-btn').addEventListener('click', () => MechanicsHooks.removeTower(state.selectedTower));
  document.getElementById('wave-btn').addEventListener('click', () => MechanicsHooks.startWave());
  document.getElementById('speed-btn').addEventListener('click', () => MechanicsHooks.toggleSpeed());
  document.getElementById('pause-btn').addEventListener('click', () => MechanicsHooks.togglePause());
  document.getElementById('restart-btn').addEventListener('click', () => startMatch());

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      state.selectedBlueprint = null;
      selectTower(null);
    } else if (['1', '2', '3', '4'].includes(e.key)) {
      const keys = ['archer', 'cannon', 'frost', 'sniper'];
      const id = keys[Number(e.key) - 1];
      if (!state.gameStarted) return;
      state.selectedBlueprint = state.selectedBlueprint === id ? null : id;
      if (state.selectedBlueprint && state.cash < TOWER_BLUEPRINTS[id].cost) state.selectedBlueprint = null;
      updateHud();
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  });

  // ===========================================================================
  // 9. ANIMATION LOOP (VISUAL AMBIENCE & SHOWCASE)
  // ===========================================================================
  let lastNow = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    const step = state.paused ? 0 : dt * state.speed;

    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) ui.toast.classList.remove('show');
    }

    // Damped spherical camera interpolation
    const k = Math.min(1, dt * 8);
    camCtrl.yaw += (camCtrl.targetYaw - camCtrl.yaw) * k;
    camCtrl.pitch += (camCtrl.targetPitch - camCtrl.pitch) * k;
    camCtrl.distance += (camCtrl.targetDistance - camCtrl.distance) * k;
    camCtrl.lookAt.lerp(camCtrl.targetLookAt, k);

    camera.position.set(
      camCtrl.lookAt.x + Math.sin(camCtrl.yaw) * Math.cos(camCtrl.pitch) * camCtrl.distance,
      camCtrl.lookAt.y + Math.sin(camCtrl.pitch) * camCtrl.distance,
      camCtrl.lookAt.z + Math.cos(camCtrl.yaw) * Math.cos(camCtrl.pitch) * camCtrl.distance
    );
    camera.lookAt(camCtrl.lookAt);

    // Subtle water & dust animation
    Textures.water.map.offset.x = (now * 0.000022) % 1;
    Textures.water.map.offset.y = (now * 0.000014) % 1;
    Textures.water.bumpMap.offset.copy(Textures.water.map.offset);
    ambientDust.rotation.y += dt * 0.03;

    // Nexus Core & Spawn Gate ambient motion
    if (state.coreCrystal) {
      state.coreCrystal.rotation.y += step * 0.9;
      // Crystal hovers relative to the citadel group's local origin
      state.coreCrystal.position.y = 0.92 + Math.sin(now * 0.0028) * 0.08;
    }
    if (state.coreRing) state.coreRing.rotation.z += step * 0.5;
    if (state.spawnPortal) state.spawnPortal.rotation.z -= step * 1.1;
    if (state.harbourBoat) {
      state.harbourBoat.position.y = -0.92 + Math.sin(now * 0.0024) * 0.05;
      state.harbourBoat.rotation.z = Math.sin(now * 0.0018) * 0.04;
    }

    // Subtle idle turret scan & frost prism levitation
    state.towers.forEach((tower, idx) => {
      if (!tower.head) return;
      if (!state.enemies.length) tower.head.rotation.y = Math.sin(now * 0.0008 + idx * 1.3) * 0.65;
    });

    // Showcase enemy silhouettes gliding along the road
    if (state.mapCurve && state.showcaseEntities.length) {
      state.showcaseEntities.forEach((unit, idx) => {
        unit.t = (unit.t + step * 0.032) % 1;
        const pos = state.mapCurve.getPointAt(unit.t);
        const tan = state.mapCurve.getTangentAt(unit.t);
        // pos.y now follows terrain; add small hover above road surface
        unit.mesh.position.set(pos.x, pos.y + Math.abs(Math.sin(now * 0.005 + idx)) * 0.05, pos.z);
        unit.mesh.rotation.y = Math.atan2(tan.x, tan.z);
      });
    }

    updateCombat(step);

    // Placement ghost preview
    if (state.previewGroup) {
      const showGhost = Boolean(state.selectedBlueprint) && Math.abs(state.pointerWorld.x) <= WORLD_W * 0.5 && Math.abs(state.pointerWorld.z) <= WORLD_D * 0.5;
      state.previewGroup.visible = showGhost;
      if (showGhost) {
        const bp = TOWER_BLUEPRINTS[state.selectedBlueprint];
        const valid = isPlacementValid(state.pointerWorld.x, state.pointerWorld.z);
        const tint = valid ? bp.accentHex : 0xf43f5e;
        // Snap ghost to terrain surface
        const ghostY = getTerrainY(state.pointerWorld.x, state.pointerWorld.z, state.mapId, MAPS[state.mapId].path);
        state.previewGroup.position.set(state.pointerWorld.x, ghostY, state.pointerWorld.z);
        state.previewGroup.userData.ring.scale.setScalar(bp.range);
        state.previewGroup.userData.ring.material.color.setHex(tint);
        state.previewGroup.userData.disc.material.color.setHex(tint);
      }
    }

    renderer.render(scene, camera);
  }

  buildMapDiorama('harbour');
  requestAnimationFrame(animate);
})();
