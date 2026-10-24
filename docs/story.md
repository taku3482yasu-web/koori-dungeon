# ストーリー（台詞の 書き出し）

> このファイルは `node tools/export-story.mjs` で ゲームの データから 自動で 作っています。
> 書き換えたいところを このファイルの 上で 直して わたしてください。〔 〕の 番号で ゲームの どこの 台詞かが わかります。

## 書き方の きまり

- 1 行が ゲームの 画面 1 枚（「つぎへ」で 次の 行）。行を 足す・消す・入れかえるのも OK
- `⏎` は 画面の中の 改行
- `名前「台詞」` の 形だと、その キャラの 絵が 大きく 出る（ストーリーデモ）。`？？？「…」` は 次に 名乗る キャラの 影
- 「○○（役職）が 仲間になった！」→ 仲間の 絵、「新しいダンジョン「○○」が現れた！」→ 入り口が 現れる 絵、「○ 人で冒険」→ みんなが ならぶ 絵
- `{town}` は 町の名前（SEタウン）、`{debt}` は 借金の 額、`{title}` は ゲームの名前、`{version}` は 氷隊 / 鬼鬼団、`{hero}` は 主人公の 名前
- 「主人公が こおりくん / おにおに」と 2 行 あるところは、えらんだ 主人公で 台詞が かわる

## 1. オープニング（はじめから）

（えらんだ キャラで ゲームが 始まると 出る。1 行ごとに 絵：摩天楼の打ち上げ → 借金 → ふるカワと ダンジョン → おにおに → 結成）

- 〔opening.1〕 【{title} {version}】⏎摩天楼の財宝で 借金を返したはずが……打ち上げで散財して、また借金ができてしまった。
- 〔opening.2〕 こおりくん「どうしよう。こおり生きていけないよ～～！！」
- 〔opening.3〕 ふるカワ「{town}の近くに、不思議なダンジョンが いくつも現れたんだって。⏎探検隊になって依頼をこなせば、お金がもらえるよ！」
- 〔opening.4〕（主人公が こおりくん）おにおに「こおりが金を返すまで、不安だから 俺も見張りで ついていくぞ。貸した金は きっちり返してもらうからな！」
- 〔opening.4〕（主人公が おにおに）おにおに「貸した金は 自分で取り返す！ こおり、ダンジョンへ ついてこい！」
- 〔opening.5〕 探検隊「{version}」結成！⏎借金：{debt}。クエストをこなして、おにおにに返していこう。

## 2. 本編（ダンジョン 7 つ）

バージョンの 台詞（7 章）の「ボスを たおしたあと」が、毎回 最後に つく。

### 1. ハリーの森（5 階・ボス：ハリー）

**はじめて 行くとき（町で。絵つき）**

- 〔forest.intro.1〕 ふるカワ「まずは 町の すぐそばの ハリーの森へ 行ってみよう！ 奥には ハリーが 住んでるんだって」
- 〔forest.intro.2〕 ふるカワ「階段を 見つけて 降りていけば 奥に 行けるよ。こまったら 道具を 使ってね！」
- 〔forest.intro.3〕（主人公が こおりくん）こおりくん「よーし、借金返済への 第一歩だ！」
- 〔forest.intro.3〕（主人公が おにおに）おにおに「よし。借金返済の第一歩だ！」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔forest.boss.1〕 ハリー「ッチ！ハリー！！（あっちいけ！ぶっ殺すぞ！）」
- 〔forest.boss.2〕（主人公が こおりくん）こおりくん「ごめんね。でも 借金を返さないと こおり生きていけないんだ！」
- 〔forest.boss.2〕（主人公が おにおに）おにおに「あ？なんだてめえ。殺すぞ」

**ボスを たおしたあと（町で。絵つき）**

- 〔forest.clear.1〕 ハリー「ム、ムリー.....」
- 〔forest.clear.2〕 ふるカワ「すごい！ ハリーの森を抜けたね！」
- 〔forest.clear.3〕（主人公が こおりくん）やすさん「おーい、こおりくん！ 探検隊を作ったんだって？ ぼくも手伝うよ。けがをしたら まかせて！」
- 〔forest.clear.3〕（主人公が おにおに）やすさん「おーい、おにおに！ 探検隊を作ったんだって？ ぼくも手伝うよ。けがをしたら まかせて！」
- 〔forest.clear.4〕 やすさん（ヒーラー）が 仲間になった！
- 〔forest.clear.5〕 新しいダンジョン「浦の島の海岸どうくつ」が現れた！

※ たおすと やすさん が 仲間になる（台詞の「仲間になった！」の 行で 仲間の 絵が 出る）

### 2. 浦の島の海岸どうくつ（8 階・ボス：浦の島重蔵）

**はじめて 行くとき（町で。絵つき）**

- 〔coast.intro.1〕 ふるカワ「海辺のどうくつに、浦の島重蔵さんが家を建てて住んでるんだって」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔coast.boss.1〕 浦の島重蔵「わしの家に 何の用じゃ……はて、何の用だったかのう」
- 〔coast.boss.2〕（主人公が こおりくん）こおりくん「こっちがきいてるちゃむ！」
- 〔coast.boss.2〕（主人公が おにおに）おにおに「こっちが聞いてるんだ！」

**ボスを たおしたあと（町で。絵つき）**

- 〔coast.clear.1〕 浦の島重蔵「ほっほっほ。強い若者じゃのう。久しぶりに脳汁がでたわい。またのぉ」
- 〔coast.clear.2〕（主人公が こおりくん）だけさん「よう、こおり！ 面白そうなことしてるな。わたしが 前に立って守ってあげよう！」
- 〔coast.clear.2〕（主人公が おにおに）だけさん「よう、おにおに！ 面白そうなことしてるな。わたしが 前に立って守ってあげよう！」
- 〔coast.clear.3〕 だけさん（ディフェンダー）が 仲間になった！
- 〔coast.clear.4〕 新しいダンジョン「ネット寺」が現れた！

※ たおすと だけさん が 仲間になる（台詞の「仲間になった！」の 行で 仲間の 絵が 出る）

### 3. ネット寺（10 階・ボス：ダイシ）

**はじめて 行くとき（町で。絵つき）**

- 〔temple.intro.1〕 ふるカワ「ダイシが立ち上げた『ネット寺』。ワナが多いから 気をつけてね」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔temple.boss.1〕 ダイシ「よくぞ参られた。拙僧の説法を聞いていきなされ……聞かぬなら、鬼の顔を見せましょう」

**ボスを たおしたあと（町で。絵つき）**

- 〔temple.clear.1〕 ダイシ「見事…拙僧の負けです。その 迷いのなさ、仏も お喜びでしょう」
- 〔temple.clear.2〕（主人公が こおりくん）たむさん「こおりじゃん。暇だしついていくよ。相手を止めるのは まかせて」
- 〔temple.clear.2〕（主人公が おにおに）たむさん「おにおにじゃん。暇だしついていくよ。相手を止めるのは まかせて」
- 〔temple.clear.3〕 たむさん（ジャマー）が 仲間になった！
- 〔temple.clear.4〕 探検隊が大きくなって、4 人で冒険できるようになった！
- 〔temple.clear.5〕 新しいダンジョン「忍びの屋敷」が現れた！

※ たおすと たむさん が 仲間になる（台詞の「仲間になった！」の 行で 仲間の 絵が 出る）

### 4. 忍びの屋敷（12 階・ボス：ズミタニ）

**はじめて 行くとき（町で。絵つき）**

- 〔mansion.intro.1〕 ふるカワ「ズミタニ家の屋敷。敵がとても すばやいよ」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔mansion.boss.1〕 ズミタニ「ここまで来るとはね。78代目の名にかけて、通さないよ♪」

**ボスを たおしたあと（町で。絵つき）**

- 〔mansion.clear.1〕 ズミタニ「……見事だね♪屋敷の巻物を 持っていくといいよ！」
- 〔mansion.clear.2〕 新しいダンジョン「月の迷宮」が現れた！

### 5. 月の迷宮（15 階・ボス：ルナヤ）

**はじめて 行くとき（町で。絵つき）**

- 〔moon.intro.1〕 ふるカワ「ルナヤが作った迷宮。しばらくいると、階の形が変わっちゃうんだって」
- 〔moon.intro.2〕 ？？？「あら、かわいい探検隊さん。この迷宮の お宝は わたしたちが いただくわ」
- 〔moon.intro.3〕 ヤーハミー「女盗賊集団『チームバータス』。わたしが リーダーの ヤーハミーよ」
- 〔moon.intro.4〕 マエチョッキン「マエチョッキン。お宝も 美しさも、きれいに 切りそろえて いただくわ。チョッキン♪」
- 〔moon.intro.5〕 ノラハン「ノラハン。……盗むのは お宝だけじゃないかもね♪」
- 〔moon.intro.6〕 ？？？「ピョンッ！ 勝手に 迷宮を 荒らすな！」
- 〔moon.intro.7〕 イシイー「ここは おれたちの 家だ！ ダンジョンで 生まれて ダンジョンで 育った、戦闘集団『チーム・ケモノミチ』！」
- 〔moon.intro.8〕 マズダ「マズダだ。迷宮の 奥は、よそ者には 通さん」
- 〔moon.intro.9〕 NAITOON「ワォーン……夜の迷宮で おれたちに 勝てると 思うなよ」
- 〔moon.intro.10〕 こおりくん「ラ、ライバルが 2 チームも…！ でも 借金のために 負けないよ！」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔moon.boss.1〕 ルナヤ「月の迷宮へ ようこそ。……月の迷宮へ ようこそ。あら、もう言ったかしら？」

**ボスを たおしたあと（町で。絵つき）**

- 〔moon.clear.1〕 ルナヤ「月が 祝福しているわ。……月が 祝福しているわ。あら、これも言ったかしら？」
- 〔moon.clear.2〕 ヤーハミー「ふん、今回は ゆずってあげる。でも お宝は あきらめないわよ」
- 〔moon.clear.3〕 イシイー「つ、強いピョン……。もっと 深い迷宮で また 勝負だ！」
- 〔moon.clear.4〕 ふるカワ「チームバータスと チーム・ケモノミチ、これからも ダンジョンで 会いそうだね」
- 〔moon.clear.5〕 探検隊が もっと大きくなって、5 人で冒険できるようになった！
- 〔moon.clear.6〕 新しいダンジョン「筋肉の山」が現れた！

### 6. 筋肉の山（18 階・ボス：ノゾエマ）

**はじめて 行くとき（町で。絵つき）**

- 〔mountain.intro.1〕 ふるカワ「ノゾエマが修行する山。敵が力持ちで、溶岩もあるよ。こおりくんはここじゃカスだから とくに気をつけて！」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔mountain.boss.1〕 ノゾエマ「よくぞここまで来た。…だが、その前に見よ。この鍛え抜かれた筋肉を！ 筋肉と名刀江波は うそをつかぬ！」

**ボスを たおしたあと（町で。絵つき）**

- 〔mountain.clear.1〕 ノゾエマ「……見事な筋肉だ」
- 〔mountain.clear.2〕 ふるカワ「大変！ SEタウンの地下で、ASO の壺が ひび割れてる……！」
- 〔mountain.clear.3〕 新しいダンジョン「ASOの壺の底」が現れた！

### 7. ASOの壺の底（25 階・ボス：大魔王ASO）

**はじめて 行くとき（町で。絵つき）**

