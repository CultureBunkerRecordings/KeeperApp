// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
// Replace this with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCl1mhz21ujWZsWN-sZgKJA0541LuySs34",
  authDomain: "keeper-app-2b447.firebaseapp.com",
  projectId: "keeper-app-2b447",
  storageBucket: "keeper-app-2b447.firebasestorage.app",
  messagingSenderId: "768798177019",
  appId: "1:768798177019:web:895c14b0d972524ba5e25e",
  measurementId: "G-QHQ7XC8FMX"
};

export const app = initializeApp(firebaseConfig);
export const functions = getFunctions(app)
// Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// If running locally, connect to emulator:
if (window.location.hostname === "localhost") {
  connectFunctionsEmulator(functions, "localhost", 5001);
}
