// 2026-10-23 の追加のテスト (特訓場・遠征所。実際の 時間の かわりに opts.clock で 時計を すすめる)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'enemies.js', 'items.js', 'dungeons.js', 'collection.js', 'allies.js', 'enemies9.js', 'enemies10.js', 'enemies11.js', 'town.js', 'art.js', 'bigart.js', 'enemyart.js', 'enemyart9.js', 'enemyart10.js', 'enemyart11.js', 'sound.js', 'config.js', 'market.js', 'specials.js', 'profiles.js', 'townui.js', 'motion.js', 'arena.js', 'game.js']) vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
const { Town: TW, Dungeons: DG, Units: U } = globalThis.KD;
const MIN = 60 * 1000;

const noop = () => {};
const ctx = new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }) }, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });

// 町から 始める。clock.ms を すすめると 実際の 時間が たったことに なる
function townGame() {
    store.clear();
    const clock = { ms: 1e12 };
    const asks = [];
    const ui = { ask: (message, options, done, extra) => asks.push({ message, options, done, extra }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: () => ctx }, ui, { seed: 321, things: false, recruit: false, unlockAll: true, market: false, happen: false, clock: () => clock.ms });
    const run = ms => { for (let i = 0; i < ms; i += 16) { fakeNow += 16; game.draw(fakeNow); } };
    const choose = label => {
        const q = asks.shift();
        assert.ok(q, `「${label}」をえらぶ画面がない`);
        const i = typeof label === 'number' ? label : q.options.findIndex(o => o.startsWith(label) || o.includes(label));
        assert.ok(i >= 0, `「${label}」がない: ${q.options.join(' / ')}`);
        q.done(i);
    };
    choose('はじめから');
    choose('こおりくん');
    for (let i = 0; i < 5; i++) choose('つぎへ');
    return { game, s: game.state, asks, choose, run, clock };
}

test('コーチの 中身: キャラごとに 上がる 能力 2 つと はやさ (★で きまる)', () => {
    const fast = TW.coachOf('haribaby'), slow = TW.coachOf('onioni');
    assert.equal(fast.speed, 'fast');
    assert.equal(slow.speed, 'slow');
    assert.ok(fast.minutes < slow.minutes && fast.stat < slow.stat, 'おそい コーチほど たくさん 上がる');
    assert.equal(fast.stats.length, 2);
    assert.deepEqual(TW.coachOf('haribaby'), fast, 'いつも 同じ');
    assert.notDeepEqual(TW.coachOf('donguriko').stats, fast.stats, 'キャラで ちがう');
    assert.match(TW.coachText('haribaby'), /が 上がる　はやさ：はやい（15 分）/);
});

test('特訓の 結果: けいけんちと 能力。ときどき コーチの わざを 受け継ぐ', () => {
    const { game } = townGame();
    const coach = game.makeAlly('haribaby', 10), trainee = game.makeAlly('donguriko', 3);
    const yes = { chance: () => true, pick: a => a[0] }, no = { chance: () => false, pick: a => a[0] };
    const r = TW.trainResult(no, coach, trainee);
    assert.equal(r.exp, U.expToNext(3), 'はやい コーチは Lv 1 つぶん');
    assert.equal(Object.keys(r.bonus).length, 2);
    assert.equal(r.skill, null);
    const r2 = TW.trainResult(yes, coach, trainee);
    assert.ok(r2.skill && coach.skills.some(k => k.id === r2.skill) && !trainee.skills.some(k => k.id === r2.skill), '持っていない わざを 受け継ぐ');
    assert.ok(!U.SKILLS[r2.skill].role, '役職の わざは 受け継がない');
});

