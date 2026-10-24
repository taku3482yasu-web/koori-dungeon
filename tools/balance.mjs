// =====================================================================
// バランスの確認 (2026-10-22 ユーザー指定): 自動で遊ぶプレイヤーに 各ダンジョンを何回も挑戦させて、
// 突破できる割合・倒れた階・かかったターンを出す。画面は使わない (tests と同じく 偽の canvas)。
// ---------------------------------------------------------------------
// 自動で遊ぶプレイヤー (bot):
//   - 地図は ぜんぶ知っている (階段まで いちばん近い道を歩く)。となりの敵とは 戦う (わざを使う。PP があれば 強いわざ)
//   - 持ち物: おにぎり 2・氷のかけら (2 ＋ 5 階ごとに 1)・ふっかつのたね 1 (長いダンジョンほど 多めに 買っていくとして)
//   - HP が 4 割を切ったら 氷のかけらを使う。おなかが減ったら おにぎり
//   - ドタバタ大迷宮は 休憩の階から 次の休憩の階までの 10 階ずつ (町で 準備し直せるので)
//   - 仲間になりたそうにしても 断る。わざを覚えるときは 覚えない
// 主人公の Lv は「そのダンジョンの はじめの階の 敵の Lv ＋ lvPlus」。仲間は ストーリーで いるはずの人数と顔ぶれ
// 使い方 (koori-dungeon フォルダで): node tools/balance.mjs [回数=12] [lvPlus=3] [ダンジョン id (省略で全部)]
// =====================================================================
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'enemies.js', 'items.js', 'dungeons.js', 'collection.js', 'allies.js', 'enemies9.js', 'enemies10.js', 'enemies11.js', 'town.js', 'art.js', 'bigart.js', 'enemyart.js', 'enemyart9.js', 'enemyart10.js', 'enemyart11.js', 'sound.js', 'config.js', 'market.js', 'townui.js', 'motion.js', 'game.js']) {
    vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
}
const { Units: U, Dungeons: DG, Dungeon: D, Items: I } = globalThis.KD;

const HERO = process.env.HERO === 'onioni' ? 'onioni' : 'koori';
const [RUNS = 12, LV_PLUS = 3, ONLY = null] = process.argv.slice(2).map((v, i) => (i < 2 ? Number(v) : v));
const noop = () => {};
const ctx = new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }) }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
// ストーリーで いるはずの仲間 (ダンジョンの番号ごと)
const PARTY = [['onioni'], ['onioni', 'yasu'], ['onioni', 'yasu', 'dake'], ['onioni', 'yasu', 'dake'], ['onioni', 'yasu', 'dake', 'tamu'], ['onioni', 'yasu', 'dake', 'tamu'], ['onioni', 'yasu', 'dake', 'tamu']];
const DIRS8 = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

