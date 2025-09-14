import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCl1mhz21ujWZsWN-sZgKJA0541LuySs34",
  authDomain: "keeper-app-2b447.firebaseapp.com",
  projectId: "keeper-app-2b447",
  storageBucket: "keeper-app-2b447.firebasestorage.app",
  messagingSenderId: "768798177019",
  appId: "1:768798177019:web:895c14b0d972524ba5e25e",
  measurementId: "G-QHQ7XC8FMX"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize App Check (optional for now)
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("6LegwMgrAAAAAEvFvQww_etqbxeNL1qTH0BNW62D"), // your site key
  isTokenAutoRefreshEnabled: true,
});

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// No need to initialize functions or emulator connection anymore