- 〔aso.intro.1〕 ふるカワ「大魔王ASO が よみがえろうとしてる！ いちばん奥まで行って、止めて！」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔aso.boss.1〕 大魔王ASO「よみがえったぞ……今度こそ、すべてを 無に返してやる！」
- 〔aso.boss.2〕（主人公が こおりくん）こおりくん「させないよ！ 借金だって まだ返してないんだから！」
- 〔aso.boss.2〕（主人公が おにおに）おにおに「させないぞ！こおりから借金を返してもらっていないからな！」
- 〔aso.boss.3〕 大魔王ASO「フハハハハハ！さあ、かかってこい！」

**ボスを たおしたあと（町で。絵つき）**

- 〔aso.clear.1〕 大魔王ASO「ば、ばかな……また、また、敗れるのか！？このASOが～～～～～～！！！」
- 〔aso.clear.2〕 大魔王ASO は ふたたび 壺の底に 封印された。
- 〔aso.clear.3〕 ふるカワ「やったね！ SEタウンが救われたよ！」
- 〔aso.clear.4〕（主人公が こおりくん）おにおに「よくやった。……で、借金は まだ残ってるからな」
- 〔aso.clear.4〕（主人公が おにおに）こおりくん「やったー！すごいよおにおに！」
- 〔aso.clear.5〕（主人公が こおりくん）こおりくん「え～～！ひどいちゃむ～～～！！」
- 〔aso.clear.5〕（主人公が おにおに）おにおに「ふん！あんなやつは雑魚にすぎん！それはそれとしてこおり！借金はまだのこってるからな！」
- 〔aso.clear.6〕（主人公が こおりくん）ふるカワ「残念だったね」
- 〔aso.clear.6〕（主人公が おにおに）こおりくん「え～～！ひどいちゃむ～～～！！」
- 〔aso.clear.7〕 ～ ストーリー クリア ～⏎（借金を返し切ると、ほんとうの エンディング）

## 3. ストーリー クリアのあと

（ASOの壺の底の 話の すぐ あと）

- 〔rivalsQuest.1〕 ふるカワ「たいへん！ ギルドに ライバル探検隊のみんなから クエストが 届いてるよ！」
- 〔rivalsQuest.2〕 ふるカワ「頼みを かなえたら 仲間になってくれるって。メンバーが そろうと、リーダーが 勝負を 挑んでくるみたい！」

## 4. エンディング（借金を 返し切った）

（借金返済所で 借金が 0 になったとき。このあとに バージョンの 台詞（7 章の ending））

- 〔ending.before.1〕 おにおに「……全部、返したな」
- 〔ending.before.2〕 こおりくん「やったー！ これで こおり 生きていけるよ～～！！」
- 〔ending.before.3〕 ふるカワ「探検隊『ばりきつよめ』、大活躍だったね！」

（バージョンの 台詞の あと）

- 〔ending.after.1〕 ～ おしまい ～⏎（このあとも 遊べます）
- 〔ending.after.2〕 ふるカワ「たいへん！ {town}のはずれに、底の見えない 大きな穴が 開いたよ！」
- 〔ending.after.3〕 新しいダンジョン「ドタバタ大迷宮」（99 階）が 現れた！

## 5. 追加の ダンジョン（段階 10・バージョン）

### 1. バグだらけのコード塔（15 階・ボス：トリプルC）

現れる 条件：ネット寺を 突破すると 現れる

**はじめて 行くとき（町で。絵つき）**

- 〔code.intro.1〕 ふるカワ「ネット寺の となりに、コードで できた塔が 生えてきたって！ 中は バグだらけらしいよ」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔code.boss.1〕 トリプルC「C・C++・C#……すべての 力を 統べる者、トリプルC！ バグごと 消えるがいい！」
- 〔code.boss.2〕（主人公が こおりくん）こおりくん「バグは 直すものだよ！」
- 〔code.boss.2〕（主人公が おにおに）おにおに「バグ？まぁ叩けば治るだろ」

**ボスを たおしたあと（町で。絵つき）**

- 〔code.clear.1〕 トリプルC「……コンパイル エラー……」
- 〔code.clear.2〕 ふるカワ「すごい！ 塔の バグが 直っていくよ！」
- 〔code.clear.3〕 バグだらけのコード塔を 突破した！

### 2. ツモツモ横丁（20 階・ボス：国士無双ニャン）

現れる 条件：ストーリーを クリアすると 現れる

**はじめて 行くとき（町で。絵つき）**

- 〔alley.intro.1〕 ふるカワ「町の 夜の はずれに、ずっと 夜の 横丁が 現れたって。ネコの 雀士が いっぱい いるらしいよ」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔alley.boss.1〕 国士無双ニャン「十三面待ちだニャ……おまえの 運も ここまでだニャ！」
- 〔alley.boss.2〕（主人公が こおりくん）こおりくん「運より 実力！３万６千円の力ちゃむ！」
- 〔alley.boss.2〕（主人公が おにおに）おにおに「運で俺に勝負をいどむか。望むところだ！」

**ボスを たおしたあと（町で。絵つき）**

- 〔alley.clear.1〕 国士無双ニャン「……チョンボだニャ～」
- 〔alley.clear.2〕 ふるカワ「横丁に 朝が 来たよ！」
- 〔alley.clear.3〕 ツモツモ横丁を 突破した！

### 3. ハリー王国（25 階・ボス：ハリー大帝）

現れる 条件：ストーリーを クリアすると 現れる

**はじめて 行くとき（町で。絵つき）**

- 〔kingdom.intro.1〕 ハリー「ハリー！メンテイー！（なんかハリーの王国出来てた）」
- 〔kingdom.intro.2〕 ふるカワ「25 階も あるんだって！ メタルの ハリーも いるらしいよ」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔kingdom.boss.1〕 ハリー大帝「余の 王国へ ようこそ。そして さらばだ！」
- 〔kingdom.boss.2〕 こおりくん「ハリーたちの ためにも 負けないよ！」

**ボスを たおしたあと（町で。絵つき）**

- 〔kingdom.clear.1〕 ハリー大帝「……見事だ。余の トゲも まだまだ だな」
- 〔kingdom.clear.2〕 ハリー「ハリー！（大帝とかｗう、うおｗ）」
- 〔kingdom.clear.3〕 ハリー王国を 突破した！

### 4. 雪どけの氷河（15 階・ボス：ハル麒麟）

現れる 条件：氷隊だけ。月の迷宮を 突破すると 現れる

**はじめて 行くとき（町で。絵つき）**

- 〔glacier.intro.1〕 ふるカワ「月の迷宮の むこうに、氷河が 見つかったんだって！ でも 奥から 春の においが するらしいよ」
- 〔glacier.intro.2〕 こおりくん「よーし！氷隊！出動だ！」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔glacier.boss.1〕 ハル麒麟「氷は とけ、春が 来る。それが さだめ。こおりの子よ、そなたも 溶けて賢者となりなさい」
- 〔glacier.boss.2〕 こおりくん「こおりは とけないよ！ 氷隊の 意地を 見せてやる！」

**ボスを たおしたあと（町で。絵つき）**

- 〔glacier.clear.1〕 ハル麒麟「……春を はねかえす 氷か。見事だ」
- 〔glacier.clear.2〕 ふるカワ「氷河が 元に もどっていくよ！」
- 〔glacier.clear.3〕 雪どけの氷河を 突破した！

※ 氷隊だけ

### 5. 金色のSE城（15 階・ボス：金滅鬼）

現れる 条件：鬼鬼団だけ。月の迷宮を 突破すると 現れる

**はじめて 行くとき（町で。絵つき）**

- 〔onijo.intro.1〕 ふるカワ「月の迷宮の むこうに、金ピカの お城が 建ったんだって！ 鬼が いっぱい いるらしいよ」
- 〔onijo.intro.2〕 おにおに「鬼の 城だと？ それ俺の城じゃね？　だまってられん！鬼鬼団！出陣だ！」

**ボスに 会ったとき（ダンジョンの中。カットインのあと）**

- 〔onijo.boss.1〕 金滅鬼「金色の 鬼に ひれ伏せ！ 鬼を 名のる 小僧よ、ここで 滅びるがいい！」
- 〔onijo.boss.2〕 おにおに「鬼鬼団の 鬼は 負けん！ 金返せ……じゃなくて、城を 返せ！」

**ボスを たおしたあと（町で。絵つき）**

- 〔onijo.clear.1〕 金滅鬼「……ぐぬぬ……その 鬼の 心、本物か……」
- 〔onijo.clear.2〕 ふるカワ「お城の 金ピカが 消えていくよ！」
- 〔onijo.clear.3〕 金色のSE城を 突破した！

※ 鬼鬼団だけ

## 6. ドタバタ大迷宮（おまけ・99 階）

（はじめて 行くとき）

- 〔bonus.intro.1〕 ふるカワ「SEタウンのはずれに 開いた 底の見えない 大きな穴……ドタバタ大迷宮だよ！ 99 階まで あるんだって」
- 〔bonus.intro.2〕 ヤーハミー「あら、こおりくん。この迷宮の いちばん奥の お宝は、わたしたちが いただくわ」
- 〔bonus.intro.3〕 イシイー「ピョンッ！ 迷宮は おれたちの 庭だ！ 先に 99 階に着くのは チーム・ケモノミチだ！」
- 〔bonus.intro.4〕（主人公が こおりくん）こおりくん「ぼくたちも 負けないよ！ ……借金は もう ないけどね！」
- 〔bonus.intro.4〕（主人公が おにおに）おにおに「われらも負けん！貸した金が返ってきて気分がいいからな！」
- 〔bonus.intro.5〕 ふるカワ「10 階ごとに 休憩の階が あるよ。町に帰っても、次は そこから 始められるからね」

**休憩の階に 着いたとき**

（B10F）

- 〔bonus.rest.10.1〕 ふるカワ「休憩の階だよ！ ここまで来たら、次は B10F から 始められるよ」

（B20F）

- 〔bonus.rest.20.1〕 マエチョッキン「あら、また会ったわね。お宝の においが するでしょ？ チョッキン♪」
- 〔bonus.rest.20.2〕 ふるカワ「ここで ひと休みしよう！」

（B30F）

- 〔bonus.rest.30.1〕 マズダ「……ここまで 来るとは。少しは やるようだな」
- 〔bonus.rest.30.2〕 ふるカワ「ここで ひと休みしよう！」

（B40F）

- 〔bonus.rest.40.1〕 ノラハン「ニャハッ。この先の 50 階で、みんなが 待ってるわよ♪」
- 〔bonus.rest.40.2〕 ふるカワ「ここで ひと休みしよう！」

（B60F）

- 〔bonus.rest.60.1〕 NAITOON「ワォーン……次は 負けないぞ」
- 〔bonus.rest.60.2〕 ふるカワ「半分を すぎたね！ ここで ひと休みしよう！」

（B70F）

- 〔bonus.rest.70.1〕 ふるカワ「だんだん 敵が 強くなってきたね……ここで ひと休みしよう！」

（B80F）

- 〔bonus.rest.80.1〕 ヤーハミー「この先は あなたたちに ゆずるわ。……お宝は あとで 山分けよ？」
- 〔bonus.rest.80.2〕 ふるカワ「ここで ひと休みしよう！」

（B90F）

