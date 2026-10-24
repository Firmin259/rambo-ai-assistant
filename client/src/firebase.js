import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// Replace these values with your actual Firebase project configuration credentials
const firebaseConfig = {
  apiKey: "AIzaSyDBL8xiarcP7lCw5yyFky15vn9dOAD0VVY",
  authDomain: "ai-chat-auth-d62dc.firebaseapp.com",
  projectId: "ai-chat-auth-d62dc",
  storageBucket: "ai-chat-auth-d62dc.firebasestorage.app",
  messagingSenderId: "1032156036720",
  appId: "1:1032156036720:web:438351f02f362c188dfeb5",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
};