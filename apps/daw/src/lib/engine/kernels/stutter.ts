export const STUTTER_KERNELS = `const stutter = (() => {
/**
 * Stutter / beat-repeat — every interval, capture a slice and retrigger it for the
 * rest of the interval (Ableton Beat Repeat class). Edge fades kill retrigger clicks;
 * decay attenuates successive repeats; mix blends against the uninterrupted dry.
 */

// \`lanes\`, when given, holds decay and mix for each sample of \`data\`, M apart (the /audio manifest's glide of moving
// values), in place of the params'
function stutter (data, params = {}, lanes, M) {
	let interval = params.interval ?? 0.5    // capture cycle, s
	let slice = params.slice ?? 0.125        // captured slice length, s
	let decay = params.decay ?? 0            // 0..1 amplitude loss per repeat
	let mix = params.mix ?? 1
	let fs = params.fs || 44100

	// nearest frames: a Float32 time truncated lands a frame early, and every repeat with it
	let iN = Math.max(1, Math.round(interval * fs) | 0)
	let sN = Math.max(32, Math.min(Math.round(slice * fs) | 0, iN))

	// the capture buffer holds the longest slice asked so far (the /audio factory makes it for slice's max); a longer
	// slice grows it, keeping what the cycle under way captured
	if (!params._slice || params._slice.length < sN) {
		let grown = new Float64Array(sN)
		if (params._slice) grown.set(params._slice)
		params._slice = grown
	}
	// a new interval or slice takes effect where the next cycle starts: the cycle under way keeps the lengths it started
	// with (frames, kept here), so no repeat is cut short or stretched part way through
	let cycle = params._cycle ??= new Int32Array(2)
	let buf = params._slice, pos = params._pos ?? 0      // position within the interval cycle
	let cI = cycle[0], cS = cycle[1], fade = Math.min(64, cS >> 2)

	for (let i = 0, l = data.length; i < l; i++) {
		if (pos === 0) { cI = iN; cS = sN; fade = Math.min(64, sN >> 2) }
		let x = data[i]
		let wet
		if (pos < cS) {                        // capture phase — pass dry, record
			buf[pos] = x
			wet = x
		} else {                               // repeat phase
			let k = pos - cS
			let rep = 1 + ((k / cS) | 0)         // repeat number (1-based)
			let n = k % cS
			let g = (1 - (lanes ? lanes[i] : decay)) ** rep
			let win = Math.min(1, n / fade, (cS - 1 - n) / fade)
			wet = buf[n] * g * win
		}
		let m = lanes ? lanes[M + i] : mix
		data[i] = x * (1 - m) + wet * m
		if (++pos >= cI) pos = 0
	}
	params._pos = pos
	cycle[0] = cI; cycle[1] = cS
	return data
}

return stutter;
})();
`;