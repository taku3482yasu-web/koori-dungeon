// ゲームの進行のテスト (主人公・役職をえらぶ・歩く・ダッシュ・階段・最後の階・戦い・わざ・状態異常)
// canvas は何もしない偽物、時間 (performance.now) はテストで進める
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'art.js', 'game.js']) vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
const { Dungeon: D, Units: U } = globalThis.KD;

// opts: createGame に渡す ({ enemies: false } で敵なし)。hero: 0 こおりくん / 1 おにおに。role: 役職の番号
function setup(opts = { enemies: false }, hero = 0, role = 0) {
    const noop = () => {};
    const ctx = new Proxy({ measureText: t => ({ width: t.length * 9 }) }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
    const asks = [];
    const ui = { ask: (message, options, done) => asks.push({ message, options, done }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: () => ctx }, ui, { seed: 12345, ...opts });
    const run = ms => { for (let i = 0; i < ms; i += 16) { fakeNow += 16; game.draw(fakeNow); } };
    const answer = i => asks.shift().done(i);
    // はじめに主人公と役職をえらぶ
    assert.match(asks[0].message, /主人公/);
    answer(hero);
    assert.match(asks[0].message, /役職/);
    answer(role);
    run(1300);
    return { game, s: game.state, run, asks, answer };
}

test('壁には入れず、歩くとターンが進み、見た場所がミニマップに残る', () => {
    const { game, s, run, asks } = setup();
    const before = s.explored.reduce((n, v) => n + v, 0);
    assert.ok(before > 0, 'はじめの部屋は見えている');
    for (let i = 0; i < 300; i++) {
        const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1]][i % 6];
        game.moveInput(dx, dy);
        run(200);
        assert.ok(D.walkable(s.map, s.player.x, s.player.y), '壁の上にいない');
        if (asks.length) break;   // 階段で聞かれた
    }
    assert.ok(s.turn > 0);
});

test('ダッシュは部屋の出入り・分かれ道で止まる', () => {
    const { game, s, run } = setup();
    const room = s.map.rooms[s.map.roomAt[s.player.y * s.map.w + s.player.x]];
    // 部屋の左上へ動かしてから、右へダッシュすると部屋の右の壁 (か出口) で止まる
    s.player.x = s.player.fx = room.x;
    s.player.y = s.player.fy = room.y;
    game.moveInput(1, 0, { dashing: true });
    run(3000);
    assert.equal(game.busy(), false);
    assert.ok(s.player.x > room.x, '動いた');
    assert.ok(s.player.x <= room.x + room.w, '部屋の端か出口で止まった');
});

test('階段に乗ると「降りますか？」と聞き、はいで次の階へ。最後の階は突破', () => {
    const { game, s, run, asks, answer } = setup();
    for (let floor = 1; floor <= s.dungeon.floors; floor++) {
        assert.equal(s.floor, floor);
        const { x, y } = s.map.stairs;
        // 階段のとなりの歩けるマスから乗る
        const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([ax, ay]) => D.canMove(s.map, x - ax, y - ay, ax, ay));
        s.player.x = s.player.fx = x - dx;
        s.player.y = s.player.fy = y - dy;
        game.moveInput(dx, dy);
        run(300);
        assert.equal(asks.length, 1, '聞かれた');
        if (floor === 1) {
            answer(1);   // いいえ
            assert.equal(s.floor, 1);
            game.confirm();   // 決定でもう一度聞く
            assert.equal(asks.length, 1);
        }
        answer(0);   // はい
        run(1300);
        if (floor < s.dungeon.floors) assert.equal(s.floor, floor + 1, '次の階');
    }
    assert.equal(s.done, true);
    assert.match(asks[0].message, /突破/);
    answer(0);   // もう一度
    run(1300);
    assert.equal(s.floor, 1);
    assert.equal(s.done, false);
});

