// 町のテスト (タイトル・はじまりの話・借金・バトルツリー・お店・鍛冶屋・交易所・倉庫・仲間の広場・家・クエスト・セーブ)
// 町の操作は「えらぶ画面」のくり返しなので、えらぶものの文字でえらんで進める
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
// ブラウザの localStorage のかわり
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'enemies.js', 'items.js', 'dungeons.js', 'collection.js', 'allies.js', 'enemies9.js', 'enemies10.js', 'enemies11.js', 'town.js', 'art.js', 'bigart.js', 'enemyart.js', 'enemyart9.js', 'enemyart10.js', 'enemyart11.js', 'sound.js', 'config.js', 'market.js', 'townui.js', 'motion.js', 'arena.js', 'emblems.js', 'op.js', 'game.js']) vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
const { Units: U, Items: I, Town: TW, Dungeon: D } = globalThis.KD;

// タイトルから はじめて、はじまりの話を読み、町のメニューまで進める
function setup(opts = {}, { fresh = true, hero = 0 } = {}) {
    if (fresh) store.clear();
    const noop = () => {};
    const ctx = new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }) }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
    const asks = [];
    const ui = { ask: (message, options, done) => asks.push({ message, options, done }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: () => ctx }, ui, { seed: 777, things: false, recruit: false, unlockAll: true, market: false, happen: false, ...opts });
    const run = ms => { for (let i = 0; i < ms; i += 16) { fakeNow += 16; game.draw(fakeNow); } };
    // label ではじまる選択肢をえらぶ
    const choose = label => {
        const q = asks.shift();
        assert.ok(q, `「${label}」をえらぶ画面がない`);
        const i = q.options.findIndex(o => o.startsWith(label) || o.includes(label));
        assert.ok(i >= 0, `「${label}」がない: ${q.options.join(' / ')}`);
        q.done(i);
    };
    return { game, s: game.state, run, asks, choose };
}

function newGame(opts) {
    const t = setup(opts);
    assert.equal(t.s.phase, 'title');
    t.choose('はじめから');
    t.choose(['こおりくん', 'おにおに'][0]);
    for (let i = 0; i < 5; i++) t.choose('つぎへ');
    assert.equal(t.s.phase, 'town');
    assert.match(t.asks[0].message, /1日目/);
    return t;
}

test('タイトル → 主人公をえらぶ → はじまりの話 → 町。借金 100,000 えんから始まる', () => {
    const { s, asks } = newGame();
    assert.equal(s.town.debt, TW.DEBT_START);
    assert.equal(s.player.role, 'attacker');
    assert.equal(s.allies[0].kind, 'onioni', 'えらばなかったほうが最初の仲間');
    assert.ok(asks[0].options.includes('鍛冶屋') && asks[0].options.includes('交易所'));
});

test('借金を返すと BP がたまる。合わせて 10,000 えんごとに おまけ', () => {
    const { s, choose } = newGame();
    s.player.money = 12000;
    choose('借金返済所');
    choose('10,000えん');
    assert.equal(s.town.debt, TW.DEBT_START - 10000);
    assert.equal(s.town.bp, 10 + TW.BONUS_BP);
    choose('もどる');
    choose('1,000えん');
    assert.equal(s.town.bp, 13);
    assert.equal(s.player.money, 1000);
    assert.equal(TW.bpFor(9500, 1000), 1 + TW.BONUS_BP);
});

test('借金を返し切ると エンディング。そのあとも遊べる', () => {
    const { s, asks, choose } = newGame();
    s.player.money = TW.DEBT_START;
    choose('借金返済所');
    choose('あるだけ');
    assert.equal(s.town.debt, 0);
    assert.equal(s.town.ended, true);
    let talk = '';
    while (!/日目/.test(asks[0].message)) { talk += asks[0].message; choose('つぎへ'); }
    assert.match(asks[0].message, /日目/, '町に戻った');
    // おまけダンジョン「ドタバタ大迷宮」が 現れる (段階 9)
    assert.match(talk, /ドタバタ大迷宮/);
    choose('ダンジョンへ');
    assert.ok(asks[0].options.some(o => o.includes('ドタバタ大迷宮（99 階）')));
});

