/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/effect-lofi` 1.2.1 (MIT, Dmitry Iv.): `lofi`
 */
export const LOFI_KERNELS = `const lofi = (() => {
/**
 * Lo-fi character (RC-20 class) — wow/flutter via LFO-modulated fractional delay,
 * bandwidth ceiling/floor one-poles, tape saturation, vinyl noise bed + sparse crackle.
 * Deterministic noise (seeded LCG) so renders are reproducible.
 */

let { sin, tanh, exp, PI } = Math

// How far the read may move in a frame, as effect-delay's read moves while its time does: a tape head runs no slower
// than half speed and no faster than double, so a new wow or flutter bends the tape by an octave at most. Their own
// LFOs move the read 0.016 frames a frame at most, well inside it; a jump of wow by 0.5 asks up to 33 frames at once
// at 44.1 kHz
const GROW = 0.5, SHRINK = 1

function lofi (data, params = {}) {
	let wow = params.wow ?? 0.3              // 0..1 — slow pitch drift (~0.7 Hz, up to 3 ms)
	let flutter = params.flutter ?? 0.2      // 0..1 — fast wobble (~7 Hz, up to 0.4 ms)
	let noise = params.noise ?? 0.1          // 0..1 — hiss bed level
	let crackle = params.crackle ?? 0.1      // 0..1 — impulse density/level
	let lowpass = params.lowpass ?? 6000     // bandwidth ceiling, Hz
	let highpass = params.highpass ?? 60     // rumble floor, Hz
	let drive = params.drive ?? 0.3          // 0..1 tape saturation
	let fs = params.fs || 44100

	let maxDelay = ((0.004 * fs) | 0) + 4
	if (!params._buf) {
		params._buf = new Float64Array(maxDelay * 2)
		params._w = 0; params._ph1 = 0; params._ph2 = 0
		params._lp1 = 0; params._lp2 = 0; params._lp3 = 0; params._hp = 0
		params._rnd = params.seed ?? 0x2545f491
		params._crk = 0
	}
	let buf = params._buf, N = buf.length, w = params._w
	let ph1 = params._ph1, ph2 = params._ph2, hp = params._hp
	let lp1 = params._lp1, lp2 = params._lp2, lp3 = params._lp3, rnd = params._rnd, crk = params._crk

	let aLp = 1 - exp(-2 * PI * lowpass / fs)
	let aHp = 1 - exp(-2 * PI * highpass / fs)
	let g = 1 + drive * 4
	let base = 0.004 * fs / 2                // center read offset
	// wow and flutter move the read, so a new value glides across the call from the one the last call ended on (a host
	// ramps a smoothed value in short calls, and this joins its steps into one line), and the read follows the line they
	// ask at the speed it asks, up to GROW and SHRINK. Where the last call ended: wow, flutter and the read's offset (NaN
	// before the first call; only finite values are kept)
	let ended = params._glide ??= new Float64Array(3).fill(NaN)
	let wowFrom = ended[0] === ended[0] ? ended[0] : wow, wowGlide = wow - wowFrom
	let fluFrom = ended[1] === ended[1] ? ended[1] : flutter, fluGlide = flutter - fluFrom, at = ended[2]

	for (let i = 0, l = data.length; i < l; i++) {
		buf[w] = data[i]
		// modulated fractional-delay read: wow + flutter
		let want = base + (wowFrom + wowGlide * (i + 1) / l) * 0.0015 * fs * sin(ph1) + (fluFrom + fluGlide * (i + 1) / l) * 0.0002 * fs * sin(ph2)
		let m = at = at === at ? want > at + GROW ? at + GROW : want < at - SHRINK ? at - SHRINK : want : want
		ph1 += 2 * PI * 0.7 / fs; ph2 += 2 * PI * 7 / fs
		let pos = w - m
		let b0 = Math.floor(pos), frac = pos - b0
		let s0 = buf[((b0 % N) + N) % N], s1 = buf[(((b0 + 1) % N) + N) % N]
		let x = s0 + frac * (s1 - s0)
		w = (w + 1) % N

		// tape saturation, gain-compensated
		if (drive > 0) x = tanh(x * g) / tanh(g)

		// vinyl bed: hiss + crackle impulses with exponential tails
		// the generator steps an LCG, written out at each step: through a function its state was boxed at every call
		if (noise > 0) { rnd = (rnd * 1664525 + 1013904223) >>> 0; x += (rnd / 4294967296 - 0.5) * noise * 0.02 }
		if (crackle > 0) {
			rnd = (rnd * 1664525 + 1013904223) >>> 0
			if (rnd / 4294967296 < crackle * 0.0004) { rnd = (rnd * 1664525 + 1013904223) >>> 0; crk = (rnd / 4294967296 - 0.5) * crackle * 0.8 }
			x += crk
			crk *= 0.92
		}

		// bandwidth: 3-pole LP ceiling (−18 dB/oct, tape-class), one-pole HP floor
		lp1 += aLp * (x - lp1)
		lp2 += aLp * (lp1 - lp2)
		lp3 += aLp * (lp2 - lp3)
		hp += aHp * (lp3 - hp)
		data[i] = lp3 - hp
	}
	params._w = w; params._ph1 = ph1; params._ph2 = ph2; params._hp = hp
	params._lp1 = lp1; params._lp2 = lp2; params._lp3 = lp3; params._rnd = rnd; params._crk = crk
	if (data.length && Number.isFinite(wow)) ended[0] = wow
	if (data.length && Number.isFinite(flutter)) ended[1] = flutter
	if (data.length && at === at) ended[2] = at
	return data
}

return lofi;
})();
`;
