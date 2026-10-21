// =====================================================================
// 大きいキャラの絵 (ボス・強敵・やすさん・たむさん・だけさん)
// ---------------------------------------------------------------------
// 前作スロット (koori-slot-aso の src/presentation/art/characters.js・characters-legacy.js) の絵を そのまま写したもの。
// 絵は w x h ドットの枠に r(x, y, w, h, 色) で描き、frame (0/1) で待機アニメーション。
// drawBig で、決めた高さに縮めて (または広げて) 描く。
// =====================================================================
(function (KD) {
    'use strict';

    const SKIN = '#f0c8a0';

    // 3x5 ドットの小さい文字 (大魔王ASO の胸の紋章)
    const GLYPHS = {
        A: ['.#.', '#.#', '###', '#.#', '#.#'],
        O: ['###', '#.#', '#.#', '#.#', '###'],
        S: ['###', '#..', '###', '..#', '###'],
        K: ['#.#', '#.#', '##.', '#.#', '#.#'],
        M: ['#.#', '###', '#.#', '#.#', '#.#'],
        4: ['#.#', '#.#', '###', '..#', '..#']
    };
    function glyphText(r, text, x, y, color, scale = 1) {
        [...text].forEach((ch, i) => {
            (GLYPHS[ch] || []).forEach((row, gy) => {
                for (let gx = 0; gx < 3; gx++) {
                    if (row[gx] === '#') r(x + (i * 4 + gx) * scale, y + gy * scale, scale, scale, color);
                }
            });
        });
    }

    const BIG = {
    // ----- 摩天楼に住み着いた敵 (弱い順) -----
    // ハリー: 紫のトゲトゲのハリネズミ。いちばん弱い
    harry: {
        w: 24, h: 20,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            const spike = '#6a3aa0', spikeDark = '#4a2280';
            [[2, 6], [5, 3], [9, 1], [13, 1], [17, 3], [20, 6]].forEach(([x, y]) => {
                r(x, y + up, 2, 4, spikeDark);
                r(x, y + 1 + up, 1, 2, spike);
            });
            r(2, 7, 20, 9, spike);
            r(1, 10, 2, 5, spikeDark);
            r(21, 10, 2, 5, spikeDark);
            r(6, 9, 12, 8, '#f0d8b0');
            r(8, 10, 3, 3, '#ffffff');
            r(13, 10, 3, 3, '#ffffff');
            r(9, 11, 2, 2, '#111111');
            r(14, 11, 2, 2, '#111111');
            r(11, 13, 2, 1, '#2a1a10');
            r(10, 15, 4, 1, '#a03030');
            r(4, 17, 5, 3, '#d0a070');
            r(15, 17, 5, 3, '#d0a070');
        }
    },
    // 浦の島重蔵: 白ひげのおじいさん。亀の甲羅を背負い、煙の出る玉手箱を持つ。青い着物
    urashima: {
        w: 32, h: 40,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            const shell = '#3a7a3a', shellLight = '#5aa05a', kimono = '#2a5aa0';
            r(4, 18, 24, 16, shell);
            [[6, 20], [14, 19], [21, 20], [8, 26], [18, 26]].forEach(([x, y]) => r(x, y, 5, 5, shellLight));
            r(9, 18, 14, 15, kimono);
            r(15, 18, 2, 15, '#e8e0c0');
            r(9, 27, 14, 2, '#c8a040');
            r(6, 22 + up, 3, 8, kimono);
            r(23, 22, 3, 8, kimono);
            r(23, 30, 3, 2, SKIN);
            // 玉手箱と煙
            r(2, 27 + up, 8, 6, '#c02030');
            r(2, 27 + up, 8, 1, '#ffd700');
            r(5, 29 + up, 2, 2, '#ffd700');
            r(3, 23 + up, 3, 3, '#d8d8e8');
            r(5, 20 + up, 3, 3, '#e4e4f0');
            r(3, 17 + up, 2, 2, '#c8c8d8');
            r(10, 3, 12, 12, SKIN);
            r(12, 3, 6, 1, '#ffe8d0');
            r(9, 5, 2, 6, '#f4f4f4');
            r(21, 5, 2, 6, '#f4f4f4');
            r(12, 8, 3, 1, '#f4f4f4');
            r(17, 8, 3, 1, '#f4f4f4');
            r(13, 9, 2, 1, '#111111');
            r(18, 9, 2, 1, '#111111');
            r(15, 10, 2, 2, '#d8a880');
            r(11, 12, 10, 6, '#f4f4f4');
            r(13, 18, 6, 3, '#f4f4f4');
            r(15, 21, 2, 2, '#e0e0e0');
            r(14, 13, 4, 1, '#a04030');
            r(11, 33, 4, 5, SKIN);
            r(17, 33, 4, 5, SKIN);
            r(10, 38, 6, 2, '#8a5a2a');
            r(16, 38, 6, 2, '#8a5a2a');
        }
    },
    // マキビコンMk-4: 銀色のロボット。赤いバイザー・アンテナ・胸に「MK4」・左腕はドリル
    makibikon: {
        w: 34, h: 44,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            const metal = '#a8b0bc', metalDark = '#6a7280', metalLight = '#dce2ea';
            r(16, 1, 2, 3, metalDark);
            r(15, 0, 4, 2, frame ? '#ff9090' : '#ff3030');
            r(9, 4, 16, 12, metal);
            r(9, 4, 16, 2, metalLight);
            r(7, 7, 2, 6, metalDark);
            r(25, 7, 2, 6, metalDark);
            r(11, 8, 12, 4, '#151a22');
            r(12, 9, 10, 2, '#ff2030');
            r(13, 9, 3, 1, '#ff9090');
            r(13, 13, 8, 2, metalDark);
            [14, 16, 18, 20].forEach(x => r(x, 13, 1, 2, '#151a22'));
            r(14, 16, 6, 2, metalDark);
            r(7, 18, 20, 15, metal);
            r(7, 18, 20, 2, metalLight);
            r(10, 21, 14, 9, metalDark);
            r(11, 22, 12, 7, '#ffd23a');
            glyphText(r, 'MK4', 12, 23, '#1a1a1a');
            r(3, 19 + up, 4, 10, metalDark);
            r(27, 19 + up, 4, 10, metalDark);
            // ドリル (左) とつめ (右)
            r(2, 29 + up, 6, 2, '#c0c8d0');
            r(3, 31 + up, 4, 2, '#c0c8d0');
            r(4, 33 + up, 2, 2, '#c0c8d0');
            r(3, 30 + up, 1, 1, '#6a7280');
            r(5, 32 + up, 1, 1, '#6a7280');
            r(26, 29 + up, 2, 4, metalDark);
            r(30, 29 + up, 2, 4, metalDark);
            r(10, 33, 5, 8, metalDark);
            r(19, 33, 5, 8, metalDark);
            r(8, 41, 9, 3, '#4a525e');
            r(17, 41, 9, 3, '#4a525e');
        }
    },
    // 奈架多ドラゴン: 緑のドラゴン。翼・角・背中のトゲ・クリーム色のおなか
    nakata: {
        w: 48, h: 44,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            const body = '#2a9a7a', dark = '#1a6a54', light = '#6ad8b0', belly = '#f0d890';
            // 翼 (付け根から左上へ広がる)
            for (let x = 3; x <= 16; x++) {
                const top = Math.round(2 + (x - 3) * 0.6) + up;
                const bottom = Math.round(22 - (16 - x) * 0.5);
                r(x, top, 1, bottom - top, x % 4 === 0 ? '#3a3a5a' : dark);
            }
            r(3, 2 + up, 14, 1, light);
            r(4, 26, 12, 4, body);
            r(1, 23, 3, 5, body);
            r(0, 21, 2, 3, dark);
            r(14, 14, 22, 20, body);
            [16, 20, 24, 28].forEach(x => r(x, 11, 3, 3, dark));
            r(18, 18, 12, 14, belly);
            [21, 25, 29].forEach(y => r(18, y, 12, 1, '#c8b060'));
            r(30, 4, 14, 12, body);
            r(32, 1, 2, 4, '#f0e0a0');
            r(39, 1, 2, 4, '#f0e0a0');
            r(36, 7, 3, 3, '#ffe040');
            r(37, 7, 1, 3, '#111111');
            r(42, 9, 6, 6, body);
            r(46, 10, 1, 1, '#111111');
            r(40, 14, 8, 1, dark);
            r(41, 15, 6, 1, '#ffffff');
            r(31, 5, 4, 2, light);
            r(16, 34, 6, 8, dark);
            r(28, 34, 6, 8, dark);
            r(15, 42, 8, 2, '#f0e0a0');
            r(27, 42, 8, 2, '#f0e0a0');
        }
    },
    // ----- ASO四天王 -----
    // ダイシ (22階): お坊さん。剃った頭・額の白毫・オレンジの衣に金の袈裟・大きな数珠・錫杖
    daishi: {
        w: 36, h: 46,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            const robe = '#e07a20', robeDark = '#b05a10';
            r(9, 16, 18, 24, robe);
            r(9, 16, 3, 24, robeDark);
            for (let i = 0; i < 11; i++) r(11 + i, 17 + i * 2, 4, 2, '#ffd040');
            r(6, 17, 4, 14, robe);
            r(26, 17, 4, 14, robe);
            r(16, 22, 4, 6, SKIN);
            r(17, 21, 2, 1, SKIN);
            // 錫杖
            r(4, 4 + up, 2, 40, '#8a6a3a');
            r(1, 0 + up, 8, 2, '#d8b040');
            r(1, 0 + up, 2, 6, '#d8b040');
            r(7, 0 + up, 2, 6, '#d8b040');
            r(2, 6 + up, 1, 2, '#d8b040');
            r(7, 6 + up, 1, 2, '#d8b040');
            r(12, 2, 12, 13, SKIN);
            r(13, 2, 6, 2, '#ffe8d0');
            r(11, 8, 1, 3, SKIN);
            r(24, 8, 1, 3, SKIN);
            r(17, 5, 2, 1, '#c04040');
            r(14, 7, 3, 1, '#2a1a10');
            r(19, 7, 3, 1, '#2a1a10');
            r(17, 9, 2, 2, '#d8a880');
            r(15, 12, 6, 1, '#a04030');
            [[11, 15], [13, 17], [15, 18], [17, 19], [19, 18], [21, 17], [23, 15]].forEach(([x, y]) => {
                r(x, y, 2, 2, '#4a2a10');
                r(x, y, 1, 1, '#8a5a30');
            });
            r(12, 40, 5, 3, SKIN);
            r(19, 40, 5, 3, SKIN);
            r(11, 43, 7, 3, '#8a5a2a');
            r(18, 43, 7, 3, '#8a5a2a');
        }
    },
    // ズミタニ (33階): 忍者。紺の装束・額当て・なびく赤いマフラー・両手にクナイ
    zumitani: {
        w: 36, h: 46,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            const navy = '#1e2a5a', navyDark = '#141c40';
            r(22, 14, 10 + (frame ? 2 : 0), 3, '#d02030');
            r(28, 17, 6, 2, '#b01828');
            r(11, 2, 14, 14, navy);
            r(11, 4, 14, 2, '#c0c8d8');
            r(16, 4, 4, 2, '#9aa4b8');
            r(24, 3, 5, 1, '#c0c8d8');
            r(24, 5, 4, 1, '#c0c8d8');
            r(13, 7, 10, 4, SKIN);
            r(14, 8, 3, 2, '#111111');
            r(19, 8, 3, 2, '#111111');
            r(15, 8, 1, 1, '#ffffff');
            r(20, 8, 1, 1, '#ffffff');
            r(12, 15, 12, 3, '#d02030');
            r(10, 18, 16, 14, navy);
            r(10, 24, 16, 2, navyDark);
            r(10, 30, 16, 2, '#4a3a2a');
            r(6, 18 + up, 4, 11, navy);
            r(26, 18 + up, 4, 11, navy);
            r(6, 29 + up, 4, 2, SKIN);
            r(26, 29 + up, 4, 2, SKIN);
            r(7, 31 + up, 2, 6, '#c0c8d8');
            r(27, 31 + up, 2, 6, '#c0c8d8');
            r(7, 31 + up, 1, 5, '#ffffff');
            r(27, 31 + up, 1, 5, '#ffffff');
            r(11, 32, 6, 9, navy);
            r(19, 32, 6, 9, navy);
            r(11, 37, 6, 3, '#e8e8e8');
            r(19, 37, 6, 3, '#e8e8e8');
            r(10, 41, 8, 3, navyDark);
            r(18, 41, 8, 3, navyDark);
        }
    },
    // ルナヤ (44階): 月の魔女。三日月のついた紫のとんがり帽子・銀の長い髪・星のドレス・三日月の杖
    runaya: {
        w: 36, h: 50,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            const purple = '#6a3ab0', purpleDark = '#4a2280', hair = '#d8dcf0', moon = '#ffe680';
            r(10, 12, 16, 22, hair);
            r(15, 0, 4, 3, purple);
            r(13, 3, 8, 4, purple);
            r(11, 7, 14, 3, purple);
            r(7, 10, 22, 2, purpleDark);
            r(17, 4, 2, 3, moon);
            r(16, 5, 1, 1, moon);
            r(13, 12, 10, 10, SKIN);
            r(13, 12, 10, 2, hair);
            r(14, 15, 3, 2, '#6a30c0');
            r(19, 15, 3, 2, '#6a30c0');
            r(15, 15, 1, 1, '#ffffff');
            r(20, 15, 1, 1, '#ffffff');
            r(17, 18, 2, 1, '#d8a880');
            r(16, 20, 4, 1, '#c03060');
            r(12, 22, 12, 18, purple);
            r(10, 32, 16, 10, purple);
            r(8, 38, 20, 6, purpleDark);
            r(16, 22, 4, 2, moon);
            [[13, 34], [21, 36], [17, 40], [11, 41], [24, 41]].forEach(([x, y]) => r(x, y, 1, 1, moon));
            r(9, 23, 3, 10, purple);
            r(9, 33, 3, 2, SKIN);
            r(24, 23 + up, 3, 10, purple);
            r(24, 33 + up, 3, 2, SKIN);
            // 三日月の杖
            r(28, 7 + up, 2, 40, '#8a8aa0');
            r(26, 1 + up, 2, 6, moon);
            r(27, 0 + up, 4, 1, moon);
            r(27, 7 + up, 4, 1, moon);
            r(12, 44, 5, 3, '#2a1a3a');
            r(19, 44, 5, 3, '#2a1a3a');
        }
    },
    // ノゾエマ (55階): 鎧武者。金の鍬形の兜・赤い面頬・黒と赤の鎧・刀
    nozoema: {
        w: 40, h: 50,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            const armor = '#2a2a32', red = '#b01828', gold = '#d8b040';
            r(10, 0, 2, 6, gold);
            r(28, 0, 2, 6, gold);
            r(12, 4, 2, 3, gold);
            r(26, 4, 2, 3, gold);
            r(12, 6, 16, 6, armor);
            r(19, 6, 2, 3, gold);
            r(10, 10, 20, 3, armor);
            r(8, 12, 4, 4, armor);
            r(28, 12, 4, 4, armor);
            r(13, 12, 14, 9, red);
            r(15, 14, 3, 2, '#ffe040');
            r(22, 14, 3, 2, '#ffe040');
            r(16, 14, 1, 2, '#111111');
            r(23, 14, 1, 2, '#111111');
            r(16, 18, 8, 1, '#f4f4f4');
            r(10, 21, 20, 16, armor);
            [23, 27, 31].forEach(y => r(10, y, 20, 1, red));
            r(4, 21, 7, 8, red);
            r(29, 21, 7, 8, red);
            r(4, 24, 7, 1, armor);
            r(29, 24, 7, 1, armor);
            r(6, 29, 4, 8, armor);
            r(30, 29, 4, 8, armor);
            r(6, 37, 4, 2, SKIN);
            r(30, 37, 4, 2, SKIN);
            // 刀 (右手から斜め上へ)
            r(30, 36, 3, 3, '#3a2010');
            r(29, 35, 5, 1, gold);
            for (let i = 0; i < 14; i++) r(Math.round(31 + i * 0.55), 34 - i * 2 + up, 2, 2, '#e0e8f0');
            r(10, 37, 20, 5, red);
            r(10, 37, 20, 1, gold);
            [13, 18, 23].forEach(x => r(x, 37, 1, 5, armor));
            r(12, 42, 6, 5, armor);
            r(22, 42, 6, 5, armor);
            r(11, 47, 8, 3, '#151515');
            r(21, 47, 8, 3, '#151515');
        }
    },
    // 大魔王ASO (56階): 阿蘇山の魔王。頭が火口になっていて溶岩と煙が出る・岩の体に溶岩のひび・黒いマント・胸に「ASO」の紋章
    maou: {
        w: 64, h: 64,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            const rock = '#3a2a2a', rockDark = '#241818', lava = '#ff5a1a', lavaLight = '#ffc040', gold = '#ffd700';
            r(4, 22, 56, 40, '#1a0a14');
            r(4, 22, 56, 2, '#5a1030');
            r(2, 26, 3, 34, '#3a0a20');
            r(59, 26, 3, 34, '#3a0a20');
            // 煙
            r(24, 0 + up, 4, 3, '#6a6a72');
            r(30, 1 - up, 5, 3, '#7a7a82');
            r(36, 0 + up, 4, 3, '#6a6a72');
            // 火口の頭
            for (let y = 4; y < 12; y++) {
                const half = 8 + (y - 4);
                r(32 - half, y, half * 2, 1, rockDark);
            }
            r(26, 4, 12, 2, lava);
            r(28, 5, 8, 1, lavaLight);
            r(25, 6, 2, 5, lava);
            r(37, 6, 2, 4, lava);
            r(12, 6, 4, 10, '#d8c8a0');
            r(10, 4, 4, 4, '#d8c8a0');
            r(48, 6, 4, 10, '#d8c8a0');
            r(50, 4, 4, 4, '#d8c8a0');
            r(18, 12, 28, 18, rock);
            r(14, 14, 4, 3, '#d8c8a0');
            r(46, 14, 4, 3, '#d8c8a0');
            r(21, 15, 9, 1, '#000000');
            r(34, 15, 9, 1, '#000000');
            r(22, 17, 7, 3, lava);
            r(35, 17, 7, 3, lava);
            r(24, 18, 3, 1, frame ? '#ffffff' : lavaLight);
            r(37, 18, 3, 1, frame ? '#ffffff' : lavaLight);
            r(20, 21, 1, 5, lava);
            r(43, 20, 1, 6, lava);
            r(31, 12, 1, 3, lava);
            r(24, 24, 16, 4, '#1a0808');
            r(25, 24, 2, 3, '#ffffff');
            r(37, 24, 2, 3, '#ffffff');
            r(28, 26, 8, 1, lava);
            r(16, 30, 32, 22, rockDark);
            r(18, 30, 28, 2, rock);
            r(10, 28, 8, 6, gold);
            r(46, 28, 8, 6, gold);
            r(10, 25, 2, 3, gold);
            r(52, 25, 2, 3, gold);
            r(24, 34, 16, 9, gold);
            r(25, 35, 14, 7, '#7a1010');
            glyphText(r, 'ASO', 27, 36, gold);
            r(8, 34 + up, 8, 16, rock);
            r(48, 34 + up, 8, 16, rock);
            r(11, 38 + up, 1, 8, lava);
            r(52, 38 + up, 1, 8, lava);
            r(8, 50 + up, 8, 3, rockDark);
            r(48, 50 + up, 8, 3, rockDark);
            r(20, 52, 9, 9, rock);
            r(35, 52, 9, 9, rock);
            r(18, 60, 13, 4, rockDark);
            r(33, 60, 13, 4, rockDark);
        }
    },
    // やすさん: 眼鏡・青いパーカー
    yasu: {
        w: 16, h: 24,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            r(4, 1, 8, 4, '#2a2a2a');
            r(4, 4, 8, 7, SKIN);
            r(4, 6, 3, 2, '#333333');
            r(9, 6, 3, 2, '#333333');
            r(5, 6, 1, 1, '#bbddee');
            r(10, 6, 1, 1, '#bbddee');
            r(7, 6, 2, 1, '#333333');
            r(7, 9, 2, 1, '#a04030');
            r(3, 11, 10, 7, '#3a6ad0');
            r(7, 11, 1, 3, '#ffffff');
            r(8, 11, 1, 3, '#ffffff');
            r(1, 12 + up, 2, 5, '#3a6ad0');
            r(13, 12 + up, 2, 5, '#3a6ad0');
            r(1, 17 + up, 2, 1, SKIN);
            r(13, 17 + up, 2, 1, SKIN);
            r(4, 18, 3, 4, '#2a3a6a');
            r(9, 18, 3, 4, '#2a3a6a');
            r(3, 22, 4, 2, '#ffffff');
            r(9, 22, 4, 2, '#ffffff');
        }
    },
    // たむさん: 赤い帽子・緑のジャケット
    tamu: {
        w: 16, h: 24,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            r(3, 1, 10, 3, '#d02020');
            r(9, 3, 5, 1, '#a01010');
            r(4, 4, 8, 7, SKIN);
            r(4, 4, 1, 2, '#5a3a1a');
            r(11, 4, 1, 2, '#5a3a1a');
            r(6, 6, 1, 2, '#111111');
            r(9, 6, 1, 2, '#111111');
            r(6, 9, 4, 1, '#a04030');
            r(3, 11, 10, 7, '#2e8a4a');
            r(8, 11, 1, 7, '#dddddd');
            r(1, 12 + up, 2, 5, '#2e8a4a');
            r(13, 12 + up, 2, 5, '#2e8a4a');
            r(1, 17 + up, 2, 1, SKIN);
            r(13, 17 + up, 2, 1, SKIN);
            r(4, 18, 3, 4, '#5a4a3a');
            r(9, 18, 3, 4, '#5a4a3a');
            r(3, 22, 4, 2, '#2a2a2a');
            r(9, 22, 4, 2, '#2a2a2a');
        }
    },
    // だけさん: ハチマキ・たくましい体・オレンジのタンクトップ
    dake: {
        w: 16, h: 24,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            const tan = '#d89a6a';
            r(4, 1, 8, 3, '#151515');
            r(4, 3, 8, 1, '#ff3030');
            r(12, 3, 3, 1, '#ff3030');
            r(13, 4, 2, 1, '#ff3030');
            r(4, 4, 8, 7, tan);
            r(5, 5, 2, 1, '#151515');
            r(9, 5, 2, 1, '#151515');
            r(5, 6, 2, 1, '#111111');
            r(9, 6, 2, 1, '#111111');
            r(6, 9, 4, 1, '#7a2a1a');
            r(2, 11, 12, 7, '#ff8a20');
            r(1, 11, 2, 4, tan);
            r(13, 11, 2, 4, tan);
            r(0, 13 + up, 2, 5, tan);
            r(14, 13 + up, 2, 5, tan);
            r(3, 18, 4, 4, '#2a2a2a');
            r(9, 18, 4, 4, '#2a2a2a');
            r(3, 22, 4, 2, '#7a5a3a');
            r(9, 22, 4, 2, '#7a5a3a');
        }
    },
    // ゴールド金面犬: 全身金色の犬。険しい人間風の顔・ルビーとダイヤの王冠・金の鎖・金のローファー
    goldDog: {
        w: 46, h: 40,
        draw(r, frame) {
            const up = frame ? -1 : 0;
            const light = '#ffe680', gold = '#f0c030', mid = '#e0b020', dark = '#b88a10', line = '#6a4a00';
            // 王冠
            r(6, up, 2, 3, '#ffd700');
            r(12, up, 2, 3, '#ffd700');
            r(18, up, 2, 3, '#ffd700');
            r(8, 1 + up, 4, 3, '#c0204a');
            r(14, 1 + up, 4, 3, '#c0204a');
            r(12, 3 + up, 2, 2, '#e8f8ff');
            r(6, 4 + up, 14, 3, '#ffd700');
            r(9, 5 + up, 1, 1, '#c0204a');
            r(16, 5 + up, 1, 1, '#c0204a');
            // 耳・頭
            r(2, 7, 4, 3, gold);
            r(20, 7, 5, 3, gold);
            r(6, 7, 14, 12, gold);
            r(7, 8, 4, 2, light);
            r(8, 10, 4, 1, line);
            r(14, 10, 4, 1, line);
            r(9, 11, 2, 1, '#3a2a00');
            r(15, 11, 2, 1, '#3a2a00');
            r(11, 12, 4, 5, mid);
            r(12, 16, 2, 1, line);
            r(10, 18, 6, 1, line);
            // 体・しっぽ
            r(14, 17, 28, 13, gold);
            r(18, 17, 20, 2, light);
            r(16, 28, 24, 2, dark);
            r(42, 15 + up, 3, 2, gold);
            r(44, 13 + up, 2, 3, gold);
            // 金の鎖
            r(6, 19, 15, 2, '#fff2a0');
            r(7, 21, 13, 2, '#d4a017');
            [8, 12, 16, 19].forEach(x => r(x, 19, 1, 1, '#ffffff'));
            // 足と金のローファー
            [15, 21, 32, 38].forEach(x => r(x, 30, 4, 6, mid));
            [14, 20, 31, 37].forEach(x => {
                r(x, 36, 6, 3, '#b8860b');
                r(x, 36, 6, 1, '#ffd700');
            });
        }
    }
    };

    // 絵を描く。(x, groundY) は足元のまんなか。height: 描く高さ (ドット)
    function drawBig(ctx, id, frame, x, groundY, { height = null, flip = false, alpha = 1 } = {}) {
        const art = BIG[id];
        const scale = height ? height / art.h : 1;
        const left = Math.round(x - (art.w * scale) / 2);
        const top = Math.round(groundY - art.h * scale);
        const before = ctx.globalAlpha;
        ctx.globalAlpha = before * alpha;
        art.draw((rx, ry, rw, rh, color) => {
            const fx = flip ? art.w - rx - rw : rx;
            const x0 = Math.round(left + fx * scale), x1 = Math.round(left + (fx + rw) * scale);
            const y0 = Math.round(top + ry * scale), y1 = Math.round(top + (ry + rh) * scale);
            if (x1 <= x0 || y1 <= y0) return;
            ctx.fillStyle = color;
            ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        }, frame);
        ctx.globalAlpha = before;
    }

    KD.BigArt = { BIG, drawBig, has: id => Boolean(BIG[id]) };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
