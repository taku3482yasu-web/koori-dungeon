// 段階 9 のテスト (おまけダンジョン「ドタバタ大迷宮」・敵 053〜092・大魔王ASO・真)
import test from 'node:test';
import assert from 'node:assert/strict';
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
const { Units: U, Dungeons: DG, Collection: C, BigArt: B, Allies: A } = globalThis.KD;

const fakeCtx = () => new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }) }, {
    get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; }
});

// タイトルから町まで進めて、借金を返し切ったことにする
function setup(opts = {}) {
    store.clear();
    const asks = [];
    const ui = { ask: (message, options, done) => asks.push({ message, options, done }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: fakeCtx }, ui, { seed: 77, things: false, recruit: false, market: false, happen: false, ...opts });
    const run = ms => { for (let i = 0; i < ms; i += 16) { fakeNow += 16; game.draw(fakeNow); } };
    const choose = label => {
        const q = asks.shift();
        assert.ok(q, `「${label}」をえらぶ画面がない`);
        const i = q.options.findIndex(o => o.includes(label));
        assert.ok(i >= 0, `「${label}」がない: ${q.options.join(' / ')}`);
        q.done(i);
    };
    choose('はじめから');
    choose('こおりくん');
    for (let i = 0; i < 5; i++) choose('つぎへ');
    const s = game.state;
    s.town.cleared = 7;
    s.town.storyEnd = true;
    s.town.debt = 0;
    s.town.ended = true;
    s.player.lv = 60;
    s.player.stats = U.heroStats(s.player.kind, 60, s.player.role);
    s.player.hp = s.player.stats.hp;
    return { game, s, run, asks, choose };
}
// 話を つぎへ つぎへ と進める (ほかの画面が出たら止まる)
//   (ストーリーデモは「つぎへ・スキップ」)
const skipTalk = (asks, choose) => { while (asks[0] && asks[0].options[0] === 'つぎへ' && asks[0].options.length <= 2) choose('つぎへ'); };

test('敵 053〜092 は 40 体。絵と 仲間のデータがあり、属性は 敵キャラ表どおり', () => {
    const list = Object.entries(U.ENEMIES).filter(([, e]) => Number(e.no) >= 53 && Number(e.no) <= 92);
    assert.equal(list.length, 40);
    assert.deepEqual(list.map(([, e]) => e.no), Array.from({ length: 40 }, (v, i) => String(53 + i).padStart(3, '0')));
    const count = {};
    for (const [kind, e] of list) {
        assert.ok(B.has(kind), `${e.name} の絵`);
        assert.ok(A.ALLIES[kind], `${e.name} の仲間のデータ`);
        assert.ok(e.moves.every(([m]) => U.SKILLS[m]), `${e.name} の わざ`);
        count[e.element] = (count[e.element] || 0) + 1;
    }
    assert.deepEqual(count, { 'こおり': 7, 'ほのお': 7, 'みず': 1, 'しぜん': 7, 'かぜ': 8, 'ふしぎ': 6, 'ふつう': 4 });
    assert.ok(U.ENEMIES.maoushin.boss && B.has('maoushin'));
});

test('ドタバタ大迷宮: 99 階。10 階ごとに 見た目と特徴が変わり、10・20・…・90 階が 休憩の階。敵の Lv は 30 から 84 くらい', () => {
    const d = DG.BONUS;
    assert.equal(d.floors, 99);
    assert.equal(DG.atFloor(1).theme, 'forest');
    assert.equal(DG.atFloor(11).theme, 'coast');
    assert.ok(DG.atFloor(11).pool, '海岸の 10 階は 水たまり');
    assert.equal(DG.atFloor(25).traps[0], 6, '寺の 10 階は ワナが多い');
    assert.ok(DG.atFloor(35).fast > 0, '屋敷の 10 階は すばやい敵');
    assert.ok(DG.atFloor(45).shift > 0, '月の 10 階は 形が変わる');
    assert.equal(DG.atFloor(71).theme, 'forest', '7 つ回ったら また森');
    for (let f = 1; f <= 99; f++) assert.equal(DG.atFloor(f).rest, f % 10 === 0 && f < 99, `B${f}F`);
    assert.ok(DG.atFloor(50).rivalFloor);
    assert.ok(Math.abs(DG.levelFor(d, 1) - 30) <= 1 && Math.abs(DG.levelFor(d, 99) - 84) <= 2);   // 2026-10-22 バランス調整で 95 → 84
    // 出る敵は 新しい敵が中心
    const table = DG.tableFor(DG.atFloor(60), 60);
    assert.ok(table.filter(k => Number(U.ENEMIES[k].no) >= 53).length >= 4);
    assert.deepEqual(DG.restFloors(0), [1]);
    assert.deepEqual(DG.restFloors(35), [1, 10, 20, 30]);
});

