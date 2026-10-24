// 段階 10 のテスト (新しい敵 71 体・ダンジョン 3 つ・メタル・ナイテイのきょうだいの クエスト)
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
const DG10 = globalThis.KD.Dungeons;
const NAMED = ['ジャーバン', 'C', 'Cプラス', 'Cシャープン', 'トリプルC', 'パイソン', 'PHPPP', 'HTMLモックン', 'CSSパックン', 'ダーツ・ノリノリコ', '蜜シロー', 'ウメハヤシ', 'ヨシブック', 'イコラブー',
    'ツモニャン', 'ロンニャン', 'キングハリー', 'メタルキングハリー', 'シーシャ・ナイテイ・ナイナイ', 'シーシャ・ナイテイ・アルアル', 'ナイテイ・ナナッシャ・ナディ'];

test('名前を指定された 21 体と 新キャラ 50 体: 絵・仲間のデータ・置き場所がある', () => {
    const names = Object.values(U.ENEMIES).map(e => e.name);
    for (const n of NAMED) assert.ok(names.includes(n), n);
    const kinds = Object.entries(U.ENEMIES).filter(([k, e]) => Number(e.no) >= 93 || ['triplec', 'kokushinyan', 'harryemperor', 'naitei', 'aruaru', 'nadi'].includes(k)).map(([k]) => k);
    assert.equal(kinds.length, 71, '21 + 50');
    assert.equal(kinds.filter(k => !NAMED.includes(U.ENEMIES[k].name)).length, 50, '新キャラ 50 体');
    const placed = new Set(DG10.EXTRA.flatMap(d => [...d.enemies, ...(d.rare || []), d.boss]));
    for (const k of kinds) {
        assert.ok(B.has(k), `${k} の絵`);
        if (!U.ENEMIES[k].boss) assert.ok(A.ALLIES[k], `${k} の仲間のデータ`);
        if (!['naitei', 'aruaru', 'nadi'].includes(k)) assert.ok(placed.has(k), `${k} が どのダンジョンにも いない`);
    }
    // ナイテイの きょうだいは ★5 で、ダンジョンには 出ない
    for (const k of ['naitei', 'aruaru', 'nadi']) { assert.equal(A.star(k), 5); assert.ok(!placed.has(k)); }
    // キングハリーは ハリジェネラルの 進化形
    assert.equal(A.EVOLVE.harigeneral.to, 'kingharry');
});

test('ダンジョン 3 つ: コード塔は ネット寺のあと (クリア前)、横丁・王国は クリア後。無限ではない', () => {
    const EX = DG10.EXTRA.filter(d => !d.version);   // バージョン専用 (enemies11.js) は べつ
    const [code, alley, kingdom] = EX;
    assert.deepEqual(EX.map(d => [d.id, d.floors]), [['code', 15], ['alley', 20], ['kingdom', 25]]);
    assert.ok(!code.opens({ cleared: 2 }) && code.opens({ cleared: 3 }));
    assert.ok(!alley.opens({ cleared: 7 }) && alley.opens({ cleared: 7, storyEnd: true }));
    assert.ok(!kingdom.opens({ cleared: 6 }) && kingdom.opens({ storyEnd: true }));
    for (const d of EX) {
        assert.ok(U.ENEMIES[d.boss].boss, `${d.name} の ボス`);
        for (let f = 1; f <= d.floors; f++) assert.ok(DG10.tableFor(d, f).every(k => U.ENEMIES[k]), `${d.name} B${f}F`);
        assert.ok(globalThis.KD.Art.THEMES[d.theme], `${d.name} の 見た目`);
        assert.equal(DG10.byId(d.id), d);
    }
});

test('町: コード塔は ネット寺を突破すると 行ける。突破すると ★', () => {
    const { s, game, run, asks, choose } = setup();
    // クリア前の設定に もどす
    s.town.storyEnd = false; s.town.ended = false; s.town.cleared = 3;
    choose('ダンジョンへ');
    const opts = asks[0].options.join(' / ');
    assert.ok(opts.includes('バグだらけのコード塔（15 階）'), opts);
    assert.ok(!opts.includes('ツモツモ横丁') && !opts.includes('ハリー王国'));
    choose('バグだらけのコード塔');
    skipTalk(asks, choose);
    run(1300);
    assert.equal(s.dungeon.id, 'code');
    // ボスを たおしたことにして 突破
    s.floor = 15; s.bossDown = true; s.boss = null; s.enemies = [];
    s.player.x = s.player.fx = s.map.stairs.x; s.player.y = s.player.fy = s.map.stairs.y;
    game.confirm();
    choose('はい');
    run(1300);
    let talk = '';
    while (!/日目/.test(asks[0].message)) { talk += asks[0].message; choose(asks[0].options[0]); }
    assert.match(talk, /コンパイル エラー/);
    assert.equal(s.town.extraClear.code, true);
    choose('ダンジョンへ');
    assert.ok(asks[0].options.some(o => o.startsWith('★バグだらけのコード塔')));
});

test('メタルキングハリー: ダメージは 1〜2 しか 通らない', () => {
    const { s, game, run, asks, choose } = setup();
    choose('ダンジョンへ');
    choose('ハリー王国');
    skipTalk(asks, choose);
    run(1300);
    const p = s.player;
    s.enemies = [];
    const d = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => globalThis.KD.Dungeon.canMove(s.map, p.x, p.y, dx, dy) && !s.allies.some(a => a.x === p.x + dx && a.y === p.y + dy));
    const m = game.makeEnemy('metalkingharry', 50, p.x + d[0], p.y + d[1]);
    m.awake = false;
    s.enemies.push(m);
    const before = m.hp;
    p.dir = d;
    for (let i = 0; i < 4 && s.enemies.includes(m); i++) { game.attack(); run(500); while (asks.length) asks.shift().done(0); }
    if (s.enemies.includes(m)) assert.ok(before - m.hp <= 8, `${before - m.hp} も 通った`);
    assert.ok(U.ENEMIES.metalkingharry.exp > 1000, 'けいけんちが とても多い');
});

test('ナイテイの きょうだい: ごくまれに クエストが出て、待っている階で たおして 報告すると 仲間になる', () => {
    const { s, game, run, asks, choose } = setup({ rareQuests: true });
    // 日を すすめて 掲示板を 作りなおす (rareQuests で かならず出す)
    choose('家');
    choose('1 日すすめる');
    while (!/日目/.test(asks[0].message)) choose(asks[0].options[asks[0].options.length - 1]);
    const rq = s.town.board.filter(q => q.rare);
    assert.deepEqual(rq.map(q => q.kind).sort(), ['aruaru', 'nadi', 'naitei']);
    const q = rq.find(x => x.kind === 'nadi');
    s.town.board.splice(s.town.board.indexOf(q), 1);
    s.town.quests.push(q);
    assert.deepEqual(game.town.duelsHere(15, 'code'), ['nadi']);
    game.town.onKill('nadi', 'code');
    while (asks.length > 1) asks.pop();
    choose('探検隊ギルド');
    choose('報告する');
    assert.match(asks[0].message, /ナイテイ・ナナッシャ・ナディが 仲間になった/);
    assert.ok(s.roster.some(a => a.kind === 'nadi'));
    choose('もどる');
    // 仲間にいると もう 出ない
    choose('やめる');
    choose('家');
    choose('1 日すすめる');
    while (!/日目/.test(asks[0].message)) choose(asks[0].options[asks[0].options.length - 1]);
    assert.ok(!s.town.board.some(x => x.rare && x.kind === 'nadi'));
});
