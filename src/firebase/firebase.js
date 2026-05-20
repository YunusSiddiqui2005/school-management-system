import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCLhcVHFHe40-dJrO8IqN88pcacUOte3nI",
  authDomain: "school-management-system-529d1.firebaseapp.com",
  projectId: "school-management-system-529d1",
  storageBucket: "school-management-system-529d1.firebasestorage.app",
  messagingSenderId: "681354193286",
  appId: "1:681354193286:web:58db292ca4d24d643f6407"
};

// Main App (For regular Login/Logout)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Secondary App (Admin bina logout hue naye users bana sakega, ye missing tha!)
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
export const secondaryAuth = getAuth(secondaryApp);