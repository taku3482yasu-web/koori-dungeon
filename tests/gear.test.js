// 2026-10-23 の追加のテスト (壁の中・水の上の敵に 攻撃が 当たる・水を 通れるキャラ・キャラごとの 装備欄・ステータス画面・図鑑)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'enemies.js', 'items.js', 'dungeons.js', 'collection.js', 'allies.js', 'enemies9.js', 'enemies10.js', 'enemies11.js', 'town.js', 'art.js', 'bigart.js', 'enemyart.js', 'enemyart9.js', 'enemyart10.js', 'enemyart11.js', 'sound.js', 'config.js', 'market.js', 'specials.js', 'profiles.js', 'townui.js', 'game.js']) vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
const { Dungeon: D, Items: I } = globalThis.KD;

const noop = () => {};
const ctx = new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }) }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });

// すぐ ダンジョンから 始める (敵なし)
function setup(opts = {}) {
    const asks = [];
    const ui = { ask: (message, options, done, extra) => asks.push({ message, options, done, extra }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: () => ctx }, ui, { seed: 12345, things: false, partner: false, recruit: false, start: 'dungeon', save: false, market: false, happen: false, enemies: false, ...opts });
    const run = ms => { for (let i = 0; i < ms; i += 16) { fakeNow += 16; game.draw(fakeNow); } };
    const choose = label => {
        const q = asks.shift();
        assert.ok(q, `「${label}」をえらぶ画面がない`);
        const i = typeof label === 'number' ? label : q.options.findIndex(o => o.startsWith(label) || o.includes(label));
        assert.ok(i >= 0, `「${label}」がない: ${q.options.join(' / ')}`);
        q.done(i);
    };
    choose(0);   // こおりくん
    run(1300);
    return { game, s: game.state, run, asks, choose };
}

// 主人公の 右か左の となりを tile に して、そこに 敵を 置く
function enemyOn(game, s, kind, tile) {
    const p = s.player;
    const dx = [1, -1].find(d => D.walkable(s.map, p.x + d, p.y));
    s.map.tiles[p.y * s.map.w + p.x + dx] = tile;
    const e = game.makeEnemy(kind, 1, p.x + dx, p.y);
    e.awake = true;
    e.stats.hp = e.hp = 999;
    s.enemies.length = 0;
    s.enemies.push(e);
    p.dir = [dx, 0];
    return e;
}

test('壁の中の敵 (壁を通る敵) にも 水の上の敵にも ふつうの攻撃が 当たる', () => {
    for (const [kind, tile] of [['wasurekurage', D.WALL], ['kogame', D.WATER]]) {
        const { game, s, run } = setup();
        const e = enemyOn(game, s, kind, tile);
        for (let i = 0; i < 6 && e.hp === 999; i++) {
            game.attack();
            run(800);
        }
        assert.ok(e.hp < 999, `${e.name} (${tile === D.WALL ? '壁' : '水'}) に 当たった`);
    }
});

test('投げた 小石は 水の上を 飛んで 当たる', () => {
    const { game, s, run, choose } = setup();
    const p = s.player;
    const room = s.map.rooms.reduce((a, b) => (b.w > a.w ? b : a));
    p.x = p.fx = room.x;
    p.y = p.fy = room.y;
    s.map.tiles[p.y * s.map.w + p.x + 1] = D.WATER;
    const e = game.makeEnemy('haribaby', 1, p.x + 2, p.y);
    e.awake = true;
    e.stats.hp = e.hp = 999;
    s.enemies.length = 0;
    s.enemies.push(e);
    p.dir = [1, 0];
    p.bag.push({ id: 'pebble', n: 3 });
    game.itemMenu();
    choose('小石');
    choose('投げる');
    run(800);
    assert.ok(e.hp < 999, '当たった');
});

test('水の上は みず・かぜ の キャラだけ 通れる (主人公も 仲間も 敵も)', () => {
    const { game, s, run } = setup();
    const p = s.player;   // こおりくん (こおり)
    const dx = [1, -1].find(d => D.walkable(s.map, p.x + d, p.y));
    s.map.tiles[p.y * s.map.w + p.x + dx] = D.WATER;
    const x0 = p.x;
    game.moveInput(dx, 0);
    run(400);
    assert.equal(p.x, x0, 'こおりくんは 水に 入れない');
    p.element = 'かぜ';
    game.moveInput(dx, 0);
    run(400);
    assert.equal(p.x, x0 + dx, 'かぜの キャラは 水の上を 通れる');
});

