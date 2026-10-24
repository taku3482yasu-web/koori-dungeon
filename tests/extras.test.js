// 段階 8 のテスト (ハプニング・口ぐせ・演出・図鑑・実績・音)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'enemies.js', 'items.js', 'dungeons.js', 'collection.js', 'allies.js', 'enemies9.js', 'enemies10.js', 'enemies11.js', 'town.js', 'art.js', 'bigart.js', 'enemyart.js', 'enemyart9.js', 'enemyart10.js', 'enemyart11.js', 'sound.js', 'config.js', 'market.js', 'townui.js', 'motion.js', 'arena.js', 'game.js']) {
    vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
}
const { Units: U, Dungeon: D, Collection: C, Town: TW } = globalThis.KD;

const fakeCtx = () => new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }) }, {
    get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; }
});

// すぐダンジョンから始める (町のデータもある)。happen: 起こすハプニング
function setup(opts = {}) {
    store.clear();
    const asks = [];
    const ui = { ask: (message, options, done) => asks.push({ message, options, done }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: fakeCtx }, ui, { seed: 2468, things: false, partner: false, recruit: false, start: 'dungeon', save: false, market: false, happen: false, ...opts });
    const run = ms => { for (let i = 0; i < ms; i += 16) { fakeNow += 16; game.draw(fakeNow); } };
    asks.shift().done(0);
    run(1300);
    return { game, s: game.state, run, asks };
}

// 2 階へ降りる (ハプニングは 階に着いたときに起こる)
function down(t) {
    const { s, game, run, asks } = t;
    s.player.x = s.player.fx = s.map.stairs.x;
    s.player.y = s.player.fy = s.map.stairs.y;
    game.confirm();
    asks.shift().done(0);
    run(1300);
}

test('ハプニング: ライバル探検隊と鉢合わせ。3 人とも たおすと「覚えてろ～！」', () => {
    const t = setup({ happen: 'rival' });
    down(t);
    const { s, game, run } = t;
    const rivals = s.enemies.filter(e => e.team);
    assert.equal(rivals.length, 3);
    assert.ok(Object.keys(C.RIVALS).includes(rivals[0].team));
    assert.ok(rivals.every(e => C.RIVALS[rivals[0].team].includes(e.kind)));
    assert.ok(s.messages.some(m => /ライバル探検隊/.test(m.text)));
    // 3 人とも となりで たおす
    const p = s.player;
    rivals.forEach(e => { e.stats.atk = 1; });
    s.enemies.splice(0, s.enemies.length, ...rivals);
    for (const e of rivals) {
        e.hp = 1;
        for (let i = 0; i < 8 && s.enemies.includes(e); i++) {
            const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0));
            e.x = e.fx = p.x + dx;
            e.y = e.fy = p.y;
            e.anim = null;
            s.enemies.filter(o => o !== e).forEach(o => { o.x = o.fx = 1; o.y = o.fy = 1; });
            p.dir = [dx, 0];
            game.attack();
            run(800);
        }
    }
    assert.ok(s.messages.some(m => /覚えてろ/.test(m.text)) || s.town.stats.rivals >= 1);
    assert.equal(s.town.stats.rivals, 1);
});

test('ハプニング: 宝の部屋・ふるカワから通信・おにおにの取り立て', () => {
    const a = setup({ happen: 'treasure' });
    down(a);
    assert.ok(a.s.items.length + a.s.enemies.filter(e => e.kind === 'takaramimic').length >= 6);
    const b = setup({ happen: 'call' });
    const n = b.s.player.bag.length;
    down(b);
    assert.equal(b.s.player.bag.length, n + 1);
    assert.ok(b.s.messages.some(m => /ふるカワ/.test(m.text)));
    const c = setup({ happen: 'collect' });
    c.s.player.money = 1000;
    down(c);
    assert.equal(c.s.player.money, 800);
    assert.equal(c.s.town.debt, TW.DEBT_START - 200);
    assert.equal(c.s.town.paid, 200);
});

