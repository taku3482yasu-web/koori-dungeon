// アプリ化 (ホーム画面に 追加。2026-10-25 ユーザー指定) の テスト: manifest・アイコン・サービスワーカーが そろって いるか
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
// PNG の 幅と 高さ (ファイルの 頭の IHDR)
const pngSize = p => { const b = readFileSync(new URL(p, root)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('manifest: 名前・はじめの ページ・アイコン (192・512・maskable) が ある', () => {
    const m = JSON.parse(read('manifest.webmanifest'));
    assert.ok(m.name && m.short_name, '名前');
    assert.equal(m.display, 'standalone');
    assert.ok(existsSync(new URL(m.start_url, root)), 'はじめの ページが ある');
    for (const icon of m.icons) {
        const [w, h] = pngSize(icon.src);
        assert.equal(`${w}x${h}`, icon.sizes, `${icon.src} の 大きさ`);
    }
    assert.ok(m.icons.some(i => i.purpose === 'maskable'), 'maskable の アイコン');
    assert.deepEqual(pngSize('icons/apple-touch-icon.png'), [180, 180], 'iPhone の アイコン');
});

test('サービスワーカー: 保存する ファイルが ある・ページが manifest と sw.js を 読む', () => {
    const sw = read('sw.js');
    // const PAGES = [...]; の 行から 一覧を 読む
    const list = s => JSON.parse(sw.split(/\r?\n/).find(l => l.startsWith(`const ${s} = [`)).replace(`const ${s} = `, '').replace(/;\s*$/, '').replace(/'/g, '"'));
    for (const p of [...list('PAGES'), ...list('STATIC')]) assert.ok(existsSync(new URL(p, root)), `${p} が ない`);
    const html = read('index.html');
    assert.match(html, /<link rel="manifest" href="manifest.webmanifest">/);
    assert.match(html, /apple-touch-icon/);
    assert.match(read('js/main.js'), /serviceWorker\.register\('sw\.js'\)/);
    // ページが 読みこむ js / css は みな ある (オフラインで 保存する もの)
    for (const page of list('PAGES')) {
        for (const m of read(page).matchAll(/\b(?:src|href)="((?:js|css)\/[^"?]+)/g)) assert.ok(existsSync(new URL(m[1], root)), `${page}: ${m[1]} が ない`);
    }
});