test('バトルツリー: BP でマスを開放すると能力が上がり、役職を開放して切りかえられる。わざは その役職で覚える', () => {
    const { s, asks, choose } = newGame();
    const p = s.player;
    s.town.bp = 30;
    const atk = p.stats.atk;
    choose('バトルツリー');
    choose('マスを開放する');
    choose('こうげき +2');
    assert.equal(p.stats.atk, atk + 2);
    assert.equal(s.town.bp, 28);
    choose('もどる');
    choose('役職「ヒーラー」');
    assert.ok(p.tree.includes('healer1'));
    choose('もどる');
    choose('もどる');
    choose('役職を切りかえる');
    choose('ヒーラー');
    assert.equal(p.role, 'healer');
    choose('もどる');
    // ヒーラーの枝: 能力アップ → 役職のわざ (いやしの風) を開放すると覚える
    choose('マスを開放する');
    choose('HP +6');
    choose('もどる');
    choose('わざ「いやしの風」');
    assert.ok(p.skills.some(k => k.id === 'heal'));
    choose('もどる');
    assert.ok(asks.length);
    // 開放できるのは となりが開放されたマスだけ
    const nodes = TW.treeNodes('koori');
    assert.equal(TW.canUnlock(nodes.find(n => n.id === 'defender2'), p.tree), false);
});

test('お店で買う・売る', () => {
    const { s, choose } = newGame();
    const p = s.player;
    p.money = 1000;
    choose('お店');
    choose('買う');
    choose('おにぎり');
    assert.equal(p.money, 1000 - I.ITEMS.onigiri.price);
    assert.equal(p.bag.filter(i => i.id === 'onigiri').length, 2);
    choose('もどる');
    choose('もどる');
    choose('売る');
    const before = p.money;
    choose('氷のかけら');
    assert.equal(p.money, before + I.ITEMS.ice_shard.price / 2);
});

test('鍛冶屋: 素材とお金で 武器を作る。持ち物と倉庫の両方から使う', () => {
    const { s, choose, asks } = newGame();
    const p = s.player;
    p.money = 500;
    p.bag.push({ id: 'soft_needle', n: 3 });
    s.town.storage.push({ id: 'soft_needle', n: 2 });
    choose('鍛冶屋');
    assert.ok(asks[0].options.some(o => o.startsWith('○ ハリの剣')));
    choose('ハリの剣');
    // 作る前に どこから 使うかを 見せる (2026-10-22)
    assert.match(asks[0].message, /持ち物から 3・倉庫から 2/);
    choose('作る');
    assert.match(asks[0].message, /できた/);
    assert.ok(p.bag.some(i => i.id === 'needle_sword'));
    assert.ok(!p.bag.some(i => i.id === 'soft_needle'));
    assert.equal(s.town.storage.length, 0);
    assert.equal(p.money, 300);
    choose('もどる');
    choose('どんぐりの盾');
    assert.match(asks[0].message, /たりない/);
});

test('交易所: 珍しい道具・ほかの探検隊の出品を買う。自分の出品は 日がたつと売れることがある', () => {
    const { s, choose, asks } = newGame();
    const p = s.player;
    p.money = 20000;
    choose('交易所');
    choose('珍しい道具');
    const rare = s.town.rare[0];
    choose(I.ITEMS[rare.id].name);
    assert.ok(p.bag.some(i => i.id === rare.id));
    choose('もどる');
    choose('もどる');
    choose('ほかの探検隊の出品');
    assert.ok(asks[0].options[0].startsWith(s.town.market[0].seller));
    const m = s.town.market[0];
    choose(m.seller);
    assert.ok(p.bag.some(i => i.id === m.id));
    choose('もどる');
    choose('もどる');
    // 出品: 値段は 道具ごとに 決まっていて、何日かすすめると売れる
    p.bag.push({ id: 'power_band', n: 1 });
    choose('出品する');
    choose('ちからのハチマキ');
    choose('出品する');
    assert.equal(s.town.listings.length, 1);
    choose('もどる');
    choose('やめる');
    const money = p.money;
    for (let d = 0; d < 10 && s.town.listings.length; d++) {
        choose('家');
        choose('1 日すすめる');
    }
    assert.equal(s.town.listings.length, 0, '売れた');
    assert.ok(p.money > money);
    assert.match(asks[0].message, /売れた/);
});

