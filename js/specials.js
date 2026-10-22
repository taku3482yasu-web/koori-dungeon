// =====================================================================
// 必殺技 (2026-10-22 ユーザー指定)
// ---------------------------------------------------------------------
// ダンジョンで 1 人 1 回・チームで 3 回まで 使える 大技。使うと 技の カットインの あと、キャラごとの エフェクトで 放つ。
// 名前は 前作 (スロット) の 必殺技 (koori-slot-aso の battleLines.js の SPECIALS)。やすさんたちの 技は ふつうの わざと
// 同じ 名前なので「・極」を 付けた。必殺技が ない キャラは 属性 × 役職の 汎用の 必殺技 (GENERIC)。強さ・範囲・おまけは Claude の 案。
//   range: room 見えている 敵 みんな / pierce 前に まっすぐ つらぬく / around2 周り 2 マス / front 正面の 1 体に 大きな 一撃 /
//          cross 十字 (上下左右に まっすぐ つらぬく)。hits: 当たる 回数 (2 なら 2 回 ダメージ)
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
        hibikimakuri: { name: '大音響4DX', element: 'ふしぎ', range: 'room', power: 1.8, status: 'flinch', chance: 1, fx: 'sound', color: '#e8c8ff', shout: 'これが４DXだ！' },
        yamamou: { name: 'おちょくりボーンフィーバー', element: 'ふつう', range: 'around2', power: 2.4, status: 'confuse', chance: 0.6, fx: 'bone', color: '#f4f0e0', shout: 'おちょくるなー！ モォー！' },
        sasaki: { name: 'ASAスラッシュ', element: 'ふつう', range: 'pierce', power: 2.8, fx: 'slash', color: '#ffffff', shout: '締め切り厳守です。' },
        kotani: { name: 'NABIテンポ', element: 'かぜ', range: 'room', power: 1.6, kiai: true, fx: 'tempo', color: '#ffe680', shout: '数字は うそを つきません。' },
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
        maou: { name: '亜祖宇激烈破', element: 'ほのお', range: 'room', power: 3, fx: 'fire', color: '#ff3a2a', shout: '消え去れ！' },
        // ----- 前作に 技が ない ボス・決闘の 相手 (2026-10-22: Claude の 仮組を ユーザーが 書き換えて 決定)。限定ボスの 再戦 (_q) も 同じ 技
        maoushin: { name: '亜祖宇激烈破・真', element: 'ふしぎ', range: 'room', power: 3.2, fx: 'fire', color: '#a04aff', shout: '真の力、思い知れ！ 亜祖宇激烈破・真！' },
        triplec: { name: 'トリプル・コンパイル', element: 'ほのお', range: 'pierce', power: 3, fx: 'beam', color: '#3aff8a', shout: 'ビルド開始！ トリプル・コンパイル！' },
        kokushinyan: { name: '国士無双・十三面ロン', element: 'ふしぎ', range: 'room', power: 2.6, fx: 'kunai', color: '#ffe680', shout: '十三面待ち……ロンだニャ！' },
        harryemperor: { name: 'インペリアル・カーブ・ニードル', element: 'ふつう', range: 'around2', power: 3, fx: 'needles', color: '#d8a8ff', shout: '余の トゲを 受けよ！' },
        harukirin: { name: '春麗', element: 'しぜん', range: 'room', power: 2.4, status: 'sleep', chance: 0.5, fx: 'leaf', color: '#ffb0c8', shout: '春よ、来たれ！' },
        kinmetsuki: { name: '金色の金棒', element: 'ほのお', range: 'around2', power: 3.2, fx: 'quake', color: '#ffd84a', shout: '金色の 鬼に ひれ伏せ！' },
        naitei: { name: '取り消しの二撃', element: 'ふしぎ', range: 'cross', power: 1.6, hits: 2, status: 'confuse', chance: 0.5, fx: 'flash', color: '#ffffff', shout: 'お前に内定はない！' },
        aruaru: { name: '内定の一撃', element: 'ふしぎ', range: 'room', power: 2.4, kiai: true, fx: 'moon', color: '#e8d8ff', shout: '内定の理を 見せてやろう！' },
        nadi: { name: 'お祈りの惨劇', element: 'ふしぎ', range: 'around2', power: 2.4, status: 'sleep', chance: 0.5, fx: 'smoke', color: '#c8d8ff', shout: 'お祈り 申し上げます' },
        hyougaryu: { name: '氷河の咆哮', element: 'こおり', range: 'pierce', power: 3, status: 'freeze', chance: 0.5, fx: 'ice', color: '#bff0ff', shout: '凍てつけ！' },
        goukioni: { name: '豪鬼一番槍', element: 'ほのお', range: 'pierce', power: 3, fx: 'dash', color: '#ff5a3a', shout: '一番槍、いくぞ！' },
        yahami: { name: '傲慢な美しき大強奪', element: 'ふしぎ', range: 'room', power: 2.4, fx: 'flash', color: '#ff9ae0', shout: 'お宝も 視線も、ぜんぶ いただくわ！' },
        ishii: { name: 'ケモノミチ大暴走', element: 'しぜん', range: 'pierce', power: 3, fx: 'dash', color: '#9ae07a', shout: 'ブヒッ！ 突撃だ！' },
        // チームバータス・チーム・ケモノミチの メンバー (2026-10-22 ユーザー指定: 新しい チームの メンバーも。決定)
        maechokkin: { name: '前髪そろえ・乱れ切り', element: 'かぜ', range: 'pierce', power: 2.8, fx: 'slash', color: '#e8f4ff', shout: 'チョッキン♪ ぜんぶ 切りそろえて あげる！' },
        norahan: { name: 'ニャハッと大どろぼう', element: 'みず', range: 'room', power: 1.8, kiai: true, fx: 'wave', color: '#4fa0ff', shout: 'ニャハッ♪ ぜんぶ いただき！' },
        mazuda: { name: 'ダンジョン育ちの剛拳', element: 'ふつう', range: 'around2', power: 2.8, guard: 4, fx: 'quake', color: '#c8a878', shout: 'ダンジョン育ちを なめるなよ！' },
        naitoon: { name: '月下の遠吠え', element: 'かぜ', range: 'room', power: 1.8, status: 'flinch', chance: 1, fx: 'sound', color: '#d8d0ff', shout: 'ワォーン！ 夜の迷宮は おれたちの もの！' }
    };

    // ----- 汎用の 必殺技 (2026-10-22 ユーザー指定: 必殺技が ない キャラは 属性と 役職で 決まる。例 こおり×アタッカー＝アイスブリザード) -----
    // 名前は 属性 × 役職 の 35 とおり (Claude の 案)。エフェクトと 色は 属性、範囲と おまけは 役職で 決まる
    const GENERIC = {
        'こおり': { attacker: 'アイスブリザード', defender: 'ダイヤモンドダスト・ガード', healer: 'スノーヒーリング', jammer: 'フリーズロック', supporter: 'オーロラエール' },
        'ほのお': { attacker: 'メテオフレイム', defender: 'ブレイズウォール', healer: 'ぬくもりの炎', jammer: 'ヒートヘイズ', supporter: 'ファイアーダンス' },
        'みず': { attacker: 'タイダルウェーブ', defender: 'アクアシールド', healer: 'いやしの雨', jammer: 'バブルトラップ', supporter: 'スプラッシュエール' },
        'しぜん': { attacker: 'リーフストーム', defender: 'ガイアウォール', healer: '森のめぐみ', jammer: 'ねむりの花畑', supporter: 'ひだまりの歌' },
        'かぜ': { attacker: 'ゲイルストーム', defender: 'つむじ風の盾', healer: 'そよ風のいやし', jammer: 'まどわしの竜巻', supporter: 'おいかぜ' },
        'ふしぎ': { attacker: 'ミラクルフラッシュ', defender: 'ミステリーバリア', healer: 'ふしぎな光', jammer: 'ゆめまぼろし', supporter: 'スターダストエール' },
        'ふつう': { attacker: 'ギガインパクト', defender: 'ガッツストンプ', healer: 'げんきの一撃', jammer: 'ドタバタ大騒ぎ', supporter: 'みんなで応援' }
    };
    // 属性: エフェクトと 色、ジャマーの 技の 状態異常
    const BY_ELEMENT = {
        'こおり': { fx: 'ice', color: '#bff0ff', status: 'freeze' },
        'ほのお': { fx: 'fire', color: '#ff7a3a', status: 'burn' },
        'みず': { fx: 'wave', color: '#4fa0ff', status: 'bind' },
        'しぜん': { fx: 'leaf', color: '#7ad85a', status: 'sleep' },
        'かぜ': { fx: 'wind', color: '#e8f4ff', status: 'confuse' },
        'ふしぎ': { fx: 'flash', color: '#d8a8ff', status: 'sleep' },
        'ふつう': { fx: 'quake', color: '#ffe680', status: 'flinch' }
    };
    // 役職: 範囲と おまけ
    const BY_ROLE = {
        attacker: { range: 'room', power: 2.4 },
        defender: { range: 'around2', power: 2.6, guard: 4 },
        healer: { range: 'room', power: 1.4, heal: 0.5 },
        jammer: { range: 'room', power: 1.6, chance: 0.6 },
        supporter: { range: 'room', power: 1.6, kiai: true }
    };

    // 仲間の キャラの 必殺技。line: 敵の ときの ひとこと (放つときに 言う)
    function of(kind, { element = 'ふつう', role = 'attacker', line = '' } = {}) {
        const base = String(kind).replace(/_q$/, '');
        if (LIST[base]) return { id: base, ...LIST[base] };
        const el = GENERIC[element] ? element : 'ふつう';
        const r = BY_ROLE[role] ? role : 'attacker';
        const { status, ...look } = BY_ELEMENT[el];
        const name = GENERIC[el][r];
        return { id: kind, element: el, ...BY_ROLE[r], ...look, ...(r === 'jammer' ? { status } : {}), name,
            shout: line ? `${line} ${name}！` : `いくぞ！ ${name}！`, generic: true };
    }

    KD.Specials = { MAX_TEAM, LIST, GENERIC, BY_ELEMENT, BY_ROLE, of };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
