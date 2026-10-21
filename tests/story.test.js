// 段階 7 のテスト (ダンジョン 7 つ・ボス・ストーリー・施設の開放・敵のとくちょう・交易所のオンライン)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'units.js', 'enemies.js', 'items.js', 'dungeons.js', 'town.js', 'art.js', 'bigart.js', 'enemyart.js', 'config.js', 'market.js', 'townui.js', 'game.js']) {
    vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
}
const { Units: U, Items: I, Town: TW, Dungeon: D, Dungeons: DG, createRng } = globalThis.KD;

const fakeCtx = () => new Proxy({ measureText: t => ({ width: t.length * 9 }), createLinearGradient: () => ({ addColorStop() {} }) }, {
    get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; }
});

// ゲームを作る。town: true ならタイトルから町まで進める。それ以外は すぐダンジョン
function setup(opts = {}, { town = false } = {}) {
    store.clear();
    const asks = [];
    const ui = { ask: (message, options, done) => asks.push({ message, options, done }), asking: () => asks.length > 0 };
    const base = town ? { seed: 99, things: false, recruit: false, market: false } : { seed: 4321, things: false, partner: false, recruit: false, start: 'dungeon', save: false, market: false };
    const game = globalThis.KD.createGame({ getContext: fakeCtx }, ui, { ...base, ...opts });
    const run = ms => { for (let i = 0; i < ms; i += 16) { fakeNow += 16; game.draw(fakeNow); } };
    const choose = label => {
        const q = asks.shift();
        assert.ok(q, `「${label}」をえらぶ画面がない`);
        const i = q.options.findIndex(o => o.includes(label));
        assert.ok(i >= 0, `「${label}」がない: ${q.options.join(' / ')}`);
        q.done(i);
    };
    if (town) {
        choose('はじめから');
        choose('こおりくん');
        for (let i = 0; i < 5; i++) choose('つぎへ');
    } else {
        choose('こおりくん');
        run(1300);
    }
    return { game, s: game.state, run, asks, choose };
}

// 主人公を部屋のまんなかへ。となり (右) を返す
function center(s) {
    const room = s.map.rooms.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    const p = s.player;
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
        if (D.at(s.map, x, y) === D.FLOOR && D.at(s.map, x + 1, y) === D.FLOOR && D.at(s.map, x - 1, y) === D.FLOOR) {
            p.x = p.fx = x;
            p.y = p.fy = y;
            s.visible = D.visibleFrom(s.map, x, y);
            return;
        }
    }
}

test('ダンジョンは 7 つ。どの階も つながっていて、出る敵がいる。ボスは いちばん下の階', () => {
    assert.deepEqual(DG.LIST.map(d => d.floors), [5, 8, 10, 12, 15, 18, 25]);
    for (const d of DG.LIST) {
        for (let f = 1; f <= d.floors; f++) {
            const table = DG.tableFor(d, f);
            assert.ok(table.length >= 2 && table.every(k => U.ENEMIES[k]), `${d.name} B${f}F`);
            const m = D.generate(createRng(f * 31 + d.floors), { pool: d.pool });
            const { count, seen } = D.reachable(m, m.start.x, m.start.y);
            const n = m.tiles.reduce((c, t) => c + (t !== D.WALL && t !== D.WATER ? 1 : 0), 0);
            assert.equal(count, n, `${d.name} B${f}F: 行けない床がある`);
            assert.ok(seen[m.stairs.y * m.w + m.stairs.x]);
        }
        assert.ok(U.ENEMIES[d.boss].boss);
        assert.ok(DG.levelFor(d, d.floors) >= DG.levelFor(d, 1));
    }
    // 深いダンジョンほど 敵が強い
    const lv = DG.LIST.map(d => DG.levelFor(d, d.floors));
    lv.slice(1).forEach((v, i) => assert.ok(v > lv[i]));
});

