/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/effect-chorus` 2.1.1 (MIT, Dmitry Iv.): `chorus`
 */
export const CHORUS_KERNELS = `const chorus = (() => {
/**
 * Chorus — multiple detuned delay lines for ensemble thickening
 */

let {sin, floor, PI} = Math

// the summed reads of \`voices\` voices from the ring buf, of N samples, written at ptr: voice v's read sits
// d · (1 + dp · sin(phases[v] + ld)) samples back, and its LFO phase steps by inc. A function of its own: as a loop
// inside the sample loop it had V8 box a number at every sample
function voicesAt (buf, N, ptr, phases, voices, ld, d, dp, inc) {
	let wet = 0
	for (let v = 0; v < voices; v++) {
		let dv = d * (1 + dp * sin(phases[v] + ld))
		phases[v] += inc
		if (phases[v] > 2 * PI) phases[v] -= 2 * PI

		// ptr − dv is negative near the ring's start; the ring holds every dv of depth 0 to 1
		let readPos = ((ptr - dv) % N + N) % N

		let idx = floor(readPos)
		let frac = readPos - idx
		let a = buf[idx % N]
		let b = buf[(idx + 1) % N]
		wet += a + frac * (b - a)
	}
	return wet
}

// n voices spaced 360/n degrees of LFO apart from voice 0 of \`phases\`, written to \`next\`; returns n
function space (next, phases, n) {
	for (let v = 0; v < n; v++) next[v] = (phases[0] + v / n * 2 * PI) % (2 * PI)
	return n
}

// A new count of voices is reached by a crossfade this long, in seconds, carried across calls, so a host's way of
// cutting its calls cannot shorten it: as long as the family's smoothing, a whole cycle of 50 Hz, and short enough to
// follow a hand. Faded across the one call after the change, it lasted as long as that call: a step in a call of one
// frame
const FADE = 0.02

// How far the centre of the reads may move in a frame while the delay moves, as effect-delay's read moves while its
// time does: a tape head runs no slower than half speed and no faster than double. A voice reads d · (1 + dp · sin)
// back, so the centre d moves by at most GROW / (1 + dp) a frame as it grows and SHRINK / (1 + dp) as it shrinks, and
// the move bends each voice by an octave at most, besides its LFO. A host's 20 ms ramp from 14 to 38 ms asks 1.2
// frames a frame at 44.1 kHz, which would run the reads backwards
const GROW = 0.5, SHRINK = 1

function chorus (data, params = {}) {
	let rate = params.rate == null ? 1.5 : params.rate
	let depth = params.depth == null ? 0.5 : params.depth
	let delay = params.delay == null ? 0.02 : params.delay  // seconds
	let voices = Math.max(1, (params.voices || 3) | 0)  // integer ≥ 1 — wet/voices below
	// stereo: a channel's voices sit 360/voices degrees of LFO apart, so its voice set repeats every 360/voices degrees,
	// and \`phase\` is the offset between adjacent channels within that cycle: channel c's LFOs run c × phase / voices
	// degrees ahead of channel 0's. 0 moves the channels together, ±180 puts a channel's voices halfway between those of
	// the channel before (as far apart as they get), and with one voice it is LFO degrees, as Logic Pro's Phase.
	// Default 90, a quarter of the spacing: with one voice that is quadrature, as Korg's X5DR Quadrature Chorus
	let offset = params.phase == null ? 90 : params.phase
	let channel = params.channel || 0  // index of the channel this call processes
	let fs = params.fs || 44100

	// the ring holds delays 0 to maxDelay − 1 (each sample is written before the reads). A read at d takes the samples
	// ceil(d) and ceil(d) − 1 back; the farthest d, 2·delay·fs at depth 1 (a hair over when rounding lifts it past a
	// whole number), needs floor(2·delay·fs) + 1 back
	let maxDelay = Math.floor(delay * 2 * fs) + 2
	let delaySamples = delay * fs
	// rad; 0 on channel 0, so a mono signal never depends on phase. A set of n voices leads by turn / n: during a
	// crossfade between counts each set keeps its own lead
	let turn = channel ? channel * offset * PI / 180 : 0
	// a new lead is reached across this call from the one the last call ended on, so the reads glide instead of jumping;
	// a host ramps a smoothed \`phase\` in short calls, and this joins its steps into one line
	// where the last call ended, for this one to glide from: NaN before the first call (only finite values are kept,
	// in a Float64Array: kept as numbers on the params object, they boxed in V8 once two instances had run)
	let ended = params._glide ??= new Float64Array(4).fill(NaN)
	let from = ended[0] === ended[0] ? ended[0] : turn, glide = turn - from
	// depth moves every read too, so a new depth glides across the call in the same way, and so does the delay, its
	// centre following that line at the speed it asks, up to GROW and SHRINK, a farther move going on across the calls
	// that follow until it is on the delay (where the centre was is kept, in frames)
	let depthFrom = ended[1] === ended[1] ? ended[1] : depth, depthGlide = depth - depthFrom
	let delayFrom = ended[2] === ended[2] ? ended[2] : delaySamples, delayGlide = delaySamples - delayFrom, at = ended[3] === ended[3] ? ended[3] : delayFrom

	// a ring made for a longer delay holds this one: its whole length is the ring, so a shorter delay keeps every
	// sample at its age. A longer delay than it holds makes a ring for it anew
	if (!params.buffer || params.buffer.length < maxDelay) {
		params.buffer = new Float64Array(maxDelay)
		params.ptr = 0
	}
	// voices can change live: the first call spaces them 360/voices degrees of LFO apart. A new count is reached by a
	// crossfade of FADE seconds, carried across calls, from the voices in force to as many again spaced for the new
	// count from voice 0; a count asked while one is under way is faded to where it ends. The count in force (0 before
	// the first call), the count faded to, and the frames into the fade
	let count = params._voices ??= new Int32Array(3)
	if (!params._phases || params._phases.length < voices) {
		let grown = new Float64Array(voices), more = new Float64Array(voices)
		if (params._phases) { grown.set(params._phases); more.set(params._next) }
		params._phases = grown
		params._next = more
	}
	let phases = params._phases, next = params._next
	if (!count[0]) {
		for (let v = 0; v < voices; v++) phases[v] = v / voices * 2 * PI
		count[0] = count[1] = voices
	}
	let was = count[0], to = count[1], k = count[2], L = Math.max(1, Math.round(FADE * fs))
	let buf = params.buffer, ptr = params.ptr, N = buf.length
	let inc = 2 * PI * rate / fs

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		buf[ptr] = x

		let ld = from + glide * (i + 1) / l, dp = depthFrom + depthGlide * (i + 1) / l, want = delayFrom + delayGlide * (i + 1) / l
		at = want > at + GROW / (1 + dp) ? at + GROW / (1 + dp) : want < at - SHRINK / (1 + dp) ? at - SHRINK / (1 + dp) : want
		let d = at
		if (was === to && voices !== was) { to = space(next, phases, voices); k = 0 }
		let wet = voicesAt(buf, N, ptr, phases, was, ld / was, d, dp, inc) / was
		if (was !== to) {
			wet += (voicesAt(buf, N, ptr, next, to, ld / to, d, dp, inc) / to - wet) * (++k / L)
			// the new set is the one in force: the old one's array holds the next set to come
			if (k === L) { let old = phases; phases = next; next = old; was = to }
		}

		ptr = (ptr + 1) % N
		data[i] = (x + wet) * 0.5
	}

	params.ptr = ptr
	params._phases = phases
	params._next = next
	count[0] = was; count[1] = to; count[2] = k
	// kept only when finite, so the next call never glides from a value that is not finite
	if (data.length && Number.isFinite(turn)) ended[0] = turn
	if (data.length && Number.isFinite(depth)) ended[1] = depth
	if (data.length && Number.isFinite(delaySamples)) ended[2] = delaySamples
	if (data.length && at === at) ended[3] = at

	return data
}

return chorus;
})();
`;
