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

return { db2lin, lin2db, writer, concat };
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

return { compressor, compressorStream, compressorGain, upwardGain, default: compressor };
})();

const module4 = (() => {
// Shared biquad kernel — RBJ Audio-EQ-Cookbook coefficients (normalized a0 = 1) +
// transposed direct-form-II processing with persistent per-channel state. The one
// coefficient/kernel source for @audio family cores (dedupe target).

const PI2 = Math.PI * 2

// Each design writes its section into \`c\` when one is given (a retune that allocates nothing), else into a new object
const norm = (c, b0, b1, b2, a0, a1, a2) => { c.b0 = b0 / a0; c.b1 = b1 / a0; c.b2 = b2 / a0; c.a1 = a1 / a0; c.a2 = a2 / a0; return c }

function lowpass (fc, Q = Math.SQRT1_2, fs = 44100, c = {}) {
	let w = PI2 * fc / fs, cw = Math.cos(w), alpha = Math.sin(w) / (2 * Q)
	return norm(c, (1 - cw) / 2, 1 - cw, (1 - cw) / 2, 1 + alpha, -2 * cw, 1 - alpha)
}
function highpass (fc, Q = Math.SQRT1_2, fs = 44100, c = {}) {
	let w = PI2 * fc / fs, cw = Math.cos(w), alpha = Math.sin(w) / (2 * Q)
	return norm(c, (1 + cw) / 2, -(1 + cw), (1 + cw) / 2, 1 + alpha, -2 * cw, 1 - alpha)
}
function bandpass (fc, Q = 1, fs = 44100, c = {}) {  // constant 0 dB peak gain
	let w = PI2 * fc / fs, cw = Math.cos(w), alpha = Math.sin(w) / (2 * Q)
	return norm(c, alpha, 0, -alpha, 1 + alpha, -2 * cw, 1 - alpha)
}
function notch (fc, Q = 1, fs = 44100, c = {}) {
	let w = PI2 * fc / fs, cw = Math.cos(w), alpha = Math.sin(w) / (2 * Q)
	return norm(c, 1, -2 * cw, 1, 1 + alpha, -2 * cw, 1 - alpha)
}
function allpass (fc, Q = Math.SQRT1_2, fs = 44100, c = {}) {
	let w = PI2 * fc / fs, cw = Math.cos(w), alpha = Math.sin(w) / (2 * Q)
	return norm(c, 1 - alpha, -2 * cw, 1 + alpha, 1 + alpha, -2 * cw, 1 - alpha)
}
function peaking (fc, Q = 1, fs = 44100, dB = 0, c = {}) {
	let w = PI2 * fc / fs, cw = Math.cos(w), alpha = Math.sin(w) / (2 * Q)
	let A = 10 ** (dB / 40)
	return norm(c, 1 + alpha * A, -2 * cw, 1 - alpha * A, 1 + alpha / A, -2 * cw, 1 - alpha / A)
}
function lowshelf (fc, Q = Math.SQRT1_2, fs = 44100, dB = 0, c = {}) {
	let w = PI2 * fc / fs, cw = Math.cos(w), sw = Math.sin(w)
	let A = 10 ** (dB / 40), s = Math.sqrt(A) * sw / Q
	return norm(c,
		A * ((A + 1) - (A - 1) * cw + s), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - s),
		(A + 1) + (A - 1) * cw + s, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - s)
}
function highshelf (fc, Q = Math.SQRT1_2, fs = 44100, dB = 0, c = {}) {
	let w = PI2 * fc / fs, cw = Math.cos(w), sw = Math.sin(w)
	let A = 10 ** (dB / 40), s = Math.sqrt(A) * sw / Q
	return norm(c,
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

/**
 * Seconds a section (or an SOS cascade) rings once its input stops, until it stays 60 dB under the input: the tail of
 * CONTRACT.md. After any input bounded by 1 stops, the output k frames on is at most the sum of |h| from frame k of the
 * impulse response h, so the frames until that rest is under 1e-3 are a tail no input exceeds; a held tone at the
 * resonance, or a DC step, comes within a few percent of it. One section's rest is found in closed form (ring1); a
 * cascade's h is summed as process() runs the sections, the rest past where the sum stops bounded from their states by
 * their poles (rest2). 0 where the ring is 128 frames or under (no tail needed, CONTRACT.md); Infinity for a pole on or
 * past the unit circle, or a cascade's rest still over 1e-3 at 2^22 frames.
 */
function tail (sos, fs = 44100) {
	let S = Array.isArray(sos) ? sos : [sos], n = S.length, L = new Float64Array(n), z = new Float64Array(2 * n)
	// what a section passes on, at most: the sum of its own |h|, b0 and then the ring of its state after the impulse
	for (let i = 0; i < n; i++) {
		let { b0, b1, b2, a1, a2 } = S[i], h1 = b1 - a1 * b0
		L[i] = Math.abs(b0) + rest2(a1, a2, h1, b2 - a2 * b0 - a1 * h1)
		if (!(L[i] < Infinity)) return Infinity
	}
	// one section: past frame 0 its h is the free ring from h1, h2, the frames until its rest is under 1e-3 found in
	// closed form, at a cost that does not grow with the ring
	if (n === 1) {
		let { b0, b1, b2, a1, a2 } = S[0], h1 = b1 - a1 * b0, N = ring1(a1, a2, h1, b2 - a2 * b0 - a1 * h1, 1e-3)
		return N <= 128 ? 0 : N / fs
	}
	// the cascade's rest from its states: each section's own ring, and on it what the sections before still feed it
	let rest = () => {
		let u = 0
		for (let i = 0; i < n; i++) u = rest2(S[i].a1, S[i].a2, z[2 * i], z[2 * i + 1] - S[i].a1 * z[2 * i]) + (u > 0 ? L[i] * u : 0)
		return u
	}
	// frames k to k + m of h through the sections, as process() runs them; the sum of their |h|
	let run = (k, m) => {
		let sum = 0
		for (let end = k + m; k < end; k++) {
			let x = k === 0 ? 1 : 0
			for (let i = 0; i < n; i++) {
				let c = S[i], y = c.b0 * x + z[2 * i]
				z[2 * i] = c.b1 * x - c.a1 * y + z[2 * i + 1]
				z[2 * i + 1] = c.b2 * x - c.a2 * y
				x = y
			}
			sum += Math.abs(x)
		}
		return sum
	}
	let total = 0, k = 0, r
	do { total += run(k, 256); k += 256; r = rest() } while (!(r <= 1e-4) && k < 1 << 22)
	if (!(r <= 1e-3)) return Infinity
	// from the impulse again: the first frame from which what is left (the sum past it and the bound on the rest) is
	// under 1e-3. The ring is the frames before it, after the input's last
	z.fill(0)
	let left = total + r, keep = new Float64Array(2 * n), N = 0
	for (; ; N += 256) { keep.set(z); let m = run(N, 256); if (left - m <= 1e-3) { z.set(keep); break } left -= m }
	while (left > 1e-3) left -= run(N++, 1)
	return N - 1 <= 128 ? 0 : (N - 1) / fs
}

// A bound on Σ|y_j|, j ≥ 0, for y_j = −a1·y_{j−1} − a2·y_{j−2}: the ring of a section's poles from y0 and y1. With p, q
// the roots of z² + a1·z + a2 and r the larger radius, y_j = y0·pʲ + (y1 − p·y0)·(qʲ − pʲ)/(q − p), and that last ratio
// is at most j·r^(j−1) however close p and q are: Σ ≤ |y0|/(1 − r) + |y1 − p·y0|/(1 − r)². A conjugate pair r·e^(±iθ)
// rings as E·rʲ·cos(jθ + φ), E² = 4(y1² + a1·y0·y1 + a2·y0²)/(4a2 − a1²): Σ ≤ E/(1 − r). Two real roots ring as their
// two parts, each bounded by its own geometric sum. The least of those that apply
function rest2 (a1, a2, y0, y1) {
	if (y0 === 0 && y1 === 0) return 0
	let d = a1 * a1 - 4 * a2, s = Math.sqrt(Math.abs(d)), Y0 = Math.abs(y0)
	if (d < 0) {
		let r = Math.sqrt(a2)
		if (!(r < 1)) return Infinity
		return Math.min(Math.sqrt(4 * (y1 * y1 + a1 * y0 * y1 + a2 * y0 * y0) / -d) / (1 - r), Y0 / (1 - r) + Math.hypot(y1 + a1 / 2 * y0, s / 2 * y0) / (1 - r) ** 2)
	}
	let p = (s - a1) / 2, q = (-s - a1) / 2, r = Math.max(Math.abs(p), Math.abs(q))
	if (!(r < 1)) return Infinity
	let u = Y0 / (1 - r) + Math.min(Math.abs(y1 - p * y0), Math.abs(y1 - q * y0)) / (1 - r) ** 2
	return s > 0 ? Math.min(u, Math.abs(y1 - q * y0) / s / (1 - Math.abs(p)) + Math.abs(y1 - p * y0) / s / (1 - Math.abs(q))) : u
}

// The first frame m from which Σ_{j≥m} |y_j| is at most \`eps\`, y_j = −a1·y_{j−1} − a2·y_{j−2} from y0, y1 (the ring of one
// section once its input stops), from closed forms, so the cost does not grow with the ring. Infinity for a root on or
// past the unit circle.
// - A conjugate pair r·e^(±iθ) rings as E·rʲ·cos(jθ + φ) (ringPair). |cos| is the same with π − θ for θ, so θ ≤ π/2.
//   Where it turns slowly against its decay (θ under 64·(1 − r)), the sum over each stretch of one sign is the geometric
//   Re(e^(iφ)·Σ zʲ), z = r·e^(iθ): exact. Where it turns fast, the stretches are many and |cos x| is summed by its
//   Fourier series, 2/π + (4/π)·Σ (−1)^(k+1)·cos(2kx)/(4k² − 1), a geometric sum at each k, to k = 64 with the rest
//   bounded: within 0.8 % of the sum.
// - Two real roots p, q (|q| ≤ |p|): |y_j| = |p|ʲ·|A + B·ρʲ|, ρ = q/p, whose sign changes at most once over the even j
//   and once over the odd, each stretch a geometric sum (sumTwo). Repeated, or within 1e-9 of it: |p|ʲ·|C + D·j|, one
//   change (sumLin)
function ring1 (a1, a2, y0, y1, eps) {
	if (y0 === 0 && y1 === 0) return 0
	if (a1 === 0 && a2 === 0) return Math.abs(y0) + Math.abs(y1) <= eps ? 0 : Math.abs(y1) <= eps ? 1 : 2   // no poles: y0, y1, then 0
	let d = a1 * a1 - 4 * a2
	if (d < 0) {
		let r = Math.sqrt(a2)
		if (!(r < 1)) return Infinity
		let c = -a1 / (2 * r), sn = Math.sqrt(-d) / (2 * r)
		if (sn > 1e-9) return ringPair(r, c, sn, y0, y1, eps)
	}
	let s = Math.sqrt(Math.max(d, 0)), p = (s - a1) / 2, q = (-s - a1) / 2
	if (Math.abs(q) > Math.abs(p)) { let t = p; p = q; q = t }
	if (!(Math.abs(p) < 1)) return Infinity
	let A, B, D = 0, rho = 0
	if (Math.abs(p - q) > 1e-9 * Math.max(1e-300, Math.abs(p))) { A = (y1 - q * y0) / (p - q); B = (p * y0 - y1) / (p - q); rho = q / p }
	else { A = y0; D = p ? y1 / p - y0 : 0; B = 0 }
	let P = Math.abs(p), sum = m => D ? sumLin(P, A, D, m) : rho >= 0 ? sumTwo(P, A, B, rho, m, 1) : sumTwo(P, A, B, -rho, m + (m & 1), 2) + sumTwo(P, A, -B, -rho, m + 1 - (m & 1), 2)
	// the rest only falls: the least m with sum(m) ≤ eps, between 0 and where the plain bound is under eps
	if (sum(0) <= eps) return 0
	let hi = 1
	while (sum(hi) > eps) { hi *= 2; if (hi > 2 ** 52) return Infinity }
	let lo = hi >> 1
	while (hi - lo > 1) { let mid = Math.floor((lo + hi) / 2); if (sum(mid) > eps) lo = mid; else hi = mid }
	return hi
}

// Σ_{j ≥ m, j ≡ m mod st} P^j·|A + B·σ^j| (0 ≤ σ ≤ 1, P < 1): A + B·σ^j keeps its sign but for one change, where σ^j = −A/B
function sumTwo (P, A, B, sig, m, st) {
	let g = (x, a, b) => { // Σ x^j over j = a, a + st, … below b (b may be Infinity)
		if (x === 0) return a === 0 ? 1 : 0
		let n = b === Infinity ? Infinity : Math.ceil((b - a) / st), xa = x ** a, xs = x ** st
		return n === Infinity ? xa / (1 - xs) : xa * (1 - x ** (st * n)) / (1 - xs)
	}
	let seg = (a, b) => Math.abs(A * g(P, a, b) + B * g(P * sig, a, b)), cut = Infinity, t = -A / B
	if (sig === 0) cut = m === 0 ? st : Infinity   // σ^0 = 1, then 0: the first term apart
	else if (B !== 0 && t > 0 && t < 1 && sig < 1) { let j = Math.log(t) / Math.log(sig); cut = m + Math.max(0, Math.ceil((j - m) / st)) * st }
	return cut <= m || cut === Infinity ? seg(m, Infinity) : seg(m, cut) + seg(cut, Infinity)
}

// Σ_{j ≥ m} P^j·|C + D·j|: one change of sign, at j = −C/D
function sumLin (P, C, D, m) {
	let G = a => P ** a / (1 - P), H = a => P ** a * (a - (a - 1) * P) / (1 - P) ** 2   // Σ_{j≥a} P^j, Σ_{j≥a} j·P^j
	let seg = (a, b) => Math.abs(C * (G(a) - (b === Infinity ? 0 : G(b))) + D * (H(a) - (b === Infinity ? 0 : H(b))))
	let j = Math.ceil(-C / D)
	return j > m && j < Infinity ? seg(m, j) + seg(j, Infinity) : seg(m, Infinity)
}

// ring1 for a conjugate pair of radius r, cos θ = c, sin θ = sn
function ringPair (r, c, sn, y0, y1, eps) {
	let E = Math.hypot(y0, (y0 * c - y1 / r) / sn), ph = Math.atan2((y0 * c - y1 / r) / sn, y0), th = Math.atan2(sn, c)
	if (th > Math.PI / 2) { th = Math.PI - th; ph = -ph }   // |cos(jθ + φ)| = |cos(j(π − θ) − φ)|
	if (th >= 64 * (1 - r)) {
		// turning fast: Σ_(t≥0) rᵗ·|cos(x + tθ)| = (2/π)/(1 − r) + (4/π)·Σ_k (−1)^(k+1)·Re(e^(2ikx)/(1 − r·e^(2ikθ)))/(4k² − 1),
		// summed to k = 64; the rest of the series is at most (2/π)/(129·(1 − r)) and is added whole, so S(m) is at most
		// E·r^m times that, at the phase x = mθ + φ
		let wr = new Float64Array(65), wi = new Float64Array(65)
		for (let k = 1; k <= 64; k++) { let cr = 1 - r * Math.cos(2 * k * th), ci = -r * Math.sin(2 * k * th), dd = cr * cr + ci * ci; wr[k] = cr / dd; wi[k] = -ci / dd }
		let S = m => {
			let x = m * th + ph, er = Math.cos(2 * x), ei = Math.sin(2 * x), pr = 1, pi = 0, f = 2 / Math.PI / (1 - r) * (1 + 1 / 129)
			for (let k = 1; k <= 64; k++) { let t = pr * er - pi * ei; pi = pr * ei + pi * er; pr = t; f += (k & 1 ? 4 : -4) / Math.PI / (4 * k * k - 1) * (pr * wr[k] - pi * wi[k]) }
			return E * r ** m * f
		}
		if (S(0) <= eps) return 0
		let lo = 0, hi = Math.ceil(Math.log(eps * (1 - r) / E) / Math.log(r)) + 1
		while (S(hi) > eps) hi *= 2
		while (hi - lo > 1) { let mid = Math.floor((lo + hi) / 2); if (S(mid) > eps) lo = mid; else hi = mid }
		return hi
	}
	// turning slowly: stretches between the zeros of cos at x = π/2 + kπ, x = jθ + φ (φ moved into (−π/2, π/2])
	while (ph > Math.PI / 2) ph -= Math.PI
	while (ph <= -Math.PI / 2) ph += Math.PI
	let cs = Math.cos(th), si = Math.sin(th), den = (1 - r * cs) ** 2 + (r * si) ** 2, wr = (1 - r * cs) / den, wi = r * si / den
	// Σ over [a, b) of rʲ·cos(jθ + φ): Re((r^a·e^(i·x_a) − r^b·e^(i·x_b))·w), w = 1/(1 − r·e^(iθ))
	let pc = j => r ** j * Math.cos(j * th + ph), ps = j => r ** j * Math.sin(j * th + ph)
	let part = (a, b) => E * Math.abs((pc(a) - (b === Infinity ? 0 : pc(b))) * wr - (ps(a) - (b === Infinity ? 0 : ps(b))) * wi)
	let starts = [0], sums = [], end = Math.log(1e-9 * eps * (1 - r) / E) / Math.log(r)
	for (let k = 0; ; k++) {
		let a = starts[k], b = Math.max(a + 1, Math.ceil((Math.PI / 2 + k * Math.PI - ph) / th))
		if (b > end) { sums.push(part(a, Infinity) + E * r ** a / (1 - r) * 1e-9); break }
		sums.push(part(a, b)); starts.push(b)
	}
	let k = sums.length - 1, rest = 0
	while (k >= 0 && rest + sums[k] <= eps) rest += sums[k--]
	if (k < 0) return 0
	// the crossing in stretch k: the least m in (a, b] with the stretch from m on and the rest under eps
	let a = starts[k], b = k + 1 < starts.length ? starts[k + 1] : Infinity, lo = a, hi = b === Infinity ? a + 1 : b
	if (b === Infinity) while (part(hi, Infinity) > eps) hi = a + 2 * (hi - a)
	while (hi - lo > 1) { let mid = Math.floor((lo + hi) / 2); if (part(mid, b) + rest > eps) lo = mid; else hi = mid }
	return hi
}

return { lowpass, highpass, bandpass, notch, allpass, peaking, lowshelf, highshelf, state, process, step, cascade, filter, magnitude, cascadeMagnitude, tail };
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

return { writer, concat, db2lin, lin2db, timeCoef };
})();

const module6 = (() => {
const { compressorGain } = module3;
const { writer, db2lin, timeCoef } = module5;

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

/** Seconds the output goes on after the input stops, past the delay: the linear-phase band's half-length, the farthest
 *  ahead of the delayed sample its taps read (none broadband, which only turns the delayed input down) */
const tail = (sampleRate = 44100, mode = 'split') => mode === 'broadband' ? 0 : Math.round(HALF * sampleRate) / sampleRate

function deesser(data, opts) {
  if (!ArrayBuffer.isView(data)) return writer(deesserStream(data))
  let s = deesserStream(opts), n = data.length, L = s.latency, a = s.write(data), b = s.flush(), out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = i + L < n ? a[i + L] : b[i + L - n]
  return out
}

function deesserStream(opts = {}) {
  let sr = opts.sampleRate || 44100, L = latency(sr, opts.lookahead ?? 5), set = deesserSet(sr), k = set.k
  k[0] = opts.threshold ?? 0; k[1] = opts.ratio ?? 4; k[2] = opts.knee ?? 6; k[3] = Math.abs(opts.range ?? -8)
  k[4] = timeCoef(opts.attack ?? 1, sr); k[5] = timeCoef(opts.release ?? 15, sr)
  deesserBand(set, opts.mode ?? 'split', Float64Array.of(opts.split ?? 3500, opts.fc ?? opts.freq ?? 6500, opts.Q ?? opts.q ?? 1.4))
  let s = deesserState(), buf = new Float64Array(L + (set.h.length >> 1) + 1)
  return {
    latency: L,
    write(chunk) { return deessBlock(chunk, new Float32Array(chunk.length), s, buf, set) },
    flush() { let out = new Float32Array(L); return deessBlock(out, out, s, buf, set) }
  }
}

// The settings, \`set.k\` (Float64Array): threshold, ratio, knee, range (dB, ≥ 0), the smoother's attack and release
// coefficients; 1 broadband; the sibilance band's two high-pass sections and the body's low-pass, b0 b1 b2 a1 a2 each;
// the detector's 5 ms mean square, its reference's rise (10 ms) and fall (1 s), the ratio's 1 ms smoothing; then what the
// band is tuned from: the sample rate, the mode (0 split, 1 band, 2 broadband), split, fc, Q; the band's edges lo, hi
// it was last tuned to and the body's top, min(BODY, lo). \`set.h\`, the linear-phase band (2M + 1 taps); \`set.win\`, its Kaiser window; \`set.th\`, scratch.
const MODE = 27, SPLIT = 28, FC = 29, QS = 30

/** The settings of one de-esser at a rate, for deesserBand and deessBlock: the band untuned, the window made. */
function deesserSet(sampleRate) {
  let M = Math.round(HALF * sampleRate), k = new Float64Array(34), win = new Float64Array(2 * M + 1)
  for (let j = -M; j <= M; j++) win[j + M] = i0(6 * Math.sqrt(1 - (j / M) ** 2)) / i0(6)
  k[22] = timeCoef(5, sampleRate); k[23] = timeCoef(10, sampleRate); k[24] = timeCoef(1000, sampleRate); k[25] = timeCoef(1, sampleRate)
  k[26] = sampleRate; k[31] = k[32] = NaN
  return { k, h: new Float64Array(2 * M + 1), win, th: new Float64Array(2 * M + 1) }
}

/** One channel's state for deessBlock: the three biquad sections' (two each), the band's and the body's mean squares, the
 *  body's reference, the ratio in dB (−200: silence), the smoother's y₁ and y, the delay line's position. */
const deesserState = () => Float64Array.of(0, 0, 0, 0, 0, 0, 0, 0, 0, -200, 0, 0, 0)

/** The band from \`mode\` ('split', 'band', 'broadband') and \`band\`, a Float64Array of split, fc and Q: the band and the
 *  detector's filters retuned, allocating nothing, when its edges move. (The numbers come in an array: a call V8 does not
 *  inline boxes the numbers passed to it.) */
function deesserBand(set, mode, band) {
  let k = set.k
  k[MODE] = mode === 'band' ? 1 : mode === 'broadband' ? 2 : 0; k[SPLIT] = band[0]; k[FC] = band[1]; k[QS] = band[2]
  deesserTune(set)
}

// The band cut: over \`split\`, or \`fc\` ± half its bandwidth in octaves (RBJ: BW = 2·asinh(1/2Q)/ln 2)
function deesserTune(set) {
  let k = set.k, sr = k[26], mode = k[MODE], top = 0.45 * sr
  let fc = Math.min(k[FC], top), split = Math.min(k[SPLIT], top), bw = 2 * Math.asinh(1 / (2 * k[QS])) / Math.LN2
  let lo = mode === 1 ? fc * 2 ** (-bw / 2) : split, hi = mode === 1 ? Math.min(top, fc * 2 ** (bw / 2)) : top
  k[6] = mode === 2 ? 1 : 0
  if (lo === k[31] && hi === k[32]) return
  k[31] = lo; k[32] = hi; k[33] = Math.min(BODY, lo)
  rbj(k, 7, 31, 0.5412, true); rbj(k, 12, 31, 1.3066, true); rbj(k, 17, 33, Math.SQRT1_2, false)
  band(set)
}

/** One block of one channel into \`out\` (which may be \`x\`), \`latency\` samples late, allocating nothing; returns \`out\`.
 *  \`s\`, the state (deesserState); \`buf\`, the delay line, Float64Array(latency + M + 1) (2M + 1 the band's taps); \`set\`,
 *  deesserSet's, its band set (deesserBand). */
function deessBlock(x, out, s, buf, set) {
  let k = set.k, h = set.h, M = h.length >> 1, R = buf.length, L = R - M - 1
  let threshold = k[0], ratio = k[1], knee = k[2], range = k[3], aA = k[4], aR = k[5], broad = k[6] === 1
  let b10 = k[7], b11 = k[8], b12 = k[9], a11 = k[10], a12 = k[11], b20 = k[12], b21 = k[13], b22 = k[14], a21 = k[15], a22 = k[16]
  let c0 = k[17], c1 = k[18], c2 = k[19], d1 = k[20], d2 = k[21], a = k[22], up = k[23], down = k[24], d = k[25]
  let z10 = s[0], z11 = s[1], z20 = s[2], z21 = s[3], zl0 = s[4], zl1 = s[5], ps = s[6], pb = s[7], pv = s[8], r = s[9]
  let y1 = s[10], y = s[11], bi = s[12] | 0
  for (let i = 0; i < x.length; i++) {
    let v = x[i]
    // sibilance: the band over lo (two high-pass sections, transposed direct form II) and the body under it
    let t = b10 * v + z10
    z10 = b11 * v - a11 * t + z11
    z11 = b12 * v - a12 * t
    let e = b20 * t + z20
    z20 = b21 * t - a21 * e + z21
    z21 = b22 * t - a22 * e
    let b = c0 * v + zl0
    zl0 = c1 * v - d1 * b + zl1
    zl1 = c2 * v - d2 * b
    ps = a * ps + (1 - a) * e * e
    pb = a * pb + (1 - a) * b * b
    let c = pb > pv ? up : down
    pv = c * pv + (1 - c) * pb
    r = d * r + (1 - d) * 10 * Math.log10((ps + 1e-30) / (Math.max(pb, 1e-3 * pv) + 1e-10))
    // the cut, dB ≥ 0, smoothed by the smooth decoupled peak detector
    let g = Math.min(range, -compressorGain(r, threshold, ratio, knee)), q = aR * y1 + (1 - aR) * g
    y1 = g > q ? g : q
    let cut = y = aA * y + (1 - aA) * y1
    buf[bi] = v
    let at = bi - L < 0 ? bi - L + R : bi - L, w = buf[at]                               // the input L samples back
    if (++bi === R) bi = 0
    if (broad) { out[i] = w * db2lin(-cut); continue }
    if (cut < 1e-4) { out[i] = w; continue }
    let acc = h[M] * w
    for (let j = 1, p = at, n = at; j <= M; j++) { if (++p === R) p = 0; if (--n < 0) n = R - 1; acc += h[M + j] * (buf[p] + buf[n]) }
    out[i] = w - (1 - db2lin(-cut)) * acc
  }
  s[0] = z10; s[1] = z11; s[2] = z20; s[3] = z21; s[4] = zl0; s[5] = zl1; s[6] = ps; s[7] = pb; s[8] = pv; s[9] = r
  s[10] = y1; s[11] = y; s[12] = bi
  return out
}

// The sibilance band's power (over \`lo\`, 4th-order Butterworth) over the voice body's (under \`body\`), dB, per sample.
// Each is a 5 ms mean square (the 902 senses RMS). The body's reference is floored 30 dB under the voice's running
// level (rising in 10 ms, falling in 1 s); under −100 dBFS nothing is an 's', so silence reads −200 dB. The ratio is
// smoothed over 1 ms in dB: filters starting from rest, and clicks, read high for a few samples; an 's' lasts tens of
// milliseconds. (deessBlock runs it; its sections are tuned here.)

// RBJ cookbook high- or low-pass section at fc = k[f], Q into k from o: b0, b1, b2, a1, a2 over a0 (Bristow-Johnson, "Audio
// EQ Cookbook"), each the expression @audio/biquad's highpass and lowpass evaluate, so the same numbers, made in place.
// Its numbers are read from k, not passed: a call V8 does not inline would box them
function rbj(k, o, f, Q, high) {
  let fc = k[f], sr = k[26], w = Math.PI * 2 * fc / sr, cw = Math.cos(w), alpha = Math.sin(w) / (2 * Q), a0 = 1 + alpha, e = high ? 1 + cw : 1 - cw
  k[o] = e / 2 / a0; k[o + 1] = (high ? -e : e) / a0; k[o + 2] = e / 2 / a0; k[o + 3] = -2 * cw / a0; k[o + 4] = (1 - alpha) / a0
}

// Linear-phase band [lo, hi] (hi at 0.45·sr: a high-pass), 2M + 1 taps into set.h: the difference of two Kaiser-windowed
// sincs (β 6, sidelobes ~ −44 dB), the low edge's own DC gain taken out so the band passes nothing at DC
function band(set) {
  let k = set.k, lo = k[31], hi = k[32], sr = k[26], h = set.h, win = set.win, th = set.th, M = h.length >> 1, top = hi >= 0.45 * sr, sl = 0, sh = 0
  for (let j = -M; j <= M; j++) {
    let l = sinc(lo, j, sr) * win[j + M], u = top ? 0 : sinc(hi, j, sr) * win[j + M]
    h[j + M] = l; th[j + M] = u; sl += l; sh += u
  }
  for (let j = -M; j <= M; j++) h[j + M] = (top ? (j ? 0 : 1) : th[j + M] / sh) - h[j + M] / sl
}
const sinc = (f, k, sr) => k ? Math.sin(2 * Math.PI * f / sr * k) / (Math.PI * k) : 2 * f / sr
const i0 = x => { let s = 1, t = 1; for (let k = 1; k < 32; k++) { t *= (x / 2 / k) ** 2; s += t } return s }

return { latency, tail, deesser, deesserStream, deesserSet, deesserState, deesserBand, deessBlock, default: deesser };
})();

const deesser = (() => {
const { deessBlock, deesserSet, deesserState, deesserBand, latency, tail } = module6;
const { timeCoef } = module5;
// atom manifest — wraps the de-esser kernel per @audio/compile CONTRACT.
// The sibilance band's level over the voice body's (dB, so any recording level)
// drives a cut held within \`range\`; \`mode\` applies it to the band over \`split\`
// (linear phase), to a band at fc, Q, or broadband. Each block comes out whole,
// \`lookahead\` ms late (declared latency): \`lookahead\` sets the delay, so it is fixed
// for an instance (restart). Every other param is live: read each block; the band and
// the detector's filters retuned when mode, split, fc or Q move the band's edges, the
// smoother's coefficients when attack or release changes; filter and smoother states
// kept. State, settings and the band are typed arrays made here; a block allocates
// nothing. Tail: the linear-phase band reads 1.5 ms past the delayed sample.

const deesser = (ctx) => {
	const sr = ctx.sampleRate, L = latency(sr, ctx.params.lookahead[0]), set = deesserSet(sr), k = set.k, st = [], bufs = []
	const at = new Float64Array(2).fill(NaN), band = new Float64Array(3).fill(NaN)
	let mode = null
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) { st.push(deesserState()); bufs.push(new Float64Array(L + (set.h.length >> 1) + 1)) }
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const a = params.attack[0], r = params.release[0], sp = params.split[0], f = params.fc[0], q = params.Q[0]
		k[0] = params.threshold[0]; k[1] = params.ratio[0]; k[2] = params.knee[0]; k[3] = Math.abs(params.range[0])
		if (a !== at[0]) { at[0] = a; k[4] = timeCoef(a, sr) }
		if (r !== at[1]) { at[1] = r; k[5] = timeCoef(r, sr) }
		if (params.mode !== mode || sp !== band[0] || f !== band[1] || q !== band[2]) { mode = params.mode; band[0] = sp; band[1] = f; band[2] = q; deesserBand(set, mode, band) }
		for (let c = 0; c < inp.length; c++) deessBlock(inp[c], out[c], st[c], bufs[c], set)
	}
}
deesser.channels = 'any'
deesser.latency = (ctx) => latency(ctx.sampleRate, ctx.params.lookahead[0])
deesser.tail = (at) => tail(at.sampleRate, at.params.mode)
deesser.params = {
	mode:      { type: 'enum', values: ['split', 'band', 'broadband'], default: 'split' },
	split:     { type: 'number', min: 1000, max: 16000, default: 3500, unit: 'Hz' },
	fc:        { type: 'number', min: 2000, max: 16000, default: 6500, unit: 'Hz', alias: 'freq' },
	Q:         { type: 'number', min: 0.3, max: 10, default: 1.4, alias: 'q' },
	threshold: { type: 'number', min: -12, max: 24, default: 0, unit: 'dB' },
	ratio:     { type: 'number', min: 1, max: 20, default: 4 },
	range:     { type: 'number', min: -24, max: 0, default: -8, unit: 'dB' },
	knee:      { type: 'number', min: 0, max: 24, default: 6, unit: 'dB' },
	attack:    { type: 'number', min: 0.1, max: 100, default: 1, unit: 'ms' },
	release:   { type: 'number', min: 1, max: 1000, default: 15, unit: 'ms' },
	lookahead: { type: 'number', min: 0, max: 20, default: 5, unit: 'ms', restart: true },
}

return deesser;
})();
`;