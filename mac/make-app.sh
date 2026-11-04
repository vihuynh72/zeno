#!/bin/bash
# Builds "Zeno Clock.app" next to this script: a release build, LSUIElement so it has no Dock icon, ad-hoc signed.
# It is not notarized (no paid Apple account), so a copy from another Mac needs Open Anyway once (see the README).
set -euo pipefail
cd "$(dirname "$0")"

swift build -c release
app="Zeno Clock.app"
rm -rf "$app"
mkdir -p "$app/Contents/MacOS"
cp "$(swift build -c release --show-bin-path)/ZenoClock" "$app/Contents/MacOS/ZenoClock"
cat > "$app/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>ZenoClock</string>
  <key>CFBundleIdentifier</key><string>io.github.vihuynh72.zeno-clock</string>
  <key>CFBundleName</key><string>Zeno Clock</string>
  <key>CFBundleDisplayName</key><string>Zeno Clock</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST
plutil -lint "$app/Contents/Info.plist"
codesign --force --sign - "$app"
codesign --verify --strict "$app"
echo "Built $PWD/$app"
