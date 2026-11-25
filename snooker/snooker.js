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
  let cameraMode = "overhead";
  const cameraTarget = new THREE.Vector3(0, 0, 0);

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

  const TABLE = { halfX: 5.5, halfZ: 2.45, radius: 0.115, baulkX: -4.15, dRadius: 0.94 };
  const BALL_Y = TABLE.radius + 0.02;
  const COLORS = {
    cue: 0xf7f4e8, red: 0xc31f32, yellow: 0xe9bd35, green: 0x247447,
    brown: 0x754527, blue: 0x2671bd, pink: 0xe783a9, black: 0x101313
  };
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
  const floor = addMesh(scene, new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x101c16, roughness: 0.9 }), [0, -0.86, 0], false);
  floor.rotation.x = -Math.PI / 2;
  const cabinetMaterial = new THREE.MeshStandardMaterial({ color: 0x49301e, roughness: 0.34, metalness: 0.12 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x8d673d, roughness: 0.3, metalness: 0.12 });
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
  const baulkLine = addMesh(tableGroup, new THREE.BoxGeometry(0.018, 0.012, 4.7), markingMat, [TABLE.baulkX, 0.033, 0], false);
  const dArc = new THREE.Mesh(new THREE.TorusGeometry(TABLE.dRadius, 0.012, 5, 64, Math.PI), markingMat);
  // The default half torus opens toward the right, forming the D on the baulk line.
  dArc.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  dArc.position.set(TABLE.baulkX, 0.034, 0);
  tableGroup.add(dArc);

  const spotMat = new THREE.MeshBasicMaterial({ color: 0xe5eedc, transparent: true, opacity: 0.48 });
  Object.values(COLOR_SPOTS).forEach(([x, z]) => addMesh(tableGroup, new THREE.CircleGeometry(0.045, 16), spotMat, [x, 0.034, z], false).rotation.x = -Math.PI / 2);

  const aimMaterial = new THREE.LineDashedMaterial({ color: 0xf4f3d8, dashSize: 0.12, gapSize: 0.075, transparent: true, opacity: 0.82 });
  const aimLine = new THREE.Line(new THREE.BufferGeometry(), aimMaterial);
  scene.add(aimLine);
  const cueMaterial = new THREE.MeshStandardMaterial({ color: 0xc99a5d, roughness: 0.38, metalness: 0.14 });
  const cueStick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.048, 3.7, 10), cueMaterial);
  scene.add(cueStick);

  const state = {
    started: false, inShot: false, current: 0,
    names: ["Player 1", "Player 2"], scores: [0, 0], frames: [0, 0],
    frameNumber: 1, bestOf: 3, phase: "red", sequenceIndex: 0, redsRemaining: 15,
    balls: [], cueBall: null, cueInHand: false, aiming: new THREE.Vector2(1, 0),
    power: 48, firstHit: null, shotPots: [], shotSnapshot: null,
    freeBallAvailable: false, nominatedFreeBall: null, missOption: null,
    breakScore: 0, shotMessage: "Aim for a red", tieBlack: false, matchWinner: null
  };

  const ui = {
    setup: document.getElementById("setup-screen"), rules: document.getElementById("rules-screen"), result: document.getElementById("result-screen"),
    scoreboard: document.getElementById("scoreboard"), controls: document.getElementById("controls"), status: document.getElementById("shot-status"),
    shoot: document.getElementById("shoot-btn"), power: document.getElementById("power-slider"), powerValue: document.getElementById("power-value"),
    camera: document.getElementById("camera-mode"),
    cuePlacement: document.getElementById("place-cue-btn"), freeBall: document.getElementById("free-ball-control"), freeSelect: document.getElementById("free-ball-select"),
    replay: document.getElementById("replay-shot-btn"), statusText: document.getElementById("status-text"), hint: document.getElementById("aim-hint"),
    reds: document.getElementById("reds-counter"), breakScore: document.getElementById("break-score"), frame: document.getElementById("frame-label")
  };

  function createBall(type, x, z, id) {
    const geometry = new THREE.SphereGeometry(TABLE.radius, 24, 18);
    const material = new THREE.MeshPhysicalMaterial({ color: COLORS[type], roughness: type === "cue" ? 0.17 : 0.22, metalness: 0.02, clearcoat: 0.82, clearcoatRoughness: 0.13 });
    const mesh = addMesh(scene, geometry, material, [x, BALL_Y, z]);
    const ball = { id, type, value: VALUES[type] || 0, x, z, vx: 0, vz: 0, potted: false, mesh, spot: type === "cue" ? null : [x, z] };
    state.balls.push(ball);
    if (type === "cue") state.cueBall = ball;
    return ball;
  }

  function resetFrame() {
    state.balls.forEach((b) => {
      scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose();
    });
    state.balls = [];
    state.phase = "red"; state.sequenceIndex = 0; state.redsRemaining = 15;
    state.cueInHand = false; state.freeBallAvailable = false; state.nominatedFreeBall = null;
    ui.freeSelect.value = "";
    state.missOption = null; state.breakScore = 0; state.tieBlack = false;
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
    state.aiming.set(1, 0);
    updateHud("Break off. Red is on.");
    updateAimVisuals();
  }

  function clearBalls() {
    state.balls.forEach((b) => { scene.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh.material.dispose(); });
    state.balls = [];
  }

  function ballOnNames() {
    if (state.tieBlack) return ["black"];
    if (state.phase === "red") return ["red"];
    if (state.phase === "color") return ["yellow", "green", "brown", "blue", "pink", "black"];
    if (state.phase === "sequence") return [COLOR_ORDER[state.sequenceIndex]].filter(Boolean);
    return [];
  }

  function onDescription() {
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
      document.getElementById(`frames-${i}`).textContent = `Frames ${state.frames[i]}`;
      document.getElementById(`player-card-${i}`).classList.toggle("active-player", state.current === i);
    }
    ui.frame.textContent = state.tieBlack ? "FINAL BLACK" : `FRAME ${state.frameNumber}`;
    ui.breakScore.textContent = state.breakScore;
    ui.statusText.textContent = `${state.names[state.current]} to play · ${onDescription()}`;
    ui.reds.textContent = `${state.redsRemaining} ${state.redsRemaining === 1 ? "red" : "reds"}`;
    if (message) state.shotMessage = message;
    ui.hint.textContent = cameraMode !== "overhead" ? "Viewing only. Switch to overhead to aim and shoot." : state.cueInHand ? "Ball in hand: click inside the D to place it." : state.shotMessage;
    ui.shoot.disabled = !state.started || state.inShot || state.cueInHand || Boolean(state.matchWinner) || cameraMode !== "overhead";
    ui.shoot.innerHTML = state.inShot ? "Balls in motion…" : "Take Shot <span>↗</span>";
    ui.cuePlacement.classList.toggle("hidden", !state.cueInHand);
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
    cue.x = TABLE.baulkX + 0.24; cue.z = 0;
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
    if (!state.started || state.inShot || state.cueInHand || state.matchWinner || cameraMode !== "overhead") return;
    const freeBall = state.freeBallAvailable && state.balls.find((b) => b.id === state.nominatedFreeBall && !b.potted);
    state.shotSnapshot = snapshotBalls();
    state.shotInfo = { shooter: state.current, phase: state.phase, sequenceIndex: state.sequenceIndex, freeBallId: freeBall?.id || null, freeBallType: freeBall?.type || null };
    state.firstHit = null; state.shotPots = []; state.inShot = true; state.missOption = null;
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
        }
        const middleMouth = Math.abs(ball.x) < 0.38;
        if (Math.abs(ball.z) > TABLE.halfZ - TABLE.radius && !middleMouth && !isCornerMouth(ball)) {
          ball.z = Math.sign(ball.z) * (TABLE.halfZ - TABLE.radius);
          ball.vz = -ball.vz * 0.88;
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
    document.getElementById("result-title").textContent = matchDone ? `${state.names[winner]} wins the match!` : `${state.names[winner]} wins the frame`;
    document.getElementById("result-copy").textContent = `${message} Final frame score: ${state.scores[0]} – ${state.scores[1]}. ${matchDone ? `They take the match ${state.frames[0]}–${state.frames[1]}.` : `Frame score: ${state.frames[0]}–${state.frames[1]}.`}`;
    document.getElementById("next-frame-btn").classList.toggle("hidden", matchDone);
    document.getElementById("result-screen").classList.remove("hidden");
    state.started = false;
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

  function resolveShot() {
    const pots = state.shotPots.slice();
    const shot = state.shotInfo;
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
    if (!state.started || state.inShot || cameraMode !== "overhead") return;
    const point = pointOnCloth(event);
    if (!point) return;
    if (!state.cueInHand) {
      const dx = point.x - state.cueBall.x, dz = point.z - state.cueBall.z;
      if (Math.hypot(dx, dz) > 0.2) state.aiming.set(dx, dz).normalize();
      updateAimVisuals();
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.started || state.inShot || !state.cueInHand || cameraMode !== "overhead") return;
    const point = pointOnCloth(event);
    if (!point) return;
    if (point.x > TABLE.baulkX + TABLE.radius && Math.hypot(point.x - TABLE.baulkX, point.z) <= TABLE.dRadius - TABLE.radius * 0.3 && !spotIsOccupied(point.x, point.z, state.cueBall)) {
      state.cueBall.x = point.x; state.cueBall.z = point.z;
      state.cueBall.mesh.position.set(point.x, BALL_Y, point.z);
      state.cueInHand = false;
      state.shotMessage = "Cue ball placed. Aim and take your shot.";
      updateHud(); updateAimVisuals();
    }
  });

  ui.power.addEventListener("input", () => {
    state.power = Number(ui.power.value); ui.powerValue.textContent = `${state.power}%`; updateAimVisuals();
  });
  ui.camera.addEventListener("change", () => {
    cameraMode = ui.camera.value;
    updateCameraView();
    updateHud();
  });
  ui.shoot.addEventListener("click", startShot);
  document.getElementById("start-game-btn").addEventListener("click", () => {
    state.names[0] = document.getElementById("name-one").value.trim() || "Player 1";
    state.names[1] = document.getElementById("name-two").value.trim() || "Player 2";
    state.bestOf = Number(document.getElementById("best-of").value) || 3;
    state.started = true; state.current = 0; state.scores = [0, 0]; state.frames = [0, 0]; state.frameNumber = 1;
    ui.setup.classList.add("hidden"); ui.scoreboard.classList.remove("hidden"); ui.controls.classList.remove("hidden"); ui.status.classList.remove("hidden");
    resetFrame();
  });

  document.getElementById("rules-btn").addEventListener("click", () => ui.rules.classList.remove("hidden"));
  document.getElementById("close-rules-btn").addEventListener("click", () => ui.rules.classList.add("hidden"));
  ui.cuePlacement.addEventListener("click", () => {
    state.cueBall.x = TABLE.baulkX + 0.24; state.cueBall.z = 0;
    state.cueBall.mesh.position.set(state.cueBall.x, BALL_Y, state.cueBall.z);
    state.shotMessage = "Ball in hand: click inside the D to place it.";
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
    if (cameraMode === "overhead") {
      const mobileDistance = 12.9 / (2 * Math.tan(THREE.MathUtils.degToRad(39 / 2)) * aspect);
      const height = Math.max(13.8, viewportWidth < 760 ? mobileDistance : 13.8);
      camera.position.set(0, height, height * 0.09);
    } else {
      const views = {
        side: [0, 8, 12],
        end: [-12, 7, 0],
        corner: [9, 8, 9]
      };
      const scale = Math.max(1, 0.72 / aspect);
      camera.position.fromArray(views[cameraMode] || views.side).multiplyScalar(scale);
    }
    camera.lookAt(cameraTarget);
  }
  function applySceneTheme(theme) {
    const light = theme === "light";
    scene.background.setHex(light ? 0x87998d : 0x091712);
    scene.fog.color.setHex(light ? 0x87998d : 0x091712);
    floor.material.color.setHex(light ? 0x687d6f : 0x101c16);
    felt.material.color.setHex(light ? 0x126441 : 0x147548);
    railMat.color.setHex(light ? 0x173f2c : 0x214d35);
    cabinetMaterial.color.setHex(light ? 0x392719 : 0x49301e);
    trimMaterial.color.setHex(light ? 0x76552f : 0x8d673d);
    hemisphereLight.intensity = light ? 0.78 : 0.95;
    keyLight.intensity = light ? 1.3 : 1.55;
    fillLight.intensity = light ? 0.24 : 0.38;
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
