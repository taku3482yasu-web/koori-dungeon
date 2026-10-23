// =====================================================================
// 入力 (キーボード・画面のボタン) と、聞く画面 (はい/いいえ)。毎フレーム game.draw を呼ぶ
// ---------------------------------------------------------------------
// 仕様書 15章:
//   移動: 矢印キー・テンキー (斜めはテンキーか、矢印を2つ同時に。Shift を押しているあいだは斜めだけ)
//   ダッシュ: B を押しながら移動 / 向きだけ変える: R を押しながら方向 / 足踏み: Space / 操作するキャラの交代: C
//   攻撃・決定: Z・Enter (階段の上なら「降りますか？」) / わざ: 1〜6 (6 つは クリア後の 主人公) / 道具: X (えらぶ画面では戻る) / 作戦: T / 戻る: Esc / ミニマップ: M / 音: S
//   スマホ: 十字ボタン (斜めあり。長押しでダッシュ)・攻撃・道具・作戦・足踏み・ミニマップ・音・わざのボタン
//   クリック・タップ (2026-10-22 ユーザー指定): ボタンは 押した瞬間に反応する (すぐ離しても 1 歩動く)。
//     ゲーム画面を押すと、主人公 (画面のまんなか) から見た その方向へ 1 歩。押しっぱなしで 歩きつづける。主人公を押すと 攻撃・決定
// 音はブラウザの決まりで、最初にキーかボタンを押したときから鳴る
// =====================================================================
(function (KD) {
    'use strict';

    const FIRST_DELAY_MS = 60;   // 押しはじめは少し待つ (矢印を2つ同時に押して斜めにするため)
    const LONG_PRESS_MS = 400;   // 画面の十字ボタンの長押しでダッシュ

    // ----- 聞く画面 (はい / いいえ など) -----
    function createAsk(box) {
        const text = box.querySelector('.ask-text');
        const choices = box.querySelector('.ask-choices');
        // 文字を 入れる 欄 (引き継ぎコード)。ask の input を わたしたときだけ 出す
        const input = document.createElement('input');
        Object.assign(input, { className: 'ask-input', type: 'text', autocomplete: 'off', spellcheck: false, hidden: true });
        input.setAttribute('autocapitalize', 'characters');
        box.insertBefore(input, choices);
        let current = null;   // { options, index, done, onMove }
        // 指で 押したとき: 離したときに 決める (指を すべらせたら 一覧の スクロール。2026-10-22 ユーザー指定: 下のほうが 押せない)
        let touchAt = null;   // { id, x, y, i }
        const TAP_SLOP = 10;
        function render() {
            choices.innerHTML = '';
            current.options.forEach((label, i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = label;
                b.className = i === current.index ? 'on' : '';
                b.addEventListener('pointerdown', e => {
                    if (e.pointerType !== 'mouse') {
                        touchAt = { id: e.pointerId, x: e.clientX, y: e.clientY, i };
                        return;
                    }
                    e.preventDefault();
                    choose(i);   // マウスは 押した 瞬間
                });
                b.addEventListener('pointerup', e => {
                    const t = touchAt;
                    touchAt = null;
                    if (!t || t.id !== e.pointerId || t.i !== i) return;
                    if (Math.abs(e.clientX - t.x) > TAP_SLOP || Math.abs(e.clientY - t.y) > TAP_SLOP) return;
                    e.preventDefault();
                    choose(i);
                });
                b.addEventListener('pointercancel', () => { touchAt = null; });   // スクロールが 始まった
                choices.appendChild(b);
            });
            // 縦にならべたとき (道具がたくさん) は、えらんでいるものが見えるように
            const on = choices.querySelector('.on');
            if (!on) return;
            const top = on.offsetTop - choices.offsetTop, bottom = top + on.offsetHeight;
            if (top < choices.scrollTop) choices.scrollTop = top;
            else if (bottom > choices.scrollTop + choices.clientHeight) choices.scrollTop = bottom - choices.clientHeight;
        }
        function moveTo(i) {
            if (current.index !== i && KD.Sound) KD.Sound.play('cursor');
            current.index = i;
            render();
            if (current.onMove) current.onMove(i);
        }
        function choose(i) {
            if (!current || !current.options.length) return;   // 「つないでいます」など えらぶものが ない
            if (KD.Sound) KD.Sound.play('ok');
            const c = current;
            current = null;
            box.hidden = true;
            const value = input.hidden ? undefined : input.value;
            input.blur();
            c.done(i, value);
        }
        return {
            // place: 'bottom' で画面の下に出す (主人公をえらぶとき、絵を見せるため)。onMove: えらんでいるものが変わった
            // list: 選ぶものを縦にならべる (わざを忘れるとき)
            // input: { placeholder, maxLength } で 文字を 入れる 欄を 出す。done(i, 入れた文字)
            // index: はじめに えらんでおく もの
            ask(message, options, done, { place = 'center', onMove = null, list = false, input: field = null, index = 0 } = {}) {
                const start = Math.max(0, Math.min(options.length - 1, index));   // 音の設定で 押したところに 残す
                current = { options, index: start, done, onMove };
                text.textContent = message;
                input.hidden = !field;
                if (field) {
                    Object.assign(input, { value: '', placeholder: field.placeholder || '', maxLength: field.maxLength || 40 });
                    setTimeout(() => input.focus(), 0);
                }
                // long: 長い 名前が ある (道具・クエストなど)。スマホでは 1 列に ならべる
                const long = options.some(o => String(o).length > 9);
                box.className = `ask ${place}${list ? ' list' : ''}${long ? ' long' : ''}`;
                box.hidden = false;
                choices.scrollTop = 0;
                moveTo(start);
            },
            asking: () => Boolean(current),
            key(k) {
                if (!current) return false;
                if (k === 'up' || k === 'down') {
                    const n = current.options.length;
                    moveTo((current.index + (k === 'up' ? n - 1 : 1)) % n);
                } else if (k === 'ok') choose(current.index);
                else if (k === 'back') choose(current.options.length - 1);
                return true;
            }
        };
    }

    const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const NUMPAD = {
        Numpad1: [-1, 1], Numpad2: [0, 1], Numpad3: [1, 1], Numpad4: [-1, 0],
        Numpad6: [1, 0], Numpad7: [-1, -1], Numpad8: [0, -1], Numpad9: [1, -1]
    };

    function start() {
        const ask = createAsk(document.getElementById('ask'));
        const game = KD.createGame(document.getElementById('screen'), ask);
        const held = new Map();     // 押している方向キー → 押した時刻
        let shift = false, dashKey = false, turnKey = false;
        let touch = null;           // 画面の十字ボタン: { dir, at }
        let needRelease = false;    // ダッシュが止まったら、いったん離すまで動かない

        // 押している方向 (矢印は足し合わせて斜めにする)
        function heldDir() {
            let dx = 0, dy = 0;
            for (const code of held.keys()) {
                const d = ARROWS[code] || NUMPAD[code];
                dx += d[0];
                dy += d[1];
            }
            return [Math.sign(dx), Math.sign(dy)];
        }

        // 聞く画面の 場所 (2026-10-22 ユーザー指定: PC では 町の メニューが 町の 絵に 重なる)。
        // ダンジョンの外では ゲーム画面の 外 (横長なら 右の 列、縦長なら 下) の #ask-slot に 移す。ダンジョンでは ゲーム画面に 重ねる。
        // スマホの 縦向きは どちらでも 画面の 下に 出る (style.css)
        const askBox = document.getElementById('ask'), stage = document.querySelector('.stage'), slot = document.getElementById('ask-slot');
        function placeAsk(phase) {
            const home = phase === 'play' || !slot ? stage : slot;
            if (askBox.parentNode !== home) home.appendChild(askBox);
        }
        // 最初の操作で 音を鳴らせるようにする
        const unlock = () => KD.Sound && KD.Sound.unlock();
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', e => {
            unlock();
            const k = e.code;
            // 文字を 入れているときは 打った字を そのまま 入れる (Enter で 決定・Esc で もどる)
            if (e.target && e.target.tagName === 'INPUT') {
                if (e.isComposing) return;
                if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    ask.key(e.key === 'Enter' ? 'ok' : 'back');
                }
                return;
            }
            if (ask.asking()) {
                const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'up', ArrowRight: 'down', KeyZ: 'ok', Enter: 'ok', Space: 'ok', KeyX: 'back', Escape: 'back' };
                if (map[k] && !e.repeat) {
                    e.preventDefault();
                    ask.key(map[k]);
                }
                return;
            }
            if (ARROWS[k] || NUMPAD[k]) {
                e.preventDefault();
                if (!held.has(k)) held.set(k, performance.now());
                return;
            }
            if (k === 'ShiftLeft' || k === 'ShiftRight') shift = true;
            else if (k === 'KeyB') dashKey = true;
            else if (k === 'KeyR') turnKey = true;
            else if (k === 'Space') {
                e.preventDefault();
                game.wait();
            } else if ((k === 'KeyZ' || k === 'Enter') && !e.repeat) game.confirm();
            else if (k === 'KeyM' && !e.repeat) game.toggleMinimap();
            else if (k === 'KeyX' && !e.repeat) game.itemMenu();
            else if (k === 'KeyT' && !e.repeat) game.tacticMenu();
            else if (k === 'KeyC' && !e.repeat) game.switchMenu();   // 操作するキャラの 交代
            else if (k === 'KeyV' && !e.repeat) game.specialMenu();   // 必殺技 (2026-10-22)
            else if (k === 'KeyS' && !e.repeat) game.toggleSound();
            else if (k === 'KeyE' && !e.repeat) game.statusMenu();   // ステータス・装備 (2026-10-23)
            else if (/^(Digit|Numpad)[1-6]$/.test(k) && !e.repeat && !NUMPAD[k]) game.useSkill(Number(k.slice(-1)) - 1);
        });
        window.addEventListener('keyup', e => {
            const k = e.code;
            held.delete(k);
            if (k === 'ShiftLeft' || k === 'ShiftRight') shift = false;
            if (k === 'KeyB') dashKey = false;
            if (k === 'KeyR') turnKey = false;
            if (!held.size && !touch) needRelease = false;
        });
        window.addEventListener('blur', () => {
            held.clear();
            shift = dashKey = turnKey = false;
            touch = null;
        });

        // ----- 画面のボタン -----
        // 押した瞬間に 1 歩 (次の画面の更新を待つと、すぐ離したときに 動かないことがある)
        const pressDir = (dir, extra = {}) => {
            touch = { dir, at: performance.now(), ...extra };
            if (!game.busy() && !needRelease) {
                touch.stepped = true;
                touch.last = touch.at;
                game.moveInput(dir[0], dir[1]);
            }
        };
        document.querySelectorAll('[data-dir]').forEach(b => {
            const dir = b.dataset.dir.split(',').map(Number);
            b.addEventListener('pointerdown', e => {
                e.preventDefault();
                if (ask.asking()) return ask.key(dir[1] < 0 ? 'up' : 'down');
                pressDir(dir);
            });
            const up = () => {
                if (touch && touch.dir === dir) touch = null;
                if (!held.size && !touch) needRelease = false;
            };
            b.addEventListener('pointerup', up);
            b.addEventListener('pointerleave', up);
            b.addEventListener('pointercancel', up);
        });
        // ゲーム画面を クリック・タップ: 主人公から見た方向へ歩く。主人公を押すと 攻撃・決定
        const screen = document.getElementById('screen');
        const screenDir = e => {
            const r = screen.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width * screen.width - screen.width / 2;
            const y = (e.clientY - r.top) / r.height * screen.height - screen.height / 2;
            const tile = screen.width / 24;
            if (Math.abs(x) < tile * 0.7 && Math.abs(y) < tile * 0.7) return null;   // 主人公の上
            const a = Math.round(Math.atan2(y, x) / (Math.PI / 4));
            return [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]][(a + 8) % 8];
        };
        screen.addEventListener('pointerdown', e => {
            if (ask.asking() || !game.state || game.state.phase !== 'play') return;
            e.preventDefault();
            const dir = screenDir(e);
            if (!dir) return game.confirm();
            try { screen.setPointerCapture(e.pointerId); } catch (err) { /* できなくても よい */ }
            pressDir(dir, { screen: true });
        });
        screen.addEventListener('pointermove', e => {
            if (!touch || !touch.screen) return;
            const dir = screenDir(e);
            if (dir) touch.dir = dir;
        });
        const screenUp = () => {
            if (touch && touch.screen) touch = null;
            if (!held.size && !touch) needRelease = false;
        };
        screen.addEventListener('pointerup', screenUp);
        screen.addEventListener('pointercancel', screenUp);

        const tap = (id, fn) => document.getElementById(id).addEventListener('pointerdown', e => {
            e.preventDefault();
            fn();
        });
        tap('btn-ok', () => (ask.asking() ? ask.key('ok') : game.confirm()));
        tap('btn-wait', () => (ask.asking() ? ask.key('back') : game.wait()));
        tap('btn-map', () => game.toggleMinimap());
        tap('btn-item', () => (ask.asking() ? ask.key('back') : game.itemMenu()));
        tap('btn-tactic', () => (ask.asking() ? ask.key('back') : game.tacticMenu()));
        tap('btn-switch', () => (ask.asking() ? ask.key('back') : game.switchMenu()));
        tap('btn-special', () => (ask.asking() ? null : game.specialMenu()));
        tap('btn-sound', () => game.soundMenu());
        tap('btn-status', () => (ask.asking() ? ask.key('back') : game.statusMenu()));

        // ----- わざのボタン (変わったときだけ作り直す) -----
        const skillBox = document.getElementById('skills');
        let skillKey = '';
        function renderSkills() {
            const list = game.skills();
            const key = JSON.stringify(list);
            if (key === skillKey) return;
            skillKey = key;
            skillBox.innerHTML = '';
            list.forEach((s, i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.title = s.note;
                b.innerHTML = `<span class="no">${i + 1}</span><span class="nm"></span><span class="inf"></span><span class="pp"></span>`;
                b.querySelector('.nm').textContent = s.name;
                b.querySelector('.inf').textContent = s.info;
                b.querySelector('.pp').textContent = `PP ${s.pp}`;
                if (s.pp.startsWith('0/') || s.off) b.classList.add('empty');
                b.addEventListener('pointerdown', e => {
                    e.preventDefault();
                    if (!ask.asking()) game.useSkill(i);
                });
                skillBox.appendChild(b);
            });
        }

        // ----- 毎フレーム: 押している方向に動く -----
        function frame(now) {
            if (!game.busy() && !needRelease) {
                if (touch) {
                    // 画面の十字ボタン: 押したら 1 マス。そのまま長押しするとダッシュ
                    // ゲーム画面を押しっぱなし: 歩きつづける (ダッシュはしない)
                    if (!touch.stepped) {
                        touch.stepped = true;
                        game.moveInput(touch.dir[0], touch.dir[1]);
                    } else if (touch.screen) {
                        if (now - touch.at > LONG_PRESS_MS) game.moveInput(touch.dir[0], touch.dir[1]);
                    } else if (now - touch.at > LONG_PRESS_MS) {
                        game.moveInput(touch.dir[0], touch.dir[1], { dashing: true });
                        needRelease = true;
                    }
                } else if (held.size) {
                    // キーボード: 押しているあいだ歩きつづける。B を押しながらならダッシュ (止まったら、いったん離す)
                    let dir = heldDir();
                    if (shift && !(dir[0] && dir[1])) dir = null;   // Shift を押しているあいだは斜めだけ
                    const since = now - Math.min(...held.values());
                    if (dir && (dir[0] || dir[1]) && since >= FIRST_DELAY_MS) {
                        game.moveInput(dir[0], dir[1], { dashing: dashKey, turnOnly: turnKey });
                        if (dashKey) needRelease = true;
                    }
                }
            }
            // 1 回エラーが出ても 止まらないように (止まると ボタンも キーも 効かなくなる)
            try {
                // いまの 場面 (title / select / town / play) を body に 書く。スマホでは ダンジョンの外で 操作ボタンを かくす (style.css)
                const phase = (game.state && game.state.phase) || '';
                if (document.body.dataset.phase !== phase) document.body.dataset.phase = phase;
                placeAsk(phase);
                game.draw(now);
                renderSkills();
            } catch (e) {
                console.error(e);
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        window.kdGame = game;   // 確認用 (開発者ツールのコンソールから)
        // ページを閉じる・ほかのタブに切りかえるときも セーブ (2026-10-22 ユーザー指定)
        const saveNow = () => { try { game.autosave(true); } catch (e) { console.error(e); } };
        window.addEventListener('pagehide', saveNow);
        window.addEventListener('beforeunload', saveNow);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})(window.KD = window.KD || {});
