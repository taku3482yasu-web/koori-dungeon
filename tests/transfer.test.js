// 引き継ぎ (スマホと PC で セーブを 移す) のテスト。端末 2 つを localStorage の 入れかえで まねする
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
let store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'enemies.js', 'items.js', 'dungeons.js', 'collection.js', 'allies.js', 'enemies9.js', 'enemies10.js', 'enemies11.js', 'town.js', 'art.js', 'bigart.js', 'enemyart.js', 'enemyart9.js', 'enemyart10.js', 'enemyart11.js', 'sound.js', 'config.js', 'market.js', 'townui.js', 'motion.js', 'game.js']) {
    vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
}

const fakeCtx = () => new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }) }, {
    get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; }
});
const flush = () => new Promise(r => setTimeout(r, 0));

// Supabase の まね (put_transfer / take_transfer だけ)
function fakeSupabase() {
    const codes = new Map();
    let n = 0;
    const ok = body => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) });
    const fetch = (url, req) => {
        const path = url.replace(/^.*\/rest\/v1\//, '');
        const b = req.body ? JSON.parse(req.body) : {};
        if (path === 'rpc/put_transfer') {
            const code = `ABCD${'EFGH'.slice(0, 3)}${'23456789'[n++ % 8]}`;
            codes.set(code, b.p_data);
            return ok(code);
        }
        if (path === 'rpc/take_transfer') {
            const data = codes.get(b.p_code.toUpperCase()) ?? null;
            codes.delete(b.p_code.toUpperCase());
            return ok(data);
        }
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
    };
    return { codes, fetch };
}

// 1 つの 端末 (localStorage) で ゲームを 開く。choose(label, 入れる文字)
function device(storage, fetch) {
    store = storage;
    const asks = [];
    const ui = { ask: (message, options, done, extra) => asks.push({ message, options, done, extra }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: fakeCtx }, ui, { seed: 5, things: false, recruit: false, market: undefined, happen: false, marketDeps: { fetch } });
    const choose = (label, value) => {
        const q = asks.shift();
        assert.ok(q, `「${label}」をえらぶ画面がない`);
        const i = q.options.findIndex(o => o.includes(label));
        assert.ok(i >= 0, `「${label}」がない: ${q.options.join(' / ')}`);
        q.done(i, value);
    };
    return { game, s: game.state, asks, choose };
}

test('引き継ぎ: PC で コードを 出して、スマホで 入れると セーブ (両方の バージョン) と 交易所の ID が 移る。コードは 1 回だけ', async () => {
    globalThis.KD.CONFIG.supabase = { url: 'https://fake.supabase.co', key: 'anon' };
    const sb = fakeSupabase();
    // PC: 氷隊で 遊んで、鬼鬼団の セーブも ある
    const pcStore = new Map();
    const pc = device(pcStore, sb.fetch);
    pc.choose('はじめから');
    pc.choose('こおりくん');
    for (let i = 0; i < 5; i++) pc.choose('つぎへ');
    pc.s.town.day = 12;
    pc.s.player.money = 4321;
    pc.choose('家');
    pc.choose('タイトルへ');
    const oni = JSON.parse(pcStore.get('koori-dungeon-save-koori'));
    oni.town.version = 'onioni';
    oni.town.day = 3;
    pcStore.set('koori-dungeon-save-onioni', JSON.stringify(oni));
    const pcId = pcStore.get('koori-dungeon-player');
    assert.ok(pcId);
    pc.choose('引き継ぎ');
    pc.choose('コードを出す');
    assert.match(pc.asks[0].message, /つないでいます/);
    assert.equal(pc.asks[0].options.length, 0);
    pc.asks.shift();
    await flush();
    const code = /引き継ぎコード：([A-Z0-9]{4})-([A-Z0-9]{4})/.exec(pc.asks[0].message);
    assert.ok(code, pc.asks[0].message);
    assert.match(pc.asks[0].message, /氷隊・鬼鬼団/);
    assert.ok(pcStore.get('koori-dungeon-save-koori'), 'PC の セーブも 残る');

    // スマホ: べつの セーブ (氷隊) が ある → 上書きを 聞く。小文字・ハイフンつきでも よい
    const phoneStore = new Map([['koori-dungeon-save-koori', JSON.stringify({ ...oni, town: { ...oni.town, version: 'koori', day: 1 } })]]);
    const phone = device(phoneStore, sb.fetch);
    assert.notEqual(phoneStore.get('koori-dungeon-player'), pcId);
    phone.choose('引き継ぎ');
    phone.choose('コードを入れる');
    assert.ok(phone.asks[0].extra.input, '文字を 入れる 欄が 出る');
    phone.choose('受け取る', 'abc');
    assert.match(phone.asks[0].message, /8 文字/);
    phone.choose('受け取る', `${code[1]}-${code[2]}`.toLowerCase());
    assert.match(phone.asks[0].message, /上書き/);
    phone.choose('上書きする');
    phone.asks.shift();   // つないでいます
    await flush();
    assert.match(phone.asks[0].message, /氷隊・鬼鬼団の セーブを 受け取った/);
    assert.equal(phoneStore.get('koori-dungeon-player'), pcId, '交易所の 出品・売上も 引き継ぐ');
    phone.choose('タイトルへ');
    phone.choose('つづきから（氷隊）');
    assert.equal(phone.s.town.day, 12);
    assert.equal(phone.s.player.money, 4321);

    // 同じ コードは もう 使えない
    phone.choose('家');
    phone.choose('タイトルへ');
    phone.choose('引き継ぎ');
    phone.choose('コードを入れる');
    phone.choose('受け取る', code[1] + code[2]);
    phone.choose('上書きする');
    phone.asks.shift();
    await flush();
    assert.match(phone.asks[0].message, /ちがうか、期限が 切れて/);
    globalThis.KD.CONFIG.supabase = { url: '', key: '' };
});

test('引き継ぎ: セーブが ない・つながらない・設定が ないとき', async () => {
    globalThis.KD.CONFIG.supabase = { url: 'https://fake.supabase.co', key: 'anon' };
    const down = device(new Map(), () => Promise.reject(new Error('offline')));
    down.choose('引き継ぎ');
    down.choose('コードを出す');
    assert.match(down.asks[0].message, /送る セーブが ありません/);
    down.choose('もどる');
    down.choose('コードを入れる');
    down.choose('受け取る', 'ABCD-EFGH');
    down.asks.shift();
    await flush();
    await flush();
    assert.match(down.asks[0].message, /つながらなかった/);
    globalThis.KD.CONFIG.supabase = { url: '', key: '' };
    const off = device(new Map(), () => Promise.reject(new Error('offline')));
    off.choose('引き継ぎ');
    assert.match(off.asks[0].message, /インターネットに つながっていない/);
});
