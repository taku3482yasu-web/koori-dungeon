// =====================================================================
// 音 (仕様書 18章 段階 8)。音のファイルは使わず、ブラウザの WebAudio で ピコピコ音を作る
// ---------------------------------------------------------------------
// 効果音: KD.Sound.play('hit') など。BGM: KD.Sound.bgm('town') / bgm(null) で止める。
// ブラウザは、遊ぶ人が一度キーかボタンを押すまで音を出させないので、main.js が unlock() を呼ぶ。
// オン・オフは localStorage に取っておく。WebAudio がない (テスト) ときは 何もしない。
// =====================================================================
(function (KD) {
    'use strict';

    const KEY = 'koori-dungeon-sound';
    // 効果音: [周波数, 長さ (秒), 波形, 終わりの周波数] を つなげて鳴らす
    const SFX = {
        hit: [[220, 0.06, 'square', 110]],
        miss: [[600, 0.05, 'triangle', 900]],
        hurt: [[160, 0.12, 'sawtooth', 70]],
        skill: [[520, 0.05, 'square', 880], [880, 0.08, 'square', 1200]],
        defeat: [[440, 0.06, 'square', 220], [220, 0.12, 'square', 110]],
        levelup: [[523, 0.08, 'square'], [659, 0.08, 'square'], [784, 0.08, 'square'], [1047, 0.2, 'square']],
        pickup: [[880, 0.05, 'triangle'], [1320, 0.08, 'triangle']],
        money: [[1320, 0.04, 'square'], [1760, 0.1, 'square']],
        heal: [[660, 0.08, 'sine', 990], [990, 0.12, 'sine', 1320]],
        stairs: [[392, 0.1, 'triangle'], [330, 0.1, 'triangle'], [262, 0.2, 'triangle']],
        trap: [[300, 0.08, 'sawtooth', 600], [600, 0.12, 'sawtooth', 200]],
        boss: [[110, 0.3, 'sawtooth', 90], [98, 0.4, 'sawtooth', 70]],
        happen: [[784, 0.08, 'square'], [988, 0.08, 'square'], [784, 0.08, 'square']],
        cursor: [[1200, 0.025, 'square']],
        ok: [[880, 0.04, 'square'], [1175, 0.06, 'square']],
        ach: [[1047, 0.08, 'triangle'], [1319, 0.08, 'triangle'], [1568, 0.25, 'triangle']]
    };
    // BGM: 音の高さ (半音。0 = ラ 220Hz、null は休み) を 8 分音符でくり返す。bass は 2 拍ごと
    const SONGS = {
        title: { tempo: 150, lead: [7, 12, 14, 12, 7, 5, 7, null, 3, 5, 7, 12, 10, 7, 5, null], bass: [-17, -17, -12, -14], wave: 'square' },
        town: { tempo: 132, lead: [12, 14, 16, 19, 16, 14, 12, null, 9, 12, 14, 12, 9, 7, 9, null], bass: [-12, -17, -15, -19], wave: 'triangle' },
        forest: { tempo: 120, lead: [0, 3, 7, 3, 5, 3, 0, null, -2, 0, 3, 0, -2, -5, -2, null], bass: [-24, -24, -21, -19], wave: 'triangle' },
        cave: { tempo: 104, lead: [0, null, 3, 5, 3, null, 0, -2, -5, null, -2, 0, -2, null, -5, null], bass: [-24, -26, -29, -26], wave: 'sine' },
        deep: { tempo: 112, lead: [0, 1, 0, -2, 0, 3, 1, null, 0, -2, -4, -2, 0, null, -5, null], bass: [-24, -23, -24, -26], wave: 'square' },
        boss: { tempo: 168, lead: [0, 0, 3, 0, 6, 5, 3, 1, 0, 0, 3, 0, 7, 6, 5, 3], bass: [-24, -24, -21, -18], wave: 'sawtooth' }
    };

    let ctx = null, master = null, enabled = true, current = null, timer = null, step = 0, next = 0;
    try {
        enabled = localStorage.getItem(KEY) !== 'off';
    } catch (e) {
        enabled = true;
    }
    const supported = () => typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);

    // 最初の操作のときに呼ぶ (ブラウザの決まり)
    function unlock() {
        if (!supported()) return;
        if (!ctx) {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            master = ctx.createGain();
            master.gain.value = enabled ? 0.25 : 0;
            master.connect(ctx.destination);
        }
        if (ctx.state === 'suspended') ctx.resume();
        if (current && !timer) startLoop();
    }

    function tone(freq, at, dur, wave, end, vol = 0.5) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = wave;
        o.frequency.setValueAtTime(freq, at);
        if (end) o.frequency.exponentialRampToValueAtTime(end, at + dur);
        g.gain.setValueAtTime(vol, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + dur);
        o.connect(g).connect(master);
        o.start(at);
        o.stop(at + dur + 0.02);
    }

    function play(name) {
        if (!ctx || !enabled || !SFX[name]) return;
        let at = ctx.currentTime;
        SFX[name].forEach(([f, d, w, e]) => {
            tone(f, at, d, w, e, 0.35);
            at += d;
        });
    }

    const hz = n => 220 * Math.pow(2, n / 12);
    // 少し先まで 音を予約しておく (タブが重くても とぎれにくい)
    function startLoop() {
        stopLoop();
        if (!ctx || !current) return;
        step = 0;
        next = ctx.currentTime + 0.05;
        timer = setInterval(() => {
            const song = SONGS[current];
            if (!song) return;
            const beat = 30 / song.tempo;
            while (next < ctx.currentTime + 0.3) {
                const n = song.lead[step % song.lead.length];
                if (n !== null && enabled) tone(hz(n), next, beat * 0.9, song.wave, null, 0.12);
                if (step % 4 === 0 && enabled) tone(hz(song.bass[(step / 4) % song.bass.length]), next, beat * 3.6, 'triangle', null, 0.18);
                next += beat;
                step++;
            }
        }, 100);
    }
    function stopLoop() {
        if (timer) clearInterval(timer);
        timer = null;
    }

    // BGM をかえる (同じなら そのまま)
    function bgm(name) {
        if (name === current) return;
        current = name;
        if (!name) return stopLoop();
        if (ctx) startLoop();
    }

    function toggle() {
        enabled = !enabled;
        try {
            localStorage.setItem(KEY, enabled ? 'on' : 'off');
        } catch (e) { /* 保存できなくても 鳴らす・止めるは できる */ }
        if (master) master.gain.value = enabled ? 0.25 : 0;
        return enabled;
    }

    KD.Sound = { unlock, play, bgm, toggle, isOn: () => enabled, SFX, SONGS };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