- 〔bonus.rest.90.1〕 イシイー「ピョ……99 階の 奥から、ものすごい 気配が する。気をつけろ！」
- 〔bonus.rest.90.2〕 ふるカワ「いよいよだね。ここで ひと休みしよう！」

（50 階で ライバル 2 チームと 対決）

- 〔bonus.rivals.1〕 ヤーハミー「ここまでよ。お宝は わたしたちが いただくわ！」
- 〔bonus.rivals.2〕 イシイー「チームバータスと 手を組んででも、ここは 通さん！」
- 〔bonus.rivals.3〕（主人公が こおりくん）こおりくん「2 チームいっぺんに！？ でも 負けないよ！」
- 〔bonus.rivals.3〕（主人公が おにおに）おにおに「２チーム同時か。おもしろい！」

（ライバルを たおしたあと）

- 〔bonus.rivalsDown.1〕 ヤーハミー「……まいったわ。この先は あなたたちに まかせる」
- 〔bonus.rivalsDown.2〕 イシイー「ピョ……強い。99 階まで 行ってこい！」

（99 階で 大魔王ASO・真に 会ったとき）

- 〔bonus.boss.1〕 大魔王ASO・真「まだだ……真の力を 見せてやろう！」
- 〔bonus.boss.2〕（主人公が こおりくん）こおりくん「もう 借金も ないし、こおり 生きていけるんだ！ 負けないよ！」
- 〔bonus.boss.2〕（主人公が おにおに）おにおに「しぶといやつだな！なんどこようが、返り討ちにしてくれる！」
- 〔bonus.boss.3〕 大魔王ASO・真「これで終わりだ！{hero}！貴様の首を、新しい摩天楼の最上階に飾ってやろう！！」

（はじめて 抜けたとき（ほんとうの ほんとうの エンディング））

- 〔bonus.clear.1〕 大魔王ASO・真「ば、ばかな……真の力でも……！このASOが...!このASOが～～～～～～～～～～～～～～～～～～～～～～～～～～～～～～！！！」
- 〔bonus.clear.2〕 大魔王ASO・真は 光になって 消えていった。
- 〔bonus.clear.3〕 ふるカワ「やったー！ ドタバタ大迷宮を 抜けたよ！」
- 〔bonus.clear.4〕 ヤーハミー「……見事ね。お宝は ゆずってあげる」
- 〔bonus.clear.5〕 イシイー「ピョンッ！ 最高の 探検隊だ！」
- 〔bonus.clear.6〕（主人公が こおりくん）おにおに「……よくやったな、こおり」
- 〔bonus.clear.6〕（主人公が おにおに）こおりくん「すごっ！強すぎるよおにおに！」
- 〔bonus.clear.7〕（主人公が こおりくん）こおりくん「みんなの おかげだよ！ これからも ドタバタ 探検するぞー！」
- 〔bonus.clear.7〕（主人公が おにおに）おにおに「ふん！このおにおに！戦闘において右に出る者はいない！さあ、冒険の続きだ！」
- 〔bonus.clear.8〕 ～ ほんとうの ほんとうの エンディング ～⏎（このあとも 何度でも 挑戦できます）

（2 回目から 抜けたとき）

- 〔bonusAgain.1〕 ふるカワ「また 大魔王ASO・真を たおしたね！ すごい！」
- 〔bonusAgain.2〕 大魔王ASO・真「もうゆるしてほしい」

## 7. バージョン（氷隊 / 鬼鬼団）の 台詞

### 氷隊（主人公が こおりくん）

（町の メニューの 上に 日がわりで 1 つ）

- 〔version.koori.town.1〕 SEタウンの子ども「あっ、氷隊だ！ こおりくん、サインちょうだい！」
- 〔version.koori.town.2〕 ふるカワ「氷隊の 旗、町の 入り口に かざってもらったよ！」
- 〔version.koori.town.3〕 お店の人「氷隊さん、きょうは 氷のかけらが 安いよ！」
- 〔version.koori.town.4〕 ギルドの人「氷隊の うわさ、となり町まで 広がってるらしいぞ」
- 〔version.koori.town.5〕 おにおに「氷隊だか なんだか 知らんが、借金は 借金だぞ」

（本編の ボスを たおしたあと、毎回 最後に）

- 〔version.koori.clear.1〕 こおりくん「氷隊、また 一歩 前進だね！ こおり、どんどん 強くなってるよ！」

（エンディングの まんなか）

- 〔version.koori.ending.1〕 こおりくん「氷隊の みんな、ありがとう！ こおり、これからも 氷隊で がんばるよ！」

### 鬼鬼団（主人公が おにおに）

（町の メニューの 上に 日がわりで 1 つ）

- 〔version.onioni.town.1〕 SEタウンの子ども「鬼鬼団だ！ ……ちょっと こわいけど かっこいい！」
- 〔version.onioni.town.2〕 ふるカワ「鬼鬼団の 旗、町の 入り口に かざってもらったよ！ 赤くて 目立つね」
- 〔version.onioni.town.3〕 お店の人「鬼鬼団さん、取り立ては お手やわらかに……」
- 〔version.onioni.town.4〕 ギルドの人「鬼鬼団の 名を 聞くと、悪い 探検隊は 逃げだすらしいぞ」
- 〔version.onioni.town.5〕 こおりくん「鬼鬼団って 名前、やっぱり こわくない？」

（本編の ボスを たおしたあと、毎回 最後に）

- 〔version.onioni.clear.1〕 おにおに「鬼鬼団に 不可能は ない！ つぎへ 行くぞ！」

（エンディングの まんなか）

- 〔version.onioni.ending.1〕 おにおに「鬼鬼団の 初仕事、大成功だな。……おまえら、よく ついてきた」

## 8. クエストの 依頼文（ギルドの 掲示板）

ストーリーの 続きとして 出る 依頼。

### ライバル探検隊（ストーリー クリアのあと）

- 〔quest.rival.hibikimakuri〕 ひびきまくり「月の迷宮の B12F まで、いっしょに 響かせに行こうよ～」
- 〔quest.rival.yamamou〕 やまもぅ「おちょくられないように強くなりたい！ プロテインの粉を 5 個 持ってきて」
- 〔quest.rival.kotani〕 Mr.KOTANI「忍びの屋敷で シュリケンボーを 3 体。成功率は 87.4% です。記録しておきます」
- 〔quest.rival.sasaki〕 Mr.SASAKI「筋肉の山の B15F まで。締め切り厳守です。」
- 〔quest.rival.shibata〕 シバター「撮れ高のために、筋肉の山の マグマッチョを 3 体！ お願い マッスル！ んなああ～」
- 〔quest.rival.ikekimu〕 イケキム「チッ…ASOの壺の底の タカラミミックを 2 体だ。…お宝は 山分けな？」
- 〔quest.rival.maechokkin〕 マエチョッキン「美しさに 磨きをかけたいの。星のかけらを 4 個 ちょうだい♪」
- 〔quest.rival.norahan〕 ノラハン「月の迷宮の ミカヅキバットを 3 体。お宝の 見張りがじゃまなの」
- 〔quest.rival.mazuda〕 マズダ「筋肉の山の ダンベルコングを 3 体。縄張りあらそいだ」
- 〔quest.rival.naitoon〕 NAITOON「月の迷宮の B15F まで、夜の散歩に つきあえ」
- 〔quest.rival.okagappa〕 おかがっぱ「5DX の リーダーとして、勝負だ！ 海岸どうくつの B6F で 待ってるyo！」
- 〔quest.rival.asahara〕 KING.ASAHARA「フハハハ！ ひれ伏すのは どちらか……忍びの屋敷の B10F で 決めようではないか」
- 〔quest.rival.ueno〕 マッスルウエノーブル「お願いマッスルの 主として、筋肉の勝負を 申しこむ！ 我が筋肉の前に ひれ伏すがよい！ 筋肉の山の B12F で 待つ」
- 〔quest.rival.yahami〕 ヤーハミー「チームバータスの リーダーとして、あなたを いただくわ。月の迷宮の B10F でね♪」
- 〔quest.rival.ishii〕 イシイー「ピョンッ！ ケモノミチの 頭として 勝負だ！ ASOの壺の底の B15F だ！」

### 氷隊の 専用クエスト

- 〔quest.vq:kakigoori〕 たむさん「氷隊の　みんなで　かき氷 食べたくない？ 雪どけの氷河の カキゴーラを 3 体 たのむよ」
- 〔quest.vq:hyougaryu〕 ？？？「氷河の B10F で、とけない 氷を 持つ者を 待つ……」（ヒョウガリュウ）
- 〔quest.vq:harukirin〕 ハル麒麟「氷隊の こおりくん、もう一度 春を かけて 勝負だ。雪どけの氷河の B12F で 待つ」

### 鬼鬼団の 専用クエスト

- 〔quest.vq:mamemaki〕 だけさん「鬼鬼団に 豆を まくなんて ゆるせん！ 金色のSE城の セツブンマメを 3 体 たのむ」
- 〔quest.vq:goukioni〕 ゴウキオニ「鬼鬼団に 入りたけりゃ、おれに 勝ってみな！ SE城の B10F で 待つ」
- 〔quest.vq:kinmetsuki〕 金滅鬼「鬼鬼団の おにおに、次は 本気だ！ 金色のSE城の B12F で 待つ」

### めったに 出ない クエスト（ナイテイの きょうだい）

- 〔quest.rare.naitei〕 ？？？「内定が ほしければ、月の迷宮の B14F まで 来るがいい」（シーシャ・ナイテイ・ナイナイ）
- 〔quest.rare.aruaru〕 ？？？「内定の理を 知りたくば、ASOの壺の底の B24F へ」（シーシャ・ナイテイ・アルアル）
- 〔quest.rare.nadi〕 ？？？「オンライン面接の ご案内です。コード塔の B15F に ログインしてください」（ナイテイ・ナナッシャ・ナディ）

## 9. ダンジョンの中の 台詞

### 9.1 ハプニング・決まり文句

`{item}` 道具の名前・`{boss}` ボスの名前・`{team}` ライバル探検隊の名前・`{name}` よみがえった 四天王の名前・`{money}` 取られた お金

（ハプニング：ライバル探検隊が いる階）
- 〔dungeon.rivalNear〕 ハプニング！ ライバル探検隊「{team}」が この階に いるらしい……
（ハプニング：ふるカワから 通信（道具を 送ってくれる））
- 〔dungeon.furukawaGift〕 ふるカワ「がんばってね！ {item}を 送るよ！」
（ふるカワから 通信（持ち物が いっぱい））
- 〔dungeon.furukawaFull〕 ふるカワ「荷物が いっぱいだね。かわりに 階段の場所を 教えるよ！」
（ハプニング：おにおにの 取り立て）
- 〔dungeon.oniCall〕 ハプニング！ おにおにの声「金返せ！」
（取り立てで お金が なかった）
- 〔dungeon.oniEmpty〕 おにおに「……なんだ、持ってないのか」
（ワナ「借金取り」を 踏んだ）
- 〔dungeon.oniTake〕 おにおにの声「金返せ！」 {money}えん 取られた…
（ワナ「借金取り」で お金が なかった）
- 〔dungeon.oniTakeEmpty〕 おにおにの声「金返せ！」 …でも、お金を持っていなかった。
（ドタバタ大迷宮の 休憩の階（台詞が ない 階））
- 〔dungeon.restDefault〕 ふるカワ「休憩の階だよ。ここで ひと休みしよう！」
（大魔王ASO・真が 四天王を 呼ぶ）
- 〔dungeon.shinSummon〕 {boss}「出でよ、四天王！」 {name}が よみがえった！
（ボスが 手下を 呼ぶ）
- 〔dungeon.bossSummon〕 出でよ！
（ライバル探検隊を たおした）
- 〔dungeon.rivalDown〕 {team}「覚えてろ～！」 ライバル探検隊を やっつけた！