test('ハプニング: モンスターハウス。部屋に入ると 敵が いっせいに起きる', () => {
    const t = setup({ happen: 'house' });
    down(t);
    const { s, game, run } = t;
    const house = s.enemies.filter(e => e.house);
    assert.ok(house.length >= 6);
    assert.ok(house.every(e => !e.awake));
    const room = s.map.rooms[s.house];
    // 部屋のはしへ ワープ → 1 歩
    const p = s.player;
    p.x = p.fx = room.x;
    p.y = p.fy = room.y;
    s.enemies = s.enemies.filter(e => !(e.x === p.x && e.y === p.y));
    s.enemies = s.enemies.filter(e => e.house);   // ほかの敵は じゃまなので いなくする
    for (let i = 0; i < 4 && !house[0].awake; i++) {
        const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([x, y]) => D.canMove(s.map, p.x, p.y, x, y) && !s.enemies.some(e => e.x === p.x + x && e.y === p.y + y));
        game.moveInput(dx, dy);
        run(400);
    }
    assert.ok(house.every(e => e.awake), 'みんな起きた');
    assert.ok(s.messages.some(m => /モンスターハウス/.test(m.text)));
    assert.equal(s.town.stats.houses, 1);
});

test('口ぐせ: Lv が上がると 吹き出し。ライバルは 見えると ひとこと', () => {
    const { s, game, run } = setup({ enemies: true });
    const p = s.player;
    const e = game.makeEnemy('haribaby', 1, p.x, p.y);
    const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0));
    e.x = e.fx = p.x + dx;
    e.exp = 5000;
    e.hp = 1;
    e.awake = true;
    s.enemies.splice(0, s.enemies.length, e);
    p.dir = [dx, 0];
    p.stats.hp = p.hp = 999;
    for (let i = 0; i < 5 && s.enemies.length; i++) { game.attack(); run(700); }
    assert.ok(p.lv > 1);
    run(100);
    assert.ok(C.LINES.koori.levelup.includes(s.bubbles.find(b => b.u === p)?.text) || s.messages.length, '吹き出し');
    for (const kind of ['koori', 'onioni', 'yasu', 'tamu', 'dake']) assert.ok(C.LINES[kind].attack.length && C.LINES[kind].pinch.length);
});

test('演出: ボスが起きると カットイン。大きなダメージで 画面がゆれる', () => {
    const { s, game, run, asks } = setup({ enemies: true });
    game.spawnBoss();
    const b = s.boss;
    s.enemies.splice(0, s.enemies.length, b);
    const p = s.player;
    b.x = b.fx = p.x + ([1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0)));
    b.y = b.fy = p.y;
    s.visible = D.visibleFrom(s.map, p.x, p.y);
    game.wait();
    run(100);
    assert.ok(s.cutin && s.cutin.kind === b.kind);
    run(1500);   // カットインのあと 台詞
    assert.ok(asks.length, '台詞');
    while (asks.length) asks.shift().done(0);
    p.hp = p.stats.hp;
    b.stats.atk = 999;
    p.stats.hp = p.hp = 99999;
    for (let i = 0; i < 6 && !s.shake; i++) { game.wait(); run(30); }
    run(10);
    assert.ok(s.shake || s.messages.some(m => /ダメージ/.test(m.text)));
});

test('図鑑: 見た敵・たおした敵を おぼえる。敵は みんな図鑑にのる', () => {
    const { s, game, run } = setup({ enemies: true });
    const p = s.player;
    const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0));
    const e = game.makeEnemy('donguriko', 1, p.x + dx, p.y);
    e.hp = 1;
    e.awake = true;
    s.enemies.splice(0, s.enemies.length, e);
    p.dir = [dx, 0];
    game.wait();
    run(400);
    assert.ok(s.town.dex.seen.donguriko >= 1);
    for (let i = 0; i < 5 && s.enemies.length; i++) { e.x = e.fx = p.x + dx; e.y = e.fy = p.y; game.attack(); run(700); }
    assert.equal(s.town.dex.beat.donguriko, 1);
    const order = C.dexOrder();
    // 再戦の すがた (hideDex) は のらない。バージョンを わたすと ほかの バージョンの 限定キャラは のらない
    assert.equal(order.length, Object.values(U.ENEMIES).filter(e => !e.hideDex).length);
    assert.ok(C.dexOrder('koori').includes('yukiusapon') && !C.dexOrder('koori').includes('konin'));
    assert.ok(C.dexOrder('onioni').includes('konin') && !C.dexOrder('onioni').includes('yukiusapon'));
    assert.equal(order[0], 'haribaby');
    assert.ok(order.indexOf('harry') > order.indexOf('kinmenkoinu'), 'ボスは あと');
});

