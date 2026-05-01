importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyCIeu8ZE1ztzYMywKFT2D6Wg0cLp3lmKnQ',
  authDomain: 'qwiz-67f42.firebaseapp.com',
  projectId: 'qwiz-67f42',
  storageBucket: 'qwiz-67f42.firebasestorage.app',
  messagingSenderId: '474549353682',
  appId: '1:474549353682:web:deff65caf0cc6277dd810b',
})

firebase.messaging().onBackgroundMessage(({ notification }) => {
  self.registration.showNotification(notification.title, {
    body: notification.body,
    icon: '/logo1.png',
  })
})
