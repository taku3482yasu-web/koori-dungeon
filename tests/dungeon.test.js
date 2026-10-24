// ダンジョンの階づくりのテスト (node --test tests/)
// ゲームのスクリプトはブラウザでそのまま読む形 (window.KD) なので、ここでは globalThis.KD に読み込む
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

globalThis.KD = {};
for (const f of ['rng.js', 'dungeon.js']) vm.runInThisContext(readFileSync(new URL(`../js/${f}`, import.meta.url), 'utf8'));
const { createRng, Dungeon: D } = globalThis.KD;

test('どの階も、はじめの場所から全部の床と階段へ歩いて行ける', () => {
    for (let seed = 1; seed <= 300; seed++) {
        const map = D.generate(createRng(seed));
        assert.equal(map.w, 56);
        assert.equal(map.h, 32);
        assert.ok(map.rooms.length >= 4 && map.rooms.length <= 8, `部屋は 4〜8 個 (${map.rooms.length})`);
        const { count, seen } = D.reachable(map, map.start.x, map.start.y);
        const floors = map.tiles.reduce((n, t) => n + (t !== D.WALL ? 1 : 0), 0);
        assert.equal(count, floors, `seed ${seed}: 行けない床がある`);
        assert.ok(seen[map.stairs.y * map.w + map.stairs.x], '階段へ行ける');
        assert.ok(map.roomAt[map.start.y * map.w + map.start.x] >= 0, 'はじめの場所は部屋の中');
        assert.ok(map.roomAt[map.stairs.y * map.w + map.stairs.x] >= 0, '階段は部屋の中');
        assert.notEqual(map.roomAt[map.start.y * map.w + map.start.x], map.roomAt[map.stairs.y * map.w + map.stairs.x], '階段は別の部屋');
        // いちばん外側は壁
        for (let x = 0; x < map.w; x++) assert.ok(!D.walkable(map, x, 0) && !D.walkable(map, x, map.h - 1));
        for (let y = 0; y < map.h; y++) assert.ok(!D.walkable(map, 0, y) && !D.walkable(map, map.w - 1, y));
    }
});

test('同じ種なら同じ階になる', () => {
    const a = D.generate(createRng(42)), b = D.generate(createRng(42));
    assert.deepEqual([...a.tiles], [...b.tiles]);
    assert.deepEqual(a.stairs, b.stairs);
});

test('斜めは、角を壁がふさいでいたら動けない', () => {
    // 3x3 の床のまんなかの右上だけ壁
    const map = { w: 5, h: 5, tiles: new Uint8Array(25), roomAt: new Int16Array(25).fill(-1), rooms: [] };
    for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) map.tiles[y * 5 + x] = D.FLOOR;
    map.tiles[1 * 5 + 3] = D.WALL;
    assert.equal(D.canMove(map, 2, 2, 1, 1), true, '右下は行ける');
    assert.equal(D.canMove(map, 2, 2, -1, -1), true, '左上は行ける');
    assert.equal(D.canMove(map, 2, 2, 1, -1), false, '右上は壁');
    assert.equal(D.canMove(map, 2, 1, 1, 1), false, '右が壁なので右下へは行けない');
});

test('部屋の中なら部屋全体が見え、通路ならまわり 1 マスだけ', () => {
    const map = D.generate(createRng(5));
    const room = map.rooms[0];
    const inRoom = D.visibleFrom(map, room.x, room.y);
    assert.ok(inRoom[(room.y + room.h - 1) * map.w + room.x + room.w - 1], '部屋の反対の角が見える');
    assert.ok(inRoom[(room.y - 1) * map.w + room.x - 1], 'まわりの壁も見える');
    const i = map.tiles.findIndex((t, k) => t === D.CORRIDOR && map.roomAt[k] < 0);
    const cx = i % map.w, cy = Math.floor(i / map.w);
    const inCorridor = D.visibleFrom(map, cx, cy);
    assert.equal(inCorridor.reduce((n, v) => n + v, 0), 9, '通路はまわり 1 マス (9 マス)');
});

test('ボスの階 (arena): いちばん遠い部屋が 広い 闘技場に なり、階段は そこ。はじめの場所は 外で、全部の床へ 行ける (2026-10-24)', () => {
    for (let seed = 1; seed <= 300; seed++) {
        const map = D.generate(createRng(seed), { arena: true, pool: { tile: D.WATER, chance: 0.5 } });
        const a = map.rooms[map.arena];
        assert.ok(a && a.w === D.ARENA.w && a.h === D.ARENA.h, `seed ${seed}: 闘技場の 広さ`);
        const inA = q => q.x >= a.x && q.x < a.x + a.w && q.y >= a.y && q.y < a.y + a.h;
        assert.ok(inA(map.stairs), '階段は 闘技場の 中');
        assert.ok(!inA(map.start), 'はじめの 場所は 闘技場の 外');
        for (let y = a.y; y < a.y + a.h; y++) for (let x = a.x; x < a.x + a.w; x++) assert.equal(map.tiles[y * map.w + x], D.FLOOR, '闘技場は ぜんぶ 床 (水たまりなし)');
        const { count, seen } = D.reachable(map, map.start.x, map.start.y, false);
        assert.ok(seen[map.stairs.y * map.w + map.stairs.x], '階段へ 行ける');
        assert.ok(count > 0);
        for (let x = 0; x < map.w; x++) assert.ok(!D.walkable(map, x, 0) && !D.walkable(map, x, map.h - 1));
        for (let y = 0; y < map.h; y++) assert.ok(!D.walkable(map, 0, y) && !D.walkable(map, map.w - 1, y));
    }
});