test('いちばん下の階には ボスがいて、たおすまで階段を使えない。会うと台詞', () => {
    const { s, game, run, asks, choose } = setup({ enemies: true });
    s.floor = 4;
    // B5F へ
    const { x, y } = s.map.stairs;
    s.player.x = s.player.fx = x;
    s.player.y = s.player.fy = y;
    game.confirm();
    choose('はい');
    run(1300);
    assert.equal(s.floor, 5);
    const boss = s.boss;
    assert.ok(boss && boss.kind === 'harry');
    assert.ok(s.enemies.includes(boss));
    // 階段に乗っても 進めない
    s.player.x = s.player.fx = s.map.stairs.x;
    s.player.y = s.player.fy = s.map.stairs.y;
    s.enemies.splice(0, s.enemies.length, boss);
    s.visible = D.visibleFrom(s.map, s.player.x, s.player.y);
    game.confirm();
    assert.equal(asks.length, 0, '「降りますか？」と聞かない');
    assert.ok(s.messages.some(m => /たおさないと/.test(m.text)));
    // 見えると 目をさまして 台詞
    game.wait();
    run(500);
    assert.equal(boss.awake, true);
    assert.match(asks[0].message, /ハリー/);
    while (asks.length) choose('つぎへ');
    // たおすと 階段が使える
    boss.hp = 1;
    const dx = Math.sign(boss.x - s.player.x) || 1, dy = Math.sign(boss.y - s.player.y);
    boss.x = boss.fx = s.player.x + dx;
    boss.y = boss.fy = s.player.y + dy;
    if (!D.canMove(s.map, s.player.x, s.player.y, dx, dy)) { boss.x = boss.fx = s.player.x; boss.y = boss.fy = s.player.y + 1; }
    s.player.dir = [boss.x - s.player.x, boss.y - s.player.y];
    for (let i = 0; i < 8 && boss.hp > 0; i++) {
        boss.x = boss.fx = s.player.x + s.player.dir[0];
        boss.y = boss.fy = s.player.y + s.player.dir[1];
        boss.anim = null;
        game.attack();
        run(900);
        while (asks.length) choose(asks[0].options[0]);
    }
    assert.equal(boss.hp, 0);
    assert.equal(s.bossDown, true);
    game.confirm();
    assert.match(asks[0].message, /抜けられそう/);
});

test('ボスをたおして突破すると ストーリーが進む: 仲間が増え、次のダンジョンが現れる。4 人・5 人で行けるようになる', () => {
    const { s, game, run, asks, choose } = setup({}, { town: true });
    assert.equal(s.town.cleared, 0);
    choose('ダンジョンへ');
    assert.deepEqual(asks[0].options.slice(0, -1).map(o => o.trim()), ['ハリーの森（5 階）']);
    choose('ハリーの森');
    run(1300);
    // ボスをたおしたことにして 突破
    s.bossDown = true;
    s.floor = 5;
    game.state.boss = null;
    s.player.x = s.player.fx = s.map.stairs.x;
    s.player.y = s.player.fy = s.map.stairs.y;
    game.confirm();
    choose('はい');
    run(1300);
    assert.equal(s.phase, 'town');
    // ストーリー: やすさんが仲間に
    assert.match(asks[0].message, /突破/);
    choose('つぎへ');
    assert.match(asks[0].message, /ハリー/);
    while (!/日目/.test(asks[0].message)) choose('つぎへ');
    assert.equal(s.town.cleared, 1);
    assert.ok([...s.allies, ...s.roster].some(a => a.kind === 'yasu' && a.role === 'healer'));
    choose('ダンジョンへ');
    assert.ok(asks[0].options.some(o => o.includes('浦の島の海岸どうくつ')));
    assert.ok(asks[0].options[0].startsWith('★'), '突破したダンジョンに ★');
    choose('やめる');
    // 人数: 3 → ネット寺のあと 4 → 月の迷宮のあと 5
    assert.equal(DG.partyMax(0), 3);
    assert.equal(DG.partyMax(3), 4);
    assert.equal(DG.partyMax(5), 5);
    // はじめて行くダンジョンでは ふるカワから ひとこと
    choose('ダンジョンへ');
    choose('浦の島');
    assert.match(asks[0].message, /ふるカワ/);
    choose('つぎへ');
    run(1300);
    assert.equal(s.dungeon.id, 'coast');
});

test('施設は 借金を返していくと開く。開いたら おにおにが教えてくれる', () => {
    const { s, asks, choose } = setup({}, { town: true });
    assert.ok(asks[0].options.some(o => o.startsWith('鍛冶屋（あと 20,000えん）')));
    choose('鍛冶屋');
    assert.match(asks[0].message, /使わせてやる/);
    choose('もどる');
    s.player.money = 30000;
    choose('借金返済所');
    choose('10,000えん');
    assert.match(asks[0].message, /バトルツリーを 使っていいぞ/);
    assert.match(asks[0].message, /倉庫を 使っていいぞ/);
    choose('もどる');
    choose('やめる');
    assert.ok(asks[0].options.includes('バトルツリー'));
    assert.ok(asks[0].options.some(o => o.startsWith('交易所（あと')));
    assert.deepEqual(Object.keys(TW.UNLOCK), ['storage', 'plaza', 'tree', 'smith', 'trade']);
});

