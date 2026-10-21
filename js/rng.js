// =====================================================================
// 乱数 (種を決めると同じ結果になる。ダンジョンの形を作り直すときやテストで使う)
// =====================================================================
(function (KD) {
    'use strict';

    KD.createRng = function (seed) {
        let s = (seed >>> 0) || 1;
        // mulberry32
        const next = () => {
            s = (s + 0x6d2b79f5) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        return {
            next,
            chance: p => next() < p,
            int: (a, b) => a + Math.floor(next() * (b - a + 1)),
            pick: list => list[Math.floor(next() * list.length)],
            shuffle(list) {
                const a = list.slice();
                for (let i = a.length - 1; i > 0; i--) {
                    const j = Math.floor(next() * (i + 1));
                    [a[i], a[j]] = [a[j], a[i]];
                }
                return a;
            }
        };
    };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
