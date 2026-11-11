
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDVXq-I7dRzUv59EaaI5mUEo2o5iQTgRfA",
  authDomain: "pipesmercado.firebaseapp.com",
  projectId: "pipesmercado",
  storageBucket: "pipesmercado.firebasestorage.app",
  messagingSenderId: "502811107186",
  appId: "1:502811107186:web:24ba990d38855c3ecf87eb",
  measurementId: "G-R2F8PKEH1X",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) getAnalytics(app);
    })
    .catch((error) => {
      console.warn("Analytics no está disponible:", error);
    });
}
