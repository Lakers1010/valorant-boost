import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC6sXVbXptqmcT49Qp_-n1ub49WErw1xic",
  authDomain: "valorant-boost-c70fa.firebaseapp.com",
  projectId: "valorant-boost-c70fa",
  storageBucket: "valorant-boost-c70fa.firebasestorage.app",
  messagingSenderId: "922997246530",
  appId: "1:922997246530:web:6defaa6f823c8208383bdb"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); 
