// 2026-10-22 の追加のテスト (音量の設定・町の図鑑・鍛冶屋の倉庫・途中の ストーリーデモ)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// 町の道で 来る人は Math.random で 決まるので、テストでは 乱数を 固定する (毎回 同じ 結果に)
let seed = 12345;
Math.random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'enemies.js', 'items.js', 'dungeons.js', 'collection.js', 'allies.js', 'enemies9.js', 'enemies10.js', 'enemies11.js', 'town.js', 'art.js', 'bigart.js', 'enemyart.js', 'enemyart9.js', 'enemyart10.js', 'enemyart11.js', 'sound.js', 'config.js', 'market.js', 'townui.js', 'game.js']) vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
const { Sound: S, Dungeons: DG } = globalThis.KD;

// 描いた 回数を 数える canvas (こわれずに 描けるかを 見る)
let drawn = 0;
const ctx = new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }) }, {
    get: (t, k) => (k in t ? t[k] : k === 'fillRect' ? () => { drawn++; } : () => {}), set: (t, k, v) => { t[k] = v; return true; }
});

function newGame(opts = {}) {
    store.clear();
    const asks = [];
    const ui = { ask: (message, options, done, extra) => asks.push({ message, options, done, extra }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: () => ctx }, ui, { seed: 321, things: false, recruit: false, unlockAll: true, market: false, happen: false, ...opts });
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
    assert.match(asks[0].message, /1日目/);
    return { game, s: game.state, run, asks, choose };
}

test('音量: BGM と 効果音を 0〜10 で 変えられ、おぼえる。BGM は 前より 大きい', () => {
    const before = S.volume();
    assert.ok(before.bgm >= 7, 'ふつうの BGM の 目もり');
    S.setVolume('bgm', 3);
    S.setVolume('se', 99);
    assert.deepEqual(S.volume(), { bgm: 3, se: S.VOL_MAX });
    assert.deepEqual(JSON.parse(store.get('koori-dungeon-volume')), { bgm: 3, se: 10 });
    S.setVolume('bgm', -5);
    assert.equal(S.volume().bgm, 0);
    S.setVolume('bgm', before.bgm);
    S.setVolume('se', before.se);
    // 裏に 回ったとき おくれた音を まとめて 鳴らさない / ほかの タブで 鳴ったら 止める
    const src = readFileSync(new URL('../js/sound.js', import.meta.url), 'utf8');
    assert.ok(src.includes('if (next < ctx.currentTime) next = ctx.currentTime + 0.05;'));
    assert.ok(src.includes("visibilitychange") && src.includes('BroadcastChannel'));
});

test('設定: 町と タイトルと 家から 開ける。押すと 目もりが 変わり、同じ ところに カーソルが 残る', () => {
    const { asks, choose } = newGame();
    const v = S.volume().bgm;
    assert.ok(asks[0].options.includes('設定') && asks[0].options.includes('図鑑'));
    choose('設定');
    assert.match(asks[0].message, /音の設定/);
    choose('BGM を 小さく');
    assert.equal(S.volume().bgm, v - 1);
    assert.equal(asks[0].extra.index, 1);
    assert.match(asks[0].message, new RegExp(`BGM.*${v - 1}`));
    choose('BGM を 大きく');
    assert.equal(S.volume().bgm, v);
    const on = S.isOn();
    choose(on ? '音を オフ' : '音を オン');
    assert.equal(S.isOn(), !on);
    choose(on ? '音を オン' : '音を オフ');
    choose('もどる');
    assert.match(asks[0].message, /日目/);
    choose('家');
    choose('音の設定');
    assert.match(asks[0].message, /音の設定/);
    choose('もどる');
    assert.match(asks[0].message, /^家/);
});

test('町の 図鑑: 町の メニューから 開けて、もどると 町に もどる', () => {
    const { asks, choose, run } = newGame();
    choose('図鑑');
    assert.match(asks[0].message, /図鑑　敵/);
    choose('敵の図鑑');
    run(100);
    choose('もどる');
    choose('道具の図鑑');
    choose('もどる');
    choose('もどる');
    assert.match(asks[0].message, /日目/);
    // 家の 図鑑は 家に もどる
    choose('家');
    choose('図鑑');
    choose('もどる');
    assert.match(asks[0].message, /^家/);
});

