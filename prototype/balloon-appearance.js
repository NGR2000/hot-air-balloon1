// 気球の球皮パターン(交互/水平/スパイラル/サファイア)+配色(最大4色)
// の純粋ロジック。DOM/three.jsに依存しない(実際のテクスチャ描画はmain.js側、
// ネットワーク越しの送受信はnet.js側が担当する)。仕様の由来・幾何学的な導出根拠は
// 仕様検討メモ.md参照。
import { BALLOON_COLORS } from './net.js';

export const GORES = 16; // buildGoreTexture()と同じゴア(区画)数
export const ENV_Y_SCALE = 1.12; // buildBalloon()のSphereGeometry scale.set(1,1.12,1)と同じ(色選択プレビューの形状にも使う)

// スパイラル(spiral)の傾きの基準: 球の正投影は非線形(cosカーブ)なので、
// 「全長÷ゴア幅」という平均の傾きではなく、局所的な傾きから導出する必要がある
// (平均の傾きを使うと帯の縦幅が横幅の約1.55倍に見えてしまう誤りがあった)
const SPIRAL_TOTAL = (Math.PI * ENV_Y_SCALE) / (2 * Math.sin(Math.PI / GORES));

// サファイア(市松)の分割数。実機(Ultramagic MV-56b)の展開図が24ゴアなので、
// この柄だけゴア数とは独立に24分割で描く(fineSlices/alignSeams参照)
const SAPPHIRE_SLICES = 24;
// 1マスがほぼ正方形に見える段数。SPIRAL_TOTALと同じ考え方(全長÷赤道でのマス幅)を
// 24分割に当てはめると約13.5となり、実機展開図の13段とほぼ一致する
const SAPPHIRE_ROWS = Math.round(
  (Math.PI * ENV_Y_SCALE) / (2 * Math.sin(Math.PI / SAPPHIRE_SLICES)),
);
// 色の境目は水平ではなく、横に一周する間に3回の山谷を描いて上下する。
// 24分割 ÷ 3周期 = 1周期8マスちょうど(割り切れるので継ぎ目で柄が破綻しない)
const SAPPHIRE_PERIODS = 3;
// 山と谷の振幅(段数)。境目がマス目の途中で切れないよう整数段でずらす
const SAPPHIRE_WAVE_ROWS = 2;
// 展開図では上側と下側で柄の位相がずれている。上から6段ぶんは柄をそのまま
// 4マス(=半周期)左へずらすことで、山と谷の位置が上下で入れ替わる
const SAPPHIRE_TOP_ROWS = 6;
const SAPPHIRE_TOP_SHIFT = 4;
// 上から7段目より下(＝ずらさない側の帯)は、柄を2段ぶん下げて描く。
// これで下から2段目・3段目に白の帯が来て、展開図の並びに合う
const SAPPHIRE_LOWER_DROP = 2;

// 0→1→0の三角波(1周期の中央が山の頂上)。展開図の境界線が直線的な
// 山形になっているので、正弦波ではなく三角波を使う
function sapphireWave(slice) {
  const cyc = (slice / SAPPHIRE_SLICES) * SAPPHIRE_PERIODS;
  const frac = cyc - Math.floor(cyc);
  return 1 - Math.abs(2 * frac - 1);
}

export const PATTERN_IDS = ['alt', 'horizontal', 'spiral', 'sapphire'];

