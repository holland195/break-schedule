# After minification, inject env vars into firebase-auth.js
sed -i "s|AIzaSyDpkSsDS2HMvDl8EXoD5J23VXLyligTkFk|${FIREBASE_API_KEY}|g" dist/firebase-auth.js
sed -i "s|1:1080497083744:web:72915f7d298d039bfe3a05|${FIREBASE_APP_ID}|g" dist/firebase-auth.js