test('主人公をえらぶと、その主人公で始まる (おにおにはこうげき・ぼうぎょ・HP が高い)', () => {
    const a = setup({ enemies: false }, 0).s.player;
    const b = setup({ enemies: false }, 1).s.player;
    assert.equal(a.name, 'こおりくん');
    assert.equal(b.name, 'おにおに');
    assert.ok(b.stats.hp > a.stats.hp && b.stats.atk > a.stats.atk && b.stats.def > a.stats.def);
    assert.ok(b.stats.spa < a.stats.spa);
});

test('階に着くと敵がいる。はじめの部屋にはいない', () => {
    const { s } = setup({});
    assert.ok(s.enemies.length >= 4);
    const room = s.map.roomAt[s.player.y * s.map.w + s.player.x];
    for (const e of s.enemies) {
        assert.ok(D.walkable(s.map, e.x, e.y));
        assert.notEqual(s.map.roomAt[e.y * s.map.w + e.x], room);
        assert.ok(U.FOREST_TABLE[0].includes(e.kind));
    }
});

// 主人公のとなり (右か左。dist マス先) に敵を 1 体だけ置く
function besideEnemy(game, s, kind = 'haribaby', dist = 1) {
    const p = s.player;
    const dx = [1, -1].find(d => [...Array(dist).keys()].every(i => D.canMove(s.map, p.x + d * i, p.y, d, 0)));
    const e = game.makeEnemy(kind, 1, p.x + dx * dist, p.y);
    e.awake = true;
    s.enemies.length = 0;
    s.enemies.push(e);
    p.dir = [dx, 0];
    return e;
}

// いちばん横に広い部屋のまんなかへ主人公を動かす
function toWideSpot(s) {
    const p = s.player;
    const room = s.map.rooms.reduce((a, b) => (b.w > a.w ? b : a));
    assert.ok(room.w >= 9, '広い部屋がある');
    p.x = p.fx = room.x + Math.floor(room.w / 2);
    p.y = p.fy = room.y;
    s.visible = D.visibleFrom(s.map, p.x, p.y);
}

test('攻撃すると敵の HP が減り、たおすとけいけんちが入る。敵は 1 ターンに 1 回 攻撃してくる', () => {
    const { game, s, run } = setup({});
    const e = besideEnemy(game, s);
    const p = s.player;
    let turns = 0;
    while (s.enemies.includes(e) && turns < 30) {
        game.confirm();   // 前に敵がいるので攻撃
        run(800);
        turns++;
    }
    assert.ok(!s.enemies.includes(e), 'たおした');
    assert.equal(s.turn, turns, '攻撃 1 回で 1 ターン');
    assert.ok(p.exp > 0 || p.lv > 1, 'けいけんちが入った');
    assert.ok(p.hp < p.stats.hp || turns <= 2 || s.messages.some(m => /よけた/.test(m.text)), '敵も攻撃してきた');
});

test('はなれた敵は近づいてくる', () => {
    const { game, s, run } = setup({});
    toWideSpot(s);
    const e = besideEnemy(game, s, 'haribaby', 3);
    const p = s.player;
    const d0 = Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y));
    game.wait();
    run(400);
    assert.ok(Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) < d0, '1 マス近づいた');
});

test('HP が 0 になるとたおれて、Lv はそのまま B1F からやり直し', () => {
    const { game, s, run, asks, answer } = setup({});
    besideEnemy(game, s);
    const p = s.player;
    p.lv = 3;
    p.stats = U.heroStats(p.kind, 3);
    p.hp = 1;
    for (let i = 0; i < 40 && !asks.length; i++) {
        game.wait();
        run(1500);
    }
    assert.equal(s.over, true);
    assert.match(asks[0].message, /たおれて/);
    answer(0);
    run(1300);
    assert.equal(s.over, false);
    assert.equal(s.floor, 1);
    assert.equal(p.lv, 3);
    assert.equal(p.hp, p.stats.hp);
});

