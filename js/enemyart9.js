// =====================================================================
// 段階 9 (案) の敵の絵: 進化形 053〜079・ドタバタ大迷宮の敵 080〜092・大魔王ASO・真 (敵キャラ表 9・10 章)
// ---------------------------------------------------------------------
// 進化形は 元の敵の絵 (art.js の SPRITES か BigArt.BIG) の色を変えて、王冠・角などの しるしを重ねる。
// 新しい敵は enemyart.js と同じ書き方 (r(x, y, w, h, 色)。16 × 16。右向き。frame 0/1 で待機アニメーション)。
// KD.BigArt.BIG に足す。EVOLVED に 進化形 → 元の敵 の対応。
// =====================================================================
(function (KD) {
    'use strict';

    const A = KD.Art, B = KD.BigArt;
    const SKIN = '#f0c8a0';
    const GOLD = '#ffd84a', RUBY = '#ff3a5a';

    // ----- 色の変換 -----
    function hexToHsl(hex) {
        const n = parseInt(hex.slice(1), 16);
        const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
        if (max === min) return [0, 0, l];
        const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return [h * 60, s, l];
    }
    function hslToHex(h, s, l) {
        h = ((h % 360) + 360) % 360 / 360;
        const f = t => {
            t = (t + 1) % 1;
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
            return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
        };
        const c = x => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0');
        return s === 0 ? '#' + c(l).repeat(3) : '#' + c(f(h + 1 / 3)) + c(f(h)) + c(f(h - 1 / 3));
    }
    // t: { map: {元の色: 新しい色}, hue (度), sat (倍), light (倍), to (この色相にそろえる), grey (灰色にも to の色を この あざやかさで付ける) }。
    // 黒・白・灰色 (あざやかでない色) は map にあるとき (と grey) だけ変える (目や歯の色を守る)
    function tint(t = {}) {
        const map = Object.fromEntries(Object.entries(t.map || {}).map(([k, v]) => [k.toLowerCase(), v]));
        return color => {
            const c = color.toLowerCase();
            if (map[c]) return map[c];
            if (!t.hue && !t.sat && !t.light && t.to == null) return color;
            const [h, s, l] = hexToHsl(c);
            if (t.grey && s < 0.15 && l >= 0.2 && l <= 0.97) return hslToHex(t.to, t.grey, Math.min(l, 0.75));
            if (s < 0.15 || l < 0.12 || l > 0.93) return color;
            return hslToHex(t.to != null ? t.to : h + (t.hue || 0), Math.min(1, s * (t.sat || 1)), Math.min(0.95, l * (t.light || 1)));
        };
    }

    // 元の敵の絵を r(x, y, w, h, 色) の形で描く関数にする
    function baseDraw(id) {
        const s = A.SPRITES[id];
        if (s) {
            return (r, f) => s.frames[f % s.frames.length].forEach((row, y) => {
                for (let x = 0; x < row.length; x++) { const c = s.palette[row[x]]; if (c) r(x, y, 1, 1, c); }
            });
        }
        return (r, f) => B.BIG[id].draw(r, f);
    }
    const sizeOf = id => (A.SPRITES[id] ? { w: 16, h: 16 } : { w: B.BIG[id].w, h: B.BIG[id].h });

    // 進化形: base の絵を t の色で描き、marks (しるし) を上に重ねる。
    //   under: 元の絵の下に描くもの (影の分身など。base を色を変えて描く関数をもらう)
    const EVOLVED = {};
    function evo(id, base, t, marks = () => {}, under = null) {
        EVOLVED[id] = base;
        const { w, h } = sizeOf(base);
        const draw = baseDraw(base), tr = tint(t);
        return {
            w, h, evolved: base,
            draw(r, f) {
                if (under) under(r, f, (color, dx = 0, dy = 0) => draw((x, y, ww, hh) => r(x + dx, y + dy, ww, hh, color), f));
                draw((x, y, ww, hh, c) => r(x, y, ww, hh, tr(c)), f);
                marks(r, f);
            }
        };
    }

    // ----- しるし -----
    // 王冠 (幅 5・高さ 2)
    const crown = (r, x, y, c = GOLD, jewel = RUBY) => {
        r(x, y, 1, 1, c); r(x + 2, y, 1, 1, c); r(x + 4, y, 1, 1, c); r(x, y + 1, 5, 1, c); r(x + 2, y + 1, 1, 1, jewel);
    };
    // 小さい王冠 (幅 3・高さ 2)
    const tinyCrown = (r, x, y, c = GOLD) => { r(x, y, 1, 1, c); r(x + 2, y, 1, 1, c); r(x, y + 1, 3, 1, c); };
    // 炎 (下から上へ。f でゆれる)
    const flame = (r, x, y, f, big = false) => {
        const s = f ? 1 : 0;
        r(x, y + 1, 2, 2, '#ff6a1a'); r(x + s, y, 1, 1, '#ffd040');
        if (big) { r(x - 1, y + 2, 1, 1, '#ff3a1a'); r(x + 2, y + 2, 1, 1, '#ff3a1a'); }
    };
    // キラッ (f のときだけ)
    const sparkle = (r, x, y, f, c = '#ffffff') => { if (f) { r(x, y - 1, 1, 3, c); r(x - 1, y, 3, 1, c); } };

    const art = draw => ({ w: 16, h: 16, draw });

    const ART = {
        // =====================================================================
        // 進化形 (053〜079)
        // =====================================================================
        // 053 ハリジェネラル: 金色の針・軍帽
        harigeneral: evo('harigeneral', 'haribaby', { map: { '#c8a070': '#ffd84a', '#a07848': '#d0a020' } }, r => {
            r(10, 3, 5, 2, '#3a5a3a'); r(14, 5, 2, 1, '#2a3a2a'); r(12, 3, 1, 1, GOLD);
        }),
        // 054 ジョオウバチ: 紫の体・ティアラ
        joubachi: evo('joubachi', 'mumenbachi', { map: { '#ffd040': '#c070ff', '#e04040': '#7a2ab0' } }, r => {
            r(6, 0, 1, 1, GOLD); r(8, 0, 1, 1, RUBY); r(10, 0, 1, 1, GOLD); r(6, 1, 5, 1, GOLD);
        }),
        // 055 オオドングリコ: 濃い色・葉っぱの帽子
        oodonguriko: evo('oodonguriko', 'donguriko', { light: 0.85, sat: 1.1 }, r => {
            r(8, 0, 4, 1, '#4ac05a'); r(11, 1, 3, 1, '#3a9a3a'); r(7, 0, 1, 1, '#2a7a2a');
        }),
        // 056 ネムリダケオウ: 紫のかさ・王冠
        nemuridakeou: evo('nemuridakeou', 'nemuridake', { map: { '#c84a6a': '#7a4ac8', '#a05060': '#5a3aa0' } }, r => crown(r, 6, 0)),
        // 057 ペコリスキング: 大きなしっぽ・赤いマント・王冠
        pekorisuking: evo('pekorisuking', 'pekorisu', { map: { '#e09a50': '#ffb848' } }, r => {
            r(8, 8, 2, 4, '#d02a3a'); r(7, 11, 1, 1, '#d02a3a'); tinyCrown(r, 10, 0);
        }),
        // 058 ツタンコブジュ: 大きな木 (幹の色・葉っぱのかんむり)
        tsutankobuju: evo('tsutankobuju', 'tsutankobu', { map: { '#3a8a3a': '#7a5530', '#2a6a2a': '#4a3018', '#6aa84a': '#9a7040' } }, (r, f) => {
            r(3, 0, 10, 2, '#3aa04a'); r(4, 2, 2, 1, '#2a8a3a'); r(10, 2, 2, 1, '#2a8a3a');
            r(1, 6 + (f ? 1 : 0), 2, 1, '#3aa04a'); r(13, 6 + (f ? 1 : 0), 2, 1, '#3aa04a');
        }),
        // 059 ヨアケフクロウ: 朝焼け色の羽・朝日
        yoakefukurou: evo('yoakefukurou', 'yofukashi', { map: { '#7a6a5a': '#d8784a', '#b8a890': '#ffd0a0', '#5a3a6a': '#ff9ab0' } }, (r, f) => {
            r(13, 0, 3, 2, '#ffe040'); if (f) r(12, 1, 1, 1, '#fff0a0');
        }),
        // 060 ヒョウガメ: 氷の甲羅
        hyougame: evo('hyougame', 'kogame', { map: { '#3a7a3a': '#4aa0d8', '#5aa05a': '#c8f0ff', '#9ad07a': '#a0d8e8' } }, (r, f) => {
            r(5, 5, 1, 1, '#ffffff'); r(8, 4, 1, 2, '#ffffff'); r(11, 5, 1, 1, '#ffffff'); sparkle(r, 9, 9, f);
        }),
        // 061 リュウグウダイ: 竜宮の冠
        ryuuguudai: evo('ryuuguudai', 'otohimedai', { hue: -20, sat: 1.1 }, r => crown(r, 9, 1, GOLD, '#40c0ff')),
        // 062 ウミボウズオウ: 深い色・王冠
        umibozuou: evo('umibozuou', 'umibozun', { hue: 40, light: 1.5, sat: 1.3 }, r => crown(r, 6, 0)),
        // 063 ダイエンジョウ: 赤い衣・頭の上の大きな炎
        daienjou: evo('daienjou', 'enjoubouzu', { to: 0, sat: 1.2 }, (r, f) => { flame(r, 6, 0, f, true); flame(r, 10, 1, !f); }),
        // 064 スパムキング: 金色・王冠
        spamking: evo('spamking', 'spamdama', { to: 48, sat: 1.3, grey: 0.85 }, r => crown(r, 6, 0)),
        // 065 ヒトダマオウ: 青い炎
        hitodamaou: evo('hitodamaou', 'rousokubi', { hue: 190 }, (r, f) => tinyCrown(r, 3, f ? 1 : 0, '#a0e8ff')),
        // 066 ジョウニンマン: 黒い装束・赤いマフラー
        jouninman: evo('jouninman', 'geninman', { light: 0.45, sat: 0.5, map: { [SKIN]: SKIN } }, (r, f) => {
            r(4, 7, 8, 1, '#e02a3a'); r(2 - (f ? 1 : 0), 7, 2, 1, '#e02a3a'); r(1 - (f ? 1 : 0), 8, 2, 1, '#c01a2a');
        }),
        // 067 カゲブンシンダヌキ: うしろに影の分身
        kagebunshin: evo('kagebunshin', 'kawarimidanuki', { hue: 220, sat: 0.7 }, () => {},
            (r, f, shadow) => shadow('#2a1a4a', f ? -3 : -2, 0)),
        // 068 ダイバクダンジロウ: 赤い大きな爆弾・火花
        daibakudanjirou: evo('daibakudanjirou', 'bakudanjirou', { to: 355, sat: 1.2 }, (r, f) => {
            r(12, 0, 1, 1, f ? '#ffffff' : '#ffd040'); r(11, 1, 1, 1, '#ff6a1a'); r(13, 1, 1, 1, f ? '#ffd040' : '#ff6a1a');
        }),
        // 069 カグヤウサギ: 十二単
        kaguyausagi: evo('kaguyausagi', 'tsukiusagi', { hue: 300 }, r => {
            r(4, 11, 8, 1, '#d03a5a'); r(4, 12, 8, 1, GOLD); r(4, 13, 8, 1, '#3a8ad0'); r(3, 14, 10, 1, '#6a3ab0');
        }),
        // 070 シンゲツウルフ: 黒い毛並み・赤い目
        shingetsuwolf: evo('shingetsuwolf', 'mangetsuwolf', { light: 0.4, sat: 0.4 }, (r, f) => {
            r(1, 1, 3, 3, '#e8e8ff'); r(1, 1, 2, 2, '#10162a'); if (f) r(12, 6, 1, 1, '#ff3030');
        }),
        // 071 ユキミダイフク: 白い大福・粉雪
        yukimidaifuku: evo('yukimidaifuku', 'yukimidango', { sat: 0.3, light: 1.25 }, (r, f) => {
            r(3, 1 + (f ? 1 : 0), 1, 1, '#ffffff'); r(12, 2 + (f ? 0 : 1), 1, 1, '#ffffff'); r(8, 0, 1, 1, '#ffffff');
        }),
        // 072 マッスルタイタン: 金色の筋肉
        muscletitan: evo('muscletitan', 'proteingolem', { to: 45, sat: 1.4, light: 1.1 }, (r, f) => sparkle(r, 13, 3, f)),
        // 073 カザンマッチョ: 肩から噴煙
        kazanmatcho: evo('kazanmatcho', 'magmatcho', { hue: -10, light: 0.9 }, (r, f) => {
            const up = f ? 1 : 0;
            r(1, 1 - up + 1, 2, 2, '#8a8a8a'); r(2, 0, 2, 1, '#aaaaaa'); r(13, 2 - up, 2, 2, '#8a8a8a'); r(12, 1, 2, 1, '#aaaaaa');
        }),
        // 074 ヒョウザンマッスル: 氷山の体・とがった氷
        hyouzanmuscle: evo('hyouzanmuscle', 'yukidarumuscle', { to: 200, sat: 1.5 }, (r, f) => {
            r(5, 0, 1, 2, '#e0f8ff'); r(8, 0, 1, 1, '#ffffff'); r(10, 0, 1, 2, '#e0f8ff'); sparkle(r, 3, 6, f, '#e0f8ff');
        }),
        // 075 アソショウグン: 金の鍬形の兜
        asoshougun: evo('asoshougun', 'asohei', { hue: 15, light: 0.9 }, r => {
            r(5, 0, 1, 2, GOLD); r(10, 0, 1, 2, GOLD); r(6, 1, 4, 1, GOLD); r(7, 0, 2, 1, RUBY);
        }),
        // 076 キンコミミック: 金庫 (鉄の色・ダイヤル)
        kinkomimic: evo('kinkomimic', 'takaramimic', { sat: 0.15, light: 0.9 }, (r, f) => {
            r(7, 6, 3, 3, '#c8c8d0'); r(8, 7, 1, 1, '#3a3a48'); r(8 + (f ? 1 : 0), 6, 1, 1, RUBY);
        }),
        // 077 コオリモドキ・真: 王冠をかぶった こおりくんそっくり
        koorimodokishin: evo('koorimodokishin', 'koorimodoki', { map: { '#4a7a9a': '#7aaad0', '#3a5a7a': '#5a8ab0' } }, (r, f) => {
            crown(r, 5, 0, GOLD, '#ff4040'); sparkle(r, 13, 3, f, '#ff8080');
        }),
        // 078 リシトリボウレイ: 緑がかった体・そろばん
        rishitoribourei: evo('rishitoribourei', 'shakkinbourei', { hue: -90 }, (r, f) => {
            r(10, 9, 5, 3, '#8a5a2a'); r(10, 10, 5, 1, '#5a3a1a');
            [10, 12, 14].forEach((x, i) => r(x, (i + f) % 2 ? 9 : 11, 1, 1, '#f0d0a0'));
        }),
        // 079 ダイチョウエンオウ: 濃い緑・王冠
        daichouenou: evo('daichouenou', 'daichouenkin', { hue: 20, light: 0.75 }, r => tinyCrown(r, 6, 0)),

        // =====================================================================
        // ドタバタ大迷宮の敵 (080〜092)
        // =====================================================================
        // 080 フブキペンギン: マフラーを巻いたペンギン
        fubukipenguin: art((r, f) => {
            const up = f ? -1 : 0;
            r(6, 2, 5, 1, '#22304a'); r(5, 3, 7, 10, '#22304a'); r(8, 5, 4, 7, '#f4f8ff');
            r(9, 4, 2, 1, '#ffffff'); r(10, 4, 1, 1, '#111111'); r(12, 5, 2, 1, '#ffa030');
            r(5, 7, 7, 1, '#e03a4a'); r(5, 8, 1, 3, '#e03a4a');
            r(4, 7 + up, 1, 4, '#1a2438'); r(6, 13, 2, 1, '#ffa030'); r(9, 13, 2, 1, '#ffa030');
            sparkle(r, 2, 2, f, '#e0f8ff');
        }),
        // 081 ツララコウモリ: 体がつららのコウモリ
        tsuraracomori: art((r, f) => {
            const up = f ? -1 : 0;
            r(6, 4, 1, 1, '#9adcff'); r(9, 4, 1, 1, '#9adcff'); r(6, 5, 4, 4, '#9adcff');
            r(1, 4 + up, 5, 3, '#5ab0e0'); r(10, 4 + up, 5, 3, '#5ab0e0'); r(0, 6 + up, 1, 2, '#5ab0e0'); r(15, 6 + up, 1, 2, '#5ab0e0');
            r(7, 6, 1, 1, '#ff3a5a'); r(9, 6, 1, 1, '#ff3a5a'); r(7, 8, 1, 1, '#ffffff'); r(8, 8, 1, 1, '#ffffff');
            [[2, 3], [4, 2], [11, 2], [13, 3]].forEach(([x, h]) => r(x, 7 + up, 1, h, '#e0f8ff'));
            r(7, 9, 2, 3, '#c8f0ff'); r(8, 12, 1, 1, '#c8f0ff');
        }),
        // 082 コオリノカガミ: 氷でできた鏡
        koorinokagami: art((r, f) => {
            r(4, 1, 8, 1, '#7fd3f7'); r(3, 2, 10, 10, '#7fd3f7'); r(4, 2, 8, 9, '#dff8ff');
            r(5, 3, 1, 3, '#ffffff'); r(6, 3, 1, 1, '#ffffff');
            r(6, 6, 1, 1, '#10162a'); r(9, 6, 1, 1, '#10162a'); r(7, 8, 2, 1, '#5a9ad0');
            r(7, 12, 2, 2, '#4aa8e0'); r(5, 14, 6, 1, '#4aa8e0');
            sparkle(r, f ? 11 : 4, f ? 3 : 10, true, '#ffffff');
        }),
        // 083 ヒノトリン: 燃える羽のひな鳥
        hinotorin: art((r, f) => {
            const up = f ? -1 : 0;
            r(5, 6, 7, 6, '#ffb030'); r(8, 3, 5, 5, '#ffb030'); r(11, 4, 1, 1, '#111111'); r(13, 5, 2, 1, '#ff6a1a');
            r(8, 1 + up, 1, 2, '#ff4a2a'); r(10, 0 + up, 1, 3, '#ff4a2a'); r(11, 2, 1, 1, '#ffe040');
            r(5, 7, 3, 3, '#ff6a2a'); r(2, 6 + up, 3, 2, '#ff4a2a'); r(1, 5 + up, 2, 1, '#ffe040'); r(3, 8, 2, 1, '#ff8a2a');
            r(7, 12, 1, 2, '#c04a1a'); r(10, 12, 1, 2, '#c04a1a');
        }),
        // 084 カエンダルマ: 炎をまとった だるま
        kaendaruma: art((r, f) => {
            r(4, 3, 8, 11, '#d82a2a'); r(3, 5, 10, 8, '#d82a2a'); r(7, 5, 5, 4, '#f8e0c0');
            r(8, 5, 1, 1, '#111111'); r(10, 5, 1, 1, '#111111'); r(8, 6, 1, 1, '#111111'); r(10, 6, 1, 1, '#111111');
            r(5, 10, 6, 1, '#ffd040'); r(4, 14, 8, 1, '#a01a1a');
            flame(r, 4, 0, f); flame(r, 7, -1 + 1, !f, true); flame(r, 11, 1, f);
        }),
        // 085 ヨウガンワーム: 溶岩の中を進む みみず
        youganworm: art((r, f) => {
            const up = f ? -1 : 0;
            r(1, 11, 4, 3, '#c03a1a'); r(4, 10, 4, 4, '#d84a1a'); r(7, 7 + up, 4, 4, '#e85a1a'); r(9, 3 + up, 5, 5, '#ff7a2a');
            r(2, 12, 1, 1, '#ffd040'); r(5, 11, 1, 1, '#ffd040'); r(8, 8 + up, 1, 1, '#ffd040');
            r(12, 4 + up, 1, 1, '#111111'); r(13, 6 + up, 1, 1, '#5a0a0a');
            r(0, 14, 16, 2, '#ff6a1a'); r(2 + (f ? 3 : 0), 14, 3, 1, '#ffd040'); r(11 - (f ? 3 : 0), 15, 2, 1, '#ffd040');
        }),
        // 086 マンドラゴン: 大根の体に竜の顔 (叫んでいる)
        mandoragon: art((r, f) => {
            const up = f ? -1 : 0;
            r(4, 1 + up, 2, 4, '#3aa04a'); r(7, 0 + up, 2, 5, '#4ac05a'); r(10, 1 + up, 2, 4, '#3aa04a');
            r(4, 5, 8, 8, '#f4f0e8'); r(5, 13, 6, 1, '#f4f0e8'); r(7, 14, 2, 1, '#e0d8c8'); r(8, 15, 1, 1, '#e0d8c8');
            r(12, 7, 3, 2, '#f4f0e8'); r(14, 7, 1, 1, '#a0a0a0'); r(10, 6, 1, 1, '#d02020'); r(9, 5, 2, 1, '#8a8a8a');
            r(12, 9, 3, f ? 2 : 1, '#c03030'); r(3, 9, 1, 2, '#e0d8c8');
        }),
        // 087 オバケカボチャ: ろうそくの入った かぼちゃの おばけ
        obakekabocha: art((r, f) => {
            r(7, 1, 2, 2, '#4a7a2a'); r(3, 3, 10, 8, '#ff8a1a'); r(6, 3, 1, 8, '#e06a10'); r(9, 3, 1, 8, '#e06a10');
            const eye = f ? '#fff080' : '#ffd040';
            r(5, 5, 2, 2, eye); r(10, 5, 2, 2, eye); r(5, 8, 6, 1, eye); r(6, 8, 1, 1, '#ff8a1a'); r(9, 8, 1, 1, '#ff8a1a');
            r(4, 11, 8, 3, '#e8e8ff'); [4, 7, 10].forEach(x => r(x + (f ? 1 : 0), 14, 2, 1, '#e8e8ff'));
        }),
        // 088 ハエトリグサーン: 大きな口のハエトリグサ
        haetorigusan: art((r, f) => {
            const open = f ? 1 : 0;
            r(4, 9, 2, 5, '#3a8a3a'); r(1, 12, 4, 2, '#4aa84a'); r(6, 12, 4, 2, '#4aa84a');
            r(4, 2 - open, 9, 3, '#5ac05a'); r(5, 5 - open, 8, 1, '#e03a4a'); r(4, 7, 9, 3, '#5ac05a'); r(5, 6, 8, 1, '#e03a4a');
            [6, 8, 10, 12].forEach(x => r(x, 5 - open, 1, 1, '#ffffff')); [7, 9, 11].forEach(x => r(x, 6, 1, 1, '#ffffff'));
            r(6, 2 - open, 1, 1, '#10162a'); r(9, 2 - open, 1, 1, '#10162a');
        }),
        // 089 コケムシャ: こけむした よろい武者
        kokemusha: art((r, f) => {
            r(5, 1, 6, 3, '#5a6a5a'); r(5, 1, 3, 1, '#6ab04a'); r(9, 2, 2, 1, '#6ab04a'); r(6, 0, 1, 1, '#ffe0a0');
            r(6, 4, 5, 2, '#3a3a3a'); r(8, 4, 1, 1, '#ff5040'); r(10, 4, 1, 1, '#ff5040');
            r(4, 6, 8, 5, '#5a6a5a'); r(4, 8, 8, 1, '#4a5a4a'); r(4, 6, 2, 2, '#6ab04a'); r(10, 9, 2, 2, '#6ab04a');
            r(13, 3 - (f ? 1 : 0), 1, 8, '#c0c8d0'); r(12, 10 - (f ? 1 : 0), 3, 1, '#8a6a3a');
            r(5, 11, 2, 4, '#4a5a4a'); r(9, 11, 2, 4, '#4a5a4a');
        }),
        // 090 タツマキツネ: 尻尾がたつまきのキツネ
        tatsumakitsune: art((r, f) => {
            r(5, 7, 7, 4, '#f08a30'); r(10, 4, 5, 4, '#f08a30'); r(10, 2, 1, 2, '#f08a30'); r(13, 2, 1, 2, '#f08a30');
            r(14, 6, 2, 1, '#fff0e0'); r(12, 5, 1, 1, '#111111'); r(7, 9, 4, 2, '#fff0e0');
            r(6, 11, 1, 3, '#d06a20'); r(10, 11, 1, 3, '#d06a20');
            const s = f ? 1 : 0, w = '#c8e0f0';
            r(1 + s, 1, 4, 1, w); r(2 - s, 2, 4, 1, w); r(1 + s, 3, 3, 1, w); r(2 - s, 4, 3, 1, w); r(3, 5, 2, 1, w); r(4, 6, 1, 2, w);
        }),
        // 091 カミナリグモ: 雷雲のクモ
        kaminarigumo: art((r, f) => {
            r(5, 2, 6, 1, '#6a6a88'); r(3, 3, 10, 5, '#5a5a78'); r(2, 4, 1, 3, '#5a5a78'); r(13, 4, 1, 3, '#5a5a78');
            r(9, 4, 1, 1, '#ffe040'); r(11, 4, 1, 1, '#ffe040'); r(10, 5, 1, 1, '#ffe040');
            [[2, 3], [4, 4], [6, 3], [10, 3], [12, 4], [14, 3]].forEach(([x, h]) => r(x, 8, 1, h, '#3a3a50'));
            if (f) { r(7, 8, 1, 2, '#ffe040'); r(8, 10, 1, 2, '#ffe040'); r(7, 12, 1, 2, '#ffe040'); }
        }),
        // 092 ワタゲボウシ: 綿毛の帽子をかぶった小人
        watageboushi: art((r, f) => {
            const up = f ? -1 : 0;
            r(4, 1 + up, 8, 5, '#ffffff'); r(3, 2 + up, 10, 3, '#ffffff'); r(5, 2 + up, 1, 1, '#e0e0e8'); r(9, 3 + up, 1, 1, '#e0e0e8');
            r(6, 6, 4, 3, SKIN); r(8, 7, 1, 1, '#111111'); r(9, 8, 1, 1, '#ff9ab0');
            r(6, 9, 4, 4, '#6ac04a'); r(6, 13, 1, 2, '#3a7a2a'); r(9, 13, 1, 2, '#3a7a2a');
            r(13, 2 + up, 1, 1, '#ffffff'); r(14, 1 - up, 1, 1, '#ffffff');
        }),

        // =====================================================================
        // ボス: 大魔王ASO・真 (99 階)。大魔王ASO の色を変える
        // =====================================================================
        maoushin: evo('maoushin', 'maou', { hue: 250, sat: 1.2 })
    };
    Object.assign(B.BIG, ART);
    KD.EnemyArt9 = { EVOLVED, tint };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
