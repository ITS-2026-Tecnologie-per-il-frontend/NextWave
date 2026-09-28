import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import vm from 'node:vm';

let handler;
const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8').replace(/^import[^\n]*\n/, '');
vm.runInNewContext(source, {
  readFile, resolve, relative, extname, URL, process,
  createServer(fn) { handler = fn; return { listen() {} }; },
});
async function request(range, method = 'GET', url = '/audio/0.wav') {
  const response = {
    writeHead(status, headers = {}) { this.status = status; this.headers = headers; return this; },
    end(body) { this.body = body; },
  };
  await handler({ method, url, headers: { range } }, response);
  return response;
}

test('il server serve i byte iniziali richiesti dal player Safari e il WAV completo', async () => {
  const wav = readFileSync(new URL('../dist/audio/0.wav', import.meta.url));
  const first = await request('bytes=0-1');
  assert.equal(first.status, 206);
  assert.equal(first.headers['Content-Range'], `bytes 0-1/${wav.length}`);
  assert.equal(first.headers['Content-Length'], 2);
  assert.deepEqual(first.body, wav.subarray(0, 2));
  const full = await request();
  assert.equal(full.status, 200);
  assert.equal(full.headers['Accept-Ranges'], 'bytes');
  assert.equal(full.headers['Content-Type'], 'audio/wav');
  assert.equal(full.headers['Content-Length'], wav.length);
  assert.deepEqual(full.body, wav);
});

test('richieste audio parziali, HEAD e intervalli non validi', async () => {
  const wav = readFileSync(new URL('../dist/audio/0.wav', import.meta.url));
  assert.deepEqual((await request('bytes=40-')).body, wav.subarray(40));
  assert.deepEqual((await request('bytes=-10')).body, wav.subarray(-10));
  assert.equal((await request(`bytes=${wav.length}-`)).status, 416);
  assert.equal((await request('bytes=20-10')).status, 416);
  const head = await request(undefined, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, undefined);
  assert.equal(head.headers['Content-Length'], wav.length);
  assert.equal((await request(undefined, 'GET', '/audio/missing.wav')).status, 404);
});
