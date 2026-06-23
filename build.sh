#!/bin/bash
mkdir -p dist
files=(
  "data" "sync" "auth" "pages" "autoassign"
  "attendance" "nav" "policy-compliance"
  "policy-feedback" "training.views" "report"
  "firebase-auth"
)
for f in "${files[@]}"; do
  npx terser "${f}.js" -o "dist/${f}.js" \
    --compress drop_console=true \
    --mangle
  echo "✓ ${f}.js"
done

# firebase-config.js is NOT minified — config object must stay intact
cp firebase-config.js dist/firebase-config.js
echo "✓ firebase-config.js (copied as-is)"

cp index.html dist/index.html
cp styles.css dist/styles.css 2>/dev/null || true
cp pave-login.css dist/pave-login.css 2>/dev/null || true
cp sync-config.json dist/sync-config.json 2>/dev/null || true
cp -r assets dist/assets 2>/dev/null || true
echo "Build complete."

