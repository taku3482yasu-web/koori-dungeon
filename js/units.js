// =====================================================================
// キャラのデータと戦いの計算 (仕様書 6章・敵キャラ表)
// ---------------------------------------------------------------------
// 主人公 2 人 (こおりくん・おにおに) と、ハリーの森の敵 7 体。
// 能力・けいけんち・ダメージの計算だけで、画面にもマップにも触らない (game.js が使う)。
// 段階 2 はふつうの攻撃だけ。わざ・属性・状態異常・役職は段階 3 から。
// =====================================================================
(function (KD) {
    'use strict';

    // 主人公 (仕様書 6.2)。base は Lv1 の能力、grow は Lv が 1 上がるごとに増える量
    //   こおりくん: オールラウンダー (どの能力もそこそこ)
    //   おにおに: 攻撃と守りに特化 (こうげき・ぼうぎょ・HP が高い。とくこうは低い)
    const HEROES = {
        koori: {
            id: 'koori', name: 'こおりくん', element: 'こおり', type: 'オールラウンダーなアタッカー',
            note: 'どの能力もそこそこ。ふつうの攻撃もわざも使える',
            base: { hp: 30, atk: 10, def: 9, spa: 10, spd: 9 },
            grow: { hp: 4, atk: 2, def: 1.8, spa: 2, spd: 1.8 }
        },
        onioni: {
            id: 'onioni', name: 'おにおに', element: 'ほのお', type: '攻撃と守りに特化したアタッカー',
            note: 'こうげき・ぼうぎょ・HP が高い。とくこうは低め',
            base: { hp: 36, atk: 12, def: 11, spa: 6, spd: 8 },
            grow: { hp: 5, atk: 2.4, def: 2.2, spa: 1.2, spd: 1.5 }
        }
    };

    // ハリーの森の敵 (敵キャラ表 001〜007)。能力は Lv1 のとき
    //   ai: approach 近づく / wait まつ / flee にげる / shoot 撃つ
    //   speed: 2 なら 1 ターンに 2 回動く (はやい)
    //   段階 2 では、ねむり・しばりなどの とくちょう はまだ使わない (段階 3)。
    //   ペコリスは道具がまだないので、HP が半分を切ると逃げる (道具を取るのは段階 4)
    const ENEMIES = {
        haribaby:   { no: '001', name: 'ハリベビー', element: 'ふつう', ai: 'approach', speed: 1, hp: 10, atk: 7, def: 4, exp: 6, line: 'ハリ…！' },
        mumenbachi: { no: '002', name: 'ムメンキョバチ', element: 'かぜ', ai: 'approach', speed: 2, hp: 7, atk: 5, def: 3, exp: 8, line: 'メンキョナイー！' },
        donguriko:  { no: '003', name: 'ドングリコ', element: 'しぜん', ai: 'approach', speed: 1, hp: 12, atk: 6, def: 7, exp: 7, line: 'コロコロ～' },
        nemuridake: { no: '004', name: 'ネムリダケ', element: 'しぜん', ai: 'wait', speed: 1, hp: 15, atk: 7, def: 5, exp: 9, line: 'ふぁ～…' },
        pekorisu:   { no: '005', name: 'ペコリス', element: 'ふつう', ai: 'flee', speed: 1, hp: 16, atk: 8, def: 6, exp: 12, line: 'いただきっ！' },
        tsutankobu: { no: '006', name: 'ツタンコブ', element: 'しぜん', ai: 'wait', speed: 1, hp: 22, atk: 10, def: 8, exp: 14, line: 'からまっちゃえ' },
        yofukashi:  { no: '007', name: 'ヨフカシフクロウ', element: 'かぜ', ai: 'shoot', speed: 1, hp: 15, atk: 8, def: 5, exp: 14, line: 'まだ寝ないホー' }
    };

    // 階ごとに出る敵 (ハリーの森 B1F〜B5F)。下の階ほど強い敵がまざる
    const FOREST_TABLE = [
        ['haribaby', 'mumenbachi', 'donguriko'],
        ['haribaby', 'mumenbachi', 'donguriko', 'nemuridake'],
        ['mumenbachi', 'donguriko', 'nemuridake', 'pekorisu', 'yofukashi'],
        ['donguriko', 'nemuridake', 'pekorisu', 'tsutankobu', 'yofukashi'],
        ['nemuridake', 'pekorisu', 'tsutankobu', 'yofukashi']
    ];

    const MAX_LV = 99;
    const HIT = 0.9;   // ふつうの攻撃が当たる確率

    // 主人公の Lv ごとの能力
    function heroStats(id, lv) {
        const h = HEROES[id];
        const s = {};
        for (const k of Object.keys(h.base)) s[k] = Math.floor(h.base[k] + h.grow[k] * (lv - 1));
        return s;
    }

    // 敵の Lv ごとの能力 (Lv が 1 上がるごとに 2 割ずつ強くなる)
    function enemyStats(kind, lv) {
        const e = ENEMIES[kind];
        const k = 1 + 0.2 * (lv - 1);
        return { hp: Math.round(e.hp * k), atk: Math.round(e.atk * k), def: Math.round(e.def * k), exp: Math.round(e.exp * (1 + 0.3 * (lv - 1))) };
    }

    // 次の Lv までに要るけいけんち
    const expToNext = lv => 8 + lv * lv * 4;

    // けいけんちを足す。上がった Lv の数を返す (unit: { lv, exp })
    function gainExp(unit, n) {
        unit.exp += n;
        let up = 0;
        while (unit.lv < MAX_LV && unit.exp >= expToNext(unit.lv)) {
            unit.exp -= expToNext(unit.lv);
            unit.lv++;
            up++;
        }
        return up;
    }

    // ふつうの攻撃のダメージ。こうげきが ぼうぎょ より高いほど よく効く。少しばらつく。最低 1
    function damage(rng, atk, def) {
        const base = atk * atk / (atk + def);
        return Math.max(1, Math.round(base * (0.85 + rng.next() * 0.3)));
    }

    KD.Units = { HEROES, ENEMIES, FOREST_TABLE, HIT, heroStats, enemyStats, expToNext, gainExp, damage };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