### 9.2 口ぐせ（吹き出しで ひとこと）

**こおりくん**

（攻撃したとき）

- 〔catch.koori.attack.1〕 えいっ！
- 〔catch.koori.attack.2〕 こおりの力だ！
- 〔catch.koori.attack.3〕 ていっ！

（ピンチ（HP が 少ない））

- 〔catch.koori.pinch.1〕 こおり生きていけないよ～～！！
- 〔catch.koori.pinch.2〕 ひえ～～！
- 〔catch.koori.pinch.3〕 ひどいちゃむ～～！

（Lv が 上がったとき）

- 〔catch.koori.levelup.1〕 やったー！ 強くなったよ！

（敵を たおしたとき）

- 〔catch.koori.win.1〕 借金返済に 一歩前進！
- 〔catch.koori.win.2〕 よーし！

**おにおに**

（攻撃したとき）

- 〔catch.onioni.attack.1〕 オラァ！
- 〔catch.onioni.attack.2〕 鬼の力を 見せてやる！

（ピンチ（HP が 少ない））

- 〔catch.onioni.pinch.1〕 金返してもらうまで 倒れるか！

（Lv が 上がったとき）

- 〔catch.onioni.levelup.1〕 フン、当然だ。

（敵を たおしたとき）

- 〔catch.onioni.win.1〕 金返せ！
- 〔catch.onioni.win.2〕 ちょろいな。

**やすさん**

（攻撃したとき）

- 〔catch.yasu.attack.1〕 それっ！
- 〔catch.yasu.attack.2〕 やすパンチ！

（ピンチ（HP が 少ない））

- 〔catch.yasu.pinch.1〕 回復しないと…！
- 〔catch.yasu.pinch.2〕 え！？ ピンチですの！？

（Lv が 上がったとき）

- 〔catch.yasu.levelup.1〕 ぼくも 強くなったよ。

（敵を たおしたとき）

- 〔catch.yasu.win.1〕 よかった～

**たむさん**

（攻撃したとき）

- 〔catch.tamu.attack.1〕 止めたるわ！
- 〔catch.tamu.attack.2〕 これで終わりや！ たむキック！

（ピンチ（HP が 少ない））

- 〔catch.tamu.pinch.1〕 しゃーないな…ちょっと まずいわ

（Lv が 上がったとき）

- 〔catch.tamu.levelup.1〕 ええ感じやん

（敵を たおしたとき）

- 〔catch.tamu.win.1〕 ちゃちゃっと 片づけたわ
- 〔catch.tamu.win.2〕 暇つぶしには なったな

**だけさん**

（攻撃したとき）

- 〔catch.dake.attack.1〕 私の 後ろに 下がっていなさい！
- 〔catch.dake.attack.2〕 この鍛え上げたこぶしで…だけチョップ！

（ピンチ（HP が 少ない））

- 〔catch.dake.pinch.1〕 まだまだぁ！

（Lv が 上がったとき）

- 〔catch.dake.levelup.1〕 鍛えた こぶしが 喜んでいる！

（敵を たおしたとき）

- 〔catch.dake.win.1〕 なにが こようと 私が たたきつぶしてあげよう！

**おかがっぱ**

（攻撃したとき）

- 〔catch.okagappa.attack.1〕 おかピポ！ イェア！
- 〔catch.okagappa.attack.2〕 ま～だまだ戦わねバ！

（ピンチ（HP が 少ない））

- 〔catch.okagappa.pinch.1〕 ノリが…足りなかった…イェア…

（Lv が 上がったとき）

- 〔catch.okagappa.levelup.1〕 あ～らあらあらLVあがるおかピポ！

（敵を たおしたとき）

- 〔catch.okagappa.win.1〕 ま～だまだ勝ち取らねバ！

**ひびきまくり**

（攻撃したとき）

- 〔catch.hibikimakuri.attack.1〕 これが４DXだ！
- 〔catch.hibikimakuri.attack.2〕 ここ すっごい ひびくよ～

（ピンチ（HP が 少ない））

- 〔catch.hibikimakuri.pinch.1〕 ひびかなかった～…

（Lv が 上がったとき）

- 〔catch.hibikimakuri.levelup.1〕 もっと 響くように なったよ～

（敵を たおしたとき）

- 〔catch.hibikimakuri.win.1〕 すっごい ひびいたね～

**やまもぅ**

（攻撃したとき）

- 〔catch.yamamou.attack.1〕 牛の力を見せてやる！
- 〔catch.yamamou.attack.2〕 おちょくるなー！ モォー！

（ピンチ（HP が 少ない））

- 〔catch.yamamou.pinch.1〕 人をおちょくるのがうますぎる～

（Lv が 上がったとき）

- 〔catch.yamamou.levelup.1〕 牛に 一歩 近づいた！ モォー！

（敵を たおしたとき）

- 〔catch.yamamou.win.1〕 モォー！ 牛の勝ちだ！

**Mr.SASAKI**

（攻撃したとき）

- 〔catch.sasaki.attack.1〕 締め切り厳守です。
- 〔catch.sasaki.attack.2〕 どうも、しご出来です。

（ピンチ（HP が 少ない））

- 〔catch.sasaki.pinch.1〕 やばいです。

（Lv が 上がったとき）

- 〔catch.sasaki.levelup.1〕 すごいです。

（敵を たおしたとき）

- 〔catch.sasaki.win.1〕 すごいです。
- 〔catch.sasaki.win.2〕 計画どおりです。

**Mr.KOTANI**

（攻撃したとき）

- 〔catch.kotani.attack.1〕 勝率は計算済みです。
- 〔catch.kotani.attack.2〕 数字はうそをつきません。

（ピンチ（HP が 少ない））

- 〔catch.kotani.pinch.1〕 計算外…です…

（Lv が 上がったとき）

- 〔catch.kotani.levelup.1〕 勝率、上昇。記録しておきます。

（敵を たおしたとき）

- 〔catch.kotani.win.1〕 計算どおりです。

**KING.ASAHARA**

（攻撃したとき）

- 〔catch.asahara.attack.1〕 ひれ伏せ！
- 〔catch.asahara.attack.2〕 CS城の主の力、見せてやろう！

（ピンチ（HP が 少ない））

- 〔catch.asahara.pinch.1〕 ぐぬぬ…覚えておれ！

（Lv が 上がったとき）

- 〔catch.asahara.levelup.1〕 フハハハ！ ワシは まだまだ 強くなるぞ！

（敵を たおしたとき）

- 〔catch.asahara.win.1〕 フハハハ！ワシの勝ちだ！

**シバター**

（攻撃したとき）

- 〔catch.shibata.attack.1〕 バーイ！
- 〔catch.shibata.attack.2〕 ぶんぶん！

（ピンチ（HP が 少ない））

- 〔catch.shibata.pinch.1〕 んなああ～…

（Lv が 上がったとき）

- 〔catch.shibata.levelup.1〕 登録者数 アップ！ んなああ～

（敵を たおしたとき）

- 〔catch.shibata.win.1〕 撮れ高いただき！んなああ～

**マッスルウエノーブル**

（攻撃したとき）

- 〔catch.ueno.attack.1〕 この愛を受けてみよ！
- 〔catch.ueno.attack.2〕 我が筋肉の前にひれ伏すがよい！

（ピンチ（HP が 少ない））

- 〔catch.ueno.pinch.1〕 筋肉が…足りなかった…

（Lv が 上がったとき）

- 〔catch.ueno.levelup.1〕 筋肉が また ひとまわり 大きくなった！

（敵を たおしたとき）

- 〔catch.ueno.win.1〕 筋肉は裏切らない！

**イケキム**

（攻撃したとき）

- 〔catch.ikekimu.attack.1〕 すきだらけだ。
- 〔catch.ikekimu.attack.2〕 チッ…邪魔だ。

（ピンチ（HP が 少ない））

- 〔catch.ikekimu.pinch.1〕 い～やとんとんぱんぱんふるしばた～

（Lv が 上がったとき）

- 〔catch.ikekimu.levelup.1〕 ふん、悪くない。

（敵を たおしたとき）

- 〔catch.ikekimu.win.1〕 ふん、こんなものか。

**ヤーハミー**

（攻撃したとき）

- 〔catch.yahami.attack.1〕 美しく いただくわ！
- 〔catch.yahami.attack.2〕 お宝も 視線も、ぜんぶ いただくわ

（ピンチ（HP が 少ない））

- 〔catch.yahami.pinch.1〕 わたしの 美しさに 傷が…！

（Lv が 上がったとき）

- 〔catch.yahami.levelup.1〕 美しさに また 磨きが かかったわ

（敵を たおしたとき）

- 〔catch.yahami.win.1〕 当然の 結果ね

**マエチョッキン**

（攻撃したとき）

- 〔catch.maechokkin.attack.1〕 チョッキン♪
- 〔catch.maechokkin.attack.2〕 きれいに 切りそろえて あげる

（ピンチ（HP が 少ない））

- 〔catch.maechokkin.pinch.1〕 前髪が…そろってない…！

（Lv が 上がったとき）

- 〔catch.maechokkin.levelup.1〕 ハサミの 切れ味 アップ♪

（敵を たおしたとき）

- 〔catch.maechokkin.win.1〕 きれいに そろったわ♪ チョッキン

**ノラハン**

（攻撃したとき）

- 〔catch.norahan.attack.1〕 ニャハッ、いただき♪
- 〔catch.norahan.attack.2〕 すきあり♪

（ピンチ（HP が 少ない））

- 〔catch.norahan.pinch.1〕 ニャッ…ちょっと やばいかも

（Lv が 上がったとき）

- 〔catch.norahan.levelup.1〕 ニャハッ、また 上手に なっちゃった♪

（敵を たおしたとき）

- 〔catch.norahan.win.1〕 お宝も 勝ちも いただき♪

**イシイー**

（攻撃したとき）

- 〔catch.ishii.attack.1〕 ピョンッ！
- 〔catch.ishii.attack.2〕 ダンジョン育ちを なめるな！

（ピンチ（HP が 少ない））

- 〔catch.ishii.pinch.1〕 ピョ…まだまだ跳べる！

（Lv が 上がったとき）

- 〔catch.ishii.levelup.1〕 ピョンッ！ また 強くなった！

（敵を たおしたとき）

- 〔catch.ishii.win.1〕 ピョンッ！ おれたちの 勝ちだ！

**マズダ**

（攻撃したとき）

- 〔catch.mazuda.attack.1〕 ……ふん！
- 〔catch.mazuda.attack.2〕 よそ者は 通さん

（ピンチ（HP が 少ない））

- 〔catch.mazuda.pinch.1〕 ……まだ 倒れん

（Lv が 上がったとき）

- 〔catch.mazuda.levelup.1〕 ……悪くない

（敵を たおしたとき）

- 〔catch.mazuda.win.1〕 ……修行が 足りんな

**NAITOON**

（攻撃したとき）

- 〔catch.naitoon.attack.1〕 ワォーン！
- 〔catch.naitoon.attack.2〕 夜の 迷宮は おれたちの もの

