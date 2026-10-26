/**
 * Stock Issuing - Gmail report script (Google Apps Script)
 *
 * What it does
 *  - The app syncs each day's Excel report to this script whenever the phone is online.
 *  - Every 5 minutes the script checks the clock; from 17:00 it emails each site's report
 *    for that day through YOUR Gmail, even if the phone is switched off.
 *  - If a phone only gets internet later (after 17:00, or the next day), the report is
 *    emailed as soon as it syncs.
 *
 * The report is SENT FROM the Google account that owns this script, so do the setup while signed in as
 * weldcontabs@gmail.com. It is sent TO RECIPIENT below (already weldcontabs@gmail.com - add more addresses
 * separated by commas if others should get it too).
 *
 * SETUP (about 5 minutes)
 *  1. Sign in to Google as weldcontabs@gmail.com. Go to script.google.com > New project > paste this whole file.
 *  2. SECRET, SENDER and RECIPIENT are already filled in - change them only if you want to.
 *  3. Project Settings (gear icon) > Time zone > (GMT+03:00) Africa/Nairobi.   <-- important
 *  4. Choose function  installTrigger  in the toolbar > Run. Approve the permissions
 *     (Gmail send, Drive, external requests). It sets up the 5-minute clock check.
 *     Then run  testEmail  once - a test message should arrive in the inbox of RECIPIENT.
 *  5. Deploy > New deployment > type: Web app > Execute as: Me > Who has access: Anyone > Deploy.
 *     Copy the Web app URL.
 *  6. In the app: Settings > paste the URL into "Gmail link", type the same SECRET > Save > Sync now.
 *  If you edit this script later: Deploy > Manage deployments > edit > New version > Deploy.
 */
var SECRET = 'wc-ITjvb3xgZBea';
var SENDER = 'weldcontabs@gmail.com';      // the account that must own/run this script
var RECIPIENT = 'weldcontabs@gmail.com';   // who receives the reports (comma separated for several)
var SEND_HOUR = 17;
var SEND_MIN = 0;
var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return out_({ ok: false, error: 'wrong secret word' });
    checkSender_();
    var key = 'r|' + d.site + '|' + d.date;
    if (d.action === 'report') { save_(key, d); checkAndSend_(); return out_({ ok: true }); }
    if (d.action === 'clear') { remove_(key); return out_({ ok: true }); }
    if (d.action === 'sendnow') { return out_({ ok: true, sent: send_(key, true) }); }
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

// Stops the script quietly sending from the wrong Google account.
function checkSender_() {
  var me = '';
  try { me = Session.getEffectiveUser().getEmail(); } catch (x) {}
  if (me && me.toLowerCase() !== SENDER.toLowerCase()) {
    throw new Error('This script is running as ' + me + '. Deploy it while signed in as ' + SENDER + '.');
  }
}

// Run once from the editor to check that sending works.
function testEmail() {
  checkSender_();
  GmailApp.sendEmail(RECIPIENT, 'Stock Issuing - test email', 'If you can read this, the daily report emails will work.');
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function folder_() {
  var it = DriveApp.getFoldersByName('StockIssuingReports');
  return it.hasNext() ? it.next() : DriveApp.createFolder('StockIssuingReports');
}

// Keep only the latest version of each site/day report.
function save_(key, d) {
  var props = PropertiesService.getScriptProperties();
  var old = props.getProperty(key);
  var rec = old ? JSON.parse(old) : {};
  if (rec.fileId) { try { DriveApp.getFileById(rec.fileId).setTrashed(true); } catch (x) {} }
  if (rec.csvId) { try { DriveApp.getFileById(rec.csvId).setTrashed(true); } catch (x) {} }
  var blob = Utilities.newBlob(Utilities.base64Decode(d.base64), XLSX_MIME, d.filename);
  var file = folder_().createFile(blob);
  var csvId = '';
  if (d.csv) {   // a plain CSV copy travels with the Excel so the data is never lost
    csvId = folder_().createFile(Utilities.newBlob(d.csv, 'text/csv', d.filename.replace(/\.xlsx$/, '.csv'))).getId();
  }
  props.setProperty(key, JSON.stringify({
    site: d.site, date: d.date, lines: d.lines, filename: d.filename,
    fileId: file.getId(), csvId: csvId, size: file.getSize(),
    summary: String(d.summary || '').substring(0, 3000), sent: rec.sent || 0
  }));
}

function remove_(key) {
  var props = PropertiesService.getScriptProperties();
  var old = props.getProperty(key);
  if (old) {
    var rec = JSON.parse(old);
    if (rec.fileId) { try { DriveApp.getFileById(rec.fileId).setTrashed(true); } catch (x) {} }
    if (rec.csvId) { try { DriveApp.getFileById(rec.csvId).setTrashed(true); } catch (x) {} }
    props.deleteProperty(key);
  }
}

function send_(key, force) {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(key);
  if (!raw) return false;
  var rec = JSON.parse(raw);
  if (rec.sent && !force) return false;
  var file = DriveApp.getFileById(rec.fileId);
  var atts = [file.getBlob().setName(rec.filename)];
  if (rec.csvId) { try { var cf = DriveApp.getFileById(rec.csvId); atts.push(cf.getBlob().setName(rec.filename.replace(/\.xlsx$/, '.csv'))); } catch (x) {} }
  GmailApp.sendEmail(
    RECIPIENT,
    rec.site + ' - stock issue report ' + rec.date,
    'Stock issue report for ' + rec.site + ' on ' + rec.date + ' (' + rec.lines + ' lines). Excel and CSV copies are attached.\n\n' + (rec.summary || ''),
    { attachments: atts }
  );
  rec.sent = Date.now();
  props.setProperty(key, JSON.stringify(rec));
  return true;
}

function checkAndSend_() {
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var today = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var nowMin = parseInt(Utilities.formatDate(now, tz, 'H'), 10) * 60 + parseInt(Utilities.formatDate(now, tz, 'm'), 10);
  var dueMin = SEND_HOUR * 60 + SEND_MIN;
  var cutoff = Utilities.formatDate(new Date(now.getTime() - 60 * 86400000), tz, 'yyyy-MM-dd');
  var props = PropertiesService.getScriptProperties();
  var all = props.getProperties();
  Object.keys(all).forEach(function (key) {
    if (key.indexOf('r|') !== 0) return;
    var rec = JSON.parse(all[key]);
    if (rec.date < cutoff) { remove_(key); return; }          // tidy up old reports
    if (rec.sent) return;
    if (rec.date < today || (rec.date === today && nowMin >= dueMin)) send_(key, false);
  });
}

// Runs every 5 minutes (set up by installTrigger).
function checkAndSend() { checkAndSend_(); }

// Run this ONCE from the editor.
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkAndSend') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkAndSend').timeBased().everyMinutes(5).create();
}