// colorIndex(g, v, N): ゴア番号g(0..GORES-1)・縦位置v(0=上, 1=下)・使用色数Nから
// 色スロット番号(0..N-1)を返す純関数
export const PATTERNS = {
  alt: {
    id: 'alt',
    colorIndex: (g, v, N) => g % N,
  },
  horizontal: {
    id: 'horizontal',
    colorIndex: (g, v, N) => Math.min(9, Math.floor(v * 10)) % N,
  },
  spiral: {
    id: 'spiral',
    colorIndex: (g, v, N) => Math.floor(v * SPIRAL_TOTAL + (g / GORES) * N) % N,
  },
  // サファイア: 実機(Ultramagic MV-56b)の展開図と実写を参考にした市松模様。
  // 24ゴア×13段のマス目で、隣り合うマスが必ず違う色になる将棋盤状の市松。
  // ただし全体を2色で塗るのではなく、「使う色のペア」が高さとともにパレット順に
  // 1つずつスライドしていく(下から 白/水色 → 水色/濃い水色 → 濃い水色/青)。
  // これにより、市松の粗い質感を保ったまま全体としては下が明るく上が濃い
  // グラデーションに見える、という実機の柄を再現する。
  //
  // fineSlices: 実際の球皮パネル数(GORES=16)とは独立に、この柄だけ24分割で描く。
  // alignSeams: 市松のマス目は1マス=1ゴアなので、継ぎ目テープもマス目の境界に
  // 合わせて24本引く(16本のままだとマスの途中を継ぎ目が横切って柄が崩れる)
  sapphire: {
    id: 'sapphire',
    fineSlices: SAPPHIRE_SLICES,
    rows: SAPPHIRE_ROWS,
    topRows: SAPPHIRE_TOP_ROWS,
    topShift: SAPPHIRE_TOP_SHIFT,
    lowerDrop: SAPPHIRE_LOWER_DROP,
    alignSeams: true,
    // 開口部を覆う円筒のスカートも、実機同様に球皮の最上段と同じ濃色にする
    // (既定は1色目=最下段の色なので、この柄では白っぽくなってしまう)
    skirtUsesTopColor: true,
    colorIndex: (g, v, N) => {
      if (N <= 1) return 0;
      const rows = SAPPHIRE_ROWS;
      // v=0が球皮の頂点(上)・v=1がスカート側(下)なので「下からの高さ」に直す
      const u = 1 - v;
      const row = Math.min(rows - 1, Math.max(0, Math.floor(u * rows)));
      // 一番下の段(展開図の"Nx")はスカートと同じ最も濃い色でベタ塗りにする
      if (row === 0) return N - 1;
      let slice = Math.floor((g / GORES) * SAPPHIRE_SLICES);
      let patRow = row;
      // 下側の帯が受け持つのは一番下の境目(zone0/1)だけ。上側の境目(zone1/2)は
      // 上の帯(4マスずらす側)が別の位相で描くので、下側で二重に波打たせない
      // よう、下側で届く上限をzone数-2に留める(境目が1つしか無ければ無効)
      let zoneCap = Infinity;
      if (row >= rows - SAPPHIRE_TOP_ROWS) {
        // 上から6段は柄ごと4マス左へずらす(下側とは山谷の位相が逆になる)
        slice = (slice + SAPPHIRE_TOP_SHIFT) % SAPPHIRE_SLICES;
      } else {
        // 上から7段目より下は柄を2段ぶん下げる。ずらす量が偶数なので
        // 市松の偶奇は変わらず、マス目の格子は保たれたまま柄だけが下がる
        patRow = Math.min(rows - 1, row + SAPPHIRE_LOWER_DROP);
        zoneCap = Math.max(0, N - 3);
      }
      // 色ペアの段数。N色なら隣接ペアはN-1通り(0/1, 1/2, 2/3, ...)
      const zones = N - 1;
      // 色ペアの境目だけを三角波で上下させる(市松のマス目自体はずらさない)。
      // 山の頂上では境目が下がり、谷では上がるので、横方向に山谷が3回現れる
      const shift = Math.round(SAPPHIRE_WAVE_ROWS * (sapphireWave(slice) * 2 - 1));
      const zoneRow = Math.min(rows - 1, Math.max(0, patRow + shift));
      const zone = Math.min(zones - 1, zoneCap, Math.floor((zoneRow * zones) / rows));
      const checker = (slice + row) % 2;
      return zone + checker;
    },
  },
};

