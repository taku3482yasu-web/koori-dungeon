// =====================================================================
// 必殺技 (2026-10-22 ユーザー指定)
// ---------------------------------------------------------------------
// ダンジョンで 1 人 1 回・チームで 3 回まで 使える 大技。使うと 技の カットインの あと、キャラごとの エフェクトで 放つ。
// 名前は 前作 (スロット) の 必殺技 (koori-slot-aso の battleLines.js の SPECIALS)。やすさんたちの 技は ふつうの わざと
// 同じ 名前なので「・極」を 付けた。前作に ない キャラは、属性と 役職で 決まる (GENERIC)。強さ・範囲・おまけは Claude の 案。
//   range: room 見えている 敵 みんな / pierce 前に まっすぐ つらぬく / around2 周り 2 マス / front 正面の 1 体に 大きな 一撃
//   power: 強さ (わざの 強さと 同じ 目もり)。status・chance: おまけの 状態異常。heal: 仲間 みんなの HP を 回復 (割合)
//   guard: 仲間 みんなが まもりの かまえ (ターン)。kiai: 仲間 みんなの 次の 攻撃が 2 倍
//   fx: エフェクトの 種類 (game.js の drawSpecialFx)。color: 色。shout: 放つときの ひとこと (docs/story.md に 書き出す)
// =====================================================================
(function (KD) {
    'use strict';

    const MAX_TEAM = 3;   // チームで 1 回の ダンジョンに 使える 回数

    const LIST = {
        // ----- 探検隊「ばりきつよめ」 -----
        koori: { name: '大腸炎アタック', element: 'こおり', range: 'room', power: 2.2, status: 'colitis', chance: 0.6, fx: 'colitis', color: '#c8a060', shout: 'くらえ！ 大腸炎アタック！' },
        onioni: { name: '鬼鬼の金棒', element: 'ほのお', range: 'around2', power: 3, fx: 'quake', color: '#ff5a3a', shout: '鬼鬼の金棒、くらえ！' },
        yasu: { name: 'やすパンチ・極', element: 'ふつう', range: 'front', power: 3, heal: 0.5, fx: 'punch', color: '#7ae07a', shout: 'いくよ！ やすパンチ・極！' },
        tamu: { name: 'たむキック・極', element: 'かぜ', range: 'pierce', power: 2.4, status: 'sleep', chance: 0.7, fx: 'kick', color: '#9ad8ff', shout: 'これで終わりや！ たむキック・極！' },
        dake: { name: 'だけチョップ・極', element: 'ふつう', range: 'front', power: 4, guard: 5, fx: 'chop', color: '#ffb030', shout: 'この鍛え上げたこぶしで…だけチョップ・極！' },
        // ----- ライバル探検隊 (前作) -----
        okagappa: { name: 'おかピポっと光線', element: 'みず', range: 'pierce', power: 2.6, fx: 'beam', color: '#4fb0ff', shout: 'おかピポ！ イェア！' },
        hibikimakuri: { name: '大音響4DX', element: 'かぜ', range: 'room', power: 1.8, status: 'flinch', chance: 1, fx: 'sound', color: '#e8c8ff', shout: 'これが４DXだ！' },
        yamamou: { name: 'おちょくりボーンフィーバー', element: 'ふつう', range: 'around2', power: 2.4, status: 'confuse', chance: 0.6, fx: 'bone', color: '#f4f0e0', shout: 'おちょくるなー！ モォー！' },
        sasaki: { name: 'ASAスラッシュ', element: 'ふつう', range: 'pierce', power: 2.8, fx: 'slash', color: '#ffffff', shout: '締め切り厳守です。' },
        kotani: { name: 'NABIテンポ', element: 'ふしぎ', range: 'room', power: 1.6, kiai: true, fx: 'tempo', color: '#ffe680', shout: '数字は うそを つきません。' },
        asahara: { name: 'DOPAPANCHI', element: 'ほのお', range: 'front', power: 5, fx: 'punch', color: '#ff4a2a', shout: 'ひれ伏せ！ DOPAPANCHI！' },
        shibata: { name: 'シバタードライバー', element: 'ふつう', range: 'front', power: 4.2, status: 'flinch', chance: 1, fx: 'drop', color: '#ffd84a', shout: 'バーイ！ んなああ～' },
        ikekimu: { name: 'イケキムドライブ', element: 'かぜ', range: 'pierce', power: 3, fx: 'dash', color: '#c8a8ff', shout: 'すきだらけだ。' },
        ueno: { name: 'マッスルウエノクラッシュ', element: 'ふつう', range: 'around2', power: 3.2, fx: 'quake', color: '#ff9a6a', shout: '妻への愛を受けてみよ！' },
        // ----- 前作の ボス・強敵 (仲間に なったとき) -----
        harry: { name: 'メンキョナイ・ニードル', element: 'ふつう', range: 'around2', power: 2.4, fx: 'needles', color: '#d8a8ff', shout: 'メンキョナイー！' },
        urashima: { name: '玉手箱スモーク', element: 'みず', range: 'room', power: 1.5, status: 'sleep', chance: 0.6, fx: 'smoke', color: '#e8e8f0', shout: 'えい、けむりじゃ！' },
        makibikon: { name: 'ドリル・エクスキューション', element: 'ふつう', range: 'pierce', power: 3, fx: 'beam', color: '#ff5a5a', shout: '排除を開始するであります。' },
        nakata: { name: 'アクアブレス', element: 'みず', range: 'pierce', power: 3, fx: 'wave', color: '#3a8ad0', shout: 'グオオオオ！' },
        goldDog: { name: 'ゴールドかみまっくす', element: 'ふつう', range: 'front', power: 4, fx: 'bite', color: '#ffd84a', shout: 'ワン！（邪悪な笑み）' },
        daishi: { name: '鬼面説法', element: 'ふしぎ', range: 'room', power: 2, status: 'confuse', chance: 0.5, fx: 'flash', color: '#ffb0ff', shout: '仏の顔も、ここまでです。' },
        zumitani: { name: '影分身クナイ乱れ打ち', element: 'かぜ', range: 'room', power: 2.2, fx: 'kunai', color: '#c8ccd8', shout: 'ついてこられるかな♪' },
        runaya: { name: 'ルナティック・ムーンビーム', element: 'ふしぎ', range: 'room', power: 2.4, fx: 'moon', color: '#fff4c0', shout: '月の力よ…！ 月の力よ…あら、もう言ったかしら？' },
        nozoema: { name: '鏡筋一刀斬り', element: 'ふつう', range: 'pierce', power: 3.4, fx: 'slash', color: '#e0e8ff', shout: 'この刀を越えてみせよ！' },
        maou: { name: '亜祖宇激烈破', element: 'ほのお', range: 'room', power: 3, fx: 'fire', color: '#ff3a2a', shout: '消え去れ！' }
    };

    // 前作に ない キャラ: 属性で 技の 名前と エフェクト、役職で 範囲と おまけ
    const BY_ELEMENT = {
        'こおり': { name: 'ブリザード・バースト', fx: 'ice', color: '#bff0ff' },
        'ほのお': { name: 'フレイム・バースト', fx: 'fire', color: '#ff7a3a' },
        'みず': { name: 'タイダル・ウェーブ', fx: 'wave', color: '#4fa0ff' },
        'しぜん': { name: 'グリーン・ストーム', fx: 'leaf', color: '#7ad85a' },
        'かぜ': { name: 'ゲイル・ストーム', fx: 'wind', color: '#e8f4ff' },
        'ふしぎ': { name: 'ミラクル・フラッシュ', fx: 'flash', color: '#d8a8ff' },
        'ふつう': { name: 'ギガ・インパクト', fx: 'quake', color: '#ffe680' }
    };
    const BY_ROLE = {
        attacker: { range: 'room', power: 2.2 },
        defender: { range: 'around2', power: 2.4, guard: 4 },
        healer: { range: 'room', power: 1.4, heal: 0.4 },
        jammer: { range: 'room', power: 1.6, status: 'sleep', chance: 0.5 },
        supporter: { range: 'room', power: 1.6, kiai: true }
    };

    // u (仲間の キャラ) の 必殺技。line: 敵の ときの ひとこと (放つときに 言う)
    function of(kind, { element = 'ふつう', role = 'attacker', line = '' } = {}) {
        const base = String(kind).replace(/_q$/, '');
        if (LIST[base]) return { id: base, ...LIST[base] };
        const el = BY_ELEMENT[element] || BY_ELEMENT['ふつう'];
        return { id: kind, element, ...BY_ROLE[role] || BY_ROLE.attacker, ...el, shout: line ? `${line} ${el.name}！` : `いくぞ！ ${el.name}！`, generic: true };
    }

    KD.Specials = { MAX_TEAM, LIST, BY_ELEMENT, BY_ROLE, of };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
