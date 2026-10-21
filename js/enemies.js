// =====================================================================
// ダンジョン 2〜7 の敵・どこにでも出る敵・強敵・ボス・ストーリーの仲間 (敵キャラ表・仕様書 6.3・8章・11章・12章)
// ---------------------------------------------------------------------
// units.js の表 (ENEMIES・SKILLS・STATUS・HEROES) に足す。ハリーの森の敵は units.js にある。
// 能力は Lv1 のときの値で、ダンジョンの深さで Lv が上がって強くなる (units.js の enemyStats)。
//
// traits (とくちょう。game.js が見る):
//   ghost 壁の中を通れる / swim 水の上を歩ける / lava 溶岩でダメージを受けない / shell ダメージを受けると甲羅にこもる
//   rage 攻撃されると こうげきが上がる / berserk HP が半分を切ると強くなる / split 攻撃されると分裂する
//   disguise 近くに来るまで道具に化けている / mimic 宝箱に化けている (たおすと良い道具) / caltrops 歩いたあとに まきびし
//   explode HP が少なくなると爆発 / healer 仲間の敵を回復 / evasive 攻撃が当たりにくい / frenzy 階に着いてしばらくすると凶暴に
//   revive 1 回だけ復活 / slow 2 ターンに 1 回しか動かない / charge 2 回に 1 回 強い攻撃 / reflect わざをはね返すことがある
//   summon 仲間を呼ぶ / group 何体かまとまって出る / stealMoney お金を取って逃げる / malfunction ときどき故障して止まる
//   rich たおすと たくさんのお金 / warp 攻撃されると どこかへ飛ぶ
// moves: [[わざ, 使う確率]] (撃つ敵の直線のわざは、届けば必ず使う)
// =====================================================================
(function (KD) {
    'use strict';

    const U = KD.Units;

    // ----- 状態異常を足す -----
    Object.assign(U.STATUS, {
        blind: { name: '目つぶし', turns: [6, 9], color: '#c8c8c8', mark: '--' },     // 攻撃が当たりにくい
        freeze: { name: 'こおり', turns: [2, 4], color: '#bff0ff', mark: '**' },       // 動けない。こおり属性はかからない
        burn: { name: 'やけど', turns: [5, 8], color: '#ff8a4a', mark: 'ﾔｹﾄﾞ' },        // 毎ターン少しダメージ・こうげきが下がる
        weak: { name: 'よわき', turns: [6, 9], color: '#a8a8ff', mark: 'v' }           // こうげきが下がる
    });

    // ----- わざを足す -----
    const f = (name, element, range, power, extra = {}) => ({ name, element, range, power, acc: 0.9, pp: 15, ...extra });
    Object.assign(U.SKILLS, {
        // ストーリーの仲間 (前作の必殺技。仕様書 7章)
        yasu_punch: f('やすパンチ', 'ふつう', 'front', 1.4, { pp: 20 }),
        tamu_kick: f('たむキック', 'ふつう', 'front', 1.3, { pp: 20, status: 'flinch', chance: 0.3 }),
        dake_chop: f('だけチョップ', 'ふつう', 'front', 1.5, { pp: 20, status: 'flinch', chance: 0.2 }),
        // 浦の島の海岸どうくつ
        kemuri: f('けむり', 'みず', 'front', 0.6, { status: 'blind', chance: 0.8 }),
        tsuribari: f('つりばり', 'みず', 'line', 0.8, { status: 'bind', chance: 0.5 }),
        wasure: f('わすれ針', 'ふしぎ', 'front', 0.8, { status: 'confuse', chance: 0.5 }),
        odori: f('乙姫の舞', 'みず', 'front', 0, { acc: 0.8, status: 'confuse', chance: 1 }),
        suikomi: f('すいこみ', 'しぜん', 'front', 1.3),
        // ネット寺
        okyou: f('配信のお経', 'ふしぎ', 'line', 0.5, { status: 'sleep', chance: 0.4 }),
        enjou: f('炎上', 'ほのお', 'front', 1.2, { status: 'burn', chance: 0.4 }),
        pokupoku: f('ポクポク', 'ふつう', 'around', 0, { acc: 0.8, status: 'confuse', chance: 0.7 }),
        buratsu: f('ブツン', 'ふしぎ', 'line', 0.8, { status: 'blind', chance: 0.5 }),
        hinotama: f('火の玉', 'ほのお', 'line', 1.0, { status: 'burn', chance: 0.3 }),
        // 忍びの屋敷
        kunai: f('クナイ', 'かぜ', 'line', 1.0),
        doron: f('ドロン', 'ふしぎ', 'front', 0.8, { status: 'confuse', chance: 0.4 }),
        kaiten: f('回転突進', 'かぜ', 'front', 1.6),
        tobidashi: f('とびだし', 'みず', 'front', 1.5),
        // 月の迷宮
        kira: f('キラッ☆', 'ふしぎ', 'line', 0.6, { status: 'blind', chance: 0.7 }),
        yukidama: f('雪玉', 'こおり', 'front', 1.1, { status: 'freeze', chance: 0.4 }),
        // 筋肉の山
        ase: f('汗とばし', 'みず', 'line', 0.9),
        magma: f('マグマパンチ', 'ほのお', 'front', 1.3, { status: 'burn', chance: 0.5 }),
        kori_punch: f('ひえひえパンチ', 'こおり', 'front', 1.3, { status: 'freeze', chance: 0.2 }),
        // ASOの壺の底
        fusaiyou: f('不採用通知', 'ふしぎ', 'line', 0.7, { status: 'weak', chance: 0.6 }),
        mizu_breath: f('水のブレス', 'みず', 'line', 1.4),
        beam: f('ビーム', 'ふつう', 'line', 1.2),
        // どこにでも
        kin: f('ばい菌', 'ふしぎ', 'front', 0.5, { status: 'colitis', chance: 0.6 }),
        // ボス
        hari_needle: f('針とばし', 'ふつう', 'line', 1.2),
        koura: { name: '甲羅にこもる', range: 'self', pp: 5, buff: 'guard', turns: 4 },
        tamatebako: f('玉手箱', 'ふしぎ', 'around', 0.8, { status: 'blind', chance: 0.7 }),
        seppou: f('説法', 'ふしぎ', 'around', 0.6, { status: 'sleep', chance: 0.4 }),
        shakujou: f('錫杖', 'ふつう', 'front', 1.6),
        kunai_rain: f('クナイ乱れうち', 'かぜ', 'line', 1.3),
        shinobi_kiri: f('忍び斬り', 'かぜ', 'front', 1.8, { status: 'flinch', chance: 0.3 }),
        moon_beam: f('月のビーム', 'ふしぎ', 'line', 1.6),
        moon_spell: f('三日月の魔法', 'ふしぎ', 'around', 1.0, { status: 'confuse', chance: 0.3 }),
        katana: f('刀の一振り', 'ふつう', 'around', 1.6),
        kabuto_wari: f('兜割り', 'ふつう', 'front', 2.2),
        funka: f('噴火', 'ほのお', 'around', 1.4, { status: 'burn', chance: 0.4 }),
        lava_beam: f('溶岩ビーム', 'ほのお', 'line', 1.8)
    });

    // ----- ストーリーの仲間 (仕様書 6.3・8章。主人公にはえらべない) -----
    Object.assign(U.HEROES, {
        yasu: {
            id: 'yasu', name: 'やすさん', element: 'ふつう', role: 'healer', type: 'ヒーラー', ally: true,
            base: { hp: 32, atk: 9, def: 9, spa: 10, spd: 11 }, grow: { hp: 4.2, atk: 1.7, def: 1.8, spa: 2, spd: 2.2 },
            learn: [[1, 'yasu_punch']]
        },
        tamu: {
            id: 'tamu', name: 'たむさん', element: 'ふつう', role: 'jammer', type: 'ジャマー', ally: true,
            base: { hp: 30, atk: 10, def: 8, spa: 11, spd: 9 }, grow: { hp: 3.8, atk: 2, def: 1.6, spa: 2.2, spd: 1.8 },
            learn: [[1, 'tamu_kick']]
        },
        dake: {
            id: 'dake', name: 'だけさん', element: 'ふつう', role: 'defender', type: 'ディフェンダー', ally: true,
            base: { hp: 40, atk: 11, def: 12, spa: 6, spd: 9 }, grow: { hp: 5.2, atk: 2.1, def: 2.4, spa: 1.1, spd: 1.8 },
            learn: [[1, 'dake_chop']]
        }
    });
    // 仲間の役職 (こおりくん・おにおには仲間のとき アタッカー)
    U.HEROES.koori.role = U.HEROES.koori.role || 'attacker';
    U.HEROES.onioni.role = U.HEROES.onioni.role || 'attacker';

    // ----- 敵 (敵キャラ表 008〜052) -----
    // 主人公と敵は Lv でだいたい同じ割合で強くなるので、Lv1 の能力は 森の敵に近づける (下の表の数 × SCALE)。
    // 深いダンジョンの強さは、敵の Lv (dungeons.js) と とくちょうで出す
    const SCALE = { hp: 0.65, atk: 0.5, def: 0.55, exp: 0.75 };
    const BOSS_SCALE = { hp: 0.7, atk: 0.65, def: 0.7, exp: 1 };
    const e = (no, name, element, ai, hp, atk, def, exp, role, line, more = {}) => {
        const k = more.boss ? BOSS_SCALE : SCALE;
        return {
            no, name, element, ai, speed: 1, role, line, ...more,
            hp: Math.round(hp * k.hp), atk: Math.round(atk * k.atk), def: Math.round(def * k.def), exp: Math.round(exp * k.exp)
        };
    };
    Object.assign(U.ENEMIES, {
        // 2. 浦の島の海岸どうくつ
        kogame: e('008', 'コガメ', 'みず', 'approach', 14, 7, 10, 10, 'defender', '…（こもる）', { traits: ['swim', 'shell'] }),
        tamatebakogani: e('009', 'タマテバコガニ', 'みず', 'approach', 13, 8, 8, 11, 'jammer', 'ケムッ！', { traits: ['swim'], moves: [['kemuri', 0.35]] }),
        tsuribariuo: e('010', 'ツリバリウオ', 'みず', 'shoot', 12, 8, 6, 11, 'jammer', 'つれた～！', { traits: ['swim'], moves: [['tsuribari', 1]] }),
        wasurekurage: e('011', 'ワスレクラゲ', 'ふしぎ', 'approach', 13, 8, 6, 13, 'jammer', 'なんだっけ…', { traits: ['ghost'], moves: [['wasure', 0.35]] }),
        otohimedai: e('012', 'オトヒメダイ', 'みず', 'approach', 16, 9, 8, 14, 'supporter', '踊りましょ♪', { traits: ['swim'], moves: [['odori', 0.3]] }),
        isoginchakku: e('013', 'イソギンチャック', 'しぜん', 'wait', 18, 10, 9, 13, 'defender', 'ジジジ…', { moves: [['suikomi', 0.4]] }),
        umibozun: e('014', 'ウミボウズン', 'ふしぎ', 'approach', 18, 11, 8, 15, 'attacker', 'ぼうず～ん', { traits: ['ghost', 'swim'] }),
        // 3. ネット寺
        netkozou: e('015', 'ネットコゾウ', 'ふしぎ', 'shoot', 14, 9, 8, 13, 'jammer', 'ご視聴ありがとうございます', { moves: [['okyou', 1]] }),
        enjoubouzu: e('016', 'エンジョウボウズ', 'ほのお', 'approach', 18, 10, 9, 15, 'attacker', '炎上上等！', { traits: ['rage', 'lava'], moves: [['enjou', 0.3]] }),
        mokugyoro: e('017', 'モクギョロ', 'ふつう', 'wait', 17, 9, 12, 14, 'jammer', 'ポクポクポク…', { moves: [['pokupoku', 0.4]] }),
        hannyamen: e('018', 'ハンニャメン', 'ふしぎ', 'approach', 20, 11, 9, 17, 'attacker', '仏の顔も三度まで', { traits: ['berserk'] }),
        spamdama: e('019', 'スパムダマ', 'ふしぎ', 'approach', 11, 8, 6, 9, 'supporter', 'おめでとうございます！当選しました！', { traits: ['split'] }),
        burakrasher: e('020', 'ブラクラッシャー', 'ふしぎ', 'shoot', 16, 10, 8, 15, 'jammer', 'ブツン', { moves: [['buratsu', 1]] }),
        rousokubi: e('021', 'ロウソクビ', 'ほのお', 'shoot', 14, 10, 7, 14, 'attacker', 'ゆら～り', { traits: ['lava'], moves: [['hinotama', 1]] }),
        // 4. 忍びの屋敷 (敵がすばやい)
        geninman: e('022', 'ゲニンマン', 'ふつう', 'approach', 18, 11, 9, 17, 'attacker', 'あ、まだいたんですね～'),
        kunaisuzume: e('023', 'クナイスズメ', 'かぜ', 'shoot', 14, 10, 8, 17, 'attacker', 'チュンッ！', { speed: 2, moves: [['kunai', 1]] }),
        kawarimidanuki: e('024', 'カワリミダヌキ', 'ふしぎ', 'wait', 18, 11, 9, 18, 'jammer', 'ドロン！', { traits: ['disguise'], moves: [['doron', 0.35]] }),
        makibishimushi: e('025', 'マキビシムシ', 'ふつう', 'flee', 16, 10, 13, 17, 'supporter', 'チクチク', { traits: ['caltrops'] }),
        shurikenbo: e('026', 'シュリケンボー', 'かぜ', 'approach', 20, 12, 9, 20, 'attacker', 'シュルルル！', { speed: 2, moves: [['kaiten', 0.3]] }),
        shinobigaeru: e('027', 'シノビガエル', 'みず', 'wait', 20, 12, 9, 18, 'attacker', 'ゲロッと参上', { traits: ['swim'], moves: [['tobidashi', 0.4]] }),
        bakudanjirou: e('028', 'バクダンジロウ', 'ほのお', 'approach', 22, 11, 9, 20, 'attacker', 'あとはまかせた～！', { traits: ['explode', 'lava'] }),
        // 5. 月の迷宮 (階の形が変わる)
        tsukiusagi: e('029', 'ツキウサギ', 'ふしぎ', 'wait', 20, 10, 11, 20, 'healer', 'ぺったん！', { traits: ['healer'] }),
        mikazukibat: e('030', 'ミカヅキバット', 'かぜ', 'approach', 18, 12, 9, 21, 'jammer', 'キキッ', { traits: ['evasive'] }),
        mangetsuwolf: e('031', 'マンゲツウルフ', 'ふつう', 'approach', 24, 13, 10, 24, 'attacker', 'ワォーン！', { traits: ['frenzy'] }),
        hoshikuzun: e('032', 'ホシクズン', 'ふしぎ', 'shoot', 17, 11, 9, 20, 'supporter', 'キラッ☆', { moves: [['kira', 1]] }),
        nandomoslime: e('033', 'ナンドモスライム', 'みず', 'approach', 22, 12, 11, 25, 'defender', '言ったっけ？言ったっけ？', { traits: ['revive', 'swim'] }),
        lunashadow: e('034', 'ルナシャドウ', 'ふしぎ', 'approach', 21, 13, 9, 24, 'attacker', '…………', { traits: ['ghost'] }),
        yukimidango: e('035', 'ユキミダンゴ', 'こおり', 'approach', 22, 12, 12, 23, 'defender', 'おつきみ～', { moves: [['yukidama', 0.35]] }),
        // 6. 筋肉の山 (敵が力持ち・溶岩)
        proteingolem: e('036', 'プロテインゴーレム', 'ふつう', 'approach', 30, 18, 13, 28, 'defender', 'タンパク…シツ…', { traits: ['slow'] }),
        dumbbellkong: e('037', 'ダンベルコング', 'ふつう', 'approach', 26, 14, 11, 27, 'attacker', 'ウホッ（ナイスバルク）', { traits: ['charge'] }),
        mirrormuscle: e('038', 'ミラーマッスル', 'ふしぎ', 'wait', 24, 12, 14, 27, 'defender', 'キレてるよ！', { traits: ['reflect'] }),
        yoroinukegara: e('039', 'ヨロイヌケガラ', 'ふつう', 'approach', 24, 13, 20, 28, 'defender', 'ガシャン、ガシャン'),
        asedakku: e('040', 'アセダック', 'みず', 'shoot', 22, 12, 10, 25, 'supporter', 'あせあせ！', { traits: ['swim'], moves: [['ase', 1]] }),
        magmatcho: e('041', 'マグマッチョ', 'ほのお', 'approach', 28, 15, 12, 30, 'attacker', 'アツい筋肉！', { traits: ['lava'], moves: [['magma', 0.35]] }),
        yukidarumuscle: e('042', 'ユキダルマッスル', 'こおり', 'approach', 28, 14, 13, 30, 'attacker', '冷えた筋肉も最高だ', { moves: [['kori_punch', 0.3]] }),
        // 7. ASOの壺の底
        tsubomajin: e('043', 'ツボマジン', 'ふしぎ', 'wait', 28, 13, 14, 32, 'supporter', '出でよ！', { traits: ['summon'] }),
        asohei: e('044', 'アソヘイ', 'ふつう', 'approach', 26, 14, 13, 28, 'attacker', 'アソ！アソ！', { traits: ['group'] }),
        takaramimic: e('045', 'タカラミミック', 'ふつう', 'wait', 34, 17, 16, 42, 'defender', 'あけたな？', { traits: ['mimic'] }),
        shakkinbourei: e('046', 'シャッキンボウレイ', 'ふしぎ', 'approach', 26, 13, 12, 32, 'supporter', '…かえせ…かえせ…', { traits: ['ghost', 'stealMoney'] }),
        fusaiyougaikotsu: e('047', 'フサイヨウガイコツ', 'ふしぎ', 'shoot', 26, 14, 12, 33, 'jammer', '今回はご縁がなかったということで', { moves: [['fusaiyou', 1]] }),
        nakatadraco: e('048', 'ナカタドラコ', 'みず', 'shoot', 32, 16, 14, 40, 'attacker', 'ガオー（加減中）', { traits: ['swim'], moves: [['mizu_breath', 1]] }),
        makibikonmk3: e('049', 'マキビコンMk-3', 'ふつう', 'shoot', 30, 15, 15, 36, 'attacker', '計算中であります…エラーであります', { traits: ['malfunction'], moves: [['beam', 1]] }),
        koorimodoki: e('050', 'コオリモドキ', 'こおり', 'approach', 32, 16, 14, 42, 'attacker', 'ぼくがほんもののこおりくんだよ', { moves: [['koori_sword', 0.3], ['koori_hammer', 0.2]] }),
        // 8. どこにでも出る (まれ)
        daichouenkin: e('051', 'ダイチョウエンキン', 'ふしぎ', 'approach', 10, 7, 5, 10, 'jammer', 'おなか、ぐるぐる～', { traits: ['split'], moves: [['kin', 0.5]] }),
        kinmenkoinu: e('052', 'キンメンコイヌ', 'ふつう', 'flee', 14, 8, 8, 25, 'supporter', 'ワン！（得意げ）', { traits: ['rich'] }),
        // 強敵 (前作から。大きい絵)
        goldDog: e('', 'ゴールド金面犬', 'ふつう', 'flee', 40, 14, 18, 120, 'supporter', 'ワオーン！', { big: true, traits: ['rich'] }),
        makibikon: e('', 'マキビコンMk-4', 'ふつう', 'shoot', 50, 17, 18, 90, 'attacker', '目標を補足したであります', { big: true, moves: [['beam', 1]] }),
        nakata: e('', '奈架多ドラゴン', 'みず', 'approach', 56, 18, 15, 100, 'attacker', 'ガオオオー！', { big: true, traits: ['swim'], moves: [['mizu_breath', 0.4]] }),

        // ----- ボス (仕様書 12章。いちばん下の階。大きい絵) -----
        harry: e('', 'ハリー', 'ふつう', 'approach', 50, 11, 8, 80, 'attacker', 'ここはオレの森だハリ！', { boss: true, big: true, traits: ['summon'], summon: 'haribaby', moves: [['hari_needle', 0.4]] }),
        urashima: e('', '浦の島重蔵', 'みず', 'approach', 62, 12, 12, 120, 'defender', 'わしの家に 何の用じゃ…はて、何だったかのう', { boss: true, big: true, traits: ['swim', 'shell'], moves: [['tamatebako', 0.3], ['koura', 0.15]] }),
        daishi: e('', 'ダイシ', 'ふしぎ', 'approach', 72, 13, 11, 170, 'jammer', '迷える子羊よ、説法を聞いていきなさい', { boss: true, big: true, traits: ['berserk'], moves: [['seppou', 0.3], ['shakujou', 0.3]] }),
        zumitani: e('', 'ズミタニ', 'かぜ', 'approach', 70, 14, 10, 220, 'attacker', '78代目の名にかけて！', { boss: true, big: true, speed: 2, moves: [['kunai_rain', 0.4], ['shinobi_kiri', 0.3]] }),
        runaya: e('', 'ルナヤ', 'ふしぎ', 'approach', 80, 14, 11, 280, 'jammer', '月の迷宮へようこそ。言ったっけ？', { boss: true, big: true, traits: ['warp'], moves: [['moon_beam', 0.4], ['moon_spell', 0.3]] }),
        nozoema: e('', 'ノゾエマ', 'ふつう', 'approach', 95, 16, 14, 350, 'defender', '筋肉と刀は うそをつかぬ', { boss: true, big: true, moves: [['katana', 0.4], ['kabuto_wari', 0.3]] }),
        maou: e('', '大魔王ASO', 'ふしぎ', 'approach', 130, 17, 14, 600, 'attacker', 'よみがえったぞ……今度こそ すべてを 無に返してやる！', { boss: true, big: true, traits: ['summon', 'berserk'], summon: 'asohei', moves: [['funka', 0.3], ['lava_beam', 0.3]] })
    });
    // 森の敵の わざ・とくちょう を同じ形に (move / rate → moves)
    Object.values(U.ENEMIES).forEach(d => {
        if (!d.moves) d.moves = d.move ? [[d.move, d.ai === 'shoot' ? 1 : d.rate || 0]] : [];
        if (!d.traits) d.traits = [];
        if (d.element === 'みず' && !d.traits.includes('swim') && d.ai !== 'wait') d.traits.push('swim');
        if (d.element === 'ほのお' && !d.traits.includes('lava')) d.traits.push('lava');
        if (d.element === 'こおり') d.immune = [...(d.immune || []), 'freeze'];
    });
    U.HEROES.koori.immune = ['freeze'];
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
