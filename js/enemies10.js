// =====================================================================
// 段階 10 (2026-10-22 ユーザー指定): 新しい敵 (名前を指定されたキャラ 21 体 + 新キャラ 50 体) と ダンジョン 3 つ
// ---------------------------------------------------------------------
// ダンジョン (KD.Dungeons.EXTRA。ストーリーの順番には入らない):
//   バグだらけのコード塔 (15 階・クリア前。ネット寺を突破すると現れる) / ツモツモ横丁 (20 階・クリア後) / ハリー王国 (25 階・クリア後)
// シーシャ・ナイテイ・ナイナイ / アルアル / ナイテイ・ナナッシャ・ナディ は ダンジョンには出ない。
//   ごくまれに掲示板に出る クエスト (RARE_QUESTS) で、決まった階に待っていて、たおすと 仲間になる
// メタルキングハリー・メタルハリー: とくちょう metal (ダメージが 1〜2 しか通らない・すぐ逃げる・けいけんちが とても多い)
// 敵のデータ (U.ENEMIES)・わざ (U.SKILLS)・仲間のデータ (KD.Allies.add)・進化 (キングハリー)。絵は enemyart10.js
// 名前・見た目・強さ・置き場所は Claude の案 (名前を指定されたキャラ以外も)
// =====================================================================
(function (KD) {
    'use strict';

    const U = KD.Units, I = KD.Items, D = KD.Dungeon, DG = KD.Dungeons, A = KD.Allies;
    const f = (name, element, range, power, extra = {}) => ({ name, element, range, power, acc: 0.9, pp: 10, ...extra });

    // ----- わざ (敵のときに使い、仲間になったら 看板のわざ) -----
    Object.assign(U.SKILLS, {
        // コード塔
        bug_bite: f('バグかみつき', 'しぜん', 'front', 1.2, { status: 'confuse', chance: 0.3 }),
        null_ref: f('ぬるぽ', 'ふしぎ', 'front', 1.3, { status: 'flinch', chance: 0.4 }),
        semicolon: f('セミコロンわすれ', 'ふつう', 'line', 0.9, { status: 'para', chance: 0.4 }),
        popup_ad: f('ポップアップ広告', 'ふしぎ', 'around', 0, { acc: 0.85, status: 'blind', chance: 0.8 }),
        infinite_loop: f('むげんループ', 'ふしぎ', 'front', 0.8, { status: 'confuse', chance: 0.7 }),
        spaghetti: f('スパゲッティからみ', 'しぜん', 'front', 1.0, { status: 'bind', chance: 0.6 }),
        crawl: f('クロール', 'しぜん', 'line', 1.1),
        not_found: f('ページがみつかりません', 'ふしぎ', 'line', 1.2, { status: 'blind', chance: 0.4 }),
        compile: f('コンパイル', 'ほのお', 'front', 1.6),
        virus: f('ウイルス感染', 'ふしぎ', 'front', 0.9, { status: 'poison', chance: 0.8 }),
        firewall: f('ファイアウォール', 'ほのお', 'around', 1.1, { status: 'burn', chance: 0.3 }),
        loading: f('ぐるぐる読みこみ', 'かぜ', 'around', 0, { acc: 0.85, status: 'sleep', chance: 0.6 }),
        java_coffee: f('ジャーバコーヒー', 'ほのお', 'line', 1.2, { status: 'burn', chance: 0.3 }),
        c_pointer: f('ポインタ突き', 'ふつう', 'front', 1.5),
        cplus_plus: f('プラスプラス', 'ふつう', 'front', 1.2, { status: 'flinch', chance: 0.3 }),
        csharp_note: f('シャープ音符', 'かぜ', 'line', 1.3, { special: true }),
        triple_c: f('トリプルコンパイル', 'ほのお', 'around', 1.6, { status: 'burn', chance: 0.4 }),
        python_coil: f('パイソンしめつけ', 'しぜん', 'front', 1.1, { status: 'bind', chance: 0.6 }),
        php_echo: f('エコー連打', 'ふしぎ', 'line', 1.0, { status: 'confuse', chance: 0.3 }),
        html_tag: f('タグとじわすれ', 'ふつう', 'front', 1.0, { status: 'confuse', chance: 0.4 }),
        css_pack: f('パックンスタイル', 'しぜん', 'front', 1.5),
        dart_throw: f('ノリノリダーツ', 'かぜ', 'line', 1.4),
        // ツモツモ横丁
        haku_slam: f('ハクの一撃', 'ふつう', 'front', 1.5),
        dice_roll: f('サイコロころがし', 'ふつう', 'line', 1.3),
        riichi: f('リーチ宣言', 'ふしぎ', 'around', 0, { acc: 0.85, status: 'para', chance: 0.6 }),
        drunk_peck: f('よっぱらいつつき', 'かぜ', 'front', 1.3, { status: 'confuse', chance: 0.4 }),
        lantern_fire: f('ちょうちん火', 'ほのお', 'line', 1.2, { status: 'burn', chance: 0.3 }),
        neon_zap: f('ネオンビリビリ', 'かぜ', 'front', 1.1, { status: 'para', chance: 0.5 }),
        yatai_ramen: f('あつあつラーメン', 'ほのお', 'front', 1.5, { status: 'burn', chance: 0.3 }),
        karaoke: f('はずれたカラオケ', 'ふしぎ', 'around', 0.8, { status: 'sleep', chance: 0.3 }),
        trash_toss: f('ゴミなげ', 'ふつう', 'line', 1.0, { status: 'poison', chance: 0.4 }),
        taxi_ram: f('タクシーアタック', 'ふつう', 'front', 1.8),
        dora_bomb: f('ドラ爆', 'ほのお', 'around', 1.3),
        chip_bet: f('チップ全賭け', 'ふつう', 'front', 1.9, { acc: 0.75 }),
        neon_fake: f('ネオンばけ', 'ふしぎ', 'front', 0.9, { status: 'confuse', chance: 0.6 }),
        pachinko_ball: f('玉のシャワー', 'ふつう', 'line', 1.2),
        slot_777: f('スリーセブン', 'ふしぎ', 'around', 1.4),
        maneki: f('まねきパンチ', 'ふつう', 'front', 1.4),
        gacha: f('ガチャころり', 'ふしぎ', 'line', 1.1, { status: 'confuse', chance: 0.3 }),
        tsumo: f('ツモ！', 'ふしぎ', 'front', 1.7),
        ron: f('ロン！', 'ふしぎ', 'line', 1.6),
        honey_sting: f('はちみつばり', 'しぜん', 'front', 1.2, { status: 'bind', chance: 0.4 }),
        ume_shot: f('うめぼしだま', 'しぜん', 'line', 1.2, { status: 'weak', chance: 0.4 }),
        book_slam: f('ヨシ！ブックアタック', 'ふつう', 'front', 1.5, { status: 'flinch', chance: 0.3 }),
        love_boo: f('ラブーアタック', 'ふしぎ', 'front', 1.0, { status: 'confuse', chance: 0.6 }),
        kokushi: f('国士無双', 'ふしぎ', 'around', 2.0),
        // ハリー王国
        mini_needle: f('ちびばり', 'ふつう', 'line', 1.0),
        kuri_bomb: f('いがぐりボム', 'しぜん', 'around', 1.0),
        uni_spike: f('うにトゲ', 'みず', 'front', 1.3, { status: 'poison', chance: 0.3 }),
        cactus: f('サボテンハグ', 'しぜん', 'front', 1.3, { status: 'bind', chance: 0.4 }),
        harry_spear: f('ハリーのやり', 'ふつう', 'line', 1.3),
        harry_arrow: f('トゲの矢', 'かぜ', 'line', 1.4),
        harry_shield: f('トゲのたて', 'ふつう', 'front', 1.2, { status: 'flinch', chance: 0.4 }),
        harry_pray: { name: 'ハリーのいのり', range: 'self', pp: 6, heal: 0.4 },
        harry_cook: f('トゲトゲ料理', 'ほのお', 'front', 1.3, { status: 'burn', chance: 0.3 }),
        harry_wing: f('トゲはばたき', 'かぜ', 'around', 1.0),
        harry_lance: f('ハリーランス', 'ふつう', 'front', 1.5),   // バランス調整 1.9→1.5
        harry_magic: f('トゲトゲ魔法', 'ふしぎ', 'line', 1.4, { special: true }),
        gargo_dive: f('いしのダイブ', 'ふつう', 'front', 1.6),
        rock_needle: f('いわばり', 'しぜん', 'around', 1.2),
        minister: f('大臣のおふれ', 'ふしぎ', 'around', 0, { acc: 0.85, status: 'weak', chance: 0.8 }),
        harry_breath: f('トゲのブレス', 'ほのお', 'line', 1.6, { status: 'burn', chance: 0.3 }),
        gold_needle: f('きんのはり', 'ふつう', 'line', 1.2),
        mimic_bite: f('たからばこハリ', 'ふつう', 'front', 1.8),
        metal_tackle: f('メタルたいあたり', 'ふつう', 'front', 1.0),
        king_needle: f('キングニードル', 'ふつう', 'line', 1.8),
        metal_king: f('メタルキングの威光', 'ふしぎ', 'around', 1.2),
        emperor: f('大帝のトゲ嵐', 'ふつう', 'around', 1.5, { status: 'flinch', chance: 0.3 }),   // バランス調整 2.0→1.5
        // ナイテイの きょうだい
        naitei_judge: f('内定の審判', 'ふしぎ', 'around', 1.8, { status: 'weak', chance: 0.5 }),
        aruaru_crown: f('内定の理', 'ふしぎ', 'line', 2.2, { special: true }),
        nadi_laptop: f('オンライン面接', 'ふしぎ', 'around', 1.4, { special: true, status: 'confuse', chance: 0.4 })
    });

    // ----- 敵 -----
    const S1 = { hp: 0.65, atk: 0.5, def: 0.55, exp: 0.75 };      // コード塔 (enemies.js と同じ)
    const S2 = { hp: 0.5, atk: 0.38, def: 0.44, exp: 0.75 };      // クリア後 (2026-10-22 バランス調整: enemies9.js より 1 割ほど 小さい)
    const BOSS = { hp: 0.7, atk: 0.65, def: 0.7, exp: 1 };
    // クリア後の ボス: Lv が高いので、こうげきの倍率を 下げる (2026-10-22 バランス調整)
    const BOSS2 = { hp: 0.62, atk: 0.48, def: 0.55, exp: 1 };
    const mk = k => (no, name, element, ai, hp, atk, def, exp, role, line, more = {}) => {
        const s = more.boss ? (k === S2 ? BOSS2 : BOSS) : k;
        return { no, name, element, ai, speed: 1, role, line, traits: [], moves: [], ...more,
            hp: Math.round(hp * s.hp), atk: Math.round(atk * s.atk), def: Math.round(def * s.def), exp: Math.round(exp * s.exp) };
    };
    const e1 = mk(S1), e2 = mk(S2);
    const mv = (id, rate) => [[id, rate]];
    const ENEMIES = {
        // ===== バグだらけのコード塔 (093〜113) =====
        bugmushi: e1('093', 'バグムシ', 'しぜん', 'approach', 14, 9, 8, 15, 'jammer', 'ジジッ…エラー…', { traits: ['split'], moves: mv('bug_bite', 0.3) }),
        htmlmokkun: e1('094', 'HTMLモックン', 'ふつう', 'approach', 16, 9, 9, 15, 'defender', '<モックン>こんにちは</モックン>', { moves: mv('html_tag', 0.3) }),
        csspakkun: e1('095', 'CSSパックン', 'しぜん', 'wait', 16, 11, 9, 16, 'attacker', 'パックン！ スタイル いただき！', { moves: mv('css_pack', 0.35) }),
        nullpon: e1('096', 'ヌルポン', 'ふしぎ', 'approach', 14, 10, 7, 17, 'jammer', 'ぬるぽ', { traits: ['ghost'], moves: mv('null_ref', 0.3) }),
        semicolombo: e1('097', 'セミコロンボ', 'ふつう', 'shoot', 15, 10, 8, 16, 'jammer', 'うちのカミさんがね…；', { moves: mv('semicolon', 1) }),
        loadingu: e1('098', 'ローディン', 'かぜ', 'wait', 16, 8, 10, 16, 'jammer', 'しょうしょう おまちください…', { moves: mv('loading', 0.3) }),
        c: e1('099', 'C', 'ふつう', 'approach', 17, 12, 9, 18, 'attacker', 'すべての はじまりは わたし', { moves: mv('c_pointer', 0.3) }),
        popupn: e1('100', 'ポップアップン', 'ふしぎ', 'approach', 14, 9, 8, 16, 'supporter', 'おめでとうございます！！', { traits: ['split'], moves: mv('popup_ad', 0.3) }),
        phppp: e1('101', 'PHPPP', 'ふしぎ', 'shoot', 16, 10, 8, 18, 'jammer', 'echo "ペペペ";', { moves: mv('php_echo', 1) }),
        python: e1('102', 'パイソン', 'しぜん', 'approach', 19, 11, 10, 19, 'jammer', 'インデントは 4 マスで おねがいします', { moves: mv('python_coil', 0.35) }),
        javan: e1('103', 'ジャーバン', 'ほのお', 'shoot', 18, 11, 10, 19, 'attacker', 'コーヒー 一杯 いかがですか', { moves: mv('java_coffee', 1) }),
        cplus: e1('104', 'Cプラス', 'ふつう', 'approach', 19, 12, 10, 20, 'attacker', 'C より ちょっと プラス', { moves: mv('cplus_plus', 0.3) }),
        csharpn: e1('105', 'Cシャープン', 'かぜ', 'shoot', 18, 11, 10, 20, 'supporter', '半音 あげて いきましょう♯', { moves: mv('csharp_note', 1) }),
        darts: e1('106', 'ダーツ・ノリノリコ', 'かぜ', 'shoot', 18, 12, 9, 21, 'attacker', 'ノリノリで いくよ～！', { speed: 2, moves: mv('dart_throw', 1) }),
        mugenloop: e1('107', 'ムゲンループ', 'ふしぎ', 'approach', 20, 11, 11, 21, 'jammer', 'もういちど もういちど もういちど', { traits: ['revive'], moves: mv('infinite_loop', 0.3) }),
        spaghettin: e1('108', 'スパゲッティン', 'しぜん', 'wait', 22, 11, 12, 21, 'defender', 'どこが どこに つながってるの…', { moves: mv('spaghetti', 0.35) }),
        crawlergumo: e1('109', 'クローラーグモ', 'しぜん', 'shoot', 18, 12, 9, 21, 'supporter', 'ぜんぶ 見てまわるよ', { moves: mv('crawl', 1) }),
        notfound: e1('110', 'ノットファウンド', 'ふしぎ', 'approach', 18, 12, 9, 22, 'jammer', '404……ここには なにも ない', { traits: ['ghost'], moves: mv('not_found', 0.3) }),
        compiler: e1('111', 'コンパイラー', 'ほのお', 'approach', 22, 13, 13, 23, 'attacker', 'ビルド 成功まで あと 99%', { traits: ['charge'], moves: mv('compile', 0.3) }),
        virusn: e1('112', 'ウイルスン', 'ふしぎ', 'approach', 17, 11, 9, 22, 'jammer', 'ぞうしょく します', { traits: ['split'], moves: mv('virus', 0.35) }),
        firewall: e1('113', 'ファイアウォール', 'ほのお', 'wait', 26, 12, 16, 24, 'defender', 'ここは とおしません', { traits: ['reflect'], moves: mv('firewall', 0.3) }),
        // ===== ツモツモ横丁 (114〜137) =====
        hakupai: e2('114', 'ハクパイ', 'ふつう', 'approach', 32, 15, 14, 42, 'defender', '……（なにも 書いてない）', { moves: mv('haku_slam', 0.3) }),
        saikoron: e2('115', 'サイコロン', 'ふつう', 'shoot', 30, 15, 13, 42, 'attacker', 'ころころ～ 何が出るかな', { moves: mv('dice_roll', 1) }),
        richibou: e2('116', 'リーチボウ', 'ふしぎ', 'wait', 30, 14, 13, 42, 'jammer', 'リーチ！', { moves: mv('riichi', 0.3) }),
        yopparaigarasu: e2('117', 'ヨッパライガラス', 'かぜ', 'approach', 30, 16, 12, 44, 'attacker', 'カァ～～ もう一軒！', { traits: ['evasive'], moves: mv('drunk_peck', 0.3) }),
        chouchinbura: e2('118', 'チョウチンブラ', 'ほのお', 'shoot', 30, 15, 12, 44, 'jammer', 'ゆら～り ぶら～り', { moves: mv('lantern_fire', 1) }),
        mitsushiro: e2('119', '蜜シロー', 'しぜん', 'approach', 32, 15, 14, 46, 'healer', 'はちみつ いかが？', { traits: ['healer'], moves: mv('honey_sting', 0.3) }),
        umehayashi: e2('120', 'ウメハヤシ', 'しぜん', 'wait', 36, 15, 16, 46, 'defender', 'すっぱいのは がまん', { moves: mv('ume_shot', 0.35) }),
        neonkurage: e2('121', 'ネオンクラゲ', 'かぜ', 'approach', 30, 15, 12, 45, 'jammer', 'ピカピカ…ビリビリ', { traits: ['ghost'], moves: mv('neon_zap', 0.3) }),
        yataiman: e2('122', 'ヤタイマン', 'ほのお', 'approach', 36, 17, 14, 48, 'attacker', 'へい らっしゃい！', { moves: mv('yatai_ramen', 0.3) }),
        maikumbo: e2('123', 'マイクンボー', 'ふしぎ', 'approach', 32, 15, 13, 46, 'jammer', 'もう一曲 いきます！', { moves: mv('karaoke', 0.3) }),
        gomibakon: e2('124', 'ゴミバコン', 'ふつう', 'shoot', 34, 15, 16, 46, 'supporter', 'もえるゴミは 火曜日', { moves: mv('trash_toss', 1) }),
        yoshibook: e2('125', 'ヨシブック', 'ふつう', 'approach', 34, 17, 15, 50, 'supporter', 'ヨシ！ 読んだ！', { moves: mv('book_slam', 0.3) }),
        taxinu: e2('126', 'タクシーヌ', 'ふつう', 'approach', 34, 18, 14, 50, 'attacker', 'どちらまで？ ワン！', { traits: ['charge'], moves: mv('taxi_ram', 0.2) }),   // バランス調整: すばやい → 2 回に 1 回 強い攻撃
        ikolaboo: e2('127', 'イコラブー', 'ふしぎ', 'approach', 34, 15, 15, 50, 'jammer', 'ラブ～～♡', { moves: mv('love_boo', 0.35) }),
        dradora: e2('128', 'ドラドラ', 'ほのお', 'approach', 38, 18, 15, 52, 'attacker', 'ドラ ドラ ドラ！', { traits: ['explode'], moves: mv('dora_bomb', 0.25) }),
        chipguma: e2('129', 'チップグマ', 'ふつう', 'approach', 40, 19, 16, 54, 'attacker', '全部 賭ける！', { moves: mv('chip_bet', 0.3) }),
        neontanuki: e2('130', 'ネオンタヌキ', 'ふしぎ', 'wait', 34, 16, 14, 52, 'jammer', 'ここは いい お店ですよ～', { traits: ['disguise'], moves: mv('neon_fake', 0.35) }),
        pachinkodaman: e2('131', 'パチンコダマン', 'ふつう', 'shoot', 32, 16, 14, 52, 'attacker', 'ジャラジャラ～！', { traits: ['group'], moves: mv('pachinko_ball', 1) }),
        slotton: e2('132', 'スロットン', 'ふしぎ', 'wait', 40, 17, 16, 56, 'supporter', '7・7・7 そろえ！', { traits: ['rich'], moves: mv('slot_777', 0.3) }),
        gachapon: e2('133', 'ガチャポン', 'ふしぎ', 'flee', 30, 14, 14, 56, 'supporter', '今日は SSR かも！？', { traits: ['treasure'], moves: mv('gacha', 0.3) }),
        manekinyan: e2('134', 'マネキニャン', 'ふつう', 'wait', 38, 17, 17, 56, 'supporter', 'いらっしゃいニャン', { traits: ['rich'], moves: mv('maneki', 0.3) }),
        tsumonyan: e2('135', 'ツモニャン', 'ふしぎ', 'approach', 38, 19, 15, 60, 'attacker', 'ツモ！ ニャン！', { moves: mv('tsumo', 0.3) }),
        ronnyan: e2('136', 'ロンニャン', 'ふしぎ', 'shoot', 36, 19, 14, 60, 'attacker', 'それ ロンだニャン', { moves: mv('ron', 1) }),
        // ===== ハリー王国 (137〜157) =====
        koharry: e2('137', 'コハリー', 'ふつう', 'approach', 34, 16, 15, 50, 'attacker', 'ちびでも ハリー！', { traits: ['group'], moves: mv('mini_needle', 0.3) }),
        kuriharry: e2('138', 'クリハリー', 'しぜん', 'approach', 38, 17, 18, 52, 'defender', 'いがいが～', { traits: ['explode'], moves: mv('kuri_bomb', 0.25) }),
        uniharry: e2('139', 'ウニハリー', 'みず', 'wait', 38, 17, 19, 52, 'defender', 'うにうに', { moves: mv('uni_spike', 0.35) }),
        saboharry: e2('140', 'サボハリー', 'しぜん', 'wait', 40, 17, 18, 54, 'defender', '水は 月に 1 回で いいの', { moves: mv('cactus', 0.35) }),
        harryhei: e2('141', 'ハリーヘイ', 'ふつう', 'approach', 38, 18, 16, 54, 'attacker', '王国を まもれ！', { traits: ['group'], moves: mv('harry_spear', 0.3) }),
        harryyumi: e2('142', 'ハリーユミ', 'かぜ', 'shoot', 34, 18, 14, 54, 'attacker', 'ねらい うつ！', { moves: mv('harry_arrow', 1) }),
        harytate: e2('143', 'ハリタテ', 'ふつう', 'approach', 44, 16, 22, 56, 'defender', 'とおさないハリ！', { traits: ['shell'], moves: mv('harry_shield', 0.3) }),
        harysouryo: e2('144', 'ハリソウリョ', 'ふしぎ', 'wait', 38, 15, 17, 56, 'healer', 'トゲの かみさま…', { traits: ['healer'], moves: mv('harry_magic', 0.2) }),   // 回復は 仲間になってから (harry_pray)
        harrychef: e2('145', 'ハリーシェフ', 'ほのお', 'approach', 40, 19, 16, 58, 'supporter', '今日の まかないは トゲ料理', { moves: mv('harry_cook', 0.3) }),
        harrybird: e2('146', 'ハリーバード', 'かぜ', 'approach', 36, 18, 15, 58, 'attacker', 'トゲの つばさ！', { traits: ['evasive'], moves: mv('harry_wing', 0.25) }),   // バランス調整: すばやい をなくした
        harryknight: e2('147', 'ハリーナイト', 'ふつう', 'approach', 44, 19, 19, 62, 'attacker', '騎士の ほこりに かけて！', { moves: mv('harry_lance', 0.3) }),
        harrymage: e2('148', 'ハリーメイジ', 'ふしぎ', 'shoot', 38, 20, 15, 62, 'jammer', 'トゲトゲの 呪文！', { moves: mv('harry_magic', 1) }),
        gargoharry: e2('149', 'ガーゴハリー', 'ふつう', 'wait', 46, 20, 22, 64, 'defender', '……（いしの ふり）', { traits: ['disguise'], moves: mv('gargo_dive', 0.35) }),
        iwaharry: e2('150', 'イワハリー', 'しぜん', 'approach', 50, 21, 24, 64, 'defender', 'ゴロゴロ…ハリ', { traits: ['slow'], moves: mv('rock_needle', 0.3) }),
        haridaijin: e2('151', 'ハリダイジン', 'ふしぎ', 'wait', 42, 18, 18, 66, 'supporter', '大帝さまの おなりである', { traits: ['summon'], summon: 'harryhei', moves: mv('minister', 0.3) }),
        haridora: e2('152', 'ハリドラ', 'ほのお', 'shoot', 50, 22, 20, 70, 'attacker', 'トゲの ドラゴンだハリ！', { moves: mv('harry_breath', 1) }),
        goldharry: e2('153', 'ゴールドハリー', 'ふつう', 'flee', 36, 16, 18, 70, 'supporter', 'きんぴか ハリ！', { traits: ['rich'], moves: mv('gold_needle', 0.3) }),
        harrymimic: e2('154', 'ハリーミミック', 'ふつう', 'wait', 48, 22, 20, 72, 'defender', 'あけたハリ？', { traits: ['mimic'], moves: mv('mimic_bite', 0.35) }),
        metalharry: e2('155', 'メタルハリー', 'ふつう', 'flee', 8, 14, 60, 420, 'defender', 'キーン', { speed: 2, traits: ['metal', 'evasive'], moves: mv('metal_tackle', 0.2) }),
        kingharry: e2('156', 'キングハリー', 'ふつう', 'approach', 54, 23, 21, 90, 'attacker', '余が キングハリーである！', { traits: ['summon'], summon: 'koharry', moves: mv('king_needle', 0.3) }),
        metalkingharry: e2('157', 'メタルキングハリー', 'ふつう', 'flee', 16, 18, 80, 1600, 'defender', 'キィィィン……', { speed: 2, traits: ['metal', 'evasive'], moves: mv('metal_king', 0.2) }),
        // ===== ボス =====
        triplec: e1('', 'トリプルC', 'ほのお', 'approach', 80, 13, 13, 260, 'attacker', 'C・C++・C#……すべてを 統べる者！', { boss: true, big: true, traits: ['summon', 'berserk'], summon: 'c', moves: [['triple_c', 0.3], ['c_pointer', 0.3]] }),
        kokushinyan: e2('', '国士無双ニャン', 'ふしぎ', 'approach', 160, 17, 17, 900, 'attacker', '十三面待ちだニャ……', { boss: true, big: true, traits: ['summon', 'berserk'], summon: 'tsumonyan', moves: [['kokushi', 0.25], ['ron', 0.3]] }),
        harryemperor: e2('', 'ハリー大帝', 'ふつう', 'approach', 190, 19, 20, 1400, 'attacker', '余の 王国へ ようこそ。そして さらばだ！', { boss: true, big: true, traits: ['summon', 'berserk'], summon: 'harryknight', moves: [['emperor', 0.3], ['king_needle', 0.3]] }),
        // ===== ナイテイの きょうだい (クエストで 待っている。たおすと 仲間になる) =====
        naitei: e2('', 'シーシャ・ナイテイ・ナイナイ', 'ふしぎ', 'approach', 70, 20, 18, 500, 'attacker', 'お前に内定はない！', { big: true, moves: [['naitei_judge', 0.3]] }),
        aruaru: e2('', 'シーシャ・ナイテイ・アルアル', 'ふしぎ', 'approach', 80, 21, 19, 600, 'supporter', '内定の理を 見せてやろう', { big: true, moves: [['aruaru_crown', 0.3]] }),
        nadi: e2('', 'ナイテイ・ナナッシャ・ナディ', 'ふしぎ', 'approach', 64, 19, 16, 500, 'healer', 'オンライン面接、はじめます', { big: true, moves: [['nadi_laptop', 0.3]] })
    };
    Object.assign(U.ENEMIES, ENEMIES);
    Object.values(ENEMIES).forEach(d => {
        if (d.element === 'みず' && !d.traits.includes('swim') && d.ai !== 'wait') d.traits.push('swim');
        if (d.element === 'ほのお' && !d.traits.includes('lava')) d.traits.push('lava');
        if (d.element === 'こおり') d.immune = [...(d.immune || []), 'freeze'];
    });
    // 敵が落とす素材 (ダンジョンの素材を順に)
    const mats = Object.values(DG.MATERIALS).flat();
    Object.keys(ENEMIES).forEach((kind, i) => { if (!ENEMIES[kind].boss && !I.DROPS[kind]) I.DROPS[kind] = mats[i % mats.length]; });

    // ----- 仲間になったとき: [★, 振り分け [HP, こうげき, ぼうぎょ, とくこう, とくぼう], 覚えるわざ, 役職] -----
    A.add({
        bugmushi: [2, [85, 95, 80, 110, 95], '1:bug_bite 10:dokubari 20:shibirekona 32:mekuramashi 45:shizuku'],
        htmlmokkun: [2, [115, 90, 120, 85, 105], '1:html_tag 10:tate 20:teppeki 32:jinarashi 45:shizuku'],
        csspakkun: [3, [100, 125, 95, 95, 85], '1:css_pack 10:mouda 20:tosshin 32:senpu 45:hissatsu'],
        nullpon: [3, [90, 100, 80, 125, 105], '1:null_ref 10:mekuramashi 20:dokubari 32:tsubute 45:senpu'],
        semicolombo: [3, [95, 95, 90, 115, 105], '1:semicolon 10:tsubute 20:shibirekona 32:tankenkan 45:mekuramashi'],
        loadingu: [3, [105, 80, 110, 110, 115], '1:loading 10:shizuku 20:mekuramashi 32:teppeki 45:megumi'],
        c: [4, [100, 130, 100, 100, 90], '1:c_pointer 12:mouda 25:tosshin 38:senpu 50:hissatsu'],
        popupn: [2, [85, 85, 85, 115, 100], '1:popup_ad 10:tsubute 20:tankenkan 32:dokubari 45:shizuku'],
        phppp: [3, [90, 85, 85, 130, 110], '1:php_echo 10:mekuramashi 20:tsubute 32:shibirekona 45:senpu'],
        python: [4, [115, 105, 105, 115, 100], '1:python_coil 12:shibirekona 25:dokubari 38:shizuku 50:megumi'],
        javan: [4, [105, 115, 100, 120, 95], '1:java_coffee 12:mouda 25:senpu 38:tsubute 50:hissatsu'],
        cplus: [4, [110, 130, 105, 95, 90], '1:cplus_plus 12:mouda 25:tosshin 38:senpu 50:hissatsu'],
        csharpn: [4, [100, 100, 95, 130, 105], '1:csharp_note 12:tankenkan 25:shizuku 38:senpu 50:megumi'],
        darts: [4, [95, 130, 85, 110, 90], '1:dart_throw 12:tsubute 25:mouda 38:senpu 50:hissatsu'],
        mugenloop: [3, [110, 95, 105, 115, 105], '1:infinite_loop 10:mekuramashi 20:teppeki 32:shibirekona 45:shizuku'],
        spaghettin: [3, [125, 100, 120, 85, 100], '1:spaghetti 10:tate 20:teppeki 32:jinarashi 45:tosshin'],
        crawlergumo: [3, [95, 110, 90, 105, 100], '1:crawl 10:tankenkan 20:tsubute 32:dokubari 45:mouda'],
        notfound: [3, [95, 110, 85, 120, 100], '1:not_found 10:mekuramashi 20:senpu 32:dokubari 45:hissatsu'],
        compiler: [4, [115, 130, 110, 100, 85], '1:compile 12:mouda 25:tosshin 38:jinarashi 50:hissatsu'],
        virusn: [3, [90, 95, 85, 125, 105], '1:virus 10:dokubari 20:mekuramashi 32:shibirekona 45:senpu'],
        firewall: [4, [125, 100, 140, 95, 120], '1:firewall 12:teppeki 25:tate 38:jinarashi 50:megumi'],
        hakupai: [3, [125, 105, 125, 80, 105], '1:haku_slam 40:tate 55:teppeki 70:jinarashi 85:tosshin'],
        saikoron: [3, [100, 120, 100, 100, 95], '1:dice_roll 40:tsubute 55:mouda 70:senpu 85:hissatsu'],
        richibou: [3, [100, 90, 105, 120, 115], '1:riichi 40:shibirekona 55:mekuramashi 70:dokubari 85:shizuku'],
        yopparaigarasu: [3, [100, 125, 90, 95, 95], '1:drunk_peck 40:mouda 55:senpu 70:tosshin 85:hissatsu'],
        chouchinbura: [3, [95, 95, 90, 130, 105], '1:lantern_fire 40:mekuramashi 55:tsubute 70:senpu 85:shibirekona'],
        mitsushiro: [4, [110, 110, 100, 110, 115], '1:honey_sting 40:shizuku 55:mouda 70:megumi 85:senpu'],
        umehayashi: [4, [130, 100, 125, 95, 115], '1:ume_shot 40:teppeki 55:tate 70:shizuku 85:jinarashi'],
        neonkurage: [3, [95, 100, 90, 120, 110], '1:neon_zap 40:shibirekona 55:mekuramashi 70:dokubari 85:senpu'],
        yataiman: [4, [115, 130, 105, 100, 90], '1:yatai_ramen 40:mouda 55:shizuku 70:tosshin 85:hissatsu'],
        maikumbo: [3, [100, 95, 95, 125, 110], '1:karaoke 40:mekuramashi 55:shibirekona 70:shizuku 85:senpu'],
        gomibakon: [3, [115, 100, 125, 95, 105], '1:trash_toss 40:tankenkan 55:tate 70:dokubari 85:teppeki'],
        yoshibook: [4, [105, 120, 105, 115, 100], '1:book_slam 40:tankenkan 55:mouda 70:tsubute 85:megumi'],
        taxinu: [4, [105, 135, 95, 90, 90], '1:taxi_ram 40:mouda 55:tosshin 70:senpu 85:hissatsu'],
        ikolaboo: [4, [110, 95, 105, 120, 115], '1:love_boo 40:mekuramashi 55:shizuku 70:shibirekona 85:megumi'],
        dradora: [4, [115, 125, 100, 120, 85], '1:dora_bomb 40:mouda 55:senpu 70:tosshin 85:hissatsu'],
        chipguma: [4, [125, 140, 110, 75, 90], '1:chip_bet 40:mouda 55:tosshin 70:jinarashi 85:hissatsu'],
        neontanuki: [3, [100, 100, 95, 120, 105], '1:neon_fake 40:mekuramashi 55:dokubari 70:tankenkan 85:shibirekona'],
        pachinkodaman: [3, [100, 120, 100, 100, 95], '1:pachinko_ball 40:tsubute 55:mouda 70:senpu 85:hissatsu'],
        slotton: [4, [110, 100, 110, 115, 110], '1:slot_777 40:tankenkan 55:tsubute 70:shizuku 85:senpu'],
        gachapon: [4, [95, 95, 100, 115, 120], '1:gacha 40:tankenkan 55:shizuku 70:mekuramashi 85:megumi'],
        manekinyan: [4, [115, 115, 115, 105, 110], '1:maneki 40:tankenkan 55:mouda 70:tate 85:megumi'],
        tsumonyan: [5, [105, 135, 100, 115, 95], '1:tsumo 40:mouda 55:senpu 70:tosshin 85:hissatsu'],
        ronnyan: [5, [100, 115, 95, 135, 105], '1:ron 40:tsubute 55:mekuramashi 70:senpu 85:hissatsu'],
        koharry: [3, [95, 120, 95, 95, 90], '1:mini_needle 45:mouda 60:tosshin 75:senpu 90:hissatsu'],
        kuriharry: [3, [120, 110, 125, 90, 100], '1:kuri_bomb 45:tate 60:teppeki 75:jinarashi 90:tosshin'],
        uniharry: [3, [120, 105, 130, 95, 110], '1:uni_spike 45:teppeki 60:dokubari 75:tate 90:jinarashi'],
        saboharry: [3, [125, 105, 125, 90, 110], '1:cactus 45:teppeki 60:shibirekona 75:jinarashi 90:shizuku'],
        harryhei: [3, [110, 125, 105, 85, 95], '1:harry_spear 45:mouda 60:tate 75:senpu 90:hissatsu'],
        harryyumi: [4, [95, 130, 90, 105, 95], '1:harry_arrow 45:tsubute 60:mouda 75:senpu 90:hissatsu'],
        harytate: [4, [130, 100, 145, 80, 115], '1:harry_shield 45:teppeki 60:tate 75:jinarashi 90:megumi'],
        harysouryo: [4, [110, 95, 105, 120, 125], '1:harry_pray 45:shizuku 60:megumi 75:mekuramashi 90:senpu'],
        harrychef: [4, [115, 120, 105, 105, 100], '1:harry_cook 45:shizuku 60:tankenkan 75:mouda 90:megumi'],
        harrybird: [4, [100, 125, 90, 105, 95], '1:harry_wing 45:mouda 60:senpu 75:tosshin 90:hissatsu'],
        harryknight: [5, [120, 140, 120, 85, 100], '1:harry_lance 45:mouda 60:tosshin 75:tate 90:hissatsu'],
        harrymage: [5, [100, 90, 95, 145, 115], '1:harry_magic 45:mekuramashi 60:shibirekona 75:senpu 90:megumi'],
        gargoharry: [4, [125, 120, 135, 85, 105], '1:gargo_dive 45:teppeki 60:tosshin 75:jinarashi 90:hissatsu'],
        iwaharry: [4, [145, 125, 140, 70, 100], '1:rock_needle 45:teppeki 60:jinarashi 75:tosshin 90:hissatsu'],
        haridaijin: [4, [110, 95, 110, 125, 120], '1:minister 45:tankenkan 60:shizuku 75:mekuramashi 90:megumi'],
        haridora: [5, [125, 125, 115, 135, 105], '1:harry_breath 45:mouda 60:senpu 75:tosshin 90:hissatsu'],
        goldharry: [4, [100, 110, 115, 110, 115], '1:gold_needle 45:tankenkan 60:tsubute 75:shizuku 90:megumi'],
        harrymimic: [4, [125, 130, 130, 80, 105], '1:mimic_bite 45:teppeki 60:tosshin 75:jinarashi 90:hissatsu'],
        metalharry: [4, [60, 110, 170, 90, 150], '1:metal_tackle 45:teppeki 60:tate 75:tosshin 90:jinarashi'],
        kingharry: [5, [125, 140, 120, 100, 105], '1:king_needle 45:mouda 60:senpu 75:tosshin 90:hissatsu'],
        metalkingharry: [5, [70, 125, 175, 100, 160], '1:metal_king 45:teppeki 60:tosshin 75:jinarashi 90:hissatsu'],
        // ナイテイの きょうだい (クエストで 仲間になる。★5)
        naitei: [5, [115, 130, 115, 130, 115], '1:naitei_judge 1:mouda 40:senpu 60:megumi 80:hissatsu', 'attacker'],
        aruaru: [5, [115, 115, 115, 145, 120], '1:aruaru_crown 1:tankenkan 40:mekuramashi 60:megumi 80:senpu', 'supporter'],
        nadi: [5, [105, 100, 105, 140, 130], '1:nadi_laptop 1:shizuku 40:megumi 60:mekuramashi 80:senpu', 'healer']
    });
    // 進化: ハリジェネラル → キングハリー (Lv55)
    A.EVOLVE.harigeneral = { to: 'kingharry', how: 'level', lv: 55 };

    // ----- ダンジョン 3 つ -----
    const ex = (o) => ({ items: I.FOREST_ITEMS, trapKinds: I.FOREST_TRAPS, extra: true, ...o });
    const EXTRA = [
        ex({
            id: 'code', name: 'バグだらけのコード塔', floors: 15, lv: 12, lvStep: 0.45, theme: 'code', boss: 'triplec', bgm: 'deep',
            opens: town => (town.cleared || 0) >= 3, openText: 'ネット寺を 突破すると 現れる',
            enemies: ['bugmushi', 'htmlmokkun', 'popupn', 'csspakkun', 'nullpon', 'semicolombo', 'loadingu', 'c', 'phppp', 'virusn', 'python', 'javan',
                'crawlergumo', 'cplus', 'csharpn', 'notfound', 'darts', 'mugenloop', 'spaghettin', 'compiler', 'firewall'],
            traps: [5, 8], money: 2,
            story: {
                intro: ['ふるカワ「ネット寺の となりに、コードで できた塔が 生えてきたって！ 中は バグだらけらしいよ」'],
                boss: ['トリプルC「C・C++・C#……すべての 力を 統べる者、トリプルC！ バグごと 消えるがいい！」', { koori: 'こおりくん「バグは 直すものだよ！」', onioni: 'おにおに「バグ？まぁ叩けば治るだろ」' }],
                clear: ['トリプルC「……コンパイル エラー……」', 'ふるカワ「すごい！ 塔の バグが 直っていくよ！」', 'バグだらけのコード塔を 突破した！']
            }
        }),
        ex({
            id: 'alley', name: 'ツモツモ横丁', floors: 20, lv: 34, lvStep: 0.3, theme: 'alley', boss: 'kokushinyan', bgm: 'cave',
            opens: town => Boolean(town.storyEnd), openText: 'ストーリーを クリアすると 現れる',
            enemies: ['hakupai', 'saikoron', 'richibou', 'yopparaigarasu', 'chouchinbura', 'mitsushiro', 'umehayashi', 'neonkurage', 'yataiman', 'maikumbo', 'gomibakon',
                'yoshibook', 'taxinu', 'ikolaboo', 'neontanuki', 'pachinkodaman', 'dradora', 'chipguma', 'slotton', 'manekinyan', 'tsumonyan', 'ronnyan'],
            rare: ['gachapon'], rareRate: 0.05, traps: [4, 6], money: 4,
            story: {
                intro: ['ふるカワ「町の 夜の はずれに、ずっと 夜の 横丁が 現れたって。ネコの 雀士が いっぱい いるらしいよ」'],
                boss: ['国士無双ニャン「十三面待ちだニャ……おまえの 運も ここまでだニャ！」', { koori: 'こおりくん「運より 実力！３万６千円の力ちゃむ！」', onioni: 'おにおに「運で俺に勝負をいどむか。望むところだ！」' }],
                clear: ['国士無双ニャン「……チョンボだニャ～」', 'ふるカワ「横丁に 朝が 来たよ！」', 'ツモツモ横丁を 突破した！']
            }
        }),
        ex({
            id: 'kingdom', name: 'ハリー王国', floors: 25, lv: 40, lvStep: 0.3, theme: 'kingdom', boss: 'harryemperor', bgm: 'forest',
            opens: town => Boolean(town.storyEnd), openText: 'ストーリーを クリアすると 現れる',
            enemies: ['koharry', 'kuriharry', 'harryhei', 'uniharry', 'saboharry', 'harryyumi', 'harytate', 'harysouryo', 'harrychef', 'harrybird', 'goldharry',
                'harryknight', 'harrymage', 'gargoharry', 'iwaharry', 'haridaijin', 'harrymimic', 'haridora', 'kingharry'],
            rare: ['metalharry', 'metalkingharry', 'metalharry'], rareRate: 0.06, traps: [3, 5], money: 5,
            story: {
                intro: ['ハリー「ハリー！メンテイー！（なんかハリーの王国出来てた）」', 'ふるカワ「25 階も あるんだって！ メタルの ハリーも いるらしいよ」'],
                boss: ['ハリー大帝「余の 王国へ ようこそ。そして さらばだ！」', 'こおりくん「ハリーたちの ためにも 負けないよ！」'],
                clear: ['ハリー大帝「……見事だ。余の トゲも まだまだ だな」', 'ハリー「ハリー！（大帝とかｗう、うおｗ）」', 'ハリー王国を 突破した！']
            }
        })
    ];
    EXTRA.forEach(d => { if (!DG.MATERIALS[d.id]) DG.MATERIALS[d.id] = d.id === 'code' ? ['broken_cable', 'iron_kunai'] : d.id === 'alley' ? ['lucky_coin', 'star_piece'] : ['soft_needle', 'gold_band']; });

    // ----- ナイテイの きょうだいの クエスト (ごくまれに 掲示板に出る。たおすと 仲間になる) -----
    //   rate: 1 日に 掲示板に出る確率 (案) / dungeon・floor: 待っている場所 (そのダンジョンに 行けるときだけ出る)
    const RARE_QUESTS = {
        naitei: { rate: 0.04, dungeon: 'moon', floor: 14, money: 12000, text: '？？？「内定が ほしければ、月の迷宮の B14F まで 来るがいい」（シーシャ・ナイテイ・ナイナイ）' },
        aruaru: { rate: 0.03, dungeon: 'aso', floor: 24, money: 15000, text: '？？？「内定の理を 知りたくば、ASOの壺の底の B24F へ」（シーシャ・ナイテイ・アルアル）' },
        nadi: { rate: 0.04, dungeon: 'code', floor: 15, money: 12000, text: '？？？「オンライン面接の ご案内です。コード塔の B15F に ログインしてください」（ナイテイ・ナナッシャ・ナディ）' }
    };

    Object.assign(DG, { EXTRA, RARE_QUESTS });
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
