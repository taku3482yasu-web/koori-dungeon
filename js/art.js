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
        },
        // おにおに (16x16): スロットの絵 (赤鬼・角・牙・虎柄の腰巻・金棒) を小さくしたもの
        onioni: {
            palette: { h: '#f0e0a0', k: '#1a1a1a', r: '#d83a2a', d: '#b02a1a', y: '#ffe040', w: '#ffffff', m: '#5a0a0a', t: '#f0b020', g: '#4a3a2a', s: '#d0d0d0' },
            frames: legs([
                '.h.......h...gg.',
                '.hkkkkkkkh...gs.',
                '.kkkkkkkkkk..gg.',
                '.krrrrrrrrk..sg.',
                '.rkkrrrrkkr..gg.',
                '.rykrrrrykr..gs.',
                '.rrrrddrrrr..gg.',
                '.rwmmmmmmwr.rsg.',
                '..rrrrrrrr.rrgg.',
                '.rrdrrrrdrrr.gg.',
                'rr.rrrrrr.rr.gg.',
                'dd.tktttkt.dd...',
                '...tttttttt.....'
            ], ['...rr....rr.....', '..ddd...ddd.....'], ['....rr..rr......', '...ddd.ddd......'])
        },

        // ----- ハリーの森の敵 (敵キャラ表 001〜007)。右向きに描く -----
        haribaby: {
            palette: { s: '#c8a070', S: '#a07848', b: '#8a5a3a', f: '#f0d0a0', k: '#10162a', n: '#ff8aa0' },
            frames: legs([
                '................',
                '................',
                '.....s.s.s......',
                '...s.sSsSs.s....',
                '..sSsSsSsSss....',
                '.sSsSsSsSsssff..',
                '.sSsSsSsSsffkf..',
                '.sSsSsSsSfffffn.',
                '.sSsSsSsSsfffff.',
                '..sSsSsSsSssff..',
                '..bbbbbbbbbbb...'
            ], ['...b.b....b.b...', '................'], ['....b.b..b.b....', '................'])
        },
        mumenbachi: {
            palette: { h: '#e04040', v: '#ffffff', y: '#ffd040', k: '#1a1a1a', w: '#d8f0ff' },
            frames: [
                ['................', '......hhhh......', '.....hhhhhh.....', '.....hhhhhhhv...', '.....ykyyky.....',
                    'www..yyyyyy..www', '.wwwkkkkkkkkwww.', '....yyyyyyyy....', '....kkkkkkkk....', '.....yyyyyy.....',
                    '......kkkk......', '.......kk.......', '................', '................', '................', '................'],
                ['................', '......hhhh......', '.....hhhhhh.....', '.www.hhhhhhhvww.', 'wwww.ykyyky.wwww',
                    '.....yyyyyy.....', '....kkkkkkkk....', '....yyyyyyyy....', '....kkkkkkkk....', '.....yyyyyy.....',
                    '......kkkk......', '.......kk.......', '................', '................', '................', '................']
            ]
        },
        donguriko: {
            palette: { c: '#7a4a20', C: '#5a3410', n: '#c88a40', l: '#e0a860', k: '#10162a', f: '#5a3410' },
            frames: legs([
                '.......cc.......',
                '....cCcCcCcC....',
                '...CcCcCcCcCc...',
                '...cccccccccc...',
                '....nnnnnnnn....',
                '...nlnnnnnnnn...',
                '...nlknnnnknn...',
                '...nlknnnnknn...',
                '...nnnnnnnnnn...',
                '....nnnkknnn....',
                '.....nnnnnn.....',
                '......nnnn......'
            ], ['.....f....f.....'], ['......f..f......'])
        },
        nemuridake: {
            palette: { r: '#c84a6a', w: '#ffffff', s: '#f0e0c0', k: '#5a3a2a', p: '#a05060', z: '#ffffff' },
            frames: [
                ['................', '.....rrrrrr.....', '...rrrwwrrrrr...', '..rrrrwwrrrwwrr.', '.rrwwrrrrrrwwrrr',
                    '.rrwwrrrrrrrrrrr', '..rrrrrrrrrrrrr.', '....ssssssss....', '....skkssskks...', '....ssssssss....',
                    '....sssppsss....', '....ssssssss....', '.....ssssss.....', '................', '................', '................'],
                ['.............zz.', '.....rrrrrr...z.', '...rrrwwrrrrr...', '..rrrrwwrrrwwrr.', '.rrwwrrrrrrwwrrr',
                    '.rrwwrrrrrrrrrrr', '..rrrrrrrrrrrrr.', '....ssssssss....', '....skkssskks...', '....ssssssss....',
                    '....sssppsss....', '....ssssssss....', '.....ssssss.....', '................', '................', '................']
            ]
        },
        pekorisu: {
            palette: { b: '#c87a3a', t: '#e09a50', c: '#f0c890', k: '#10162a', w: '#f8e8d0' },
            frames: legs([
                '..ttt...........',
                '.ttttt....b.b...',
                'tttttt...bbbbb..',
                'ttt.tt..bbbbkbb.',
                'tt..tt..bccbbbbb',
                'tt...tt.ccccccb.',
                '.tt..tt.bccccbb.',
                '..ttttt.bbwwbb..',
                '...tttbbbwwwbb..',
                '.....bbbbwwwbb..',
                '......bbbbbbb...'
            ], ['......b...b.....'], ['.......b.b......'])
        },
        tsutankobu: {
            palette: { g: '#3a8a3a', d: '#2a6a2a', n: '#6aa84a', w: '#ffffff', k: '#10162a' },
            frames: [
                ['......gg........', '.....gnng.......', '....gnnnng......', '....gnwknwkg....', '....gnnnnnng....',
                    '...ggnnddnngg...', '..gg.gnnnng.gg..', '.gg..gnnnng..gg.', 'g....ggnngg....g', '......gnng......',
                    '.....dgggd......', '....dd.g.dd.....', '...d...g...d....', '................', '................', '................'],
                ['......gg........', '.....gnng.......', '....gnnnng......', '....gnwknwkg....', '....gnnnnnng....',
                    '...ggnnddnngg...', '.gg..gnnnng..gg.', 'g....gnnnng....g', '.....ggnngg.....', '......gnng......',
                    '.....dgggd......', '....dd.g.dd.....', '...d...g...d....', '................', '................', '................']
            ]
        },
        yofukashi: {
            palette: { b: '#7a6a5a', l: '#b8a890', w: '#ffffff', k: '#10162a', u: '#5a3a6a', y: '#f0b030' },
            frames: legs([
                '...b........b...',
                '...bb......bb...',
                '...bbbbbbbbbb...',
                '..bwwwbbbbwwwb..',
                '..bwkwbbbbwkwb..',
                '..buuubyybuuub..',
                '..bbbbbyybbbbb..',
                '.bbbllllllllbbb.',
                'bbbllllllllllbbb',
                '.bbllllllllllbb.',
                '..bbllllllllbb..',
                '...bbbbbbbbbb...'
            ], ['....yy....yy....'], ['.....yy..yy.....'])
        }
    };

    // 体 (上の行) に、足の行を 2 とおりつけて 2 コマにする。足りない行は透明で 16 行にそろえる
    function legs(body, a, b) {
        const pad = rows => [...rows, ...Array(16 - rows.length).fill('................')];
        return [pad([...body, ...a]), pad([...body, ...b])];
    }

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

    // ----- 道具・お金・ワナ (16 × 16 のマスのまんなかに小さく) -----
    const px1 = (ctx, c, x, y, w = 1, h = 1) => {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, w, h);
    };
    const ORB_COLORS = { warp_orb: '#b07aff', escape_orb: '#7ad0ff', sweep_orb: '#ff7a5a' };

    function drawItem(ctx, id, kind, x, y) {
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.fillRect(x + 4, y + 12, 8, 2);
        if (id === 'money') {
            // 金貨を 3 枚
            [[4, 7], [8, 8], [6, 4]].forEach(([cx, cy]) => {
                px1(ctx, '#b08020', x + cx, y + cy, 5, 4);
                px1(ctx, '#ffd84a', x + cx, y + cy, 4, 3);
                px1(ctx, '#fff4b0', x + cx + 1, y + cy, 1, 1);
            });
        } else if (kind === 'food') {
            // おにぎり (三角と のり)。腐ったものは緑っぽい
            const rice = id === 'bad_onigiri' ? '#b8c890' : '#ffffff';
            const s = id === 'big_onigiri' ? 1 : 0;
            for (let r = 0; r < 7 + s; r++) px1(ctx, rice, x + 7 - Math.floor(r / 2) - s, y + 3 + r - s, 2 + Math.floor(r / 2) * 2 + s * 2, 1);
            px1(ctx, '#1a2a1a', x + 6 - s, y + 8, 4 + s * 2, 3 + s);
            if (id === 'bad_onigiri') px1(ctx, '#6a8a3a', x + 5, y + 5, 2, 1);
        } else if (kind === 'heal') {
            // 氷のかけら
            px1(ctx, '#4aa8e0', x + 6, y + 3, 4, 9);
            px1(ctx, '#bff0ff', x + 5, y + 5, 6, 5);
            px1(ctx, '#ffffff', x + 7, y + 4, 1, 3);
        } else if (id === 'omamori') {
            px1(ctx, '#ff6a8a', x + 5, y + 4, 6, 8);
            px1(ctx, '#ffe680', x + 6, y + 6, 4, 2);
            px1(ctx, '#ffffff', x + 7, y + 2, 2, 2);
        } else if (kind === 'seed' || id === 'revive_seed') {
            const c = id === 'revive_seed' ? '#ffb040' : '#8a6aff';
            px1(ctx, c, x + 6, y + 5, 4, 6);
            px1(ctx, c, x + 5, y + 6, 6, 4);
            px1(ctx, '#ffffff', x + 6, y + 6, 1, 1);
        } else if (kind === 'throw') {
            const c = id === 'ice_pellet' ? ['#7fd3f7', '#bff0ff'] : ['#7a7a7a', '#b0b0b0'];
            [[4, 8], [8, 7], [6, 5]].forEach(([cx, cy]) => {
                px1(ctx, c[0], x + cx, y + cy, 4, 3);
                px1(ctx, c[1], x + cx, y + cy, 2, 1);
            });
        } else if (kind === 'orb') {
            const c = ORB_COLORS[id] || '#ffffff';
            px1(ctx, c, x + 5, y + 4, 6, 8);
            px1(ctx, c, x + 4, y + 5, 8, 6);
            px1(ctx, '#ffffff', x + 6, y + 5, 2, 2);
        } else if (kind === 'material') {
            // 素材 (小さな包み)
            px1(ctx, '#8a6a3a', x + 4, y + 7, 8, 5);
            px1(ctx, '#c8a060', x + 5, y + 6, 6, 2);
            px1(ctx, '#f0e0a0', x + 7, y + 5, 2, 2);
        } else if (kind === 'gear') {
            const c = id === 'power_band' ? '#e04040' : id === 'guard_scarf' ? '#4a8aff' : '#f0b020';
            px1(ctx, c, x + 3, y + 6, 10, 4);
            px1(ctx, '#ffffff', x + 3, y + 7, 10, 1);
            px1(ctx, c, x + 11, y + 9, 2, 4);
        }
    }

    // ワナ (見つけたものだけ描く)
    function drawTrap(ctx, id, x, y) {
        px1(ctx, 'rgba(0,0,0,.35)', x + 2, y + 2, 12, 12);
        const marks = {
            spike: () => { for (let i = 0; i < 3; i++) { px1(ctx, '#d0d0d0', x + 4 + i * 3, y + 6, 1, 6); px1(ctx, '#ffffff', x + 4 + i * 3, y + 5); } },
            warp: () => { px1(ctx, '#b07aff', x + 4, y + 4, 8, 8); px1(ctx, '#2a1a4a', x + 6, y + 6, 4, 4); px1(ctx, '#ffffff', x + 7, y + 7, 2, 2); },
            colitis: () => { px1(ctx, '#8a5a2a', x + 5, y + 9, 6, 3); px1(ctx, '#8a5a2a', x + 6, y + 7, 4, 2); px1(ctx, '#8a5a2a', x + 7, y + 5, 2, 2); },
            sleep: () => { px1(ctx, '#8ab8ff', x + 4, y + 5, 5, 1); px1(ctx, '#8ab8ff', x + 7, y + 6, 1, 2); px1(ctx, '#8ab8ff', x + 5, y + 8, 1, 1); px1(ctx, '#8ab8ff', x + 4, y + 9, 5, 1); px1(ctx, '#8ab8ff', x + 10, y + 7, 3, 1); px1(ctx, '#8ab8ff', x + 10, y + 9, 3, 1); },
            pit: () => { px1(ctx, '#000000', x + 3, y + 4, 10, 9); px1(ctx, '#3a2a1a', x + 3, y + 4, 10, 1); },
            debt: () => { px1(ctx, '#ffd84a', x + 4, y + 4, 8, 8); px1(ctx, '#7a5a10', x + 7, y + 5, 2, 6); px1(ctx, '#7a5a10', x + 5, y + 7, 6, 1); }
        };
        (marks[id] || marks.spike)();
    }

    KD.Art = { T, THEMES, SPRITES, drawSprite, drawFloor, drawPath, drawWall, drawStairs, drawItem, drawTrap };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
