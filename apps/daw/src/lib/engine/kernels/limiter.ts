export const LIMITER_KERNELS = `const module0 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

// Wrap { write, flush } into a single callable: write(chunk) → process, write() → flush.
function writer(s) {
  return (chunk) => chunk ? s.write(chunk) : s.flush()
}

function concat(a, b) {
  if (!b || !b.length) return a
  if (!a.length) return b
  let out = new Float32Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

const db2lin = (db) => Math.pow(10, db / 20)

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

// Stereo link, 0 to 1: each channel's level made, in place, link times the loudest channel's plus (1 − link) times its
// own, sample by sample. At 1 every channel reads one level and takes one gain, so linked channels act together when
// one crosses the threshold and the stereo image holds (Jeffs, Holden & Bohn, "Dynamics Processors: Technology &
// Applications", RaneNote 155, 2005, ch. 1). \`lev\`: a Float64Array per channel, \`nc\` channels of \`n\` samples, each the
// level the kernel's gain computer reads (linear); \`at\`: the link in its first slot, the param's own array (a number V8
// passes to a call it does not inline is a new object; Node 20 and 22 did so here as link moved every call).
function link(lev, nc, n, at) {
  let amt = at[0], own = 1 - amt
  for (let i = 0; i < n; i++) {
    let m = lev[0][i]
    for (let c = 1; c < nc; c++) if (lev[c][i] > m) m = lev[c][i]
    for (let c = 0; c < nc; c++) lev[c][i] = amt * m + own * lev[c][i]
  }
}

// dst[i] = db2lin(src[j]), and dst[i] = timeCoef(src[j], sampleRate), their arithmetic written out: the manifests'
// coefficients, with only arrays and indices crossing the call and none made inside it. A number V8 passes to a call it
// does not inline is a new object, and Node 20 and 22 left such calls out of the manifests' process once it read a key
// and linked channels: a block allocated as values moved.
function linAt(dst, i, src, j) { dst[i] = Math.pow(10, src[j] / 20) }
function coefAt(dst, i, src, j, sampleRate) { let ms = src[j]; dst[i] = ms <= 0 ? 0 : Math.exp(-1 / (ms * 0.001 * sampleRate)) }

return { writer, concat, db2lin, timeCoef, link, linAt, coefAt };
})();

const module1 = (() => {
const { writer, concat, db2lin, timeCoef } = module0;

// Lookahead brickwall limiter. Each sample needs the gain r = min(1, ceiling/|x|); the sliding minimum of r
// over the lookahead span (monotonic deque) is the gain every sample in transit needs, and its moving average
// over the same span ramps into each peak across the lookahead instead of stepping at once: every value the
// average spans covers the sample being emitted, so the ramp never lets it past the ceiling (the design of
// the true-peak ceiling in audio's normalize). Exponential release after the peak passes.
//
// \`truePeak\` holds the reconstructed signal under the ceiling, not only its samples (ITU-R BS.1770-4 Annex 2:
// a DAC or a lossy decoder rebuilds the waveform between them, up to 3 dB over the samples). Each interval
// between samples is read at 8 points by a 96-tap Kaiser-windowed sinc (β 8), every local maximum refined by
// the parabola through it and its neighbours: full-band noise limited 20 dB peaks, band-limited, within 0.005 dB
// of the ceiling at 8-48 kHz (read at the Annex's 4 points, 0.03), given 16 samples of lookahead or more (fewer
// ramp the gain faster than the waveform between samples follows: 0.03). A sample's gain covers the intervals on both
// sides; the sliding minimum is widened by the kernel's reach each side, so an interpolant reads all its taps at
// one gain. Output is delayed 48 + lookahead + 48 samples.
const HALF = 48, TAPS = 2 * HALF, BETA = 8, POINTS = 8, G = POINTS / 2, NEAR = 6, BLK = 8, NB = TAPS / BLK + 1
// The points a sample needs are a maximum against the ceiling: an interval is read only where it could pass it, and a
// parabola's vertex rises at most 9/8 over its largest point (\`RISE\`, a hair over: a bound and a read round apart).
// Summed by parts twice about the interval's samples x0, x1, point p/8 is (1 − B)·x0 + B·x1 + Σ e[j]·Δ²x over its taps,
// B ≈ p/8 in (0, 1): at most the larger sample plus Σ|e|·|Δ²x|, tight where the waveform is smooth (Σ|w|·|x| never
// is: the kernel's absolute sum is 2.5-3.1, so bounded by it every sample within 11 dB of the ceiling read all 7
// points). Bounds skip in turn: each 8-sample block of the window at its largest |Δ²x| (\`BEND\`); the nearest taps
// read, the rest bounded so (\`FAR\`), each parabola bounded over what they leave out (\`most\`). What can pass is read
// folded: phases p/8 and 1 − p/8 are mirror images, so taps HALF − 1 − k and HALF + k, as the sum and difference of
// their samples, read both with 2 products (½, its own mirror, with 1): 7 a pair of taps for the 7 points, not 14.
// Ten minutes of speech peaking 0.3 dB over the ceiling: 1 interval in 4000 passes the first bound, 1 in 400000 is
// read in full; limited 6 dB, 1 in 110.
const RISE = 9 / 8 * (1 + 2 ** -20)
// how far a folded point may round from another reading of it: ~1e-14 of Σ|w·x|, under 2^-30 of the ceiling for any
// waveform within 90 dB of it
const SLACK = 2 ** -30
const sinc = x => x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
const i0 = x => { let s = 1, t = 1; for (let k = 1; k < 50; k++) s += t *= (x / 2 / k) ** 2; return s }
// Phase p/8 weighs x[m − HALF + 1 + j] by w[j], j = 0 … TAPS − 1, scaled to sum 1 (m: the interval's first sample). For
// the newest sample n = 8N + r, x[m − HALF + 1 + j] lies in block N + ((r + j + 1 − TAPS) >> 3): FAR[r·NB + i], the most
// Σ|e| past the 2·NEAR nearest taps any phase puts in block N − 12 + i; BEND[i], all taps', the most of any r too. The
// nearest taps' part is a short filter v (taps HALF − 1 − NEAR … HALF + NEAR). Folded (tap HALF − 1 − k with HALF + k),
// k's 7 weights side by side, even and odd of ⅛, ¼, ⅜ and even of ½: FW of w, NW of v (the reads spell out the 7 sums).
const FW = new Float64Array(HALF * 7), NW = new Float64Array((NEAR + 1) * 7)
const BEND = new Float64Array(NB), FAR = new Float64Array(BLK * NB)
for (let p = 1; p < POINTS; p++) {
  let f = p / POINTS, w = new Float64Array(TAPS), sum = 0
  for (let j = 0; j < TAPS; j++) { let x = j + 1 - HALF - f; sum += w[j] = sinc(x) * i0(BETA * Math.sqrt(1 - (x / HALF) ** 2)) / i0(BETA) }
  for (let j = 0; j < TAPS; j++) w[j] /= sum
  let e = new Float64Array(TAPS), v = new Float64Array(TAPS), B = 0
  for (let j = 0; j < TAPS; j++) B += w[j] * (j + 1 - HALF)
  for (let j = 0; j < TAPS; j++) for (let i = 0; i < TAPS; i++) if (j < HALF ? i < j : i > j) e[j] += w[i] * Math.abs(i - j)
  v[HALF - 1] = 1 - B; v[HALF] = B
  for (let j = HALF - NEAR; j < HALF + NEAR; j++) { v[j - 1] += e[j]; v[j] -= 2 * e[j]; v[j + 1] += e[j] }
  for (let r = 0; r < BLK; r++) {
    let b = new Float64Array(NB), c = new Float64Array(NB)
    for (let j = 0; j < TAPS; j++) { let i = ((r + j + 1 - TAPS) >> 3) + NB - 1, a = Math.abs(e[j]); b[i] += a; if (j < HALF - NEAR || j >= HALF + NEAR) c[i] += a }
    for (let i = 0; i < NB; i++) { BEND[i] = Math.max(BEND[i], b[i]); FAR[r * NB + i] = Math.max(FAR[r * NB + i], c[i]) }
  }
  if (p <= G) for (let [W, h, u] of [[FW, HALF, w], [NW, NEAR + 1, v]]) for (let k = 0; k < h; k++) {
    let a = u[HALF - 1 - k], b = u[HALF + k]
    W[k * 7 + 2 * p - 2] = (a + b) / 2
    if (p < G) W[k * 7 + 2 * p - 1] = (a - b) / 2
  }
}
/** Vertex of the parabola through equally spaced l, m, r when m is their maximum, else m. */
const vertex = (l, m, r) => { let c = 2 * m - l - r; return m >= l && m >= r && c > 0 ? m + (l - r) * (l - r) / (8 * c) : m }
/** The most vertex(l, m, r) can be where each of l, m, r may be off by d. */
function most(l, m, r, d) {
  if (m + d < l - d || m + d < r - d) return m + d
  let s = (l < r ? r - l : l - r) + 2 * d, t = 2 * m - l - r - 4 * d
  // past the vertex's own conditions |l − r| ≤ c, so its rise (l − r)²/8c is at most |l − r|/8
  return m + d + (t > s ? s * s / t : s) / 8
}

function limiter(data, opts) {
  if (!(data instanceof Float32Array)) return writer(limiterStream(data))
  let s = limiterStream(opts)
  return concat(s.write(data), s.flush())
}

/** Samples the output trails the input by. */
function latency(opts = {}) {
  let la = Math.max(1, Math.round((opts.lookahead ?? 5) * 0.001 * (opts.sampleRate || 44100)))
  return opts.truePeak ? la + TAPS : la
}

function limiterStream(opts = {}) {
  let line = limiterLine(opts, Float64Array.of(db2lin(opts.ceiling ?? -0.3), timeCoef(opts.release ?? 50, opts.sampleRate || 44100)))
  return {
    write(chunk) {
      let out = new Float32Array(chunk.length), skip = line.run(chunk, out)
      return out.subarray(skip)
    },
    flush() { return line.end() }
  }
}

/** One channel's lookahead line, the core of limiterStream. \`run(x, out)\` limits a block into \`out\` (which may be \`x\`),
 *  allocating nothing once its scratch is as long as the block, \`latency(opts)\` samples late: while the line first
 *  fills nothing comes out (0 there), and it returns how many samples that was. It is \`level(x, lev)\`, each sample's
 *  peak into \`lev\` (Float64Array, as long or longer, linear: |x|, or with truePeak the interval's after it), then
 *  \`apply(x, lev, out)\`, the gain those peaks call for, allocating nothing: between them a peak may come from elsewhere
 *  (the loudest of linked channels). \`end()\` returns what the line still holds (a new array) and empties it. \`set\`,
 *  the ceiling (linear) and the release coefficient, Float64Array(2), read at each block: they may change between blocks. */
function limiterLine(opts = {}, set) {
  let sr = opts.sampleRate || 44100
  let lookahead = opts.lookahead ?? 5
  let tp = !!opts.truePeak

  let laSamp = Math.max(1, Math.round(lookahead * 0.001 * sr))
  let half = tp ? HALF : 0            // the kernel's reach either side of a sample
  let D = laSamp + 2 * half           // delay: the kernel's centre, the lookahead, its reach after

  let buf = new Float32Array(D)       // delay line

  // Monotonic deque: min required gain over the window [m - laSamp - 2·half, m]:
  // the emitted sample and its kernel's reach, through the newest gain known (m = n - half).
  let win = laSamp + 1, Q = win + 2 * half
  let qv = new Float64Array(Q)
  let qn = new Float64Array(Q)        // absolute sample index per entry
  // its moving average over the lookahead
  let avg = new Float64Array(win).fill(1)
  // the samples in (n), the deque's head and tail counters (slots taken mod Q), the average's and the delay line's
  // positions, the samples buffered but not yet emitted, the average's sum, the gain
  let v = Float64Array.of(0, 0, 0, 0, 0, 0, win, 1)

  // true peak: the last LEN samples twice over (h[k..k+LEN) contiguous); each 8-sample block's largest |Δ²x| in a ring
  // of 16, and BEND's sum over the 12 blocks before this one (\`prior\`); where the last two intervals were read near
  // (b1, l1 its ⅞ point within d1) and in full (b2, l2); the points in time order, x[m], ⅛ … ⅞, x[m + 1]. The numbers
  // are in \`w\`: hi (h's position), prior, rPrev, b1, l1, d1, b2, l2; then n and the peak \`need\` leaves for the interval;
  // then the interval's samples |x[m]|, |x[m + 1]| and its peak so far, which near and full read (and full raises)
  let LEN = TAPS + 1, h = tp && new Float64Array(2 * LEN), bend = new Float64Array(16), q = new Float64Array(POINTS + 1)
  let w = Float64Array.of(0, 0, 1, -1, 0, 0, -1, 0, 0, 1, 0, 0, 0)

  // The peak of the interval after sample m = n − HALF, into w[9], read between its samples where it could pass the
  // ceiling (elsewhere the larger of the two, which then cannot); its gain and the interval's before it make the gain m
  // needs (apply). x[n] is src[at], n is w[8].
  function need(src, at) {
    let x = src[at], n = w[8], ceilLin = set[0], hi = w[0] | 0, prior = w[1]
    h[hi] = h[hi + LEN] = x
    hi = hi + 1 === LEN ? 0 : hi + 1
    let o = hi + LEN - 1, t = n - 1, N = n >> 3                      // h[o − k] is x[n − k]
    // Δ²x[n − 1], now that x[n] is in; a block done, the next starts empty
    let e = h[o - 2] - 2 * h[o - 1] + h[o], bk = (t >> 3) & 15
    e = e < 0 ? -e : e
    bend[bk] = (t & 7) === 0 || e > bend[bk] ? e : bend[bk]
    if ((n & 7) === 0) {
      bend[N & 15] = prior = 0
      for (let i = 0; i < NB - 1; i++) prior += BEND[i] * bend[(N + i + 4) & 15]
      w[1] = prior
    }
    let a = h[o - HALF], b = h[o - HALF + 1]                         // x[m], x[m + 1]
    a = a < 0 ? -a : a; b = b < 0 ? -b : b
    let pk = a > b ? a : b
    // the points at most pk + Σ|e|·|Δ²x|; then the nearest taps read, the rest bounded; a sample past the ceiling
    // is read in full, no bound can spare it
    if (RISE * (pk + prior + BEND[NB - 1] * bend[N & 15]) > ceilLin) {
      let rim = RISE * a > ceilLin
      w[10] = a; w[11] = b; w[12] = pk
      if (pk > ceilLin || near(o, rim)) { full(o, rim); pk = w[12] }
    }
    w[0] = hi; w[9] = pk
  }

  /** Whether the interval (x[m], x[m + 1]), x[n] at h[o], could pass the ceiling: the nearest taps read, the rest
   *  bounded, each parabola bounded over what they leave out. */
  function near(o, rim) {
    let n = w[8], ceilLin = set[0], a = w[10], b = w[11], pk = w[12]
    let N = n >> 3, rb = n & 7, dd = SLACK * ceilLin + FAR[rb * NB] * bend[(N + 4) & 15], de = 0
    for (let i = 1, j = rb * NB + 1; i < NB; i += 2, j += 2) { dd += FAR[j] * bend[(N + i + 4) & 15]; de += FAR[j + 1] * bend[(N + i + 5) & 15] }
    dd += de
    let e1 = 0, o1 = 0, e2 = 0, o2 = 0, e3 = 0, o3 = 0, e4 = 0
    for (let k = 0, i = 0; k <= NEAR; k++, i += 7) {
      let u = h[o - HALF - k], v = h[o - HALF + 1 + k], s = u + v, d = u - v
      e1 += NW[i] * s; o1 += NW[i + 1] * d; e2 += NW[i + 2] * s; o2 += NW[i + 3] * d; e3 += NW[i + 4] * s; o3 += NW[i + 5] * d; e4 += NW[i + 6] * s
    }
    points(a, b, e1, o1, e2, o2, e3, o3, e4)
    let top = pk, pass = false
    for (let p = 1; p < POINTS; p++) if (q[p] + dd > top) top = q[p] + dd
    // each parabola, from the one across x[m] (q[0]) when it is on the rim: through the last interval's ⅞ point if that
    // was read near the sample before, else unknown. One call of \`most\` for all, so V8 inlines it (a call it leaves out
    // boxes its numbers)
    if (RISE * top > ceilLin) for (let p = rim ? 0 : 1; p < POINTS && !pass; p++) {
      if (!p && w[3] !== n - 1) pass = true
      else pass = most(p ? q[p - 1] : w[4], q[p], q[p + 1], p ? dd : Math.max(w[5], dd)) > ceilLin
    }
    w[3] = n; w[4] = q[POINTS - 1]; w[5] = dd
    return pass
  }

  /** The interval's peak, all taps read folded, into w[12]. */
  function full(o, rim) {
    let n = w[8], a = w[10], b = w[11], pk = w[12]
    let e1 = 0, o1 = 0, e2 = 0, o2 = 0, e3 = 0, o3 = 0, e4 = 0
    for (let k = 0, i = 0; k < HALF; k++, i += 7) {
      let u = h[o - HALF - k], v = h[o - HALF + 1 + k], s = u + v, d = u - v
      e1 += FW[i] * s; o1 += FW[i + 1] * d; e2 += FW[i + 2] * s; o2 += FW[i + 3] * d; e3 += FW[i + 4] * s; o3 += FW[i + 5] * d; e4 += FW[i + 6] * s
    }
    points(a, b, e1, o1, e2, o2, e3, o3, e4)
    // the ⅞ point of the interval before, read again where it was skipped and could matter (all its taps, folded)
    let l = 0
    if (w[6] === n - 1) l = w[7]
    else if (rim) {
      let e = 0, f = 0
      for (let k = 0, i = 0; k < HALF; k++, i += 7) { let u = h[o - 1 - HALF - k], t = h[o - HALF + k]; e += FW[i] * (u + t); f += FW[i + 1] * (u - t) }
      l = Math.abs(e - f)
    }
    w[6] = n; w[7] = q[POINTS - 1]
    // each parabola, from the one across x[m] (q[0]); one call of \`vertex\` for all, as of \`most\` in near
    for (let p = 0, v; p < POINTS; p++) if ((v = vertex(p ? q[p - 1] : l, q[p], q[p + 1])) > pk) pk = v
    w[12] = pk
  }

  /** q: the interval's points in time order, from the folded sums: p/8 reads e + o, 1 − p/8 reads e − o. */
  function points(a, b, e1, o1, e2, o2, e3, o3, e4) {
    q[0] = a; q[1] = Math.abs(e1 + o1); q[2] = Math.abs(e2 + o2); q[3] = Math.abs(e3 + o3); q[4] = Math.abs(e4)
    q[5] = Math.abs(e3 - o3); q[6] = Math.abs(e2 - o2); q[7] = Math.abs(e1 - o1); q[8] = b
  }

  let lv = new Float64Array(0)
  function run(x, out) {
    if (lv.length < x.length) lv = new Float64Array(x.length)
    level(x, lv)
    return apply(x, lv, out)
  }

  // Each sample's peak: |x|, or the interval's after the sample HALF back
  function level(x, lev) {
    let n = v[0]
    for (let i = 0; i < x.length; i++, n++) {
      if (tp) { w[8] = n; need(x, i); lev[i] = w[9] }
      else { let s = x[i]; lev[i] = s < 0 ? -s : s }
    }
  }

  // Each sample: its gain into the deque and the average, the gain-scaled sample laSamp (and the kernel's reach) back
  // out, or 0 while the delay line is still warming up. With truePeak a sample's gain covers the intervals either side
  // of it: the one after it (its peak in lev) and the one before (the last sample's, rPrev).
  function apply(x, lev, out) {
    let ceilLin = set[0], rCoef = set[1], skip = 0, rPrev = w[2]
    let n = v[0], qh = v[1] | 0, qt = v[2] | 0, ai = v[3] | 0, bi = v[4] | 0, pending = v[5] | 0, sum = v[6], env = v[7]
    // the counters by a whole number of Q less: only their slots mod Q and their difference are read
    let d = qh - qh % Q
    qh -= d; qt -= d
    for (let i = 0; i < x.length; i++) {
      let s = x[i], pk = lev[i], r = pk > ceilLin ? ceilLin / pk : 1
      if (tp) { let rp = rPrev; rPrev = r; if (rp < r) r = rp }
      let m = n - half
      while (qt > qh && qv[(qt - 1) % Q] >= r) qt--
      qv[qt % Q] = r
      qn[qt % Q] = m
      qt++
      if (qn[qh % Q] < m - laSamp - 2 * half) qh++
      let mn = qv[qh % Q]
      sum += mn - avg[ai]; avg[ai] = mn; ai = (ai + 1) % win
      let g = sum / win
      env = g < env ? g : rCoef * env + (1 - rCoef) * g
      n++
      if (pending < D) {
        buf[bi] = s
        bi = (bi + 1) % D
        pending++
        out[i] = 0; skip++
        continue
      }
      let y = buf[bi] * env
      buf[bi] = s
      bi = (bi + 1) % D
      out[i] = y
    }
    v[0] = n; v[1] = qh; v[2] = qt; v[3] = ai; v[4] = bi; v[5] = pending; v[6] = sum; v[7] = env; w[2] = rPrev
    return skip
  }

  return {
    run, level, apply,
    // the \`pending\` samples still in the delay line: zeros through it until they are out
    end() {
      let p = v[5]
      if (!p) return new Float32Array(0)
      let out = new Float32Array(D)
      run(out, out)
      v[5] = 0
      return out.subarray(D - p)
    }
  }
}

return { limiter, latency, limiterStream, limiterLine, default: limiter };
})();

const limiter = (() => {
const { limiterLine, latency } = module1;
const { link, linAt, coefAt } = module0;
// atom manifest — wraps the lookahead brickwall limiter per @audio/compile CONTRACT.
// The delay line emits \`lookahead\` late (and the true-peak kernel's 96 samples); declared latency lets the host compensate
// (audio's plan engine runs cursors ahead, so output lands timeline-aligned). While the line first fills, the block's
// head is silent. \`lookahead\` and \`truePeak\` set the delay, so the latency: they are fixed for an instance (restart).
// \`ceiling\` and \`release\` are live, read each block (recomputed when their value changes), the line's state kept: a new
// ceiling holds the samples that enter from then on; the ones already in the line had their gain ramped for the ceiling
// they entered under. Each channel's line is limiterLine on typed state made here; a block allocates nothing.
// \`link\` mixes each channel's peak toward the loudest channel's (util.js link): every channel's peaks are read before
// any channel's gain, into rows made here by ctx.maxBlockSize; at 1 every channel takes one gain. Each channel still
// holds its own ceiling: the peak its gain reads is never under its own (a true peak the reader leaves unread is under
// the ceiling, and a gain of 1 or less keeps it there). No key: a limiter holds the ceiling of what it reads. At link 0
// the kernel runs as limiterLine's run does, sample for sample.

const limiter = (ctx) => {
	const sr = ctx.sampleRate, lines = [], lev = [], set = new Float64Array(2), at = new Float64Array(2).fill(NaN)
	const opts = { sampleRate: sr, lookahead: ctx.params.lookahead[0], truePeak: ctx.params.truePeak }
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { lines.push(limiterLine(opts, set)); lev.push(new Float64Array(ctx.maxBlockSize)) }
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const ce = params.ceiling[0], r = params.release[0], ln = params.link[0], nc = inp.length
		if (ce !== at[0]) { at[0] = ce; linAt(set, 0, at, 0) }
		if (r !== at[1]) { at[1] = r; coefAt(set, 1, at, 1, sr) }
		for (let c = 0; c < nc; c++) lines[c].level(inp[c], lev[c])
		if (ln > 0 && nc > 1) link(lev, nc, inp[0].length, params.link)
		for (let c = 0; c < nc; c++) lines[c].apply(inp[c], lev[c], out[c])
	}
}
limiter.channels = 'any'
limiter.latency = (ctx) => latency({ lookahead: ctx.params.lookahead[0], sampleRate: ctx.sampleRate, truePeak: ctx.params.truePeak })
limiter.params = {
	ceiling:   { type: 'number', min: -30, max: 0, default: -0.3, unit: 'dB' },
	lookahead: { type: 'number', min: 0.1, max: 20, default: 5, unit: 'ms', restart: true },
	release:   { type: 'number', min: 1, max: 1000, default: 50, unit: 'ms' },
	truePeak:  { type: 'bool', default: false, restart: true },
	link:      { type: 'number', min: 0, max: 1, default: 0, smoothing: 0.01 },
}

return limiter;
})();
`;