/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `timeCoef`, as `module0`
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `envelope`, as `module1`
 * - `@audio/dynamics-compressor` 0.2.1 (MIT, Dmitry Iv.): `writer`, `concat`, `db2lin`, `lin2db`, as `module2`
 * - `@audio/dynamics-compressor` 0.2.1 (MIT, Dmitry Iv.): `compressorGain`, as `module3`
 * - `@audio/biquad` 1.2.2 (MIT, Dmitry Iv.): `lowpass`, `highpass`, `step`, `state`, as `module4`
 * - `@audio/dynamics-deesser` 0.4.1 (MIT, Dmitry Iv.): `writer`, `db2lin`, `timeCoef`, `smoother`, as `module5`
 * - `@audio/dynamics-deesser` 0.4.1 (MIT, Dmitry Iv.): `deesserStream`, `latency`, as `module6`
 * - `@audio/dynamics-deesser` 0.4.1 (MIT, Dmitry Iv.): `deesser`
 */
export const DEESSER_KERNELS = `const module0 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

return { timeCoef };
})();

const module1 = (() => {
const { timeCoef } = module0;

// Branching one-pole envelope follower. Returns a stateful per-sample detector.
// Separate attack and release time constants; the classic feed-forward compressor
// topology. Peak or RMS detection selectable.
function envelope(opts = {}) {
  // sampleRate is this family's documented key; fs accepted too — half the ecosystem
  // (and dynamics' own fs-named atoms: multiband, leveler, transient-shaper) passes fs,
  // and silently falling back to 44100 skews ballistics at any other rate.
  let sr = opts.sampleRate ?? opts.fs ?? 44100
  let aa = timeCoef(opts.attack ?? 5, sr)
  let ar = timeCoef(opts.release ?? 50, sr)
  let detector = opts.detector || 'peak'
  let rmsWin = Math.max(1, opts.rmsWindow || 256)

  let rmsBuf = detector === 'rms' ? new Float32Array(rmsWin) : null
  let rmsSum = 0
  let rmsIdx = 0
  let env = 0

  return function detect(x) {
    let mag
    if (detector === 'rms') {
      let sq = x * x
      rmsSum += sq - rmsBuf[rmsIdx]
      rmsBuf[rmsIdx] = sq
      rmsIdx = (rmsIdx + 1) % rmsWin
      mag = Math.sqrt(Math.max(0, rmsSum / rmsWin))
    } else {
      mag = x < 0 ? -x : x
    }
    let c = mag > env ? aa : ar
    env = c * env + (1 - c) * mag
    return env
  }
}

return { envelope };
})();

const module2 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

const db2lin = (db) => Math.pow(10, db / 20)

const lin2db = (lin) => 20 * Math.log10(Math.max(Math.abs(lin), 1e-10))

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

return { writer, concat, db2lin, lin2db };
})();

const module3 = (() => {
const { envelope } = module1;
const { writer, concat, db2lin, lin2db } = module2;

// Feed-forward soft-knee compressor (Giannoulis-Massberg topology).
// Envelope → log domain → gain curve → apply to input.
//
// Downward (above threshold, reduces gain) and upward (below threshold, adds
// gain) compression are the two halves of the canonical four-quadrant dynamics
// taxonomy (Giannoulis, Massberg & Reiss 2012, JAES 60(6); Izhaki, Mixing Audio)
// — upward is the "OTT up" half. Both curves read the same envelope/level in dB
// and sum in the dB domain, so they compose into one continuous transfer.
function compressor(data, opts) {
  if (!(data instanceof Float32Array)) return writer(compressorStream(data))
  let s = compressorStream(opts)
  return concat(s.write(data), s.flush())
}

function compressorStream(opts = {}) {
  let threshold = opts.threshold ?? -20
  let ratio = opts.ratio ?? 4
  let knee = opts.knee ?? 6
  let makeupDb = opts.makeup ?? 0
  let depth = opts.depth ?? 1
  // Upward compression is off by default (upThreshold: null skips the extra
  // curve call entirely). upRatio defaults to 2 at this (kernel) layer once
  // enabled; the params-convention manifest instead defaults upRatio to 1
  // (a mathematical no-op — see audio.js), since it has no null to switch on.
  let upThreshold = opts.upThreshold ?? null
  let upRatio = opts.upRatio ?? 2
  let upKnee = opts.upKnee ?? 6
  let upRange = opts.upRange ?? 12
  let env = envelope({ ...opts, attack: opts.attack ?? 5, release: opts.release ?? 100 })

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let levelDb = lin2db(env(x))
        let gDb = compressorGain(levelDb, threshold, ratio, knee)
        if (upThreshold != null) gDb += upwardGain(levelDb, upThreshold, upRatio, upKnee, upRange)
        out[i] = x * db2lin(gDb * depth + makeupDb)
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}

// Soft-knee downward compression curve. Returns gain reduction in dB (≤ 0).
// Below (T - W/2): no compression. Above (T + W/2): full ratio. In knee: quadratic.
function compressorGain(levelDb, threshold, ratio, kneeDb) {
  let d = levelDb - threshold
  if (d < -kneeDb / 2) return 0
  if (d >= kneeDb / 2) return -(d * (1 - 1 / ratio))
  let x = d + kneeDb / 2
  return -(1 - 1 / ratio) * x * x / (2 * kneeDb)
}

// Soft-knee upward compression curve — the below-threshold complement of
// compressorGain (four-quadrant taxonomy: downward compression engages above
// threshold, upward engages below). Returns gain LIFT in dB (≥ 0), clamped to
// \`rangeDb\` — essential, since without a ceiling silence would take unbounded
// gain. Knee is compressorGain's quadratic reflected about the threshold: off
// above (T + W/2), full ratio below (T - W/2), quadratic interpolation between.
function upwardGain(levelDb, threshold, ratio, kneeDb, rangeDb = 12) {
  let d = levelDb - threshold
  let r
  if (d >= kneeDb / 2) r = 0
  else if (d <= -kneeDb / 2) r = -d * (1 - 1 / ratio)
  else {
    let x = kneeDb / 2 - d
    r = (1 - 1 / ratio) * x * x / (2 * kneeDb)
  }
  return r > rangeDb ? rangeDb : r
}

return { compressorGain, default: compressor };
})();

const module4 = (() => {
// Shared biquad kernel — RBJ Audio-EQ-Cookbook coefficients (normalized a0 = 1) +
// transposed direct-form-II processing with persistent per-channel state. The one
// coefficient/kernel source for @audio family cores (dedupe target).

const PI2 = Math.PI * 2

function base (fc, Q, fs) {
	let w = PI2 * fc / fs
	return { cw: Math.cos(w), sw: Math.sin(w), alpha: Math.sin(w) / (2 * Q) }
}
const norm = (b0, b1, b2, a0, a1, a2) => ({ b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 })

function lowpass (fc, Q = Math.SQRT1_2, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm((1 - cw) / 2, 1 - cw, (1 - cw) / 2, 1 + alpha, -2 * cw, 1 - alpha)
}
function highpass (fc, Q = Math.SQRT1_2, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm((1 + cw) / 2, -(1 + cw), (1 + cw) / 2, 1 + alpha, -2 * cw, 1 - alpha)
}
function bandpass (fc, Q = 1, fs = 44100) {  // constant 0 dB peak gain
	let { cw, alpha } = base(fc, Q, fs)
	return norm(alpha, 0, -alpha, 1 + alpha, -2 * cw, 1 - alpha)
}
function notch (fc, Q = 1, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm(1, -2 * cw, 1, 1 + alpha, -2 * cw, 1 - alpha)
}
function allpass (fc, Q = Math.SQRT1_2, fs = 44100) {
	let { cw, alpha } = base(fc, Q, fs)
	return norm(1 - alpha, -2 * cw, 1 + alpha, 1 + alpha, -2 * cw, 1 - alpha)
}
function peaking (fc, Q = 1, fs = 44100, dB = 0) {
	let { cw, alpha } = base(fc, Q, fs)
	let A = 10 ** (dB / 40)
	return norm(1 + alpha * A, -2 * cw, 1 - alpha * A, 1 + alpha / A, -2 * cw, 1 - alpha / A)
}
function lowshelf (fc, Q = Math.SQRT1_2, fs = 44100, dB = 0) {
	let { cw, sw } = base(fc, Q, fs)
	let A = 10 ** (dB / 40), s = Math.sqrt(A) * sw / Q
	return norm(
		A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s),
		(A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s)
}
function highshelf (fc, Q = Math.SQRT1_2, fs = 44100, dB = 0) {
	let { cw, sw } = base(fc, Q, fs)
	let A = 10 ** (dB / 40), s = Math.sqrt(A) * sw / Q
	return norm(
		A * ((A + 1) + (A - 1) * cw + s), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - s),
		(A + 1) - (A - 1) * cw + s, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - s)
}

/** Fresh section state (transposed DF-II: two accumulators). */
const state = () => new Float64Array(2)

/** Process in place through one section; state persists across chunks. */
function process (data, c, s = state()) {
	let b0 = c.b0, b1 = c.b1, b2 = c.b2, a1 = c.a1, a2 = c.a2
	let z1 = s[0], z2 = s[1]
	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let y = b0 * x + z1
		z1 = b1 * x - a1 * y + z2
		z2 = b2 * x - a2 * y
		data[i] = y
	}
	s[0] = z1; s[1] = z2
	return data
}

// Two sections in one pass. Each section's recursion is a serial dependency chain; the
// second section's chain is independent of the first's, so interleaving them lets both run
// at once (~2× a section-per-pass cascade). The store/reload between sections keeps the
// element type's rounding, so the output is bit-identical to two process() passes.
function process2 (data, c, s, d, t) {
	let b0 = c.b0, b1 = c.b1, b2 = c.b2, a1 = c.a1, a2 = c.a2
	let e0 = d.b0, e1 = d.b1, e2 = d.b2, f1 = d.a1, f2 = d.a2
	let z1 = s[0], z2 = s[1], w1 = t[0], w2 = t[1]
	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let y = b0 * x + z1
		z1 = b1 * x - a1 * y + z2
		z2 = b2 * x - a2 * y
		data[i] = y
		x = data[i]
		y = e0 * x + w1
		w1 = e1 * x - f1 * y + w2
		w2 = e2 * x - f2 * y
		data[i] = y
	}
	s[0] = z1; s[1] = z2; t[0] = w1; t[1] = w2
}

/** One sample through one section — sidechain/per-sample use. */
function step (c, s, x) {
	let y = c.b0 * x + s[0]
	s[0] = c.b1 * x - c.a1 * y + s[1]
	s[1] = c.b2 * x - c.a2 * y
	return y
}

/** Cascade of sections. states: array of state() per section (created if absent). */
function cascade (data, coefs, states) {
	states ??= coefs.map(() => state())
	let i = 0
	for (; i + 1 < coefs.length; i += 2) process2(data, coefs[i], states[i], coefs[i + 1], states[i + 1])
	if (i < coefs.length) process(data, coefs[i], states[i])
	return data
}

/**
 * Params-convention kernel: coefs (section or array) + state persisted on params —
 * the ecosystem's streaming convention (drop-in for digital-filter/core/filter.js).
 */
function filter (data, params) {
	let coefs = Array.isArray(params.coefs) ? params.coefs : [params.coefs]
	if (coefs[0] == null || coefs[0].b0 == null) throw Error('filter: params.coefs must be SOS section(s) {b0,b1,b2,a1,a2}')
	params.state ??= coefs.map(() => state())
	return cascade(data, coefs, params.state)
}

/** |H(f)| at frequency f — analysis/plotting support. */
function magnitude (c, f, fs = 44100) {
	let w = PI2 * f / fs
	let cos1 = Math.cos(w), cos2 = Math.cos(2 * w), sin1 = Math.sin(w), sin2 = Math.sin(2 * w)
	let nr = c.b0 + c.b1 * cos1 + c.b2 * cos2, ni = -(c.b1 * sin1 + c.b2 * sin2)
	let dr = 1 + c.a1 * cos1 + c.a2 * cos2, di = -(c.a1 * sin1 + c.a2 * sin2)
	return Math.hypot(nr, ni) / Math.hypot(dr, di)
}

/** |H(f)| of a cascade (array of SOS sections) — product of each section's magnitude. */
function cascadeMagnitude (sos, f, fs = 44100) {
	let mag = 1
	for (let c of sos) mag *= magnitude(c, f, fs)
	return mag
}

return { lowpass, highpass, step, state };
})();

const module5 = (() => {
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

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

// One-pole smoothing coefficient, α = e^(−1/(τ·fs)) (Giannoulis et al. 2012, eq. 7): τ in ms reaches 1 − 1/e.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

// Smooth decoupled peak detector, eq. (17), run on a gain reduction in dB, as the compressor's:
// y₁ = max(x, αR·y₁ + (1 − αR)·x), y = αA·y + (1 − αA)·y₁.
function smoother(attack, release, sampleRate) {
  let aA = timeCoef(attack, sampleRate), aR = timeCoef(release, sampleRate), y1 = 0, y = 0
  return x => {
    let r = aR * y1 + (1 - aR) * x
    y1 = x > r ? x : r
    return y = aA * y + (1 - aA) * y1
  }
}

return { writer, db2lin, timeCoef, smoother };
})();

const module6 = (() => {
const { lowpass, highpass, step, state } = module4;
const { compressorGain } = module3;
const { writer, db2lin, timeCoef, smoother } = module5;

// De-esser. An 's' is told by its shape, not its level: the band where sibilance lies over the voice body (its
// formants, under 3.5 kHz), in dB. The dbx 902 detects this way, "comparing (in dB) the high frequency level of an
// audio signal and the full bandwidth level", which "makes it possible to achieve the exact amount of de-essing desired
// regardless of variations in signal levels" (902 owner's manual, 1996). A threshold on the band's own level dulls a
// loud take, misses a quiet one and fires on any bright sound; a cymbal in a mix sits over the mix's body, not over
// nothing, and passes. The body's reference never sinks more than 30 dB under the voice's running level, so hiss in a
// pause is not taken for an 's' (the Oxford SuprEsser's level tracking likewise leaves out what falls under its 24 dB
// window; user guide §3.3.2). How far that difference rises over \`threshold\` drives a soft-knee gain computer
// (Giannoulis, Massberg & Reiss 2012, eq. 4) whose cut is held within \`range\`, the Range of the 902, of FabFilter
// Pro-DS and of Waves Sibilance. The cut is smoothed in dB by the smooth decoupled peak detector (ibid. eq. 17).
// The sound is read \`lookahead\` ms ahead of what it cuts (declared latency): an 's' sets its own level within a few
// ms, and a cut that waits for it leaves its onset whole. Three ways to apply it, by \`mode\`:
//  - split (default): only the band over \`split\` moves, out = x − (1 − g)·HP(x), HP linear-phase (a Kaiser-windowed
//    sinc of ±1.5 ms), so x − HP is exactly the rest, delayed: no bump at the split, and at g = 1 the input itself;
//  - band: the same with a linear-phase band-pass an octave-ish wide at \`fc\` (its width set by \`Q\`, as a peaking EQ's);
//  - broadband: the whole sound is turned down while the 's' lasts (Pro-DS "Wide Band").
const BODY = 3500        // Hz, the voice body's top: F1–F3
const HALF = 0.0015      // s, the split's linear-phase half-length

/** The delay, samples: the look-ahead, and never under the split's half-length */
const latency = (sampleRate = 44100, lookahead = 5) => Math.max(Math.round(lookahead * 0.001 * sampleRate), Math.round(HALF * sampleRate))

function deesser(data, opts) {
  if (!ArrayBuffer.isView(data)) return writer(deesserStream(data))
  let s = deesserStream(opts), n = data.length, L = s.latency, a = s.write(data), b = s.flush(), out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = i + L < n ? a[i + L] : b[i + L - n]
  return out
}

function deesserStream(opts = {}) {
  let sr = opts.sampleRate || 44100, mode = opts.mode ?? 'split', top = 0.45 * sr
  let fc = Math.min(opts.fc ?? opts.freq ?? 6500, top), Q = opts.Q ?? opts.q ?? 1.4, split = Math.min(opts.split ?? 3500, top)
  // the band cut: over \`split\`, or \`fc\` ± half its bandwidth in octaves (RBJ: BW = 2·asinh(1/2Q)/ln 2)
  let bw = 2 * Math.asinh(1 / (2 * Q)) / Math.LN2, lo = mode === 'band' ? fc * 2 ** (-bw / 2) : split, hi = mode === 'band' ? Math.min(top, fc * 2 ** (bw / 2)) : top
  let threshold = opts.threshold ?? 0, ratio = opts.ratio ?? 4, knee = opts.knee ?? 6, range = Math.abs(opts.range ?? -8)
  let ess = sibilance(lo, Math.min(BODY, lo), sr), smooth = smoother(opts.attack ?? 1, opts.release ?? 15, sr)
  let L = latency(sr, opts.lookahead ?? 5), M = Math.round(HALF * sr), h = mode === 'broadband' ? null : band(lo, hi, M, sr)
  let R = L + M + 1, buf = new Float64Array(R), bi = 0

  function tick(x) {
    let cut = smooth(Math.min(range, -compressorGain(ess(x), threshold, ratio, knee)))   // dB, ≥ 0
    buf[bi] = x
    let at = bi - L < 0 ? bi - L + R : bi - L, y = buf[at]                               // the input L samples back
    if (++bi === R) bi = 0
    if (!h) return y * db2lin(-cut)
    if (cut < 1e-4) return y
    let acc = h[M] * y
    for (let k = 1, p = at, q = at; k <= M; k++) { if (++p === R) p = 0; if (--q < 0) q = R - 1; acc += h[M + k] * (buf[p] + buf[q]) }
    return y - (1 - db2lin(-cut)) * acc
  }
  return {
    latency: L,
    write(chunk) { let out = new Float32Array(chunk.length); for (let i = 0; i < chunk.length; i++) out[i] = tick(chunk[i]); return out },
    flush() { let out = new Float32Array(L); for (let i = 0; i < L; i++) out[i] = tick(0); return out }
  }
}

// The sibilance band's power (over \`lo\`, 4th-order Butterworth) over the voice body's (under \`body\`), dB, per sample.
// Each is a 5 ms mean square (the 902 senses RMS). The body's reference is floored 30 dB under the voice's running
// level (rising in 10 ms, falling in 1 s); under −100 dBFS nothing is an 's', so silence reads −200 dB. The ratio is
// smoothed over 1 ms in dB: filters starting from rest, and clicks, read high for a few samples; an 's' lasts tens of
// milliseconds.
function sibilance(lo, body, sr) {
  let h1 = highpass(lo, 0.5412, sr), h2 = highpass(lo, 1.3066, sr), lp = lowpass(body, Math.SQRT1_2, sr), s1 = state(), s2 = state(), sl = state()
  let a = timeCoef(5, sr), up = timeCoef(10, sr), down = timeCoef(1000, sr), d = timeCoef(1, sr)
  let ps = 0, pb = 0, pv = 0, r = -200
  return x => {
    let s = step(h2, s2, step(h1, s1, x)), b = step(lp, sl, x)
    ps = a * ps + (1 - a) * s * s
    pb = a * pb + (1 - a) * b * b
    let c = pb > pv ? up : down
    pv = c * pv + (1 - c) * pb
    return r = d * r + (1 - d) * 10 * Math.log10((ps + 1e-30) / (Math.max(pb, 1e-3 * pv) + 1e-10))
  }
}

// Linear-phase band [lo, hi] (hi at 0.45·sr: a high-pass), 2M + 1 taps: the difference of two Kaiser-windowed sincs
// (β 6, sidelobes ~ −44 dB), the low edge's own DC gain taken out so the band passes nothing at DC
function band(lo, hi, M, sr) {
  let h = new Float64Array(2 * M + 1), w = k => i0(6 * Math.sqrt(1 - (k / M) ** 2)) / i0(6), sinc = (f, k) => k ? Math.sin(2 * Math.PI * f / sr * k) / (Math.PI * k) : 2 * f / sr
  let top = hi >= 0.45 * sr, sl = 0, sh = 0
  for (let k = -M; k <= M; k++) sl += sinc(lo, k) * w(k), sh += top ? 0 : sinc(hi, k) * w(k)
  for (let k = -M; k <= M; k++) h[k + M] = (top ? (k ? 0 : 1) : sinc(hi, k) * w(k) / sh) - sinc(lo, k) * w(k) / sl
  return h
}
const i0 = x => { let s = 1, t = 1; for (let k = 1; k < 32; k++) { t *= (x / 2 / k) ** 2; s += t } return s }

return { deesserStream, latency, default: deesser };
})();

const deesser = (() => {
const { deesserStream, latency } = module6;
// atom manifest — wraps the de-esser kernel per @audio/compile CONTRACT.
// The sibilance band's level over the voice body's (dB, so any recording level)
// drives a cut held within \`range\`; \`mode\` applies it to the band over \`split\`
// (linear phase), to a band at fc, Q, or broadband. The stream returns each block
// whole, \`lookahead\` ms late (declared latency). All params seed the stream at
// construction (flags: restart).

const deesser = (ctx) => {
	const streams = []
	const opts = {
		sampleRate: ctx.sampleRate,
		mode: ctx.params.mode,
		split: ctx.params.split[0],
		fc: ctx.params.fc[0],
		Q: ctx.params.Q[0],
		threshold: ctx.params.threshold[0],
		ratio: ctx.params.ratio[0],
		range: ctx.params.range[0],
		knee: ctx.params.knee[0],
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
		lookahead: ctx.params.lookahead[0],
	}
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) streams.push(deesserStream(opts))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) out[c].set(streams[c].write(inp[c]))
	}
}
deesser.channels = 'any'
deesser.latency = (ctx) => latency(ctx.sampleRate, ctx.params.lookahead[0])
deesser.params = {
	mode:      { type: 'enum', values: ['split', 'band', 'broadband'], default: 'split', flags: ['restart'] },
	split:     { type: 'number', min: 1000, max: 16000, default: 3500, unit: 'Hz', flags: ['restart'] },
	fc:        { type: 'number', min: 2000, max: 16000, default: 6500, unit: 'Hz', flags: ['restart'], alias: 'freq' },
	Q:         { type: 'number', min: 0.3, max: 10, default: 1.4, flags: ['restart'], alias: 'q' },
	threshold: { type: 'number', min: -12, max: 24, default: 0, unit: 'dB', flags: ['restart'] },
	ratio:     { type: 'number', min: 1, max: 20, default: 4, flags: ['restart'] },
	range:     { type: 'number', min: -24, max: 0, default: -8, unit: 'dB', flags: ['restart'] },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB', flags: ['restart'] },
	attack:    { type: 'number', min: 0.1, max: 100, default: 1, unit: 'ms', flags: ['restart'] },
	release:   { type: 'number', min: 1, max: 1000, default: 15, unit: 'ms', flags: ['restart'] },
	lookahead: { type: 'number', min: 0, max: 20, default: 5, unit: 'ms', flags: ['restart'] },
}

return deesser;
})();
`;
