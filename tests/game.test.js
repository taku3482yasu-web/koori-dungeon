// ゲームの進行のテスト (主人公をえらぶ・歩く・ダッシュ・階段・最後の階・戦い・わざ・状態異常・道具・満腹度・ワナ・お金・仲間)
// 町のテストは town.test.js
// canvas は何もしない偽物、時間 (performance.now) はテストで進める
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'enemies.js', 'items.js', 'dungeons.js', 'collection.js', 'allies.js', 'town.js', 'art.js', 'bigart.js', 'enemyart.js', 'sound.js', 'config.js', 'market.js', 'townui.js', 'game.js']) vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
const { Dungeon: D, Units: U, Items: I } = globalThis.KD;

// opts: createGame に渡す ({ enemies: false } で敵なし。道具・ワナは things: true のときだけ)。hero: 0 こおりくん / 1 おにおに。role: 役職の番号
// タイトルと町を飛ばして、すぐダンジョンから始める
function setup(opts = { enemies: false }, hero = 0, role = 0) {
    const noop = () => {};
    const ctx = new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }) }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
    const asks = [];
    const ui = { ask: (message, options, done) => asks.push({ message, options, done }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: () => ctx }, ui, { seed: 12345, things: false, partner: false, recruit: false, start: 'dungeon', save: false, market: false, happen: false, role, ...opts });
    const run = ms => { for (let i = 0; i < ms; i += 16) { fakeNow += 16; game.draw(fakeNow); } };
    const answer = i => asks.shift().done(i);
    // はじめに主人公をえらぶ
    assert.match(asks[0].message, /主人公/);
    answer(hero);
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