// ===========================================================================
// カーネル階(パラメータ式の柄)
// ===========================================================================
// 上の PATTERNS は「実機の写真や展開図に合わせて手で調整した柄」の置き場所で、
// 共有コードには番号しか載らない(柄の中身は全プレイヤーのクライアントが持っているため)。
// それに対してこちらは、プレイヤーが自分でパラメータを決めて作る柄。他人のクライアントは
// その柄を知らないので、共有コードにパラメータを全部載せる必要がある。
//
// 数式は上の4パターンから共通形を取り出したもの:
//
//   band = floor(Kv・v + Kg・(g/GORES)) + 波(slice)
//   色   = 割当方式(band, 市松, N)
//
// v=0が球皮の頂点・v=1がスカート側なので、bandは上から下へ増える向きになる。
// 交互(Kv=0, Kg=分割数)・水平(Kv=段数, Kg=0)はこの式で完全に再現でき、
// スパイラルもほぼ同型(Kv=9, Kg=N)になる。サファイアのように上下で位相をずらす等の
// 例外を含む柄は数式に載せず、プリセット階に置いたままにする。
export const CUSTOM_PATTERN = 'custom';

// 横の分割数(描画のマス目と市松の細かさ)。3bitに収まる8通り
export const KERNEL_SLICES = [8, 12, 16, 20, 24, 32, 40, 48];
// 境界線の山谷の周期(一周あたりの山の数)。0=波なし
export const KERNEL_WAVE_PERIODS = [0, 2, 3, 4];
// bandを色番号へ割り当てる方式
//   cycle       : 0,1,2,...,N-1,0,1,... と巡回する(交互・水平・スパイラルと同じ)
//   mirror      : 0,1,...,N-1,N-2,...,1,0 と折り返す(端で色が飛ばない)
//   zone        : 高さ全体を N 等分し、下へ行くほど後ろの色になる(グラデーション)
//   zoneChecker : ゾーンの境目で2色を市松に混ぜる(サファイアと同じ考え方)
export const KERNEL_MAPPINGS = ['cycle', 'mirror', 'zone', 'zoneChecker'];
// 一周で色が何段進むか(=柄の傾き)。符号は巻き方向。
// 'N'/'-N' は「一周でちょうど1巡」という特殊値で、色数を変えても巻きが1周のまま保たれる
export const KERNEL_KG_VALUES = [
  0, 'N', '-N',
  1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6,
  8, -8, 10, -10, 12, -12, 16, -16, 20, -20, 24, -24, 32, -32,
];
// 縦ステップ Kv の上限(5bit)
export const KERNEL_KV_MAX = 31;
// カスタム柄の初期値。スパイラル相当から始めれば、いじる前でも見慣れた柄が出る
export const DEFAULT_KERNEL = {
  slices: 16, kv: 9, kg: 'N', waveAmp: 0, wavePeriods: 0, checker: false, mapping: 'cycle',
};

export const MAX_COLORS = 16;
// 現行(v0)の16進6桁コードに収まる色数。これを超えると自動的に新形式へ切り替わる
const V0_MAX_COLORS = 4;
// ロードテープ(ゴアとゴアをつなぐ縦の継ぎ目テープ)の色。既定は茶色、transparentで非表示
export const TAPE_COLORS = ['brown', 'white', 'transparent'];
// 既定値: 何も選ばなければ現行実装そのまま(赤の濃淡2トーン・茶色のロードテープ)になる
export const DEFAULT_APPEARANCE = { pattern: 'alt', colors: [0], soloFill: false, tape: 'brown' };

function mod(a, n) {
  return ((a % n) + n) % n;
}

