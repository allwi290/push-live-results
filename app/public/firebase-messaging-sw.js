// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
// Service workers run in a separate context and need their own initialization
// Note: These credentials are public and meant for browser use - security comes from Firestore rules
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
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Live Results Update';
  const notificationData = payload.data || {};

  const targetUrl = new URL('/', self.location.origin);
  if (notificationData.competitionId) {
    targetUrl.searchParams.set('competitionId', notificationData.competitionId);
  }
  if (notificationData.className) {
    targetUrl.searchParams.set('className', notificationData.className);
  }
  if (notificationData.runnerName) {
    targetUrl.searchParams.set('runnerName', notificationData.runnerName);
  }

  const notificationOptions = {
    body: payload.notification?.body || 'You have a new update',
    icon: '/favicon.ico',
    data: {
      ...notificationData,
      url: targetUrl.toString(),
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of windowClients) {
      if ('focus' in client) {
        await client.focus();
      }
      if ('navigate' in client) {
        await client.navigate(targetUrl);
      }
      return;
    }

    if (clients.openWindow) {
      await clients.openWindow(targetUrl);
    }
  })());
});
