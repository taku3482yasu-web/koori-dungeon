// =====================================================================
// 仲間のデータ: ★・能力の振り分け・覚えるわざ (2026-10-22 ユーザー指定で、キャラごとに差をつけた)
// ---------------------------------------------------------------------
// 仲間になれるキャラ (敵 001〜052・ライバル探検隊 15 人) は、それぞれ
//   star: ★1〜5 (敵キャラ表の強さ。ライバルは リーダー ★5・ほか ★4。ユーザー指定)
//   role: 仲間のときの役職 (書いていなければ 敵の role)
//   w: 能力の振り分け [HP, こうげき, ぼうぎょ, とくこう, とくぼう] (100 がふつう。平均が 100 になるように直して使う)
//   learn: 覚えるわざ ('Lv:わざ' を空白で区切る。Lv1 のわざは はじめから持っている)
// を持つ。能力は こおりくん (★5・Lv1) を目安に ★と振り分けで決まる (allyStats)。
// わざは 3 種類: 役職の汎用わざ (GENERIC。どのキャラも覚えられる) / そのキャラだけの固有わざ / 敵のときのわざ。
// ほかの役職の汎用わざを覚えるキャラもいる (攻撃もできるヒーラー など)。
// 主人公 (こおりくん・おにおに) は ★5、やすさん・たむさん・だけさん は ★4 (案)。この 5 人は units.js・enemies.js の base・grow・learn を使う。
// ストーリーをクリアすると、ライバル探検隊の 15 人が 町に来て仲間になる (townui.js の joinRivals)。
// =====================================================================
(function (KD) {
    'use strict';

    const U = KD.Units, C = KD.Collection;
    const f = (name, element, range, power, extra = {}) => ({ name, element, range, power, acc: 0.9, pp: 15, ...extra });

    // ----- 役職の汎用わざ (どのキャラも覚えられる。ふつうは その役職のキャラが覚える) -----
    const GENERIC = {
        attacker: ['mouda', 'tosshin', 'senpu', 'hissatsu'],
        defender: ['tate', 'teppeki', 'jinarashi'],
        healer: ['shizuku', 'megumi'],
        jammer: ['shibirekona', 'dokubari', 'mekuramashi'],
        supporter: ['tsubute', 'tankenkan']
    };
    Object.assign(U.SKILLS, {
        // アタッカー
        mouda: f('もうだ', 'ふつう', 'front', 1.6, { note: '正面の敵を 強く たたく' }),
        tosshin: f('とっしん', 'ふつう', 'front', 2.0, { acc: 0.8, pp: 10, status: 'flinch', chance: 0.2, note: '当たりにくいが とても強い。ひるませることもある' }),
        senpu: f('せんぷうぎり', 'かぜ', 'around', 1.1, { pp: 10, note: '周りの敵みんなを 切る' }),
        hissatsu: f('ひっさつのいちげき', 'ふつう', 'front', 2.6, { acc: 0.75, pp: 5, note: '当たれば 大ダメージ' }),
        // ディフェンダー
        tate: f('たてアタック', 'ふつう', 'front', 1.1, { status: 'flinch', chance: 0.4, note: '正面の敵を たてで押して ひるませる' }),
        teppeki: { name: 'てっぺき', range: 'self', pp: 6, buff: 'guard', turns: 8, note: '8 ターン、受けるダメージが半分' },
        jinarashi: f('じならし', 'しぜん', 'around', 1.0, { acc: 0.95, pp: 10, note: '地面をゆらして 周りの敵に攻撃' }),
        // ヒーラー
        shizuku: { name: 'いやしのしずく', range: 'self', pp: 15, heal: 0.25, note: '自分と となりの仲間の HP を 少し回復' },
        megumi: { name: 'めぐみのあめ', range: 'self', pp: 4, heal: 0.6, note: '自分と となりの仲間の HP を たくさん回復' },
        // ジャマー
        shibirekona: f('しびれごな', 'しぜん', 'front', 0, { acc: 0.85, pp: 12, status: 'para', chance: 1, note: '正面の敵を まひさせる' }),
        dokubari: f('どくばり', 'しぜん', 'line', 0.6, { pp: 12, status: 'poison', chance: 0.7, note: 'まっすぐ飛ぶ針。どくにする' }),
        mekuramashi: f('めくらまし', 'ふしぎ', 'around', 0, { acc: 0.85, pp: 8, status: 'blind', chance: 1, note: '周りの敵を 目つぶしにする' }),
        // サポーター
        tsubute: f('つぶてなげ', 'ふつう', 'line', 0.9, { pp: 20, note: '小石を まっすぐ投げる' }),
        tankenkan: { name: 'たんけんのカン', range: 'self', pp: 2, reveal: 'map', note: '階の地図と、道具の場所がわかる' },

        // ----- 固有わざ (そのキャラだけ) -----
        // ストーリーの仲間
        yasu_aid: { name: 'やすさんの応急手当', range: 'self', pp: 6, heal: 0.5, note: '自分と となりの仲間の HP を 半分回復（やすさんだけ）' },
        tamu_trap: f('たむさんのしかけ', 'しぜん', 'around', 0, { acc: 0.85, pp: 6, status: 'bind', chance: 1, note: '周りの敵を しばる（たむさんだけ）' }),
        dake_buster: f('だけバスター', 'ふつう', 'front', 2.0, { pp: 8, status: 'flinch', chance: 0.4, note: '守るだけじゃない 強烈な一撃（だけさんだけ）' }),
        // 敵 001〜052 (敵のときに わざがなかったキャラ)
        hari_toge: f('はりとげ', 'ふつう', 'line', 0.9, { note: '背中の針を 飛ばす' }),
        tane_gun: f('たねマシンガン', 'しぜん', 'line', 1.0, { note: 'ほっぺのたねを 連射する' }),
        koura_tackle: f('こうらタックル', 'みず', 'front', 1.3, { note: '甲羅ごと ぶつかる' }),
        oonami: f('おおなみ', 'みず', 'line', 1.2, { pp: 12, special: true, note: '大きな波を まっすぐ起こす' }),
        hannya_glare: f('はんにゃのにらみ', 'ふしぎ', 'front', 1.2, { status: 'flinch', chance: 0.3, note: 'こわい顔で にらんで攻撃' }),
        spam_mail: f('めいわくメール', 'ふしぎ', 'line', 0.5, { status: 'confuse', chance: 0.5, note: '当選のお知らせで こんらんさせる' }),
        shuriken: f('しゅりけん', 'かぜ', 'line', 1.0, { note: 'まっすぐ しゅりけんを投げる' }),
        makibishi_maki: f('まきびしまき', 'ふつう', 'around', 0.8, { pp: 10, status: 'para', chance: 0.3, note: '周りに まきびしをまく' }),
        bakuhatsu: f('ばくはつ', 'ほのお', 'around', 2.0, { acc: 1, pp: 3, note: '周りを巻きこんで 大爆発' }),
        tsuki_hikari: { name: 'つきのひかり', range: 'self', pp: 6, heal: 0.45, note: '月の光で 自分と となりの仲間を回復' },
        mochitsuki: f('もちつき', 'ふつう', 'front', 1.4, { note: 'きねで ぺったん' }),
        chouonpa: f('ちょうおんぱ', 'かぜ', 'line', 0.5, { pp: 12, status: 'confuse', chance: 0.6, note: 'まっすぐ届く音で こんらんさせる' }),
        kamikudaki: f('かみくだき', 'ふつう', 'front', 1.8, { pp: 10, status: 'flinch', chance: 0.2, note: 'するどい きばで かむ' }),
        nebaneba: f('ねばねば', 'みず', 'front', 0.8, { pp: 12, status: 'bind', chance: 0.6, note: 'ねばねばで しばる' }),
        kage_uchi: f('かげうち', 'ふしぎ', 'line', 1.3, { pp: 10, special: true, note: '影の矢を まっすぐ撃つ' }),
        golem_press: f('ゴーレムプレス', 'ふつう', 'front', 2.2, { acc: 0.8, pp: 8, note: '大きな体で のしかかる' }),
        dumbbell: f('ダンベルなげ', 'ふつう', 'line', 1.4, { pp: 10, note: 'ダンベルを まっすぐ投げる' }),
        mirror_pose: { name: 'ミラーポーズ', range: 'self', pp: 8, buff: 'guard', turns: 6, note: 'キレてるポーズで 6 ターン ダメージ半分' },
        yoroi_gatame: { name: 'よろいがため', range: 'self', pp: 5, buff: 'guard', turns: 12, note: '12 ターン、受けるダメージが半分' },
        tsubo_mahou: f('つぼのまほう', 'ふしぎ', 'around', 0.9, { pp: 8, status: 'confuse', chance: 0.3, special: true, note: '周りの敵に ふしぎな まほう' }),
        aso_yari: f('アソやり', 'ふつう', 'line', 1.1, { note: 'やりで まっすぐ突く' }),
        kamitsuki: f('かみつき', 'ふつう', 'front', 1.7, { pp: 10, status: 'flinch', chance: 0.3, note: '宝箱の口で かみつく' }),
        toritate: f('とりたて', 'ふしぎ', 'front', 1.0, { pp: 12, status: 'weak', chance: 0.6, note: '「かえせ…」で よわきにする' }),
        kinpika: f('きんピカ', 'ふつう', 'around', 0, { acc: 0.85, pp: 8, status: 'blind', chance: 0.8, note: '金色に光って 目つぶし' }),
        // ライバル探検隊 (前作の必殺技。チームバータス・チーム・ケモノミチ は Claude の案)
        okapipo_beam: f('おかピポっと光線', 'みず', 'line', 1.8, { pp: 6, special: true, status: 'confuse', chance: 0.3, note: 'ノリと勢いの光線（おかがっぱだけ）' }),
        daionkyou: f('大音響4DX', 'かぜ', 'around', 1.3, { pp: 6, special: true, status: 'confuse', chance: 0.4, note: '周りに 大音響を響かせる（ひびきまくりだけ）' }),
        ochokuri: f('おちょくりボーンフィーバー', 'ふつう', 'front', 1.8, { pp: 6, status: 'flinch', chance: 0.4, note: 'おちょくられた怒りの一撃（やまもぅだけ）' }),
        dopapanchi: f('DOPAPANCHI', 'ほのお', 'front', 3.0, { acc: 0.8, pp: 4, note: '一撃で相手を屠る（KING.ASAHARAだけ）' }),
        nabi_tempo: f('NABIテンポ', 'ふしぎ', 'around', 0, { acc: 0.9, pp: 6, status: 'para', chance: 0.8, note: '確率どおりに 周りの敵を まひさせる（Mr.KOTANIだけ）' }),
        asa_slash: f('ASAスラッシュ', 'ふつう', 'front', 2.2, { pp: 6, note: '締め切り厳守の 一閃（Mr.SASAKIだけ）' }),
        shibata_driver: f('シバタードライバー', 'ふつう', 'front', 2.6, { acc: 0.85, pp: 5, status: 'flinch', chance: 0.5, note: '撮れ高ばっちりの 投げ技（シバターだけ）' }),
        ueno_crush: f('マッスルウエノクラッシュ', 'ふつう', 'around', 1.8, { pp: 5, note: '筋肉で 周りを なぎはらう（マッスルウエノーブルだけ）' }),
        ikekimu_drive: f('イケキムドライブ', 'かぜ', 'line', 2.0, { pp: 6, status: 'blind', chance: 0.4, note: '暗殺術の 突進（イケキムだけ）' }),
        mirror_charm: f('みりょうの手鏡', 'ふしぎ', 'around', 1.4, { pp: 6, special: true, status: 'confuse', chance: 0.4, note: '美しさで 周りの敵を まどわす（ヤーハミーだけ）' }),
        chokkin: f('チョッキンカット', 'かぜ', 'front', 2.0, { pp: 8, status: 'weak', chance: 0.5, note: '大きなはさみで 切りそろえる（マエチョッキンだけ）' }),
        nekodamashi: f('ねこだまし', 'みず', 'front', 1.2, { pp: 8, status: 'flinch', chance: 1, note: 'かならず ひるませる（ノラハンだけ）' }),
        inoshishi: f('いのしし突進', 'しぜん', 'front', 2.4, { acc: 0.8, pp: 6, status: 'flinch', chance: 0.3, note: 'まっすぐ 突っこむ（イシイーだけ）' }),
        bear_hug: f('ツキノワベアハッグ', 'ふつう', 'front', 1.8, { pp: 8, status: 'bind', chance: 0.5, note: 'だきしめて しばる（マズダだけ）' }),
        night_howl: f('ナイトハウル', 'かぜ', 'around', 0.9, { pp: 8, status: 'weak', chance: 0.6, note: '夜の遠吠えで 周りの敵を よわきにする（NAITOONだけ）' })
    });

    // ----- キャラごと -----
    const a = (star, w, learn, role) => ({ star, w, learn, role });
    const ALLIES = {
        // 1. ハリーの森
        haribaby: a(1, [95, 125, 80, 80, 90], '1:hari_toge 5:mouda 12:tosshin 22:senpu 35:hissatsu'),
        mumenbachi: a(1, [75, 120, 70, 95, 80], '1:tsukkomi 6:mouda 14:dokubari 25:tosshin 38:hissatsu'),
        donguriko: a(1, [115, 95, 125, 70, 95], '1:korogari 5:tate 12:teppeki 20:jinarashi 32:tosshin'),
        nemuridake: a(1, [105, 70, 90, 115, 120], '1:nemurigona 6:shibirekona 14:dokubari 24:shizuku 36:mekuramashi'),
        pekorisu: a(2, [90, 105, 85, 80, 90], '1:tane_gun 7:tsubute 15:mouda 26:tankenkan 40:tosshin'),
        tsutankobu: a(2, [130, 100, 115, 80, 105], '1:karamitsuku 8:teppeki 16:shibirekona 28:jinarashi 42:shizuku'),
        yofukashi: a(2, [90, 85, 80, 125, 100], '1:habataki 8:mekuramashi 16:tsubute 28:shibirekona 40:senpu'),
        // 2. 浦の島の海岸どうくつ
        kogame: a(2, [120, 80, 135, 70, 110], '1:koura_tackle 7:teppeki 15:tate 26:shizuku 40:jinarashi'),
        tamatebakogani: a(2, [95, 110, 105, 85, 90], '1:kemuri 7:mouda 15:mekuramashi 27:senpu 40:tosshin'),
        tsuribariuo: a(2, [85, 90, 75, 120, 90], '1:tsuribari 8:tsubute 16:dokubari 28:shibirekona 40:mekuramashi'),
        wasurekurage: a(3, [90, 75, 85, 125, 120], '1:wasure 8:dokubari 16:shizuku 28:mekuramashi 40:megumi'),
        otohimedai: a(3, [100, 80, 90, 120, 115], '1:odori 8:shizuku 16:tankenkan 28:megumi 42:mekuramashi'),
        isoginchakku: a(2, [125, 105, 110, 85, 100], '1:suikomi 8:teppeki 16:dokubari 28:jinarashi 40:tosshin'),
        umibozun: a(3, [110, 95, 85, 125, 90], '1:oonami 8:mouda 16:senpu 28:mekuramashi 42:hissatsu'),
        // 3. ネット寺
        netkozou: a(2, [85, 75, 85, 125, 115], '1:okyou 8:tsubute 16:shibirekona 28:shizuku 40:mekuramashi'),
        enjoubouzu: a(3, [105, 130, 95, 90, 80], '1:enjou 8:mouda 16:tosshin 28:senpu 42:hissatsu'),
        mokugyoro: a(2, [110, 85, 125, 95, 110], '1:pokupoku 8:teppeki 16:shibirekona 28:jinarashi 40:shizuku'),
        hannyamen: a(3, [100, 130, 90, 95, 85], '1:hannya_glare 8:mouda 16:tosshin 28:hissatsu 42:senpu'),
        spamdama: a(2, [85, 85, 80, 115, 95], '1:spam_mail 8:tsubute 16:tankenkan 28:dokubari 40:mekuramashi'),
        burakrasher: a(3, [90, 90, 80, 130, 100], '1:buratsu 8:dokubari 16:mekuramashi 28:tsubute 42:senpu'),
        rousokubi: a(2, [85, 90, 80, 135, 95], '1:hinotama 8:tsubute 16:senpu 28:mouda 40:hissatsu'),
        // 4. 忍びの屋敷
        geninman: a(3, [100, 120, 95, 95, 90], '1:shuriken 8:mouda 16:senpu 28:tosshin 42:hissatsu'),
        kunaisuzume: a(3, [85, 125, 80, 105, 85], '1:kunai 8:tsubute 16:mouda 28:senpu 42:hissatsu'),
        kawarimidanuki: a(3, [105, 105, 95, 110, 95], '1:doron 8:mekuramashi 16:mouda 28:shibirekona 42:tankenkan'),
        makibishimushi: a(3, [100, 90, 130, 80, 110], '1:makibishi_maki 8:teppeki 16:tankenkan 28:tate 42:dokubari'),
        shurikenbo: a(4, [95, 130, 85, 100, 85], '1:kaiten 8:senpu 16:mouda 28:tosshin 42:hissatsu'),
        shinobigaeru: a(3, [105, 115, 90, 105, 95], '1:tobidashi 8:mouda 16:dokubari 28:tosshin 42:hissatsu'),
        bakudanjirou: a(4, [115, 120, 90, 120, 80], '1:bakuhatsu 10:mouda 20:senpu 32:tosshin 45:hissatsu'),
        // 5. 月の迷宮
        tsukiusagi: a(3, [105, 130, 90, 95, 105], '1:tsuki_hikari 8:mochitsuki 16:shizuku 28:mouda 42:megumi'),
        mikazukibat: a(3, [90, 105, 80, 105, 95], '1:chouonpa 8:mekuramashi 16:mouda 28:dokubari 42:senpu'),
        mangetsuwolf: a(4, [105, 135, 90, 85, 85], '1:kamikudaki 8:mouda 16:tosshin 28:senpu 42:hissatsu'),
        hoshikuzun: a(3, [90, 80, 90, 125, 115], '1:kira 8:tsubute 16:shizuku 28:tankenkan 42:mekuramashi'),
        nandomoslime: a(4, [140, 95, 110, 90, 115], '1:nebaneba 8:teppeki 16:shizuku 28:jinarashi 42:megumi'),
        lunashadow: a(4, [95, 115, 80, 130, 90], '1:kage_uchi 8:mekuramashi 16:senpu 28:mouda 42:hissatsu'),
        yukimidango: a(3, [115, 95, 120, 105, 115], '1:yukidama 8:teppeki 16:tate 28:shizuku 42:jinarashi'),
        // 6. 筋肉の山
        proteingolem: a(4, [140, 125, 120, 60, 90], '1:golem_press 10:teppeki 20:jinarashi 32:tosshin 45:hissatsu'),
        dumbbellkong: a(4, [120, 135, 95, 70, 80], '1:dumbbell 8:mouda 16:tosshin 28:jinarashi 42:hissatsu'),
        mirrormuscle: a(4, [115, 105, 120, 95, 130], '1:mirror_pose 8:tate 16:teppeki 28:mouda 42:senpu'),
        yoroinukegara: a(4, [110, 95, 150, 70, 105], '1:yoroi_gatame 8:tate 16:teppeki 28:jinarashi 42:tosshin'),
        asedakku: a(3, [105, 95, 95, 105, 100], '1:ase 8:tsubute 16:shizuku 28:tankenkan 42:mouda'),
        magmatcho: a(4, [115, 135, 100, 95, 80], '1:magma 8:mouda 16:jinarashi 28:tosshin 42:hissatsu'),
        yukidarumuscle: a(4, [120, 130, 105, 85, 90], '1:kori_punch 8:mouda 16:tate 28:tosshin 42:hissatsu'),
        // 7. ASOの壺の底
        tsubomajin: a(4, [110, 85, 100, 125, 110], '1:tsubo_mahou 8:tankenkan 16:shizuku 28:mekuramashi 42:megumi'),
        asohei: a(4, [110, 120, 105, 85, 90], '1:aso_yari 8:mouda 16:tate 28:senpu 42:hissatsu'),
        takaramimic: a(5, [125, 125, 125, 80, 105], '1:kamitsuki 10:teppeki 20:tosshin 32:jinarashi 45:hissatsu'),
        shakkinbourei: a(4, [100, 90, 95, 120, 115], '1:toritate 8:tankenkan 16:mekuramashi 28:dokubari 42:shizuku'),
        fusaiyougaikotsu: a(4, [95, 95, 95, 130, 105], '1:fusaiyou 8:dokubari 16:mekuramashi 28:shibirekona 42:senpu'),
        nakatadraco: a(5, [120, 115, 105, 135, 105], '1:mizu_breath 10:mouda 20:senpu 32:tosshin 45:hissatsu'),
        makibikonmk3: a(4, [110, 110, 115, 120, 100], '1:beam 8:tsubute 16:teppeki 28:senpu 42:hissatsu'),
        koorimodoki: a(5, [105, 125, 95, 125, 95], '1:koori_sword 1:koori_hammer 12:koori_breath 24:senpu 40:hissatsu'),
        // どこにでも出る
        daichouenkin: a(2, [80, 80, 75, 115, 95], '1:kin 8:dokubari 16:shibirekona 28:mekuramashi 40:shizuku'),
        kinmenkoinu: a(3, [90, 95, 90, 95, 100], '1:kinpika 8:tsubute 16:tankenkan 28:shizuku 42:mouda'),
        // ライバル探検隊 (ストーリーをクリアすると仲間になる。リーダー ★5・ほか ★4)
        okagappa: a(5, [105, 100, 90, 135, 100], '1:okapipo_beam 1:mouda 15:senpu 30:mekuramashi 45:hissatsu', 'attacker'),
        hibikimakuri: a(4, [90, 95, 80, 130, 105], '1:daionkyou 1:mekuramashi 15:shibirekona 30:tsubute 45:senpu', 'jammer'),
        yamamou: a(4, [130, 110, 125, 70, 110], '1:ochokuri 1:tate 15:teppeki 30:jinarashi 45:tosshin', 'defender'),
        asahara: a(5, [115, 145, 95, 85, 90], '1:dopapanchi 1:mouda 15:tosshin 30:senpu 45:hissatsu', 'attacker'),
        kotani: a(4, [90, 75, 95, 135, 115], '1:nabi_tempo 1:dokubari 15:mekuramashi 30:shizuku 45:tankenkan', 'jammer'),
        sasaki: a(4, [100, 120, 95, 105, 95], '1:asa_slash 1:tsubute 15:tankenkan 30:mouda 45:hissatsu', 'supporter'),
        shibata: a(4, [120, 140, 100, 70, 90], '1:shibata_driver 1:mouda 15:tosshin 30:jinarashi 45:hissatsu', 'attacker'),
        ueno: a(5, [135, 130, 125, 60, 90], '1:ueno_crush 1:tate 15:teppeki 30:tosshin 45:jinarashi', 'defender'),
        ikekimu: a(4, [95, 125, 85, 105, 90], '1:ikekimu_drive 1:mekuramashi 15:dokubari 30:mouda 45:hissatsu', 'jammer'),
        yahami: a(5, [100, 90, 95, 135, 115], '1:mirror_charm 1:shizuku 15:megumi 30:mekuramashi 45:senpu', 'healer'),
        maechokkin: a(4, [95, 130, 85, 105, 95], '1:chokkin 1:mouda 15:senpu 30:tosshin 45:hissatsu', 'attacker'),
        norahan: a(4, [95, 110, 85, 100, 100], '1:nekodamashi 1:tsubute 15:tankenkan 30:mouda 45:mekuramashi', 'supporter'),
        ishii: a(5, [125, 145, 100, 70, 85], '1:inoshishi 1:mouda 15:tosshin 30:jinarashi 45:hissatsu', 'attacker'),
        mazuda: a(4, [145, 125, 120, 65, 100], '1:bear_hug 1:tate 15:teppeki 30:jinarashi 45:tosshin', 'defender'),
        naitoon: a(4, [100, 120, 85, 110, 95], '1:night_howl 1:mekuramashi 15:mouda 30:senpu 45:hissatsu', 'jammer')
    };
    // リーダー (★5) はチームの いちばんはじめ以外のこともあるので、ここに書く (お願いマッスルは マッスルウエノーブル。2026-10-22 ユーザー指定)
    const LEADERS = { '5DX': 'okagappa', 'ASK-3': 'asahara', 'お願いマッスル': 'ueno', 'チームバータス': 'yahami', 'チーム・ケモノミチ': 'ishii' };

    // 'Lv:わざ ...' → [[Lv, わざ], ...]。振り分けは 平均が 1 になるように
    function prepare(x) {
        x.learn = x.learn.split(/\s+/).map(t => { const [lv, id] = t.split(':'); return [Number(lv), id]; });
        const mean = x.w.reduce((s, v) => s + v, 0) / x.w.length;
        x.mul = Object.fromEntries(['hp', 'atk', 'def', 'spa', 'spd'].map((k, i) => [k, x.w[i] / mean]));
        return x;
    }
    Object.values(ALLIES).forEach(prepare);
    // あとから足す (段階 9 の敵。enemies9.js)。list: { kind: [star, w, learn, role?] }
    const add = list => Object.entries(list).forEach(([kind, [star, w, learn, role]]) => { ALLIES[kind] = prepare(a(star, w, learn, role)); });

    // ----- ★ -----
    const HERO_STARS = { koori: 5, onioni: 5, yasu: 4, tamu: 4, dake: 4 };
    const star = kind => HERO_STARS[kind] || (ALLIES[kind] && ALLIES[kind].star) || null;
    const STAR_K = { 1: 0.6, 2: 0.7, 3: 0.8, 4: 0.9, 5: 1 };

    // ----- 能力: こおりくん (★5) の Lv ごとの能力を目安に、★と振り分けをかける -----
    const REF_BASE = { hp: 30, atk: 10, def: 9, spa: 10, spd: 9 };
    const REF_GROW = { hp: 4, atk: 2, def: 1.8, spa: 2, spd: 1.8 };
    const roleOf = kind => (ALLIES[kind] && ALLIES[kind].role) || (U.HEROES[kind] ? U.HEROES[kind].role || 'attacker' : U.ENEMIES[kind].role);
    const oldAllyStats = U.allyStats;
    function allyStats(kind, lv, role = roleOf(kind)) {
        const x = ALLIES[kind];
        if (!x) return oldAllyStats(kind, lv, role);
        const mod = U.ROLES[role].mod;
        const s = {};
        for (const k of Object.keys(REF_BASE)) s[k] = Math.max(1, Math.floor((REF_BASE[k] + REF_GROW[k] * (lv - 1)) * x.mul[k] * STAR_K[x.star] * (mod[k] || 1)));
        return s;
    }

    // ----- わざ -----
    const learnList = kind => (U.HEROES[kind] ? U.HEROES[kind].learn : ALLIES[kind] ? ALLIES[kind].learn : []);
    // 看板のわざ (いちばんはじめに覚える 固有わざ・敵のときのわざ)。仲間は これを忘れない
    const signature = kind => (learnList(kind)[0] || [])[1] || null;
    // 仲間になったときのわざ: 役職のわざ + 看板のわざ + Lv までに覚えたわざ (新しいものから)
    function enemyAllySkills(kind, lv = 1) {
        if (!ALLIES[kind]) return U.enemyAllySkillsOld(kind);
        const role = U.ROLES[roleOf(kind)].skill, sig = signature(kind);
        const learned = learnList(kind).filter(([l]) => l <= lv).map(([, id]) => id).filter(id => id !== role && id !== sig);
        return [role, sig, ...learned.slice(-(U.MAX_SKILLS - 2))].map(U.newSkill);
    }
    const learnedBetween = (kind, from, to) => learnList(kind).filter(([l]) => l > from && l <= to).map(([, id]) => id);

    U.enemyAllySkillsOld = U.enemyAllySkills;
    Object.assign(U, { allyStats, enemyAllySkills, learnedBetween });
    KD.Allies = { ALLIES, GENERIC, LEADERS, HERO_STARS, STAR_K, star, roleOf, learnList, signature, add };

    // ストーリーの仲間の わざを足す (役職の汎用わざ・固有わざ)
    U.HEROES.yasu.learn.push([6, 'shizuku'], [14, 'yasu_aid'], [24, 'tsubute'], [36, 'megumi']);
    U.HEROES.tamu.learn.push([6, 'shibirekona'], [14, 'tamu_trap'], [24, 'mouda'], [36, 'mekuramashi']);
    U.HEROES.dake.learn.push([6, 'tate'], [14, 'dake_buster'], [24, 'teppeki'], [36, 'jinarashi']);
    void C;
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