（ピンチ（HP が 少ない））

- 〔catch.naitoon.pinch.1〕 ワ、ワォーン……

（Lv が 上がったとき）

- 〔catch.naitoon.levelup.1〕 月が おれに 力を くれた！ ワォーン！

（敵を たおしたとき）

- 〔catch.naitoon.win.1〕 ワォーン！ 勝利の 遠吠えだ！

**ハリー**

（攻撃したとき）

- 〔catch.harry.attack.1〕 ハリー！
- 〔catch.harry.attack.2〕 メンキョナイー！

（ピンチ（HP が 少ない））

- 〔catch.harry.pinch.1〕 ハ、ハリー…
- 〔catch.harry.pinch.2〕 ム、ムリー…

（Lv が 上がったとき）

- 〔catch.harry.levelup.1〕 ハリー！（強くなった！）

（敵を たおしたとき）

- 〔catch.harry.win.1〕 チッ…ハリー！

**浦の島重蔵**

（攻撃したとき）

- 〔catch.urashima.attack.1〕 えい、けむりじゃ！
- 〔catch.urashima.attack.2〕 わし…なんじゃったかの…

（ピンチ（HP が 少ない））

- 〔catch.urashima.pinch.1〕 つりに…いかねば…

（Lv が 上がったとき）

- 〔catch.urashima.levelup.1〕 ほっほっほ。脳汁が でたわい

（敵を たおしたとき）

- 〔catch.urashima.win.1〕 ふぉっふぉっふぉ…なんじゃったかの

**ダイシ**

（攻撃したとき）

- 〔catch.daishi.attack.1〕 仏の顔も、ここまでです。
- 〔catch.daishi.attack.2〕 くらいなさい。

（ピンチ（HP が 少ない））

- 〔catch.daishi.pinch.1〕 見事…拙僧の負けです。

（Lv が 上がったとき）

- 〔catch.daishi.levelup.1〕 修行の 成果が 出ましたな

（敵を たおしたとき）

- 〔catch.daishi.win.1〕 修行が足りませぬな。

**ズミタニ**

（攻撃したとき）

- 〔catch.zumitani.attack.1〕 ついてこられるかな♪
- 〔catch.zumitani.attack.2〕 どーん！

（ピンチ（HP が 少ない））

- 〔catch.zumitani.pinch.1〕 うそでしょ～！？

（Lv が 上がったとき）

- 〔catch.zumitani.levelup.1〕 また 速く なっちゃった♪

（敵を たおしたとき）

- 〔catch.zumitani.win.1〕 やっぱりその程度か♪

**ルナヤ**

（攻撃したとき）

- 〔catch.runaya.attack.1〕 月の力よ…！
- 〔catch.runaya.attack.2〕 それ！…それ！

（ピンチ（HP が 少ない））

- 〔catch.runaya.pinch.1〕 わたしの 迷宮が…

（Lv が 上がったとき）

- 〔catch.runaya.levelup.1〕 月の 力が 満ちてきたわ。…満ちてきたわ

（敵を たおしたとき）

- 〔catch.runaya.win.1〕 あら、もう終わり？…もう終わり？

**ノゾエマ**

（攻撃したとき）

- 〔catch.nozoema.attack.1〕 この刀を越えてみせよ！
- 〔catch.nozoema.attack.2〕 この筋肉を見よ！

（ピンチ（HP が 少ない））

- 〔catch.nozoema.pinch.1〕 見事な…筋肉だ…

（Lv が 上がったとき）

- 〔catch.nozoema.levelup.1〕 筋肉が 喜んでおる

（敵を たおしたとき）

- 〔catch.nozoema.win.1〕 鍛え方が足りぬ。

**大魔王ASO**

（攻撃したとき）

- 〔catch.maou.attack.1〕 消え去れ！
- 〔catch.maou.attack.2〕 はじけろ！

（ピンチ（HP が 少ない））

- 〔catch.maou.pinch.1〕 ば、ばかな…この我が…！

（Lv が 上がったとき）

- 〔catch.maou.levelup.1〕 最高に！ハイな気分だ！

（敵を たおしたとき）

- 〔catch.maou.win.1〕 我が力、思い知ったか！

**大魔王ASO・真**

（攻撃したとき）

- 〔catch.maoushin.attack.1〕 真の力を 見せてやろう！
- 〔catch.maoushin.attack.2〕 消え去れ！

（ピンチ（HP が 少ない））

- 〔catch.maoushin.pinch.1〕 このASOが…このASOが～！

（Lv が 上がったとき）

- 〔catch.maoushin.levelup.1〕 真の力が 目覚めていく…！

（敵を たおしたとき）

- 〔catch.maoushin.win.1〕 フハハハハハ！ 我こそ 真の 大魔王！

**マキビコンMk-4**

（攻撃したとき）

- 〔catch.makibikon.attack.1〕 排除を開始するであります。
- 〔catch.makibikon.attack.2〕 挑戦者を確認したであります。

（ピンチ（HP が 少ない））

- 〔catch.makibikon.pinch.1〕 システム…ダウン…であります…

（Lv が 上がったとき）

- 〔catch.makibikon.levelup.1〕 なるほどな～。

（敵を たおしたとき）

- 〔catch.makibikon.win.1〕 排除、完了であります。

**奈架多ドラゴン**

（攻撃したとき）

- 〔catch.nakata.attack.1〕 グオオオオ！
- 〔catch.nakata.attack.2〕 グオオオ…（力加減…力加減…）

（ピンチ（HP が 少ない））

- 〔catch.nakata.pinch.1〕 グオ…（まちがえた…）

（Lv が 上がったとき）

- 〔catch.nakata.levelup.1〕 グオ！（介護の 勉強が 実った）

（敵を たおしたとき）

- 〔catch.nakata.win.1〕 グオ！（力加減、成功）

**ゴールド金面犬**

（攻撃したとき）

- 〔catch.goldDog.attack.1〕 ワン！（邪悪な笑み）
- 〔catch.goldDog.attack.2〕 ワン！（自信ありげ）

（ピンチ（HP が 少ない））

- 〔catch.goldDog.pinch.1〕 クゥ～ン…

（Lv が 上がったとき）

- 〔catch.goldDog.levelup.1〕 ワン！（ごきげん）

（敵を たおしたとき）

- 〔catch.goldDog.win.1〕 ワン！（黄金像にしてやった）

**トリプルC**

（攻撃したとき）

- 〔catch.triplec.attack.1〕 コンパイル 開始！
- 〔catch.triplec.attack.2〕 C・C++・C#……すべてを 統べる！

（ピンチ（HP が 少ない））

- 〔catch.triplec.pinch.1〕 エラー…エラー…

（Lv が 上がったとき）

- 〔catch.triplec.levelup.1〕 バージョン アップ 完了！

（敵を たおしたとき）

- 〔catch.triplec.win.1〕 ビルド 成功！

**国士無双ニャン**

（攻撃したとき）

- 〔catch.kokushinyan.attack.1〕 ロンだニャ！
- 〔catch.kokushinyan.attack.2〕 ツモだニャ！

（ピンチ（HP が 少ない））

- 〔catch.kokushinyan.pinch.1〕 テンパイ ならずだニャ…

（Lv が 上がったとき）

- 〔catch.kokushinyan.levelup.1〕 役満に 一歩 近づいたニャ

（敵を たおしたとき）

- 〔catch.kokushinyan.win.1〕 国士無双、あがりだニャ！

**ハリー大帝**

（攻撃したとき）

- 〔catch.harryemperor.attack.1〕 余の トゲを 受けよ！
- 〔catch.harryemperor.attack.2〕 ひれ伏すがよい！

（ピンチ（HP が 少ない））

- 〔catch.harryemperor.pinch.1〕 余が…押されて おるだと…

（Lv が 上がったとき）

- 〔catch.harryemperor.levelup.1〕 余の トゲが また 鋭く なった

（敵を たおしたとき）

- 〔catch.harryemperor.win.1〕 余の 王国に 敵は おらぬ！

**ハル麒麟**

（攻撃したとき）

- 〔catch.harukirin.attack.1〕 春の 風よ！
- 〔catch.harukirin.attack.2〕 溶けて 賢者と なりなさい

（ピンチ（HP が 少ない））

- 〔catch.harukirin.pinch.1〕 春が…とおのく…

（Lv が 上がったとき）

- 〔catch.harukirin.levelup.1〕 春の 力が 満ちて いく

（敵を たおしたとき）

- 〔catch.harukirin.win.1〕 氷は とけ、春が 来る

**金滅鬼**

（攻撃したとき）

- 〔catch.kinmetsuki.attack.1〕 金色の 鬼に ひれ伏せ！
- 〔catch.kinmetsuki.attack.2〕 金の 金棒を 受けよ！

（ピンチ（HP が 少ない））

- 〔catch.kinmetsuki.pinch.1〕 ぐぬぬ……金ピカが はがれる……

（Lv が 上がったとき）

- 〔catch.kinmetsuki.levelup.1〕 金色が いっそう 輝く！

（敵を たおしたとき）

- 〔catch.kinmetsuki.win.1〕 鬼の 中の 鬼は おれだ！

**ヒョウガリュウ**

（攻撃したとき）

- 〔catch.hyougaryu.attack.1〕 氷河の 息吹！
- 〔catch.hyougaryu.attack.2〕 凍てつけ！

（ピンチ（HP が 少ない））

- 〔catch.hyougaryu.pinch.1〕 氷が…とけていく…

（Lv が 上がったとき）

- 〔catch.hyougaryu.levelup.1〕 氷河の 力が 目覚めた

（敵を たおしたとき）

- 〔catch.hyougaryu.win.1〕 氷河に 眠れ

**ゴウキオニ**

（攻撃したとき）

- 〔catch.goukioni.attack.1〕 一番槍、いくぞ！
- 〔catch.goukioni.attack.2〕 オラァ！

（ピンチ（HP が 少ない））

- 〔catch.goukioni.pinch.1〕 まだ 倒れねえ！

（Lv が 上がったとき）

- 〔catch.goukioni.levelup.1〕 鬼鬼団の 一番槍、さらに 強く！

（敵を たおしたとき）

- 〔catch.goukioni.win.1〕 鬼鬼団に 敵なし！

**シーシャ・ナイテイ・ナイナイ**

（攻撃したとき）

- 〔catch.naitei.attack.1〕 お前に内定はない！
- 〔catch.naitei.attack.2〕 内定は……やらん

（ピンチ（HP が 少ない））

- 〔catch.naitei.pinch.1〕 な、内定を…出すしか…

（Lv が 上がったとき）

- 〔catch.naitei.levelup.1〕 内定の 力が 増した

（敵を たおしたとき）

- 〔catch.naitei.win.1〕 不採用だ。

**シーシャ・ナイテイ・アルアル**

（攻撃したとき）

- 〔catch.aruaru.attack.1〕 内定の理を 見せてやろう
- 〔catch.aruaru.attack.2〕 内定とは…

（ピンチ（HP が 少ない））

- 〔catch.aruaru.pinch.1〕 内定の理が…ゆらぐ…

（Lv が 上がったとき）

- 〔catch.aruaru.levelup.1〕 内定の理が 深まった

（敵を たおしたとき）

- 〔catch.aruaru.win.1〕 また 内定を 出しそびれたな

**ナイテイ・ナナッシャ・ナディ**

（攻撃したとき）