test('鍛冶屋: 倉庫だけに ある 素材でも 作れる', () => {
    const { s, asks, choose } = newGame();
    s.player.money = 1000;
    s.town.storage.push({ id: 'soft_needle', n: 5 });
    choose('鍛冶屋');
    assert.ok(asks[0].options.some(o => o.startsWith('○ ハリの剣')));
    choose('ハリの剣');
    assert.match(asks[0].message, /倉庫から 5/);
    assert.ok(!/持ち物から/.test(asks[0].message));
    choose('作る');
    assert.match(asks[0].message, /できた/);
    assert.ok(s.player.bag.some(i => i.id === 'needle_sword'));
    assert.equal(s.town.storage.length, 0);
});

test('ストーリーデモ: 台詞から 場面が 決まる (話す人・仲間になった・新しいダンジョン・人数・影)', () => {
    const { game } = newGame();
    const T = game.town;
    const forest = DG.byId('forest');
    const sc = T.storyScenes(['ハリーの森を 突破して、SEタウンに戻った！', ...forest.story.clear], forest, 'clear').map(x => x.scene);
    assert.equal(sc[0].type, 'cleared');
    assert.deepEqual([sc[1].type, sc[1].who], ['bossDown', 'harry']);
    assert.deepEqual([sc[2].type, sc[2].who], ['talk', 'furukawa']);
    assert.deepEqual([sc[3].type, sc[3].who], ['talk', 'yasu']);
    assert.deepEqual([sc[4].type, sc[4].who], ['join', 'yasu']);
    assert.deepEqual([sc[5].type, sc[5].name, sc[5].theme], ['newDungeon', '浦の島の海岸どうくつ', 'coast']);
    const moon = DG.byId('moon');
    const mi = T.storyScenes(moon.story.intro, moon, 'intro').map(x => x.scene);
    assert.deepEqual([mi[0].type, mi[0].who], ['gate', 'furukawa']);
    assert.deepEqual([mi[1].type, mi[1].who], ['mystery', 'yahami'], '名前を 言う前は 影');
    assert.deepEqual([mi[5].type, mi[5].who], ['mystery', 'ishii']);
    const temple = DG.byId('temple');
    assert.ok(T.storyScenes(temple.story.clear, temple, 'clear').some(x => x.scene.type === 'party' && x.scene.n === 4));
    const mountain = DG.byId('mountain');
    assert.ok(T.storyScenes(mountain.story.clear, mountain, 'clear').some(x => x.scene.type === 'crack'));
    // 話す人は みんな 絵がある
    for (const d of [...DG.LIST, ...DG.EXTRA]) {
        for (const phase of ['intro', 'clear']) {
            for (const { scene } of T.storyScenes((d.story || {})[phase] || [], d, phase)) {
                if (['talk', 'join', 'bossDown'].includes(scene.type)) assert.ok(scene.who, `${d.id} ${phase}`);
            }
        }
    }
});

test('ストーリーデモ: はじめて 行く ダンジョンと、ボスを たおしたあとに 絵つきで 出る (スキップできる)', () => {
    const { s, game, asks, choose, run } = newGame();
    s.town.cleared = DG.LIST.length - 1;
    // はじめて 行く ダンジョンの 話 (全部の テーマの 絵を 描いてみる)
    for (const d of [...DG.LIST.slice(1), ...DG.EXTRA.filter(x => !x.version || x.version === s.town.version)]) {
        if (!d.story || !d.story.intro) continue;
        s.town.seen[d.id] = false;
        game.town.menu();
        while (!/日目/.test(asks[0].message)) asks.shift();
        asks.splice(1);
        choose('ダンジョンへ');
        const i = asks[0].options.findIndex(o => o.includes(d.name));
        if (i < 0) { asks.length = 0; continue; }
        asks.shift().done(i);
        assert.deepEqual(asks[0].options, ['つぎへ', 'スキップ'], d.id);
        let n = 0;
        while (asks[0] && asks[0].options[0] === 'つぎへ') {
            drawn = 0;
            run(300);
            assert.ok(drawn > 0, `${d.id}: 絵を 描いた`);
            choose('つぎへ');
            n++;
        }
        assert.equal(n, d.story.intro.length);
        run(1300);
        assert.equal(s.dungeon.id, d.id);
        asks.length = 0;
        game.town.enter('escape', { dungeon: d.name });
        asks.length = 0;
    }
    // ボスを たおした: ストーリーデモのあと 町へ
    s.town.cleared = 0;
    game.town.enter('clear', { dungeon: 'ハリーの森', id: 'forest', boss: true });
    assert.deepEqual(asks[0].options, ['つぎへ', 'スキップ']);
    run(300);
    choose('スキップ');
    assert.match(asks[0].message, /日目/);
    assert.equal(s.town.cleared, 1);
    assert.ok([...s.allies, ...s.roster].some(a => a.kind === 'yasu'));
});

