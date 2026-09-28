import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as core from '../dist/core.js';

const source = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8').replace(/^import[^\n]*\n/, '');
const beforeClose = { day: '2026-09-28', seconds: 20 * 3600, revealed: false };
const afterClose = { ...beforeClose, seconds: 21 * 3600, revealed: true };
const profile = () => ({ uid: 'demo-test', name: 'Test', prefs: ['Trap', 'Rap'], onboard: true, connected: false, rounds: {}, saved: [], applications: [] });

// Esegue l'app reale con DOM, audio e orologio controllati, senza dipendenze esterne.
function app({ saved = profile(), now = beforeClose, hash = '' } = {}) {
  let clock = { ...now }, storage = saved == null ? null : JSON.stringify(saved), interval;
  const clicks = {}, media = {}, dialogEvents = {};
  const root = { innerHTML: '' }, toast = { textContent: '', style: {} };
  const dialog = {
    innerHTML: '', open: false, className: '', openings: 0,
    setAttribute() {}, addEventListener(name, fn) { dialogEvents[name] = fn; },
    showModal() { this.open = true; this.openings++; },
    close() { this.open = false; dialogEvents.close?.(); },
  };
  const audio = {
    currentTime: 0, volume: .65, fail: false,
    addEventListener(name, fn) { media[name] = fn; },
    async play() { if (this.fail) throw new Error('Audio non disponibile'); media.playing?.(); },
    pause() { media.pause?.(); },
  };
  const nodes = { '#app': root, '#audio': audio, '#modal': dialog, '#toast': toast };
  const context = vm.createContext({
    ...core, rome: () => clock,
    document: { documentElement: { dataset: {} }, querySelectorAll: () => [], querySelector: s => nodes[s] || null, addEventListener: (name, fn) => { clicks[name] = fn; } },
    localStorage: { getItem: () => storage, setItem: (_key, value) => { storage = value; } },
    crypto: { randomUUID: () => 'new-user-test' }, location: { hash },
    window: { addEventListener() {}, scrollTo() {} },
    setInterval: fn => { interval = fn; }, setTimeout() {},
  });
  vm.runInContext(source, context);
  return {
    root, dialog, audio, toast,
    run: code => vm.runInContext(code, context),
    state: () => JSON.parse(vm.runInContext('JSON.stringify(state)', context)),
    emit: name => media[name]?.(),
    click: dataset => clicks.click({ target: { closest: () => ({ dataset }) } }),
    advance(next) { clock = { ...next }; interval(); },
  };
}