test('ワープしても 水・溶岩・壁の 上には 出ない', () => {
    const { game, s, run, choose } = setup();
    const p = s.player;
    // 部屋の床の半分を 水に する
    s.map.rooms.forEach(r => {
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if ((x + y) % 2) s.map.tiles[y * s.map.w + x] = D.WATER;
    });
    for (let i = 0; i < 20; i++) {
        p.bag.push({ id: 'warp_orb', n: 1 });
        game.itemMenu();
        choose('ワープ玉');
        choose('使う');
        run(600);
        assert.equal(D.at(s.map, p.x, p.y), D.FLOOR, '床の上に 出た');
    }
});

test('装備: キャラごとの 装備欄。つけると 持ち物から なくなり、はずすと もどる。いっぱいなら 足元に 置く', () => {
    const { game, s, run, asks, choose } = setup({ partner: true });
    const hero = s.player, oni = s.allies[0];
    hero.bag.push({ id: 'power_band', n: 1 }, { id: 'guard_scarf', n: 1 });
    const atk = hero.stats.atk, oniDef = oni.stats.def;
    // 道具の画面から: ちからのハチマキ → 装備する → こおりくん
    game.itemMenu();
    choose('ちからのハチマキ');
    choose('装備する');
    choose(hero.name);
    run(600);
    assert.equal(hero.gear.id, 'power_band');
    assert.ok(!hero.bag.some(it => it.id === 'power_band'), '持ち物から なくなった');
    assert.equal(hero.stats.atk, atk + 4);
    // 装備コマンドから: おにおに に まもりのスカーフ
    game.equipMenu();
    choose(oni.name);
    choose('つける：まもりのスカーフ');
    run(600);
    assert.equal(oni.gear.id, 'guard_scarf');
    assert.equal(oni.stats.def, oniDef + 4, '仲間の 能力も 上がる');
    assert.equal(hero.stats.atk, atk + 4, '主人公は そのまま');
    // つけかえ: 主人公に まもりのスカーフ を 持たせて つけると、ハチマキは 持ち物へ
    oni.gear = null;
    game.recalc(oni);
    hero.bag.push({ id: 'guard_scarf', n: 1 });
    game.equipMenu();
    choose(hero.name);
    choose('つける：まもりのスカーフ');
    run(600);
    assert.equal(hero.gear.id, 'guard_scarf');
    assert.ok(hero.bag.some(it => it.id === 'power_band'), 'つけていた ハチマキは 持ち物に もどった');
    // はずす (あきがある): 持ち物に もどる
    game.equipMenu();
    choose(hero.name);
    choose('はずす');
    run(600);
    assert.equal(hero.gear, null);
    assert.ok(hero.bag.some(it => it.id === 'guard_scarf'));
    assert.equal(hero.stats.atk, atk);
    // いっぱいのとき: 足元の 近くに 置く
    hero.gear = { id: 'power_band', n: 1 };
    hero.bag.splice(hero.bag.findIndex(it => it.id === 'power_band'), 1);
    while (hero.bag.length < I.BAG_MAX) hero.bag.push({ id: 'onigiri', n: 1 });
    const floorBefore = s.items.length;
    game.equipMenu();
    choose(hero.name);
    choose('はずす');
    run(600);
    assert.equal(hero.gear, null);
    assert.equal(hero.bag.length, I.BAG_MAX);
    assert.equal(s.items.length, floorBefore + 1, '置かれた');
    assert.equal(s.items[s.items.length - 1].item.id, 'power_band');
    assert.equal(asks.length, 0);
});

test('装備は 中断の 続き (階の様子) にも 入る', () => {
    const { game, s } = setup({ partner: true });
    const oni = s.allies[0];
    oni.gear = { id: 'guard_scarf', n: 1 };
    game.recalc(oni);
    const snap = game.snapshot();
    assert.deepEqual(snap.party[1].gear, { id: 'guard_scarf', n: 1 });
});