test('特訓場: コーチと 特訓する キャラを えらぶ → 時間が たつと 結果 → 強くなって 広場に もどる', () => {
    const { game, s, asks, choose, clock } = townGame();
    s.roster.push(game.makeAlly('haribaby', 8), game.makeAlly('donguriko', 4));
    const trainee = s.roster[1];
    const lv = trainee.lv, def = trainee.stats.def;
    choose('特訓場');
    assert.match(asks[0].message, /コーチを えらぶ/);
    assert.ok(asks[0].options.some(o => o.includes('ハリベビー') && o.includes('はやさ：はやい')));
    choose('ハリベビー');
    choose('ドングリコ');
    assert.match(asks[0].message, /15 分/);
    choose('特訓を はじめる');
    assert.ok(!s.roster.some(a => a.kind === 'donguriko' || a.kind === 'haribaby'), '特訓中は 広場に いない');
    choose('もどる');
    assert.match(asks[0].message, /特訓場：ドングリコ（コーチ ハリベビー）あと 15 分/, '町の メニューに 残り時間');
    // まだ 終わらない
    clock.ms += 10 * MIN;
    choose('特訓場');
    assert.match(asks[0].message, /あと 5 分/);
    choose('もどる');
    // 終わった → 町の メニューの 前に 結果
    clock.ms += 6 * MIN;
    asks.shift();
    game.town.menu();
    assert.match(asks[0].message, /特訓が 終わった！（コーチ ハリベビー）/);
    assert.match(asks[0].message, new RegExp(`ドングリコ Lv${lv} → Lv${lv + 1}`));
    choose('つぎへ');
    assert.match(asks[0].message, /日目/);
    const back = s.roster.find(a => a.kind === 'donguriko');
    assert.ok(back && s.roster.some(a => a.kind === 'haribaby'), '2 人とも 広場に もどった');
    assert.ok(back.lv > lv);
    assert.ok(back.bonus && Object.values(back.bonus).every(v => v > 0));
    assert.ok(back.stats.def > def, 'ぼうぎょ (得意) が 上がった');
    // セーブしても 特訓の 能力は 残る
    game.town.save();
    const data = JSON.parse([...store.values()].find(v => v.includes('"roster"')));
    assert.deepEqual(data.roster.find(d => d.kind === 'donguriko').bonus, back.bonus);
});

test('遠征所: 5 人までの チームを クリアした ダンジョンへ。時間が たつと けいけんち・道具 (倉庫へ)・お金', () => {
    const { game, s, asks, choose, clock } = townGame();
    s.town.cleared = 1;   // ハリーの森を クリア
    const allies = ['haribaby', 'donguriko', 'nemuridake', 'pekorisu', 'tsutankobu', 'mumenbachi'].map(k => game.makeAlly(k, 2));
    s.roster.push(...allies);
    const money0 = s.player.money, stor0 = s.town.storage.length;
    choose('遠征所');
    assert.match(asks[0].message, /チーム 1\/3/);
    choose('チーム 1：あき');
    for (const name of ['ハリベビー', 'ドングリコ', 'ネムリダケ', 'ペコリス', 'ツタンコブ', 'ムメンキョバチ']) choose(name);
    assert.match(asks[0].message, /5\/5 人/, '5 人まで');
    choose('行き先を えらぶ');
    assert.deepEqual(asks[0].options.slice(0, -1).map(o => o.split('（')[0]), ['ハリーの森'], 'クリアした ダンジョンだけ');
    const mins = TW.expeditionMinutes(DG.LIST[0]);
    assert.ok(asks[0].options[0].includes(`${mins} 分`));
    choose('ハリーの森');
    assert.match(asks[0].message, /出発した/);
    assert.deepEqual(s.roster.map(r => r.kind), ['mumenbachi'], '6 人目 (ムメンキョバチ) だけ 残った');
    assert.ok(s.allies.some(r => r.kind === 'onioni'), 'えらばなかった おにおには いっしょに 行く 列の まま');
    choose('もどる');
    assert.match(asks[0].message, /遠征 1：ハリーの森　あと \d+ 分/);
    clock.ms += mins * MIN;
    asks.shift();
    game.town.menu();
    assert.match(asks[0].message, /遠征チームが ハリーの森から 帰ってきた！/);
    assert.match(asks[0].message, /道具（倉庫へ）：/);
    choose('つぎへ');
    assert.ok(s.player.money > money0, 'お金');
    assert.ok(s.town.storage.length > stor0, '道具は 倉庫に');
    const back = allies.slice(0, 5).map(a => s.roster.find(r => r.kind === a.kind));
    assert.ok(back.every(a => a && a.lv > 2), '5 人とも けいけんちで Lv が 上がって もどった');
});