- 〔catch.nadi.attack.1〕 オンライン面接、はじめます
- 〔catch.nadi.attack.2〕 志望動機を どうぞ

（ピンチ（HP が 少ない））

- 〔catch.nadi.pinch.1〕 通信が…不安定です…

（Lv が 上がったとき）

- 〔catch.nadi.levelup.1〕 面接官として 成長しました

（敵を たおしたとき）

- 〔catch.nadi.win.1〕 お祈り 申し上げます

### 9.3 敵の ひとこと

会ったとき（ボス・決闘）・化けていたのが ばれたとき・仲間を 呼ぶ／回復する・お金や 道具を 取る・爆発・復活 のときに 出る。図鑑にも のる

**ハリーの森**

- 〔enemy.haribaby〕 ハリベビー「ハリ…！」
- 〔enemy.mumenbachi〕 ムメンキョバチ「メンキョナイー！」
- 〔enemy.donguriko〕 ドングリコ「コロコロ～」
- 〔enemy.nemuridake〕 ネムリダケ「ふぁ～…」
- 〔enemy.pekorisu〕 ペコリス「いただきっ！」
- 〔enemy.tsutankobu〕 ツタンコブ「からまっちゃえ」
- 〔enemy.yofukashi〕 ヨフカシフクロウ「まだ寝ないホー」
- 〔enemy.harry〕 ハリー「ハリー！メンキョナイー！」

**浦の島の海岸どうくつ**

- 〔enemy.kogame〕 コガメ「…（こもる）」
- 〔enemy.tamatebakogani〕 タマテバコガニ「ケムッ！」
- 〔enemy.tsuribariuo〕 ツリバリウオ「つれた～！」
- 〔enemy.isoginchakku〕 イソギンチャック「ジジジ…」
- 〔enemy.otohimedai〕 オトヒメダイ「踊りましょ♪」
- 〔enemy.wasurekurage〕 ワスレクラゲ「なんだっけ…」
- 〔enemy.umibozun〕 ウミボウズン「ぼうず～ん」
- 〔enemy.urashima〕 浦の島重蔵「わしの家に 何の用じゃ…はて、何だったかのう」

**ネット寺**

- 〔enemy.spamdama〕 スパムダマ「おめでとうございます！当選しました！」
- 〔enemy.netkozou〕 ネットコゾウ「ご視聴ありがとうございます」
- 〔enemy.mokugyoro〕 モクギョロ「ポクポクポク…」
- 〔enemy.rousokubi〕 ロウソクビ「ゆら～り」
- 〔enemy.enjoubouzu〕 エンジョウボウズ「炎上上等！」
- 〔enemy.burakrasher〕 ブラクラッシャー「ブツン」
- 〔enemy.hannyamen〕 ハンニャメン「仏の顔も三度まで」
- 〔enemy.daishi〕 ダイシ「よくぞ参られた。拙僧が相手いたそう。」

**忍びの屋敷**

- 〔enemy.geninman〕 ゲニンマン「あ、まだいたんですね～」
- 〔enemy.makibishimushi〕 マキビシムシ「チクチク」
- 〔enemy.kunaisuzume〕 クナイスズメ「チュンッ！」
- 〔enemy.kawarimidanuki〕 カワリミダヌキ「ドロン！」
- 〔enemy.shinobigaeru〕 シノビガエル「ゲロッと参上」
- 〔enemy.shurikenbo〕 シュリケンボー「シュルルル！」
- 〔enemy.bakudanjirou〕 バクダンジロウ「あとはまかせた～！」
- 〔enemy.makibikon〕 マキビコンMk-4「挑戦者を確認したであります。」
- 〔enemy.zumitani〕 ズミタニ「やっほー、78代目だよ！ ついてこられるかな♪」

**月の迷宮**

- 〔enemy.tsukiusagi〕 ツキウサギ「ぺったん！」
- 〔enemy.hoshikuzun〕 ホシクズン「キラッ☆」
- 〔enemy.mikazukibat〕 ミカヅキバット「キキッ」
- 〔enemy.yukimidango〕 ユキミダンゴ「おつきみ～」
- 〔enemy.lunashadow〕 ルナシャドウ「…………」
- 〔enemy.nandomoslime〕 ナンドモスライム「言ったっけ？言ったっけ？」
- 〔enemy.mangetsuwolf〕 マンゲツウルフ「ワォーン！」
- 〔enemy.runaya〕 ルナヤ「よく来たわね。…よく来たわね。あら、もう言ったかしら？」

**筋肉の山**

- 〔enemy.asedakku〕 アセダック「あせあせ！」
- 〔enemy.yoroinukegara〕 ヨロイヌケガラ「ガシャン、ガシャン」
- 〔enemy.dumbbellkong〕 ダンベルコング「ウホッ（ナイスバルク）」
- 〔enemy.mirrormuscle〕 ミラーマッスル「キレてるよ！」
- 〔enemy.magmatcho〕 マグマッチョ「アツい筋肉！」
- 〔enemy.yukidarumuscle〕 ユキダルマッスル「冷えた筋肉も最高だ」
- 〔enemy.proteingolem〕 プロテインゴーレム「タンパク…シツ…」
- 〔enemy.nozoema〕 ノゾエマ「その前に、この筋肉を見よ！」

**ASOの壺の底**

- 〔enemy.asohei〕 アソヘイ「アソ！アソ！」
- 〔enemy.tsubomajin〕 ツボマジン「出でよ！」
- 〔enemy.fusaiyougaikotsu〕 フサイヨウガイコツ「今回はご縁がなかったということで」
- 〔enemy.shakkinbourei〕 シャッキンボウレイ「…かえせ…かえせ…」
- 〔enemy.makibikonmk3〕 マキビコンMk-3「計算中であります…エラーであります」
- 〔enemy.takaramimic〕 タカラミミック「あけたな？」
- 〔enemy.nakatadraco〕 ナカタドラコ「ガオー（加減中）」
- 〔enemy.koorimodoki〕 コオリモドキ「ぼくがほんもののこおりくんだよ」
- 〔enemy.nakata〕 奈架多ドラゴン「グオオオ…（力加減…力加減…）」
- 〔enemy.maou〕 大魔王ASO「よみがえったぞ……今度こそ すべてを 無に返してやる！」

**バグだらけのコード塔**

- 〔enemy.bugmushi〕 バグムシ「ジジッ…エラー…」
- 〔enemy.htmlmokkun〕 HTMLモックン「<モックン>こんにちは</モックン>」
- 〔enemy.popupn〕 ポップアップン「おめでとうございます！！」
- 〔enemy.csspakkun〕 CSSパックン「パックン！ スタイル いただき！」
- 〔enemy.nullpon〕 ヌルポン「ぬるぽ」
- 〔enemy.semicolombo〕 セミコロンボ「うちのカミさんがね…；」
- 〔enemy.loadingu〕 ローディン「しょうしょう おまちください…」
- 〔enemy.c〕 C「すべての はじまりは わたし」
- 〔enemy.phppp〕 PHPPP「echo "ペペペ";」
- 〔enemy.virusn〕 ウイルスン「ぞうしょく します」
- 〔enemy.python〕 パイソン「インデントは 4 マスで おねがいします」
- 〔enemy.javan〕 ジャーバン「コーヒー 一杯 いかがですか」
- 〔enemy.crawlergumo〕 クローラーグモ「ぜんぶ 見てまわるよ」
- 〔enemy.cplus〕 Cプラス「C より ちょっと プラス」
- 〔enemy.csharpn〕 Cシャープン「半音 あげて いきましょう♯」
- 〔enemy.notfound〕 ノットファウンド「404……ここには なにも ない」
- 〔enemy.darts〕 ダーツ・ノリノリコ「ノリノリで いくよ～！」
- 〔enemy.mugenloop〕 ムゲンループ「もういちど もういちど もういちど」
- 〔enemy.spaghettin〕 スパゲッティン「どこが どこに つながってるの…」
- 〔enemy.compiler〕 コンパイラー「ビルド 成功まで あと 99%」
- 〔enemy.firewall〕 ファイアウォール「ここは とおしません」
- 〔enemy.triplec〕 トリプルC「C・C++・C#……すべてを 統べる者！」

**ツモツモ横丁**

- 〔enemy.hakupai〕 ハクパイ「……（なにも 書いてない）」
- 〔enemy.saikoron〕 サイコロン「ころころ～ 何が出るかな」
- 〔enemy.richibou〕 リーチボウ「リーチ！」
- 〔enemy.yopparaigarasu〕 ヨッパライガラス「カァ～～ もう一軒！」
- 〔enemy.chouchinbura〕 チョウチンブラ「ゆら～り ぶら～り」
- 〔enemy.mitsushiro〕 蜜シロー「はちみつ いかが？」
- 〔enemy.umehayashi〕 ウメハヤシ「すっぱいのは がまん」
- 〔enemy.neonkurage〕 ネオンクラゲ「ピカピカ…ビリビリ」
- 〔enemy.yataiman〕 ヤタイマン「へい らっしゃい！」
- 〔enemy.maikumbo〕 マイクンボー「もう一曲 いきます！」
- 〔enemy.gomibakon〕 ゴミバコン「もえるゴミは 火曜日」
- 〔enemy.yoshibook〕 ヨシブック「ヨシ！ 読んだ！」
- 〔enemy.taxinu〕 タクシーヌ「どちらまで？ ワン！」
- 〔enemy.ikolaboo〕 イコラブー「ラブ～～♡」
- 〔enemy.neontanuki〕 ネオンタヌキ「ここは いい お店ですよ～」
- 〔enemy.pachinkodaman〕 パチンコダマン「ジャラジャラ～！」
- 〔enemy.dradora〕 ドラドラ「ドラ ドラ ドラ！」
- 〔enemy.chipguma〕 チップグマ「全部 賭ける！」
- 〔enemy.slotton〕 スロットン「7・7・7 そろえ！」
- 〔enemy.manekinyan〕 マネキニャン「いらっしゃいニャン」
- 〔enemy.tsumonyan〕 ツモニャン「ツモ！ ニャン！」
- 〔enemy.ronnyan〕 ロンニャン「それ ロンだニャン」
- 〔enemy.gachapon〕 ガチャポン「今日は SSR かも！？」
- 〔enemy.kokushinyan〕 国士無双ニャン「十三面待ちだニャ……」

**ハリー王国**

- 〔enemy.koharry〕 コハリー「ちびでも ハリー！」
- 〔enemy.kuriharry〕 クリハリー「いがいが～」
- 〔enemy.harryhei〕 ハリーヘイ「王国を まもれ！」
- 〔enemy.uniharry〕 ウニハリー「うにうに」
- 〔enemy.saboharry〕 サボハリー「水は 月に 1 回で いいの」
- 〔enemy.harryyumi〕 ハリーユミ「ねらい うつ！」
- 〔enemy.harytate〕 ハリタテ「とおさないハリ！」
- 〔enemy.harysouryo〕 ハリソウリョ「トゲの かみさま…」
- 〔enemy.harrychef〕 ハリーシェフ「今日の まかないは トゲ料理」
- 〔enemy.harrybird〕 ハリーバード「トゲの つばさ！」
- 〔enemy.goldharry〕 ゴールドハリー「きんぴか ハリ！」
- 〔enemy.harryknight〕 ハリーナイト「騎士の ほこりに かけて！」
- 〔enemy.harrymage〕 ハリーメイジ「トゲトゲの 呪文！」
- 〔enemy.gargoharry〕 ガーゴハリー「……（いしの ふり）」
- 〔enemy.iwaharry〕 イワハリー「ゴロゴロ…ハリ」
- 〔enemy.haridaijin〕 ハリダイジン「大帝さまの おなりである」
- 〔enemy.harrymimic〕 ハリーミミック「あけたハリ？」
- 〔enemy.haridora〕 ハリドラ「トゲの ドラゴンだハリ！」
- 〔enemy.kingharry〕 キングハリー「余が キングハリーである！」
- 〔enemy.metalharry〕 メタルハリー「キーン」
- 〔enemy.metalkingharry〕 メタルキングハリー「キィィィン……」
- 〔enemy.harryemperor〕 ハリー大帝「余の 王国へ ようこそ。そして さらばだ！」

