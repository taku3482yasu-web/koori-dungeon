// =====================================================================
// ダンジョンの階を作る・見える範囲・歩けるか (仕様書 4章・5章)
// ---------------------------------------------------------------------
// 1 階は 56 × 32 マス。マップを 4 × 2 の区画に分け、4〜8 個の区画に部屋を置く。
// 部屋のない区画には通路の曲がり角 (点) を置き、となりの区画どうしを通路でつなぐ。
// つなぎ方は全区画を通る木 (どこからでもどこへでも行ける) + おまけの道を少し。
// ダンジョンによって、部屋の中に水たまり・溶岩を置く (仕様書 4.2)。部屋のふちは あけるので、つながりは変わらない。
// 画面には触らない (game.js が描く)。
// =====================================================================
(function (KD) {
    'use strict';

    const WALL = 0, FLOOR = 1, CORRIDOR = 2, WATER = 3, LAVA = 4;
    const COLS = 4, ROWS = 2;

    // 区画 a・b のあいだを通路でつなぐ (b は a の右か下)
    function connect(map, rng, a, b, horizontal) {
        const carve = (x, y) => {
            const i = y * map.w + x;
            if (map.tiles[i] === WALL) map.tiles[i] = CORRIDOR;
        };
        if (horizontal) {
            const ay = a.y + rng.int(0, a.h - 1), by = b.y + rng.int(0, b.h - 1);
            const sx = a.dummy ? a.x : a.x + a.w, ex = b.dummy ? b.x : b.x - 1;
            const mid = rng.int(Math.min(sx + 1, ex), Math.max(sx, ex - 1));
            for (let x = sx; x <= mid; x++) carve(x, ay);
            for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) carve(mid, y);
            for (let x = mid; x <= ex; x++) carve(x, by);
        } else {
            const ax = a.x + rng.int(0, a.w - 1), bx = b.x + rng.int(0, b.w - 1);
            const sy = a.dummy ? a.y : a.y + a.h, ey = b.dummy ? b.y : b.y - 1;
            const mid = rng.int(Math.min(sy + 1, ey), Math.max(sy, ey - 1));
            for (let y = sy; y <= mid; y++) carve(ax, y);
            for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) carve(x, mid);
            for (let y = mid; y <= ey; y++) carve(bx, y);
        }
    }

    // 階を作る。opts: { w, h, minRooms, maxRooms, pool: { tile: WATER か LAVA, chance: 部屋ごとの確率 } }
    // 戻り値: { w, h, tiles, rooms, roomAt, start, stairs }
    //   tiles: 0 壁 / 1 部屋の床 / 2 通路 / 3 水 (泳げるキャラだけ) / 4 溶岩 (歩けるがダメージ)。roomAt: そのマスの部屋の番号 (部屋でなければ -1)
    function generate(rng, opts = {}) {
        const w = opts.w || 56, h = opts.h || 32;
        const map = { w, h, tiles: new Uint8Array(w * h), rooms: [], roomAt: new Int16Array(w * h).fill(-1) };
        const cw = Math.floor((w - 2) / COLS), chh = Math.floor((h - 2) / ROWS);
        const count = rng.int(opts.minRooms || 4, opts.maxRooms || 8);
        const roomCells = new Set(rng.shuffle([...Array(COLS * ROWS).keys()]).slice(0, count));
        const cells = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const x0 = 1 + c * cw, y0 = 1 + r * chh;
                const id = r * COLS + c;
                let cell;
                if (roomCells.has(id)) {
                    const rw = rng.int(4, cw - 3), rh = rng.int(3, chh - 4);
                    cell = { x: x0 + rng.int(1, cw - rw - 1), y: y0 + rng.int(1, chh - rh - 1), w: rw, h: rh };
                    const index = map.rooms.length;
                    map.rooms.push(cell);
                    for (let y = cell.y; y < cell.y + rh; y++) {
                        for (let x = cell.x; x < cell.x + rw; x++) {
                            map.tiles[y * w + x] = FLOOR;
                            map.roomAt[y * w + x] = index;
                        }
                    }
                } else {
                    // 部屋のない区画は通路の曲がり角 (点)
                    cell = { x: x0 + rng.int(2, cw - 3), y: y0 + rng.int(2, chh - 3), w: 1, h: 1, dummy: true };
                    map.tiles[cell.y * w + cell.x] = CORRIDOR;
                }
                cells.push({ ...cell, c, r });
            }
        }
        // となりの区画 (右・下) の組
        const edges = [];
        cells.forEach((a, i) => {
            if (a.c + 1 < COLS) edges.push([i, i + 1, true]);
            if (a.r + 1 < ROWS) edges.push([i, i + COLS, false]);
        });
        // 全区画を通る木 (ランダムな順に、まだつながっていない区画どうしをつなぐ)
        const group = cells.map((_, i) => i);
        const root = i => (group[i] === i ? i : (group[i] = root(group[i])));
        const extra = [];
        rng.shuffle(edges).forEach(e => {
            const [a, b] = [root(e[0]), root(e[1])];
            if (a !== b) {
                group[a] = b;
                connect(map, rng, cells[e[0]], cells[e[1]], e[2]);
            } else extra.push(e);
        });
        // おまけの道 (ぐるっと回れる道ができる)
        extra.slice(0, rng.int(0, 2)).forEach(e => connect(map, rng, cells[e[0]], cells[e[1]], e[2]));
        // はじめの場所と階段は、別の部屋のどこか
        const [r1, r2] = rng.shuffle(map.rooms.map((_, i) => i));
        const spot = room => ({ x: room.x + rng.int(0, room.w - 1), y: room.y + rng.int(0, room.h - 1) });
        map.start = spot(map.rooms[r1]);
        map.stairs = spot(map.rooms[r2]);
        // 水たまり・溶岩 (部屋のふち 1 マスは あける。はじめの場所・階段にかかるなら置かない)
        if (opts.pool) {
            map.rooms.forEach(room => {
                if (room.w < 5 || room.h < 4 || !rng.chance(opts.pool.chance)) return;
                const pw = rng.int(1, room.w - 4), ph = rng.int(1, room.h - 3);
                const px = room.x + 1 + rng.int(0, room.w - 3 - pw), py = room.y + 1 + rng.int(0, room.h - 2 - ph);
                const inside = q => q.x >= px && q.x < px + pw && q.y >= py && q.y < py + ph;
                if (inside(map.start) || inside(map.stairs)) return;
                for (let y = py; y < py + ph; y++) {
                    for (let x = px; x < px + pw; x++) map.tiles[y * w + x] = opts.pool.tile;
                }
            });
        }
        return map;
    }

    const at = (map, x, y) => (x < 0 || y < 0 || x >= map.w || y >= map.h ? WALL : map.tiles[y * map.w + x]);
    // 歩けるか。水は swim (泳げる) のときだけ
    const walkable = (map, x, y, swim = false) => {
        const t = at(map, x, y);
        return t !== WALL && (t !== WATER || swim);
    };

    // (x, y) から (dx, dy) へ動けるか。斜めは、角を壁がふさいでいたら動けない (仕様書 5章)
    function canMove(map, x, y, dx, dy, swim = false) {
        if (!walkable(map, x + dx, y + dy, swim)) return false;
        if (dx && dy && (at(map, x + dx, y) === WALL || at(map, x, y + dy) === WALL)) return false;
        return true;
    }

    // (x, y) から (dx, dy) のマスへ 攻撃が 届くか。行き先が 壁・水でも 届く (壁の中・水の上の 敵にも 当たる)。
    //   斜めは、角を壁がふさいでいたら 届かない (動けるかと 同じ)
    function canReach(map, x, y, dx, dy) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) return false;
        return !(dx && dy && (at(map, x + dx, y) === WALL || at(map, x, y + dy) === WALL));
    }

    // 今見えるマス (仕様書 4.1): 部屋の中なら部屋全体とまわりの壁、通路ならまわり 1 マス
    function visibleFrom(map, x, y) {
        const seen = new Uint8Array(map.w * map.h);
        const mark = (xx, yy) => {
            if (xx >= 0 && yy >= 0 && xx < map.w && yy < map.h) seen[yy * map.w + xx] = 1;
        };
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(x + dx, y + dy);
        const r = map.roomAt[y * map.w + x];
        if (r >= 0) {
            const room = map.rooms[r];
            for (let yy = room.y - 1; yy <= room.y + room.h; yy++) {
                for (let xx = room.x - 1; xx <= room.x + room.w; xx++) mark(xx, yy);
            }
        }
        return seen;
    }

    // (x, y) から歩いて行けるマスの数 (テスト・確認用)
    function reachable(map, x, y) {
        const seen = new Uint8Array(map.w * map.h);
        const stack = [[x, y]];
        seen[y * map.w + x] = 1;
        let n = 0;
        while (stack.length) {
            const [cx, cy] = stack.pop();
            n++;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nx = cx + dx, ny = cy + dy;
                if (walkable(map, nx, ny) && !seen[ny * map.w + nx]) {
                    seen[ny * map.w + nx] = 1;
                    stack.push([nx, ny]);
                }
            }
        }
        return { count: n, seen };
    }

    KD.Dungeon = { WALL, FLOOR, CORRIDOR, WATER, LAVA, generate, at, walkable, canMove, canReach, visibleFrom, reachable };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
