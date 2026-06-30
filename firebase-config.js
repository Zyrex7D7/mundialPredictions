// Cola aqui o objeto firebaseConfig que o Firebase te deu ao registar a app web.
// Vê o README.md, secção "2. Criar o backend gratuito (Firebase)" para o passo a passo.

const firebaseConfig = {
  apiKey: "AIzaSyBjs46R8VwmCKytgSQHbm8_BAyaCkg1__A",
  authDomain: "previsoes-mundial.firebaseapp.com",
  projectId: "previsoes-mundial",
  storageBucket: "previsoes-mundial.firebasestorage.app",
  messagingSenderId: "322529911271",
  appId: "1:322529911271:web:1caa2137a35133be99dd42"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();