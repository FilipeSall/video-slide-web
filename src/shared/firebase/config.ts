import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

type FirebaseServices = {
  app: FirebaseApp
  db: Firestore
  storage: FirebaseStorage
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const hasFirebaseConfig = Object.values(firebaseConfig).every(Boolean)

let services: FirebaseServices | null = null

export function getFirebaseServices() {
  if (!hasFirebaseConfig) {
    return null
  }

  if (!services) {
    const app = initializeApp(firebaseConfig)

    services = {
      app,
      db: getFirestore(app),
      storage: getStorage(app),
    }
  }

  return services
}
