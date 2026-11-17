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

return { writer, concat, db2lin, timeCoef };
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
  let sr = opts.sampleRate || 44100
  let ceiling = opts.ceiling ?? -0.3
  let lookahead = opts.lookahead ?? 5
  let releaseMs = opts.release ?? 50
  let tp = !!opts.truePeak

  let ceilLin = db2lin(ceiling)
  let laSamp = Math.max(1, Math.round(lookahead * 0.001 * sr))
  let rCoef = timeCoef(releaseMs, sr)
  let half = tp ? HALF : 0            // the kernel's reach either side of a sample
  let D = laSamp + 2 * half           // delay: the kernel's centre, the lookahead, its reach after

  let buf = new Float32Array(D)       // delay line
  let bi = 0
  let pending = 0                     // samples buffered but not yet emitted
  let env = 1

  // Monotonic deque: min required gain over the window [m - laSamp - 2·half, m]:
  // the emitted sample and its kernel's reach, through the newest gain known (m = n - half).
  let win = laSamp + 1, Q = win + 2 * half
  let qv = new Float64Array(Q)
  let qn = new Float64Array(Q)        // absolute sample index per entry
  let qh = 0, qt = 0                  // head/tail counters, slots taken mod Q
  // its moving average over the lookahead
  let avg = new Float64Array(win).fill(1), sum = win, ai = 0
  let n = 0

  // true peak: the last LEN samples twice over (h[k..k+LEN) contiguous); each 8-sample block's largest |Δ²x| in a ring
  // of 16, and BEND's sum over the 12 blocks before this one (\`prior\`); where the last two intervals were read near
  // (b1, l1 its ⅞ point within d1) and in full (b2, l2); the points in time order, x[m], ⅛ … ⅞, x[m + 1]
  let LEN = TAPS + 1, h = tp && new Float64Array(2 * LEN), hi = 0, bend = new Float64Array(16), prior = 0, rPrev = 1
  let b1 = -1, l1 = 0, d1 = 0, b2 = -1, l2 = 0, q = new Float64Array(POINTS + 1)

  // The gain sample m = n − HALF needs: x[m] and the intervals either side read between.
  function need(x) {
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
    }
    let a = h[o - HALF], b = h[o - HALF + 1]                         // x[m], x[m + 1]
    a = a < 0 ? -a : a; b = b < 0 ? -b : b
    let pk = a > b ? a : b
    // the points at most pk + Σ|e|·|Δ²x|; then the nearest taps read, the rest bounded; a sample past the ceiling
    // is read in full, no bound can spare it
    if (RISE * (pk + prior + BEND[NB - 1] * bend[N & 15]) > ceilLin) {
      let rim = RISE * a > ceilLin
      if (pk > ceilLin || near(o, a, b, pk, rim)) pk = full(o, a, b, pk, rim)
    }
    // the interval after m is this one, the one before it the last call's
    let r = pk > ceilLin ? ceilLin / pk : 1, g = r < rPrev ? r : rPrev
    rPrev = r
    return g
  }

  /** Whether the interval (x[m], x[m + 1]), x[n] at h[o], could pass the ceiling: the nearest taps read, the rest
   *  bounded, each parabola bounded over what they leave out. */
  function near(o, a, b, pk, rim) {
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
    if (RISE * top > ceilLin) {
      pass = rim && (b1 !== n - 1 || most(l1, a, q[1], Math.max(d1, dd)) > ceilLin)
      for (let p = 1; p < POINTS && !pass; p++) pass = most(q[p - 1], q[p], q[p + 1], dd) > ceilLin
    }
    b1 = n; l1 = q[POINTS - 1]; d1 = dd
    return pass
  }

  /** The interval's peak, all taps read folded. */
  function full(o, a, b, pk, rim) {
    let e1 = 0, o1 = 0, e2 = 0, o2 = 0, e3 = 0, o3 = 0, e4 = 0
    for (let k = 0, i = 0; k < HALF; k++, i += 7) {
      let u = h[o - HALF - k], v = h[o - HALF + 1 + k], s = u + v, d = u - v
      e1 += FW[i] * s; o1 += FW[i + 1] * d; e2 += FW[i + 2] * s; o2 += FW[i + 3] * d; e3 += FW[i + 4] * s; o3 += FW[i + 5] * d; e4 += FW[i + 6] * s
    }
    points(a, b, e1, o1, e2, o2, e3, o3, e4)
    // the ⅞ point of the interval before, read again where it was skipped and could matter
    let l = b2 === n - 1 ? l2 : rim ? seventh(o - 1) : 0
    b2 = n; l2 = q[POINTS - 1]
    let v = vertex(l, a, q[1])
    if (v > pk) pk = v
    for (let p = 1; p < POINTS; p++) if ((v = vertex(q[p - 1], q[p], q[p + 1])) > pk) pk = v
    return pk
  }

  /** q: the interval's points in time order, from the folded sums: p/8 reads e + o, 1 − p/8 reads e − o. */
  function points(a, b, e1, o1, e2, o2, e3, o3, e4) {
    q[0] = a; q[1] = Math.abs(e1 + o1); q[2] = Math.abs(e2 + o2); q[3] = Math.abs(e3 + o3); q[4] = Math.abs(e4)
    q[5] = Math.abs(e3 - o3); q[6] = Math.abs(e2 - o2); q[7] = Math.abs(e1 - o1); q[8] = b
  }

  /** The ⅞ point of the interval whose newest sample is h[o]. */
  function seventh(o) {
    let e = 0, f = 0
    for (let k = 0, i = 0; k < HALF; k++, i += 7) { let u = h[o - HALF - k], v = h[o - HALF + 1 + k]; e += FW[i] * (u + v); f += FW[i + 1] * (u - v) }
    return Math.abs(e - f)
  }

  // Advance one sample; returns the gain-scaled emitted sample, or undefined
  // while the delay line is still warming up.
  function step(x) {
    let r
    if (tp) r = need(x)
    else { let ax = x < 0 ? -x : x; r = ax > ceilLin ? ceilLin / ax : 1 }
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
      buf[bi] = x
      bi = (bi + 1) % D
      pending++
      return
    }
    let y = buf[bi] * env
    buf[bi] = x
    bi = (bi + 1) % D
    return y
  }

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      let o = 0
      for (let i = 0; i < chunk.length; i++) {
        let y = step(chunk[i])
        if (y !== undefined) out[o++] = y
      }
      return out.subarray(0, o)
    },
    flush() {
      let out = new Float32Array(pending)
      let o = 0
      while (o < out.length) {
        let y = step(0)
        if (y !== undefined) out[o++] = y
      }
      pending = 0
      return out
    }
  }
}