**雪どけの氷河**

- 〔enemy.yukiusapon〕 ユキウサポン「ぴょん！ ゆきだま ぶつけるぴょん」
- 〔enemy.tsurarabo〕 ツララボウ「ぽたっ……ぽたっ……」
- 〔enemy.kakigoora〕 カキゴーラ「キーンと するよ～」
- 〔enemy.penguinknight〕 ペンギンナイト「騎士の すべりを 見よ！」
- 〔enemy.shirokumatcho〕 シロクマッチョ「さむいほど 筋肉が よろこぶ」
- 〔enemy.yukionnan〕 ユキオンナン「こおりつけ……」
- 〔enemy.sakurarisu〕 サクラリス「もうすぐ 春ですよ～」
- 〔enemy.harukazedori〕 ハルカゼドリ「ピューイ！ 春いちばん！」
- 〔enemy.fukinoton〕 フキノトン「ゆきの したから こんにちは」
- 〔enemy.harukirin〕 ハル麒麟「氷は とけ、春が 来る。それが さだめ」

**金色のSE城**

- 〔enemy.konin〕 コオニン「オニ！ オニ！」
- 〔enemy.aoonibo〕 アオオニボ「あおくて わるいか」
- 〔enemy.kanabone〕 カナボーン「鬼に かなぼう だ！」
- 〔enemy.tsunodaruma〕 ツノダルマ「ころんでも おきあがる」
- 〔enemy.onibin〕 オニビン「ゆら……ゆら……」
- 〔enemy.hyoutanoni〕 ヒョウタンオニ「ひっく……もう いっぱい……」
- 〔enemy.taikooni〕 タイコオニ「ドドン！ カッ！」
- 〔enemy.onigirin〕 オニギリン「のりは パリパリ派」
- 〔enemy.setsubunmame〕 セツブンマメ「おには そと！ ……あれ？」
- 〔enemy.kinmetsuki〕 金滅鬼「金色の 鬼に ひれ伏せ！」

**どこにでも 出る**

- 〔enemy.daichouenkin〕 ダイチョウエンキン「おなか、ぐるぐる～」
- 〔enemy.kinmenkoinu〕 キンメンコイヌ「ワン！（得意げ）」
- 〔enemy.goldDog〕 ゴールド金面犬「ワン！（自信ありげ）」

**ライバル探検隊「5DX」**

- 〔enemy.okagappa〕 おかがっぱ「ま～だまだ戦わねバ！ イェア！」
- 〔enemy.hibikimakuri〕 ひびきまくり「響きです。」
- 〔enemy.yamamou〕 やまもぅ「牛の力を見せてやる！ モォー！」

**ライバル探検隊「ASK-3」**

- 〔enemy.sasaki〕 Mr.SASAKI「どうも、しご出来です。」
- 〔enemy.kotani〕 Mr.KOTANI「勝率は計算済みです。」
- 〔enemy.asahara〕 KING.ASAHARA「CS城の主の力、見せてやろう！ ひれ伏せ！」

**ライバル探検隊「お願いマッスル」**

- 〔enemy.shibata〕 シバター「ぶんぶん！ 撮れ高いただき！ んなああ～」
- 〔enemy.ueno〕 マッスルウエノーブル「我が筋肉の前にひれ伏すがよい！」
- 〔enemy.ikekimu〕 イケキム「チッ…邪魔だ。」

**ライバル探検隊「チームバータス」**

- 〔enemy.yahami〕 ヤーハミー「お宝も 視線も、ぜんぶ いただくわ」
- 〔enemy.maechokkin〕 マエチョッキン「チョッキン♪ 前髪も お宝も 切りそろえて あげる」
- 〔enemy.norahan〕 ノラハン「ニャハッ。盗むのは お宝だけじゃないかもね♪」

**ライバル探検隊「チーム・ケモノミチ」**

- 〔enemy.ishii〕 イシイー「ピョンッ！ 迷宮は おれたちの 家だ！」
- 〔enemy.mazuda〕 マズダ「ダンジョン育ちを なめるなよ」
- 〔enemy.naitoon〕 NAITOON「ワォーン……夜の迷宮で おれに 勝てると 思うなよ」

**ドタバタ大迷宮**

- 〔enemy.maoushin〕 大魔王ASO・真「まだだ……真の力を 見せてやろう！」
- 〔enemy.harigeneral〕 ハリジェネラル「突撃ハリ！」
- 〔enemy.joubachi〕 ジョオウバチ「免許？ 女王には いらないの」
- 〔enemy.oodonguriko〕 オオドングリコ「ゴロゴロゴロ～！」
- 〔enemy.nemuridakeou〕 ネムリダケオウ「おやすみ…みんな…」
- 〔enemy.pekorisuking〕 ペコリスキング「ぜんぶ いただきっ！」
- 〔enemy.tsutankobuju〕 ツタンコブジュ「からめとる…」
- 〔enemy.yoakefukurou〕 ヨアケフクロウ「もう朝だホー」
- 〔enemy.hyougame〕 ヒョウガメ「…（ひえひえ）」
- 〔enemy.ryuuguudai〕 リュウグウダイ「竜宮へ ご案内♪」
- 〔enemy.umibozuou〕 ウミボウズオウ「ぼうず～～ん！！」
- 〔enemy.daienjou〕 ダイエンジョウ「大炎上 上等！」
- 〔enemy.spamking〕 スパムキング「100万人目の お客様です！」
- 〔enemy.hitodamaou〕 ヒトダマオウ「めら～り」
- 〔enemy.jouninman〕 ジョウニンマン「もう いましたよ～」
- 〔enemy.kagebunshin〕 カゲブンシンダヌキ「ドロロン！」
- 〔enemy.daibakudanjirou〕 ダイバクダンジロウ「あとは まかせた～～！！」
- 〔enemy.kaguyausagi〕 カグヤウサギ「月に 帰りますね」
- 〔enemy.shingetsuwolf〕 シンゲツウルフ「アオーーン！」
- 〔enemy.yukimidaifuku〕 ユキミダイフク「ひんやり おつきみ～」
- 〔enemy.muscletitan〕 マッスルタイタン「タンパク…シツ…ゴールド…」
- 〔enemy.kazanmatcho〕 カザンマッチョ「噴火する 筋肉！」
- 〔enemy.hyouzanmuscle〕 ヒョウザンマッスル「冷えきった 筋肉こそ 最強」
- 〔enemy.asoshougun〕 アソショウグン「アソ！ アソ！ 全軍 かかれ！」
- 〔enemy.kinkomimic〕 キンコミミック「あけたな？ 暗証番号は？」
- 〔enemy.koorimodokishin〕 コオリモドキ・真「ぼくこそ ほんもののこおりくんだよ」
- 〔enemy.rishitoribourei〕 リシトリボウレイ「…利子も かえせ…」
- 〔enemy.daichouenou〕 ダイチョウエンオウ「おなか、ぐるぐるぐる～！」
- 〔enemy.fubukipenguin〕 フブキペンギン「ペンペン！」
- 〔enemy.tsuraracomori〕 ツララコウモリ「キキーン」
- 〔enemy.koorinokagami〕 コオリノカガミ「うつってるよ…きみが」
- 〔enemy.hinotorin〕 ヒノトリン「ピヨッ（ぼうぼう）」
- 〔enemy.kaendaruma〕 カエンダルマ「七転び 八起き 大爆発！」
- 〔enemy.youganworm〕 ヨウガンワーム「ズズズ…」
- 〔enemy.mandoragon〕 マンドラゴン「ギャアアア！（抜かないで）」
- 〔enemy.obakekabocha〕 オバケカボチャ「トリック オア トリート！」
- 〔enemy.haetorigusan〕 ハエトリグサーン「パクッ」
- 〔enemy.kokemusha〕 コケムシャ「百年 こけむして 待っておった」
- 〔enemy.tatsumakitsune〕 タツマキツネ「コーン！（ぐるぐる）」
- 〔enemy.kaminarigumo〕 カミナリグモ「ゴロゴロ…ピシャーン！」
- 〔enemy.watageboushi〕 ワタゲボウシ「ふわふわ～」

**クエストで 待っている**

- 〔enemy.naitei〕 シーシャ・ナイテイ・ナイナイ「お前に内定はない！」
- 〔enemy.aruaru〕 シーシャ・ナイテイ・アルアル「内定の理を 見せてやろう」
- 〔enemy.nadi〕 ナイテイ・ナナッシャ・ナディ「オンライン面接、はじめます」
- 〔enemy.hyougaryu〕 ヒョウガリュウ「氷河の 底で 眠っていた……」
- 〔enemy.harukirin_q〕 ハル麒麟「もう一度、春を かけて」
- 〔enemy.goukioni〕 ゴウキオニ「鬼鬼団の 一番槍は おれだ！」
- 〔enemy.kinmetsuki_q〕 金滅鬼「次は 本気だ！」

### 9.4 必殺技（名前と 放つときの ひとこと）

1 人 1 回・チームで 3 回まで（ダンジョンごと）。名前の 行と ひとことの 行の 両方を 書き換えられる。ボス・決闘の 相手は HP が 半分で 1 回 放つ

**こおりくん**（見えている 相手 みんな）
- 〔special.koori.name〕 大腸炎アタック
- 〔special.koori.shout〕 こおりくん「くらえ！ 大腸炎アタック！」

**おにおに**（周り 2 マス）
- 〔special.onioni.name〕 鬼鬼の金棒
- 〔special.onioni.shout〕 おにおに「鬼鬼の金棒、くらえ！」

**やすさん**（正面の 1 体）
- 〔special.yasu.name〕 やすパンチ・極
- 〔special.yasu.shout〕 やすさん「いくよ！ やすパンチ・極！」

**たむさん**（前に まっすぐ つらぬく）
- 〔special.tamu.name〕 たむキック・極
- 〔special.tamu.shout〕 たむさん「これで終わりや！ たむキック・極！」

**だけさん**（正面の 1 体）
- 〔special.dake.name〕 だけチョップ・極
- 〔special.dake.shout〕 だけさん「この鍛え上げたこぶしで…だけチョップ・極！」

**おかがっぱ**（前に まっすぐ つらぬく）
- 〔special.okagappa.name〕 おかピポっと光線
- 〔special.okagappa.shout〕 おかがっぱ「おかピポ！ イェア！」

**ひびきまくり**（見えている 相手 みんな）
- 〔special.hibikimakuri.name〕 大音響4DX
- 〔special.hibikimakuri.shout〕 ひびきまくり「これが４DXだ！」