test('倉庫: 道具とお金をあずける。倒れてもなくならない', () => {
    const { s, choose } = newGame();
    const p = s.player;
    p.money = 300;
    choose('倉庫');
    choose('お金を全部あずける');
    assert.equal(s.town.bank, 300);
    assert.equal(p.money, 0);
    choose('あずける');
    choose('おにぎり');
    assert.ok(s.town.storage.some(i => i.id === 'onigiri'));
    choose('もどる');
    choose('引き出す');
    choose('おにぎり');
    assert.ok(p.bag.some(i => i.id === 'onigiri'));
});

test('仲間の広場: 連れていく仲間をえらぶ (主人公のほかに 2 人まで)', () => {
    const { s, game, choose, asks } = newGame();
    s.roster.push(game.makeAlly('donguriko', 2), game.makeAlly('nemuridake', 2));
    choose('仲間の広場');
    choose('ドングリコ');
    assert.match(asks[0].message, /進化：Lv20 で オオドングリコに 進化/);
    choose('連れていく');
    assert.equal(s.allies.length, 2);
    choose('ネムリダケ');
    choose('連れていく');
    assert.match(asks[0].message, /2 人まで/);
    choose('もどる');
    choose('おにおに');
    choose('はずす');
    assert.equal(s.allies.length, 1);
    assert.equal(s.allies[0].kind, 'donguriko');
});

test('進化: 条件は キャラごと。Lv・道具を わたす・ダンジョンに 連れていく', () => {
    const A = globalThis.KD.Allies;
    // 28 体ぶん (段階 10 で ハリジェネラル → キングハリー を足した)。条件の Lv は いろいろ、3 種類とも ある
    const list = Object.entries(A.EVOLVE);
    assert.equal(list.length, 28);
    assert.deepEqual([...new Set(list.map(([, v]) => v.how))].sort(), ['dungeon', 'item', 'level']);
    assert.ok(new Set(list.map(([, v]) => v.lv)).size >= 10);
    for (const [kind, v] of list) {
        assert.ok(U.ENEMIES[kind] && U.ENEMIES[v.to] && A.ALLIES[v.to], kind);
        if (v.how === 'item') assert.ok(globalThis.KD.Items.ITEMS[v.item], `${kind} の道具`);
    }
    // 道具を わたす: 広場で Lv が足りないと まだ、足りると 進化 (看板のわざを覚える)
    const { s, game, choose, asks } = newGame();
    const nemu = game.makeAlly('nemuridake', 10);
    s.roster.push(nemu);
    game.town.giveItem({ id: 'moon_dust', n: 2 }, true);
    choose('仲間の広場');
    choose('ネムリダケ');
    choose('月の砂');
    assert.match(asks[0].message, /まだ 早い/);
    choose('もどる');
    nemu.lv = 18;
    choose('月の砂');
    assert.equal(nemu.kind, 'nemuridakeou');
    assert.equal(nemu.name, 'ネムリダケオウ');
    assert.ok(nemu.skills.some(k => k.id === A.signature('nemuridakeou')));
    assert.match(asks[0].message, /進化した/);
    assert.equal(s.town.stats.evolved, 1);
    // Lv で進化: ドングリコは Lv20
    const don = game.makeAlly('donguriko', 19);
    assert.ok(!A.canEvolve(don));
    don.lv = 20;
    assert.ok(A.canEvolve(don));
    assert.ok(!A.canEvolve(don, { item: 'kelp' }));
    // ダンジョン: ヨフカシフクロウは 月の迷宮 B10F (Lv26 から)
    const owl = game.makeAlly('yofukashi', 26);
    assert.ok(!A.canEvolve(owl, { dungeon: 'moon', floor: 9 }));
    assert.ok(A.canEvolve(owl, { dungeon: 'moon', floor: 10 }));
    assert.ok(!A.canEvolve(owl));
    // 名前を変えていた仲間 (ハリ坊) は 名前そのまま
    const hari = game.makeAlly('haribaby', 22);
    hari.name = 'ハリ坊';
    game.evolve(hari);
    assert.equal(hari.kind, 'harigeneral');
    assert.equal(hari.name, 'ハリ坊');
});

