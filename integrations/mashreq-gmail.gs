/**
 * Mashreq card alerts (Gmail) -> finance tracker.
 *
 * Setup (script.google.com, signed in to the Gmail that receives the alerts):
 *   1. Paste this file into a new Apps Script project.
 *   2. Project Settings -> Script Properties:
 *        INGEST_URL   = https://mikaeelfaraz.com/api/finance/ingest
 *        INGEST_TOKEN = <your FINANCE_INGEST_TOKEN>
 *   3. Run setup() once (grants Gmail read access, installs a 5-minute trigger).
 *   4. Run backfill() once to import older alerts.
 *
 * Only sends messages newer than the last one it sent, so quiet runs make no
 * web requests. The server also ignores re-sent Gmail message ids.
 * No secrets live in this file — keep the token in Script Properties.
 */
var SENDER = 'MashreqAlerts@mashreq.com';
var BATCH = 25;

function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(5).create();
  sync();
}

/** Every 5 minutes: forward alerts that arrived since the last run. */
function sync() {
  var props = PropertiesService.getScriptProperties();
  var lastTs = Number(props.getProperty('LAST_TS') || 0);
  var threads = GmailApp.search('from:' + SENDER + ' newer_than:3d', 0, 50);
  var fresh = [];
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (m) {
      if (m.getDate().getTime() > lastTs && isAlert_(m)) fresh.push(m);
    });
  });
  if (!fresh.length) return;
  send_(fresh);
  var maxTs = fresh.reduce(function (acc, m) { return Math.max(acc, m.getDate().getTime()); }, lastTs);
  props.setProperty('LAST_TS', String(maxTs));
}

/** One-off: import older alerts (default ~13 months). Safe to re-run. */
function backfill() {
  var messages = [];
  for (var start = 0; ; start += 100) {
    var threads = GmailApp.search('from:' + SENDER + ' newer_than:400d', start, 100);
    threads.forEach(function (thread) {
      thread.getMessages().forEach(function (m) { if (isAlert_(m)) messages.push(m); });
    });
    if (threads.length < 100) break;
  }
  Logger.log('Backfilling ' + messages.length + ' alerts');
  send_(messages);
  var props = PropertiesService.getScriptProperties();
  var maxTs = messages.reduce(function (acc, m) { return Math.max(acc, m.getDate().getTime()); }, Number(props.getProperty('LAST_TS') || 0));
  props.setProperty('LAST_TS', String(maxTs));
}

function isAlert_(m) {
  return /mashreq/i.test(m.getFrom()) && /was used for a purchase/i.test(m.getPlainBody());
}

function send_(messages) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('INGEST_URL');
  var token = props.getProperty('INGEST_TOKEN');
  if (!url || !token) throw new Error('Set INGEST_URL and INGEST_TOKEN in Project Settings -> Script Properties');
  for (var i = 0; i < messages.length; i += BATCH) {
    var events = messages.slice(i, i + BATCH).map(function (m) {
      return {
        source: 'email',
        external_id: m.getId(),
        received_at: m.getDate().toISOString(),
        text: m.getPlainBody()
      };
    });
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ events: events }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code >= 300) throw new Error('Ingest failed (' + code + '): ' + res.getContentText().slice(0, 300));
    Logger.log(res.getContentText().slice(0, 300));
  }
}