test('階段に乗ると「降りますか？」と聞き、はいで次の階へ。最後の階は突破して町へ', () => {
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
    run(1300);
    assert.equal(s.phase, 'town');
    assert.match(asks[0].message, /突破/);
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

test('HP が 0 になるとたおれて町に戻る。Lv はそのまま。借金に利子が足される', () => {
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
    assert.equal(s.phase, 'town');
    assert.match(asks[0].message, /町に運ばれた/);
    assert.equal(s.over, false);
    assert.equal(p.lv, 3);
    assert.equal(p.hp, p.stats.hp);
    assert.ok(s.town.debt > globalThis.KD.Town.DEBT_START, '利子');
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
    assert.deepEqual(p.skills.map(k => k.id), ['koori_sword', 'koori_breath'], 'Lv1 のわざ 2 つ');
    // 4 つ持っている状態で Lv4 になると、コオリハンマーを覚えたいと聞く
    p.skills.push(U.newSkill('kiai'), U.newSkill('guard'));
    const e = besideEnemy(game, s);
    e.exp = 10000;
    e.hp = 1;
    p.buffs.kiai = true;
    for (let i = 0; i < 5 && s.enemies.length; i++) { game.attack(); run(900); }
    assert.ok(p.lv >= 4);
    assert.equal(asks.length, 1, 'コオリハンマーを覚えたい');
    assert.match(asks[0].message, /コオリハンマー/);
    answer(0);   // 1 番めを忘れる
    assert.equal(p.skills[0].id, 'koori_hammer');
    assert.equal(p.skills.length, 4);
});

test('役職で能力が変わる。役職のわざは その役職のときだけ使える', () => {
    const base = U.heroStats('koori', 5, 'supporter');
    const atk = U.heroStats('koori', 5, 'attacker');
    const def = U.heroStats('koori', 5, 'defender');
    assert.ok(atk.atk > base.atk && atk.def < base.def);
    assert.ok(def.hp > base.hp && def.def > base.def);
    U.ROLE_IDS.forEach((id, i) => {
        const { s } = setup({ enemies: false }, 1, i);
        assert.equal(s.player.role, id);
        assert.ok(s.player.tree.includes(`${id}1`), '役職が開放されている');
    });
    const { game, s, run } = setup({ enemies: false });
    s.player.skills.push(U.newSkill('guard'));
    const i = s.player.skills.length - 1;
    assert.equal(game.skills()[i].off, true);
    game.useSkill(i);
    run(500);
    assert.equal(s.player.skills[i].pp, s.player.skills[i].max, 'アタッカーでは まもりのかまえ は使えない');
    assert.equal(s.turn, 0);
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

test('ドット絵はどれも 16 × 16 で、色がそろっている。敵とボスと仲間は みんな絵がある', () => {
    const { SPRITES } = globalThis.KD.Art;
    const { BigArt } = globalThis.KD;
    for (const id of ['koori', 'onioni', 'yasu', 'tamu', 'dake', ...Object.keys(U.ENEMIES)]) {
        assert.ok(SPRITES[id] || BigArt.has(id), `${id} の絵がある`);
        if (!SPRITES[id]) continue;
        for (const f of SPRITES[id].frames) {
            assert.equal(f.length, 16, id);
            for (const row of f) {
                assert.equal(row.length, 16, `${id}: ${row}`);
                for (const c of row) assert.ok(c === '.' || SPRITES[id].palette[c], `${id} の色 ${c}`);
            }
        }
    }
});

// 道具の画面で name をえらび、action をする
function useFromBag(game, asks, answer, name, action) {
    game.itemMenu();
    const i = asks[0].options.findIndex(o => o.startsWith(name));
    assert.ok(i >= 0, `${name} を持っている`);
    answer(i);
    const j = asks[0].options.indexOf(action);
    assert.ok(j >= 0, `${action} ができる`);
    answer(j);
}

// 主人公のとなりのマス (右か左) に道具を置く。その向きを返す
function itemBeside(s, item) {
    const p = s.player;
    const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0));
    s.items.push({ x: p.x + dx, y: p.y, item });
    return dx;
}

test('階には道具・お金・ワナがある。階段とはじめの場所にはない', () => {
    const { s } = setup({ enemies: false, things: true });
    assert.ok(s.items.filter(i => i.item.id !== 'money').length >= 4);
    assert.ok(s.items.some(i => i.item.id === 'money'));
    assert.ok(s.traps.length >= 2);
    for (const t of [...s.items, ...s.traps]) {
        assert.ok(D.walkable(s.map, t.x, t.y));
        assert.ok(!(t.x === s.map.stairs.x && t.y === s.map.stairs.y));
        assert.ok(!(t.x === s.map.start.x && t.y === s.map.start.y));
    }
    assert.ok(s.traps.every(t => !t.seen), 'ワナは踏むまで見えない');
});

test('歩くと道具とお金を拾う。小石はまとめて持つ。24 個より多くは持てない', () => {
    const { game, s, run } = setup();
    const p = s.player;
    let dx = itemBeside(s, { id: 'money', n: 30 });
    game.moveInput(dx, 0); run(300);
    assert.equal(p.money, 30);
    dx = itemBeside(s, { id: 'pebble', n: 3 });
    game.moveInput(dx, 0); run(300);
    dx = itemBeside(s, { id: 'pebble', n: 2 });
    game.moveInput(dx, 0); run(300);
    assert.equal(p.bag.find(i => i.id === 'pebble').n, 5);
    while (p.bag.length < I.BAG_MAX) p.bag.push({ id: 'onigiri', n: 1 });
    dx = itemBeside(s, { id: 'ice_shard', n: 1 });
    game.moveInput(dx, 0); run(300);
    assert.equal(p.bag.length, I.BAG_MAX);
    assert.ok(s.items.some(i => i.item.id === 'ice_shard'), '拾えずに残った');
});

test('歩くとおなかが減り、0 になると HP が減る。おにぎりを食べると満腹度が戻る', () => {
    const { game, s, run, asks, answer } = setup();
    const p = s.player;
    for (let i = 0; i < 10; i++) { game.wait(); run(200); }
    assert.ok(Math.abs(p.belly - (I.BELLY_MAX - 10 * I.HUNGER)) < 1e-9);
    p.belly = 0.05;
    const hp = p.hp;
    game.wait(); run(200);
    game.wait(); run(200);
    assert.equal(p.belly, 0);
    assert.ok(p.hp < hp);
    useFromBag(game, asks, answer, 'おにぎり', '食べる');
    run(600);
    assert.ok(Math.abs(p.belly - (50 - I.HUNGER)) < 1e-9, "食べるのにも 1 ターンかかる");
    assert.ok(!p.bag.some(i => i.id === 'onigiri'));
});

test('氷のかけら で HP が戻る。ちからのハチマキ をつけると こうげきが上がる', () => {
    const { game, s, run, asks, answer } = setup();
    const p = s.player;
    p.hp = 5;
    useFromBag(game, asks, answer, '氷のかけら', '使う');
    run(600);
    assert.equal(p.hp, Math.min(p.stats.hp, 45));
    const atk = p.stats.atk;
    p.bag.push({ id: 'power_band', n: 1 });
    useFromBag(game, asks, answer, 'ちからのハチマキ', 'つける');
    run(600);
    assert.equal(p.stats.atk, atk + 4);
    useFromBag(game, asks, answer, 'ちからのハチマキ', 'はずす');
    run(600);
    assert.equal(p.stats.atk, atk);
});

test('小石を投げると はなれた敵に当たる。だれもいなければ床に落ちる', () => {
    const { game, s, run, asks, answer } = setup({});
    toWideSpot(s);
    const e = besideEnemy(game, s, 'haribaby', 3);
    e.stats.hp = e.hp = 99;
    e.ai = 'wait';
    e.awake = false;
    const p = s.player;
    p.bag.push({ id: 'pebble', n: 2 });
    useFromBag(game, asks, answer, '小石', '投げる');
    run(800);
    assert.equal(e.hp, 99 - 6);
    assert.equal(p.bag.find(i => i.id === 'pebble').n, 1);
    p.dir = [-p.dir[0], 0];
    s.enemies.length = 0;
    useFromBag(game, asks, answer, '小石', '投げる');
    run(800);
    assert.ok(s.items.some(i => i.item.id === 'pebble'), '床に落ちた');
    assert.ok(!p.bag.some(i => i.id === 'pebble'));
});

test('ワナ: トゲはダメージ、借金取りはお金が減る、落とし穴は次の階へ', () => {
    const { game, s, run } = setup();
    const p = s.player;
    p.money = 500;
    const step = id => {
        const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0));
        s.traps.push({ x: p.x + dx, y: p.y, id, seen: false });
        game.moveInput(dx, 0);
        run(900);
    };
    const hp = p.hp;
    step('spike');
    assert.ok(p.hp < hp);
    assert.ok(s.traps.every(t => t.seen), '踏んだワナは見える');
    step('debt');
    assert.equal(p.money, 450);
    step('pit');
    run(1300);
    assert.equal(s.floor, 2);
});