test('クエスト: 受けて、ダンジョンで敵をたおすと達成。ギルドで報告すると ごほうび', () => {
    const { s, game, run, choose, asks } = newGame({ enemies: true });
    // たおすクエストを 1 つ作って受ける
    s.town.board.unshift({ id: 'test1', type: 'kill', kind: 'haribaby', count: 1, text: 'ハリベビーを 1 体たおして', money: 500, item: 'oni_kanabo', progress: 0 });
    choose('探検隊ギルド');
    choose('クエストを受ける');
    choose('★ハリベビーを 1 体');
    assert.equal(s.town.quests.length, 1);
    choose('もどる');   // 「受けた！」
    choose('もどる');   // 掲示板
    choose('やめる');   // ギルド
    choose('ダンジョンへ');
    choose('ハリーの森');
    if (asks[0] && asks[0].options[1] === 'スキップ') choose('スキップ');   // はじめて 行くときの 話
    run(1300);
    assert.equal(s.phase, 'play');
    // となりにハリベビーを置いて たおす
    const p = s.player;
    const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0) && !s.allies.some(a => a.x === p.x + d && a.y === p.y));
    const e = game.makeEnemy('haribaby', 1, p.x + dx, p.y);
    e.hp = 1;
    s.enemies.splice(0, s.enemies.length, e);
    p.dir = [dx, 0];
    for (let i = 0; i < 6 && !asks.length; i++) { game.attack(); run(800); }
    assert.equal(s.town.quests[0].progress, 1);
    assert.match(asks[0].message, /町に戻りますか/);
    choose('町に戻る');
    run(1300);
    assert.equal(s.phase, 'town');
    choose('町へ');
    choose('探検隊ギルド');
    choose('報告する');
    assert.match(asks[0].message, /鬼の金棒レプリカ/);
    assert.ok(p.bag.some(i => i.id === 'oni_kanabo'));
    assert.equal(s.town.quests.length, 0);
    assert.ok(s.town.owned.includes('oni_kanabo'), '同じ限定品は もう出ない');
});

test('クエスト: 納品と、限定の仲間', () => {
    const { s, choose, asks } = newGame();
    s.town.quests.push({ id: 't2', type: 'deliver', want: 'onigiri', count: 2, text: 'おにぎりを 2 個', money: 300, progress: 0 });
    s.town.quests.push({ id: 't3', type: 'reach', floor: 3, text: 'B3F まで', money: 400, progress: 1, ally: TW.QUEST_ALLY });
    s.player.bag.push({ id: 'onigiri', n: 1 });
    const money = s.player.money;
    choose('探検隊ギルド');
    choose('報告する');
    assert.match(asks[0].message, /ハリ坊/);
    assert.equal(s.player.money, money + 700);
    assert.ok(!s.player.bag.some(i => i.id === 'onigiri'), '納品した');
    assert.ok(s.roster.some(a => a.name === 'ハリ坊' && a.lv === 5));
});

test('クエストの掲示板: 3〜5 件。★ の限定品は まだ持っていないものだけ', () => {
    for (let day = 1; day < 30; day++) {
        const board = TW.questBoard(globalThis.KD.createRng(day), day, { owned: ['oni_kanabo'], allyKinds: ['onioni'] });
        assert.ok(board.length >= 3 && board.length <= 5);
        for (const q of board) {
            assert.notEqual(q.item, 'oni_kanabo');
            assert.ok(q.money > 0 && q.text);
            if (q.item) assert.equal(I.ITEMS[q.item].only, 'quest');
        }
    }
});

