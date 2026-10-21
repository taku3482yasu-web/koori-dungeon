// ゲームの進行のテスト (歩く・ダッシュ・階段・最後の階)
// canvas は何もしない偽物、時間 (performance.now) はテストで進める
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let fakeNow = 1000;
globalThis.performance = { now: () => fakeNow };
globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js', 'art.js', 'game.js']) vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
const { Dungeon: D } = globalThis.KD;

function setup() {
    const noop = () => {};
    const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => { t[k] = v; return true; } });
    const asks = [];
    const ui = { ask: (message, options, done) => asks.push({ message, options, done }), asking: () => asks.length > 0 };
    const game = globalThis.KD.createGame({ getContext: () => ctx }, ui);
    const run = ms => { for (let i = 0; i < ms; i += 16) { fakeNow += 16; game.draw(fakeNow); } };
    const answer = i => asks.shift().done(i);
    return { game, s: game.state, run, asks, answer };
}

test('壁には入れず、歩くとターンが進み、見た場所がミニマップに残る', () => {
    const { game, s, run } = setup();
    const before = s.explored.reduce((n, v) => n + v, 0);
    assert.ok(before > 0, 'はじめの部屋は見えている');
    for (let i = 0; i < 300; i++) {
        const [dx, dy] = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1]][i % 6];
        game.moveInput(dx, dy);
        run(200);
        assert.ok(D.walkable(s.map, s.player.x, s.player.y), '壁の上にいない');
        if (game.busy() && !s.move) break;   // 階段で聞かれた
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