test('ステータス画面: 一覧で えらんでいる キャラを 上に出し、えらぶと 装備欄を 開く。ターンは すすまない', () => {
    const { game, s, run, asks, choose } = setup({ partner: true });
    const turn = s.turn;
    game.statusMenu();
    assert.match(asks[0].message, /ステータス/);
    assert.equal(asks[0].extra.place, 'bottom');
    assert.equal(s.statusOf, s.player);
    asks[0].extra.onMove(1);
    assert.equal(s.statusOf, s.allies[0]);
    run(50);   // 描いても こわれない
    choose(s.allies[0].name);
    assert.match(asks[0].message, /装備欄：なし/);
    choose('もどる');
    assert.match(asks[0].message, /ステータス/, 'もどると ステータスに もどる');
    choose('もどる');
    run(50);
    assert.equal(s.statusOf, null);
    assert.equal(s.turn, turn);
});

test('前の版の セーブ: 道具袋の「そうび中」の 装備は 主人公の 装備欄に 移る', () => {
    store.clear();
    const start = () => {
        const asks = [];
        const ui = { ask: (message, options, done, extra) => asks.push({ message, options, done, extra }), asking: () => asks.length > 0 };
        const game = globalThis.KD.createGame({ getContext: () => ctx }, ui, { seed: 321, things: false, recruit: false, market: false, happen: false });
        const choose = label => {
            const q = asks.shift();
            const i = q.options.findIndex(o => o.startsWith(label));
            assert.ok(i >= 0, `「${label}」がない: ${q.options.join(' / ')}`);
            q.done(i);
        };
        return { game, asks, choose };
    };
    const first = start();
    first.choose('はじめから');
    first.choose('こおりくん');
    for (let i = 0; i < 5; i++) first.choose('つぎへ');
    const atk = first.game.state.player.stats.atk;
    first.game.state.player.bag.push({ id: 'power_band', n: 1 });
    first.game.town.save();
    const key = [...store.keys()].find(k => k.startsWith('koori-dungeon-save-'));
    const data = JSON.parse(store.get(key));
    data.hero.bag.find(it => it.id === 'power_band').eq = true;   // 前の版の 形
    store.set(key, JSON.stringify(data));
    const again = start();
    again.choose('つづきから');
    const hero = again.game.state.player;
    assert.deepEqual(hero.gear, { id: 'power_band', n: 1 });
    assert.ok(!hero.bag.some(it => it.id === 'power_band'), '持ち物からは なくなる');
    assert.equal(hero.stats.atk, atk + 4, '装備の ぶん 強い');
    // セーブしなおすと 装備欄が 残る
    again.game.town.save();
    assert.deepEqual(JSON.parse(store.get(key)).hero.gear, { id: 'power_band', n: 1 });
});

test('図鑑: キャラを 押しても 前の 画面に もどらず、一覧の まま その キャラを 出す', () => {
    store.clear();
    const asks = [];
    const ui = { ask: (message, options, done, extra) => asks.push({ message, options, done, extra }), asking: () => asks.length > 0 };
    globalThis.KD.createGame({ getContext: () => ctx }, ui, { seed: 321, things: false, recruit: false, unlockAll: true, market: false, happen: false });
    const choose = label => {
        const q = asks.shift();
        const i = typeof label === 'number' ? label : q.options.findIndex(o => o.startsWith(label) || o.includes(label));
        assert.ok(i >= 0, `「${label}」がない: ${q.options.join(' / ')}`);
        q.done(i);
    };
    choose('はじめから');
    choose('こおりくん');
    for (let i = 0; i < 5; i++) choose('つぎへ');
    choose('図鑑');
    choose('敵の図鑑');
    const n = asks[0].options.length;
    choose(3);
    assert.match(asks[0].message, /敵の図鑑/, '一覧の まま');
    assert.equal(asks[0].options.length, n);
    assert.equal(asks[0].extra.index, 3, '押した キャラが えらばれている');
    choose('もどる');
    assert.match(asks[0].message, /図鑑　敵/, '「もどる」で 図鑑の はじめへ');
});
