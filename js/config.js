// =====================================================================
// 設定: 交易所の Supabase (README の「交易所をオンラインにする」を見てください)
// ---------------------------------------------------------------------
// url: Supabase の Project URL (例 https://xxxx.supabase.co)
// key: Supabase の anon (public) key。公開してよい鍵です (できることは supabase/schema.sql の関数だけ)
// 空のままなら、交易所の出品はコンピューターの探検隊だけになります。
// =====================================================================
(function (KD) {
    'use strict';

    KD.CONFIG = {
        supabase: { url: '', key: '' }
    };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
