// =====================================================================
// 本物のブラウザでの 自動テスト (2026-10-22 ユーザー指定)
// ---------------------------------------------------------------------
// Chrome を DevTools Protocol で動かし、本物のマウス操作・タッチで ゲームを遊んで、エラーが出ないか・ボタンが効くかを確かめる。
// (tests/*.test.js は 画面を使わないので、「1 歩動くと画面が止まる」ような不具合を見つけられなかった)
// 流れ: はじめから → キャラ選択 → オープニング → 町 → ダンジョン → 十字ボタン・ゲーム画面・攻撃・道具・作戦・わざ・交代・キーボード
//   → 開きなおして 続き → (スマホの幅) バージョンごとの セーブ 2 つ → 鬼鬼団の 続き → 交易所の キャラ交換 → 引き継ぎコードを 入れる
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
        e.scrollIntoView({ block: 'nearest' });   // 一覧の 外に あれば 見えるところまで スクロール
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
// 指で 押して すべらせる (dy: 上へ 何 px)。一覧の スクロール
async function swipe(selector, dy) {
    const b = await evaluate(`(() => { const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * 0.8 }; })()`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y }] });
    for (let k = 1; k <= 8; k++) {
        await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: b.x, y: b.y - dy * k / 8 }] });
        await sleep(16);
    }
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(400);
}
// 指で 1 回 押す (text の ボタン。見えるところまで スクロールしてから)
async function tapText(selector, text) {
    const b = await evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find(x => x.textContent.includes(${JSON.stringify(text)}));
        const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y }] });
    await sleep(40);
    await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(400);
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
    // PC の 町: メニューは ゲーム画面に 重ならない (2026-10-22 ユーザー指定)
    check(await evaluate(`(() => { const st = document.querySelector('.stage').getBoundingClientRect(), box = document.getElementById('ask').getBoundingClientRect();
        return box.top >= st.bottom - 1 || box.left >= st.right - 1; })()`), 'PC の 町: メニューが ゲーム画面に 重ならない');

    // ダンジョンへ
    await press('.ask-choices button', { text: 'ダンジョンへ' });
    await press('.ask-choices button', { text: 'ハリーの森' });
    await press('.ask-choices button', { text: 'スキップ' });   // はじめて 行くときの 話 (絵つき)
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
        // まっすぐ 4 マス 歩ける場所と方向を さがして、主人公を そこへ移す (通路の角などでは 確かめられないので)
        const d = await evaluate(`(() => { const s = window.kdGame.state, p = s.player, m = s.map;
            const free = (x, y) => !s.allies.some(a => a.x === x && a.y === y) && !s.items.some(i => i.x === x && i.y === y);
            const run = (x, y, [dx, dy]) => { let n = 0; while (n < 4 && KD.Dungeon.canMove(m, x, y, dx, dy) && free(x + dx, y + dy)) { x += dx; y += dy; n++; } return n; };
            const DIRS = [[0,1],[1,0],[0,-1],[-1,0]];
            for (let y = 1; y < m.h - 1; y++) for (let x = 1; x < m.w - 1; x++) {
                if (KD.Dungeon.at(m, x, y) !== KD.Dungeon.FLOOR || !free(x, y)) continue;
                const dir = DIRS.find(dd => run(x, y, dd) >= 4);
                if (dir) { p.x = p.fx = x; p.y = p.fy = y; p.anim = null; return dir.join(','); }
            }
            return null; })()`);
        await sleep(300);
        const before = await pos();
        const [dx, dy] = (d || '0,1').split(',').map(Number);
        await press('#screen', { at: [0.5 + dx * 0.3, 0.5 + dy * 0.3], hold: 1500 });
        const [x0, y0] = before.split(',').map(Number), [x1, y1] = (await pos()).split(',').map(Number);
        const why = Math.abs(x1 - x0) + Math.abs(y1 - y0) >= 2 ? '' : `（向き ${d}・${before} → ${x1},${y1}・${(await evaluate('window.kdGame.state.messages.map(m => m.text).join(" / ")'))}・${await asking()}）`;
        check(!why, `ゲーム画面を押しっぱなしで 歩きつづける${why}`);
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
    // 交代: おにおにを 操作して 歩く → 主人公に もどす
    await press('#btn-switch');
    check(/だれを 操作する/.test(await asking()), '「交代」で 操作するキャラを えらぶ画面');
    await press('.ask-choices button', { text: 'おにおに' });
    check(await evaluate('window.kdGame.state.player.kind') === 'onioni', 'おにおにを 操作する');
    await calm();
    {
        const d = await openDir();
        const before = await pos();
        if (d) await press(DIRS[d], { hold: 0 });
        await sleep(400);
        check(!d || await pos() !== before, 'おにおにで 歩ける');
    }
    await key('KeyC', 67);
    await press('.ask-choices button', { text: 'こおりくん' });
    check(await evaluate('window.kdGame.state.player.kind') === 'koori', 'C キーで 主人公に もどす');
    await press('#btn-map');
    await press('#btn-sound');
    check(/音の設定/.test(await asking()), '「音」ボタンで 音の設定');
    await press('.ask-choices button', { text: 'もどる' });
    await sleep(800);
    check(await phase() === 'play', '最後まで 画面が止まらない');
    // ページを 開きなおすと、やめた場所から 続く (オートセーブ)
    await press('#btn-wait');
    await sleep(600);
    const was = await evaluate('(() => { const s = window.kdGame.state, h = window.kdGame.heroUnit(); return [s.floor, h.x, h.y, h.hp, s.enemies.length].join(","); })()');
    await send('Page.reload');
    await sleep(2500);
    await press('.ask-choices button', { text: 'つづきから' });
    await sleep(1200);
    const now = await evaluate('(() => { const s = window.kdGame.state, h = window.kdGame.heroUnit(); return [s.floor, h.x, h.y, h.hp, s.enemies.length].join(","); })()');
    check(await phase() === 'play' && now === was, `ページを開きなおすと やめた場所から続く（${was} → ${now}）`);

    // ----- バージョン: セーブが 2 つ・キャラ交換 (スマホの幅で) -----
    // 氷隊の セーブを 写して 鬼鬼団の セーブを 作る (町から・交易所を 開けて・コンピューターが 氷隊の キャラを 出品している)
    await evaluate(`(() => {
        const d = JSON.parse(localStorage.getItem('koori-dungeon-save-koori'));
        d.hero.kind = 'onioni'; d.hero.name = 'おにおに'; d.allies = d.allies.filter(a => a.kind !== 'onioni');
        Object.assign(d.town, { version: 'onioni', paid: 100000, debt: 0, cleared: 5, market: [{ id: 'ally_yukiusapon', n: 8, seller: '5DX', price: 8000 }] });
        d.hero.money = 20000; d.run = null; d.snap = null;
        localStorage.setItem('koori-dungeon-save-onioni', JSON.stringify(d));
        return true;
    })()`);
    // 交易所の オンラインは つながらない ことにする (テストが ネットに 左右されないように)
    await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['*supabase.co*'] });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send('Page.reload');
    await sleep(2500);
    const titleBtns = await evaluate('[...document.querySelectorAll(".ask-choices button")].map(b => b.textContent).join(" / ")');
    check(/つづきから（氷隊）/.test(titleBtns) && /つづきから（鬼鬼団）/.test(titleBtns), `タイトルに バージョンごとの つづきから（${titleBtns}）`);
    const fits = () => evaluate(`(() => document.documentElement.scrollWidth <= innerWidth + 1
        && [...document.querySelectorAll('.ask-choices button')].every(b => b.scrollWidth <= b.clientWidth + 1))()`);
    check(await fits(), 'スマホの幅で タイトルの ボタンが はみ出さない');
    await press('.ask-choices button', { text: 'つづきから（鬼鬼団）' });
    await sleep(800);
    check(await phase() === 'town' && await evaluate('window.kdGame.state.town.version') === 'onioni' && /鬼鬼団/.test(await evaluate('document.title')),
        '鬼鬼団の 続きから（ページの 名前にも 鬼鬼団）');
    // スマホの 町: メニューは ゲーム画面の 下に 出て 全部 見える (スクロールなしで 最後まで)。十字ボタンは かくれる
    check(await evaluate(`(() => {
        const st = document.querySelector('.stage').getBoundingClientRect(), box = document.getElementById('ask').getBoundingClientRect();
        const btns = [...document.querySelectorAll('.ask-choices button')], last = btns[btns.length - 1].getBoundingClientRect();
        return box.top >= st.bottom - 1 && last.bottom <= innerHeight + 1 && getComputedStyle(document.querySelector('.pad')).display === 'none';
    })()`), 'スマホの 町: メニューが ゲーム画面に 重ならず 全部 見える・十字ボタンは かくれる');
    // 低い スマホ: 長い 一覧 (ダンジョンへ) を 指で スクロールしても 決まらず、いちばん下の「やめる」を 押せる
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 600, deviceScaleFactor: 2, mobile: true });
    await sleep(300);
    await tapText('.ask-choices button', 'ダンジョンへ');
    const listTop = () => evaluate('document.querySelector(".ask-choices").scrollTop');
    const overflow = await evaluate('(() => { const c = document.querySelector(".ask-choices"); return c.scrollHeight > c.clientHeight + 4; })()');
    await swipe('.ask-choices', 300);
    const scrolled = await listTop();
    const stillList = /どこへ行く/.test(await asking());
    await tapText('.ask-choices button', 'やめる');
    check(overflow && scrolled > 0 && stillList && /SEタウン/.test(await asking()),
        `スマホ: 長い 一覧を 指で スクロールでき（${scrolled}px）、いちばん下を 押せる`);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(300);
    await press('.ask-choices button', { text: '交易所' });
    await sleep(1500);
    await press('.ask-choices button', { text: 'ほかの探検隊の出品' });
    await sleep(1500);
    check(await fits(), 'スマホの幅で 交易所の ボタンが はみ出さない');
    await press('.ask-choices button', { text: 'ユキウサポン' });
    await sleep(500);
    check(/買った/.test(await asking()) && await evaluate('window.kdGame.state.roster.some(a => a.kind === "yukiusapon")'), '交易所で もう片方の バージョンの キャラを 買える');

    // ----- 引き継ぎ: コードを 入れる 欄 (スマホの幅。つながらない ことにしてある) -----
    await send('Page.reload');
    await sleep(2500);
    await press('.ask-choices button', { text: '引き継ぎ' });
    await press('.ask-choices button', { text: 'コードを入れる' });
    await sleep(300);
    const field = () => evaluate('(() => { const i = document.querySelector(".ask-input"); return i && !i.hidden && document.activeElement === i ? i.value : null; })()');
    check(await field() === '', '引き継ぎ: コードを 入れる 欄が 出て、すぐ 打てる');
    await send('Input.insertText', { text: 'abcd-efg' });
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyZ', key: 'z', text: 'z', windowsVirtualKeyCode: 90 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyZ', key: 'z', windowsVirtualKeyCode: 90 });
    await sleep(200);
    check(await field() === 'abcd-efgz' && await fits(), `引き継ぎ: Z を 打っても 決定に ならず 字が 入る・はみ出さない（${await field()}）`);
    await press('.ask-choices button', { text: '受け取る' });
    await press('.ask-choices button', { text: '上書きする' });
    await sleep(1500);
    check(/つながらなかった/.test(await asking()) && await evaluate('Boolean(localStorage.getItem("koori-dungeon-save-onioni"))'),
        '引き継ぎ: つながらないときは そう 言って、セーブは そのまま');

    // BGM の 重なり (2026-10-22 ユーザー指定: 開きなおすと BGM が 重なる)。
    // 2 つ目の タブで 開いて 押すと 前の タブの BGM は 止まり、前の タブに もどって 押すと そちらだけ 鳴る
    await press('h1 small');
    const sound = ev => ev('JSON.stringify(KD.Sound.status())').then(JSON.parse);
    const s1 = await sound(evaluate);
    const { targetId } = await send('Target.createTarget', { url: pathToFileURL(join(ROOT, 'index.html')).href });
    await sleep(2500);
    const page2 = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.id === targetId);
    const ws2 = new WebSocket(page2.webSocketDebuggerUrl);
    await new Promise(r => ws2.addEventListener('open', r, { once: true }));
    let id2 = 0;
    const pend2 = new Map();
    ws2.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend2.has(m.id)) { pend2.get(m.id)(m.result || {}); pend2.delete(m.id); } });
    const send2 = (method, params = {}) => new Promise(r => { const n = ++id2; pend2.set(n, r); ws2.send(JSON.stringify({ id: n, method, params })); });
    const evaluate2 = async e => (await send2('Runtime.evaluate', { expression: e, returnByValue: true })).result.value;
    await send('Target.activateTarget', { targetId });
    for (const type of ['mousePressed', 'mouseReleased']) await send2('Input.dispatchMouseEvent', { type, x: 200, y: 20, button: 'left', clickCount: 1, buttons: 1 });
    await sleep(800);
    const a1 = await sound(evaluate), a2 = await sound(evaluate2);
    check(s1.playing && !a1.playing && a2.playing, `BGM: 2 つ目の タブで 鳴らすと 前の タブは 止まる（前 ${s1.playing}→${a1.playing}・2 つ目 ${a2.playing}）`);
    const first = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(t => t.type === 'page' && t.id !== targetId);
    await send('Target.activateTarget', { targetId: first.id });
    await press('h1 small');
    await sleep(800);
    const b1 = await sound(evaluate), b2 = await sound(evaluate2);
    check(b1.playing && !b2.playing, `BGM: 前の タブに もどって 押すと そちらだけ 鳴る（前 ${b1.playing}・2 つ目 ${b2.playing}）`);
    ws2.close();
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
