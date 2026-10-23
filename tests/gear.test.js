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

// 町から 始める (はじめから → オープニングを 飛ばす)
function townGame() {
    store.clear();
    const asks = [];
    const ui = { ask: (message, options, done, extra) => asks.push({ message, options, done, extra }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: () => ctx }, ui, { seed: 321, things: false, recruit: false, unlockAll: true, market: false, happen: false });
    const run = ms => { for (let i = 0; i < ms; i += 16) { fakeNow += 16; game.draw(fakeNow); } };
    const choose = label => {
        const q = asks.shift();
        assert.ok(q, `「${label}」をえらぶ画面がない`);
        const i = q.options.findIndex(o => o.startsWith(label) || o.includes(label));
        assert.ok(i >= 0, `「${label}」がない: ${q.options.join(' / ')}`);
        q.done(i);
    };
    choose('はじめから');
    choose('こおりくん');
    for (let i = 0; i < 5; i++) choose('つぎへ');
    return { game, s: game.state, asks, choose, run };
}

test('操作している 仲間が たおれると、ターンを 使わずに 次の キャラを 自動で 操作する', () => {
    const { game, s, run, asks } = setup({ partner: true });
    const hero = s.player, oni = s.allies[0];
    const extra = game.makeAlly('haribaby', 1);
    s.allies.push(extra);
    game.switchTo(oni);
    const e = game.makeEnemy('haribaby', 1, 0, 0);
    Object.assign(e, { awake: true, hp: 99999 });
    e.stats.hp = 99999;
    e.stats.atk = 9999;
    s.enemies.length = 0;
    s.enemies.push(e);
    let turnAt = -1;
    for (let i = 0; i < 40 && s.player === oni; i++) {
        // 敵を おにおにの となり (歩けるマス) に 置きなおす
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([x, y]) => D.walkable(s.map, oni.x + x, oni.y + y) && !s.allies.some(a => a.x === oni.x + x && a.y === oni.y + y));
        e.x = e.fx = oni.x + dx;
        e.y = e.fy = oni.y + dy;
        hero.hp = hero.stats.hp;
        game.wait();
        run(800);
        turnAt = s.turn;
        while (asks.length) asks.shift().done(0);
    }
    assert.notEqual(s.player, oni, '操作が かわった');
    assert.ok(s.player.hp > 0, '生きている キャラを 操作する');
    assert.ok(s.fallen.includes(oni) && !s.allies.includes(oni), 'たおれた 仲間は 列から はずれる');
    assert.ok(s.messages.some(m => /おにおにが たおれた！ .+を 操作する/.test(m.text)));
    run(800);
    assert.equal(s.turn, turnAt, '交代で ターンは すすまない');
});

test('主人公が たおれても 生きている キャラが いれば 続く。みんな たおれたら 町へ (主人公の 操作に もどり、全回復)', () => {
    const { game, s, asks, choose, run } = townGame();
    choose('ダンジョンへ');
    choose('ハリーの森');
    if (asks[0] && asks[0].options.includes('スキップ')) choose('スキップ');
    run(1500);
    asks.length = 0;
    const hero = game.heroUnit(), oni = s.allies[0];
    hero.bag.length = 0;
    oni.skills[0].pp = 0;
    const e = game.makeEnemy('haribaby', 1, 0, 0);
    Object.assign(e, { awake: true, hp: 99999 });
    e.stats.hp = 99999;
    e.stats.atk = 9999;
    s.enemies.length = 0;
    s.enemies.push(e);
    // 敵を victim の となりに 置いて、たおれるまで ターンを すすめる
    const beat = (victim, until) => {
        for (let i = 0; i < 40 && !until() && s.map && !s.over; i++) {
            const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([x, y]) => D.walkable(s.map, victim.x + x, victim.y + y) && !s.allies.concat(s.player).some(a => a.x === victim.x + x && a.y === victim.y + y));
            e.x = e.fx = victim.x + dx;
            e.y = e.fy = victim.y + dy;
            if (!game.busy()) game.wait();
            run(600);
            while (asks.length) asks.shift().done(0);
        }
    };
    // 1. 主人公 (操作している) が たおれる → おにおにを 操作して 続く (おにおには たおれないように)
    oni.hp = 1e9;
    beat(hero, () => hero.hp <= 0);
    run(600);
    assert.equal(s.phase, 'play', '失敗に ならない');
    assert.equal(s.over, false);
    assert.equal(s.player, oni, 'おにおにを 操作する');
    assert.ok(s.fallen.includes(hero) && !s.allies.includes(hero), '主人公は たおれた 列へ');
    assert.ok(s.messages.some(m => /こおりくんが たおれた！ おにおにを 操作する/.test(m.text)));
    assert.equal(oni.bag, hero.bag, '道具袋は そのまま 使える');
    // 2. おにおにも たおれる → みんな たおれたので 町へ
    oni.hp = 1;
    beat(oni, () => s.over);
    run(3000);
    assert.equal(s.phase, 'town', s.messages.slice(-5).map(m => m.text).join(' / '));
    assert.equal(s.player, hero, '主人公の 操作に もどった');
    assert.ok(!s.allies.includes(hero) && !s.fallen.includes(hero), '主人公は 仲間の 列に 残らない');
    assert.ok(s.allies.includes(oni));
    assert.equal(hero.hp, hero.stats.hp, '主人公 全回復');
    assert.equal(oni.hp, oni.stats.hp, '仲間 全回復');
    assert.equal(oni.skills[0].pp, oni.skills[0].max, 'PP も');
});