test('ペコリスは道具をぬすんで逃げる。たおすと落とす', () => {
    const { game, s, run } = setup({});
    const e = besideEnemy(game, s, 'pekorisu');
    const p = s.player;
    p.stats.hp = p.hp = 999;
    for (let i = 0; i < 20 && !e.loot; i++) { game.wait(); run(700); }
    assert.ok(e.loot, 'ぬすんだ');
    const n = s.items.length;
    // 毎回となりに戻してから攻撃 (攻撃は ときどき はずれて、そのあいだに逃げるので)
    const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0));
    e.hp = 1;
    p.dir = [dx, 0];
    for (let i = 0; i < 10 && s.enemies.length; i++) {
        e.x = e.fx = p.x + dx;
        e.y = e.fy = p.y;
        e.anim = null;
        game.attack();
        run(800);
    }
    assert.equal(s.enemies.length, 0);
    assert.equal(s.items.length, n + 1, '落とした');
});

test('ふっかつのたね を持っていると 1 回だけ復活する。倒れると お金と道具の半分をなくす', () => {
    const { game, s, run, asks, answer } = setup({});
    besideEnemy(game, s);
    const p = s.player;
    p.bag = [{ id: 'revive_seed', n: 1 }, { id: 'onigiri', n: 1 }, { id: 'pebble', n: 3 }, { id: 'ice_shard', n: 1 }, { id: 'warp_orb', n: 1 }];
    p.money = 300;
    p.hp = 1;
    for (let i = 0; i < 40 && p.bag.some(it => it.id === 'revive_seed'); i++) { game.wait(); run(900); }
    assert.ok(!p.bag.some(it => it.id === 'revive_seed'), 'たねを使った');
    assert.ok(!s.over, '復活した');
    p.hp = 1;
    for (let i = 0; i < 40 && !asks.length; i++) { game.wait(); run(1500); }
    assert.match(asks[0].message, /なくした/);
    answer(0);
    assert.equal(p.money, 0);
    assert.equal(p.bag.length, 2, '4 個のうち半分');
});

