// =====================================================================
// ダンジョン 7 つ (仕様書 12章) と、ストーリー (仕様書 2章)
// ---------------------------------------------------------------------
// それぞれ: 階数・敵の Lv・出る敵 (弱い順)・見た目 (art.js の THEMES)・特徴・ボス・ストーリーの台詞。
// 画面には触らない (game.js・townui.js が使う)。
// =====================================================================
(function (KD) {
    'use strict';

    const { Items: I, Dungeon: D } = KD;

    // 特徴 (仕様書 12章):
    //   pool: 水たまり・溶岩 / traps: ワナの数 / fast: すばやい敵の割合 / strong: 敵のこうげきの倍率 / shift: 何ターンごとに階の形が変わるか
    //   rare: まれに出る強敵 / drops: 敵が落とす素材
    const LIST = [
        {
            // 森はチュートリアルなので、階ごとの敵と Lv を決めてある (units.js の FOREST_TABLE)
            id: 'forest', name: 'ハリーの森', floors: 5, lv: 1, lvStep: 0.6, theme: 'forest', boss: 'harry',
            table: KD.Units.FOREST_TABLE, levels: [0, 1, 2, 2, 3],
            enemies: ['haribaby', 'mumenbachi', 'donguriko', 'nemuridake', 'pekorisu', 'tsutankobu', 'yofukashi'],
            traps: [2, 4], money: 1,
            story: {
                boss: ['ハリー「ここはオレの森だハリ！ 勝手に入るなハリ！」', 'こおりくん「ごめんね。でも 借金を返さないと こおり生きていけないんだ！」'],
                clear: ['ハリー「ま、まいったハリ……」', 'ふるカワ「すごい！ ハリーの森を抜けたね！」',
                    'やすさん「おーい、こおりくん！ 探検隊を作ったんだって？ ぼくも手伝うよ。けがをしたら まかせて！」',
                    'やすさん（ヒーラー）が 仲間になった！', '新しいダンジョン「浦の島の海岸どうくつ」が現れた！'],
                ally: 'yasu'
            }
        },
        {
            id: 'coast', name: '浦の島の海岸どうくつ', floors: 8, lv: 4, lvStep: 0.5, theme: 'coast', boss: 'urashima',
            enemies: ['kogame', 'tamatebakogani', 'tsuribariuo', 'isoginchakku', 'otohimedai', 'wasurekurage', 'umibozun'],
            pool: { tile: D.WATER, chance: 0.75 }, traps: [2, 4], money: 1.3,
            story: {
                intro: ['ふるカワ「海辺のどうくつに、浦の島重蔵さんが家を建てて住んでるんだって」'],
                boss: ['浦の島重蔵「わしの家に 何の用じゃ……はて、何の用だったかのう」', 'おにおに「こっちが聞いてるんだ！」'],
                clear: ['浦の島重蔵「ほっほっほ。強い若者じゃのう。玉手箱は あけてはならんぞ」',
                    'だけさん「よう、こおり！ 面白そうなことしてるな。オレが 前に立って守ってやるよ！」',
                    'だけさん（ディフェンダー）が 仲間になった！', '新しいダンジョン「ネット寺」が現れた！'],
                ally: 'dake'
            }
        },
        {
            id: 'temple', name: 'ネット寺', floors: 10, lv: 8, lvStep: 0.5, theme: 'temple', boss: 'daishi',
            enemies: ['spamdama', 'netkozou', 'mokugyoro', 'rousokubi', 'enjoubouzu', 'burakrasher', 'hannyamen'],
            traps: [6, 9], money: 1.6,
            story: {
                intro: ['ふるカワ「ダイシが立ち上げた『ネット寺』。ワナが多いから 気をつけてね」'],
                boss: ['ダイシ「迷える子羊よ。説法を聞いていきなさい……聞かぬなら、鬼の顔を見せましょう」'],
                clear: ['ダイシ「……あなたたちの 迷いのなさ、見事です」',
                    'たむさん「こおりくん、相手を止めるのは まかせて。いっしょに行くよ！」',
                    'たむさん（ジャマー）が 仲間になった！', '探検隊が大きくなって、4 人で冒険できるようになった！',
                    '新しいダンジョン「忍びの屋敷」が現れた！'],
                ally: 'tamu'
            }
        },
        {
            id: 'mansion', name: '忍びの屋敷', floors: 12, lv: 12, lvStep: 0.4, theme: 'mansion', boss: 'zumitani',
            enemies: ['geninman', 'makibishimushi', 'kunaisuzume', 'kawarimidanuki', 'shinobigaeru', 'shurikenbo', 'bakudanjirou'],
            traps: [3, 5], fast: 0.15, rare: ['makibikon'], money: 2,
            story: {
                intro: ['ふるカワ「ズミタニ家の屋敷。敵がとても すばやいよ」'],
                boss: ['ズミタニ「ここまで来るとは。78代目の名にかけて、通さぬ！」'],
                clear: ['ズミタニ「……見事。屋敷の巻物を 持っていくがよい」', '新しいダンジョン「月の迷宮」が現れた！']
            }
        },
        {
            id: 'moon', name: '月の迷宮', floors: 15, lv: 16, lvStep: 0.35, theme: 'moon', boss: 'runaya',
            enemies: ['tsukiusagi', 'hoshikuzun', 'mikazukibat', 'yukimidango', 'lunashadow', 'nandomoslime', 'mangetsuwolf'],
            traps: [3, 5], shift: 160, money: 2.4,
            story: {
                // チームバータス・チーム・ケモノミチ と出会う (2026-10-22 ユーザー指定。台詞は Claude の案)
                intro: ['ふるカワ「ルナヤが作った迷宮。しばらくいると、階の形が変わっちゃうんだって」',
                    '？？？「あら、かわいい探検隊さん。この迷宮の お宝は わたしたちが いただくわ」',
                    'ヤーハミー「美しさに 磨きをかける 女盗賊集団『チームバータス』。わたしが リーダーの ヤーハミーよ」',
                    'マエチョッキン「マエチョッキン。お宝も 美しさも、きれいに 切りそろえて いただくわ。チョッキン♪」',
                    'ノラハン「ノラハン。……盗むのは お宝だけじゃないかもね♪」',
                    '？？？「ブヒッ！ 勝手に 迷宮を 荒らすな！」',
                    'イシイー「ここは おれたちの 家だ！ ダンジョンで 生まれて ダンジョンで 育った、戦闘集団『チーム・ケモノミチ』！」',
                    'マズダ「マズダだ。迷宮の 奥は、よそ者には 通さん」',
                    'NAITOON「ワォーン……夜の迷宮で おれたちに 勝てると 思うなよ」',
                    'こおりくん「ラ、ライバルが 2 チームも…！ でも 借金のために 負けないよ！」'],
                boss: ['ルナヤ「月の迷宮へ ようこそ。……言ったっけ？ 言ったっけ？」'],
                clear: ['ルナヤ「月が 祝福しているわ。言ったっけ？」',
                    'ヤーハミー「ふん、今回は ゆずってあげる。でも お宝は あきらめないわよ」',
                    'イシイー「つ、強いブヒ……。もっと 深い迷宮で また 勝負だ！」',
                    'ふるカワ「チームバータスと チーム・ケモノミチ、これからも ダンジョンで 会いそうだね」',
                    '探検隊が もっと大きくなって、5 人で冒険できるようになった！',
                    '新しいダンジョン「筋肉の山」が現れた！']
            }
        },
        {
            id: 'mountain', name: '筋肉の山', floors: 18, lv: 20, lvStep: 0.2, theme: 'mountain', boss: 'nozoema',
            enemies: ['asedakku', 'yoroinukegara', 'dumbbellkong', 'mirrormuscle', 'magmatcho', 'yukidarumuscle', 'proteingolem'],
            pool: { tile: D.LAVA, chance: 0.5 }, traps: [3, 5], strong: 1.05, money: 2.8,
            story: {
                intro: ['ふるカワ「ノゾエマが修行する山。敵が力持ちで、溶岩もあるよ。こおりくんは とくに気をつけて！」'],
                boss: ['ノゾエマ「筋肉と刀は うそをつかぬ。いざ、尋常に勝負！」'],
                clear: ['ノゾエマ「……見事な筋肉だ」', 'ふるカワ「大変！ SEタウンの地下で、ASO の壺が ひび割れてる……！」',
                    '新しいダンジョン「ASOの壺の底」が現れた！']
            }
        },
        {
            id: 'aso', name: 'ASOの壺の底', floors: 25, lv: 25, lvStep: 0.15, theme: 'aso', boss: 'maou',
            enemies: ['asohei', 'tsubomajin', 'fusaiyougaikotsu', 'shakkinbourei', 'makibikonmk3', 'takaramimic', 'nakatadraco', 'koorimodoki'],
            pool: { tile: D.LAVA, chance: 0.4 }, traps: [4, 6], rare: ['nakata', 'makibikon'], money: 3.5,
            story: {
                intro: ['ふるカワ「大魔王ASO が よみがえろうとしてる！ いちばん奥まで行って、止めて！」'],
                boss: ['大魔王ASO「よみがえったぞ……今度こそ、すべてを 無に返してやる！」', 'こおりくん「させないよ！ 借金だって まだ返してないんだから！」',
                    'おにおに「そっちが理由か！」'],
                clear: ['大魔王ASO「ば、ばかな……また、こおりくんに……！」', '大魔王ASO は ふたたび 壺の底に 封印された。',
                    'ふるカワ「やったね！ SEタウンが救われたよ！」', 'おにおに「よくやった。……で、借金は まだ残ってるからな」',
                    'こおりくん「とほほ～～！！」', '～ ストーリー クリア ～\n（借金を返し切ると、ほんとうの エンディング）'],
                last: true
            }
        }
    ];

    // どこにでも まれに出る敵 (確率)
    const ANYWHERE = [['daichouenkin', 0.03], ['kinmenkoinu', 0.03], ['goldDog', 0.004]];

    // その階に出る敵。下の階ほど 強い敵がまざる (並びの前から 3〜4 体ぶんを ずらしていく)
    function tableFor(d, floor) {
        if (d.tableAt) return d.tableAt(floor);   // ドタバタ大迷宮 (enemies9.js)
        if (d.table) return d.table[floor - 1];
        const n = d.enemies.length;
        const k = Math.round((floor - 1) / Math.max(1, d.floors - 1) * (n - 3));
        return d.enemies.slice(Math.max(0, k - (floor > d.floors / 2 ? 1 : 0)), k + 3);
    }
    // その階の敵の Lv
    const levelFor = (d, floor) => (d.levels ? d.levels[floor - 1] : Math.max(1, Math.round(d.lv + (floor - 1) * d.lvStep)));

    // 敵が落とす素材 (森は items.js の DROPS。ほかは ダンジョンごとに 2 つ)
    const MATERIALS = {
        coast: ['sea_shell', 'kelp'], temple: ['temple_incense', 'broken_cable'], mansion: ['ninja_scroll', 'iron_kunai'],
        moon: ['moon_dust', 'star_piece'], mountain: ['protein_powder', 'magma_stone'], aso: ['aso_ash', 'cursed_coin']
    };
    LIST.forEach(d => {
        if (!MATERIALS[d.id]) return;
        d.enemies.forEach((kind, i) => { if (!I.DROPS[kind]) I.DROPS[kind] = MATERIALS[d.id][i % 2]; });
    });

    // ドタバタ大迷宮 (KD.Dungeons.BONUS。enemies9.js で足す) も さがす
    const byId = id => LIST.find(d => d.id === id) || (KD.Dungeons.BONUS && KD.Dungeons.BONUS.id === id ? KD.Dungeons.BONUS : undefined);

    // 一緒に行ける人数 (仕様書 8章: 3 人。ネット寺をクリアすると 4 人、月の迷宮で 5 人)
    const partyMax = cleared => 3 + (cleared >= 3 ? 1 : 0) + (cleared >= 5 ? 1 : 0);

    KD.Dungeons = { LIST, ANYWHERE, MATERIALS, tableFor, levelFor, byId, partyMax };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