function clampInt(v, lo, hi) {
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

// 0→1→0の三角波。sapphireWave()を分割数・周期で一般化したもの
function triWave(slice, slices, periods) {
  const cyc = (slice / slices) * periods;
  const frac = cyc - Math.floor(cyc);
  return 1 - Math.abs(2 * frac - 1);
}

// 'N'/'-N'(一周でちょうど1巡)を実際の色数へ解決する
function resolveKg(kg, n) {
  if (kg === 'N') return n;
  if (kg === '-N') return -n;
  return kg;
}

function clampKernel(k) {
  const src = k || {};
  return {
    slices: KERNEL_SLICES.includes(src.slices) ? src.slices : DEFAULT_KERNEL.slices,
    kv: Number.isFinite(src.kv) ? clampInt(src.kv, 0, KERNEL_KV_MAX) : DEFAULT_KERNEL.kv,
    kg: KERNEL_KG_VALUES.includes(src.kg) ? src.kg : DEFAULT_KERNEL.kg,
    waveAmp: Number.isFinite(src.waveAmp) ? clampInt(src.waveAmp, 0, 3) : DEFAULT_KERNEL.waveAmp,
    wavePeriods: KERNEL_WAVE_PERIODS.includes(src.wavePeriods)
      ? src.wavePeriods : DEFAULT_KERNEL.wavePeriods,
    checker: !!src.checker,
    mapping: KERNEL_MAPPINGS.includes(src.mapping) ? src.mapping : DEFAULT_KERNEL.mapping,
  };
}

// カーネル階の色番号。PATTERNSのcolorIndex(g, v, N)と同じ約束で値を返す
function kernelColorIndex(k, g, v, n) {
  if (n <= 1) return 0;
  const kg = resolveKg(k.kg, n);
  const rows = k.kv;
  const slice = Math.floor((mod(g, GORES) / GORES) * k.slices);
  const wave = k.waveAmp > 0 && k.wavePeriods > 0
    ? Math.round(k.waveAmp * (triWave(slice, k.slices, k.wavePeriods) * 2 - 1))
    : 0;
  const band = Math.floor(v * rows + (g / GORES) * kg) + wave;
  // 市松の段は「柄のマス目」なので、bandではなく縦分割そのものから決める
  const row = rows > 0 ? Math.min(rows - 1, Math.floor(v * rows)) : 0;
  const checker = k.checker ? mod(slice + row, 2) : 0;

  // ゾーン系は巡回させず高さ方向へ引き伸ばす。縦分割が無い(rows=0)ときは
  // 割り算が成立しないので巡回にフォールバックする
  if (rows > 0 && (k.mapping === 'zone' || k.mapping === 'zoneChecker')) {
    if (k.mapping === 'zone') return clampInt(Math.floor((band * n) / rows), 0, n - 1);
    const zone = clampInt(Math.floor((band * (n - 1)) / rows), 0, n - 2);
    return zone + checker;
  }
  if (k.mapping === 'mirror') {
    // 0..N-1..0 の折り返し。周期は 2N-2(N=2なら巡回と同じ動きになる)
    const period = 2 * n - 2;
    if (period > 0) {
      const m = mod(band + checker, period);
      return m < n ? m : period - m;
    }
  }
  return mod(band + checker, n);
}

// カーネルのパラメータから、PATTERNSの要素と同じ形の柄定義を作る。
// main.js側(buildGoreTexture/skirtColorFor)はプリセットかカスタムかを区別せずに
// 扱えるので、描画側の分岐が増えない
function buildKernelPattern(kernel) {
  const k = clampKernel(kernel);
  return {
    id: CUSTOM_PATTERN,
    // 柄のマス目に合わせて描画とロードテープの本数を合わせる(16分割のときは既定のまま)
    fineSlices: k.slices,
    alignSeams: k.slices !== GORES,
    // グラデーション系は下端が最後の色になるので、開口部のスカートもそこへ合わせる
    skirtUsesTopColor: k.mapping === 'zone' || k.mapping === 'zoneChecker',
    colorIndex: (g, v, n) => kernelColorIndex(k, g, v, n),
  };
}

// buildGoreTexture()は1枚のテクスチャを描くのに colorSlotAt() を千回以上呼ぶので、
// 同じカーネルに対して柄定義を作り直さないよう直前の1件だけ覚えておく。
// 判定は7つのフィールドの直接比較で行う(文字列化すると1呼び出しごとに
// 確保が走り、カスタム柄だけプリセットの10倍近く遅くなってしまう)
let kernelCacheSrc = null;
let kernelCacheValue = null;

function sameKernelAsCache(k) {
  const c = kernelCacheSrc;
  return !!c && c.slices === k.slices && c.kv === k.kv && c.kg === k.kg
    && c.waveAmp === k.waveAmp && c.wavePeriods === k.wavePeriods
    && c.checker === k.checker && c.mapping === k.mapping;
}

// 見た目からパターン定義を引く。プリセット階(PATTERNS)とカーネル階のどちらであっても、
// {colorIndex, fineSlices, alignSeams, skirtUsesTopColor} という同じ形が返る
export function resolvePattern(appearance) {
  const app = appearance || DEFAULT_APPEARANCE;
  if (app.pattern !== CUSTOM_PATTERN) return PATTERNS[app.pattern] || PATTERNS.alt;
  const k = app.kernel || DEFAULT_KERNEL;
  if (sameKernelAsCache(k)) return kernelCacheValue;
  // 取りこぼしのときだけ確保する。生の値で覚えておけば、呼び出し側が
  // カーネルを書き換えた場合もきちんと作り直しになる
  kernelCacheSrc = {
    slices: k.slices, kv: k.kv, kg: k.kg, waveAmp: k.waveAmp,
    wavePeriods: k.wavePeriods, checker: k.checker, mapping: k.mapping,
  };
  kernelCacheValue = buildKernelPattern(k);
  return kernelCacheValue;
}

// ===========================================================================
// 共有コードの符号化
// ===========================================================================
// 形式は2つあり、decodeAppearance()が先頭の文字で見分ける:
//
//   v0: 16進6桁。現行の形式。4パターン・4色以内・パレット16色までを表せる
//   v1: 先頭'G' + Crockford Base32。柄のプリセット番号(32種)またはカーネルの
//       パラメータと、最大16色を可変長で表せる
//
// encodeAppearance()は「v0で表せる見た目ならv0のまま出す」ため、既存の共有URLや
// localStorageの値と1文字も変わらない。桁が増えるのは新しい柄や5色目を使ったときだけ。
//
// Base32はCrockford版(I/L/O/Uを除く32文字)。16進の1文字4bitに対し1文字5bitなので
// 同じ情報量なら約25%短く、かつ大文字だけなので口頭でも伝えられる
const B32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const V1_PREFIX = 'G'; // 16進には無くBase32には有る文字なので、旧コードと衝突しない
// v1で一番長くなるのは「カーネル+16色」の20文字。将来の拡張ぶんを見て24文字を上限とし、
// これを超える入力は壊れたコードとして扱う(サーバー側の受け入れ上限と同じ値)
export const MAX_CODE_LENGTH = 24;

function clampColorIndex(i) {
  return Number.isInteger(i) && i >= 0 && i < BALLOON_COLORS.length ? i : 0;
}

function clampAppearance(app) {
  const src = app || {};
  const isCustom = src.pattern === CUSTOM_PATTERN;
  const pattern = isCustom || PATTERN_IDS.includes(src.pattern) ? src.pattern : 'alt';
  const rawColors = Array.isArray(src.colors) && src.colors.length ? src.colors : [0];
  const colors = rawColors.slice(0, MAX_COLORS).map(clampColorIndex);
  const tape = TAPE_COLORS.includes(src.tape) ? src.tape : 'brown';
  const out = { pattern, colors, soloFill: !!src.soloFill, tape };
  if (isCustom) out.kernel = clampKernel(src.kernel);
  return out;
}

function defaultAppearance() {
  return { ...DEFAULT_APPEARANCE, colors: [0] };
}

function pushBits(bits, value, n) {
  for (let i = n - 1; i >= 0; i--) bits.push((value >> i) & 1);
}

function bitsToBase32(bits) {
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    let v = 0;
    for (let j = 0; j < 5; j++) v = (v << 1) | (bits[i + j] || 0);
    out += B32_ALPHABET[v];
  }
  return out;
}

