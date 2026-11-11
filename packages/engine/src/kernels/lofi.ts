/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/effect-lofi` 1.1.6 (MIT, Dmitry Iv.): `lofi`
 */
export const LOFI_KERNELS = `const lofi = (() => {
/**
 * Lo-fi character (RC-20 class) — wow/flutter via LFO-modulated fractional delay,
 * bandwidth ceiling/floor one-poles, tape saturation, vinyl noise bed + sparse crackle.
 * Deterministic noise (seeded LCG) so renders are reproducible.
 */

let { sin, tanh, exp, PI } = Math

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
	let rnd = () => ((params._rnd = (params._rnd * 1664525 + 1013904223) >>> 0) / 4294967296)

	let aLp = 1 - exp(-2 * PI * lowpass / fs)
	let aHp = 1 - exp(-2 * PI * highpass / fs)
	let g = 1 + drive * 4
	let base = 0.004 * fs / 2                // center read offset

	for (let i = 0, l = data.length; i < l; i++) {
		buf[w] = data[i]
		// modulated fractional-delay read: wow + flutter
		let m = base + wow * 0.0015 * fs * sin(ph1) + flutter * 0.0002 * fs * sin(ph2)
		ph1 += 2 * PI * 0.7 / fs; ph2 += 2 * PI * 7 / fs
		let pos = w - m
		let b0 = Math.floor(pos), frac = pos - b0
		let s0 = buf[((b0 % N) + N) % N], s1 = buf[(((b0 + 1) % N) + N) % N]
		let x = s0 + frac * (s1 - s0)
		w = (w + 1) % N

		// tape saturation, gain-compensated
		if (drive > 0) x = tanh(x * g) / tanh(g)

		// vinyl bed: hiss + crackle impulses with exponential tails
		if (noise > 0) x += (rnd() - 0.5) * noise * 0.02
		if (crackle > 0) {
			if (rnd() < crackle * 0.0004) params._crk = (rnd() - 0.5) * crackle * 0.8
			x += params._crk
			params._crk *= 0.92
		}

		// bandwidth: 3-pole LP ceiling (−18 dB/oct, tape-class), one-pole HP floor
		params._lp1 += aLp * (x - params._lp1)
		params._lp2 += aLp * (params._lp1 - params._lp2)
		params._lp3 += aLp * (params._lp2 - params._lp3)
		hp += aHp * (params._lp3 - hp)
		data[i] = params._lp3 - hp
	}
	params._w = w; params._ph1 = ph1; params._ph2 = ph2; params._hp = hp
	return data
}

return lofi;
})();
`;
