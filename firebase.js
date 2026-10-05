import { initializeApp }  from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-firestore.js';
import { getStorage }     from 'https://www.gstatic.com/firebasejs/11.8.1/firebase-storage.js';

const firebaseConfig = {
  apiKey:            'AIzaSyDCtMunMRiOWKSGh939BEU2TvhEgv_wB60',
  authDomain:        'pulsar-galelium.firebaseapp.com',
  projectId:         'pulsar-galelium',
  storageBucket:     'pulsar-galelium.firebasestorage.app',
  messagingSenderId: '407132877855',
  appId:             '1:407132877855:web:fd29af874d74dcda90912a',
};

const app = initializeApp(firebaseConfig);

export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);
