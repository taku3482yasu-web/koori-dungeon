// =====================================================================
// 本物のブラウザでの 自動テスト (2026-10-22 ユーザー指定)
// ---------------------------------------------------------------------
// Chrome を DevTools Protocol で動かし、本物のマウス操作・タッチで ゲームを遊んで、エラーが出ないか・ボタンが効くかを確かめる。
// (tests/*.test.js は 画面を使わないので、「1 歩動くと画面が止まる」ような不具合を見つけられなかった)
// 流れ: はじめから → キャラ選択 → オープニング → 町 → ダンジョン → 十字ボタン・ゲーム画面・攻撃・道具・作戦・わざ・キーボード
// 使い方 (koori-dungeon フォルダで): node tools/browser-test.mjs
// 失敗したら 終了コード 1。Chrome が見つからないときは 飛ばす (終了コード 0)。.githooks/pre-commit が走らせる。
// =====================================================================
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHROMES = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
const CHROME = CHROMES.find(p => existsSync(p));
if (!CHROME) {
    console.log('ブラウザのテスト: Chrome が見つからないので 飛ばしました');
    process.exit(0);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const port = 9400 + Math.floor(Math.random() * 400);
const profile = mkdtempSync(join(tmpdir(), 'kd-browser-test-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--allow-file-access-from-files',
    '--window-size=1078,1017', 'about:blank'], { stdio: 'ignore' });

let ws, id = 0;
const pending = new Map(), errors = [], results = [];
const send = (method, params = {}) => new Promise(resolve => {
    const n = ++id;
    pending.set(n, resolve);
    ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
};
const check = (ok, name) => { results.push(`${ok ? '✔' : '✘'} ${name}`); };

// 要素のまんなか (または 割合の位置) を マウスで押す。hold: 押している ミリ秒
async function press(selector, { text = null, at = null, hold = 60 } = {}) {
    const b = await evaluate(`(() => {
        const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find(x => ${text ? `x.textContent.includes(${JSON.stringify(text)})` : 'true'});
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { x: r.x + r.width * ${at ? at[0] : 0.5}, y: r.y + r.height * ${at ? at[1] : 0.5} };
    })()`);
    if (!b) throw new Error(`見つからない: ${selector} ${text || ''}`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: b.x, y: b.y, button: 'left', clickCount: 1, buttons: 1 });
    await sleep(hold);
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await sleep(350);
}
async function tap(selector) {
    const b = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y }] });
    await sleep(30);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(350);
}
async function key(code, vk, hold = 150) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: code, windowsVirtualKeyCode: vk });
    await sleep(hold);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: code, windowsVirtualKeyCode: vk });
    await sleep(350);
}
const pos = () => evaluate('(() => { const p = window.kdGame.state.player; return [p.x, p.y].join(","); })()');
const asking = () => evaluate('document.getElementById("ask").hidden ? "" : document.querySelector(".ask-text").textContent');
const phase = () => evaluate('window.kdGame.state.phase');
// 主人公の となりで 歩けるマスへの方向 (なければ null)
const openDir = () => evaluate(`(() => { const s = window.kdGame.state, p = s.player;
    const d = [[0,1],[1,0],[0,-1],[-1,0]].find(([dx,dy]) => KD.Dungeon.canMove(s.map, p.x, p.y, dx, dy) && !s.enemies.some(e => e.x === p.x+dx && e.y === p.y+dy) && !s.allies.some(a => a.x === p.x+dx && a.y === p.y+dy) && !s.traps.some(t => t.x === p.x+dx && t.y === p.y+dy));
    return d ? d.join(',') : null; })()`);
// まわりの敵を いなくして、ワナも消す (確かめるのは ボタンが効くかだけ)
const calm = () => evaluate('(() => { const s = window.kdGame.state; s.enemies.splice(0); s.traps.splice(0); return true; })()');

