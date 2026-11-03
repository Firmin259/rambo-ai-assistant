import { initializeApp, getApps, getApp } from "firebase/app";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

import {
  getFirestore
} from "firebase/firestore";

import {
  getStorage
} from "firebase/storage";

// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

const firebaseConfig = {

  apiKey: "AIzaSyDBL8xiarcP7lCw5yyFky15vn9dOAD0VVY",

  authDomain: "ai-chat-auth-d62dc.firebaseapp.com",

  projectId: "ai-chat-auth-d62dc",

  storageBucket: "ai-chat-auth-d62dc.firebasestorage.app",

  messagingSenderId: "1032156036720",

  appId: "1:1032156036720:web:438351f02f362c188dfeb5"

};

// ==========================================
// INITIALIZE FIREBASE
// ==========================================

// Prevent duplicate initialization
const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

// ==========================================
// FIREBASE SERVICES
// ==========================================

export const auth = getAuth(app);

export const db = getFirestore(app);

export const storage = getStorage(app);

// ==========================================
// GOOGLE AUTHENTICATION
// ==========================================

export const googleProvider = new GoogleAuthProvider();

// Request Google account selection
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// ==========================================
// AUTHENTICATION EXPORTS
// ==========================================

export {
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};

// ==========================================
// FIREBASE APP EXPORT
// ==========================================

export default app;
