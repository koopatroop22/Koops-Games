const PROFILES_KEY = 'koops.local-profiles.v1';
export const ACTIVE_PROFILE_KEY = 'koops.active-profile.v1';

function readProfiles() {
  const raw = localStorage.getItem(PROFILES_KEY);
  if (!raw) return {};

  const profiles = JSON.parse(raw);
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    throw new Error('Local profile data is invalid. Clear this site’s browser data to reset it.');
  }
  for (const profile of Object.values(profiles)) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      throw new Error('Local profile data is invalid. Clear this site’s browser data to reset it.');
    }
  }
  return profiles;
}

function writeProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

export function getLocalProfile(username) {
  if (!username) return null;
  return readProfiles()[username] || null;
}

export function getActiveProfile() {
  return getLocalProfile(localStorage.getItem(ACTIVE_PROFILE_KEY));
}

export function createLocalProfile(profile) {
  const profiles = readProfiles();
  if (profiles[profile.username]) throw new Error('That username already has a profile in this browser.');

  profiles[profile.username] = profile;
  writeProfiles(profiles);
  localStorage.setItem(ACTIVE_PROFILE_KEY, profile.username);
  return profile;
}

export function setActiveProfile(username) {
  if (!getLocalProfile(username)) throw new Error('No local profile exists with that username.');
  localStorage.setItem(ACTIVE_PROFILE_KEY, username);
}

export function updateLocalProfile(username, update) {
  const profiles = readProfiles();
  const current = profiles[username];
  if (!current) throw new Error('This local profile is no longer available.');

  const updated = update(current);
  profiles[username] = updated;
  writeProfiles(profiles);
  return updated;
}

export function deleteLocalProfile(username) {
  const profiles = readProfiles();
  delete profiles[username];
  writeProfiles(profiles);
  if (localStorage.getItem(ACTIVE_PROFILE_KEY) === username) {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
  }
}

export function signOutLocalProfile() {
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
}