test('わざを使うと PP が減り、こおりはしぜんによく効く', () => {
    const { game, s, run } = setup({});
    const e = besideEnemy(game, s, 'donguriko');
    e.stats.hp = e.hp = 999;
    const p = s.player;
    const sword = p.skills.findIndex(k => k.id === 'koori_sword');
    assert.ok(sword >= 0, 'コオリソードを持っている');
    const pp = p.skills[sword].pp;
    for (let i = 0; i < 6; i++) { game.useSkill(sword); run(900); }
    assert.equal(p.skills[sword].pp, pp - 6);
    assert.ok(e.hp < 999);
    assert.ok(s.messages.some(m => /ばつぐん/.test(m.text)) || s.turn > 0);
    assert.equal(U.effect('こおり', 'しぜん'), 1.5);
    assert.equal(U.effect('こおり', 'ほのお'), 0.67);
    assert.equal(U.effect('ふつう', 'ふつう'), 1);
    assert.equal(U.effect(null, 'しぜん'), 1);
});

test('直線のわざは はなれた敵に当たる。周りのわざは となりの敵みんなに当たる', () => {
    const { game, s, run } = setup({});
    toWideSpot(s);
    const e = besideEnemy(game, s, 'haribaby', 3);
    e.stats.hp = e.hp = 999;
    e.ai = 'wait';
    e.awake = false;
    const p = s.player;
    const breath = p.skills.findIndex(k => k.id === 'koori_breath');
    for (let i = 0; i < 5 && e.hp === 999; i++) { game.useSkill(breath); run(900); }
    assert.ok(e.hp < 999, 'こおりのいき が当たった');
    // 周り: となりに 2 体置いて、四天王絶対殺す剣
    p.skills[0] = U.newSkill('shitenno');
    const a = game.makeEnemy('haribaby', 1, p.x - 1, p.y), b = game.makeEnemy('haribaby', 1, p.x + 1, p.y);
    a.stats.hp = a.hp = b.stats.hp = b.hp = 999;
    s.enemies.splice(0, s.enemies.length, a, b);
    for (let i = 0; i < 4 && (a.hp === 999 || b.hp === 999); i++) { game.useSkill(0); run(900); }
    assert.ok(a.hp < 999 && b.hp < 999, '両どなりに当たった');
});

test('ねむると自分では動けず、ターンがひとりでにすすむ。治ると動ける', () => {
    const { game, s, run } = setup();
    const p = s.player;
    p.status = { id: 'sleep', turns: 3 };
    const t0 = s.turn;
    run(3000);
    assert.equal(p.status, null, 'ねむりが治った');
    assert.equal(s.turn - t0, 3);
    assert.equal(game.busy(), false);
});

test('しばりのあいだは歩けない。どくは毎ターン HP が減る', () => {
    const { game, s, run } = setup();
    const p = s.player;
    p.status = { id: 'bind', turns: 2 };
    const [x, y] = [p.x, p.y];
    const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0));
    game.moveInput(dx, 0);
    run(600);
    assert.deepEqual([p.x, p.y], [x, y]);
    assert.equal(s.turn, 1, '1 ターンすすんだ');
    p.status = { id: 'poison', turns: 5 };
    const hp = p.hp;
    game.wait();
    run(300);
    assert.ok(p.hp < hp);
});

test('ねむりごな でねむる。ヨフカシフクロウは ねむらない', () => {
    const { game, s, run } = setup({});
    const e = besideEnemy(game, s, 'nemuridake');
    const p = s.player;
    p.stats.hp = p.hp = 999;
    e.rate = 1;   // かならず わざを使う
    for (let i = 0; i < 10 && !p.status; i++) { game.wait(); run(700); }
    assert.equal(p.status && p.status.id, 'sleep');
    const owl = game.makeEnemy('yofukashi', 1, 0, 0);
    assert.deepEqual(owl.immune, ['sleep']);
});

