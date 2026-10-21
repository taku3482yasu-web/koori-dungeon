// =====================================================================
// ドット絵: キャラ (前作のスロットと同じ絵) と、ダンジョンのマス
// ---------------------------------------------------------------------
// キャラは文字列のドット絵 (1文字 = 1ドット、パレットで色を決める。'.' は透明)。
// マスは 16 × 16 ドット。ダンジョンごとの色 (THEMES) で描く。
// =====================================================================
(function (KD) {
    'use strict';

    // ----- キャラ -----
    // こおりくん (16x16): こおりくんの大冒険 (スロット) の characters-legacy.js と同じ絵
    const KOORI_BODY = [
        '................',
        '.oooooooooooooo.',
        '.owwwcccccccbbo.',
        '.owwccccccccbbo.',
        '.owcccccccccbbo.',
        '.occckcccckccbo.',
        '.occckcccckccbo.',
        '.ocpcccccccpcbo.',
        '.occccckkccccbo.',
        '.occcccccccccbo.',
        '.obcccccccccbbo.',
        '.obbbbbbbbbbbdo.',
        '.oooooooooooooo.'
    ];
    const SPRITES = {
        koori: {
            palette: { o: '#1b3a6b', w: '#ffffff', c: '#bff0ff', b: '#7fd3f7', d: '#4aa8e0', k: '#10162a', p: '#ff9eb5' },
            frames: [
                [...KOORI_BODY, '...odo....odo...', '...ooo....ooo...', '................'],
                [...KOORI_BODY, '....odo..odo....', '....ooo..ooo....', '................']
            ]
        }
    };

    // 絵を (x, y) を左上にして描く。flip: 左右反転
    function drawSprite(ctx, id, frame, x, y, { flip = false, scale = 1 } = {}) {
        const s = SPRITES[id];
        const rows = s.frames[frame % s.frames.length];
        const w = rows[0].length;
        rows.forEach((row, ry) => {
            for (let rx = 0; rx < w; rx++) {
                const c = s.palette[row[rx]];
                if (!c) continue;
                ctx.fillStyle = c;
                ctx.fillRect(x + (flip ? w - 1 - rx : rx) * scale, y + ry * scale, scale, scale);
            }
        });
    }

    // ----- マス -----
    // ダンジョンごとの色 (段階 1 はハリーの森だけ)
    const THEMES = {
        forest: {
            floor: ['#5fa84a', '#57a043', '#6ab454'], tuft: '#4a8f38', flower: ['#ffe680', '#ffb0c8'],
            path: '#b48c5a', pathDark: '#9a7448', pebble: '#c8a878',
            wall: '#1d4a22', leaf: ['#2f6a2f', '#3f8a3a', '#4fa046'], trunk: '#6a4a2a',
            stairs: ['#8a8f9f', '#5a5f6f', '#c8ccd8'],
            void: '#06100a', mini: { floor: '#9adf8a', path: '#d8c090', wall: '#1d4a22' }
        }
    };

    // マスごとに決まる乱数 (同じマスはいつも同じ模様)
    function hash(x, y, k = 0) {
        let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    const T = 16;

    function drawFloor(ctx, th, x, y, px, py) {
        ctx.fillStyle = th.floor[Math.floor(hash(x, y) * th.floor.length)];
        ctx.fillRect(px, py, T, T);
        // 草の葉と、ときどき花
        for (let i = 0; i < 3; i++) {
            const tx = Math.floor(hash(x, y, i + 1) * 14), ty = Math.floor(hash(x, y, i + 7) * 13);
            ctx.fillStyle = th.tuft;
            ctx.fillRect(px + tx, py + ty + 1, 1, 2);
            ctx.fillRect(px + tx + 1, py + ty, 1, 3);
        }
        if (hash(x, y, 20) < 0.08) {
            ctx.fillStyle = th.flower[hash(x, y, 21) < 0.5 ? 0 : 1];
            const fx = 4 + Math.floor(hash(x, y, 22) * 8), fy = 4 + Math.floor(hash(x, y, 23) * 8);
            ctx.fillRect(px + fx, py + fy, 2, 2);
        }
    }

    function drawPath(ctx, th, x, y, px, py) {
        ctx.fillStyle = th.path;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = th.pathDark;
        for (let i = 0; i < 4; i++) ctx.fillRect(px + Math.floor(hash(x, y, i + 30) * 15), py + Math.floor(hash(x, y, i + 40) * 15), 2, 1);
        ctx.fillStyle = th.pebble;
        ctx.fillRect(px + Math.floor(hash(x, y, 50) * 13), py + Math.floor(hash(x, y, 51) * 13), 2, 2);
    }

    // 壁 (森の木)。下が歩けるマスなら、木の幹を見せる
    function drawWall(ctx, th, x, y, px, py, openBelow) {
        ctx.fillStyle = th.wall;
        ctx.fillRect(px, py, T, T);
        const top = openBelow ? 0 : 2;
        // 葉のかたまり (丸を3つ)
        [[4, 5 + top, 5], [11, 6 + top, 5], [8, 2 + top, 5]].forEach(([cx, cy, r], i) => {
            ctx.fillStyle = th.leaf[(i + Math.floor(hash(x, y, 60) * 3)) % 3];
            ctx.beginPath();
            ctx.arc(px + cx, py + cy, r, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.fillStyle = th.leaf[2];
        ctx.fillRect(px + 6, py + 1 + top, 2, 2);
        if (openBelow) {
            ctx.fillStyle = th.trunk;
            ctx.fillRect(px + 6, py + 11, 4, 5);
            ctx.fillStyle = 'rgba(0,0,0,.25)';
            ctx.fillRect(px, py + 14, T, 2);
        }
    }

    // 下り階段 (石の段)
    function drawStairs(ctx, th, px, py) {
        ctx.fillStyle = th.stairs[1];
        ctx.fillRect(px + 1, py + 1, 14, 14);
        for (let i = 0; i < 4; i++) {
            ctx.fillStyle = th.stairs[0];
            ctx.fillRect(px + 2 + i, py + 2 + i * 3, 12 - i * 2, 2);
            ctx.fillStyle = th.stairs[2];
            ctx.fillRect(px + 2 + i, py + 2 + i * 3, 12 - i * 2, 1);
        }
        ctx.fillStyle = '#20242c';
        ctx.fillRect(px + 6, py + 13, 4, 2);
    }

    KD.Art = { T, THEMES, SPRITES, drawSprite, drawFloor, drawPath, drawWall, drawStairs };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