test('借金を返し切ると 町から行ける。休憩の階では 敵が出ず、町に帰ると 次は そこから 始められる', () => {
    const { game, s, run, asks, choose } = setup();
    choose('ダンジョンへ');
    choose('ドタバタ大迷宮');
    skipTalk(asks, choose);
    run(1300);
    assert.equal(s.dungeon.id, 'bonus');
    assert.equal(s.floor, 1);
    // 10 階へ
    s.floor = 9;
    s.player.x = s.player.fx = s.map.stairs.x;
    s.player.y = s.player.fy = s.map.stairs.y;
    s.enemies = [];
    game.confirm();
    choose('はい');
    run(1300);
    assert.equal(s.floor, 10);
    assert.equal(s.enemies.length, 0, '休憩の階に 敵がいる');
    skipTalk(asks, choose);
    assert.match(asks[0].message, /休憩の階/);
    choose('町に帰る');
    run(1300);
    assert.equal(s.town.bonusBest, 10);
    skipTalk(asks, choose);
    while (!/日目/.test(asks[0].message)) choose(asks[0].options[0]);
    choose('ダンジョンへ');
    choose('ドタバタ大迷宮');
    assert.deepEqual(asks[0].options.slice(0, -1), ['B1F', 'B10F']);
    choose('B10F');
    run(1300);
    assert.equal(s.floor, 10);
});

test('50 階: チームバータス・チーム・ケモノミチ の 6 人が待っていて、ほかの敵は出ない', () => {
    const t = setup();
    const { s, run, asks, choose } = t;
    s.town.bonusBest = 40;
    s.town.seen.bonus = true;
    choose('ダンジョンへ');
    choose('ドタバタ大迷宮');
    choose('B40F');
    run(1300);
    skipTalk(asks, choose);
    choose('先へ進む');
    s.floor = 49;
    s.enemies = [];
    s.player.x = s.player.fx = s.map.stairs.x;
    s.player.y = s.player.fy = s.map.stairs.y;
    t.game.confirm();
    choose('はい');
    run(1300);
    assert.equal(s.floor, 50);
    const teams = ['チームバータス', 'チーム・ケモノミチ'];
    assert.equal(s.enemies.length, 6);
    assert.deepEqual(s.enemies.map(e => e.kind).sort(), teams.flatMap(team => C.RIVALS[team]).sort());
    assert.ok(s.enemies.every(e => teams.includes(e.team)));
    assert.ok(s.messages.some(m => /2 チーム/.test(m.text)));
    // 50 階は ライバルを たおすまで 休憩にならない
    assert.equal(s.town.bonusBest, 40);
});

test('99 階: 大魔王ASO・真。HP が減るたびに 四天王を 1 人ずつ呼び、たおして抜けると ほんとうの ほんとうの エンディング', () => {
    const { game, s, run, asks, choose } = setup();
    s.town.bonusBest = 90;
    s.town.seen.bonus = true;
    choose('ダンジョンへ');
    choose('ドタバタ大迷宮');
    choose('B90F');
    run(1300);
    skipTalk(asks, choose);
    choose('先へ進む');
    // 99 階へ
    s.floor = 98;
    s.enemies = [];
    s.player.x = s.player.fx = s.map.stairs.x;
    s.player.y = s.player.fy = s.map.stairs.y;
    game.confirm();
    choose('はい');
    run(1300);
    assert.equal(s.floor, 99);
    const boss = s.boss;
    assert.ok(boss && boss.kind === 'maoushin');
    // HP を 半分ちょっと 減らすと 四天王が 2 人
    boss.awake = true;
    boss.stats.atk = 1;   // 主人公が たおれないように
    const before = s.enemies.length;
    boss.hp = Math.floor(boss.stats.hp * 0.55);
    // ダメージの処理を通す (となりで 攻撃)
    {
        const p = s.player;
        s.enemies.filter(e => e !== boss).forEach(e => { e.x = e.fx = 1; e.y = e.fy = 1; });
        const dx = [1, -1].find(d => globalThis.KD.Dungeon.canMove(s.map, p.x, p.y, d, 0));
        boss.x = boss.fx = p.x + dx;
        boss.y = boss.fy = p.y;
        p.dir = [dx, 0];
        while (asks.length) asks.shift();
        for (let i = 0; i < 6 && s.enemies.filter(e => ['daishi', 'zumitani'].includes(e.kind)).length < 2; i++) {
            game.attack();
            run(800);
            while (asks.length) asks.shift();
            boss.hp = Math.min(boss.hp, Math.floor(boss.stats.hp * 0.55));
        }
    }
    const called = s.enemies.filter(e => ['daishi', 'zumitani', 'runaya', 'nozoema'].includes(e.kind)).map(e => e.kind);
    assert.ok(called.includes('daishi') && called.includes('zumitani'), `呼ばれた: ${called.join(',')} (${before})`);
    assert.ok(!called.includes('runaya'));
    assert.ok(!s.over, '主人公が たおれた');
    // たおしたことにして 抜ける
    run(1000);
    while (asks.length) asks.shift();
    s.queue.length = 0;
    s.enemies = [];
    s.boss = null;
    s.bossDown = true;
    s.player.x = s.player.fx = s.map.stairs.x;
    s.player.y = s.player.fy = s.map.stairs.y;
    game.confirm();
    choose('はい');
    run(1300);
    let talk = '';
    while (!/日目/.test(asks[0].message)) { talk += asks[0].message; choose(asks[0].options[0]); }
    assert.match(talk, /ほんとうの ほんとうの エンディング/);
    assert.equal(s.town.bonusClear, true);
    assert.ok(C.ACHIEVEMENTS.find(a => a.id === 'dotabata').test({ town: s.town, player: s.player, allies: s.allies, stats: s.town.stats }));
});