test('クエストは 行けるダンジョンから出る。深いダンジョンほど ごほうびが多い', () => {
    const board = TW.questBoard(createRng(5), 1, { dungeons: DG.LIST.slice(0, 3) });
    for (const q of board) assert.ok(['forest', 'coast', 'temple'].includes(q.dungeon));
    let forest = 0, aso = 0;
    for (let i = 0; i < 40; i++) {
        forest += TW.questBoard(createRng(i), 1, { dungeons: [DG.LIST[0]] }).reduce((n, q) => n + q.money, 0);
        aso += TW.questBoard(createRng(i), 1, { dungeons: [DG.LIST[6]] }).reduce((n, q) => n + q.money, 0);
    }
    assert.ok(aso > forest);
});

// ----- 敵のとくちょう -----
function withEnemy(kind, opts = {}) {
    const t = setup({ enemies: true, dungeon: opts.dungeon || 'forest' });
    center(t.s);
    const p = t.s.player;
    const e = t.game.makeEnemy(kind, opts.lv || 3, p.x + (opts.dx ?? 1), p.y);
    e.awake = opts.awake ?? true;
    t.s.enemies.splice(0, t.s.enemies.length, e);
    p.dir = [1, 0];
    p.stats.hp = p.hp = 999;
    return { ...t, e, p };
}

test('とくちょう: 分裂する (スパムダマ)・1 回だけ復活する (ナンドモスライム)', () => {
    const a = withEnemy('spamdama');
    a.e.stats.hp = a.e.hp = 999;
    for (let i = 0; i < 20 && a.s.enemies.length < 2; i++) { a.game.attack(); a.run(800); }
    assert.ok(a.s.enemies.length >= 2, '分裂した');
    const b = withEnemy('nandomoslime');
    b.e.hp = 1;
    for (let i = 0; i < 6 && !b.e.revived; i++) { b.e.x = b.e.fx = b.p.x + 1; b.e.y = b.e.fy = b.p.y; b.game.attack(); b.run(800); }
    assert.equal(b.e.revived, true);
    assert.ok(b.e.hp > 0, '復活した');
});

test('とくちょう: 爆発する (バクダンジロウ)・化けている (カワリミダヌキ)', () => {
    const a = withEnemy('bakudanjirou');
    a.e.hp = Math.floor(a.e.stats.hp * 0.4);
    a.e.stats.def = 0;
    const hp = a.p.hp;
    for (let i = 0; i < 6 && a.s.enemies.length; i++) { a.e.x = a.e.fx = a.p.x + 1; a.e.y = a.e.fy = a.p.y; a.game.attack(); a.run(900); }
    assert.equal(a.s.enemies.length, 0);
    assert.ok(a.p.hp < hp || a.s.messages.some(m => /ドカーン/.test(m.text)), '爆発した');
    const b = withEnemy('kawarimidanuki', { awake: false, dx: 3 });
    assert.equal(b.e.awake, false, 'はじめは 化けている');
    b.game.wait();
    b.run(500);
    assert.equal(b.e.awake, false, 'はなれていると 動かない');
    b.e.x = b.e.fx = b.p.x + 1;
    b.game.wait();
    b.run(500);
    assert.equal(b.e.awake, true);
    assert.ok(b.s.messages.some(m => /化けていた/.test(m.text)));
});

test('とくちょう: 壁の中を通る (ルナシャドウ)・泳げる敵だけ 水に入れる', () => {
    const a = withEnemy('lunashadow');
    const map = a.s.map;
    // 壁のマスに置いても 近づいてくる
    let wall = null;
    for (let y = 2; y < map.h - 2 && !wall; y++) for (let x = 2; x < map.w - 2; x++) if (D.at(map, x, y) === D.WALL && Math.abs(x - a.p.x) + Math.abs(y - a.p.y) > 6) { wall = [x, y]; break; }
    [a.e.x, a.e.y] = [a.e.fx, a.e.fy] = wall;
    a.e.seen = [a.p.x, a.p.y];
    const d0 = Math.max(Math.abs(a.e.x - a.p.x), Math.abs(a.e.y - a.p.y));
    for (let i = 0; i < 3; i++) { a.game.wait(); a.run(400); }
    assert.ok(Math.max(Math.abs(a.e.x - a.p.x), Math.abs(a.e.y - a.p.y)) < d0);
    // 水
    const m = D.generate(createRng(3), { pool: { tile: D.WATER, chance: 1 } });
    const i = m.tiles.indexOf(D.WATER);
    const wx = i % m.w, wy = Math.floor(i / m.w);
    assert.equal(D.walkable(m, wx, wy), false);
    assert.equal(D.walkable(m, wx, wy, true), true);
    assert.ok(U.ENEMIES.kogame.traits.includes('swim'));
});

