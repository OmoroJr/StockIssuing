# Stock Issuing app (Android APK project)

Offline app: issue items by Project Code and date, search 4,000+ items by name or code,
upload stock from Excel/CSV, export the issue report to Excel, daily report at 17:30 through the phone's mail app (or fully automatic via a Gmail script).

## Get the APK - easiest way (no Android Studio)
1. Create a new GitHub repository and upload everything in this folder (keep the `.github` folder).
2. Open the repo > Actions > "Build APK" > Run workflow (it also runs on every push to `main`).
3. When it finishes (about 5 minutes) open the run and download the artifact **StockIssuing-debug-apk**.
4. Unzip, copy `app-debug.apk` to the phone/tablet, open it and allow "install unknown apps".

## Or build on your PC
Needs Node 18+, JDK 17 and Android Studio (SDK).
```
npm install
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug      # APK: android/app/build/outputs/apk/debug/app-debug.apk
```
(or `npx cap open android` and Build > Build APK in Android Studio)

## First run on the device
1. First screen: enter the site name. More sites can be added later in Settings; each site keeps its own stock and issue log.
2. Stock tab: Upload stock (Excel/CSV with Code, Name, Unit, Qty columns).
3. Issue tab: date, Project Code (this is the reference - it remembers codes you used before), search item, qty, Save.
Several sites can share one device (switch in Settings) or each site can have its own device. The Excel report carries Site and Project Code on every line.

## Daily report at 17:30 - two ways (choose in Settings > How to send)
**1. Phone's default mail app (default).** Android does not let an app send mail silently from the phone's own account.
So at 17:30 the app opens your default mail app (Gmail, Samsung Email, ...) with the report already addressed and the Excel attached - you just tap Send.
- A reminder notification fires daily at 17:30 (tap it to open the app and the mail draft appears).
- If the app is open at/after 17:30, or you open it later, the draft opens automatically once per site per day. A yellow banner also offers it.
- If you tap Send while offline, the mail app keeps it in the outbox and delivers it as soon as there is internet.
- "Email report" in the Log tab opens a draft for the dates you selected.

**2. Gmail script (fully automatic, no tap).** The report is emailed from a Gmail account you own by a small Google Apps Script, at 17:30, even if the phone is off.
1. Whenever the phone is online the app syncs each day's Excel report to the script (offline changes sync later, automatically).
2. The script checks the clock every 5 minutes and from 17:30 emails each site's report for that day (only sites that issued something).
3. If a phone only gets internet after 17:30 (or the next day), its report is emailed as soon as it syncs.
Setup (5 minutes) is written at the top of `tools/email-script.gs`: paste it into script.google.com, set SECRET and RECIPIENT,
set the project time zone to Africa/Nairobi, run `installTrigger` once, deploy as a web app, then paste the link and secret into the app's Settings.
Entries added after a day's report has gone out are not re-sent automatically - use "Send today's report now".
Google may delay a time-based run by a minute or two, so "17:30" means 17:30 to about 17:35.

### Sending when internet returns (script mode)
- While the app is open it syncs the moment internet is available (and every 30 seconds).
- The APK also includes a background sync. If a report could not be sent because the phone was offline, Android wakes the app roughly every 15 minutes and sends it once there is internet, even if the app is closed. Android may delay this to save battery - set the app's battery usage to "Unrestricted".

### Build variants
The build workflow tries to include the optional plugins (mail composer, reminder notification, background sync). If a step fails it falls back to a simpler APK and says which one it built in the run summary.

## Notes
- Data lives on the device. Use Settings > Backup data regularly.
- This is a debug-signed APK, fine for installing directly. For Play Store you need a release keystore.