test('Lv が上がるとわざを覚える。5 つめは どれかを忘れるか聞く', () => {
    const { game, s, run, asks, answer } = setup({});
    const p = s.player;
    assert.equal(p.skills.length, 3, '役職のわざ + Lv1 のわざ 2 つ');
    const e = besideEnemy(game, s);
    e.exp = 10000;
    e.hp = 1;
    p.buffs.kiai = true;
    for (let i = 0; i < 5 && s.enemies.length; i++) { game.attack(); run(900); }
    assert.ok(p.lv >= 6);
    assert.equal(p.skills.length, 4);
    assert.ok(p.skills.some(k => k.id === 'koori_hammer'));
    assert.equal(asks.length, 1, '四天王絶対殺す剣を覚えたい');
    assert.match(asks[0].message, /四天王絶対殺す剣/);
    answer(0);   // 1 番めを忘れる
    assert.equal(p.skills[0].id, 'shitenno');
});

test('役職で能力が変わる。役職のわざを持って始まる', () => {
    const base = U.heroStats('koori', 5, 'supporter');
    const atk = U.heroStats('koori', 5, 'attacker');
    const def = U.heroStats('koori', 5, 'defender');
    assert.ok(atk.atk > base.atk && atk.def < base.def);
    assert.ok(def.hp > base.hp && def.def > base.def);
    U.ROLE_IDS.forEach((id, i) => {
        const { s } = setup({ enemies: false }, 1, i);
        assert.equal(s.player.role, id);
        assert.equal(s.player.skills[0].id, U.ROLES[id].skill);
    });
});

test('ジャマー (はやい) は 2 回に 1 回だけ敵が動く。ディフェンダー (おそい) は敵が 2 回動く', () => {
    const jam = setup({}, 0, U.ROLE_IDS.indexOf('jammer'));
    for (let i = 0; i < 4; i++) { jam.game.wait(); jam.run(300); }
    assert.equal(jam.s.turn, 2);
    const df = setup({}, 0, U.ROLE_IDS.indexOf('defender'));
    toWideSpot(df.s);
    const e = besideEnemy(df.game, df.s, 'haribaby', 4);
    const d0 = Math.abs(e.x - df.s.player.x);
    df.game.wait();
    df.run(600);
    assert.equal(Math.abs(e.x - df.s.player.x), d0 - 2, '敵が 2 マス近づいた');
});

test('Lv が上がると能力が上がる', () => {
    const u = { lv: 1, exp: 0 };
    assert.equal(U.gainExp(u, U.expToNext(1) - 1), 0);
    assert.equal(U.gainExp(u, 1), 1);
    assert.equal(u.lv, 2);
    for (const id of ['koori', 'onioni']) {
        const a = U.heroStats(id, 1), b = U.heroStats(id, 10);
        for (const k of Object.keys(a)) assert.ok(b[k] > a[k], `${id} ${k}`);
    }
});

test('ダメージは 1 以上。こうげきが高いほど大きい', () => {
    const rng = globalThis.KD.createRng(5);
    let lo = 0, hi = 0;
    for (let i = 0; i < 200; i++) {
        const d = U.damage(rng, 1, 50);
        assert.ok(d >= 1);
        lo += d;
        hi += U.damage(rng, 20, 5);
    }
    assert.ok(hi > lo);
});

test('ドット絵はどれも 16 × 16 で、色がそろっている', () => {
    const { SPRITES } = globalThis.KD.Art;
    for (const id of ['koori', 'onioni', ...Object.keys(U.ENEMIES)]) {
        assert.ok(SPRITES[id], `${id} の絵がある`);
        for (const f of SPRITES[id].frames) {
            assert.equal(f.length, 16, id);
            for (const row of f) {
                assert.equal(row.length, 16, `${id}: ${row}`);
                for (const c of row) assert.ok(c === '.' || SPRITES[id].palette[c], `${id} の色 ${c}`);
            }
        }
    }
});
