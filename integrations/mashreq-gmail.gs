/**
 * Mashreq card alerts (Gmail) -> finance tracker.
 *
 * Setup (script.google.com, signed in to the Gmail that receives the alerts):
 *   1. Paste this file into a new Apps Script project.
 *   2. Project Settings -> Script Properties:
 *        INGEST_URL   = https://mikaeelfaraz.com/api/finance/ingest
 *        INGEST_TOKEN = <your FINANCE_INGEST_TOKEN>
 *   3. Run setup() once (grants Gmail read access, installs a 5-minute trigger).
 *   4. Run backfill() once to import older alerts. It works through one month at a
 *      time from BACKFILL_FROM (default Sep 2022) and, because Apps Script stops a run
 *      after 6 minutes, schedules itself to carry on every 10 minutes until it reaches
 *      today. Watch progress in Executions; backfillStatus() prints where it is.
 *
 * Both the Cashback (credit) card and the debit card send these alerts; the site files
 * each under its own account. Only messages newer than the last one sent go out on each
 * sync, and the server ignores re-sent Gmail message ids, so re-running is safe.
 * No secrets live in this file — keep the token in Script Properties.
 */
var SENDER = 'MashreqAlerts@mashreq.com';
var BATCH = 5; // small batches: the site's functions stop after ~10 seconds

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

/**
 * One-off history import, one calendar month per step, oldest first. Resumes where it
 * stopped: progress lives in the BACKFILL_NEXT script property ("2022-09"), and while
 * months remain a 10-minute trigger keeps calling this. Safe to re-run.
 */
function backfill() {
  var props = PropertiesService.getScriptProperties();
  var started = Date.now();
  var next = props.getProperty('BACKFILL_NEXT') || props.getProperty('BACKFILL_FROM') || '2022-09';
  var now = new Date();
  var endKey = monthKey_(now.getFullYear(), now.getMonth());
  ensureBackfillTrigger_(true);
  while (next <= endKey) {
    if (Date.now() - started > 3.5 * 60 * 1000) { Logger.log('Pausing at ' + next + '; resumes in ~10 minutes'); return; }
    var y = Number(next.slice(0, 4)), m = Number(next.slice(5, 7)) - 1;
    var after = Utilities.formatDate(new Date(y, m, 1), 'Asia/Dubai', 'yyyy/MM/dd');
    var before = Utilities.formatDate(new Date(y, m + 1, 1), 'Asia/Dubai', 'yyyy/MM/dd');
    var messages = [];
    for (var start = 0; ; start += 100) {
      var threads = GmailApp.search('from:' + SENDER + ' after:' + after + ' before:' + before, start, 100);
      threads.forEach(function (thread) {
        thread.getMessages().forEach(function (msg) { if (isAlert_(msg)) messages.push(msg); });
      });
      if (threads.length < 100) break;
    }
    Logger.log(next + ': ' + messages.length + ' alerts');
    send_(messages);
    next = monthKey_(y, m + 1);
    props.setProperty('BACKFILL_NEXT', next);
  }
  ensureBackfillTrigger_(false);
  Logger.log('Backfill complete');
}

/** Where the backfill has got to. */
function backfillStatus() {
  var p = PropertiesService.getScriptProperties();
  Logger.log('Next month to import: ' + (p.getProperty('BACKFILL_NEXT') || p.getProperty('BACKFILL_FROM') || '2022-09 (not started)'));
}

function monthKey_(y, m) {
  var d = new Date(y, m, 1);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}

function ensureBackfillTrigger_(on) {
  var existing = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'backfill'; });
  if (on && !existing.length) ScriptApp.newTrigger('backfill').timeBased().everyMinutes(10).create();
  if (!on) existing.forEach(function (t) { ScriptApp.deleteTrigger(t); });
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
    var batch = messages.slice(i, i + BATCH);
    if (post_(url, token, batch)) continue;
    // The batch kept failing: send its emails one at a time so one bad email can't
    // block the rest. Re-sending is safe (already-saved emails come back as duplicates).
    batch.forEach(function (m) {
      if (!post_(url, token, [m])) Logger.log('Skipped one email after retries: "' + m.getSubject() + '" of ' + m.getDate());
    });
  }
}

/** POST a few emails; retries brief server hiccups (a 502 is usually a slow request). */
function post_(url, token, messages) {
  var events = messages.map(function (m) {
    return {
      source: 'email',
      external_id: m.getId(),
      received_at: m.getDate().toISOString(),
      text: m.getPlainBody()
    };
  });
  var waits = [3, 10, 30, 70]; // seconds; the server takes over a cut-off email after a minute
  for (var attempt = 0; ; attempt++) {
    var res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify({ events: events }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code < 300) { Logger.log(res.getContentText().slice(0, 300)); return true; }
    var retryable = code >= 500 || code === 429;
    if (!retryable) throw new Error('Ingest failed (' + code + '): ' + res.getContentText().slice(0, 300));
    if (attempt >= waits.length) { Logger.log('Ingest still failing (' + code + ') after retries'); return false; }
    Logger.log('Ingest hiccup (' + code + '), retrying in ' + waits[attempt] + 's');
    Utilities.sleep(waits[attempt] * 1000);
  }
}
