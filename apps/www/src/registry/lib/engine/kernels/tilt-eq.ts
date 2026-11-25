/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/biquad` 1.3.0 (MIT, Dmitry Iv.): `lowshelf`, `highshelf`, `filter`
 * - `@audio/eq-tilt` 1.3.1 (MIT, Dmitry Iv.): `tilt`
 */
export const TILT_EQ_KERNELS = `const { lowshelf, highshelf, filter } = (() => {
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

return { lowshelf, highshelf, filter };
})();

const tilt = (() => {
/**
 * Tilt EQ — see-saw around a pivot frequency.
 * One knob: positive tilts bass up / treble down, negative does the opposite.
 *
 * @module  audio-filter/eq/tilt
 */

function tilt (data, params) {
	let gain = params.gain ?? 0       // dB: positive = bass boost / treble cut
	let pivot = params.pivot || 1000  // Hz
	let fs = params.fs || 44100

	if (!params._lo) { params._lo = {}; params._hi = {} }

	if (params._gain !== gain || params._pivot !== pivot || params._fs !== fs) {
		params._lo.coefs = [lowshelf(pivot, 0.5, fs, gain)]
		params._hi.coefs = [highshelf(pivot, 0.5, fs, -gain)]
		params._gain = gain; params._pivot = pivot; params._fs = fs
	}

	filter(data, params._lo)
	filter(data, params._hi)

	return data
}

return tilt;
})();
`;