test('町の道: 探検隊が 歩き、向かい側から 仲間や ふるカワたちが 来て あいさつする (吹き出し)', () => {
    const { s, game } = newGame();
    s.roster.push(game.makeAlly('haribaby', 2));
    const said = [];
    const rec = new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }), fillText: t => said.push(t) }, {
        get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; }
    });
    for (let i = 0; i < 60 * 240; i++) {   // 来る人は ランダム (おしゃべりの ときも ある) なので 長めに 見る
        fakeNow += 16;
        game.town.draw(rec, fakeNow, 384, 240);
    }
    const lines = ['クエスト、がんばってね！', '今日も いい天気だね！', 'ギルドに 新しい 依頼が 来てるよ！', 'お金返しなさい！', '内定はまだなの？', 'こおり、がんばって！', '内定とりなさい！',
        'おーい！ 今度は つれてってね！', '広場で 待ってるよ～', 'いっしょに 冒険したいな！', '修行してたんだ！'];
    assert.ok(said.some(t => lines.includes(t)), '4 分の あいだに だれかが 来て 話す');
    assert.ok(said.some(t => ['やあ！', 'イェーイ！', 'わーい！', 'どうも！', 'ありがとう！'].includes(t)), '探検隊が 返事をする');
});

test('ストーリーの 書き出し (docs/story.md) が ゲームの データと 同じ', async () => {
    const { spawnSync } = await import('node:child_process');
    const { fileURLToPath } = await import('node:url');
    const r = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/export-story.mjs', import.meta.url)), '--check']);
    assert.equal(r.status, 0, 'node tools/export-story.mjs で 書き出しなおす');
});

test('町の道: 天気が 日ごとに かわり、ライバル・おにおにの 取り立て・仲間の おしゃべりも ある', () => {
    const { s, game, asks } = newGame();
    const names = new Set();
    for (let d = 1; d <= 30; d++) {
        s.town.day = d;
        game.town.menu();
        names.add(/日目（(.+?)）/.exec(asks[asks.length - 1].message)[1]);
    }
    assert.ok(names.size >= 4, [...names].join('・'));
    // おにおにを 広場で 待たせて、ライバルに 会ったことにする
    s.roster.push(...s.allies.splice(0));
    s.allies.push(game.makeAlly('haribaby', 2));
    s.town.seen.moon = true;
    const said = [];
    const rec = new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }), fillText: t => said.push(t) }, {
        get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; }
    });
    for (let i = 0; i < 60 * 600; i++) {
        fakeNow += 16;
        game.town.draw(rec, fakeNow, 384, 240);
    }
    assert.ok(said.some(t => ['金返せ！', '利子が ついてるぞ！'].includes(t)), 'おにおにの 取り立て');
    assert.ok(said.includes('とほほ……'));
    assert.ok(said.some(t => ['ブヒッ！ 次は 負けないぞ！', 'お宝の においが するわね♪', 'ワォーン！', '……修行が 足りんな', 'チョッキン♪ 前髪 そろえてあげる？', 'ニャハッ。お財布 ちょうだい♪',
        'ダンジョンは おれたちの 家だ！', '美しさに 磨きを かけてるの', 'お宝も 前髪も きれいに ね', 'ダンジョンで また 会おうね♪', '迷宮の 奥で 待っている', '夜の 迷宮は おれたちの もの'].includes(t)), 'ライバル');
    assert.ok(said.some(t => ['おなか すいたね', '次は どこへ 行く？', 'あの お店 気になる！', '借金、あと どれくらい？'].includes(t)), '仲間の おしゃべり');
});