test('ダンジョンで倒れると町へ。お金はなくなり、借金に利子。倉庫の物は残る', () => {
    const { s, game, run, choose, asks } = newGame({ enemies: true });
    s.town.storage.push({ id: 'big_onigiri', n: 1 });
    choose('ダンジョンへ');
    choose('ハリーの森');
    if (asks[0] && asks[0].options[1] === 'スキップ') choose('スキップ');   // はじめて 行くときの 話
    run(1300);
    const p = s.player;
    p.money = 999;
    p.hp = 1;
    const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0) && !s.allies.some(a => a.x === p.x + d && a.y === p.y));
    const e = game.makeEnemy('tsutankobu', 3, p.x + dx, p.y);
    e.awake = true;
    e.stats.atk = 99;
    s.enemies.splice(0, s.enemies.length, e);
    s.fallen.push(...s.allies.splice(0));   // 仲間は もう たおれている (みんな たおれると 失敗)
    for (let i = 0; i < 30 && s.phase === 'play'; i++) { game.wait(); run(1500); }
    assert.equal(s.phase, 'town');
    assert.match(asks[0].message, /利子/);
    assert.equal(p.money, 0);
    assert.ok(s.town.debt > TW.DEBT_START);
    assert.ok(s.town.storage.some(i => i.id === 'big_onigiri'));
    choose('町へ');
    assert.match(asks[0].message, /日目/);
});

test('敵をたおすと ときどき素材を落とす', () => {
    const { s, game, run, asks, choose } = newGame({ enemies: true, partner: false });
    choose('ダンジョンへ');
    choose('ハリーの森');
    if (asks[0] && asks[0].options[1] === 'スキップ') choose('スキップ');   // はじめて 行くときの 話
    run(1300);
    const p = s.player;
    let drops = 0;
    for (let n = 0; n < 30; n++) {
        const dx = [1, -1].find(d => D.canMove(s.map, p.x, p.y, d, 0));
        const e = game.makeEnemy('donguriko', 1, p.x + dx, p.y);
        e.hp = 1;
        s.enemies.splice(0, s.enemies.length, e);
        s.items.length = 0;
        p.dir = [dx, 0];
        p.hp = p.stats.hp;
        for (let i = 0; i < 6 && s.enemies.length; i++) { game.attack(); run(800); }
        if (s.items.some(i => i.item.id === 'acorn_shell')) drops++;
    }
    assert.ok(drops > 2 && drops < 25, `30 体のうち ${drops} 体が落とした`);
});

