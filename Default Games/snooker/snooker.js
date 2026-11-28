(function () {
  "use strict";

  const canvas = document.getElementById("snooker-canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x091712);
  scene.fog = new THREE.Fog(0x091712, 18, 38);
  const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 100);
  camera.position.set(0, 13.8, 1.25);
  camera.lookAt(0, 0, 0);
  const cameraTarget = new THREE.Vector3(0, 0, 0);
  const orbit = { theta: 0, phi: 0.09, radius: 13.86, minPhi: 0.16, maxPhi: 1.16 };
  let orbitPointer = null;

  const hemisphereLight = new THREE.HemisphereLight(0xe2f6e3, 0x19291f, 0.95);
  scene.add(hemisphereLight);
  const keyLight = new THREE.DirectionalLight(0xffedcc, 1.55);
  keyLight.position.set(-3.5, 11, 4.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -9;
  keyLight.shadow.camera.right = 9;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  keyLight.shadow.bias = -0.0004;
  scene.add(keyLight);
  const fillLight = new THREE.PointLight(0x89d8a9, 0.38, 18);
  fillLight.position.set(3, 5, -2);
  scene.add(fillLight);

  const roomGroup = new THREE.Group();
  scene.add(roomGroup);
  const themeMaterials = {};

  const TABLE = { halfX: 5.5, halfZ: 2.45, radius: 0.115, baulkX: -4.15, dRadius: 0.94 };
  const BALL_Y = TABLE.radius + 0.02;
  const COLORS = {
    cue: 0xf7f4e8, red: 0xc31f32, yellow: 0xe9bd35, green: 0x247447,
    brown: 0x754527, blue: 0x2671bd, pink: 0xe783a9, black: 0x101313
  };
  const POOL_COLORS = { 1: 0xf4d51c, 2: 0x2462bd, 3: 0xc93232, 4: 0x743fa8, 5: 0xf28b22, 6: 0x218348, 7: 0x7c2332, 8: 0x111111, 9: 0xf4d51c, 10: 0x2462bd, 11: 0xc93232, 12: 0x743fa8, 13: 0xf28b22, 14: 0x218348, 15: 0x7c2332 };
  const MODE_NAMES = { snooker: "Snooker", "eight-ball": "8-Ball Pool", "nine-ball": "American 9-Ball" };
  const VALUES = { red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 };
  const COLOR_ORDER = ["yellow", "green", "brown", "blue", "pink", "black"];
  const COLOR_SPOTS = {
    yellow: [-4.15, 0.88], green: [-4.15, -0.88], brown: [-4.15, 0],
    blue: [0, 0], pink: [2.72, 0], black: [5.0, 0]
  };
  const ballHitSounds = Array.from({ length: 5 }, () => {
    const audio = new Audio("Music/ballhit_SFX.mp3");
    audio.preload = "auto"; audio.volume = 0.42;
    return audio;
  });
  let ballHitSoundIndex = 0;
  const lastPairHits = new Map();
  const winSound = new Audio("Music/Win_SFX.mp3");
  winSound.preload = "auto"; winSound.volume = 0.72;

  function playBallHit(a, b) {
    const pair = [a.id, b.id].sort().join("|");
    const now = performance.now();
    if (now - (lastPairHits.get(pair) || 0) < 90) return;
    lastPairHits.set(pair, now);
    if (lastPairHits.size > 64) {
      for (const [key, time] of lastPairHits) if (now - time > 1600) lastPairHits.delete(key);
    }
    const audio = ballHitSounds[ballHitSoundIndex++ % ballHitSounds.length];
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  function addMesh(parent, geometry, material, position, castShadow = true) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Full-size cabinet, baize, hardwood rails, six pockets and the baulk/D markings.
  const tableGroup = new THREE.Group();
  scene.add(tableGroup);
  function makeFloorPlankTexture() {
    const image = document.createElement("canvas");
    image.width = image.height = 512;
    const ctx = image.getContext("2d");
    ctx.fillStyle = "#38291f";
    ctx.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 16; row++) {
      const y = row * 32;
      ctx.fillStyle = row % 2 ? "#463426" : "#3d2d22";
      ctx.fillRect(0, y + 1, 512, 30);
      ctx.fillStyle = "rgba(11,8,6,.58)";
      ctx.fillRect(0, y + 30, 512, 2);
      for (let col = row % 2 ? -1 : 0; col < 8; col++) {
        const x = col * 72 + (row % 2 ? 36 : 0);
        ctx.fillStyle = "rgba(220,177,119,.08)";
        ctx.fillRect(x + 2, y + 3, 1, 25);
        ctx.fillStyle = "rgba(8,6,5,.38)";
        ctx.fillRect(x + 70, y, 2, 32);
        ctx.strokeStyle = "rgba(224,192,143,.08)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 8, y + 8);
        ctx.lineTo(x + 58, y + 8);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(image);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(18, 18);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 8;
    return texture;
  }

  const floor = addMesh(scene, new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ map: makeFloorPlankTexture(), color: 0x9b8b74, roughness: 0.76 }), [0, -0.86, 0], false);
  floor.rotation.x = -Math.PI / 2;
  const cabinetMaterial = new THREE.MeshStandardMaterial({ color: 0x49301e, roughness: 0.34, metalness: 0.12 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x8d673d, roughness: 0.3, metalness: 0.12 });
  themeMaterials.wall = new THREE.MeshStandardMaterial({ color: 0x18271e, roughness: 0.84 });
  themeMaterials.wainscot = new THREE.MeshStandardMaterial({ color: 0x254332, roughness: 0.68 });
  themeMaterials.wallTrim = new THREE.MeshStandardMaterial({ color: 0x765438, roughness: 0.43, metalness: 0.12 });
  themeMaterials.carpet = new THREE.MeshStandardMaterial({ color: 0x35493a, roughness: 0.96 });
  themeMaterials.cushion = new THREE.MeshStandardMaterial({ color: 0x326045, roughness: 0.91 });
  themeMaterials.brass = new THREE.MeshStandardMaterial({ color: 0xb68b4e, roughness: 0.3, metalness: 0.7 });
  addMesh(tableGroup, new THREE.BoxGeometry(12.75, 0.58, 6.78), cabinetMaterial, [0, -0.31, 0]);
  addMesh(tableGroup, new THREE.BoxGeometry(12.95, 0.18, 6.98), trimMaterial, [0, -0.08, 0]);
  const felt = addMesh(tableGroup, new THREE.PlaneGeometry(TABLE.halfX * 2, TABLE.halfZ * 2), new THREE.MeshStandardMaterial({ color: 0x147548, roughness: 0.92, metalness: 0.01 }), [0, 0.015, 0], false);
  felt.rotation.x = -Math.PI / 2;

  const railMat = new THREE.MeshStandardMaterial({ color: 0x214d35, roughness: 0.37, metalness: 0.06 });
  // Long cushion rails have openings for the middle and corner pockets.
  for (const z of [-2.66, 2.66]) {
    for (const [from, to] of [[-5.2, -0.34], [0.34, 5.2]]) {
      const length = to - from;
      addMesh(tableGroup, new THREE.BoxGeometry(length, 0.28, 0.34), railMat, [(from + to) / 2, 0.12, z]);
      addMesh(tableGroup, new THREE.BoxGeometry(length, 0.045, 0.37), trimMaterial, [(from + to) / 2, 0.27, z]);
    }
  }
  for (const x of [-5.7, 5.7]) {
    addMesh(tableGroup, new THREE.BoxGeometry(0.34, 0.28, 4.18), railMat, [x, 0.12, 0]);
    addMesh(tableGroup, new THREE.BoxGeometry(0.37, 0.045, 4.18), trimMaterial, [x, 0.27, 0]);
  }

  const pocketPositions = [
    [-5.57, -2.57], [0, -2.57], [5.57, -2.57],
    [-5.57, 2.57], [0, 2.57], [5.57, 2.57]
  ];
  const pocketMat = new THREE.MeshStandardMaterial({ color: 0x030605, roughness: 0.95 });
  pocketPositions.forEach(([x, z]) => addMesh(tableGroup, new THREE.CylinderGeometry(0.31, 0.34, 0.08, 28), pocketMat, [x, 0.03, z], false));

  const markingMat = new THREE.MeshBasicMaterial({ color: 0xe7efdb, transparent: true, opacity: 0.65 });
  const snookerMarkings = new THREE.Group(); tableGroup.add(snookerMarkings);
  const baulkLine = addMesh(snookerMarkings, new THREE.BoxGeometry(0.018, 0.012, 4.7), markingMat, [TABLE.baulkX, 0.033, 0], false);
  const dArc = new THREE.Mesh(new THREE.TorusGeometry(TABLE.dRadius, 0.012, 5, 64, Math.PI), markingMat);
  // The default half torus opens toward the right, forming the D on the baulk line.
  dArc.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  dArc.position.set(TABLE.baulkX, 0.034, 0);
  snookerMarkings.add(dArc);

  const spotMat = new THREE.MeshBasicMaterial({ color: 0xe5eedc, transparent: true, opacity: 0.48 });
  Object.values(COLOR_SPOTS).forEach(([x, z]) => addMesh(snookerMarkings, new THREE.CircleGeometry(0.045, 16), spotMat, [x, 0.034, z], false).rotation.x = -Math.PI / 2);

  // A private club surrounds the table, with the open ceiling kept clear for
  // the overhead camera. All room props sit outside the playing surface.
  const roomLights = [];
  const makeClubArt = (title, accent) => {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 320;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#10251b"; ctx.fillRect(0, 0, 512, 320);
    ctx.strokeStyle = "#b68b4e"; ctx.lineWidth = 12; ctx.strokeRect(16, 16, 480, 288);
    ctx.strokeStyle = "#d4bd8e"; ctx.lineWidth = 2; ctx.strokeRect(31, 31, 450, 258);
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(256, 115, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.34)"; ctx.beginPath(); ctx.arc(238, 96, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ead9b2"; ctx.textAlign = "center"; ctx.font = "bold 34px Georgia"; ctx.fillText(title, 256, 230);
    ctx.font = "16px Georgia"; ctx.fillText("EST. 1927  •  MEMBERS' ROOM", 256, 265);
    const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding;
    return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 });
  };
  const addArt = (x, y, z, title, accent, rotationY = 0) => {
    const frame = addMesh(roomGroup, new THREE.BoxGeometry(2.15, 1.53, 0.12), themeMaterials.wallTrim, [x, y, z]);
    frame.rotation.y = rotationY;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.92, 1.3), makeClubArt(title, accent));
    art.position.set(x, y, z + (rotationY === 0 ? 0.071 : 0));
    art.rotation.y = rotationY;
    if (rotationY !== 0) art.position.x += Math.sin(rotationY) * 0.071;
    roomGroup.add(art);
  };

  // Soft patterned rug and a double brass border frame the table.
  addMesh(roomGroup, new THREE.BoxGeometry(17.4, 0.035, 10.4), themeMaterials.carpet, [0, -0.835, 0]);
  for (const [x, z, sx, sz] of [[0, -4.92, 16.9, 0.035], [0, 4.92, 16.9, 0.035], [-8.42, 0, 0.035, 9.8], [8.42, 0, 0.035, 9.8]]) {
    addMesh(roomGroup, new THREE.BoxGeometry(sx, 0.012, sz), themeMaterials.brass, [x, -0.813, z]);
  }
  for (const x of [-7.9, 7.9]) for (const z of [-4.4, 4.4]) {
    addMesh(roomGroup, new THREE.CylinderGeometry(0.18, 0.18, 0.012, 24), themeMaterials.brass, [x, -0.811, z]);
  }

  // Short turned legs and cross braces give the cabinet a grounded silhouette.
  for (const x of [-5.05, 5.05]) for (const z of [-2.35, 2.35]) {
    addMesh(tableGroup, new THREE.CylinderGeometry(0.24, 0.32, 0.28, 12), cabinetMaterial, [x, -0.72, z]);
    addMesh(tableGroup, new THREE.CylinderGeometry(0.31, 0.35, 0.055, 12), trimMaterial, [x, -0.83, z]);
    addMesh(tableGroup, new THREE.CylinderGeometry(0.25, 0.25, 0.028, 12), trimMaterial, [x, -0.60, z]);
  }
  addMesh(tableGroup, new THREE.BoxGeometry(9.2, 0.12, 0.18), cabinetMaterial, [0, -0.72, 0]);
  addMesh(tableGroup, new THREE.BoxGeometry(0.18, 0.12, 4.1), cabinetMaterial, [0, -0.72, 0]);

  // Paneled walls create a visible room perimeter without placing a ceiling.
  addMesh(roomGroup, new THREE.BoxGeometry(34, 8.4, 0.55), themeMaterials.wall, [0, 3.35, -14]);
  addMesh(roomGroup, new THREE.BoxGeometry(34, 8.4, 0.55), themeMaterials.wall, [0, 3.35, 14]);
  addMesh(roomGroup, new THREE.BoxGeometry(0.55, 8.4, 28), themeMaterials.wall, [-17, 3.35, 0]);
  addMesh(roomGroup, new THREE.BoxGeometry(0.55, 8.4, 28), themeMaterials.wall, [17, 3.35, 0]);
  const addWallBand = (w, h, d, x, y, z, material) => addMesh(roomGroup, new THREE.BoxGeometry(w, h, d), material, [x, y, z]);
  for (const z of [-13.68, 13.68]) {
    addWallBand(33.3, 2.1, 0.06, 0, 0.05, z, themeMaterials.wainscot);
    addWallBand(33.4, 0.13, 0.12, 0, 1.16, z, themeMaterials.wallTrim);
    addWallBand(33.4, 0.16, 0.14, 0, 2.15, z, themeMaterials.wallTrim);
    for (let x = -15; x <= 15; x += 2.5) addWallBand(0.075, 0.82, 0.09, x, 0.05, z - 0.035, themeMaterials.wallTrim);
  }
  for (const x of [-16.68, 16.68]) {
    addWallBand(0.06, 2.1, 27.3, x, 0.05, 0, themeMaterials.wainscot);
    addWallBand(0.12, 0.13, 27.4, x, 1.16, 0, themeMaterials.wallTrim);
    addWallBand(0.14, 0.16, 27.4, x, 2.15, 0, themeMaterials.wallTrim);
    for (let z = -12; z <= 12; z += 2.5) addWallBand(0.09, 0.82, 0.075, x, 0.05, z, themeMaterials.wallTrim);
  }
  // Crown rails and tall framed club prints decorate the far wall.
  for (const z of [-13.66, 13.66]) addWallBand(33.4, 0.22, 0.18, 0, 7.38, z, themeMaterials.wallTrim);
  for (const x of [-16.66, 16.66]) addWallBand(0.18, 0.22, 27.4, x, 7.38, 0, themeMaterials.wallTrim);
  addArt(-6, 4.45, -13.66, "THE BREAK", "#c74737");
  addArt(0, 4.45, -13.66, "THE CLUB", "#e6d9aa");
  addArt(6, 4.45, -13.66, "THE FRAME", "#d7a72f");

  // Cue rack, lounge benches and leafy corner planters finish the room.
  for (const x of [-15.9, 15.9]) {
    const inward = x < 0 ? 1 : -1;
    addMesh(roomGroup, new THREE.BoxGeometry(0.14, 0.16, 3.2), themeMaterials.wallTrim, [x, 2.0, 0]);
    addMesh(roomGroup, new THREE.BoxGeometry(0.14, 0.16, 3.2), themeMaterials.wallTrim, [x, 3.6, 0]);
    for (let i = 0; i < 6; i++) {
      const cue = addMesh(roomGroup, new THREE.CylinderGeometry(0.035, 0.06, 2.8, 8), cabinetMaterial, [x + inward * 0.1, 2.8, -1.3 + i * 0.52]);
      cue.rotation.z = inward * 0.04;
    }
  }
  for (const x of [-9.1, 9.1]) {
    addMesh(roomGroup, new THREE.BoxGeometry(1.05, 0.22, 4.6), cabinetMaterial, [x, 0.18, 0]);
    addMesh(roomGroup, new THREE.BoxGeometry(1.0, 0.72, 0.2), themeMaterials.cushion, [x, 0.62, -2.12]);
    for (const z of [-1.8, 1.8]) addMesh(roomGroup, new THREE.BoxGeometry(0.12, 0.65, 0.12), themeMaterials.wallTrim, [x, -0.24, z]);
  }
  for (const x of [-13.4, 13.4]) for (const z of [-10.8, 10.8]) {
    addMesh(roomGroup, new THREE.CylinderGeometry(0.55, 0.42, 0.68, 12), cabinetMaterial, [x, -0.47, z]);
    addMesh(roomGroup, new THREE.CylinderGeometry(0.57, 0.57, 0.07, 12), themeMaterials.brass, [x, -0.13, z]);
    for (let i = 0; i < 5; i++) {
      const leaf = addMesh(roomGroup, new THREE.ConeGeometry(0.28, 1.6 + (i % 2) * 0.35, 7), themeMaterials.cushion, [x + Math.cos(i * 1.26) * 0.3, 0.85 + (i % 2) * 0.12, z + Math.sin(i * 1.26) * 0.3]);
      leaf.rotation.z = Math.cos(i * 1.26) * 0.22;
      leaf.rotation.x = Math.sin(i * 1.26) * 0.22;
    }
  }
  // Brass shaded sconces and billiard pendants provide pools of warm light.
  for (const [x, z] of [[-10, -13.55], [10, -13.55], [-10, 13.55], [10, 13.55]]) {
    addMesh(roomGroup, new THREE.BoxGeometry(0.24, 0.55, 0.18), themeMaterials.brass, [x, 5.2, z]);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd797 }));
    globe.position.set(x, 5.28, z + (z < 0 ? 0.16 : -0.16)); roomGroup.add(globe);
    const light = new THREE.PointLight(0xffc879, 0.65, 10, 2); light.position.set(x, 5.15, z + (z < 0 ? 0.3 : -0.3)); scene.add(light); roomLights.push(light);
  }
  for (const [x, z] of [[-7.5, -1.1], [7.5, 1.1]]) {
    addMesh(roomGroup, new THREE.CylinderGeometry(0.07, 0.1, 1.1, 10), themeMaterials.brass, [x, 4.65, z]);
    addMesh(roomGroup, new THREE.CylinderGeometry(0.45, 0.62, 0.28, 12), themeMaterials.brass, [x, 4.05, z]);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd797 }));
    lamp.position.set(x, 3.87, z); roomGroup.add(lamp);
    const light = new THREE.PointLight(0xffc879, 0.8, 11, 2); light.position.set(x, 3.8, z); scene.add(light); roomLights.push(light);
  }

  const aimMaterial = new THREE.LineDashedMaterial({ color: 0xf4f3d8, dashSize: 0.12, gapSize: 0.075, transparent: true, opacity: 0.82 });
  const aimLine = new THREE.Line(new THREE.BufferGeometry(), aimMaterial);
  scene.add(aimLine);
  const cueMaterial = new THREE.MeshStandardMaterial({ color: 0xc99a5d, roughness: 0.38, metalness: 0.14 });
  const cueStick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.048, 3.7, 10), cueMaterial);
  scene.add(cueStick);

  const state = {
    started: false, inShot: false, current: 0,
    mode: "snooker", poolGroups: [null, null], breakShot: true,
    names: ["Player 1", "Player 2"], scores: [0, 0], frames: [0, 0],
    frameNumber: 1, bestOf: 3, phase: "red", sequenceIndex: 0, redsRemaining: 15,
    balls: [], cueBall: null, cueInHand: false, aiming: new THREE.Vector2(1, 0),
    power: 48, firstHit: null, railContact: false, shotPots: [], shotSnapshot: null,
    freeBallAvailable: false, nominatedFreeBall: null, missOption: null,
    breakScore: 0, shotMessage: "Aim for a red", tieBlack: false, matchWinner: null
  };

  const ui = {
    setup: document.getElementById("setup-screen"), rules: document.getElementById("rules-screen"), result: document.getElementById("result-screen"),
    scoreboard: document.getElementById("scoreboard"), controls: document.getElementById("controls"), status: document.getElementById("shot-status"),
    shoot: document.getElementById("shoot-btn"), power: document.getElementById("power-slider"), powerValue: document.getElementById("power-value"),
    camera: document.getElementById("camera-reset"), mode: document.getElementById("game-mode"), rulesTitle: document.getElementById("rules-title"), rulesCopy: document.getElementById("rules-copy"),
    cuePlacement: document.getElementById("place-cue-btn"), freeBall: document.getElementById("free-ball-control"), freeSelect: document.getElementById("free-ball-select"),
    replay: document.getElementById("replay-shot-btn"), statusText: document.getElementById("status-text"), hint: document.getElementById("aim-hint"),
    reds: document.getElementById("reds-counter"), breakScore: document.getElementById("break-score"), frame: document.getElementById("frame-label")
  };

  function createBall(type, x, z, id, poolNumber = null) {
    let mesh;
    if (poolNumber !== null) {
      mesh = new THREE.Group();
      const isStripe = poolNumber >= 9;
      const ballColor = isStripe ? 0xf5f2e8 : POOL_COLORS[poolNumber];
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(TABLE.radius, 24, 18), new THREE.MeshPhysicalMaterial({ color: ballColor, roughness: 0.2, metalness: 0.02, clearcoat: 0.82, clearcoatRoughness: 0.13 }));
      mesh.add(sphere);
      if (isStripe) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(TABLE.radius * 0.78, TABLE.radius * 0.18, 8, 24), new THREE.MeshStandardMaterial({ color: POOL_COLORS[poolNumber], roughness: 0.27 }));
        band.rotation.x = Math.PI / 2;
        mesh.add(band);
      }
      const labelCanvas = document.createElement("canvas"); labelCanvas.width = labelCanvas.height = 128;
      const labelContext = labelCanvas.getContext("2d");
      labelContext.fillStyle = "#f8f7ef"; labelContext.beginPath(); labelContext.arc(64, 64, 55, 0, Math.PI * 2); labelContext.fill();
      labelContext.strokeStyle = "#151515"; labelContext.lineWidth = 6; labelContext.stroke();
      labelContext.fillStyle = "#111"; labelContext.font = "bold 68px Arial"; labelContext.textAlign = "center"; labelContext.textBaseline = "middle"; labelContext.fillText(String(poolNumber), 64, 66);
      const labelTexture = new THREE.CanvasTexture(labelCanvas); labelTexture.encoding = THREE.sRGBEncoding;
      const number = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthTest: true }));
      number.position.y = TABLE.radius * 0.82; number.scale.set(0.12, 0.12, 1); mesh.add(number);
      mesh.position.set(x, BALL_Y, z); mesh.traverse((part) => { if (part.isMesh) { part.castShadow = true; part.receiveShadow = true; } });
      scene.add(mesh);
    } else {
      const geometry = new THREE.SphereGeometry(TABLE.radius, 24, 18);
      const material = new THREE.MeshPhysicalMaterial({ color: COLORS[type], roughness: type === "cue" ? 0.17 : 0.22, metalness: 0.02, clearcoat: 0.82, clearcoatRoughness: 0.13 });
      mesh = addMesh(scene, geometry, material, [x, BALL_Y, z]);
    }
    const group = poolNumber === null ? null : poolNumber <= 7 ? "solids" : poolNumber <= 15 ? "stripes" : null;
    const ball = { id, type, value: poolNumber || VALUES[type] || 0, poolNumber, group, x, z, vx: 0, vz: 0, potted: false, mesh, spot: type === "cue" ? null : [x, z] };
    state.balls.push(ball);
    if (type === "cue") state.cueBall = ball;
    return ball;
  }

  function resetFrame() {
    state.balls.forEach((b) => {
      disposeBall(b);
    });
    state.balls = [];
    state.phase = "red"; state.sequenceIndex = 0; state.redsRemaining = 15;
    state.cueInHand = false; state.freeBallAvailable = false; state.nominatedFreeBall = null; state.poolGroups = [null, null]; state.breakShot = true;
    ui.freeSelect.value = "";
    state.missOption = null; state.breakScore = 0; state.tieBlack = false;
    snookerMarkings.visible = state.mode === "snooker";
    if (state.mode === "snooker") {
      createBall("cue", TABLE.baulkX + 0.26, 0.08, "cue");
      Object.entries(COLOR_SPOTS).forEach(([type, [x, z]]) => createBall(type, x, z, type));
      let redId = 0;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col <= row; col++) {
          const z = (col - row / 2) * TABLE.radius * 2.08;
          const x = 3.1 + row * TABLE.radius * 2.05;
          createBall("red", x, z, `red-${redId++}`);
        }
      }
      updateHud("Break off. Red is on.");
    } else {
      createBall("cue", -3.7, 0, "cue");
      const rack = state.mode === "eight-ball" ? [1, 9, 2, 3, 8, 10, 11, 4, 12, 5, 6, 13, 7, 14, 15] : [1, 2, 3, 4, 9, 5, 6, 7, 8];
      let index = 0;
      for (let row = 0; row < (state.mode === "eight-ball" ? 5 : 5); row++) {
        const count = state.mode === "eight-ball" ? row + 1 : row < 2 ? row + 1 : row < 3 ? 3 : 5 - row;
        for (let col = 0; col < count; col++) {
          const number = rack[index++];
          const z = (col - (count - 1) / 2) * TABLE.radius * 2.08;
          const x = 2.35 + row * TABLE.radius * 2.08;
          createBall("pool", x, z, `pool-${number}`, number);
        }
      }
      state.redsRemaining = state.mode === "eight-ball" ? 15 : 9;
      updateHud(state.mode === "eight-ball" ? "Break shot. The table is open; no groups are assigned." : "Break shot. The 1 ball is on; pocket the 9 to win.");
    }
    state.aiming.set(1, 0);
    updateAimVisuals();
  }

  function clearBalls() {
    state.balls.forEach(disposeBall);
    state.balls = [];
  }

  function disposeBall(ball) {
    scene.remove(ball.mesh);
    ball.mesh.traverse((part) => {
      if (!part.isMesh && !part.isSprite) return;
      part.geometry?.dispose();
      if (Array.isArray(part.material)) part.material.forEach((material) => { material.map?.dispose(); material.dispose(); });
      else if (part.material) { part.material.map?.dispose(); part.material.dispose(); }
    });
  }

  function ballOnNames() {
    if (state.tieBlack) return ["black"];
    if (state.phase === "red") return ["red"];
    if (state.phase === "color") return ["yellow", "green", "brown", "blue", "pink", "black"];
    if (state.phase === "sequence") return [COLOR_ORDER[state.sequenceIndex]].filter(Boolean);
    return [];
  }

  function onDescription() {
    if (state.mode === "eight-ball") {
      const group = state.poolGroups[state.current];
      if (!group) return "Open table · pot a ball to choose solids or stripes";
      const left = state.balls.filter((ball) => !ball.potted && ball.group === group).length;
      return `${capitalize(group)} · ${left} left, then the 8 ball`;
    }
    if (state.mode === "nine-ball") {
      const lowest = state.balls.filter((ball) => !ball.potted && ball.poolNumber !== null).sort((a, b) => a.poolNumber - b.poolNumber)[0];
      return lowest ? `Ball ${lowest.poolNumber} on · pocket the 9 to win` : "9-Ball · table clear";
    }
    if (state.tieBlack) return "Re-spotted black · first pot or foul wins";
    if (state.phase === "red") return "Red on · 1 point";
    if (state.phase === "color") return state.redsRemaining > 0 ? "Colour on · 2–7 points" : "Final colour · 2–7 points";
    if (state.phase === "sequence") return `${capitalize(COLOR_ORDER[state.sequenceIndex])} on · ${VALUES[COLOR_ORDER[state.sequenceIndex]]} points`;
    return "Frame complete";
  }

  function capitalize(text) { return text ? text[0].toUpperCase() + text.slice(1) : ""; }

  function updateHud(message) {
    for (let i = 0; i < 2; i++) {
      document.getElementById(`player-name-${i}`).textContent = state.names[i];
      document.getElementById(`score-${i}`).textContent = state.scores[i];
      document.getElementById(`frames-${i}`).textContent = `${state.mode === "snooker" ? "Frames" : "Games"} ${state.frames[i]}`;
      document.getElementById(`player-card-${i}`).classList.toggle("active-player", state.current === i);
    }
    ui.frame.textContent = state.tieBlack ? "FINAL BLACK" : state.mode === "snooker" ? `FRAME ${state.frameNumber}` : `${state.mode === "eight-ball" ? "8-BALL" : "9-BALL"} · GAME ${state.frameNumber}`;
    ui.breakScore.textContent = state.breakScore;
    const assignedGroup = state.mode === "eight-ball" ? state.poolGroups[state.current] : null;
    ui.statusText.textContent = `${state.names[state.current]}${assignedGroup ? ` (${assignedGroup})` : ""} to play · ${onDescription()}`;
    if (state.mode === "snooker") ui.reds.textContent = `${state.redsRemaining} ${state.redsRemaining === 1 ? "red" : "reds"}`;
    else {
      const remaining = state.balls.filter((ball) => !ball.potted && ball.poolNumber !== null).length;
      ui.reds.textContent = state.mode === "eight-ball" && state.poolGroups[state.current] ? `${remaining} balls remain` : state.mode === "eight-ball" ? "Open table" : `${remaining} balls remain`;
    }
    if (message) state.shotMessage = message;
    ui.hint.textContent = state.cueInHand
      ? state.mode === "snooker" ? "Click inside the D to place it. Drag anywhere to orbit." : "Click the cloth to place the cue ball. Drag to orbit."
      : "Drag anywhere to orbit. Move over the cloth to aim.";
    document.querySelector(".frame-info small").textContent = state.mode === "snooker" ? "BREAK" : "POCKETS";
    document.getElementById("concede-btn").textContent = state.mode === "snooker" ? "Concede frame" : "Concede game";
    ui.shoot.disabled = !state.started || state.inShot || state.cueInHand || Boolean(state.matchWinner);
    ui.shoot.innerHTML = state.inShot ? "Balls in motion…" : "Take Shot <span>↗</span>";
    ui.cuePlacement.classList.toggle("hidden", !state.cueInHand);
    ui.cuePlacement.textContent = state.mode === "snooker" ? "Place cue ball in D" : "Place cue ball anywhere";
    ui.replay.classList.toggle("hidden", !state.missOption || state.inShot);
    ui.freeBall.classList.toggle("hidden", !state.freeBallAvailable || state.inShot);
    updateFreeBallMenu();
  }

  function updateFreeBallMenu() {
    if (!state.freeBallAvailable) {
      ui.freeSelect.innerHTML = `<option value="">Choose a ball</option>`;
      state.nominatedFreeBall = null;
      return;
    }
    const current = ui.freeSelect.value;
    const eligible = state.balls.filter((b) => !b.potted && b.type !== "cue" && !ballOnNames().includes(b.type));
    ui.freeSelect.innerHTML = `<option value="">Choose a ball</option>${eligible.map((b) => `<option value="${b.id}">${capitalize(b.type)} (${b.value})</option>`).join("")}`;
    if (eligible.some((b) => b.id === current)) ui.freeSelect.value = current;
    state.nominatedFreeBall = ui.freeSelect.value || null;
  }

  function spotIsOccupied(x, z, ignore) {
    return state.balls.some((b) => b !== ignore && !b.potted && Math.hypot(b.x - x, b.z - z) < TABLE.radius * 2.05);
  }

  function respotBall(ball) {
    const ownSpot = ball.spot || COLOR_SPOTS[ball.type];
    if (!ownSpot) return;
    let spot = ownSpot;
    if (spotIsOccupied(spot[0], spot[1], ball)) {
      const priority = ["black", "pink", "blue", "brown", "green", "yellow"];
      spot = priority.map((name) => COLOR_SPOTS[name]).find(([x, z]) => !spotIsOccupied(x, z, ball)) || ownSpot;
    }
    ball.potted = false; ball.x = spot[0]; ball.z = spot[1]; ball.vx = 0; ball.vz = 0;
    ball.mesh.visible = true; ball.mesh.position.set(ball.x, BALL_Y, ball.z);
  }

  function setCueBallInHand() {
    const cue = state.cueBall;
    cue.potted = false; cue.vx = 0; cue.vz = 0;
    cue.x = state.mode === "snooker" ? TABLE.baulkX + 0.24 : -3.7; cue.z = 0;
    cue.mesh.visible = true; cue.mesh.position.set(cue.x, BALL_Y, cue.z);
    state.cueInHand = true;
  }

  function snapshotBalls() {
    return state.balls.map((b) => ({ id: b.id, x: b.x, z: b.z, vx: b.vx, vz: b.vz, potted: b.potted }));
  }

  function restoreSnapshot(snapshot) {
    const saved = new Map(snapshot.map((b) => [b.id, b]));
    state.balls.forEach((ball) => {
      const original = saved.get(ball.id);
      if (!original) return;
      ball.x = original.x; ball.z = original.z; ball.vx = 0; ball.vz = 0; ball.potted = original.potted;
      ball.mesh.visible = !original.potted;
      ball.mesh.position.set(ball.x, BALL_Y, ball.z);
    });
  }

  function startShot() {
    if (!state.started || state.inShot || state.cueInHand || state.matchWinner) return;
    const freeBall = state.freeBallAvailable && state.balls.find((b) => b.id === state.nominatedFreeBall && !b.potted);
    state.shotSnapshot = snapshotBalls();
    const lowestPoolBall = state.mode === "nine-ball" ? state.balls.filter((ball) => !ball.potted && ball.poolNumber !== null).sort((a, b) => a.poolNumber - b.poolNumber)[0] : null;
    state.shotInfo = { mode: state.mode, shooter: state.current, phase: state.phase, sequenceIndex: state.sequenceIndex, poolTarget: lowestPoolBall?.poolNumber || null, isBreak: state.breakShot, freeBallId: freeBall?.id || null, freeBallType: freeBall?.type || null };
    state.breakShot = false;
    state.firstHit = null; state.railContact = false; state.shotPots = []; state.inShot = true; state.missOption = null;
    state.freeBallAvailable = false; state.nominatedFreeBall = null;
    const speed = 2.6 + (state.power / 100) * 7.1;
    state.cueBall.vx = state.aiming.x * speed;
    state.cueBall.vz = state.aiming.y * speed;
    state.breakScore = state.breakScore || 0;
    state.shotMessage = `Shot played at ${state.power}% power.`;
    updateHud();
  }

  function isNearPocket(ball) {
    return pocketPositions.some(([x, z]) => Math.hypot(ball.x - x, ball.z - z) < 0.36);
  }

  function isCornerMouth(ball) {
    return Math.abs(ball.x) > 5.1 && Math.abs(ball.z) > 2.2;
  }

  function recordPot(ball) {
    if (ball.potted) return;
    ball.potted = true; ball.vx = 0; ball.vz = 0; ball.mesh.visible = false;
    state.shotPots.push(ball);
    if (ball.type === "cue") state.cueScratch = true;
  }

  function stepPhysics(dt) {
    const substeps = Math.max(1, Math.ceil(dt / 0.012));
    const step = dt / substeps;
    for (let s = 0; s < substeps; s++) {
      const live = state.balls.filter((b) => !b.potted);
      live.forEach((ball) => {
        ball.x += ball.vx * step; ball.z += ball.vz * step;
        const decay = Math.exp(-0.72 * step);
        ball.vx *= decay; ball.vz *= decay;
        if (Math.hypot(ball.vx, ball.vz) < 0.035) { ball.vx = 0; ball.vz = 0; }

        if (isNearPocket(ball)) { recordPot(ball); return; }
        if (Math.abs(ball.x) > TABLE.halfX - TABLE.radius && !isCornerMouth(ball)) {
          ball.x = Math.sign(ball.x) * (TABLE.halfX - TABLE.radius);
          ball.vx = -ball.vx * 0.88;
          if (state.inShot && state.firstHit) state.railContact = true;
        }
        const middleMouth = Math.abs(ball.x) < 0.38;
        if (Math.abs(ball.z) > TABLE.halfZ - TABLE.radius && !middleMouth && !isCornerMouth(ball)) {
          ball.z = Math.sign(ball.z) * (TABLE.halfZ - TABLE.radius);
          ball.vz = -ball.vz * 0.88;
          if (state.inShot && state.firstHit) state.railContact = true;
        }
      });

      const moving = state.balls.filter((b) => !b.potted);
      for (let i = 0; i < moving.length; i++) {
        for (let j = i + 1; j < moving.length; j++) {
          const a = moving[i], b = moving[j];
          const dx = b.x - a.x, dz = b.z - a.z;
          const distance = Math.hypot(dx, dz);
          const diameter = TABLE.radius * 2;
          if (distance >= diameter || distance < 0.00001) continue;
          const nx = dx / distance, nz = dz / distance;
          if (!state.firstHit && (a.type === "cue" || b.type === "cue")) state.firstHit = a.type === "cue" ? b : a;
          const relative = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
          if (relative < 0) {
            const impulse = -(1 + 0.96) * relative / 2;
            a.vx -= impulse * nx; a.vz -= impulse * nz;
            b.vx += impulse * nx; b.vz += impulse * nz;
            playBallHit(a, b);
          }
          const overlap = diameter - distance;
          a.x -= nx * overlap * 0.51; a.z -= nz * overlap * 0.51;
          b.x += nx * overlap * 0.51; b.z += nz * overlap * 0.51;
        }
      }
      state.balls.forEach((ball) => {
        if (!ball.potted) ball.mesh.position.set(ball.x, BALL_Y, ball.z);
      });
    }
  }

  function isBallOn(ball, shot) {
    if (!ball || ball.type === "cue") return false;
    if (shot.freeBallId && ball.id === shot.freeBallId) return true;
    if (shot.phase === "red") return ball.type === "red";
    if (shot.phase === "color") return Object.hasOwn(VALUES, ball.type) && ball.type !== "red";
    if (shot.phase === "sequence") return ball.type === COLOR_ORDER[shot.sequenceIndex];
    if (shot.phase === "re_spotted_black") return ball.type === "black";
    return false;
  }

  function foulDetails(pots, shot) {
    const cuePotted = pots.some((b) => b.type === "cue");
    const legalFirst = isBallOn(state.firstHit, shot);
    const invalidPots = pots.filter((b) => b.type !== "cue" && !isBallOn(b, shot));
    if (cuePotted) return { foul: true, reason: "Cue ball potted", wrong: invalidPots };
    if (!state.firstHit) return { foul: true, reason: "No ball was contacted", wrong: invalidPots };
    if (!legalFirst) return { foul: true, reason: `Hit ${capitalize(state.firstHit.type)} first`, wrong: invalidPots };
    if (invalidPots.length) return { foul: true, reason: `Potted ${capitalize(invalidPots[0].type)} out of order`, wrong: invalidPots };
    return { foul: false, reason: "", wrong: [] };
  }

  function snookeredFromCue() {
    const cue = state.cueBall;
    const cueX = cue.potted ? TABLE.baulkX + 0.24 : cue.x;
    const cueZ = cue.potted ? 0 : cue.z;
    const targets = state.balls.filter((b) => !b.potted && ballOnNames().includes(b.type));
    if (!targets.length) return false;
    return targets.every((target) => {
      const dx = target.x - cueX, dz = target.z - cueZ;
      const lengthSq = Math.max(0.0001, dx * dx + dz * dz);
      return state.balls.filter((other) => !other.potted && other !== target && other.type !== "cue").every((other) => {
        const t = Math.max(0, Math.min(1, ((other.x - cueX) * dx + (other.z - cueZ) * dz) / lengthSq));
        const closestX = cueX + t * dx, closestZ = cueZ + t * dz;
        return Math.hypot(other.x - closestX, other.z - closestZ) >= TABLE.radius * 1.95;
      });
    });
  }

  function awardFrame(winner, message) {
    winSound.currentTime = 0;
    winSound.play().catch(() => {});
    state.frames[winner] += 1;
    const needed = Math.floor(state.bestOf / 2) + 1;
    const matchDone = state.frames[winner] >= needed;
    state.matchWinner = matchDone ? winner : null;
    const unit = state.mode === "snooker" ? "frame" : "game";
    document.getElementById("result-kicker").textContent = state.mode === "snooker" ? "FRAME COMPLETE" : "GAME COMPLETE";
    document.getElementById("result-title").textContent = matchDone ? `${state.names[winner]} wins the match!` : `${state.names[winner]} wins the ${unit}`;
    document.getElementById("result-copy").textContent = `${message} Final ${unit} score: ${state.scores[0]} – ${state.scores[1]}. ${matchDone ? `They take the match ${state.frames[0]}–${state.frames[1]}.` : `${state.mode === "snooker" ? "Frame" : "Game"} score: ${state.frames[0]}–${state.frames[1]}.`}`;
    document.getElementById("next-frame-btn").textContent = state.mode === "snooker" ? "Next frame →" : "Next game →";
    document.getElementById("next-frame-btn").classList.toggle("hidden", matchDone);
    document.getElementById("result-screen").classList.remove("hidden");
    state.started = false;
    updateHud();
  }

  function finishFrameByScore() {
    if (state.scores[0] === state.scores[1]) {
      state.tieBlack = true;
      state.phase = "re_spotted_black";
      const black = state.balls.find((b) => b.type === "black");
      black.spot = COLOR_SPOTS.black;
      respotBall(black);
      setCueBallInHand();
      state.current = 1 - state.current;
      state.shotMessage = "Scores are level. The black is re-spotted; the next pot or foul decides the frame.";
      updateHud();
      return;
    }
    const winner = state.scores[0] > state.scores[1] ? 0 : 1;
    awardFrame(winner, `${state.names[winner]} wins on points.`);
  }

  function resolvePoolShot(pots, shot) {
    const shooter = shot.shooter;
    const opponent = 1 - shooter;
    const objects = pots.filter((ball) => ball.poolNumber !== null);
    const eightBall = pots.some((ball) => ball.poolNumber === 8);
    const nineBall = pots.some((ball) => ball.poolNumber === 9);
    let foulReason = "";

    if (pots.some((ball) => ball.type === "cue")) foulReason = "Cue ball scratched";
    else if (!state.firstHit) foulReason = "No object ball was hit";
    else if (!objects.length && !state.railContact) foulReason = "No ball reached a cushion after contact";
    else if (state.mode === "nine-ball" && state.firstHit.poolNumber !== shot.poolTarget) foulReason = `Hit the ${state.firstHit.poolNumber} first instead of the ${shot.poolTarget}`;
    else if (state.mode === "eight-ball") {
      const group = state.poolGroups[shooter];
      const groupRemaining = group ? state.balls.filter((ball) => !ball.potted && ball.group === group).length : 0;
      if (!group && state.firstHit.poolNumber === 8) foulReason = "The 8 ball cannot be hit first on an open table";
      else if (group && groupRemaining > 0 && state.firstHit.group !== group) foulReason = `Hit ${group} first`;
      else if (group && groupRemaining === 0 && state.firstHit.poolNumber !== 8) foulReason = "The 8 ball is next";
    }

    if (foulReason) {
      if (state.mode === "eight-ball" && eightBall) {
        if (shot.isBreak) respotPoolNumber(8, [[2.83, 0], [2.83, 0.25], [2.83, -0.25], [3.1, 0]]);
        else {
          awardFrame(opponent, `${foulReason}. The 8 ball was potted illegally, so ${state.names[opponent]} wins.`);
          return;
        }
      }
      if (state.mode === "nine-ball" && nineBall) respotPoolNine();
      state.current = opponent;
      state.breakScore = 0;
      setCueBallInHand();
      state.freeBallAvailable = false; state.nominatedFreeBall = null; state.missOption = null;
      state.shotMessage = `Foul: ${foulReason}. ${state.names[opponent]} has ball in hand anywhere on the table.`;
      updateHud(); updateAimVisuals();
      return;
    }

    if (state.mode === "eight-ball" && eightBall && shot.isBreak) {
      respotPoolNumber(8, [[2.83, 0], [2.83, 0.25], [2.83, -0.25], [3.1, 0]]);
    } else if (state.mode === "eight-ball" && eightBall) {
      const group = state.poolGroups[shooter];
      const remaining = group ? state.balls.filter((ball) => !ball.potted && ball.group === group).length : 1;
      if (group && remaining === 0) awardFrame(shooter, `${state.names[shooter]} legally cleared their group and potted the 8 ball.`);
      else awardFrame(opponent, `${state.names[shooter]} potted the 8 ball before clearing their group. ${state.names[opponent]} wins.`);
      return;
    }
    if (state.mode === "nine-ball" && nineBall) {
      state.scores[shooter] += objects.length;
      awardFrame(shooter, `${state.names[shooter]} legally pocketed the 9 ball.`);
      return;
    }

    const scoredObjects = objects.filter((ball) => !(state.mode === "eight-ball" && shot.isBreak && ball.poolNumber === 8));
    if (state.mode === "eight-ball" && !state.poolGroups[shooter]) {
      const firstGroupPot = scoredObjects.find((ball) => ball.group === "solids" || ball.group === "stripes");
      if (firstGroupPot) {
        state.poolGroups[shooter] = firstGroupPot.group;
        state.poolGroups[opponent] = firstGroupPot.group === "solids" ? "stripes" : "solids";
      }
    }
    const ownGroup = state.poolGroups[shooter];
    const keptTurn = scoredObjects.some((ball) => state.mode === "nine-ball" || ball.group === ownGroup);
    state.scores[shooter] += scoredObjects.length;
    state.breakScore = keptTurn ? state.breakScore + scoredObjects.length : 0;
    state.current = keptTurn ? shooter : opponent;
    state.cueInHand = false;
    state.shotMessage = scoredObjects.length
      ? `${state.names[shooter]} pocketed ${scoredObjects.length} ball${scoredObjects.length === 1 ? "" : "s"}${state.mode === "eight-ball" && ownGroup ? ` (${ownGroup})` : ""}.${keptTurn ? " Play continues." : ` ${state.names[opponent]} is up.`}`
      : `${state.names[opponent]} is up. No ball was pocketed.`;
    updateHud();
  }

  function respotPoolNine() {
    respotPoolNumber(9, [[4.8, 0], [4.55, 0], [4.8, 0.25], [4.8, -0.25], [4.3, 0]]);
  }

  function respotPoolNumber(number, candidates) {
    const ball = state.balls.find((item) => item.poolNumber === number);
    if (!ball) return;
    const spot = candidates.find(([x, z]) => !spotIsOccupied(x, z, ball)) || candidates[0];
    ball.potted = false; ball.x = spot[0]; ball.z = spot[1]; ball.vx = 0; ball.vz = 0;
    ball.mesh.visible = true; ball.mesh.position.set(ball.x, BALL_Y, ball.z);
  }

  function resolveShot() {
    const pots = state.shotPots.slice();
    const shot = state.shotInfo;
    if (state.mode !== "snooker") {
      resolvePoolShot(pots, shot);
      return;
    }
    const foul = foulDetails(pots, shot);
    const shooter = shot.shooter;
    const opponent = 1 - shooter;
    const redPots = pots.filter((b) => b.type === "red");
    const nominatedPotted = shot.freeBallId && pots.some((b) => b.id === shot.freeBallId);

    if (state.tieBlack) {
      if (foul.foul) {
        awardFrame(opponent, `${foul.reason}. ${state.names[opponent]} wins the re-spotted black.`);
        return;
      }
      if (pots.some((b) => b.type === "black")) {
        state.scores[shooter] += 7;
        awardFrame(shooter, `${state.names[shooter]} potted the re-spotted black.`);
        return;
      }
      state.current = opponent; state.breakScore = 0;
      state.shotMessage = "No pot. The re-spotted black stays on the table.";
      updateHud();
      return;
    }

    if (foul.foul) {
      const onValue = shot.phase === "red" ? 1 : shot.phase === "sequence" ? VALUES[COLOR_ORDER[shot.sequenceIndex]] : 2;
      const highestPenalty = Math.max(0, state.firstHit?.value || 0, ...foul.wrong.map((b) => b.value));
      const penalty = Math.min(7, Math.max(4, onValue, highestPenalty));
      state.scores[opponent] += penalty;
      state.breakScore = 0;
      pots.filter((b) => b.type !== "red" && b.type !== "cue").forEach(respotBall);
      state.redsRemaining = state.balls.filter((b) => b.type === "red" && !b.potted).length;
      if (shot.phase === "red" && state.redsRemaining === 0) state.phase = "color";
      if (pots.some((b) => b.type === "cue")) setCueBallInHand();
      state.current = opponent;
      state.freeBallAvailable = snookeredFromCue();
      state.nominatedFreeBall = null;
      ui.freeSelect.value = "";
      state.missOption = {
        balls: state.shotSnapshot, shooter, phase: shot.phase,
        sequenceIndex: shot.sequenceIndex, redsRemaining: state.redsRemaining
      };
      state.shotMessage = `Foul: ${foul.reason}. ${state.names[opponent]} receives ${penalty} points.`;
      updateHud();
      return;
    }

    state.freeBallAvailable = false;
    state.nominatedFreeBall = null;
    let scored = 0;
    if (shot.phase === "red") {
      scored = redPots.length + (nominatedPotted ? 1 : 0);
      if (scored > 0) {
        state.scores[shooter] += scored;
        state.breakScore += scored;
        state.redsRemaining = state.balls.filter((b) => b.type === "red" && !b.potted).length;
        pots.filter((b) => b.id === shot.freeBallId).forEach(respotBall);
        state.phase = "color";
        state.shotMessage = `${state.names[shooter]} pots ${scored === 1 ? "a ball for 1 point" : `${scored} reds for ${scored} points`}. Colour on.`;
      }
    } else if (shot.phase === "color") {
      const pottedColors = pots.filter((b) => b.type !== "cue" && b.type !== "red");
      if (pottedColors.length || nominatedPotted) {
        const scoringBall = pottedColors.sort((a, b) => b.value - a.value)[0];
        scored = shot.freeBallId && nominatedPotted ? (shot.phase === "red" ? 1 : scoringBall?.value || 2) : scoringBall?.value || 2;
        state.scores[shooter] += scored; state.breakScore += scored;
        pottedColors.forEach(respotBall);
        if (nominatedPotted) pots.filter((b) => b.id === shot.freeBallId).forEach(respotBall);
        if (state.redsRemaining > 0) {
          state.phase = "red";
          state.shotMessage = `${state.names[shooter]} scores ${scored}. The colour is re-spotted; red is on.`;
        } else {
          state.phase = "sequence"; state.sequenceIndex = 0;
          state.shotMessage = `${state.names[shooter]} scores ${scored}. Clear the colours in order, starting with yellow.`;
        }
      }
    } else if (shot.phase === "sequence") {
      const requiredColor = COLOR_ORDER[shot.sequenceIndex];
      const requiredPotted = pots.some((b) => b.type === requiredColor) || nominatedPotted;
      if (requiredPotted) {
        scored = VALUES[requiredColor];
        state.scores[shooter] += scored; state.breakScore += scored;
        if (nominatedPotted) pots.filter((b) => b.id === shot.freeBallId).forEach(respotBall);
        state.sequenceIndex += 1;
        state.shotMessage = `${state.names[shooter]} clears ${requiredColor} for ${scored}.`;
        if (state.sequenceIndex >= COLOR_ORDER.length) {
          updateHud(); finishFrameByScore(); return;
        }
      }
    }

    if (scored > 0) {
      state.current = shooter;
      state.missOption = null;
    } else {
      state.current = opponent;
      state.breakScore = 0;
      if (shot.phase === "red") state.shotMessage = "No red potted. Turn passes.";
      else if (shot.phase === "color") state.shotMessage = "No colour potted. Turn passes.";
      else state.shotMessage = "No ball on potted. Turn passes.";
      state.missOption = null;
    }
    state.cueInHand = false;
    updateHud();
  }

  function tick(dt) {
    if (state.inShot) {
      stepPhysics(Math.min(dt, 0.04));
      const moving = state.balls.some((b) => !b.potted && Math.hypot(b.vx, b.vz) > 0.035);
      if (!moving) {
        state.restTimer = (state.restTimer || 0) + dt;
        if (state.restTimer > 0.22) {
          state.restTimer = 0; state.inShot = false; resolveShot();
        }
      } else state.restTimer = 0;
      updateAimVisuals();
    }
  }

  function updateAimVisuals() {
    const cue = state.cueBall;
    if (!cue || cue.potted) { aimLine.visible = false; cueStick.visible = false; return; }
    const dir = state.aiming;
    const start = new THREE.Vector3(cue.x, TABLE.radius + 0.055, cue.z);
    const end = new THREE.Vector3(cue.x + dir.x * 3.3, TABLE.radius + 0.055, cue.z + dir.y * 3.3);
    aimLine.geometry.dispose(); aimLine.geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    aimLine.computeLineDistances(); aimLine.visible = !state.inShot && !state.cueInHand;
    cueStick.visible = state.started && !state.inShot && !state.cueInHand;
    cueStick.position.set(cue.x - dir.x * (2.15 + state.power * 0.009), 0.15, cue.z - dir.y * (2.15 + state.power * 0.009));
    cueStick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dir.x, 0, dir.y));
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function pointOnCloth(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(felt, false)[0];
    return hit ? hit.point : null;
  }

  canvas.addEventListener("pointermove", (event) => {
    if (orbitPointer && event.pointerId === orbitPointer.id) {
      const dx = event.clientX - orbitPointer.lastX;
      const dy = event.clientY - orbitPointer.lastY;
      if (!orbitPointer.moved && Math.hypot(event.clientX - orbitPointer.startX, event.clientY - orbitPointer.startY) > 5) orbitPointer.moved = true;
      if (orbitPointer.moved) {
        orbit.theta -= dx * 0.008;
        orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * 0.006, orbit.minPhi, orbit.maxPhi);
        updateCameraView();
      }
      orbitPointer.lastX = event.clientX;
      orbitPointer.lastY = event.clientY;
      return;
    }
    if (!state.started || state.inShot || state.cueInHand) return;
    const point = pointOnCloth(event);
    if (!point) return;
    if (!state.cueInHand) {
      const dx = point.x - state.cueBall.x, dz = point.z - state.cueBall.z;
      if (Math.hypot(dx, dz) > 0.2) state.aiming.set(dx, dz).normalize();
      updateAimVisuals();
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    if (orbitPointer || (state.inShot && state.started)) return;
    orbitPointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
    canvas.classList.add("orbit-dragging");
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  const finishPointer = (event) => {
    if (!orbitPointer || event.pointerId !== orbitPointer.id) return;
    if (Math.hypot(event.clientX - orbitPointer.startX, event.clientY - orbitPointer.startY) > 5) orbitPointer.moved = true;
    const wasClick = !orbitPointer.moved;
    orbitPointer = null;
    canvas.classList.remove("orbit-dragging");
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (wasClick && state.started && !state.inShot && state.cueInHand) {
      const point = pointOnCloth(event);
      const validPlacement = state.mode === "snooker"
        ? point && point.x > TABLE.baulkX + TABLE.radius && Math.hypot(point.x - TABLE.baulkX, point.z) <= TABLE.dRadius - TABLE.radius * 0.3
        : point && Math.abs(point.x) <= TABLE.halfX - TABLE.radius && Math.abs(point.z) <= TABLE.halfZ - TABLE.radius;
      if (validPlacement && !spotIsOccupied(point.x, point.z, state.cueBall)) {
        state.cueBall.x = point.x; state.cueBall.z = point.z;
        state.cueBall.mesh.position.set(point.x, BALL_Y, point.z);
        state.cueInHand = false;
        state.shotMessage = "Cue ball placed. Aim and take your shot.";
        updateHud(); updateAimVisuals();
      }
    }
  };
  canvas.addEventListener("pointerup", finishPointer);
  canvas.addEventListener("pointercancel", finishPointer);
  canvas.addEventListener("lostpointercapture", (event) => {
    if (orbitPointer && event.pointerId === orbitPointer.id) {
      orbitPointer = null;
      canvas.classList.remove("orbit-dragging");
    }
  });

  ui.power.addEventListener("input", () => {
    state.power = Number(ui.power.value); ui.powerValue.textContent = `${state.power}%`; updateAimVisuals();
  });
  ui.camera.addEventListener("click", () => {
    orbit.theta = 0;
    orbit.phi = 0.09;
    updateCameraView();
  });
  const rulesByMode = {
    snooker: `<h3>Build a break</h3><p>Pot a red for 1 point, then a colour of your choice (yellow 2, green 3, brown 4, blue 5, pink 6 or black 7). Re-spot colours while reds remain. After the final red, clear yellow through black in order.</p><h3>Fouls and frame end</h3><p>Hit the ball on first and avoid potting balls out of order. Fouls award at least 4 points (up to 7) to the opponent; a scratch gives ball in hand in the D. After all colours, the higher score wins; a tie is decided by a re-spotted black.</p><h3>Controls</h3><p>Drag to orbit. Move over the cloth to aim, set power, then take your shot. Click inside the D to place a cue ball after a scratch. Press Space to shoot.</p>`,
    "eight-ball": `<h3>Solids and stripes</h3><p>The table starts open. The first legally pocketed numbered ball assigns solids (1–7) or stripes (9–15) to that player; the opponent gets the other set. Continue shooting while you legally pocket one of your group.</p><h3>Win and fouls</h3><p>Clear your group, then pocket the 8 ball to win. Pocketing the 8 early, or pocketing it on a foul, loses the game. If the 8 drops on the break, it is spotted again. Scratching, failing to hit a ball, or hitting the wrong group first gives the opponent ball in hand anywhere on the table. Other balls pocketed remain down.</p><h3>Controls</h3><p>Drag to orbit. Move over the cloth to aim, set power, then take your shot. Click anywhere on the cloth to place ball in hand. Press Space to shoot.</p>`,
    "nine-ball": `<h3>Play the lowest ball first</h3><p>There are balls 1–9. On each shot, the cue ball must contact the lowest-numbered ball still on the table first. You may pocket other balls in any order; pocketing any ball legally keeps your turn.</p><h3>Win and fouls</h3><p>Legally pocket the 9 ball to win. A scratch, no contact, or hitting a ball other than the lowest one first is a foul and gives the opponent ball in hand anywhere on the table. The 9 is re-racked only if it is pocketed on a foul.</p><h3>Controls</h3><p>Drag to orbit. Move over the cloth to aim, set power, then take your shot. Click anywhere on the cloth to place ball in hand. Press Space to shoot.</p>`
  };
  function renderModeRules(mode = ui.mode.value) {
    const name = MODE_NAMES[mode] || MODE_NAMES.snooker;
    ui.rulesTitle.innerHTML = `${name}, <em>at a glance.</em>`;
    ui.rulesCopy.innerHTML = rulesByMode[mode] || rulesByMode.snooker;
  }
  ui.mode.addEventListener("change", () => renderModeRules());
  ui.shoot.addEventListener("click", startShot);
  document.getElementById("start-game-btn").addEventListener("click", () => {
    state.mode = ui.mode.value;
    state.names[0] = document.getElementById("name-one").value.trim() || "Player 1";
    state.names[1] = document.getElementById("name-two").value.trim() || "Player 2";
    state.bestOf = Number(document.getElementById("best-of").value) || 3;
    state.started = true; state.current = 0; state.scores = [0, 0]; state.frames = [0, 0]; state.frameNumber = 1;
    ui.setup.classList.add("hidden"); ui.scoreboard.classList.remove("hidden"); ui.controls.classList.remove("hidden"); ui.status.classList.remove("hidden");
    resetFrame();
  });

  renderModeRules();
  document.getElementById("rules-btn").addEventListener("click", () => { renderModeRules(state.started ? state.mode : ui.mode.value); ui.rules.classList.remove("hidden"); });
  document.getElementById("close-rules-btn").addEventListener("click", () => ui.rules.classList.add("hidden"));
  ui.cuePlacement.addEventListener("click", () => {
    state.cueBall.x = state.mode === "snooker" ? TABLE.baulkX + 0.24 : -3.7; state.cueBall.z = 0;
    state.cueBall.mesh.position.set(state.cueBall.x, BALL_Y, state.cueBall.z);
    state.shotMessage = state.mode === "snooker" ? "Ball in hand: click inside the D to place it." : "Ball in hand: click anywhere on the table to place it.";
    updateHud();
  });
  ui.freeSelect.addEventListener("change", () => { state.nominatedFreeBall = ui.freeSelect.value || null; });
  ui.replay.addEventListener("click", () => {
    if (!state.missOption || state.inShot) return;
    restoreSnapshot(state.missOption.balls);
    state.current = state.missOption.shooter;
    state.cueInHand = false;
    state.phase = state.missOption.phase;
    state.sequenceIndex = state.missOption.sequenceIndex;
    state.redsRemaining = state.balls.filter((b) => b.type === "red" && !b.potted).length;
    state.freeBallAvailable = false; state.nominatedFreeBall = null;
    state.missOption = null; state.breakScore = 0;
    state.shotMessage = "Foul and a miss called. The balls have been replaced; the original player plays again.";
    updateHud(); updateAimVisuals();
  });
  document.getElementById("next-frame-btn").addEventListener("click", () => {
    document.getElementById("result-screen").classList.add("hidden");
    state.matchWinner = null; state.frameNumber += 1; state.current = (state.frameNumber - 1) % 2;
    state.scores = [0, 0]; state.breakScore = 0; state.started = true;
    resetFrame();
  });
  document.getElementById("concede-btn").addEventListener("click", () => {
    if (state.started && !state.inShot) awardFrame(1 - state.current, `${state.names[state.current]} conceded the frame.`);
  });
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" && ui.setup.classList.contains("hidden") && ui.rules.classList.contains("hidden") && ui.result.classList.contains("hidden")) {
      event.preventDefault(); startShot();
    }
    if (event.key.toLowerCase() === "r" && !ui.rules.classList.contains("hidden")) ui.rules.classList.add("hidden");
  });

  function resize() {
    const width = window.innerWidth, height = window.innerHeight;
    camera.aspect = width / height;
    updateCameraView(width);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }
  function updateCameraView(viewportWidth = window.innerWidth) {
    const aspect = camera.aspect || window.innerWidth / window.innerHeight;
    const mobileDistance = 12.9 / (2 * Math.tan(THREE.MathUtils.degToRad(39 / 2)) * aspect);
    orbit.radius = Math.max(13.86, viewportWidth < 760 ? mobileDistance : 13.86);
    camera.position.set(
      cameraTarget.x + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta),
      cameraTarget.y + orbit.radius * Math.cos(orbit.phi),
      cameraTarget.z + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta)
    );
    camera.lookAt(cameraTarget);
  }
  function applySceneTheme(theme) {
    const light = theme === "light";
    scene.background.setHex(light ? 0x87998d : 0x091712);
    scene.fog.color.setHex(light ? 0x87998d : 0x091712);
    floor.material.color.setHex(light ? 0x687d6f : 0x101c16);
    themeMaterials.wall.color.setHex(light ? 0x435448 : 0x18271e);
    themeMaterials.wainscot.color.setHex(light ? 0x355944 : 0x254332);
    themeMaterials.wallTrim.color.setHex(light ? 0x8c6a41 : 0x765438);
    themeMaterials.carpet.color.setHex(light ? 0x687b67 : 0x35493a);
    themeMaterials.cushion.color.setHex(light ? 0x3b7656 : 0x326045);
    themeMaterials.brass.color.setHex(light ? 0xc59b5c : 0xb68b4e);
    felt.material.color.setHex(light ? 0x126441 : 0x147548);
    railMat.color.setHex(light ? 0x173f2c : 0x214d35);
    cabinetMaterial.color.setHex(light ? 0x392719 : 0x49301e);
    trimMaterial.color.setHex(light ? 0x76552f : 0x8d673d);
    hemisphereLight.intensity = light ? 0.78 : 0.95;
    keyLight.intensity = light ? 1.3 : 1.55;
    fillLight.intensity = light ? 0.24 : 0.38;
    roomLights.forEach((lamp) => { lamp.intensity = light ? 0.38 : 0.72; });
    renderer.toneMappingExposure = light ? 0.78 : 0.98;
  }
  window.addEventListener("koops-games-theme-change", (event) => applySceneTheme(event.detail.theme));
  applySceneTheme(document.documentElement.dataset.theme || "dark");
  window.addEventListener("resize", resize);
  resize();

  let lastTime = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.04, (now - lastTime) / 1000);
    lastTime = now;
    tick(dt);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
})();