return { limiterStream, latency, default: limiter };
})();

const limiter = (() => {
const { limiterStream, latency } = module1;
// atom manifest — wraps the lookahead brickwall limiter per @audio/compile CONTRACT.
// The delay line emits \`lookahead\` late (and the true-peak kernel's 96 samples); declared latency lets the host compensate
// (audio's plan engine runs cursors ahead, so output lands timeline-aligned).
// Emissions may run short during delay-line fill — they land at the block tail.

const limiter = (ctx) => {
	const streams = []
	const opts = {
		sampleRate: ctx.sampleRate,
		ceiling: ctx.params.ceiling[0],
		lookahead: ctx.params.lookahead[0],
		release: ctx.params.release[0],
		truePeak: ctx.params.truePeak,
	}
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) streams.push(limiterStream(opts))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const w = streams[c].write(inp[c]), y = out[c]
			y.fill(0, 0, y.length - w.length)
			y.set(w, y.length - w.length)
		}
	}
}
limiter.channels = 'any'
limiter.latency = (ctx) => latency({ lookahead: ctx.params.lookahead[0], sampleRate: ctx.sampleRate, truePeak: ctx.params.truePeak })
limiter.params = {
	ceiling:   { type: 'number', min: -30, max: 0, default: -0.3, unit: 'dB', flags: ['restart'] },
	lookahead: { type: 'number', min: 0.1, max: 20, default: 5, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 1, max: 1000, default: 50, unit: 'ms', flags: ['restart'] },
	truePeak:  { type: 'bool', default: false, flags: ['restart'] },
}

return limiter;
})();
`;