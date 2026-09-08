// firebase.js
// Pegá acá la configuración de TU proyecto de Firebase (ver README paso 1).
// No necesitás backend propio: usamos Firestore para sincronizar los datos
// de la pareja en tiempo real, y el token de push de cada celular para
// avisarle al otro cuando la app está cerrada.

import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// experimentalForceLongPolling ayuda a evitar problemas de conexión de
// Firestore dentro de Expo Go en algunas redes.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export function coupleRef(code) {
  return doc(db, "couples", code);
}

export async function getCouple(code) {
  const snap = await getDoc(coupleRef(code));
  return snap.exists() ? snap.data() : null;
}

export async function createCouple(code, initialData) {
  await setDoc(coupleRef(code), initialData);
}

export async function updateCouple(code, partialData) {
  await updateDoc(coupleRef(code), partialData);
}

export function listenCouple(code, callback) {
  return onSnapshot(coupleRef(code), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}
