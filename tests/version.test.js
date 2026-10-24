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
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'enemies.js', 'items.js', 'dungeons.js', 'collection.js', 'allies.js', 'enemies9.js', 'enemies10.js', 'enemies11.js', 'town.js', 'art.js', 'bigart.js', 'enemyart.js', 'enemyart9.js', 'enemyart10.js', 'enemyart11.js', 'sound.js', 'config.js', 'market.js', 'townui.js', 'motion.js', 'game.js']) {
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

test('セーブは バージョンごとに 2 つ。タイトルで えらべる。前の版の セーブは バージョンの ほうへ 移る', () => {
    // 鬼鬼団で はじめて セーブ
    const a = setup({}, 'おにおに');
    a.game.town.save();
    assert.ok(localStorage.getItem('koori-dungeon-save-onioni'));
    // 氷隊も はじめる (鬼鬼団の セーブは 消えない)。setup は store.clear() するので、セーブを とっておく
    const oni = localStorage.getItem('koori-dungeon-save-onioni');
    const b = setup({}, 'こおりくん');
    b.game.town.save();
    localStorage.setItem('koori-dungeon-save-onioni', oni);
    // タイトル: 両方の つづきから
    b.game.town.title();
    while (b.asks.length > 1) b.asks.shift();
    assert.match(b.asks[0].message, /氷隊 ／ 鬼鬼団/);
    assert.deepEqual(b.asks[0].options, ['つづきから（氷隊）', 'つづきから（鬼鬼団）', 'はじめから', '引き継ぎ', '設定']);
    b.choose('つづきから（鬼鬼団）');
    assert.equal(b.s.town.version, 'onioni');
    assert.equal(b.s.player.kind, 'onioni');
    // はじめから: えらんだ バージョンの セーブが あれば 聞く。いいえ なら タイトルへ
    b.game.town.title();
    while (b.asks.length > 1) b.asks.shift();
    b.choose('はじめから');
    b.choose('こおりくん');
    assert.match(b.asks[0].message, /氷隊の セーブが あります/);
    b.choose('いいえ');
    assert.ok(b.asks[0].options.includes('つづきから（氷隊）'));
    // 前の版の セーブ (バージョンなし・ひとつだけの キー) は 主人公の バージョンへ
    const old = JSON.parse(localStorage.getItem('koori-dungeon-save-onioni'));
    delete old.town.version;
    store.clear();
    localStorage.setItem('koori-dungeon-save', JSON.stringify(old));
    b.game.town.title();
    while (b.asks.length > 1) b.asks.shift();
    assert.deepEqual(b.asks[0].options, ['つづきから', 'はじめから', '引き継ぎ', '設定']);
    assert.equal(localStorage.getItem('koori-dungeon-save'), null);
    b.choose('つづきから');
    assert.equal(b.s.town.version, 'onioni');
});

test('キャラ交換: 交易所で もう片方の バージョンの 限定キャラを 買える。自分の 限定キャラを 出品できる', () => {
    const { s, game, asks, choose } = setup({ unlockAll: true });
    const DGv = globalThis.KD.Dungeons;
    // コンピューターの探検隊の 出品に 鬼鬼団の キャラが 出る (1 日 35%。何日か すすめる)
    let swap = null;
    for (let d = 0; d < 40 && !swap; d++) swap = DGv.rivalAllyListing(globalThis.KD.createRng(d), s.town, 30, ['5DX']);
    assert.ok(swap && U.ENEMIES[DGv.allyOfTradeId(swap.id)].version === 'onioni', '氷隊には 鬼鬼団の キャラ');
    assert.equal(DGv.rivalAllyListing(globalThis.KD.createRng(1), { ...s.town, cleared: 4 }, 30, ['5DX']), null, '月の迷宮の 前は 出ない');
    s.town.market = [{ ...swap, n: 20 }];
    s.player.money = 100000;
    choose('交易所');
    choose('ほかの探検隊の出品');
    const name = U.ENEMIES[DGv.allyOfTradeId(swap.id)].name;
    assert.ok(asks[0].options[0].includes(`${name} Lv20`) && asks[0].options[0].includes('鬼鬼団限定'), asks[0].options[0]);
    choose(name);
    assert.match(asks[0].message, /買った/);
    assert.ok(s.roster.some(a => a.kind === DGv.allyOfTradeId(swap.id) && a.lv === 20));
    choose('もどる');
    choose('もどる');
    // 出品: 仲間の広場の 限定キャラだけ
    s.roster.push(game.makeAlly('yukiusapon', 12));
    choose('キャラを出品する');
    assert.ok(asks[0].options.some(o => o.includes('ユキウサポン Lv12')));
    choose('ユキウサポン');
    assert.match(asks[0].message, new RegExp(`${DGv.allyPrice('yukiusapon').toLocaleString()}えんで 出品しますか`));
    choose('出品する');
    assert.ok(!s.roster.some(a => a.kind === 'yukiusapon'));
    assert.deepEqual(s.town.listings.map(l => [l.id, l.n]), [['ally_yukiusapon', 12]]);
    choose('もどる');
    // 取り下げると もどってくる (自分の キャラなので「（交易）」は 付かない)
    choose('自分の出品');
    choose('ユキウサポン');
    assert.ok(s.roster.some(a => a.kind === 'yukiusapon' && a.lv === 12 && a.name === 'ユキウサポン'));
    // 再戦の すがた・ふつうの キャラは 出せない
    assert.ok(!DGv.tradableAlly('harukirin_q') && !DGv.tradableAlly('harry') && DGv.tradableAlly('goukioni'));
});

test('バージョンの 会話: 町の 見出しに 日がわりの ひとこと', () => {
    for (const [hero, v] of [['こおりくん', 'koori'], ['おにおに', 'onioni']]) {
        const { asks } = setup({}, hero);
        assert.ok(DG.VERSIONS[v].lines.town.some(l => asks[0].message.includes(l)), `${DG.VERSIONS[v].name}の ひとこと: ${asks[0].message}`);
    }
});

// 敵を となりに置いて 見えるようにし、1 ターン すすめる
function meet(t, e) {
    const { s, game, run } = t;
    const p = s.player;
    s.enemies.splice(0, s.enemies.length, e);
    e.x = e.fx = p.x + [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0));
    e.y = e.fy = p.y;
    s.visible = D.visibleFrom(s.map, p.x, p.y);
    game.wait();
    run(100);
}
const D = globalThis.KD.Dungeon;

