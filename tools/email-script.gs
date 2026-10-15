/**
 * Stock Issuing - Gmail report script (Google Apps Script)
 *
 * What it does
 *  - The app syncs each day's Excel report to this script whenever the phone is online.
 *  - Every 5 minutes the script checks the clock; from 17:30 it emails each site's report
 *    for that day through YOUR Gmail, even if the phone is switched off.
 *  - If a phone only gets internet later (after 17:30, or the next day), the report is
 *    emailed as soon as it syncs.
 *
 * SETUP (about 5 minutes)
 *  1. script.google.com > New project > paste this whole file.
 *  2. Change SECRET (any word) and RECIPIENT (the email that should receive the reports).
 *  3. Project Settings (gear icon) > Time zone > (GMT+03:00) Africa/Nairobi.   <-- important
 *  4. Choose function  installTrigger  in the toolbar > Run. Approve the permissions
 *     (Gmail send, Drive, external requests). It sets up the 5-minute clock check.
 *  5. Deploy > New deployment > type: Web app > Execute as: Me > Who has access: Anyone > Deploy.
 *     Copy the Web app URL.
 *  6. In the app: Settings > paste the URL into "Gmail link", type the same SECRET > Save > Sync now.
 *  If you edit this script later: Deploy > Manage deployments > edit > New version > Deploy.
 */
var SECRET = 'change-me';
var RECIPIENT = 'your.name@gmail.com';
var SEND_HOUR = 17;
var SEND_MIN = 30;
var XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return out_({ ok: false, error: 'wrong secret word' });
    var key = 'r|' + d.site + '|' + d.date;
    if (d.action === 'report') { save_(key, d); checkAndSend_(); return out_({ ok: true }); }
    if (d.action === 'clear') { remove_(key); return out_({ ok: true }); }
    if (d.action === 'sendnow') { return out_({ ok: true, sent: send_(key, true) }); }
    return out_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
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
  var blob = Utilities.newBlob(Utilities.base64Decode(d.base64), XLSX_MIME, d.filename);
  var file = folder_().createFile(blob);
  props.setProperty(key, JSON.stringify({
    site: d.site, date: d.date, lines: d.lines, filename: d.filename,
    fileId: file.getId(), sent: rec.sent || 0
  }));
}

function remove_(key) {
  var props = PropertiesService.getScriptProperties();
  var old = props.getProperty(key);
  if (old) {
    var rec = JSON.parse(old);
    if (rec.fileId) { try { DriveApp.getFileById(rec.fileId).setTrashed(true); } catch (x) {} }
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
  GmailApp.sendEmail(
    RECIPIENT,
    rec.site + ' - stock issue report ' + rec.date,
    'Stock issue report for ' + rec.site + ' on ' + rec.date + ' (' + rec.lines + ' lines) is attached.',
    { attachments: [file.getBlob().setName(rec.filename)] }
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
