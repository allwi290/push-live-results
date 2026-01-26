// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyC2FhgO6QWnPVvxGqFaY8SYvFz-e_sILrg",
  authDomain: "push-live-results.firebaseapp.com",
  projectId: "push-live-results",
  storageBucket: "push-live-results.firebasestorage.app",
  messagingSenderId: "1062648653989",
  appId: "1:1062648653989:web:61d3fb92b43bb5f7d86fc1",
  measurementId: "G-SGZC4VFQZV"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'Live Results Update';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update',
    icon: '/favicon.ico',
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
