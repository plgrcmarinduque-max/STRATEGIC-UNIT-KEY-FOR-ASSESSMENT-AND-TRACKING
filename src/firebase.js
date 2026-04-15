// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getDatabase } from "firebase/database"; // if using RTDB
import { getAuth } from "firebase/auth"; // if using auth
const firebaseConfig = {
  apiKey: "AIzaSyCPS1WHGUN2xVzjscOHtCfZ4qQDN5cMGi8",
  authDomain: "one-marinduque-tracking-system.firebaseapp.com",
  databaseURL: "https://one-marinduque-tracking-system-default-rtdb.firebaseio.com",
  projectId: "one-marinduque-tracking-system",
  storageBucket: "one-marinduque-tracking-system.firebasestorage.app",
  messagingSenderId: "445663101902",
  appId: "1:445663101902:web:b091709c5135c3395ae19f",
  measurementId: "G-FBFM6TQFH6"
};

const app = initializeApp(firebaseConfig);

// Optional services
export const db = getDatabase(app);     // Realtime Database
export const auth = getAuth(app);       // Authentication

// Analytics safe load
isSupported().then((yes) => {
  if (yes) getAnalytics(app);
});

export default app;
