import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCb56zYXGU19GPfVr8_CkQ0phEH8LRRZnk",
    authDomain: "ai-chat-54a24.firebaseapp.com",
    projectId: "ai-chat-54a24",
    storageBucket: "ai-chat-54a24.appspot.com",
    messagingSenderId: "863326975829",
    appId: "1:863326975829:web:6f1685583048acdc51a1dc",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export const functionUrl = "https://chatai-jxed6hfkma-uc.a.run.app";

export { db };