test('avatar laterale e logo portano al profilo e ai cinque brani', () => {
  const page = app();
  assert.match(page.root.innerHTML, /class="avatar" data-nav="profile" aria-label="Apri il tuo profilo"/);
  page.click({ nav: 'profile' });
  assert.match(page.root.innerHTML, /Il tuo spazio/);
  assert.match(page.root.innerHTML, /class="brand brand-home" data-nav="daily"/);
  page.click({ nav: 'daily' });
  assert.equal((page.root.innerHTML.match(/<article class="track /g) || []).length, 5);
});

test('il primo accesso conserva introduzione e collegamento Spotify demo', () => {
  const page = app({ saved: null, now: afterClose });
  assert.match(page.root.innerHTML, /La prossima scoperta/);
  assert.equal(page.dialog.open, false);
  page.click({ action: 'next' });
  assert.match(page.root.innerHTML, /Collega Spotify · simulazione/);
});

test('il primo avvio effettivo conta subito; pausa e replay non duplicano l’ascolto', async () => {
  const page = app();
  const id = page.state().rounds[beforeClose.day].ids[0];
  await page.click({ play: id });
  assert.equal(page.audio.currentTime, 0);
  assert.deepEqual(page.state().rounds[beforeClose.day].listened, [id]);
  await page.click({ play: id }); // pausa
  await page.click({ play: id }); // replay
  page.emit('ended');
  assert.deepEqual(page.state().rounds[beforeClose.day].listened, [id]);
  const reload = app({ saved: page.state() });
  assert.deepEqual(reload.state().rounds[beforeClose.day].listened, [id]);
});

test('audio fallito o solo richiesto, senza riproduzione, non conta', async () => {
  const page = app();
  const id = page.state().rounds[beforeClose.day].ids[0];
  page.audio.fail = true;
  await page.click({ play: id });
  page.emit('play');
  page.emit('error');
  assert.deepEqual(page.state().rounds[beforeClose.day].listened, []);
  assert.equal(page.run('canVote(round(), revealed())'), false);
});

test('avviati cinque brani si può votare una volta, senza attendere la fine', async () => {
  const page = app();
  const ids = page.state().rounds[beforeClose.day].ids;
  for (const id of ids.slice(0, 4)) await page.click({ play: id });
  assert.equal(page.run('canVote(round(), revealed())'), false);
  await page.click({ play: ids[4] });
  assert.equal(page.run('canVote(round(), revealed())'), true);
  page.click({ confirm: ids[2] });
  assert.equal(page.state().rounds[beforeClose.day].vote, ids[2]);
  page.click({ confirm: ids[3] });
  assert.equal(page.state().rounds[beforeClose.day].vote, ids[2]);
});

test('all’ingresso dopo le 21 il popup rivela tutti i cinque brani e una sola volta', () => {
  const page = app({ now: afterClose });
  assert.equal(page.dialog.open, true);
  assert.equal(page.dialog.className, 'revealmodal');
  assert.equal((page.dialog.innerHTML.match(/<li class="reveal-row/g) || []).length, 5);
  for (const id of page.state().rounds[afterClose.day].ids) {
    const track = core.catalog.find(t => t.id === id);
    assert.ok(page.dialog.innerHTML.includes(track.artist));
    assert.ok(page.dialog.innerHTML.includes(track.title));
  }
  page.dialog.close();
  page.click({ nav: 'profile' });
  page.click({ nav: 'daily' });
  assert.equal(page.dialog.openings, 1);
  assert.equal(app({ saved: page.state(), now: afterClose }).dialog.open, false);
  page.click({ action: 'results' });
  assert.equal(page.dialog.openings, 2);
});

test('prima delle 21 nessun risultato; il popup appare alla chiusura con app aperta', () => {
  const page = app();
  assert.equal(page.dialog.open, false);
  page.click({ action: 'results' });
  assert.equal(page.dialog.open, false);
  page.advance(afterClose);
  assert.equal(page.dialog.open, true);
  assert.match(page.dialog.innerHTML, /CONTEST CONCLUSO/);
  assert.equal(page.run('canVote(round(), revealed())'), false);
});

test('il reveal attende la chiusura di un dialogo già aperto', () => {
  const page = app();
  page.run("modal('Altro messaggio')");
  page.advance(afterClose);
  assert.equal(page.dialog.innerHTML, 'Altro messaggio');
  page.dialog.close();
  assert.match(page.dialog.innerHTML, /CONTEST CONCLUSO/);
});

test('il rientro il giorno dopo mostra il contest precedente senza svelare quello nuovo', () => {
  const yesterday = app().state();
  const page = app({ saved: yesterday, now: { ...beforeClose, day: '2026-09-29' } });
  assert.equal(page.dialog.open, true);
  assert.match(page.dialog.innerHTML, /28\/09\/2026/);
  assert.deepEqual(page.state().seenReveals, ['2026-09-28']);
  assert.equal(page.run('revealed()'), false);
  assert.match(page.root.innerHTML, /Brano 01/);
});

test('il reveal di prova non sopprime quello reale e il link apre le classifiche', () => {
  const page = app();
  page.click({ action: 'reveal' });
  assert.match(page.dialog.innerHTML, /REVEAL DI PROVA/);
  assert.equal(page.state().seenReveals, undefined);
  page.click({ action: 'openRanks' });
  assert.equal(page.dialog.open, false);
  assert.match(page.root.innerHTML, /La musica sale/);
  page.advance(afterClose);
  assert.equal(page.dialog.open, true);
  assert.match(page.dialog.innerHTML, /CONTEST CONCLUSO/);
});

test('classifica e popup usano gli stessi punteggi, includendo il voto locale', async () => {
  const page = app();
  const ids = page.state().rounds[beforeClose.day].ids;
  for (const id of ids) await page.click({ play: id });
  page.click({ confirm: ids[0] });
  page.dialog.close();
  page.advance(afterClose);
  const rows = JSON.parse(page.run(`JSON.stringify(dailyRanking('${beforeClose.day}'))`));
  const base = core.rankRows(core.catalog, 'day', beforeClose.day).find(t => t.id === ids[0]);
  const voted = rows.find(t => t.id === ids[0]);
  assert.equal(voted.votes, base.votes + 1);
  assert.equal(voted.exposures, base.exposures + 1);
  assert.match(page.dialog.innerHTML, /Il tuo voto/);
  const selected = rows.filter(t => ids.includes(t.id));
  const positions = selected.map(t => page.dialog.innerHTML.indexOf(t.title));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  page.click({ action: 'openRanks' });
  assert.ok(page.root.innerHTML.includes((voted.score * 100).toFixed(1).replace('.', ',')));
});
