/**
 * Koops Games — Community Area & Online Lobby Hall
 * Provides the 3D Community Pavilion building inside the Game Hub and a
 * dual-mode (Live Firebase RTDB + Temporary Local Preview) lobby browser/creator.
 */
(function () {
  'use strict';

  const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const TEMP_STORAGE_KEY = 'koops.community.tempLobbies.v1';
  const CLIENT_ID_KEY = 'koops.community.clientId.v1';
  const LOBBY_TTL_MS = 3 * 60 * 60 * 1000;

  const BASE_HUB_URL = new URL('./', window.location.href).href;

  const ONLINE_GAMES = {
    monopoly: {
      id: 'monopoly',
      title: 'BCP Monopoly 3D',
      shortTitle: 'Monopoly 3D',
      maxPlayers: 4,
      minPlayers: 2,
      badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35',
      dotClass: 'bg-amber-400',
      url: BASE_HUB_URL + 'Default%20Games/Monopoly/monopoly.html',
      modes: ['Christchurch Quay', 'Bournemouth Seafront', 'Poole Harbour'],
      modeToSetting: {
        'Christchurch Quay': 'christchurch',
        'Bournemouth Seafront': 'bournemouth',
        'Poole Harbour': 'poole'
      },
      supportsDirectHubRoomCreate: true
    },
    connect4: {
      id: 'connect4',
      title: 'Connect 4',
      shortTitle: 'Connect 4',
      maxPlayers: 2,
      minPlayers: 2,
      badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/35',
      dotClass: 'bg-rose-400',
      url: BASE_HUB_URL + 'Default%20Games/Connect%204/Connect4.html',
      modes: ['Evening Lounge', 'Sunlit Parlor'],
      supportsDirectHubRoomCreate: false
    }
  };

  const COMING_SOON_GAMES = ['3D Chess', 'Battleships', '3D Snooker', 'Texas Hold’em Poker'];

  function makeRoomCode() {
    const bytes = new Uint8Array(8);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes, (n) => ROOM_CHARS[n % ROOM_CHARS.length]).join('');
  }

  function makeLobbyId() {
    return `lob_${Date.now().toString(36)}_${makeRoomCode().slice(0, 4)}`;
  }

  function getClientId() {
    try {
      let id = localStorage.getItem(CLIENT_ID_KEY);
      if (!id) {
        id = `client_${makeRoomCode()}`;
        localStorage.setItem(CLIENT_ID_KEY, id);
      }
      return id;
    } catch {
      return `client_${makeRoomCode()}`;
    }
  }

  function escapeHtml(value = '') {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  function cleanText(value, maxLen, fallback = '') {
    return String(value || '').replace(/[<>]/g, '').trim().slice(0, maxLen) || fallback;
  }

  function isValidRoomCode(code) {
    return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(String(code || '').trim().toUpperCase());
  }

  function formatRelativeTime(ts) {
    const diffSec = Math.max(0, Math.floor((Date.now() - Number(ts || Date.now())) / 1000));
    if (diffSec < 45) return 'Just now';
    const mins = Math.floor(diffSec / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  }

  function buildJoinUrl(gameId, roomCode, launchHost = false, hostName = '') {
    const game = ONLINE_GAMES[gameId] || ONLINE_GAMES.monopoly;
    const url = new URL(game.url);
    if (isValidRoomCode(roomCode)) {
      url.searchParams.set('room', String(roomCode).trim().toUpperCase());
      if (launchHost) {
        url.searchParams.set('host', '1');
        if (hostName) url.searchParams.set('playerName', hostName);
      }
    }
    return url.toString();
  }

  // ===========================================================================
  // 1. 3D TEMPORARY COMMUNITY AREA & PAVILION BUILDING
  // ===========================================================================
  function createCommunitySignTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 512, 128);
    grad.addColorStop(0, '#042f2e');
    grad.addColorStop(0.5, '#0f3d3e');
    grad.addColorStop(1, '#082f49');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 128);

    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.strokeRect(14, 14, 484, 100);

    ctx.fillStyle = '#5eead4';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TEMPORARY PREVIEW AREA · ONLINE HUB', 256, 44);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px "Fraunces", Georgia, serif';
    ctx.fillText('Community Lobbies', 256, 92);

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  function createCommunityFloorBadgeTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#0f292e';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(45, 212, 191, 0.35)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(256, 256, 230, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([18, 12]);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(256, 256, 206, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(94, 234, 212, 0.72)';
    ctx.font = 'bold 26px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TEMP COMMUNITY ZONE', 256, 458);

    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
  }

  function createNoticeboardTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = '#d4a24c';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 248, 152);

    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('LIVE LOBBIES', 18, 30);

    const rows = [
      { label: 'MONOPOLY 3D', seats: '2/4', color: '#fbbf24' },
      { label: 'CONNECT 4', seats: '1/2', color: '#fb7185' },
      { label: 'OPEN ROOMS', seats: 'ONLINE', color: '#34d399' }
    ];
    rows.forEach((row, idx) => {
      const y = 46 + idx * 34;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(16, y, 224, 26);
      ctx.fillStyle = row.color;
      ctx.fillRect(16, y, 6, 26);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(row.label, 30, y + 18);
      ctx.fillStyle = '#5eead4';
      ctx.fillText(row.seats, 186, y + 18);
    });

    const tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function createCommunityArea3D({ scene, THREE, raycastTargets, showHubIntro }) {
    const position = { x: 11.5, z: -13.5 };
    const camOffset = { x: 11.5, y: 10.2, z: -2.2 };

    const root = new THREE.Group();
    root.position.set(position.x, 0, position.z);
    root.visible = !showHubIntro;
    if (showHubIntro) root.scale.setScalar(0.001);

    // Plaza Carpet / Temporary Zone Pad
    const plazaFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(4.75, 4.95, 0.08, 48),
      new THREE.MeshStandardMaterial({
        map: createCommunityFloorBadgeTexture(),
        roughness: 0.78,
        metalness: 0.08
      })
    );
    plazaFloor.position.y = 0.04;
    plazaFloor.receiveShadow = true;
    root.add(plazaFloor);

    // Interactive Selection / Hover Glow Ring
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(4.82, 5.08, 56),
      new THREE.MeshBasicMaterial({
        color: '#2dd4bf',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.36
      })
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.09;
    root.add(ringMesh);

    const woodMat = new THREE.MeshStandardMaterial({ color: '#3b2416', roughness: 0.42, metalness: 0.12 });
    const stoneMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.55, metalness: 0.08 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#d4a24c', roughness: 0.28, metalness: 0.82 });
    const tealRoofMat = new THREE.MeshStandardMaterial({ color: '#0f766e', roughness: 0.38, metalness: 0.25 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#5eead4',
      emissive: '#0d9488',
      emissiveIntensity: 0.28,
      transparent: true,
      opacity: 0.52,
      roughness: 0.15,
      metalness: 0.2
    });

    // Stepped Pavilion Terrace & Front Entry Steps
    const terrace = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.28, 4.6), stoneMat);
    terrace.position.set(0, 0.2, 0);
    terrace.castShadow = true;
    terrace.receiveShadow = true;
    root.add(terrace);

    const oakDeck = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.12, 4.1), woodMat);
    oakDeck.position.set(0, 0.4, 0);
    oakDeck.receiveShadow = true;
    root.add(oakDeck);

    const entryStep = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.16, 0.55), stoneMat);
    entryStep.position.set(0, 0.14, 2.48);
    entryStep.castShadow = true;
    entryStep.receiveShadow = true;
    root.add(entryStep);

    // Rear Clubhouse Atrium Walls & Glazing
    const rearWall = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.35, 0.24), woodMat);
    rearWall.position.set(0, 1.62, -1.72);
    rearWall.castShadow = true;
    rearWall.receiveShadow = true;
    root.add(rearWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.25, 2.1), glassMat);
    leftWall.position.set(-2.32, 1.58, -0.7);
    root.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.25, 2.1), glassMat);
    rightWall.position.set(2.32, 1.58, -0.7);
    root.add(rightWall);

    // Interior Lobby Noticeboard + Reception Desk
    const noticeboard = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.35, 0.12),
      new THREE.MeshStandardMaterial({
        map: createNoticeboardTexture(),
        emissive: '#0f766e',
        emissiveIntensity: 0.22,
        roughness: 0.35
      })
    );
    noticeboard.position.set(0, 1.82, -1.52);
    root.add(noticeboard);

    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.68, 0.65), woodMat);
    desk.position.set(0, 0.8, 0.25);
    desk.castShadow = true;
    root.add(desk);

    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.08, 0.76), brassMat);
    deskTop.position.set(0, 1.16, 0.25);
    root.add(deskTop);

    // Glowing terminal screen on counter
    const terminal = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.42, 0.08),
      new THREE.MeshStandardMaterial({ color: '#2dd4bf', emissive: '#14b8a6', emissiveIntensity: 0.65, roughness: 0.2 })
    );
    terminal.position.set(0, 1.42, 0.25);
    terminal.rotation.x = -0.22;
    root.add(terminal);

    // Four Fluted Columns with Brass Bases & Capitals
    const colCoords = [[-2.3, 1.65], [2.3, 1.65], [-2.3, -1.65], [2.3, -1.65]];
    colCoords.forEach(([cx, cz]) => {
      const colBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.2, 14), brassMat);
      colBase.position.set(cx, 0.56, cz);
      const colShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.35, 14), stoneMat);
      colShaft.position.set(cx, 1.82, cz);
      colShaft.castShadow = true;
      const colCap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.18, 0.18, 14), brassMat);
      colCap.position.set(cx, 3.04, cz);
      root.add(colBase, colShaft, colCap);
    });

    // Pavilion Roof Cornice, Sloped Canopy & Cupola
    const roofEave = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.24, 4.7), woodMat);
    roofEave.position.set(0, 3.22, 0);
    roofEave.castShadow = true;
    root.add(roofEave);

    const roofSoffitGlow = new THREE.Mesh(
      new THREE.BoxGeometry(6.02, 0.07, 4.82),
      new THREE.MeshStandardMaterial({ color: '#2dd4bf', emissive: '#14b8a6', emissiveIntensity: 0.55, roughness: 0.3 })
    );
    roofSoffitGlow.position.set(0, 3.12, 0);
    root.add(roofSoffitGlow);

    const canopy = new THREE.Mesh(new THREE.ConeGeometry(3.95, 1.35, 4), tealRoofMat);
    canopy.position.set(0, 4.0, 0);
    canopy.rotation.y = Math.PI / 4;
    canopy.scale.set(1.08, 1, 0.88);
    canopy.castShadow = true;
    root.add(canopy);

    // Front Glowing Marquee Sign
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.92, 0.18),
      [
        brassMat,
        brassMat,
        brassMat,
        brassMat,
        new THREE.MeshStandardMaterial({
          map: createCommunitySignTexture(),
          emissive: '#0f766e',
          emissiveIntensity: 0.28,
          roughness: 0.35
        }),
        woodMat
      ]
    );
    signBoard.position.set(0, 3.42, 2.38);
    signBoard.castShadow = true;
    root.add(signBoard);

    // Temporary Zone Perimeter Stanchion Bollards
    [[-3.6, 2.9], [-1.9, 3.3], [1.9, 3.3], [3.6, 2.9]].forEach(([bx, bz]) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.72, 10), brassMat);
      post.position.set(bx, 0.44, bz);
      post.castShadow = true;
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 12),
        new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#d97706', emissiveIntensity: 0.45 })
      );
      orb.position.set(bx, 0.84, bz);
      root.add(post, orb);
    });

    // Animated Rooftop Community Beacon (Crystal + Orbiting Ring)
    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(0, 5.15, 0);
    const beaconCore = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.42, 0),
      new THREE.MeshStandardMaterial({
        color: '#5eead4',
        emissive: '#14b8a6',
        emissiveIntensity: 0.75,
        roughness: 0.18,
        metalness: 0.35
      })
    );
    beaconCore.castShadow = true;
    const beaconRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.68, 0.04, 10, 36),
      new THREE.MeshStandardMaterial({
        color: '#fbbf24',
        emissive: '#d97706',
        emissiveIntensity: 0.4,
        metalness: 0.75,
        roughness: 0.25
      })
    );
    beaconRing.rotation.x = Math.PI / 3;
    beaconGroup.add(beaconCore, beaconRing);
    root.add(beaconGroup);

    // Dedicated Community Area Spotlight
    const spotLight = new THREE.PointLight('#2dd4bf', 1.25, 22);
    spotLight.position.set(position.x, 8.2, position.z + 2.5);
    scene.add(spotLight);

    scene.add(root);

    // Generous Hit-Box Collider
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 5.2, 5.8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.set(position.x, 2.5, position.z);
    hitBox.visible = !showHubIntro;
    hitBox.userData.hubAreaId = 'community';
    scene.add(hitBox);
    raycastTargets.push(hitBox);

    let spawnStartAt = null;

    return {
      id: 'community',
      position,
      camOffset,
      root,
      hitBox,
      ringMesh,
      spawn(startAt) {
        root.visible = true;
        root.scale.setScalar(0.001);
        root.position.y = -0.8;
        hitBox.visible = true;
        spawnStartAt = startAt;
      },
      setTheme(isDark) {
        spotLight.intensity = isDark ? 1.25 : 0.45;
      },
      update(elapsed, isHovered, isSelected, isDimmed) {
        const targetY = isSelected ? 0.24 : isHovered ? 0.14 : 0;
        if (spawnStartAt !== null) {
          const progress = Math.max(0, Math.min(1, (elapsed - spawnStartAt) / 0.68));
          const eased = 1 - Math.pow(1 - progress, 3);
          root.scale.setScalar(0.001 + eased * 0.999);
          root.position.y = targetY - (1 - eased) * 0.8 + Math.sin(progress * Math.PI) * 0.2;
          if (progress >= 1) {
            spawnStartAt = null;
            root.scale.set(1, 1, 1);
            root.position.y = targetY;
          }
        } else {
          root.position.y += (targetY - root.position.y) * 0.12;
        }

        const targetOpacity = isDimmed
          ? 0.08
          : isSelected
            ? 0.95
            : isHovered
              ? 0.78
              : 0.32 + Math.sin(elapsed * 2.2) * 0.08;
        ringMesh.material.opacity += (targetOpacity - ringMesh.material.opacity) * 0.12;

        beaconCore.rotation.y = elapsed * 1.1;
        beaconCore.rotation.x = Math.sin(elapsed * 0.9) * 0.25;
        beaconGroup.position.y = 5.15 + Math.sin(elapsed * 2.2) * 0.12;
        beaconRing.rotation.z = elapsed * 0.85;
        beaconRing.rotation.y = elapsed * 0.55;
      }
    };
  }

  // ===========================================================================
  // 2. COMMUNITY LOBBY STORE (LIVE FIREBASE + TEMPORARY LOCAL PREVIEW)
  // ===========================================================================
  function loadTempLobbies() {
    try {
      const raw = localStorage.getItem(TEMP_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((l) => l && Date.now() - Number(l.createdAt || 0) < LOBBY_TTL_MS);
        }
      }
    } catch {}
    const seeded = [
      {
        id: 'seed_monopoly_1',
        gameId: 'monopoly',
        title: 'Christchurch Quay Evening Match',
        hostName: 'AlexK',
        hostId: 'seed_host_1',
        modeLabel: 'Christchurch Quay',
        maxPlayers: 4,
        currentPlayers: 2,
        roomCode: '',
        source: 'preview',
        createdAt: Date.now() - 4 * 60 * 1000
      },
      {
        id: 'seed_connect4_1',
        gameId: 'connect4',
        title: 'Quick Best-of-3 Connect 4',
        hostName: 'BCP_Challenger',
        hostId: 'seed_host_2',
        modeLabel: 'Evening Lounge',
        maxPlayers: 2,
        currentPlayers: 1,
        roomCode: '',
        source: 'preview',
        createdAt: Date.now() - 2 * 60 * 1000
      }
    ];
    saveTempLobbies(seeded);
    return seeded;
  }

  function saveTempLobbies(list) {
    try {
      localStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  async function initCommunityHubUI({ getPlayerName, onOpenCommunity, onCloseCommunity, onCountChange } = {}) {
    const clientId = getClientId();
    let mode = 'preview'; // 'firebase' | 'preview'
    let firebaseCtx = null;
    let firebaseUser = null;
    let firebaseLobbies = [];
    let tempLobbies = loadTempLobbies();
    let activeFilter = 'all';
    let searchQuery = '';
    let lastCreatedBanner = null;
    let firebaseNote = '';

    // Inject Community Lobbies Modal into DOM
    const modal = document.createElement('div');
    modal.id = 'community-modal';
    modal.className = 'fixed inset-0 z-50 hidden items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'community-modal-title');
    modal.innerHTML = `
      <div class="glass-panel flex max-h-[min(820px,calc(100vh-1.5rem))] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-teal-400/35 bg-white/95 dark:bg-stone-950/95 shadow-2xl text-stone-900 dark:text-stone-100">
        <!-- Header -->
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 dark:border-white/10 px-5 py-4 sm:px-7">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full border border-teal-500/35 bg-teal-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-teal-800 dark:text-teal-300">
                <span class="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse"></span>
                Community Area
              </span>
              <span id="comm-backend-badge" class="rounded-full border border-amber-500/35 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Preview Board
              </span>
            </div>
            <h2 id="community-modal-title" class="mt-1.5 font-display text-2xl sm:text-3xl font-bold tracking-tight">Community Lobby Hall</h2>
          </div>
          <button id="comm-close-btn" type="button" aria-label="Close Community Lobby Hall"
            class="rounded-xl border border-stone-300/70 dark:border-white/10 bg-stone-100 dark:bg-white/5 p-2 text-stone-600 dark:text-stone-300 hover:bg-rose-500/15 hover:text-rose-500 transition-colors">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Quick Join by Room Code Bar -->
        <div class="border-b border-stone-200 dark:border-white/10 bg-stone-100/70 dark:bg-white/[0.025] px-5 py-3 sm:px-7 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div class="text-xs text-stone-600 dark:text-stone-300">
            Have an 8-character invite code from a friend? Jump straight into their online table:
          </div>
          <form id="comm-quick-join-form" class="flex flex-wrap items-center gap-2">
            <select id="comm-quick-game" class="rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-stone-900 px-2.5 py-1.5 text-xs font-semibold">
              <option value="monopoly">BCP Monopoly 3D</option>
              <option value="connect4">Connect 4</option>
            </select>
            <input id="comm-quick-code" type="text" maxlength="8" placeholder="8-char code"
              class="w-32 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-stone-900 px-3 py-1.5 font-mono text-xs uppercase tracking-widest" />
            <button type="submit" class="rounded-xl bg-teal-500 hover:bg-teal-400 px-3.5 py-1.5 text-xs font-bold text-stone-950 transition-colors">
              Join Code →
            </button>
          </form>
        </div>

        <!-- Main Body -->
        <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1.35fr_1fr] overflow-y-auto">
          <!-- Left: Active Online Lobbies -->
          <section class="p-5 sm:p-6 border-b lg:border-b-0 lg:border-r border-stone-200 dark:border-white/10 flex flex-col min-h-0">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 class="font-display text-lg font-bold">Lobbies Happening Now</h3>
                <p id="comm-status-note" class="text-[11px] text-stone-500 dark:text-stone-400">Browse open online tables or join a match.</p>
              </div>
              <button id="comm-refresh-btn" type="button"
                class="rounded-xl border border-stone-300 dark:border-white/15 bg-stone-100 dark:bg-white/5 px-3 py-1.5 font-mono text-[11px] font-semibold hover:border-teal-400/60">
                Refresh
              </button>
            </div>

            <!-- Filter & Search -->
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-1.5">
                <button type="button" data-comm-filter="all" class="comm-filter-btn rounded-lg px-2.5 py-1 text-xs font-semibold bg-teal-500 text-stone-950">All Online</button>
                <button type="button" data-comm-filter="monopoly" class="comm-filter-btn rounded-lg px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-white/15 text-stone-700 dark:text-stone-300">Monopoly 3D</button>
                <button type="button" data-comm-filter="connect4" class="comm-filter-btn rounded-lg px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-white/15 text-stone-700 dark:text-stone-300">Connect 4</button>
              </div>
              <input id="comm-search-input" type="search" placeholder="Search host, title or code…"
                class="w-full sm:w-48 rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-stone-900 px-3 py-1.5 text-xs" />
            </div>

            <!-- Lobby List -->
            <div id="comm-lobby-list" class="space-y-2.5 overflow-y-auto pr-1 flex-1 min-h-[220px]"></div>

            <!-- Online Roadmap Strip -->
            <div class="mt-4 pt-3 border-t border-stone-200 dark:border-white/10">
              <div class="font-mono text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">
                Other Hub Tables (Online Lobby Support Planned)
              </div>
              <div class="flex flex-wrap gap-1.5">
                ${COMING_SOON_GAMES.map((name) => `<span class="rounded-lg border border-stone-300/70 dark:border-white/10 bg-stone-100 dark:bg-white/5 px-2 py-1 text-[10px] font-medium text-stone-600 dark:text-stone-400">${escapeHtml(name)} · Soon</span>`).join('')}
              </div>
            </div>
          </section>

          <!-- Right: Create a Lobby -->
          <section class="p-5 sm:p-6 bg-stone-50/70 dark:bg-white/[0.02] flex flex-col">
            <h3 class="font-display text-lg font-bold">Create an Online Lobby</h3>
            <p class="text-xs text-stone-500 dark:text-stone-400 mt-0.5 mb-4">
              Post a match to the Community Hall for games with online multiplayer.
            </p>

            <form id="comm-create-form" class="space-y-3">
              <div>
                <label for="comm-create-game" class="block font-mono text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Online Game</label>
                <select id="comm-create-game" class="w-full rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-stone-900 px-3 py-2 text-xs font-semibold">
                  <option value="monopoly">BCP Monopoly 3D (2–4 Players)</option>
                  <option value="connect4">Connect 4 (2 Players)</option>
                </select>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label for="comm-create-host" class="block font-mono text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Host Name</label>
                  <input id="comm-create-host" type="text" maxlength="20" required
                    class="w-full rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-stone-900 px-3 py-2 text-xs font-semibold" />
                </div>
                <div>
                  <label for="comm-create-mode" class="block font-mono text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Table / Map</label>
                  <select id="comm-create-mode" class="w-full rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-stone-900 px-3 py-2 text-xs font-semibold"></select>
                </div>
              </div>

              <div>
                <label for="comm-create-title" class="block font-mono text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Lobby Title</label>
                <input id="comm-create-title" type="text" maxlength="42" placeholder="e.g. Evening Christchurch Match" required
                  class="w-full rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-stone-900 px-3 py-2 text-xs" />
              </div>

              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label for="comm-create-max" class="block font-mono text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Max Seats</label>
                  <select id="comm-create-max" class="w-full rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-stone-900 px-3 py-2 text-xs font-semibold"></select>
                </div>
                <div>
                  <label for="comm-create-code" class="block font-mono text-[10px] uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1">Room Code (Optional)</label>
                  <input id="comm-create-code" type="text" maxlength="8" placeholder="Auto or paste"
                    class="w-full rounded-xl border border-stone-300 dark:border-white/15 bg-white dark:bg-stone-900 px-3 py-2 font-mono text-xs uppercase tracking-widest" />
                </div>
              </div>

              <label class="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-300 pt-0.5 cursor-pointer">
                <input id="comm-auto-room-checkbox" type="checkbox" checked class="accent-teal-500" />
                <span>Mint an 8-character online room code automatically</span>
              </label>

              <button id="comm-create-submit" type="submit"
                class="w-full rounded-2xl bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 hover:brightness-105 py-2.5 px-4 font-bold text-xs uppercase tracking-wider text-stone-950 shadow-lg shadow-teal-500/20 transition-all">
                Create Lobby &amp; Post to Hall
              </button>
            </form>

            <div id="comm-create-feedback" class="hidden mt-3 rounded-2xl border border-teal-500/35 bg-teal-500/10 p-3 text-xs"></div>
          </section>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const listEl = modal.querySelector('#comm-lobby-list');
    const backendBadge = modal.querySelector('#comm-backend-badge');
    const statusNote = modal.querySelector('#comm-status-note');
    const gameSelect = modal.querySelector('#comm-create-game');
    const modeSelect = modal.querySelector('#comm-create-mode');
    const maxSelect = modal.querySelector('#comm-create-max');
    const hostInput = modal.querySelector('#comm-create-host');
    const titleInput = modal.querySelector('#comm-create-title');
    const codeInput = modal.querySelector('#comm-create-code');
    const autoRoomCheckbox = modal.querySelector('#comm-auto-room-checkbox');
    const feedbackEl = modal.querySelector('#comm-create-feedback');

    function syncCreateGameOptions() {
      const g = ONLINE_GAMES[gameSelect.value] || ONLINE_GAMES.monopoly;
      modeSelect.innerHTML = g.modes.map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
      const seatOpts = g.id === 'monopoly' ? [2, 3, 4] : [2];
      maxSelect.innerHTML = seatOpts.map((n) => `<option value="${n}" ${n === g.maxPlayers ? 'selected' : ''}>${n} Players</option>`).join('');
      titleInput.placeholder = g.id === 'monopoly' ? 'e.g. Christchurch Quay Match' : 'e.g. Quick Connect 4 Duel';
    }
    syncCreateGameOptions();
    gameSelect.addEventListener('change', syncCreateGameOptions);

    function getActiveLobbies() {
      const merged = [...firebaseLobbies, ...tempLobbies.filter((temp) => !firebaseLobbies.some((live) => live.id === temp.id))];
      const now = Date.now();
      return merged
        .filter((l) => l && now - Number(l.createdAt || 0) < LOBBY_TTL_MS)
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    }

    function updateBadgeAndCount() {
      const all = getActiveLobbies();
      onCountChange?.(all.length);
      if (mode === 'firebase') {
        backendBadge.textContent = 'Live Firebase Lobbies';
        backendBadge.className = 'rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300';
        statusNote.textContent = 'Connected to live community lobbies in Firebase.';
      } else {
        backendBadge.textContent = 'Temporary Preview Mode';
        backendBadge.className = 'rounded-full border border-amber-500/35 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300';
        statusNote.textContent = firebaseNote || 'Temporary local preview board inside the Game Hub. Lobbies created here persist in this browser.';
      }
    }

    function renderLobbies() {
      updateBadgeAndCount();
      const q = searchQuery.trim().toLowerCase();
      const filtered = getActiveLobbies().filter((lobby) => {
        if (activeFilter !== 'all' && lobby.gameId !== activeFilter) return false;
        if (!q) return true;
        return (
          String(lobby.title || '').toLowerCase().includes(q) ||
          String(lobby.hostName || '').toLowerCase().includes(q) ||
          String(lobby.roomCode || '').toLowerCase().includes(q) ||
          String(lobby.modeLabel || '').toLowerCase().includes(q)
        );
      });

      if (!filtered.length) {
        listEl.innerHTML = `
          <div class="rounded-2xl border border-dashed border-stone-300 dark:border-white/15 p-6 text-center text-xs text-stone-500 dark:text-stone-400">
            No matching lobbies right now. Create one on the right to invite players!
          </div>`;
        return;
      }

      const currentUid = firebaseUser?.uid || clientId;
      listEl.innerHTML = filtered.map((lobby) => {
        const game = ONLINE_GAMES[lobby.gameId] || ONLINE_GAMES.monopoly;
        const canClose = lobby.hostId === clientId || (firebaseUser?.uid && lobby.hostUid === firebaseUser.uid) || lobby.hostId === currentUid;
        const hasCode = isValidRoomCode(lobby.roomCode);
        const joinHref = buildJoinUrl(game.id, lobby.roomCode);
        return `
          <article class="rounded-2xl border border-stone-200 dark:border-white/10 bg-white dark:bg-stone-900/70 p-3.5 transition hover:border-teal-400/50">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${game.badgeClass}">
                    <span class="h-1.5 w-1.5 rounded-full ${game.dotClass}"></span>
                    ${escapeHtml(game.shortTitle)}
                  </span>
                  <span class="rounded-md bg-stone-100 dark:bg-white/5 px-2 py-0.5 font-mono text-[10px] text-stone-600 dark:text-stone-300">
                    ${escapeHtml(lobby.modeLabel || 'Standard')}
                  </span>
                  <span class="font-mono text-[10px] text-stone-400">${escapeHtml(formatRelativeTime(lobby.createdAt))}</span>
                </div>
                <h4 class="mt-1.5 font-display text-base font-bold truncate">${escapeHtml(lobby.title)}</h4>
                <p class="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                  Host: <strong class="text-stone-800 dark:text-stone-200">${escapeHtml(lobby.hostName)}</strong>
                  · Seats: <strong class="text-teal-600 dark:text-teal-300">${Number(lobby.currentPlayers || 1)}/${Number(lobby.maxPlayers || game.maxPlayers)}</strong>
                </p>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                ${hasCode ? `<button type="button" data-copy-code="${escapeHtml(lobby.roomCode)}" class="rounded-lg border border-stone-300 dark:border-white/15 bg-stone-100 dark:bg-white/5 px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-wider hover:border-teal-400/60" title="Copy room code">${escapeHtml(lobby.roomCode)}</button>` : ''}
                <a href="${escapeHtml(joinHref)}" target="_blank" rel="noopener noreferrer"
                  class="rounded-xl bg-teal-500 hover:bg-teal-400 px-3 py-1.5 text-xs font-bold text-stone-950 transition-colors">
                  ${hasCode ? 'Join Lobby ↗' : 'Open Table ↗'}
                </a>
                ${canClose ? `<button type="button" data-close-lobby="${escapeHtml(lobby.id)}" class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-rose-600 dark:text-rose-300 hover:bg-rose-500/20">Close</button>` : ''}
              </div>
            </div>
          </article>
        `;
      }).join('');
    }

    async function tryInitFirebase() {
      if (window.location.protocol === 'file:') {
        firebaseNote = 'Running locally via file:// — using Temporary Preview Mode.';
        renderLobbies();
        return;
      }
      try {
        const [{ auth, firebaseReady, realtimeDb }, authMod, dbMod] = await Promise.all([
          import('./firebase.js'),
          import('https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js'),
          import('https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js')
        ]);
        if (!firebaseReady || !auth || !realtimeDb) {
          firebaseNote = 'Firebase is not configured — using Temporary Preview Mode.';
          renderLobbies();
          return;
        }
        if (!auth.currentUser) {
          await authMod.signInAnonymously(auth);
        }
        firebaseUser = auth.currentUser;
        firebaseCtx = { auth, realtimeDb, ...dbMod };

        const lobbiesRef = dbMod.ref(realtimeDb, 'communityLobbies');
        dbMod.onValue(
          lobbiesRef,
          (snapshot) => {
            mode = 'firebase';
            const val = snapshot.val() || {};
            firebaseLobbies = Object.entries(val).map(([id, item]) => ({ id, ...item }));
            renderLobbies();
          },
          () => {
            mode = 'preview';
            firebaseNote = 'Community RTDB rules not deployed yet — using Temporary Preview Mode (Monopoly/Connect 4 room codes still link live!).';
            renderLobbies();
          }
        );
      } catch {
        mode = 'preview';
        firebaseNote = 'Offline or Firebase unavailable — using Temporary Preview Mode.';
        renderLobbies();
      }
    }

    async function tryCreateLiveMonopolyRoom(hostName, modeLabel) {
      if (!firebaseCtx || !firebaseUser) return '';
      const mapId = ONLINE_GAMES.monopoly.modeToSetting[modeLabel] || 'christchurch';
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = makeRoomCode();
        const roomRef = firebaseCtx.ref(firebaseCtx.realtimeDb, `monopolyRooms/${code}`);
        const res = await firebaseCtx.runTransaction(roomRef, (current) => {
          if (current) return;
          return {
            version: 1,
            code,
            hostUid: firebaseUser.uid,
            status: 'waiting',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            settings: {
              mapId,
              houseRules: { freeParking: false, auctions: true, doubleGo: false, startingCash: 1500 }
            },
            players: {
              seat1: {
                uid: firebaseUser.uid,
                name: hostName,
                seat: 1,
                teamId: 'Alpha',
                charId: 'scholar',
                ready: true,
                connected: true
              }
            }
          };
        }, { applyLocally: false });
        if (res.committed) return code;
        if (!res.snapshot.exists()) return '';
      }
      return '';
    }

    async function tryCreateLiveConnect4Room(hostName) {
      if (!firebaseCtx || !firebaseUser) return '';
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = makeRoomCode();
        const roomRef = firebaseCtx.ref(firebaseCtx.realtimeDb, `connect4Rooms/${code}`);
        const result = await firebaseCtx.runTransaction(roomRef, (current) => {
          if (current) return;
          return {
            hostUid: firebaseUser.uid,
            hostName,
            status: 'waiting',
            currentTurnUid: firebaseUser.uid,
            moveCount: 0,
            round: 1,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
        }, { applyLocally: false });
        if (result.committed) return code;
        if (!result.snapshot.exists()) return '';
      }
      return '';
    }

    // Bind UI Events
    modal.querySelector('#comm-close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
    });

    modal.querySelectorAll('.comm-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.commFilter;
        modal.querySelectorAll('.comm-filter-btn').forEach((b) => {
          const active = b.dataset.commFilter === activeFilter;
          b.className = active
            ? 'comm-filter-btn rounded-lg px-2.5 py-1 text-xs font-semibold bg-teal-500 text-stone-950'
            : 'comm-filter-btn rounded-lg px-2.5 py-1 text-xs font-semibold border border-stone-300 dark:border-white/15 text-stone-700 dark:text-stone-300';
        });
        renderLobbies();
      });
    });

    modal.querySelector('#comm-search-input').addEventListener('input', (e) => {
      searchQuery = e.target.value || '';
      renderLobbies();
    });

    modal.querySelector('#comm-refresh-btn').addEventListener('click', () => {
      tempLobbies = loadTempLobbies();
      renderLobbies();
    });

    modal.querySelector('#comm-quick-join-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const gId = modal.querySelector('#comm-quick-game').value;
      const rawCode = modal.querySelector('#comm-quick-code').value.trim().toUpperCase();
      if (!isValidRoomCode(rawCode)) {
        modal.querySelector('#comm-quick-code').focus();
        return;
      }
      window.open(buildJoinUrl(gId, rawCode), '_blank', 'noopener,noreferrer');
    });

    listEl.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest('[data-copy-code]');
      if (copyBtn) {
        const code = copyBtn.dataset.copyCode;
        try {
          await navigator.clipboard.writeText(code);
          const orig = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = orig; }, 1200);
        } catch {}
        return;
      }

      const closeBtn = e.target.closest('[data-close-lobby]');
      if (closeBtn) {
        const lobbyId = closeBtn.dataset.closeLobby;
        if (mode === 'firebase' && firebaseCtx) {
          try {
            await firebaseCtx.set(firebaseCtx.ref(firebaseCtx.realtimeDb, `communityLobbies/${lobbyId}`), null);
          } catch {}
        }
        tempLobbies = tempLobbies.filter((l) => l.id !== lobbyId);
        saveTempLobbies(tempLobbies);
        renderLobbies();
      }
    });

    modal.querySelector('#comm-create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const gameId = gameSelect.value;
      const game = ONLINE_GAMES[gameId] || ONLINE_GAMES.monopoly;
      const hostName = cleanText(hostInput.value, 20, 'Koops Player');
      const title = cleanText(titleInput.value, 42, `${game.shortTitle} Match`);
      const modeLabel = modeSelect.value || game.modes[0];
      const maxPlayers = Math.min(game.maxPlayers, Math.max(2, Number(maxSelect.value) || game.maxPlayers));
      let roomCode = cleanText(codeInput.value, 8, '').toUpperCase();

      const submitBtn = modal.querySelector('#comm-create-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating Lobby…';

      try {
        let mintedLive = false;
        if (!isValidRoomCode(roomCode) && autoRoomCheckbox.checked) {
          if (gameId === 'monopoly' && firebaseCtx && firebaseUser) {
            try {
              const liveCode = await tryCreateLiveMonopolyRoom(hostName, modeLabel);
              if (liveCode) {
                roomCode = liveCode;
                mintedLive = true;
              }
            } catch {}
          }
          if (gameId === 'connect4' && firebaseCtx && firebaseUser) {
            try {
              const liveCode = await tryCreateLiveConnect4Room(hostName);
              if (liveCode) {
                roomCode = liveCode;
                mintedLive = true;
              }
            } catch {}
          }
        }

        const lobbyId = makeLobbyId();
        const entry = {
          id: lobbyId,
          gameId,
          title,
          hostName,
          hostId: clientId,
          hostUid: firebaseUser?.uid || clientId,
          modeLabel,
          maxPlayers,
          currentPlayers: 1,
          roomCode: isValidRoomCode(roomCode) ? roomCode : '',
          status: 'waiting',
          createdAt: Date.now()
        };

        let savedToFirebase = false;
        if (mode === 'firebase' && firebaseCtx && firebaseUser) {
          try {
            await firebaseCtx.set(firebaseCtx.ref(firebaseCtx.realtimeDb, `communityLobbies/${lobbyId}`), entry);
            savedToFirebase = true;
          } catch {}
        }

        if (!savedToFirebase) {
          tempLobbies.unshift(entry);
          saveTempLobbies(tempLobbies);
        }

        const joinUrl = buildJoinUrl(gameId, entry.roomCode, true, hostName);
        lastCreatedBanner = entry;
        feedbackEl.classList.remove('hidden');
        feedbackEl.innerHTML = `
          <div class="font-bold text-teal-800 dark:text-teal-200">
            Lobby posted! ${entry.roomCode ? `<span class="font-mono ml-1">[${escapeHtml(entry.roomCode)}]</span>` : ''}
          </div>
          <p class="mt-1 text-stone-600 dark:text-stone-300">
            ${mintedLive ? 'Live online room reserved in Firebase!' : entry.roomCode ? 'Open the game table to host and invite others with your code.' : 'Preview lobby posted. Open the game to create a live room when online play is available.'}
          </p>
          <div class="mt-2.5 flex flex-wrap gap-2">
            <a href="${escapeHtml(joinUrl)}" target="_blank" rel="noopener noreferrer"
              class="rounded-xl bg-teal-500 hover:bg-teal-400 px-3 py-1.5 font-bold text-stone-950">
              Launch ${escapeHtml(game.shortTitle)} ↗
            </a>
            ${entry.roomCode ? `<button type="button" id="comm-copy-invite-btn" class="rounded-xl border border-teal-500/40 px-3 py-1.5 font-semibold text-teal-800 dark:text-teal-200 hover:bg-teal-500/15">Copy Invite Link</button>` : ''}
          </div>
        `;
        const inviteBtn = feedbackEl.querySelector('#comm-copy-invite-btn');
        if (inviteBtn) {
          inviteBtn.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(joinUrl);
              inviteBtn.textContent = 'Invite Copied!';
            } catch {}
          });
        }

        titleInput.value = '';
        codeInput.value = '';
        renderLobbies();
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Lobby & Post to Hall';
      }
    });

    function openModal() {
      const playerName = typeof getPlayerName === 'function' ? getPlayerName() : '';
      if (!hostInput.value.trim()) {
        hostInput.value = cleanText(playerName, 20, 'Koops Player');
      }
      renderLobbies();
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      onOpenCommunity?.();
    }

    function closeModal() {
      if (modal.classList.contains('hidden')) return;
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      onCloseCommunity?.();
    }

    renderLobbies();
    tryInitFirebase();

    return {
      openModal,
      closeModal,
      getLobbyCount: () => getActiveLobbies().length
    };
  }

  window.KoopsCommunityHub = {
    ONLINE_GAMES,
    createCommunityArea3D,
    initCommunityHubUI
  };
})();