function base32ToBits(s) {
  const bits = [];
  for (const ch of s) {
    const v = B32_ALPHABET.indexOf(ch);
    if (v < 0) return null;
    pushBits(bits, v, 5);
  }
  return bits;
}

// 読み進める側。足りなくなったらnullを返し、呼び出し側が既定値へ落とす
function makeBitReader(bits) {
  let at = 0;
  return (n) => {
    if (at + n > bits.length) return null;
    let v = 0;
    for (let i = 0; i < n; i++) v = (v << 1) | bits[at + i];
    at += n;
    return v;
  };
}

// v0(16進6桁)で表せるか。プリセットの4パターン・4色以内が条件
function fitsV0(app) {
  return app.pattern !== CUSTOM_PATTERN
    && PATTERN_IDS.indexOf(app.pattern) >= 0
    && PATTERN_IDS.indexOf(app.pattern) < 4
    && app.colors.length <= V0_MAX_COLORS;
}

// v0: bit0-1: パターン, bit2-3: 色数-1, bit4: 単色時の塗り潰しフラグ,
// bit5-8/9-12/13-16/17-20: 色1〜4のパレット番号(各4bit、BALLOON_COLORS.length<=16前提),
// bit21-22: ロードテープの色(0=茶,1=白,2=透明)
function encodeV0(app) {
  const patternIdx = Math.max(0, PATTERN_IDS.indexOf(app.pattern));
  const n = app.colors.length;
  let code = patternIdx | ((n - 1) << 2) | ((app.soloFill ? 1 : 0) << 4);
  for (let i = 0; i < V0_MAX_COLORS; i++) {
    code |= clampColorIndex(app.colors[i] ?? app.colors[0]) << (5 + i * 4);
  }
  code |= TAPE_COLORS.indexOf(app.tape) << 21;
  return code.toString(16).toUpperCase().padStart(6, '0');
}