**やまもぅ**（周り 2 マス）
- 〔special.yamamou.name〕 おちょくりボーンフィーバー
- 〔special.yamamou.shout〕 やまもぅ「おちょくるなー！ モォー！」

**Mr.SASAKI**（前に まっすぐ つらぬく）
- 〔special.sasaki.name〕 ASAスラッシュ
- 〔special.sasaki.shout〕 Mr.SASAKI「締め切り厳守です。」

**Mr.KOTANI**（見えている 相手 みんな）
- 〔special.kotani.name〕 NABIテンポ
- 〔special.kotani.shout〕 Mr.KOTANI「数字は うそを つきません。」

**KING.ASAHARA**（正面の 1 体）
- 〔special.asahara.name〕 DOPAPANCHI
- 〔special.asahara.shout〕 KING.ASAHARA「ひれ伏せ！ DOPAPANCHI！」

**シバター**（正面の 1 体）
- 〔special.shibata.name〕 シバタードライバー
- 〔special.shibata.shout〕 シバター「バーイ！ んなああ～」

**イケキム**（前に まっすぐ つらぬく）
- 〔special.ikekimu.name〕 イケキムドライブ
- 〔special.ikekimu.shout〕 イケキム「すきだらけだ。」

**マッスルウエノーブル**（周り 2 マス）
- 〔special.ueno.name〕 マッスルウエノクラッシュ
- 〔special.ueno.shout〕 マッスルウエノーブル「妻への愛を受けてみよ！」

**ハリー**（周り 2 マス）
- 〔special.harry.name〕 メンキョナイ・ニードル
- 〔special.harry.shout〕 ハリー「メンキョナイー！」

**浦の島重蔵**（見えている 相手 みんな）
- 〔special.urashima.name〕 玉手箱スモーク
- 〔special.urashima.shout〕 浦の島重蔵「えい、けむりじゃ！」

**マキビコンMk-4**（前に まっすぐ つらぬく）
- 〔special.makibikon.name〕 ドリル・エクスキューション
- 〔special.makibikon.shout〕 マキビコンMk-4「排除を開始するであります。」

**奈架多ドラゴン**（前に まっすぐ つらぬく）
- 〔special.nakata.name〕 アクアブレス
- 〔special.nakata.shout〕 奈架多ドラゴン「グオオオオ！」

**ゴールド金面犬**（正面の 1 体）
- 〔special.goldDog.name〕 ゴールドかみまっくす
- 〔special.goldDog.shout〕 ゴールド金面犬「ワン！（邪悪な笑み）」

**ダイシ**（見えている 相手 みんな）
- 〔special.daishi.name〕 鬼面説法
- 〔special.daishi.shout〕 ダイシ「仏の顔も、ここまでです。」

**ズミタニ**（見えている 相手 みんな）
- 〔special.zumitani.name〕 影分身クナイ乱れ打ち
- 〔special.zumitani.shout〕 ズミタニ「ついてこられるかな♪」

**ルナヤ**（見えている 相手 みんな）
- 〔special.runaya.name〕 ルナティック・ムーンビーム
- 〔special.runaya.shout〕 ルナヤ「月の力よ…！ 月の力よ…あら、もう言ったかしら？」

**ノゾエマ**（前に まっすぐ つらぬく）
- 〔special.nozoema.name〕 鏡筋一刀斬り
- 〔special.nozoema.shout〕 ノゾエマ「この刀を越えてみせよ！」

**大魔王ASO**（見えている 相手 みんな）
- 〔special.maou.name〕 亜祖宇激烈破
- 〔special.maou.shout〕 大魔王ASO「消え去れ！」

**大魔王ASO・真**（見えている 相手 みんな）
- 〔special.maoushin.name〕 亜祖宇激烈破・真
- 〔special.maoushin.shout〕 大魔王ASO・真「真の力、思い知れ！ 亜祖宇激烈破・真！」

**トリプルC**（前に まっすぐ つらぬく）
- 〔special.triplec.name〕 トリプル・コンパイル
- 〔special.triplec.shout〕 トリプルC「ビルド開始！ トリプル・コンパイル！」

**国士無双ニャン**（見えている 相手 みんな）
- 〔special.kokushinyan.name〕 国士無双・十三面ロン
- 〔special.kokushinyan.shout〕 国士無双ニャン「十三面待ち……ロンだニャ！」

**ハリー大帝**（周り 2 マス）
- 〔special.harryemperor.name〕 インペリアル・カーブ・ニードル
- 〔special.harryemperor.shout〕 ハリー大帝「余の トゲを 受けよ！」

**ハル麒麟**（見えている 相手 みんな）
- 〔special.harukirin.name〕 春麗
- 〔special.harukirin.shout〕 ハル麒麟「春よ、来たれ！」

**金滅鬼**（周り 2 マス）
- 〔special.kinmetsuki.name〕 金色の金棒
- 〔special.kinmetsuki.shout〕 金滅鬼「金色の 鬼に ひれ伏せ！」

**シーシャ・ナイテイ・ナイナイ**（十字（上下左右に つらぬく）・2 回 当たる）
- 〔special.naitei.name〕 取り消しの二撃
- 〔special.naitei.shout〕 シーシャ・ナイテイ・ナイナイ「お前に内定はない！」

**シーシャ・ナイテイ・アルアル**（見えている 相手 みんな）
- 〔special.aruaru.name〕 内定の一撃
- 〔special.aruaru.shout〕 シーシャ・ナイテイ・アルアル「内定の理を 見せてやろう！」

**ナイテイ・ナナッシャ・ナディ**（周り 2 マス）
- 〔special.nadi.name〕 お祈りの惨劇
- 〔special.nadi.shout〕 ナイテイ・ナナッシャ・ナディ「お祈り 申し上げます」

**ヒョウガリュウ**（前に まっすぐ つらぬく）
- 〔special.hyougaryu.name〕 氷河の咆哮
- 〔special.hyougaryu.shout〕 ヒョウガリュウ「凍てつけ！」

**ゴウキオニ**（前に まっすぐ つらぬく）
- 〔special.goukioni.name〕 豪鬼一番槍
- 〔special.goukioni.shout〕 ゴウキオニ「一番槍、いくぞ！」

**ヤーハミー**（見えている 相手 みんな）
- 〔special.yahami.name〕 傲慢な美しき大強奪
- 〔special.yahami.shout〕 ヤーハミー「お宝も 視線も、ぜんぶ いただくわ！」

**イシイー**（前に まっすぐ つらぬく）
- 〔special.ishii.name〕 ケモノミチ大跳躍
- 〔special.ishii.shout〕 イシイー「ピョンッ！ 跳んで 突撃だ！」

**マエチョッキン**（前に まっすぐ つらぬく）
- 〔special.maechokkin.name〕 前髪そろえ・乱れ切り
- 〔special.maechokkin.shout〕 マエチョッキン「チョッキン♪ ぜんぶ 切りそろえて あげる！」

**ノラハン**（見えている 相手 みんな）
- 〔special.norahan.name〕 ニャハッと大どろぼう
- 〔special.norahan.shout〕 ノラハン「ニャハッ♪ ぜんぶ いただき！」

**マズダ**（周り 2 マス）
- 〔special.mazuda.name〕 ダンジョン育ちの剛拳
- 〔special.mazuda.shout〕 マズダ「ダンジョン育ちを なめるなよ！」

**NAITOON**（見えている 相手 みんな）
- 〔special.naitoon.name〕 月下の遠吠え
- 〔special.naitoon.shout〕 NAITOON「ワォーン！ 夜の迷宮は おれたちの もの！」

**必殺技が ない キャラ（汎用の 必殺技）**：属性 × 役職で 名前が 決まる。エフェクトは 属性、範囲と おまけは 役職で 決まる

（アタッカー：見えている 敵 みんな／ディフェンダー：周り 2 マス＋みんな まもり／ヒーラー：敵 みんな＋みんな 回復／ジャマー：敵 みんな＋状態異常（属性で ちがう）／サポーター：敵 みんな＋みんな きあい）。
ひとことは その キャラの 敵の ときの ひとこと＋技の 名前

- 〔special.generic.こおり.attacker〕 こおり×アタッカー：アイスブリザード
- 〔special.generic.こおり.defender〕 こおり×ディフェンダー：ダイヤモンドダスト・ガード
- 〔special.generic.こおり.healer〕 こおり×ヒーラー：スノーヒーリング
- 〔special.generic.こおり.jammer〕 こおり×ジャマー：フリーズロック
- 〔special.generic.こおり.supporter〕 こおり×サポーター：オーロラエール
- 〔special.generic.ほのお.attacker〕 ほのお×アタッカー：メテオフレイム
- 〔special.generic.ほのお.defender〕 ほのお×ディフェンダー：ブレイズウォール
- 〔special.generic.ほのお.healer〕 ほのお×ヒーラー：ぬくもりの炎
- 〔special.generic.ほのお.jammer〕 ほのお×ジャマー：ヒートヘイズ
- 〔special.generic.ほのお.supporter〕 ほのお×サポーター：ファイアーダンス
- 〔special.generic.みず.attacker〕 みず×アタッカー：タイダルウェーブ
- 〔special.generic.みず.defender〕 みず×ディフェンダー：アクアシールド
- 〔special.generic.みず.healer〕 みず×ヒーラー：いやしの雨
- 〔special.generic.みず.jammer〕 みず×ジャマー：バブルトラップ
- 〔special.generic.みず.supporter〕 みず×サポーター：スプラッシュエール
- 〔special.generic.しぜん.attacker〕 しぜん×アタッカー：リーフストーム
- 〔special.generic.しぜん.defender〕 しぜん×ディフェンダー：ガイアウォール
- 〔special.generic.しぜん.healer〕 しぜん×ヒーラー：森のめぐみ
- 〔special.generic.しぜん.jammer〕 しぜん×ジャマー：ねむりの花畑
- 〔special.generic.しぜん.supporter〕 しぜん×サポーター：ひだまりの歌
- 〔special.generic.かぜ.attacker〕 かぜ×アタッカー：ゲイルストーム
- 〔special.generic.かぜ.defender〕 かぜ×ディフェンダー：つむじ風の盾
- 〔special.generic.かぜ.healer〕 かぜ×ヒーラー：そよ風のいやし
- 〔special.generic.かぜ.jammer〕 かぜ×ジャマー：まどわしの竜巻
- 〔special.generic.かぜ.supporter〕 かぜ×サポーター：おいかぜ
- 〔special.generic.ふしぎ.attacker〕 ふしぎ×アタッカー：ミラクルフラッシュ
- 〔special.generic.ふしぎ.defender〕 ふしぎ×ディフェンダー：ミステリーバリア
- 〔special.generic.ふしぎ.healer〕 ふしぎ×ヒーラー：ふしぎな光
- 〔special.generic.ふしぎ.jammer〕 ふしぎ×ジャマー：ゆめまぼろし
- 〔special.generic.ふしぎ.supporter〕 ふしぎ×サポーター：スターダストエール
- 〔special.generic.ふつう.attacker〕 ふつう×アタッカー：ギガインパクト
- 〔special.generic.ふつう.defender〕 ふつう×ディフェンダー：ガッツストンプ
- 〔special.generic.ふつう.healer〕 ふつう×ヒーラー：げんきの一撃
- 〔special.generic.ふつう.jammer〕 ふつう×ジャマー：ドタバタ大騒ぎ
- 〔special.generic.ふつう.supporter〕 ふつう×サポーター：みんなで応援