test('サポーターは見えているワナに気づき、お金を多く拾う', () => {
    const { game, s, run } = setup({ enemies: false }, 0, U.ROLE_IDS.indexOf('supporter'));
    const p = s.player;
    const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0));
    s.items.push({ x: p.x + dx, y: p.y, item: { id: 'money', n: 20 } });
    const room = s.map.rooms[s.map.roomAt[p.y * s.map.w + p.x]];
    s.traps.push({ x: room.x, y: room.y, id: 'spike', seen: false });
    game.moveInput(dx, 0); run(300);
    assert.equal(p.money, 30);
    assert.equal(s.traps[0].seen, true, '同じ部屋のワナに気づいた');
});

// ----- 仲間 (段階 5) -----
// 仲間を主人公のとなり (右か左) に置きなおす。向きを返す
function allyBeside(s, a) {
    const p = s.player;
    const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0) && !s.enemies.some(e => e.x === p.x + d && e.y === p.y));
    a.x = a.fx = p.x + dx;
    a.y = a.fy = p.y;
    a.anim = null;
    return dx;
}

test('えらばなかったほうが最初の仲間になり、主人公のとなりから始まる', () => {
    const { s } = setup({ enemies: false, partner: true }, 0);
    assert.equal(s.allies.length, 1);
    const a = s.allies[0];
    assert.equal(a.kind, 'onioni');
    assert.equal(a.role, 'attacker');
    assert.equal(Math.max(Math.abs(a.x - s.player.x), Math.abs(a.y - s.player.y)), 1);
    const b = setup({ enemies: false, partner: true }, 1).s.allies[0];
    assert.equal(b.kind, 'koori');
});

test('仲間は主人公についてくる。歩く先に仲間がいたら入れかわる', () => {
    const { game, s, run } = setup({ enemies: false, partner: true });
    toWideSpot(s);
    const p = s.player, a = s.allies[0];
    const dx = allyBeside(s, a);
    const [px, ax] = [p.x, a.x];
    game.moveInput(dx, 0); run(400);
    assert.equal(p.x, ax, '主人公が仲間のいたマスへ');
    assert.equal(a.x, px, '仲間は主人公のいたマスへ');
    // はなれたところから、ついてくる
    a.x = a.fx = p.x - dx * 3;
    for (let i = 0; i < 4; i++) { game.wait(); run(300); }
    assert.ok(Math.max(Math.abs(a.x - p.x), Math.abs(a.y - p.y)) <= 1, 'となりまで来た');
});

test('作戦「みんなで戦う」なら仲間がとなりの敵を攻撃する。「にげて」なら攻撃しない', () => {
    const { game, s, run, asks, answer } = setup({ partner: true });
    toWideSpot(s);
    const p = s.player, a = s.allies[0];
    // 主人公の右に仲間、その右に敵 (主人公からは届かない)
    a.x = a.fx = p.x + 1; a.y = a.fy = p.y; a.anim = null;
    const e = game.makeEnemy('haribaby', 1, p.x + 2, p.y);
    e.stats.hp = e.hp = 999;
    e.ai = 'wait';
    e.awake = false;
    s.enemies.splice(0, s.enemies.length, e);
    game.tacticMenu();
    answer(Object.keys({ fight: 0, follow: 0, flee: 0 }).indexOf('flee'));
    assert.equal(s.tactic, 'flee');
    for (let i = 0; i < 3; i++) { game.wait(); run(700); }
    assert.equal(e.hp, 999, 'にげて: 攻撃しない');
    a.x = a.fx = p.x + 1; a.y = a.fy = p.y; a.anim = null;
    e.x = e.fx = p.x + 2; e.y = e.fy = p.y; e.awake = false;
    game.tacticMenu();
    answer(0);
    assert.equal(s.tactic, 'fight');
    for (let i = 0; i < 3; i++) { game.wait(); run(700); }
    assert.ok(e.hp < 999, 'みんなで戦う: 攻撃した');
    assert.equal(asks.length, 0);
});

