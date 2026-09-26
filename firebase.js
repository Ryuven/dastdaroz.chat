// ============================================================
//  firebase.js — Firebase конфигурация и инициализация (Pulsar)
//
//  auth + users  → delivery-galelium  (единый аккаунт)
//  db + storage  → pulsar-galelium    (чаты, каналы, presence)
//
//  Импорт:
//    import { auth, db, storage, deliveryDb } from './firebase.js';
// ============================================================

import { initializeApp }  from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';
import { getStorage }     from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js';

// ─── Delivery: auth + коллекция users ─────────────────────────
const deliveryConfig = {
  apiKey:            'AIzaSyCjIAMFuwLKwmjChCuiz-MHLv5WZOczAAE',
  authDomain:        'delivery-galelium.firebaseapp.com',
  projectId:         'delivery-galelium',
  storageBucket:     'delivery-galelium.firebasestorage.app',
  messagingSenderId: '982466555080',
  appId:             '1:982466555080:web:c77ccabff0e71e540ddc9fd',
};

// ─── Pulsar: чаты, каналы, presence, storage ──────────────────
const pulsarConfig = {
  apiKey:            'AIzaSyDCtMunMRiOWKSGh939BEU2TvhEgv_wB60',
  authDomain:        'pulsar-galelium.firebaseapp.com',
  projectId:         'pulsar-galelium',
  storageBucket:     'pulsar-galelium.firebasestorage.app',
  messagingSenderId: '407132877855',
  appId:             '1:407132877855:web:fd29af874d74dcda90912a',
};

// ─── Инициализация ────────────────────────────────────────────
const deliveryApp = initializeApp(deliveryConfig, 'delivery');
const pulsarApp   = initializeApp(pulsarConfig,   'pulsar');

// delivery → auth + users
export const auth       = getAuth(deliveryApp);
export const deliveryDb = getFirestore(deliveryApp);

// pulsar → чаты, presence, typing, файлы
export const db      = getFirestore(pulsarApp);
export const storage = getStorage(pulsarApp);
