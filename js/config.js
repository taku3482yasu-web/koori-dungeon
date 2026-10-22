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
        supabase: { url: 'https://jknmyakxaketocflgsfs.supabase.co', key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprbm15YWt4YWtldG9jZmxnc2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MjE1MjIsImV4cCI6MjEwODE5NzUyMn0.zRgSsOO_sPTg4ery0our2VVzz-P9N0kRKAAfRTLBhE0' }
    };
})(typeof window !== 'undefined' ? (window.KD = window.KD || {}) : globalThis.KD);