test('セーブして、つづきから遊べる。ダンジョンの中なら、やめた場所から (オートセーブ)', () => {
    const a = newGame();
    a.s.player.money = 4321;
    a.s.town.bp = 7;
    a.s.player.tree.push('attacker2');
    a.game.state.roster.push(a.game.makeAlly('pekorisu', 3));
    a.choose('家');
    a.choose('セーブする');
    const b = setup({}, { fresh: false });
    b.choose('つづきから');
    assert.equal(b.s.phase, 'town');
    assert.equal(b.s.player.money, 4321);
    assert.equal(b.s.town.bp, 7);
    assert.equal(b.s.player.stats.atk, U.heroStats('koori', 1, 'attacker').atk + 2, 'バトルツリーの能力も戻る');
    assert.equal(b.s.roster[0].kind, 'pekorisu');
    assert.equal(b.s.allies[0].kind, 'onioni');
    // ダンジョンの B2F で やめた
    b.choose('ダンジョンへ');
    b.choose('ハリーの森');
    if (b.asks[0] && b.asks[0].options[1] === 'スキップ') b.choose('スキップ');   // はじめて 行くときの 話
    b.run(1300);
    b.s.player.money = 50;
    const stairs = b.s.map.stairs;
    b.s.player.x = b.s.player.fx = stairs.x;
    b.s.player.y = b.s.player.fy = stairs.y;
    b.game.confirm();
    b.choose('はい');
    b.run(1300);
    assert.equal(b.s.floor, 2);
    // B2F で 何歩か歩き、HP が減り、おにおにを 操作している (オートセーブは ターンが すすむごと)
    const p = b.s.player;
    for (let i = 0; i < 6; i++) {
        const d = [[1, 0], [0, 1], [-1, 0], [0, -1]].find(([dx, dy]) => D.canMove(b.s.map, p.x, p.y, dx, dy) && !b.s.allies.some(a => a.x === p.x + dx && a.y === p.y + dy) && !b.s.enemies.some(e => e.x === p.x + dx && e.y === p.y + dy));
        if (d) b.game.moveInput(d[0], d[1]);
        b.run(400);
        while (b.asks.length) b.asks.shift().done(0);
    }
    p.hp = Math.max(1, p.hp - 5);
    b.game.switchTo(b.s.allies[0]);
    b.game.autosave(true);   // ページを閉じたとき
    const was = { x: p.x, y: p.y, hp: p.hp, turn: b.s.turn, explored: b.s.explored.reduce((n, v) => n + v, 0), tiles: Array.from(b.s.map.tiles).join(''),
        enemies: b.s.enemies.map(e => `${e.kind}@${e.x},${e.y}:${e.hp}`).sort().join(' '), leader: b.s.player.kind };
    assert.ok(was.turn > 0);
    const c = setup({}, { fresh: false });
    c.choose('つづきから');
    c.run(300);
    assert.equal(c.s.phase, 'play');
    assert.equal(c.s.floor, 2);
    const hero = c.game.heroUnit();
    assert.equal(hero.money, 50);
    assert.deepEqual([hero.x, hero.y, hero.hp], [was.x, was.y, was.hp], 'やめた場所・HP から');
    assert.equal(c.s.turn, was.turn);
    assert.equal(Array.from(c.s.map.tiles).join(''), was.tiles, '同じ地図');
    assert.equal(c.s.explored.reduce((n, v) => n + v, 0) >= was.explored, true, '見たところも のこる');
    assert.equal(c.s.enemies.map(e => `${e.kind}@${e.x},${e.y}:${e.hp}`).sort().join(' '), was.enemies, '敵も 同じ場所・HP');
    assert.equal(c.s.player.kind, was.leader, '操作していた仲間のまま');
    assert.ok(c.s.messages.some(m => /続きから/.test(m.text)));
    // そのまま 遊べる (歩ける)
    c.game.switchTo(hero);
    const t0 = c.s.turn;
    c.game.wait();
    c.run(600);
    assert.ok(c.s.turn > t0);
});

test('仲間の広場: 並べかえ (★順・役職順・Lv順) と お別れ。こおりくん・おにおに など 特別なキャラとは お別れできない', () => {
    const A = globalThis.KD.Allies;
    // ★が高いほど 仲間になりにくい
    assert.ok(A.recruitRate('haribaby') > A.recruitRate('tsukiusagi') && A.recruitRate('tsukiusagi') > A.recruitRate('takaramimic'));
    const { s, game, choose, asks } = newGame();
    s.roster.push(game.makeAlly('haribaby', 9), game.makeAlly('takaramimic', 3), game.makeAlly('nemuridake', 5), game.makeAlly('okagappa', 4));
    choose('仲間の広場');
    assert.match(asks[0].options[0], /並べかえ：仲間になった順/);
    choose('並べかえ');
    assert.match(asks[0].options[0], /★順/);
    const names = asks[0].options.slice(2, 6).map(o => o.trim());
    assert.ok(names[0].includes('タカラミミック') || names[0].includes('おかがっぱ'), names.join(' / '));
    choose('並べかえ');
    choose('並べかえ');
    assert.match(asks[0].options[0], /Lv順/);
    assert.ok(asks[0].options[2].includes('ハリベビー'), 'Lv の高い順');
    // お別れ: ハリベビーとは できる
    choose('ハリベビー');
    choose('お別れする');
    choose('はい、お別れする');
    assert.match(asks[0].message, /お別れした/);
    assert.ok(![...s.allies, ...s.roster].some(a => a.kind === 'haribaby'));
    choose('もどる');
    // おにおに (最初の仲間)・ライバル探検隊 とは お別れできない
    choose('おにおに');
    assert.ok(!asks[0].options.includes('お別れする'));
    choose('もどる');
    choose('おかがっぱ');
    assert.ok(!asks[0].options.includes('お別れする'));
});
