// Public Firebase web-app settings for Koops Games.
// Get apiKey and appId from Firebase Console > Project settings > Your apps.
// These browser settings identify the project; database security is enforced by Firebase Rules.
export const firebaseConfig = {
  apiKey: 'AIzaSyBJqc2EkcLuXxtLWK55XnN9YxCMhsVq1BE',
  authDomain: 'koops-games.firebaseapp.com',
  databaseURL: 'https://koops-games-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'koops-games',
  appId: '1:259589981365:web:81c9e6a456f904da422afc'
};

const requiredValues = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'];
  
export const firebaseConfigured = requiredValues.every((key) => {
  const value = firebaseConfig[key];
  return typeof value === 'string' && value.length > 0 && !value.startsWith('PASTE_');
});