test('溶岩の上にいると ダメージ (こおりくんは 2 倍、ほのおの敵は へいき)。こおりくんは こおり状態にならない', () => {
    const { s, game, run, p } = withEnemy('magmatcho', { dungeon: 'mountain', dx: 5, awake: false });
    s.enemies[0].ai = 'wait';
    s.map.tiles[p.y * s.map.w + p.x] = D.LAVA;
    const e = s.enemies[0];
    s.map.tiles[e.y * s.map.w + e.x] = D.LAVA;
    const hp = p.hp, ehp = e.hp;
    game.wait();
    run(400);
    // 溶岩のダメージ (こおりくんは 2 倍) から、同じターンに歩いて戻った分を引く
    assert.equal(hp - p.hp, Math.floor(p.stats.hp / 20) * 2 - Math.floor(p.stats.hp / 80));
    assert.equal(e.hp, ehp);
    assert.ok(p.immune.includes('freeze'));
});

test('とくちょう: 仲間を回復 (ツキウサギ)・仲間を呼ぶ (ツボマジン)・お金を取る (シャッキンボウレイ)', () => {
    const a = withEnemy('tsukiusagi', { dx: 4 });
    const o = a.game.makeEnemy('haribaby', 3, a.p.x + 5, a.p.y);
    o.hp = 1;
    o.ai = 'wait';
    o.awake = false;
    a.s.enemies.push(o);
    for (let i = 0; i < 15 && o.hp === 1; i++) { a.game.wait(); a.run(500); }
    assert.ok(o.hp > 1, '回復した');
    const b = withEnemy('tsubomajin', { dx: 3 });
    for (let i = 0; i < 30 && b.s.enemies.length < 2; i++) { b.game.wait(); b.run(500); }
    assert.ok(b.s.enemies.length >= 2, '仲間を呼んだ');
    const c = withEnemy('shakkinbourei');
    c.p.money = 1000;
    for (let i = 0; i < 30 && c.p.money === 1000; i++) { c.e.x = c.e.fx = c.p.x + 1; c.e.y = c.e.fy = c.p.y; c.game.wait(); c.run(500); }
    assert.ok(c.p.money < 1000);
    assert.ok(c.e.money > 0);
});

test('新しい状態異常: 目つぶしは 当たりにくく、こおりは 動けない、やけどは ダメージ', () => {
    const { s, game, run, p } = withEnemy('haribaby', { dx: 5, awake: false });
    s.enemies[0].ai = 'wait';
    p.status = { id: 'freeze', turns: 2 };
    const t0 = s.turn;
    run(2500);
    assert.equal(p.status, null);
    assert.equal(s.turn - t0, 2, 'こおりのあいだは ひとりでに ターンがすすむ');
    p.status = { id: 'burn', turns: 4 };
    const hp = p.hp;
    game.wait();
    run(400);
    assert.ok(p.hp < hp);
    assert.ok(U.STATUS.blind && U.STATUS.weak);
});

test('ボスの台詞と 絵がある。ストーリーの最後は 大魔王ASO', () => {
    for (const d of DG.LIST) {
        assert.ok(d.story.boss.length && d.story.clear.length, d.name);
        assert.ok(globalThis.KD.BigArt.has(d.boss), `${d.boss} の絵`);
    }
    assert.equal(DG.LIST[6].boss, 'maou');
    assert.equal(DG.LIST[6].story.last, true);
    assert.deepEqual(DG.LIST.filter(d => d.story.ally).map(d => d.story.ally), ['yasu', 'dake', 'tamu']);
});