test('敵は となりの仲間もねらう。たおれた仲間は やり直すと戻る', () => {
    const { game, s, run, asks, answer } = setup({ partner: true });
    toWideSpot(s);
    const p = s.player, a = s.allies[0];
    a.x = a.fx = p.x + 1; a.y = a.fy = p.y; a.anim = null;
    // 敵は仲間のとなりで、主人公からは 2 マス
    const e = game.makeEnemy('haribaby', 1, p.x + 2, p.y);
    e.stats.atk = 99;
    e.stats.hp = e.hp = 999;
    s.enemies.splice(0, s.enemies.length, e);
    s.tactic = 'follow';
    a.hp = 1;
    for (let i = 0; i < 10 && s.allies.length; i++) { game.wait(); run(700); }
    assert.equal(s.allies.length, 0, '仲間がたおれた');
    assert.equal(s.fallen.length, 1);
    assert.equal(s.over, false, '探検は続く');
    // 主人公もたおれると、仲間は戻ってやり直し
    p.hp = 1;
    s.enemies[0].x = s.enemies[0].fx = p.x + 1;
    s.enemies[0].y = s.enemies[0].fy = p.y;
    for (let i = 0; i < 20 && !asks.length; i++) { game.wait(); run(1500); }
    answer(0);
    run(1300);
    assert.equal(s.allies.length, 1);
    assert.equal(s.allies[0].hp, s.allies[0].stats.hp);
});

test('敵をたおすと、仲間にもけいけんちが入る', () => {
    const { game, s, run } = setup({ partner: true });
    const e = besideEnemy(game, s);
    e.hp = 1;
    const a = s.allies[0];
    placeAway(s, a);
    for (let i = 0; i < 5 && s.enemies.length; i++) { game.attack(); run(800); }
    assert.equal(s.enemies.length, 0);
    assert.equal(a.exp, e.exp);
});

// 仲間を主人公から 2 マスはなれた、敵のいないところへ
function placeAway(s, a) {
    const p = s.player;
    for (const [dx, dy] of [[0, 2], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2]]) {
        const x = p.x + dx, y = p.y + dy;
        if (D.walkable(s.map, x, y) && !s.enemies.some(e => Math.abs(e.x - x) <= 1 && Math.abs(e.y - y) <= 1)) {
            a.x = a.fx = x; a.y = a.fy = y; a.anim = null;
            return;
        }
    }
}

test('ヒーラーの仲間は、となりの HP が少ない仲間を回復する', () => {
    const { game, s, run } = setup({ enemies: false });
    const p = s.player;
    const h = game.makeAlly('yofukashi', 1);
    h.role = 'healer';
    h.skills = [U.newSkill('heal')];
    s.allies.push(h);
    allyBeside(s, h);
    p.hp = 3;
    game.wait(); run(800);
    assert.ok(p.hp > 3 + 1, '回復した');
    assert.equal(h.skills[0].pp, h.skills[0].max - 1);
});

test('たおした敵が仲間になりたそうにする。はいで仲間に。3 人をこえたら町の広場で待つ', () => {
    const { game, s, run, asks, answer } = setup({ recruit: 1 });
    const p = s.player;
    for (let n = 0; n < 3; n++) {
        const e = besideEnemy(game, s, 'donguriko');
        s.allies.forEach(a => placeAway(s, a));
        e.hp = 1;
        for (let i = 0; i < 6 && !asks.length; i++) { game.attack(); run(800); }
        assert.match(asks[0].message, /仲間になりたそう/);
        answer(0);
        run(400);
    }
    assert.equal(s.allies.length, 2, '主人公をふくめて 3 人まで');
    assert.equal(s.roster.length, 1);
    assert.equal(s.allies[0].kind, 'donguriko');
    assert.equal(s.allies[0].role, 'defender');
    assert.ok(s.allies[0].skills.some(k => k.id === 'korogari'));
    assert.ok(p.hp > 0);
});