function play(d, index, seed, from = 1, to = d.floors) {
    const asks = [];
    const ui = { ask: (message, options, done) => asks.push({ message, options, done }), asking: () => asks.length > 0 };
    const game = KD.createGame({ getContext: () => ctx }, ui, { seed, partner: false, recruit: false, start: 'dungeon', dungeon: d.id, save: false, market: false, happen: false });
    let reached = false;
    const s = game.state;
    asks.shift().done(HERO === 'onioni' ? 1 : 0);   // 主人公 (HERO=onioni で おにおに)
    const lv = Math.max(1, DG.levelFor(d, from) + LV_PLUS);
    const p = s.player;
    p.lv = lv;
    p.stats = U.heroStats(HERO, lv, p.role);
    U.learnedBetween(HERO, 1, lv).forEach(id => { if (!p.skills.some(k => k.id === id) && p.skills.length < U.MAX_SKILLS) p.skills.push(U.newSkill(id)); });
    p.hp = p.stats.hp;
    p.bag = [{ id: 'onigiri', n: 1 }, { id: 'big_onigiri', n: 1 }, { id: 'revive_seed', n: 1 },
        ...Array.from({ length: 2 + Math.floor((to - from + 1) / 5) }, () => ({ id: 'ice_shard', n: 1 }))];
    const max = DG.partyMax(index) - 1;
    s.allies = (index < 0 ? PARTY[6] : PARTY[index]).map(k => (k === 'onioni' && HERO === 'onioni' ? 'koori' : k)).slice(0, max).map(k => game.makeAlly(k, lv));
    const tick = ms => { for (let i = 0; i < ms; i += 32) { fakeNow += 32; game.draw(fakeNow); } };
    tick(1500);
    if (from > 1) { game.startDungeon(d.id, from); tick(1500); }
    let turns = 0, guard = 0;
    while (!s.over && !s.done && guard++ < 8000) {
        if (to < d.floors && s.floor > to) { reached = true; break; }   // ドタバタ大迷宮: 次の休憩の階を こえた
        // 聞かれたら: 降りる・はい / 仲間・わざは 断る
        if (asks.length) {
            const q = asks.shift();
            const yes = q.options.findIndex(o => o === 'はい' || o === 'つぎへ' || o === '先へ進む');
            if (/休憩の階/.test(q.message) && s.floor >= to && to < d.floors) { reached = true; break; }
            const no = q.options.findIndex(o => /いいえ|覚えない|入れかえない|やめる/.test(o));
            q.done(/仲間になりたそう|覚え|入れかえ/.test(q.message) ? (no >= 0 ? no : q.options.length - 1) : yes >= 0 ? yes : 0);
            tick(300);
            continue;
        }
        if (game.busy()) { tick(100); continue; }
        if (s.phase !== 'play') break;
        turns++;
        // 回復: HP 4 割を切ったら 氷のかけら / おなかが減ったら おにぎり (道具の画面を通す)
        const useItem = id => {
            const i = p.bag.findIndex(it => it.id === id);
            if (i < 0) return false;
            game.itemMenu();
            const q = asks.shift();
            if (!q) return false;
            q.done(i);
            const q2 = asks.shift();
            if (q2) q2.done(Math.max(0, q2.options.findIndex(o => /食べる|使う/.test(o))));
            tick(600);
            return true;
        };
        if (p.hp < p.stats.hp * 0.4 && useItem('ice_shard')) continue;
        if (p.belly < 15 && (useItem('onigiri') || useItem('big_onigiri'))) continue;
        // となりの敵: 戦う (強いわざが使えたら わざ)
        const adj = s.enemies.filter(e => e.hp > 0 && Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) === 1 && D.canReach(s.map, p.x, p.y, e.x - p.x, e.y - p.y));
        if (adj.length) {
            const e = adj.reduce((a, b) => (b.hp < a.hp ? b : a));
            game.moveInput(e.x - p.x, e.y - p.y, { turnOnly: true });
            const sk = p.skills.map((k, i) => ({ k, i, m: U.SKILLS[k.id] })).filter(x => x.k.pp > 0 && x.m.power > 0 && x.m.range !== 'self' && !x.m.role)
                .sort((a, b) => b.m.power - a.m.power)[0];
            if (sk && Math.random() < 0.5) game.useSkill(sk.i);
            else game.attack();
            tick(400);
            continue;
        }
        // 階段へ (全部の地図を知っている)。いちばん下の階は ボスが階段の近く
        const { stairs } = s.map;
        if (p.x === stairs.x && p.y === stairs.y) {
            game.confirm();
            tick(300);
            if (!asks.length) { game.wait(); tick(300); }
            continue;
        }
        // 溶岩は なるべく 通らない (通らないと 行けないときだけ 通る)
        const route = avoidLava => {
            const dist = new Int16Array(s.map.w * s.map.h).fill(-1);
            const q = [[stairs.x, stairs.y]];
            dist[stairs.y * s.map.w + stairs.x] = 0;
            for (let i = 0; i < q.length; i++) {
                const [x, y] = q[i];
                for (const [dx, dy] of DIRS8) {
                    const nx = x + dx, ny = y + dy;
                    if (!D.canMove(s.map, x, y, dx, dy) || dist[ny * s.map.w + nx] >= 0) continue;
                    if (avoidLava && D.at(s.map, nx, ny) === D.LAVA && !(nx === p.x && ny === p.y)) continue;
                    dist[ny * s.map.w + nx] = dist[y * s.map.w + x] + 1;
                    q.push([nx, ny]);
                }
            }
            return dist;
        };
        let dist = route(true);
        if (dist[p.y * s.map.w + p.x] < 0) dist = route(false);
        const here = dist[p.y * s.map.w + p.x];
        const next = DIRS8.filter(([dx, dy]) => D.canMove(s.map, p.x, p.y, dx, dy) && dist[(p.y + dy) * s.map.w + p.x + dx] >= 0 && dist[(p.y + dy) * s.map.w + p.x + dx] < here
            && !s.enemies.some(e => e.x === p.x + dx && e.y === p.y + dy));
        if (next.length) game.moveInput(next[0][0], next[0][1]);
        else game.wait();
        tick(250);
    }
    if (process.env.WHY && s.over) console.log(`  B${s.floor}F: ${s.messages.map(m => m.text).join(' / ')}`);
    return { clear: reached || (Boolean(s.done) && !s.over), floor: s.floor, turns, lv };
}

const list = ONLY ? [DG.byId(ONLY)] : [...DG.LIST, DG.BONUS];
console.log(`バランスの確認: 主人公 ${U.HEROES[HERO].name}・各 ${RUNS} 回・主人公の Lv = はじめの敵の Lv ＋ ${LV_PLUS}（仲間は ストーリーで いるはずの人数）`);
console.log('ダンジョン            階   Lv  突破    倒れた階 (平均)  ターン (突破したとき)');
for (const d of list) {
    if (!d) continue;
    // ドタバタ大迷宮: 休憩の階から 10 階ずつ
    if (d.bonus) {
        for (let from = 1; from < d.floors; from += from === 1 ? 9 : 10) {
            const to = Math.min(d.floors, from === 1 ? 10 : from + 10);
            const rs = [];
            for (let i = 0; i < RUNS; i++) rs.push(play(d, -1, 2000 + i * 97 + from, from, to));
            const ok = rs.filter(r => r.clear).length;
            console.log(`${d.name} B${from}F→B${to}F`.padEnd(22) + `  ${String(rs[0].lv).padStart(3)}  ${String(Math.round(ok / rs.length * 100)).padStart(3)}%`);
        }
        continue;
    }
    const index = DG.LIST.indexOf(d);
    const rs = [];
    for (let i = 0; i < RUNS; i++) rs.push(play(d, index, 1000 + i * 97));
    const clears = rs.filter(r => r.clear);
    const downs = rs.filter(r => !r.clear);
    const avg = a => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : '-');
    console.log(`${(d.name + '　　　　　　　　').slice(0, 12)}  ${String(d.floors).padStart(3)}  ${String(rs[0].lv).padStart(3)}  ${String(Math.round(clears.length / rs.length * 100)).padStart(3)}%   ${String(avg(downs.map(r => r.floor))).padStart(6)}            ${avg(clears.map(r => r.turns))}`);
}
void I;