function decodeV0(hex) {
  const code = parseInt(hex, 16);
  if (!Number.isFinite(code)) return defaultAppearance();
  const patternIdx = code & 0b11;
  const n = ((code >> 2) & 0b11) + 1;
  const soloFill = !!((code >> 4) & 1);
  const colors = [];
  for (let i = 0; i < n; i++) colors.push(clampColorIndex((code >> (5 + i * 4)) & 0b1111));
  const tape = TAPE_COLORS[(code >> 21) & 0b11] || 'brown';
  return { pattern: PATTERN_IDS[patternIdx] || 'alt', colors, soloFill, tape };
}

// v1: [1bit 階層] + (プリセット5bit | カーネル20bit) + [塗り潰し1bit] +
//     [テープ2bit] + [色数-1 4bit] + [色 4bit × 色数]
function encodeV1(app) {
  const bits = [];
  const isCustom = app.pattern === CUSTOM_PATTERN;
  pushBits(bits, isCustom ? 1 : 0, 1);
  if (isCustom) {
    const k = app.kernel;
    pushBits(bits, KERNEL_SLICES.indexOf(k.slices), 3);
    pushBits(bits, k.kv, 5);
    pushBits(bits, KERNEL_KG_VALUES.indexOf(k.kg), 5);
    pushBits(bits, k.waveAmp, 2);
    pushBits(bits, KERNEL_WAVE_PERIODS.indexOf(k.wavePeriods), 2);
    pushBits(bits, k.checker ? 1 : 0, 1);
    pushBits(bits, KERNEL_MAPPINGS.indexOf(k.mapping), 2);
  } else {
    pushBits(bits, Math.max(0, PATTERN_IDS.indexOf(app.pattern)), 5);
  }
  pushBits(bits, app.soloFill ? 1 : 0, 1);
  pushBits(bits, TAPE_COLORS.indexOf(app.tape), 2);
  pushBits(bits, app.colors.length - 1, 4);
  for (const c of app.colors) pushBits(bits, c, 4);
  return V1_PREFIX + bitsToBase32(bits);
}

