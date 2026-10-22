// バージョン (氷隊 / 鬼鬼団) のテスト
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'enemies.js', 'items.js', 'dungeons.js', 'collection.js', 'allies.js', 'enemies9.js', 'enemies10.js', 'enemies11.js', 'town.js', 'art.js', 'bigart.js', 'enemyart.js', 'enemyart9.js', 'enemyart10.js', 'enemyart11.js', 'sound.js', 'config.js', 'market.js', 'townui.js', 'game.js']) {
    vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
}
const { Units: U, Dungeons: DG, Collection: C, BigArt: B, Allies: A } = globalThis.KD;

const fakeCtx = () => new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }) }, {
    get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; }
});

// タイトルから町まで進めて、借金を返し切ったことにする
function setup(opts = {}, hero = "こおりくん") {
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
    choose(hero);
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
const skipTalk = (asks, choose) => { while (asks[0] && asks[0].options.length === 1 && asks[0].options[0] === 'つぎへ') choose('つぎへ'); };
const DG10 = globalThis.KD.Dungeons;


test('限定キャラ 20 体 (氷隊 10・鬼鬼団 10) と 限定ボス: 絵・仲間のデータ・置き場所がある', () => {
    const limited = v => Object.entries(U.ENEMIES).filter(([, e]) => e.version === v && e.no).map(([k]) => k);
    assert.equal(limited('koori').length, 10);
    assert.equal(limited('onioni').length, 10);
    for (const v of ['koori', 'onioni']) {
        const d = DG.byId(DG.VERSIONS[v].dungeon);
        assert.equal(d.version, v);
        for (const k of limited(v)) {
            assert.ok(B.has(k), `${k} の絵`);
            assert.ok(A.ALLIES[k], `${k} の仲間のデータ`);
            // 9 体は 専用ダンジョンに出る。のこりの 1 体は 専用クエストだけ
            const inDungeon = d.enemies.includes(k);
            const inQuest = DG.VERSION_QUESTS[v].some(q => q.ally === k);
            assert.ok(inDungeon !== inQuest, `${k} の 置き場所`);
        }
        for (let f = 1; f <= d.floors; f++) assert.ok(DG.tableFor(d, f).every(k => U.ENEMIES[k]), `${d.name} B${f}F`);
        assert.ok(globalThis.KD.Art.THEMES[d.theme], `${d.name} の 見た目`);
    }
    assert.equal(DG.byId('glacier').boss, 'harukirin');
    assert.equal(U.ENEMIES.harukirin.name, 'ハル麒麟');
    assert.equal(DG.byId('onijo').boss, 'kinmetsuki');
    assert.equal(U.ENEMIES.kinmetsuki.name, '金滅鬼');
    // 限定ボスは 再戦の すがたで 仲間になる (★5)
    assert.equal(A.star('harukirin_q'), 5);
    assert.equal(A.star('kinmetsuki_q'), 5);
});

test('専用ダンジョンは その バージョンだけ。月の迷宮を 突破すると 現れる', () => {
    const g = DG.byId('glacier'), o = DG.byId('onijo');
    assert.ok(!g.opens({ version: 'koori', cleared: 4 }) && g.opens({ version: 'koori', cleared: 5 }));
    assert.ok(!g.opens({ version: 'onioni', cleared: 7 }));
    assert.ok(!o.opens({ version: 'onioni', cleared: 4 }) && o.opens({ version: 'onioni', cleared: 5 }));
    assert.ok(!o.opens({ version: 'koori', cleared: 7 }));
});

for (const [hero, v, other] of [['こおりくん', 'koori', 'onioni'], ['おにおに', 'onioni', 'koori']]) {
    test(`${hero}を えらぶと ${DG.VERSIONS[v].name}。タイトル・ダンジョン・専用クエストが バージョンで ちがう`, () => {
        const { s, game, run, asks, choose } = setup({}, hero);
        assert.equal(s.town.version, v);
        // 専用ダンジョン: 自分の バージョンだけ
        choose('ダンジョンへ');
        const names = asks[0].options.join(' / ');
        assert.ok(names.includes(DG.byId(DG.VERSIONS[v].dungeon).name), names);
        assert.ok(!names.includes(DG.byId(DG.VERSIONS[other].dungeon).name), names);
        choose('やめる');
        const nextDay = () => {
            choose('家');
            choose('1 日すすめる');
            while (!/日目/.test(asks[0].message)) choose(asks[0].options[asks[0].options.length - 1]);
        };
        // 専用クエスト: ボスを たおす前は ボスとの 再戦は 出ない
        nextDay();
        let vq = s.town.board.filter(q => q.version);
        assert.equal(vq.length, 2);
        s.town.extraClear = { [DG.VERSIONS[v].dungeon]: true };
        nextDay();
        vq = s.town.board.filter(q => q.version);
        assert.equal(vq.length, 3);
        assert.ok(vq.every(q => DG.VERSION_QUESTS[v].some(x => x.id === q.id)));
        // 限定ボスとの 再戦: 待っている階で たおして 報告すると 仲間になる
        const boss = `${v === 'koori' ? 'harukirin' : 'kinmetsuki'}_q`;
        const q = vq.find(x => x.ally && x.ally.kind === boss);
        s.town.board.splice(s.town.board.indexOf(q), 1);
        s.town.quests.push(q);
        assert.deepEqual(game.town.duelsHere(12, DG.VERSIONS[v].dungeon), [boss]);
        game.town.onKill(boss, DG.VERSIONS[v].dungeon);
        while (asks.length > 1) asks.pop();
        choose('探検隊ギルド');
        choose('報告する');
        assert.match(asks[0].message, new RegExp(`${U.ENEMIES[boss].name}が 仲間になった`));
        assert.ok(s.roster.some(a => a.kind === boss));
        choose('もどる');
        assert.ok(!s.town.board.some(x => x.id === q.id), '仲間にいると もう出ない');
        // 図鑑は いまの バージョンの 限定キャラだけ
        assert.ok(C.dexOrder(s.town.version).includes(DG.byId(DG.VERSIONS[v].dungeon).enemies[0]));
        assert.ok(!C.dexOrder(s.town.version).includes(DG.byId(DG.VERSIONS[other].dungeon).enemies[0]));
        void run;
    });
}

test('セーブと 読みこみ: バージョンは のこる。前の版の セーブは 主人公から 決まる', () => {
    const { s, game } = setup({}, 'おにおに');
    game.town.save();
    const data = JSON.parse(localStorage.getItem('koori-dungeon-save'));
    assert.equal(data.town.version, 'onioni');
    delete data.town.version;
    localStorage.setItem('koori-dungeon-save', JSON.stringify(data));
    game.town.load();
    assert.equal(s.town.version, 'onioni');
});