test('主人公が たおれて 仲間で 続けているときも、中断の 続きから 遊べる', () => {
    const { game, s } = setup({ partner: true });
    const hero = s.player, oni = s.allies[0];
    game.switchTo(oni);
    s.allies.splice(s.allies.indexOf(hero), 1);
    hero.hp = 0;
    s.fallen.push(hero);
    const snap = game.snapshot();
    assert.ok(snap.fallen.some(d => d.hero));
    // 読み込みと 同じ: セーブから 作った 主人公を 操作している ところへ 続きを 入れる
    s.player = hero;
    s.allies = [];
    s.fallen = [];
    game.resumeSnap(snap);
    assert.equal(game.heroUnit(), hero, '主人公は 同じ もの (道具袋など)');
    assert.ok(s.fallen.includes(hero));
    assert.equal(s.player.kind, 'onioni');
});

test('広場: 主人公と 仲間の ステータス・装備を 見られ、町でも 装備を つけ外し できる', () => {
    const { game, s, asks, choose, run } = townGame();
    const hero = s.player;
    hero.bag.push({ id: 'power_band', n: 1 });
    const atk = hero.stats.atk;
    choose('仲間の広場');
    choose('（主人公）の ステータス・装備');
    assert.match(asks[0].message, /こおりくんの 装備欄：なし/);
    run(50);   // ステータスを 描いても こわれない
    choose('つける：ちからのハチマキ');
    assert.equal(hero.gear.id, 'power_band');
    assert.equal(hero.stats.atk, atk + 4);
    assert.ok(!hero.bag.some(it => it.id === 'power_band'));
    choose('はずす');
    assert.equal(hero.gear, null);
    assert.ok(hero.bag.some(it => it.id === 'power_band'));
    choose('もどる');
    // 仲間 (おにおに)
    choose('おにおに');
    choose('ステータス・装備');
    const oni = s.allies[0];
    choose('つける：ちからのハチマキ');
    assert.equal(oni.gear.id, 'power_band');
    // 持ち物が いっぱいで はずすと 倉庫へ
    while (hero.bag.length < I.BAG_MAX) hero.bag.push({ id: 'onigiri', n: 1 });
    choose('はずす');
    assert.equal(oni.gear, null);
    assert.ok(s.town.storage.some(it => it.id === 'power_band'), '倉庫に 入った');
    choose('もどる');
    choose('もどる');
    assert.match(asks[0].message, /おにおに/, '仲間の 画面に もどる');
});

test('バトルツリー: 奥義の 先に 5 マス・外の 輪 5 マス。のばした わざは どの 役職でも 使える', () => {
    const TW = globalThis.KD.Town, U = globalThis.KD.Units;
    for (const hero of ['koori', 'onioni']) {
        const nodes = TW.treeNodes(hero);
        assert.equal(nodes.length, 1 + 5 * 10 + 5 + 5, 'まんなか + 枝 10 マス × 5 + 間 5 + 外の 輪 5');
        nodes.forEach(n => {
            assert.ok(n.req.every(r => nodes.some(m => m.id === r)), `${n.id} の 前の マスが ある`);
            if (n.type === 'skill') assert.ok(U.SKILLS[n.skill], `${n.id} の わざ ${n.skill}`);
        });
        assert.ok(nodes.filter(n => n.free).every(n => !U.SKILLS[n.skill].role), 'のばした わざは 役職に しばられない');
    }
    const nodes = TW.treeNodes('koori');
    // 奥義を 開放していないと 6 マスめは 開放できない。開放すると 7 マスめ (わざ) が 役職に 関係なく 使える
    const tree = [...TW.TREE_START, 'healer1', 'healer2', 'healer3', 'healer4', 'healer5'];
    assert.equal(TW.canUnlock(nodes.find(n => n.id === 'healer6'), tree.slice(0, -1)), false);
    assert.equal(TW.canUnlock(nodes.find(n => n.id === 'healer6'), tree), true);
    assert.equal(TW.canUnlock(nodes.find(n => n.id === 'o1'), tree), false, '外の 輪は 6 マスめから');
    tree.push('healer6', 'healer7');
    assert.equal(TW.canUnlock(nodes.find(n => n.id === 'o1'), tree), true);
    assert.ok(TW.treeSkills('koori', tree, 'attacker').includes('megumi'), 'アタッカーでも めぐみのあめ');
    assert.ok(!TW.treeSkills('koori', tree, 'attacker').includes('heal'), '役職の わざは その 役職だけ');
    const before = TW.treeStats('koori', [...TW.TREE_START]).hp;
    assert.equal(TW.treeStats('koori', tree).hp - before, 6 + 6 + 10, 'のばした 能力アップも 入る');
});

test('ストーリーを クリアした 主人公だけ わざを 6 つまで 覚えられる (仲間は 4 つ)', () => {
    const { game, s, run, choose, asks } = setup({ partner: true });
    const p = s.player;
    assert.equal(game.maxSkills(p), 4);
    s.town = { storyEnd: true };
    assert.equal(game.maxSkills(p), 6);
    assert.equal(game.maxSkills(s.allies[0]), 4, 'おにおに (仲間) は 4 つ');
    p.skills = ['koori_sword', 'koori_breath', 'renzoku', 'todome'].map(globalThis.KD.Units.newSkill);
    game.learnNow(p, 'mouda');
    game.learnNow(p, 'senpu');
    assert.equal(p.skills.length, 6, '聞かずに 6 つめまで 覚える');
    game.learnNow(p, 'hissatsu');
    assert.match(asks[0].message, /忘れますか/, '7 つめは 聞く');
    choose('ひっさつのいちげきを 覚えない');
    // 5・6 つめの わざも 使える
    game.useSkill(5);
    run(800);
    assert.ok(s.messages.some(m => /せんぷうぎり/.test(m.text)));
    assert.equal(game.skills().length, 6, 'ボタンも 6 つ');
});
