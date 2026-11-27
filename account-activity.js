import { getActiveProfile, updateLocalProfile } from './local-profile-store.js';

const gameId = document.body.dataset.gameId;
const allowed = new Set(['monopoly', 'snooker', 'tower-defence', 'battleships', 'chess', 'connect4', 'minesweeper', 'poker']);
let profile = null;
try {
  profile = getActiveProfile();
} catch (error) {
  console.info('Local game activity is unavailable.', error?.message || 'storage unavailable');
}

if (profile && gameId && allowed.has(gameId)) {
  const username = profile.username;
  const startedAt = Date.now();
  const event = {
    id: `${startedAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    gameId,
    outcome: 'playing',
    durationSeconds: 0,
    startedAt: new Date(startedAt).toISOString()
  };
  let saving = Promise.resolve();

  const flush = (finish = false) => {
    event.durationSeconds = Math.min(86400, Math.floor((Date.now() - startedAt) / 1000));
    if (finish && !['win', 'loss', 'draw', 'completed'].includes(event.outcome)) event.outcome = 'completed';

    saving = saving.then(() => updateLocalProfile(username, (current) => {
      const activity = Array.isArray(current.activity) ? current.activity : [];
      const updatedEvent = { ...event };
      return {
        ...current,
        activity: [updatedEvent, ...activity.filter((item) => item.id !== event.id)].slice(0, 250)
      };
    })).catch((error) => {
      console.info('Local game activity was not saved.', error?.message || 'storage unavailable');
    });
    return saving;
  };

  window.KoopsGameActivity = {
    finish(result = 'completed') {
      if (['win', 'loss', 'draw', 'completed'].includes(result)) event.outcome = result;
      return flush(true);
    }
  };

  const interval = setInterval(() => flush(), 30000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', () => {
    clearInterval(interval);
    flush();
  });
}