test('ボスに 会ったときの 台詞は ダンジョンの中で 絵つき (phase は play の まま)', () => {
    const { s, game, asks, choose, run } = newGame();
    choose('ダンジョンへ');
    choose('ハリーの森');
    choose('スキップ');
    run(1300);
    asks.length = 0;
    const d = DG.byId('forest');
    let done = false;
    game.town.bossTalk(d.story.boss, d, () => { done = true; });
    assert.equal(s.phase, 'play');
    assert.ok(s.demo);
    const sc = game.town.storyScenes(d.story.boss, d, 'boss').map(x => x.scene.type);
    assert.deepEqual(sc, ['bossAppear', 'talk']);
    drawn = 0;
    run(300);
    assert.ok(drawn > 0);
    choose('つぎへ');
    choose('つぎへ');
    assert.ok(done && !s.demo && s.phase === 'play');
});

test('天気: その日の わざの 属性に 倍率が かかる (雨は みず 1.3 倍・ほのお 0.7 倍 など)', () => {
    const TW = globalThis.KD.Town, U = globalThis.KD.Units;
    const days = {};
    for (let d = 1; d <= 60; d++) days[TW.weatherOf(d).id] = days[TW.weatherOf(d).id] || d;
    assert.deepEqual(Object.keys(days).sort(), ['cloudy', 'evening', 'rain', 'snow', 'sunny']);
    assert.equal(TW.weatherBoost(days.rain, 'みず'), 1.3);
    assert.equal(TW.weatherBoost(days.rain, 'ほのお'), 0.7);
    assert.equal(TW.weatherBoost(days.snow, 'こおり'), 1.3);
    assert.equal(TW.weatherBoost(days.sunny, 'こおり'), 1);
    assert.equal(TW.weatherBoost(days.rain, null), 1, 'ふつうの 攻撃は かわらない');
    const fixed = () => ({ next: () => 0.5 });
    const a = U.hitDamage(fixed(), 100, 50, { element: 'みず' }).dmg, b = U.hitDamage(fixed(), 100, 50, { element: 'みず', weather: 1.3 }).dmg;
    assert.equal(b, Math.round(a * 1.3));
    // 町の メニューと ダンジョンに 入ったときに 出る
    const { s, game, asks, choose, run } = newGame();
    s.town.day = days.rain;
    game.town.menu();
    assert.match(asks[asks.length - 1].message, /日目（雨：みずの わざ 1.3 倍・ほのおの わざ 0.7 倍）/);
    asks.splice(0, asks.length - 1);
    choose('ダンジョンへ');
    choose('ハリーの森');
    choose('スキップ');
    run(1300);
    assert.ok(s.messages.some(m => /今日の 天気は 雨/.test(m.text)));
});

test('図鑑の 説明 (js/profiles.js): 前作の キャラは みんな ゲームに いて、肩書きと 説明が ある', () => {
    vm.runInThisContext(readFileSync(new URL('../js/profiles.js', import.meta.url), 'utf8'));
    const { Profiles: P, Units: U, Art: A } = globalThis.KD;
    const ids = Object.keys(P);
    assert.ok(ids.length >= 28);
    for (const id of ids) {
        assert.ok(U.ENEMIES[id] || U.HEROES[id] || A.SPRITES[id], id);
        assert.ok(P[id].title && P[id].text.length > 20, id);
        assert.ok(!/摩天楼に挑む|摩天楼についてきた。$/.test(P[id].text), `${id}: 今作に 合わせた`);
    }
    for (const id of ['furukawa', 'tomoishi', 'koori', 'onioni', 'harry', 'maou']) assert.ok(P[id], id);
});

test('曲: どの 曲にも B メロが ある (A → B → A → B で 長く)', () => {
    for (const [name, s] of Object.entries(globalThis.KD.Sound.SONGS)) {
        assert.equal(s.b.length, 16, name);
        assert.equal(s.bb.length, 4, name);
    }
});