test('カットイン: 限定ボスは「氷隊 限定ボス」。再戦の 相手は 見つけたときに カットイン', () => {
    const t = setup({ enemies: false }, 'こおりくん');
    const { s, game, run } = t;
    t.asks.length = 0;   // 町の 画面を 閉じる
    game.startDungeon('glacier');
    run(1500);
    game.spawnBoss();
    assert.equal(s.boss.kind, 'harukirin');
    meet(t, s.boss);
    assert.ok(s.cutin && s.cutin.kind === 'harukirin', 'ボスの カットイン');
    assert.equal(s.cutin.sub, '氷隊 限定ボス');
    run(3000);
    // 再戦の 相手 (クエストで 待っている): 見えるまで 動かず、見つけると カットイン
    t.asks.length = 0;   // ボスの 台詞を 閉じる
    s.cutin = null;
    s.boss = null;
    const e = game.makeEnemy('harukirin_q', 20, 1, 1);
    e.duel = true;
    e.awake = false;
    meet(t, e);
    assert.ok(s.cutin && s.cutin.kind === 'harukirin_q', '再戦の カットイン');
    assert.equal(s.cutin.sub, '再戦！');
});

test('キャラ交換: 買った キャラの Lv は 主人公の Lv＋5 まで。もう片方の キャラは 図鑑の「交換」に のる。実績「キャラ交換」', () => {
    const { s, asks, choose } = setup({ unlockAll: true });
    const DGv = globalThis.KD.Dungeons;
    s.town.market = [{ id: 'ally_goukioni', n: 99, seller: '5DX', price: 100 }];
    s.player.money = 1000;
    choose('交易所');
    choose('ほかの探検隊の出品');
    choose('ゴウキオニ');
    assert.match(asks[0].message, /買った/);
    const a = s.roster.find(x => x.kind === 'goukioni');
    assert.equal(a.lv, s.player.lv + 5, 'Lv99 の 出品でも 主人公の Lv＋5 まで');
    assert.equal(a.name, 'ゴウキオニ（交易）', '交易所で 買った キャラは「（交易）」');
    assert.match(asks[0].message, /ゴウキオニ（交易）として 仲間の広場で 待っている/);
    assert.ok(s.town.dex.traded.goukioni);
    assert.equal(s.town.stats.allyTrades, 1);
    assert.ok(s.town.ach.ver_trade, '実績 キャラ交換');
    // 図鑑: 数は いまの バージョンの ぶんだけ。交換の キャラは おまけで のる
    choose('もどる');
    choose('もどる');   // 出品が なくなった
    choose('やめる');
    while (asks.length > 1) asks.shift();
    choose('家');
    choose('図鑑');
    assert.match(asks[0].message, /交換 1/);
    choose('敵の図鑑');
    assert.ok(asks[0].options.some(o => o.startsWith('交換 V20　ゴウキオニ（鬼鬼団）')));
    void DGv;
});

test('バージョンの 実績: 専用ダンジョン突破・限定ボスが仲間に・限定キャラ全員集合', () => {
    const { s, game } = setup({}, 'おにおに');
    const C2 = globalThis.KD.Collection;
    const ctx = () => ({ town: s.town, player: s.player, allies: s.allies, roster: s.roster, stats: s.town.stats });
    const ach = id => C2.ACHIEVEMENTS.find(a => a.id === id).test(ctx());
    assert.ok(!ach('ver_dungeon') && !ach('ver_boss') && !ach('ver_all'));
    s.town.extraClear = { onijo: true };
    assert.ok(ach('ver_dungeon'));
    assert.ok(!(s.town.extraClear.glacier) && !C2.ACHIEVEMENTS.find(a => a.id === 'ver_dungeon').test({ ...ctx(), town: { ...s.town, version: 'koori' } }), '氷隊なら 氷河');
    s.town.owned.push('vq:kinmetsuki');
    assert.ok(ach('ver_boss'));
    const kinds = Object.keys(U.ENEMIES).filter(k => U.ENEMIES[k].version === 'onioni' && U.ENEMIES[k].no);
    assert.equal(kinds.length, 10);
    kinds.slice(0, 9).forEach(k => s.roster.push(game.makeAlly(k, 5)));
    assert.ok(!ach('ver_all'));
    s.roster.push(game.makeAlly(kinds[9], 5));
    assert.ok(ach('ver_all'));
});

test('交易所で 買った キャラの「（交易）」は 進化しても 残る', () => {
    const { game } = setup({});
    const from = Object.keys(A.EVOLVE)[0];
    const a = game.makeAlly(from, 60);
    a.name = `${U.ENEMIES[from].name}（交易）`;
    game.evolve(a);
    assert.equal(a.name, `${U.ENEMIES[A.EVOLVE[from].to].name}（交易）`);
});