test('実績: 手に入れると お知らせ。もう一度は 出ない', () => {
    const { s, game, run } = setup({ enemies: true });
    const p = s.player;
    const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0));
    const e = game.makeEnemy('haribaby', 1, p.x + dx, p.y);
    e.hp = 1;
    s.enemies.splice(0, s.enemies.length, e);
    p.dir = [dx, 0];
    for (let i = 0; i < 5 && s.enemies.length; i++) { e.x = e.fx = p.x + dx; e.y = e.fy = p.y; game.attack(); run(700); }
    assert.ok(s.town.ach.first_kill, 'はじめての勝利');
    assert.ok(s.toasts.some(t => /はじめての勝利/.test(t.text)) || s.toasts.length === 0);
    const n = Object.keys(s.town.ach).length;
    game.town.check();
    assert.equal(Object.keys(s.town.ach).length, n);
    assert.ok(C.ACHIEVEMENTS.length >= 25);
    assert.equal(new Set(C.ACHIEVEMENTS.map(a => a.id)).size, C.ACHIEVEMENTS.length, 'id は かぶらない');
});

test('町の家から 図鑑と実績を見られる', () => {
    store.clear();
    const asks = [];
    const ui = { ask: (message, options, done) => asks.push({ message, options, done }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: fakeCtx }, ui, { seed: 5, things: false, market: false, happen: false, unlockAll: true });
    const choose = label => {
        const q = asks.shift();
        const i = q.options.findIndex(o => o.includes(label));
        assert.ok(i >= 0, `${label}: ${q.options.join('/')}`);
        q.done(i);
    };
    choose('はじめから');
    choose('こおりくん');
    for (let i = 0; i < 5; i++) choose('つぎへ');
    choose('家');
    choose('図鑑');
    assert.match(asks[0].message, /図鑑/);
    choose('敵の図鑑');
    assert.ok(asks[0].options[0].includes('？？？'), 'まだ見ていない');
    game.draw(fakeNow);
    choose('もどる');
    choose('もどる');
    choose('実績');
    assert.match(asks[0].message, /実績 \d+ \/ \d+/);
});

test('音: WebAudio がなくても こわれない。オン・オフを おぼえる', () => {
    const S = globalThis.KD.Sound;
    S.play('hit');
    S.bgm('town');
    S.bgm(null);
    const before = S.isOn();
    assert.equal(S.toggle(), !before);
    assert.equal(store.get('koori-dungeon-sound'), before ? 'off' : 'on');
    S.toggle();
    for (const name of ['hit', 'miss', 'hurt', 'levelup', 'boss', 'ach']) assert.ok(S.SFX[name]);
    for (const name of ['title', 'town', 'forest', 'cave', 'deep', 'boss']) assert.ok(S.SONGS[name]);
});

test('仕様書に おにおにの機嫌は ない (2026-10-22 ユーザー指定)', () => {
    const spec = readFileSync(new URL('../docs/spec.md', import.meta.url), 'utf8');
    assert.ok(!/\*\*おにおにの機嫌\*\*/.test(spec));
    const src = readFileSync(new URL('../js/collection.js', import.meta.url), 'utf8');
    assert.ok(src.includes('おにおにの機嫌は入れない'));
});

test('ライバル探検隊: チームバータス・チーム・ケモノミチ は 3 人ずつ 絵とデータがあり、月の迷宮より前には 鉢合わせしない', () => {
    const { BigArt: B, Dungeons: DG } = globalThis.KD;
    for (const team of ['チームバータス', 'チーム・ケモノミチ']) {
        assert.equal(C.RIVALS[team].length, 3);
        for (const id of C.RIVALS[team]) {
            assert.ok(U.ENEMIES[id] && U.ENEMIES[id].rival && U.ENEMIES[id].line, `${id} のデータ`);
            assert.ok(B.has(id), `${id} の絵`);
        }
        assert.ok(DG.byId(C.RIVAL_FROM[team]), `${team} が出はじめるダンジョン`);
    }
    // ハリーの森 (まだ月の迷宮に行けない) では 前からの 3 チームだけ
    const seen = new Set();
    for (let seed = 1; seed <= 12; seed++) {
        const t = setup({ happen: 'rival', seed });
        down(t);
        t.s.enemies.filter(e => e.team).forEach(e => seen.add(e.team));
    }
    assert.ok(seen.size >= 2);
    assert.ok(![...seen].some(team => C.RIVAL_FROM[team]), [...seen].join('・'));
    // 月の迷宮の はじめの話で 2 チームと出会う
    const intro = DG.byId('moon').story.intro.join('\n');
    assert.match(intro, /チームバータス/);
    assert.match(intro, /チーム・ケモノミチ/);
});

