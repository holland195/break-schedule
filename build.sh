#!/bin/bash
mkdir -p dist
files=(
  "data" "sync" "auth" "pages" "autoassign"
  "attendance" "nav" "policy-compliance"
  "policy-feedback" "training.views" "report"
  "firebase-auth"
)
for f in "${files[@]}"; do
  terser "${f}.js" -o "dist/${f}.js" \
    --compress drop_console=true \
    --mangle \
    --mangle-props keep_quoted=strict
  echo "✓ ${f}.js"
done
cp index.html dist/index.html
cp styles.css dist/styles.css 2>/dev/null || true
cp sync-config.json dist/sync-config.json 2>/dev/null || true
echo "Build complete."