test('遠征所: チームは お金で ふやせる (3 つまで)。呼びもどすと 何も 手に入らない', () => {
    const { game, s, asks, choose } = townGame();
    s.town.cleared = 1;
    s.roster.push(game.makeAlly('haribaby', 2));
    s.player.money = 50000;
    choose('遠征所');
    choose('チームを ふやす');
    assert.equal(s.player.money, 50000 - TW.TEAM_PRICE[1]);
    choose('チームを ふやす');
    assert.equal(s.town.expTeams, 3);
    assert.ok(!asks[0].options.some(o => o.startsWith('チームを ふやす')), '3 つで おわり');
    choose('チーム 2：あき');
    choose('ハリベビー');
    choose('行き先を えらぶ');
    choose('ハリーの森');
    choose('もどる');
    choose('遠征所');
    choose('チーム 1：ハリーの森');
    const stor = s.town.storage.length;
    choose('呼びもどす');
    assert.ok(s.roster.some(a => a.kind === 'haribaby'));
    assert.equal(s.town.storage.length, stor);
    assert.equal(s.town.expeditions.length, 0);
});

test('出かけている 仲間も セーブに 残り、「持っている」 ことに なる (ストーリーの 仲間が ふえない)', () => {
    const { game, s, choose } = townGame();
    s.town.cleared = 1;
    s.roster.push(game.makeAlly('haribaby', 2));
    choose('遠征所');
    choose('チーム 1：あき');
    choose('ハリベビー');
    choose('行き先を えらぶ');
    choose('ハリーの森');
    choose('もどる');
    game.town.save();
    const data = JSON.parse([...store.values()].find(v => v.includes('"roster"')));
    assert.equal(data.town.expeditions[0].members[0].kind, 'haribaby');
    assert.ok(!data.roster.some(d => d.kind === 'haribaby'));
});

test('鍛冶屋: 持ち物拡張ボックス (+5・100 まで)・倉庫拡張マシン (+30・1 万 まで 足せる)。作ると すぐ 効く', () => {
    const { s, asks, choose } = townGame();
    const I = globalThis.KD.Items;
    const p = s.player;
    p.money = 1e7;
    const stock = () => s.town.storage.push({ id: 'fluffy_fur', n: 99 }, { id: 'tough_vine', n: 99 }, { id: 'acorn_shell', n: 999 }, { id: 'soft_needle', n: 999 });
    stock();
    assert.equal(I.bagMax(s.town), 24);
    assert.equal(I.storageMax(s.town), 200);
    choose('鍛冶屋');
    assert.match(asks[0].message, /持ち物 24 こ まで・倉庫 200 こ まで/);
    choose('○ 持ち物拡張ボックス');
    assert.match(asks[0].message, /1,000えん/);
    choose('作る');
    assert.match(asks[0].message, /持ち物を 29 こ まで 持てるように なった！/);
    assert.ok(!p.bag.some(it => it.id === 'bag_box') && !s.town.storage.some(it => it.id === 'bag_box'), '道具としては 残らない');
    assert.equal(p.money, 1e7 - 1000);
    choose('もどる');
    choose('○ 倉庫拡張マシン');
    choose('作る');
    assert.match(asks[0].message, /倉庫に 230 こ まで/);
    choose('もどる');
    assert.equal(I.storageMax(s.town), 230);
    // 100 こ まで (15 回 で 99、16 回めで 100)。そのあとは 作れない
    for (let i = 0; i < 15; i++) {
        choose('持ち物拡張ボックス');
        choose('作る');
        choose('もどる');
    }
    assert.equal(I.bagMax(s.town), 100);
    assert.ok(asks[0].options.some(o => o.startsWith('× 持ち物拡張ボックス') && o.includes('もう ひろげられない')));
    choose('持ち物拡張ボックス');
    assert.match(asks[0].message, /これ以上は ひろげられない/);
    choose('もどる');
    // 倉庫は 足すのが 1 万 まで
    s.town.storagePlus = I.STORAGE_PLUS_LIMIT - 10;
    choose('倉庫拡張マシン');
    choose('作る');
    assert.equal(I.storageMax(s.town), 200 + 10000);
    choose('もどる');
    assert.ok(asks[0].options.some(o => o.startsWith('× 倉庫拡張マシン')));
});

test('ひろげた 持ち物は 町でも 25 こ目が 入り、セーブに 残る', () => {
    const { game, s } = townGame();
    s.town.bagPlus = 5;
    const p = s.player;
    while (p.bag.length < 24) p.bag.push({ id: 'onigiri', n: 1 });
    game.town.giveItem({ id: 'onigiri', n: 1 }, true);
    assert.equal(p.bag.length, 25, '町でも 持ち物に 入る');
    game.town.save();
    const data = JSON.parse([...store.values()].find(v => v.includes('"roster"')));
    assert.equal(data.town.bagPlus, 5, 'セーブに 残る');
});
