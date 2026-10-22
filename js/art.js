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
        // ともいし (16x18): こおりくんのお母さん。パーマ頭の石に黄色いエプロン。
        //   前作 (スロット・パチンコ) の sprites.js と同じ絵。frames は [ふつう, 口を開けて叫ぶ]
        tomoishi: {
            palette: {
                o: '#2a2a30',  // 輪郭
                h: '#7a4ab0',  // パーマの髪
                H: '#a87ad8',  // 髪のつや
                G: '#d0d0da',  // 石 (明)
                g: '#a0a0ac',  // 石
                d: '#70707c',  // 石 (影)
                k: '#10162a',  // 目
                p: '#ff9eb5',  // ほっぺ
                m: '#c03048',  // 口
                a: '#ffe08a',  // エプロン
                A: '#d8a840',  // エプロンの影
                f: '#4a4a54'   // 足
            },
            frames: (() => {
                const top = [
                    '...hHhhHhhHh....',
                    '..hhhhhhhhhhhh..',
                    '.hHhhhHhhhhHhhh.',
                    '.hoooooooooooohh',
                    '.oGGGgggggggggo.',
                    'oGGgggggggggggdo',
                    'oGgggkgggggkggdo',
                    'oggggkgggggkggdo',
                    'ogpgggggggggpgdo'
                ];
                // エプロン (肩ひもつき)
                const apron = [
                    'oggaggggggggaddo',
                    'oggaaaaaaaaaaddo',
                    'odgaaaappaaaAddo',
                    '.oddAAAAAAAAddo.',
                    '..oooooooooooo..',
                    '...ofo....ofo...',
                    '...ooo....ooo...'
                ];
                return [
                    [...top, 'oggggggmmgggggdo', 'oggggggggggggddo', ...apron],
                    // 口を縦に開けて叫ぶ
                    [...top, 'oggggmmmmmggggdo', 'oggggmmkmmgggddo', ...apron]
                ];
            })()
        },

        // ふるカワ (16x20): リボンのボブヘアの女の子。前作と同じ絵。frames は [ふつう, 口が開く]
        furukawa: {
            palette: {
                o: '#2a1a1a',  // 輪郭
                h: '#7a4a2a',  // 髪
                H: '#b07a48',  // 髪のつや
                r: '#ff4f8b',  // リボン
                s: '#ffe2cc',  // 肌
                e: '#2a1830',  // 目
                w: '#ffffff',  // 目のハイライト
                p: '#ff9eb5',  // ほっぺ
                k: '#a03048',  // 口
                d: '#ff8ab8',  // 服
                D: '#e0609a',  // 服の影
                f: '#6a3a2a'   // くつ
            },
            frames: (() => {
                const head = [
                    '....oooooooo....',
                    '...ohhhhhhhhorr.',
                    '..ohhHHhhhhhhorr',
                    '..ohhhhhhhhhhho.',
                    '.ohhhsssssshhhho',
                    '.ohhsssssssshho.',
                    '.ohssewssewssho.',
                    '.ohsseessseesho.',
                    '.ohspsssssspsho.'
                ];
                const body = [
                    '..ohhsssssshhho.',
                    '...oooddddooo...',
                    '...odDddddDdo...',
                    '..osdddrrdddso..',
                    '..osddddddddso..',
                    '...oDddddddDo...',
                    '...oDDDDDDDDo...',
                    '....oso..oso....',
                    '....off..off....',
                    '....ooo..ooo....'
                ];
                const mouth = '.ohhssskkssshho.';
                return [
                    [...head, mouth, ...body],
                    // 口を縦に開ける (あごの行にも口を描く)
                    [...head, mouth, '..ohhsskksshhho.', ...body.slice(1)]
                ];
            })()
        },
        // コオリモドキ (敵キャラ表 050): 色の暗いこおりくんの そっくりさん
        koorimodoki: {
            palette: { o: '#0a1a3a', w: '#8a9ab0', c: '#4a7a9a', b: '#3a5a7a', d: '#2a4a6a', k: '#ff4040', p: '#8a5a6a' },
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
    // ダンジョンごとの色と模様 (仕様書 12章)
    //   wall: trees 木 / block 石や木のかたまり。floorPattern: grass 草 / speck 小さな点 / boards 板 / tatami たたみ / stars 星
    const block = (wall, brick, top, extra = {}) => ({ wallStyle: 'block', wall, brick, top, ...extra });
    const THEMES = {
        forest: {
            floor: ['#5fa84a', '#57a043', '#6ab454'], tuft: '#4a8f38', flower: ['#ffe680', '#ffb0c8'],
            path: '#b48c5a', pathDark: '#9a7448', pebble: '#c8a878',
            wall: '#1d4a22', leaf: ['#2f6a2f', '#3f8a3a', '#4fa046'], trunk: '#6a4a2a',
            stairs: ['#8a8f9f', '#5a5f6f', '#c8ccd8'],
            void: '#06100a', mini: { floor: '#9adf8a', path: '#d8c090', wall: '#1d4a22' }
        },
        coast: {
            floor: ['#d8c890', '#d0c088', '#e0d098'], floorPattern: 'speck', speck: '#b8a870', path: '#a89870', pathDark: '#8a7a58', pebble: '#e8e0c0',
            ...block('#3a4a5a', '#2a3a4a', '#5a6a7a'), stairs: ['#8a8f9f', '#5a5f6f', '#c8ccd8'],
            water: ['#2a6ab0', '#5a9ad8'], void: '#020810', mini: { floor: '#e0d8a0', path: '#c0b080', water: '#5a9ad8' }
        },
        temple: {
            floor: ['#8a5a3a', '#80523a', '#946440'], floorPattern: 'boards', speck: '#6a4228', path: '#7a7a7a', pathDark: '#5a5a5a', pebble: '#9a9a9a',
            ...block('#5a5a62', '#46464e', '#7a7a84', { accent: '#a02a2a' }), stairs: ['#a08a6a', '#6a5a3a', '#d8c8a0'],
            void: '#0a0606', mini: { floor: '#c89a6a', path: '#aaaaaa' }
        },
        mansion: {
            floor: ['#a8b860', '#a0b058', '#b0c068'], floorPattern: 'tatami', speck: '#7a8a3a', path: '#8a6a4a', pathDark: '#6a4a2a', pebble: '#a08060',
            ...block('#4a2e1a', '#3a2210', '#6a4a2a', { accent: '#f0e8d0' }), stairs: ['#8a6a4a', '#5a3a1a', '#c09a6a'],
            void: '#080604', mini: { floor: '#c8d880', path: '#b08a5a' }
        },
        moon: {
            floor: ['#3a3260', '#362e5a', '#40386a'], floorPattern: 'stars', speck: '#e8e0ff', path: '#2a2448', pathDark: '#1e1a38', pebble: '#8a80c0',
            ...block('#1a1630', '#120e24', '#3a3460', { accent: '#ffe080' }), stairs: ['#8a80c0', '#4a4070', '#d0c8ff'],
            void: '#04020a', mini: { floor: '#8a80d0', path: '#6a60a0' }
        },
        mountain: {
            floor: ['#7a8a5a', '#748452', '#829262'], floorPattern: 'speck', speck: '#5a6a3a', path: '#8a7a6a', pathDark: '#6a5a4a', pebble: '#a89888',
            ...block('#5a4a3a', '#4a3a2a', '#7a6a5a'), stairs: ['#9a8f8f', '#5a4f4f', '#d8ccc8'],
            lava: ['#e85a1a', '#ffb040'], void: '#0a0604', mini: { floor: '#a8b880', path: '#a89880', lava: '#ff7a3a' }
        },
        // 段階 10: コード塔 (黒と緑の 画面の色) / ツモツモ横丁 (夜の石だたみ・ネオン) / ハリー王国 (お城の石・金)
        code: {
            floor: ['#10241a', '#0e2016', '#14281e'], floorPattern: 'speck', speck: '#3aff8a', path: '#1a3a2a', pathDark: '#10261a', pebble: '#3a6a4a',
            ...block('#0a140e', '#06100a', '#1e4a2e', { accent: '#3aff8a' }), stairs: ['#3aff8a', '#1a6a3a', '#b0ffd0'],
            void: '#020604', mini: { floor: '#3a8a5a', path: '#2a6a4a' }
        },
        alley: {
            floor: ['#3a3a4a', '#363646', '#40404e'], floorPattern: 'boards', speck: '#2a2a38', path: '#4a3a3a', pathDark: '#3a2a2a', pebble: '#6a5a6a',
            ...block('#2a1a2a', '#1e121e', '#4a2a4a', { accent: '#ff5aa0' }), stairs: ['#ffd84a', '#8a6a2a', '#fff0a0'],
            void: '#06020a', mini: { floor: '#7a7a9a', path: '#8a6a7a' }
        },
        kingdom: {
            floor: ['#8a8070', '#82786a', '#928878'], floorPattern: 'speck', speck: '#6a6050', path: '#a08a5a', pathDark: '#806a3a', pebble: '#c8b080',
            ...block('#5a5068', '#463e54', '#7a7088', { accent: '#ffd84a' }), stairs: ['#ffd84a', '#8a6a2a', '#fff0a0'],
            void: '#060408', mini: { floor: '#b8b098', path: '#c8a870' }
        },
        // バージョン専用: 雪どけの氷河 (氷と 雪どけの 若葉) / 金色のSE城 (朱ぬりの 柱と 金)
        glacier: {
            floor: ['#c8e0f0', '#c0d8ec', '#d0e8f4'], floorPattern: 'speck', speck: '#ffffff', path: '#a8c8e0', pathDark: '#88a8c8', pebble: '#e8f4ff',
            ...block('#4a7aa8', '#3a6a98', '#8ab8e0', { accent: '#ffb0c8' }), stairs: ['#8ac8f0', '#3a6a98', '#e8f8ff'],
            water: ['#3a8ad8', '#8ac8f0'], void: '#020814', mini: { floor: '#d8ecf8', path: '#a8c8e0', water: '#5aa8e8' }
        },
        onijo: {
            floor: ['#6a3a2a', '#623426', '#724030'], floorPattern: 'boards', speck: '#4a2418', path: '#8a6a3a', pathDark: '#6a4a2a', pebble: '#c8a050',
            ...block('#a82a1a', '#7a1a10', '#d84a2a', { accent: '#ffd840' }), stairs: ['#ffd840', '#8a6a2a', '#fff0a0'],
            lava: ['#e85a1a', '#ffb040'], void: '#0a0402', mini: { floor: '#b87a5a', path: '#c8a050', lava: '#ff7a3a' }
        },
        aso: {
            floor: ['#4a2a2a', '#442626', '#523030'], floorPattern: 'speck', speck: '#7a3a2a', path: '#3a2020', pathDark: '#2a1414', pebble: '#6a3a3a',
            ...block('#2a1414', '#1e0e0e', '#5a2a2a', { accent: '#e85a1a' }), stairs: ['#8a6a6a', '#4a2a2a', '#c8a0a0'],
            lava: ['#e85a1a', '#ffb040'], void: '#080202', mini: { floor: '#a86a6a', path: '#7a4a4a', lava: '#ff7a3a' }
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
        if (th.floorPattern) return drawPattern(ctx, th, x, y, px, py);
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

    // 草のほかの床の模様
    function drawPattern(ctx, th, x, y, px, py) {
        ctx.fillStyle = th.speck;
        if (th.floorPattern === 'boards') {
            ctx.fillRect(px, py + 7, T, 1);
            ctx.fillRect(px + ((x + y) % 2 ? 4 : 11), py, 1, 7);
            ctx.fillRect(px + ((x + y) % 2 ? 10 : 2), py + 8, 1, 8);
        } else if (th.floorPattern === 'tatami') {
            if ((x + y) % 2) ctx.fillRect(px, py, 1, T);
            else ctx.fillRect(px, py, T, 1);
            ctx.globalAlpha = 0.3;
            for (let i = 2; i < T; i += 3) ctx.fillRect(px, py + i, T, 1);
            ctx.globalAlpha = 1;
        } else {
            const n = th.floorPattern === 'stars' ? 1 : 3;
            for (let i = 0; i < n; i++) {
                if (th.floorPattern === 'stars' && hash(x, y, 70) > 0.35) break;
                ctx.fillRect(px + Math.floor(hash(x, y, i + 71) * 15), py + Math.floor(hash(x, y, i + 81) * 15), 1, 1);
            }
        }
    }

    // 水 (泳げるキャラだけ入れる) と 溶岩 (入るとダメージ)。now で ゆらゆら
    function drawLiquid(ctx, th, kind, x, y, px, py, now) {
        const [base, light] = th[kind] || (kind === 'water' ? ['#2a6ab0', '#5a9ad8'] : ['#e85a1a', '#ffb040']);
        ctx.fillStyle = base;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = light;
        const k = Math.floor(now / 400 + hash(x, y) * 4) % 4;
        ctx.fillRect(px + 2 + k * 2, py + 4, 4, 1);
        ctx.fillRect(px + 9 - k, py + 10, 4, 1);
        if (kind === 'lava' && k === 1) ctx.fillRect(px + 6, py + 7, 2, 2);
    }

    function drawPath(ctx, th, x, y, px, py) {
        ctx.fillStyle = th.path;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = th.pathDark;
        for (let i = 0; i < 4; i++) ctx.fillRect(px + Math.floor(hash(x, y, i + 30) * 15), py + Math.floor(hash(x, y, i + 40) * 15), 2, 1);
        ctx.fillStyle = th.pebble;
        ctx.fillRect(px + Math.floor(hash(x, y, 50) * 13), py + Math.floor(hash(x, y, 51) * 13), 2, 2);
    }

    // 壁。森は木 (下が歩けるマスなら、木の幹を見せる)、ほかは石や木のかたまり
    function drawWall(ctx, th, x, y, px, py, openBelow) {
        if (th.wallStyle === 'block') return drawBlock(ctx, th, x, y, px, py, openBelow);
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

    function drawBlock(ctx, th, x, y, px, py, openBelow) {
        ctx.fillStyle = th.wall;
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = th.brick;
        const off = y % 2 ? 4 : 0;
        ctx.fillRect(px, py + 5, T, 1);
        ctx.fillRect(px, py + 11, T, 1);
        ctx.fillRect(px + ((off + 8) % 16), py, 1, 5);
        ctx.fillRect(px + off, py + 6, 1, 5);
        ctx.fillRect(px + ((off + 12) % 16), py + 12, 1, 4);
        if (th.accent && hash(x, y, 90) < 0.08) {
            ctx.fillStyle = th.accent;
            ctx.fillRect(px + 6, py + 6, 3, 3);
        }
        if (openBelow) {
            ctx.fillStyle = th.top;
            ctx.fillRect(px, py + 13, T, 3);
            ctx.fillStyle = 'rgba(0,0,0,.25)';
            ctx.fillRect(px, py + 15, T, 1);
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
        if (id === 'chest') {
            // 宝箱 (タカラミミックが化けている)
            px1(ctx, '#a0602a', x + 2, y + 6, 12, 8);
            px1(ctx, '#c0802a', x + 2, y + 3, 12, 3);
            px1(ctx, '#ffd84a', x + 2, y + 8, 12, 1);
            px1(ctx, '#ffd84a', x + 7, y + 6, 2, 4);
            return;
        }
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

    KD.Art = { T, THEMES, SPRITES, drawSprite, drawFloor, drawPath, drawWall, drawStairs, drawLiquid, drawItem, drawTrap };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