// 復号できなければnullを返す(呼び出し側が既定値へ落とすか、入力エラーとして扱う)
function decodeV1(code) {
  const bits = base32ToBits(code.slice(V1_PREFIX.length));
  if (!bits) return null;
  let used = 0;
  const reader = makeBitReader(bits);
  const read = (n) => { const v = reader(n); if (v !== null) used += n; return v; };
  const tier = read(1);
  if (tier === null) return null;

  let pattern = 'alt';
  let kernel = null;
  if (tier === 1) {
    const slices = read(3);
    const kv = read(5);
    const kgIdx = read(5);
    const waveAmp = read(2);
    const wavePeriods = read(2);
    const checker = read(1);
    const mapping = read(2);
    if (mapping === null) return null;
    pattern = CUSTOM_PATTERN;
    kernel = clampKernel({
      slices: KERNEL_SLICES[slices],
      kv,
      kg: KERNEL_KG_VALUES[kgIdx],
      waveAmp,
      wavePeriods: KERNEL_WAVE_PERIODS[wavePeriods],
      checker: !!checker,
      mapping: KERNEL_MAPPINGS[mapping],
    });
  } else {
    const presetIdx = read(5);
    if (presetIdx === null) return null;
    // 手元のクライアントが知らない新しいプリセット番号は、既定の柄として描く
    pattern = PATTERN_IDS[presetIdx] || 'alt';
  }

  const soloFill = read(1);
  const tapeIdx = read(2);
  const nMinus1 = read(4);
  if (nMinus1 === null) return null;
  const colors = [];
  for (let i = 0; i <= nMinus1; i++) {
    const c = read(4);
    if (c === null) return null;
    colors.push(clampColorIndex(c));
  }
  // 末尾に丸ごと1文字ぶん以上の余りがあるコードは、打ち間違い・途中で余計な文字が
  // 付いたものとみなして受け付けない(Base32の端数埋めは最大4bitしか出ないため)
  if (bits.length - used >= 5) return null;
  const out = {
    pattern, colors, soloFill: !!soloFill, tape: TAPE_COLORS[tapeIdx] || 'brown',
  };
  if (kernel) out.kernel = kernel;
  return out;
}

// 見た目を共有コードへエンコードする。共有URLやテキストでの再入力用。
// 現行の4パターン・4色以内なら今まで通りの16進6桁になり、それを超えるときだけ
// 'G'で始まる可変長コードになる
export function encodeAppearance(appearance) {
  const app = clampAppearance(appearance);
  return fitsV0(app) ? encodeV0(app) : encodeV1(app);
}

// コード文字列を見た目へ変換する。読めなければnullを返す
function parseCode(code) {
  if (typeof code !== 'string') return null;
  // Crockfordの読み替え(I/L→1、O→0)を先に済ませてから判定する
  const s = code.trim().toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0');
  if (!s || s.length > MAX_CODE_LENGTH) return null;
  if (/^[0-9A-F]{1,6}$/.test(s)) return decodeV0(s);
  if (s.length > 1 && s[0] === V1_PREFIX && /^[0-9A-Z]+$/.test(s)) return decodeV1(s);
  return null;
}

// 共有コードから見た目をデコードする。不正な値は既定(赤の濃淡2トーン・茶色)にフォールバックする
export function decodeAppearance(code) {
  return parseCode(code) || defaultAppearance();
}

// コード入力欄の検証用。decodeAppearance()は必ず何かを返すので、
// 「打ち間違いなのか、本当にその見た目なのか」はこちらで判定する
export function isValidAppearanceCode(code) {
  return parseCode(code) !== null;
}

// ゴアg・縦位置vにおける「色スロット番号」(0..N-1)を返す。N===1のときは常に0
// (呼び出し側=main.jsが単色の濃淡/塗り潰しを別途処理する)
export function colorSlotAt(appearance, g, v) {
  const n = appearance.colors.length;
  if (n <= 1) return 0;
  const pat = resolvePattern(appearance);
  return mod(pat.colorIndex(g, v, n), n);
}
