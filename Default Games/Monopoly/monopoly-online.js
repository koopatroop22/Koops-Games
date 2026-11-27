import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { get, onDisconnect, onValue, ref, runTransaction, set } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js';
import { auth, firebaseReady, realtimeDb } from '../../firebase.js';

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeRoomCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => ROOM_CHARS[n % ROOM_CHARS.length]).join('');
}

function cleanName(value) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, 20) || 'BCP Player';
}

export class MonopolyOnline {
  constructor({ onRoom, onError }) {
    this.onRoom = onRoom;
    this.onError = onError;
    this.user = null;
    this.code = null;
    this.isHost = false;
    this.stopRoom = null;
    this.roomData = null;
    this.presenceRef = null;
    this.presenceDisconnect = null;
  }

  async ensureUser() {
    if (!firebaseReady || !auth || !realtimeDb) throw new Error('Firebase is not configured. Check firebase-config.js.');
    if (!auth.currentUser) await signInAnonymously(auth);
    this.user = auth.currentUser;
    return this.user;
  }

  async create(name, settings) {
    const user = await this.ensureUser();
    const player = { uid: user.uid, name: cleanName(name), seat: 1, teamId: 'Alpha', charId: 'scholar', ready: true, connected: true };
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = makeRoomCode();
      const roomRef = ref(realtimeDb, `monopolyRooms/${code}`);
      const result = await runTransaction(roomRef, (current) => {
        if (current) return;
        return {
          version: 1,
          code,
          hostUid: user.uid,
          status: 'waiting',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          settings,
          players: { seat1: player }
        };
      }, { applyLocally: false });
      if (result.committed) {
        this.attach(code, true);
        return code;
      }
      // A collision returns an existing room snapshot and is safe to retry.
      // A denied write has no committed room, so report the rules issue instead
      // of generating several identical permission_denied warnings.
      if (!result.snapshot.exists()) {
        throw new Error('Firebase denied room creation. Publish database.rules.json with the monopolyRooms rules and enable Anonymous sign-in.');
      }
    }
    throw new Error('Could not reserve a room code. Please try again.');
  }

  async join(codeInput, name) {
    const user = await this.ensureUser();
    const code = String(codeInput || '').trim().toUpperCase();
    if (!/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/.test(code)) throw new Error('Enter a valid 8-character room code.');
    const roomRef = ref(realtimeDb, `monopolyRooms/${code}`);
    const before = await get(roomRef);
    if (!before.exists()) throw new Error('No Monopoly room was found with that code.');
    const current = before.val();
    const existingSeat = Object.entries(current.players || {}).find(([, p]) => p?.uid === user.uid)?.[0];
    if (current.hostUid === user.uid || existingSeat) {
      this.attach(code, current.hostUid === user.uid);
      return code;
    }
    let selectedSeat = 0;
    let transactionAttempts = 0;
    const result = await runTransaction(roomRef, (currentRoom) => {
      transactionAttempts++;
      // get() does not always prime the SDK's transaction cache; seed only the
      // first null callback from the prefetched room, then trust retries.
      const room = currentRoom || (transactionAttempts === 1 ? current : null);
      if (!room || room.status !== 'waiting' || room.hostUid === user.uid) return;
      const existingSeat = Object.values(room.players || {}).find((p) => p?.uid === user.uid);
      if (existingSeat) return;
      selectedSeat = [2, 3, 4].find((seat) => !room.players?.[`seat${seat}`]) || 0;
      if (!selectedSeat) return;
      room.players ||= {};
      room.players[`seat${selectedSeat}`] = {
        uid: user.uid,
        name: cleanName(name),
        seat: selectedSeat,
        teamId: ['Alpha', 'Beta', 'Gamma', 'Delta'][selectedSeat - 1],
        charId: ['sailor', 'ranger', 'pilot'][selectedSeat - 2],
        ready: true,
        connected: true
      };
      room.updatedAt = Date.now();
      return room;
    }, { applyLocally: false });
    if (!result.committed) throw new Error('That room is full, has already started, or could not be joined.');
    this.attach(code, false);
    return code;
  }

  attach(code, isHost) {
    if (this.stopRoom) this.stopRoom();
    this.code = code;
    this.isHost = isHost;
    const roomRef = ref(realtimeDb, `monopolyRooms/${code}`);
    this.syncPresence(code).catch((error) => this.onError?.(error.message || 'Could not update room presence.'));
    this.stopRoom = onValue(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        this.onError?.('This Monopoly room is no longer available.');
        return;
      }
      this.roomData = snapshot.val();
      this.onRoom?.(this.roomData);
    }, (error) => this.onError?.(error.message || 'Could not listen to the Monopoly room.'));
  }

  async start(state) {
    const user = await this.ensureUser();
    if (!this.code || !this.isHost) throw new Error('Only the room host can start this game.');
    const roomRef = ref(realtimeDb, `monopolyRooms/${this.code}`);
    const result = await runTransaction(roomRef, (room) => {
      if (!room || room.hostUid !== user.uid || room.status !== 'waiting') return;
      const players = [1, 2, 3, 4].map((n) => room.players?.[`seat${n}`]).filter(Boolean);
      if (players.length < 2 || players.length > 4) return;
      room.status = 'playing';
      room.startedAt = Date.now();
      room.updatedAt = Date.now();
      room.state = state;
      return room;
    }, { applyLocally: false });
    if (!result.committed) throw new Error('At least two players are needed, and only the host can start the room.');
  }

  async publishState(state) {
    const user = await this.ensureUser();
    if (!this.code) return false;
    const stateRef = ref(realtimeDb, `monopolyRooms/${this.code}/state`);
    const result = await runTransaction(stateRef, (current) => {
      const activePlayer = Object.values(this.roomData?.players || {}).find((player) => player?.uid === current?.turnUid);
      const maySkipDisconnected = this.isHost && activePlayer?.connected === false;
      if (!current || (current.turnUid !== user.uid && !maySkipDisconnected)) return;
      return { ...state, revision: (Number(current.revision) || 0) + 1, updatedAt: Date.now() };
    }, { applyLocally: false });
    return result.committed ? result.snapshot.val() : false;
  }

  async createTradeRequest(offer) {
    const user = await this.ensureUser();
    if (!this.code) throw new Error('No active Monopoly room.');
    const requestId = `${Date.now()}_${user.uid}`;
    const requestRef = ref(realtimeDb, `monopolyRooms/${this.code}/tradeRequests/${requestId}`);
    const cleanOffer = { ...offer };
    if (!cleanOffer.giveTiles?.length) delete cleanOffer.giveTiles;
    if (!cleanOffer.getTiles?.length) delete cleanOffer.getTiles;
    const result = await runTransaction(requestRef, (current) => {
      if (current) return;
      return { ...cleanOffer, offererUid: user.uid, createdAt: Date.now(), status: 'pending' };
    }, { applyLocally: false });
    if (!result.committed) throw new Error('The trade offer could not be sent.');
    return requestId;
  }

  async respondToTrade(requestId, accepted) {
    const user = await this.ensureUser();
    if (!this.code) throw new Error('No active Monopoly room.');
    await set(ref(realtimeDb, `monopolyRooms/${this.code}/tradeResponses/${requestId}`), {
      responderUid: user.uid,
      accepted: Boolean(accepted),
      respondedAt: Date.now()
    });
  }

  async createAuctionPrompt(prompt) {
    const user = await this.ensureUser();
    if (!this.code) throw new Error('No active Monopoly room.');
    const promptId = `${Date.now()}_${user.uid}`;
    const promptRef = ref(realtimeDb, `monopolyRooms/${this.code}/auctionPrompts/${promptId}`);
    const result = await runTransaction(promptRef, (current) => {
      if (current) return;
      return { ...prompt, hostTurnUid: user.uid, createdAt: Date.now() };
    }, { applyLocally: false });
    if (!result.committed) throw new Error('Could not request the auction bid.');
    return promptId;
  }

  async respondToAuction(promptId, raise) {
    const user = await this.ensureUser();
    if (!this.code) throw new Error('No active Monopoly room.');
    await set(ref(realtimeDb, `monopolyRooms/${this.code}/auctionResponses/${promptId}`), {
      responderUid: user.uid,
      raise: Boolean(raise),
      respondedAt: Date.now()
    });
  }

  async leave() {
    const user = this.user || auth?.currentUser;
    const code = this.code;
    if (this.presenceDisconnect) await this.presenceDisconnect.cancel().catch(() => {});
    if (this.presenceRef) await set(this.presenceRef, false).catch(() => {});
    if (code && user) {
      const roomRef = ref(realtimeDb, `monopolyRooms/${code}`);
      const snapshot = await get(roomRef).catch(() => null);
      const room = snapshot?.val();
      if (room?.status === 'waiting') {
        if (room.hostUid === user.uid) {
          await set(roomRef, null);
        } else {
          const seat = Object.entries(room.players || {}).find(([, player]) => player?.uid === user.uid)?.[0];
          if (seat) await set(ref(realtimeDb, `monopolyRooms/${code}/players/${seat}`), null);
        }
      }
    }
    if (this.stopRoom) this.stopRoom();
    this.stopRoom = null;
    this.code = null;
    this.isHost = false;
    this.roomData = null;
    this.presenceRef = null;
    this.presenceDisconnect = null;
  }

  async syncPresence(code) {
    const user = this.user || await this.ensureUser();
    if (this.presenceDisconnect) await this.presenceDisconnect.cancel().catch(() => {});
    const roomRef = ref(realtimeDb, `monopolyRooms/${code}`);
    const snapshot = await get(roomRef);
    const seat = Object.entries(snapshot.val()?.players || {}).find(([, player]) => player?.uid === user.uid)?.[0];
    if (!seat) return;
    this.presenceRef = ref(realtimeDb, `monopolyRooms/${code}/players/${seat}/connected`);
    this.presenceDisconnect = onDisconnect(this.presenceRef);
    await this.presenceDisconnect.set(false);
    await set(this.presenceRef, true);
  }

  async read(code) {
    const snapshot = await get(ref(realtimeDb, `monopolyRooms/${code}`));
    return snapshot.exists() ? snapshot.val() : null;
  }
}
