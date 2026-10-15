#!/usr/bin/env bash
# Builds the debug APK.
#   full  = background sync + mail-app composer + 17:30 reminder notification
#   nobg  = mail-app composer + reminder notification (no background sync)
#   plain = none of the optional plugins (share sheet only)
set -euo pipefail
MODE="${1:-full}"
cp capacitor.config.json /tmp/cap.base.json
trap 'cp /tmp/cap.base.json capacitor.config.json' EXIT
rm -rf android
PKGS=""
case "$MODE" in
  full) PKGS="@capacitor/background-runner@2.0.0 capacitor-email-composer@6.0.0 @capacitor/local-notifications@6.1.3" ;;
  nobg) PKGS="capacitor-email-composer@6.0.0 @capacitor/local-notifications@6.1.3" ;;
esac
if [ -n "$PKGS" ]; then npm install --no-save $PKGS; fi
if [ "$MODE" = "full" ]; then
  node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('capacitor.config.json','utf8'));c.plugins=Object.assign({},c.plugins,{BackgroundRunner:{label:'com.stockissuing.app.check',src:'runners/runner.js',event:'syncReports',repeat:true,interval:15,autoStart:true}});fs.writeFileSync('capacitor.config.json',JSON.stringify(c,null,2))"
fi
npx cap add android
npx cap sync android
if [ "$MODE" = "full" ]; then
  sed -i "s#dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs'#dirs '../capacitor-cordova-android-plugins/src/main/libs', 'libs', '../../node_modules/@capacitor/background-runner/android/src/main/libs'#" android/app/build.gradle
  grep -q "background-runner" android/app/build.gradle
fi
chmod +x android/gradlew
(cd android && ./gradlew assembleDebug --no-daemon)
echo "$MODE" > /tmp/apk-mode.txt
