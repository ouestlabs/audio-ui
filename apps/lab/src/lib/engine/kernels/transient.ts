export const TRANSIENT_KERNELS = `const module0 = (() => {
/**
 * Transient shaper — independently boosts/cuts attack and sustain portions.
 * A level follower (1 ms attack, 100 ms release) and a slow follower of that level
 * (50 ms attack, instant release) separate transient from sustain.
 */

let {abs, exp} = Math

function transientShaper (data, params) {
	let s = ENV, k = SET
	transientSet(k, params.fs || 44100)
	k[3] = params.attackGain ?? 0     // linear gain delta: >0 emphasize, <0 suppress
	k[4] = params.sustainGain ?? 0
	s[0] = params._envFast ?? 0
	s[1] = params._envSlow ?? 0
	transientBlock(data, data, s, k)
	params._envFast = s[0]
	params._envSlow = s[1]
	return data
}
const ENV = new Float64Array(2), SET = new Float64Array(5)

/** The followers' coefficients at \`fs\` Hz into \`k\`'s first three slots (transientBlock's): the level's attack (1 ms)
 *  and release (100 ms), its slow copy's rise (50 ms). */
function transientSet (k, fs) {
	k[0] = exp(-1 / (0.001 * fs))
	k[1] = exp(-1 / (0.05 * fs))
	k[2] = exp(-1 / (0.1 * fs))
	return k
}

/** One block of one channel into \`out\` (which may be \`x\`), allocating nothing. \`s\`, the state: Float64Array(2), the
 *  level and its slow copy. \`k\`, the settings: Float64Array(5), transientSet's three coefficients, attackGain and
 *  sustainGain. \`g\`: attackGain and sustainGain for each sample, as a host's ramp moves them (Float64Array, from 0 and
 *  M); empty (the default), \`k\`'s. */
function transientBlock (x, out, s, k, g = NONE, M = 0) {
	let aFast = k[0], aSlow = k[1], aRel = k[2], attackGain = k[3], sustainGain = k[4], ramp = g.length > 0
	let envFast = s[0], envSlow = s[1]
	for (let i = 0, l = x.length; i < l; i++) {
		if (ramp) { attackGain = g[i]; sustainGain = g[M + i] }
		let v = x[i]
		let xAbs = abs(v)

		// Level: fast attack, slow release
		envFast = xAbs > envFast ? aFast * envFast + (1 - aFast) * xAbs : aRel * envFast
		// Slow copy of the level: rises 50× slower, falls with it, so it never exceeds it
		envSlow = envFast > envSlow ? aSlow * envSlow + (1 - aSlow) * envFast : envFast

		// Transient share of the level, 0..1: near 1 on attacks, near 0 on held material
		let transient = envFast > 1e-10 ? (envFast - envSlow) / envFast : 0

		// Gain stays within 1 + [min, max] of the two gains
		let gain = 1 + attackGain * transient + sustainGain * (1 - transient)
		out[i] = v * gain
	}
	s[0] = envFast
	s[1] = envSlow
	return out
}
const NONE = new Float64Array(0)

return { transientShaper, transientSet, transientBlock, default: transientShaper };
})();

const transientShaper = (() => {
const { transientBlock, transientSet } = module0;
// atom manifest — wraps the transient shaper kernel per @audio/compile CONTRACT.
// The kernel is causal (fast/slow envelope, no lookahead): transientBlock, the default
// export's loop, on one channel's level and slow copy in a typed array made here (the
// follower's fixed 1 ms/50 ms/100 ms constants at ctx.sampleRate, so nothing needs
// \`restart\`); a block allocates nothing. Its gain is 1 + attackGain·transient +
// sustainGain·(1 − transient), with transient from 0 to 1 (the kernel bounds it, so the
// gain stays between 1 + attackGain and 1 + sustainGain).
// attackGain and sustainGain scale the signal with nothing behind them, so each is
// smoothed (20 ms) and glided sample by sample (glide, below): a host's ramp of it is
// one line, however the host cut its calls; while neither moves they are k's, and the
// kernel runs as it ran.

const transientShaper = (ctx) => {
	const M = ctx.maxBlockSize, st = [], k = transientSet(new Float64Array(5), ctx.sampleRate)
	const g = new Float64Array(2 * GLIDE).fill(NaN), lanes = new Float64Array(2 * M)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) st.push(new Float64Array(2))
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const n = inp[0].length
		k[3] = params.attackGain[0]; k[4] = params.sustainGain[0]
		const moving = glide(g, 0, params.attackGain, lanes, 0, n, 0) | glide(g, 1, params.sustainGain, lanes, M, n, 0)
		for (let c = 0; c < inp.length; c++) transientBlock(inp[c], out[c], st[c], k, moving ? lanes : undefined, M)
	}
}
transientShaper.channels = 'any'
transientShaper.tail = 0
transientShaper.params = {
	attackGain:  { type: 'number', min: -1, max: 2, default: 0, smoothing: 0.02 },
	sustainGain: { type: 'number', min: -1, max: 2, default: 0, smoothing: 0.02 },
}

// A value that scales the signal, glided sample by sample so that a host's steps of it join into one line: the family's
// glide (the packages with a util.js keep their copy there, where its comment says why it plays the host's line 32
// frames late; this package ships no util.js). \`g\`: the memory, GLIDE slots a value from j·GLIDE (made NaN); \`src\`: the
// param's array; this call's \`n\` values go to \`row\` from \`at\`, as they are or (\`lin\` 1) as the gain e^(v·ln10/20) of a
// value in dB. Returns 1 while they move, 0 when every one is the value.
const GLIDE = 69
function glide (g, j, src, row, at, n, lin) {
	let o = j * GLIDE, r = o + 5, v = src[0], was = g[o]
	if (!(was === was)) { g[o] = v; g[o + 1] = 0; g[o + 2] = n; g[o + 3] = 0; g[o + 4] = 0 }
	else if (v !== was || g[o + 3] < 64) {
		let len = g[o + 2], L = len < 32 ? len : 32, w = (g[o + 1] + len) & 63, d = v - was, held = v === was ? Math.min(g[o + 3] + len, 63) : 0
		for (let q = 0; q < L; q++) g[r + ((w - L + q) & 63)] = was + d * q / L
		g[r + w] = v
		g[o] = v; g[o + 1] = w; g[o + 2] = n; g[o + 3] = held; g[o + 4] = 0
		if (held < 32) {
			for (let i = 0; i < n; i++) {
				let u = i < 32 ? g[r + ((w + i - 32) & 63)] : v
				row[at + i] = lin ? Math.exp(u * (Math.LN10 / 20)) : u
			}
			return 1
		}
	} else { g[o + 1] = (g[o + 1] + g[o + 2]) & 63; g[o + 2] = n }
	// held 32 frames: the ring made all of the value once (a move from it reads the line from there), the row filled
	// with it as far as no call since it was held has filled it; from then on a call only moves the ring's position
	if (g[o + 3] < 64) { for (let q = 0; q < 64; q++) g[r + q] = v; g[o + 3] = 64 }
	if (g[o + 4] < n) {
		let u = lin ? Math.exp(v * (Math.LN10 / 20)) : v
		for (let i = 0; i < n; i++) row[at + i] = u
		g[o + 4] = n
	}
	return 0
}

return transientShaper;
})();
`;