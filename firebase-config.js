// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCUFbFNnPrBaErykCAfAiSPhJjnAmPC4Wc",
  authDomain: "push-live-results.firebaseapp.com",
  projectId: "push-live-results",
  storageBucket: "push-live-results.firebasestorage.app",
  messagingSenderId: "501339621950",
  appId: "1:501339621950:web:ddc76480b3f3da94b15f6f",
  measurementId: "G-XKB7EHJ99H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);