// ----- 交易所のオンライン (偽の Supabase) -----
function fakeSupabase() {
    const rows = [];
    let nextId = 1;
    const ok = body => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) });
    const fetch = (url, req) => {
        const path = url.replace(/^https:\/\/fake\.supabase\.co\/rest\/v1\//, '');
        const b = req.body ? JSON.parse(req.body) : {};
        if (path.startsWith('market')) return ok(rows.filter(r => !r.sold).map(({ id, seller_name, item_id, n, price }) => ({ id, seller_name, item_id, n, price })));
        if (path === 'rpc/post_listing') {
            rows.push({ id: nextId, seller: b.p_seller, seller_name: b.p_name, item_id: b.p_item, n: b.p_n, price: b.p_price, sold: false, claimed: false });
            return ok(nextId++);
        }
        if (path === 'rpc/buy_listing') {
            const r = rows.find(x => x.id === b.p_id && !x.sold && x.seller !== b.p_buyer);
            if (!r) return ok([]);
            r.sold = true;
            r.buyer_name = b.p_buyer_name;
            return ok([{ item_id: r.item_id, n: r.n, price: r.price }]);
        }
        if (path === 'rpc/my_listings') return ok(rows.filter(r => r.seller === b.p_seller && !r.sold).map(r => ({ id: r.id, item_id: r.item_id, n: r.n, price: r.price })));
        if (path === 'rpc/cancel_listing') {
            const i = rows.findIndex(x => x.id === b.p_id && x.seller === b.p_seller && !x.sold);
            return ok(i < 0 ? [] : rows.splice(i, 1).map(r => ({ item_id: r.item_id, n: r.n })));
        }
        if (path === 'rpc/claim_sales') {
            const list = rows.filter(r => r.seller === b.p_seller && r.sold && !r.claimed);
            list.forEach(r => { r.claimed = true; });
            return ok(list.map(r => ({ item_id: r.item_id, n: r.n, price: r.price, buyer_name: r.buyer_name })));
        }
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
    };
    return { rows, fetch };
}

const flush = () => new Promise(r => setTimeout(r, 0));

test('交易所オンライン: ほかのプレイヤーの出品を買う・自分の出品が売れると お金を受け取る・取り下げる', async () => {
    const sb = fakeSupabase();
    globalThis.KD.CONFIG.supabase = { url: 'https://fake.supabase.co', key: 'anon' };
    // ほかのプレイヤーが出品している
    const other = globalThis.KD.createMarket(globalThis.KD.CONFIG.supabase, { fetch: sb.fetch, storage: { getItem: () => 'other-player', setItem() {} } });
    await other.post('おにおに（ばりきつよめ）', { id: 'kelp_band', n: 1, price: 1500 });
    const { s, asks, choose } = setup({ market: undefined, unlockAll: true, marketDeps: { fetch: sb.fetch } }, { town: true });
    s.player.money = 5000;
    choose('交易所');
    await flush();
    choose('ほかの探検隊の出品');
    await flush();
    assert.ok(asks[0].options[0].startsWith('おにおに（ばりきつよめ）：昆布のハチマキ'));
    choose('昆布のハチマキ');
    await flush();
    assert.match(asks[0].message, /買った/);
    assert.equal(s.player.money, 3500);
    assert.ok(s.player.bag.some(i => i.id === 'kelp_band'));
    assert.equal(sb.rows[0].sold, true);
    choose('もどる');
    await flush();
    choose('もどる');
    // 自分で出品 → ほかのプレイヤーが買う → 交易所に入りなおすと お金を受け取る
    choose('出品する');
    choose('おにぎり');
    choose('ふつう');
    await flush();
    assert.match(asks[0].message, /出品した/);
    assert.ok(!s.player.bag.some(i => i.id === 'onigiri'));
    const mine = sb.rows.find(r => r.item_id === 'onigiri');
    await other.buy(mine.id, 'たむさん');
    choose('もどる');
    choose('やめる');
    const money = s.player.money;
    choose('交易所');
    await flush();
    assert.match(asks[0].message, /売れていた/);
    assert.equal(s.player.money, money + I.ITEMS.onigiri.price);
    choose('もどる');
    // 取り下げ
    choose('出品する');
    choose('氷のかけら');
    choose('高め');
    await flush();
    choose('もどる');
    choose('自分の出品');
    await flush();
    choose('氷のかけら');
    await flush();
    assert.ok(s.player.bag.some(i => i.id === 'ice_shard'), '取り下げて 戻ってきた');
    globalThis.KD.CONFIG.supabase = { url: '', key: '' };
});

test('交易所オンライン: つながらないときは コンピューターの探検隊だけ', async () => {
    globalThis.KD.CONFIG.supabase = { url: 'https://fake.supabase.co', key: 'anon' };
    const { s, asks, choose } = setup({ market: undefined, unlockAll: true, marketDeps: { fetch: () => Promise.reject(new Error('offline')) } }, { town: true });
    choose('交易所');
    await flush();
    choose('ほかの探検隊の出品');
    await flush();
    await flush();
    assert.ok(asks[0].options.slice(0, -1).every(o => o.includes('（コンピューター）')));
    assert.equal(s.town.market.length, asks[0].options.length - 1);
    globalThis.KD.CONFIG.supabase = { url: '', key: '' };
    // 設定がなければ オフライン
    assert.equal(globalThis.KD.createMarket({}).online, false);
});