try {
    let wsUrl = null;
    for (let i = 0; i < 50 && !wsUrl; i++) {
        try {
            const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
            wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
        } catch (e) { /* まだ */ }
        if (!wsUrl) await sleep(200);
    }
    if (!wsUrl) throw new Error('Chrome に つながらない');
    ws = new WebSocket(wsUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));
    ws.addEventListener('message', ev => {
        const m = JSON.parse(ev.data);
        if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result || {}); pending.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).split('\n').slice(0, 2).join(' '));
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value || a.description).join(' ').split('\n')[0]);
    });
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1078, height: 1017, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: pathToFileURL(join(ROOT, 'index.html')).href });
    await sleep(2000);
    await evaluate('localStorage.clear()');
    await send('Page.reload');
    await sleep(2000);

    // タイトル → はじめから → キャラ選択 → オープニング
    await press('.ask-choices button', { text: 'はじめから' });
    await press('.ask-choices button', { text: 'こおりくん' });
    check(/摩天楼/.test(await asking()), 'キャラをえらぶと オープニングが始まる');
    for (let i = 0; i < 5; i++) await press('.ask-choices button', { text: 'つぎへ' });
    check(await phase() === 'town' && /日目/.test(await asking()), 'オープニングのあと 町へ');
    check(/仲間の広場/.test(await evaluate('[...document.querySelectorAll(".ask-choices button")].map(b => b.textContent).join(" ")')), '仲間の広場は はじめから使える');

    // ダンジョンへ
    await press('.ask-choices button', { text: 'ダンジョンへ' });
    await press('.ask-choices button', { text: 'ハリーの森' });
    await sleep(2500);
    check(await phase() === 'play', 'ダンジョンに入る');

    // 十字ボタン (押してすぐ離す)
    const DIRS = { '0,1': '[data-dir="0,1"]', '1,0': '[data-dir="1,0"]', '0,-1': '[data-dir="0,-1"]', '-1,0': '[data-dir="-1,0"]' };
    for (const how of ['十字ボタンを押してすぐ離す', 'ゲーム画面を押す', '十字ボタンをタップ (タッチ)', 'キーボードの矢印']) {
        await calm();
        const d = await openDir();
        if (!d) { check(false, `${how}: 動けるマスがない`); continue; }
        const before = await pos();
        if (how.startsWith('十字ボタンを押して')) await press(DIRS[d], { hold: 0 });
        else if (how === 'ゲーム画面を押す') {
            const [dx, dy] = d.split(',').map(Number);
            await press('#screen', { at: [0.5 + dx * 0.25, 0.5 + dy * 0.25] });
        } else if (how.startsWith('十字ボタンをタップ')) await tap(DIRS[d]);
        else {
            const map = { '0,1': ['ArrowDown', 40], '1,0': ['ArrowRight', 39], '0,-1': ['ArrowUp', 38], '-1,0': ['ArrowLeft', 37] };
            await key(...map[d]);
        }
        await sleep(400);
        check(await pos() !== before, `${how}で 1 歩動く`);
    }
    // ゲーム画面を 押しっぱなし → 歩きつづける (3 マス以上 まっすぐ歩ける方向で)
    await calm();
    {
        const d = await evaluate(`(() => { const s = window.kdGame.state, p = s.player;
            const run = ([dx, dy]) => { let n = 0, x = p.x, y = p.y; while (n < 4 && KD.Dungeon.canMove(s.map, x, y, dx, dy) && !s.allies.some(a => a.x === x+dx && a.y === y+dy)) { x += dx; y += dy; n++; } return n; };
            const best = [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]].sort((a, b) => run(b) - run(a))[0];
            return run(best) >= 3 ? best.join(',') : null; })()`);
        const before = await pos();
        const [dx, dy] = (d || '0,1').split(',').map(Number);
        await press('#screen', { at: [0.5 + dx * 0.3, 0.5 + dy * 0.3], hold: 1500 });
        const [x0, y0] = before.split(',').map(Number), [x1, y1] = (await pos()).split(',').map(Number);
        check(Math.abs(x1 - x0) + Math.abs(y1 - y0) >= 2, 'ゲーム画面を押しっぱなしで 歩きつづける');
    }
    // 道具・作戦・地図・足ぶみ・攻撃・わざ
    await press('#btn-item');
    check(/道具/.test(await asking()), '「道具」で 道具の画面');
    await press('#btn-item');
    check(!(await asking()), '「道具」で 閉じる');
    await press('#btn-tactic');
    check(/作戦/.test(await asking()), '「作戦」で 作戦の画面');
    await press('.ask-choices button', { text: 'やめる' });
    const turn = await evaluate('window.kdGame.state.turn');
    await press('#btn-wait');
    check(await evaluate('window.kdGame.state.turn') > turn, '「足ぶみ」で ターンがすすむ');
    await press('#btn-ok');
    await press('#skills button');
    check((await evaluate('window.kdGame.state.messages.map(m => m.text).join(" ")')).includes('コオリソード'), 'わざのボタンで わざを使う');
    await press('#btn-map');
    await press('#btn-sound');
    await sleep(800);
    check(await phase() === 'play', '最後まで 画面が止まらない');
} catch (e) {
    check(false, `止まった: ${e.message}`);
} finally {
    check(errors.length === 0, `エラーが出ない${errors.length ? `（${errors.slice(0, 3).join(' / ')}）` : ''}`);
    console.log(results.join('\n'));
    const failed = results.filter(r => r.startsWith('✘')).length;
    console.log(`ブラウザのテスト: ${results.length - failed} / ${results.length} 成功`);
    chrome.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch (e) { /* 消せなくても よい */ }
    process.exit(failed ? 1 : 0);
}
