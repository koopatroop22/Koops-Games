import {
  createLocalProfile, deleteLocalProfile, getActiveProfile, getLocalProfile,
  setActiveProfile, signOutLocalProfile, updateLocalProfile
} from './local-profile-store.js';

const $ = (id) => document.getElementById(id);
const gameNames = {
  monopoly: 'BCP Monopoly 3D',
  snooker: '3D Snooker',
  'tower-defence': 'Tower Defence 3D',
  battleships: 'Battleships',
  chess: '3D Chess',
  connect4: 'Connect 4',
  minesweeper: 'Minesweeper'
};
let toastTimer;

function toast(message, error = false) {
  const node = $('account-toast');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.add('hidden'), 4200);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function avatar(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

function showSignedOut() {
  $('auth-panel').classList.remove('hidden');
  $('account-app').classList.add('hidden');
}

function formatDuration(seconds = 0) {
  const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? '' : 's'} ${minutes % 60} min`;
}

function renderActivity(profile) {
  const events = Array.isArray(profile.activity) ? profile.activity : [];
  const seconds = events.reduce((sum, event) => sum + Math.max(0, Number(event.durationSeconds) || 0), 0);
  $('my-stats').innerHTML = `
    <div class="stat-tile"><strong>${events.length}</strong><span>Saved sessions</span></div>
    <div class="stat-tile"><strong>${escapeHtml(formatDuration(seconds))}</strong><span>Play time</span></div>`;

  const counts = {};
  for (const event of events) counts[event.gameId] = (counts[event.gameId] || 0) + 1;
  const [mostPlayed, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
  $('my-most-played').innerHTML = mostPlayed
    ? `<span>Most played</span><strong>${escapeHtml(gameNames[mostPlayed] || mostPlayed)}</strong><small>${count} sessions</small>`
    : '';

  const rows = events.slice(0, 8).map((event) => {
    const date = new Date(event.startedAt);
    const dateLabel = Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
    return `<div class="activity-row">
      <span>${escapeHtml(gameNames[event.gameId] || 'Game')} · ${escapeHtml(event.outcome || 'played')}</span>
      <span>${escapeHtml(formatDuration(event.durationSeconds))}${dateLabel ? ` · ${escapeHtml(dateLabel)}` : ''}</span>
    </div>`;
  }).join('');
  $('my-activity').innerHTML = rows || '<p class="empty-copy">Play a game while signed in to save local activity.</p>';
}

function showProfile(profile) {
  $('auth-panel').classList.add('hidden');
  $('account-app').classList.remove('hidden');
  $('account-greeting').textContent = profile.displayName;
  $('account-handle').textContent = `@${profile.username}`;
  $('my-avatar').textContent = avatar(profile.displayName);
  $('settings-display-name').value = profile.displayName;
  renderActivity(profile);
}

function refreshView() {
  try {
    const profile = getActiveProfile();
    if (profile) showProfile(profile);
    else showSignedOut();
  } catch (error) {
    showSignedOut();
    toast(error.message || 'Could not read local profile data.', true);
  }
}

function createProfile(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const username = String(form.get('username') || '').trim().toLowerCase();
  const displayName = String(form.get('displayName') || '').trim();
  if (!/^[a-z0-9_]{3,18}$/.test(username)) {
    return toast('Username must be 3–18 letters, numbers or underscores.', true);
  }
  if (displayName.length < 2 || displayName.length > 24) {
    return toast('Display name must be 2–24 characters.', true);
  }

  try {
    const profile = createLocalProfile({
      username,
      displayName,
      createdAt: new Date().toISOString(),
      activity: []
    });
    event.currentTarget.reset();
    showProfile(profile);
    toast('Local profile created in this browser.');
  } catch (error) {
    toast(error.message || 'Could not create the local profile.', true);
  }
}

function signIn(event) {
  event.preventDefault();
  const username = String(new FormData(event.currentTarget).get('username') || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,18}$/.test(username)) {
    return toast('Enter a username with 3–18 letters, numbers or underscores.', true);
  }

  try {
    const profile = getLocalProfile(username);
    if (!profile) return toast('No local profile has that username in this browser.', true);
    setActiveProfile(username);
    event.currentTarget.reset();
    showProfile(profile);
  } catch (error) {
    toast(error.message || 'Could not open the local profile.', true);
  }
}

function saveProfile() {
  const displayName = $('settings-display-name').value.trim();
  if (displayName.length < 2 || displayName.length > 24) {
    return toast('Display name must be 2–24 characters.', true);
  }

  try {
    const active = getActiveProfile();
    if (!active) return refreshView();
    const updated = updateLocalProfile(active.username, (profile) => ({ ...profile, displayName }));
    showProfile(updated);
    toast('Local profile saved.');
  } catch (error) {
    toast(error.message || 'Could not save the local profile.', true);
  }
}

function removeProfile() {
  const active = getActiveProfile();
  if (!active) return refreshView();
  if (!confirm(`Delete the local profile @${active.username} and its saved activity from this browser?`)) return;

  try {
    deleteLocalProfile(active.username);
    showSignedOut();
    toast('Local profile deleted from this browser.');
  } catch (error) {
    toast(error.message || 'Could not delete the local profile.', true);
  }
}

$('create-profile-form').addEventListener('submit', createProfile);
$('sign-in-form').addEventListener('submit', signIn);
$('save-settings-button').addEventListener('click', saveProfile);
$('sign-out-button').addEventListener('click', () => {
  signOutLocalProfile();
  showSignedOut();
});
$('delete-profile-button').addEventListener('click', removeProfile);
window.addEventListener('storage', refreshView);
refreshView();
