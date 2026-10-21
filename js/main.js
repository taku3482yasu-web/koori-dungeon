// =====================================================================
// 入力 (キーボード・画面のボタン) と、聞く画面 (はい/いいえ)。毎フレーム game.draw を呼ぶ
// ---------------------------------------------------------------------
// 仕様書 15章:
//   移動: 矢印キー・テンキー (斜めはテンキーか、矢印を2つ同時に。Shift を押しているあいだは斜めだけ)
//   ダッシュ: B を押しながら移動 / 向きだけ変える: R を押しながら方向 / 足踏み: Space
//   攻撃・決定: Z・Enter (階段の上なら「降りますか？」) / わざ: 1〜4 / 道具: X (えらぶ画面では戻る) / 作戦: T / 戻る: Esc / ミニマップ: M / 音: S
//   スマホ: 十字ボタン (斜めあり。長押しでダッシュ)・攻撃・道具・作戦・足踏み・ミニマップ・音・わざのボタン
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
        let current = null;   // { options, index, done, onMove }
        function render() {
            choices.innerHTML = '';
            current.options.forEach((label, i) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.textContent = label;
                b.className = i === current.index ? 'on' : '';
                b.addEventListener('pointerdown', e => {
                    e.preventDefault();
                    choose(i);
                });
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
            if (KD.Sound) KD.Sound.play('ok');
            const c = current;
            current = null;
            box.hidden = true;
            c.done(i);
        }
        return {
            // place: 'bottom' で画面の下に出す (主人公をえらぶとき、絵を見せるため)。onMove: えらんでいるものが変わった
            // list: 選ぶものを縦にならべる (わざを忘れるとき)
            ask(message, options, done, { place = 'center', onMove = null, list = false } = {}) {
                current = { options, index: 0, done, onMove };
                text.textContent = message;
                box.className = `ask ${place}${list ? ' list' : ''}`;
                box.hidden = false;
                choices.scrollTop = 0;
                moveTo(0);
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

        // 最初の操作で 音を鳴らせるようにする
        const unlock = () => KD.Sound && KD.Sound.unlock();
        window.addEventListener('pointerdown', unlock);
        window.addEventListener('keydown', e => {
            unlock();
            const k = e.code;
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
            else if (k === 'KeyS' && !e.repeat) game.toggleSound();
            else if (/^(Digit|Numpad)[1-4]$/.test(k) && !e.repeat && !NUMPAD[k]) game.useSkill(Number(k.slice(-1)) - 1);
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
        document.querySelectorAll('[data-dir]').forEach(b => {
            const dir = b.dataset.dir.split(',').map(Number);
            b.addEventListener('pointerdown', e => {
                e.preventDefault();
                if (ask.asking()) return ask.key(dir[1] < 0 ? 'up' : 'down');
                touch = { dir, at: performance.now() };
            });
            const up = () => {
                if (touch && touch.dir === dir) touch = null;
                if (!held.size && !touch) needRelease = false;
            };
            b.addEventListener('pointerup', up);
            b.addEventListener('pointerleave', up);
            b.addEventListener('pointercancel', up);
        });
        const tap = (id, fn) => document.getElementById(id).addEventListener('pointerdown', e => {
            e.preventDefault();
            fn();
        });
        tap('btn-ok', () => (ask.asking() ? ask.key('ok') : game.confirm()));
        tap('btn-wait', () => (ask.asking() ? ask.key('back') : game.wait()));
        tap('btn-map', () => game.toggleMinimap());
        tap('btn-item', () => (ask.asking() ? ask.key('back') : game.itemMenu()));
        tap('btn-tactic', () => (ask.asking() ? ask.key('back') : game.tacticMenu()));
        tap('btn-sound', () => game.toggleSound());

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
                    if (!touch.stepped) {
                        touch.stepped = true;
                        game.moveInput(touch.dir[0], touch.dir[1]);
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
            game.draw(now);
            renderSkills();
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
        window.kdGame = game;   // 確認用 (開発者ツールのコンソールから)
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})(window.KD = window.KD || {});