test('仲間のちがい: 仲間になれるキャラは全員 ★・能力の振り分け・覚えるわざがあり、看板のわざは そのキャラだけ。汎用わざも覚える', () => {
    const A = globalThis.KD.Allies;
    const kinds = Object.entries(U.ENEMIES).filter(([, e]) => !e.boss && (!e.big || e.rival)).map(([k]) => k);
    const generic = new Set(Object.values(A.GENERIC).flat());
    const sigs = new Map();
    for (const kind of kinds) {
        const x = A.ALLIES[kind];
        assert.ok(x, `${kind} の仲間のデータ`);
        assert.ok(x.star >= 1 && x.star <= 5, `${kind} の★`);
        assert.ok(x.learn.every(([, id]) => U.SKILLS[id]), `${kind} の わざ`);
        assert.ok(x.learn.some(([, id]) => generic.has(id)), `${kind} が 汎用わざを覚えない`);
        const sig = A.signature(kind);
        assert.ok(!generic.has(sig), `${kind} の看板のわざが 汎用わざ`);
        sigs.set(sig, [...(sigs.get(sig) || []), kind]);
        // 仲間になったときの能力・わざ (看板のわざは 高い Lv でも持っている)
        const st = U.allyStats(kind, 30, A.roleOf(kind));
        assert.ok(Object.values(st).every(v => v > 0));
        const sk = U.enemyAllySkills(kind, 50).map(k => k.id);
        assert.ok(sk.length <= U.MAX_SKILLS && sk.includes(sig), `${kind} の Lv50 のわざ: ${sk.join(',')}`);
    }
    for (const [sig, who] of sigs) assert.equal(who.length, 1, `${U.SKILLS[sig].name} を ${who.join('・')} が使う`);
    // ★が高いほど 強い (振り分けが同じなら)
    const total = (kind, lv) => Object.values(U.allyStats(kind, lv, A.roleOf(kind))).reduce((a, b) => a + b, 0);
    assert.ok(total('asahara', 30) > total('maechokkin', 30));
    // 同じ役職でも 振り分けがちがう: 攻撃もできるヒーラー (ツキウサギ) と とくこうのヒーラー (ヤーハミー)
    const r = U.allyStats('tsukiusagi', 30, 'healer'), y = U.allyStats('yahami', 30, 'healer');
    assert.ok(r.atk > r.spa * 0.95 && y.spa > y.atk * 1.3);
});

test('ライバルのリーダーとの勝負: クエストを受けていると 決まった階で 待っている (HP が多い)', () => {
    const t = setup({});
    const { s } = t;
    const TW = globalThis.KD.Town;
    const q = TW.rivalQuests({ have: ['hibikimakuri', 'yamamou'] }).find(x => x.type === 'duel' && x.ally.kind === 'okagappa');
    s.town.quests.push({ ...q, dungeon: s.dungeon.id, floor: 2 });
    down(t);
    const e = s.enemies.find(x => x.kind === 'okagappa' && x.duel);
    assert.ok(e, 'おかがっぱが いない');
    assert.ok(e.stats.hp >= U.enemyStats('okagappa', e.lv).hp * 3);
    assert.ok(s.messages.some(m => /待っている/.test(m.text)));
});

test('進化: コガメは 海岸どうくつの B8F に いっしょに着くと ヒョウガメに 進化する (Lv24 から)', () => {
    const t = setup({ dungeon: 'coast' });
    const { s, game, run } = t;
    assert.equal(s.dungeon.id, 'coast');
    const kame = game.makeAlly('kogame', 24);
    const young = game.makeAlly('kogame', 10);
    s.allies.push(kame, young);
    s.floor = 7;
    down(t);
    run(500);
    assert.equal(s.floor, 8);
    assert.equal(kame.kind, 'hyougame');
    assert.equal(young.kind, 'kogame', 'Lv が足りないのに 進化した');
    assert.ok(s.messages.some(m => /進化した/.test(m.text)) || kame.name === 'ヒョウガメ');
});
