export const PHASER_KERNELS = `const phaser = (() => {
/**
 * Phaser — cascade of swept first-order allpass filters creating moving notches/peaks
 */

let {sin, tan, PI} = Math

// the allpass cascade's first n stages on x, each first-order with coefficient a and its state at ap[2s], ap[2s + 1];
// what enters stage \`at\` (the output of the first \`at\`) is kept in tap[0]. A function of its own, called from one place:
// as a loop inside the sample loop, or called from two places, it had V8 box a number at every sample
const tap = new Float64Array(1)
function chain (ap, n, a, x, at) {
	for (let s = 0; s < n; s++) {
		if (s === at) tap[0] = x
		let x1 = ap[s * 2], y1 = ap[s * 2 + 1]
		let y = a * x + x1 - a * y1
		ap[s * 2] = x
		ap[s * 2 + 1] = y
		x = y
	}
	return x
}

// A new count of stages is reached by a crossfade this long, in seconds, carried across calls, so a host's way of
// cutting its calls cannot shorten it: as long as the family's smoothing, a whole cycle of 50 Hz, and short enough to
// follow a hand. Faded across the one call after the change, it lasted as long as that call: a step in a call of one
// frame
const FADE = 0.02

// \`feedbacks\`, when given, holds the feedback for each sample of \`data\` (the /audio manifest's glide of a moving
// feedback), in place of params.feedback
function phaser (data, params = {}, feedbacks) {
	let rate = params.rate == null ? 0.5 : params.rate
	let depth = params.depth == null ? 0.7 : params.depth
	let stages = (params.stages || 4) | 0
	let feedback = params.feedback == null ? 0.5 : params.feedback
	let fc = params.fc || 1000
	// stereo: channel c's LFO runs c × \`phase\` degrees ahead of channel 0's (Logic Pro's Phase: 0 moves the channels
	// together, ±180 sets them farthest apart); default 90, quadrature, as Korg's X5DR Quadrature Chorus
	let offset = params.phase == null ? 90 : params.phase
	let channel = params.channel || 0  // index of the channel this call processes
	let fs = params.fs || 44100
	let lead = channel ? channel * offset * PI / 180 : 0  // rad; 0 on channel 0, so a mono signal never depends on phase
	// a new lead is reached across this call from the one the last call ended on, so the sweep glides instead of jumping;
	// a host ramps a smoothed \`phase\` in short calls, and this joins its steps into one line
	// where the last call ended, for this one to glide from: NaN before the first call (only finite values are kept,
	// in a Float64Array: kept as numbers on the params object, they boxed in V8 once two instances had run)
	let ended = params._glide ??= new Float64Array(2).fill(NaN)
	let from = ended[0] === ended[0] ? ended[0] : lead, glide = lead - from
	// fc retunes the allpasses every sample, so a new fc glides across the call in the same way: a host ramps a smoothed
	// fc in short calls, and the coefficients follow it sample by sample instead of stepping at each call
	let fcFrom = ended[1] === ended[1] ? ended[1] : fc, fcGlide = fc - fcFrom

	// stages can change live: the state holds the most stages asked for so far (more grow it, keeping the stages it
	// has). A new count is reached by a crossfade of FADE seconds, carried across calls, from the cascade of the count in
	// force to the new one's, the stages that enter starting from silence; a count asked while one is under way is
	// faded to where it ends. The count in force (0 before the first call), the count faded to, the frames into the fade
	let count = params._stages ??= new Int32Array(3)
	if (!params._ap || params._ap.length < stages * 2) {
		let grown = new Float64Array(stages * 2)
		if (params._ap) grown.set(params._ap)
		params._ap = grown
		params._phase ??= 0
		params._fb ??= 0
	}
	if (!count[0]) count[0] = count[1] = stages
	let ap = params._ap, phase = params._phase, fb = params._fb
	let was = count[0], to = count[1], k = count[2], L = Math.max(1, Math.round(FADE * fs))
	let inc = 2 * PI * rate / fs

	for (let i = 0, l = data.length; i < l; i++) {
		let lfo = sin(phase + from + glide * (i + 1) / l)
		phase += inc
		if (phase > 2 * PI) phase -= 2 * PI

		let f = (fcFrom + fcGlide * (i + 1) / l) * (1 + depth * lfo)
		let t = tan(PI * f / fs)
		let a = (t - 1) / (t + 1)

		let x = data[i] + (feedbacks ? feedbacks[i] : feedback) * fb

		if (was === to && stages !== was) {
			if (stages > was) ap.fill(0, was * 2, stages * 2)
			to = stages; k = 0
		}
		let lo = was < to ? was : to, hi = was < to ? to : was
		x = chain(ap, hi, a, x, lo < hi ? lo : -1)
		if (lo < hi) {
			let y = tap[0], s = ++k / L
			x = was < to ? y + (x - y) * s : x + (y - x) * s
			if (k === L) was = to
		}

		fb = x
		data[i] = (data[i] + x) * 0.5
	}

	params._phase = phase
	params._fb = fb
	count[0] = was; count[1] = to; count[2] = k
	// kept only when finite, so the next call never glides from a value that is not finite
	if (data.length && Number.isFinite(lead)) ended[0] = lead
	if (data.length && Number.isFinite(fc)) ended[1] = fc

	return data
}

return phaser;
})();
`;