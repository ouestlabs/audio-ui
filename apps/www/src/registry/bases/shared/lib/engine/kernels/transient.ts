/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/dynamics-transient-shaper` 0.1.6 (MIT, Dmitry Iv.): `transientShaper`, as `module0`
 * - `@audio/dynamics-transient-shaper` 0.1.6 (MIT, Dmitry Iv.): `transientShaper`
 */
export const TRANSIENT_KERNELS = `const module0 = (() => {
/**
 * Transient shaper — independently boosts/cuts attack and sustain portions.
 * A level follower (1 ms attack, 100 ms release) and a slow follower of that level
 * (50 ms attack, instant release) separate transient from sustain.
 */

let {abs, exp} = Math

function transientShaper (data, params) {
	let attackGain = params.attackGain ?? 0     // linear gain delta: >0 emphasize, <0 suppress
	let sustainGain = params.sustainGain ?? 0
	let fs = params.fs || 44100

	let aFast = exp(-1 / (0.001 * fs))
	let aSlow = exp(-1 / (0.05 * fs))
	let aRel = exp(-1 / (0.1 * fs))

	let envFast = params._envFast ?? 0
	let envSlow = params._envSlow ?? 0

	for (let i = 0, l = data.length; i < l; i++) {
		let x = data[i]
		let xAbs = abs(x)

		// Level: fast attack, slow release
		envFast = xAbs > envFast ? aFast * envFast + (1 - aFast) * xAbs : aRel * envFast
		// Slow copy of the level: rises 50× slower, falls with it, so it never exceeds it
		envSlow = envFast > envSlow ? aSlow * envSlow + (1 - aSlow) * envFast : envFast

		// Transient share of the level, 0..1: near 1 on attacks, near 0 on held material
		let transient = envFast > 1e-10 ? (envFast - envSlow) / envFast : 0

		// Gain stays within 1 + [min, max] of the two gains
		let gain = 1 + attackGain * transient + sustainGain * (1 - transient)
		data[i] = x * gain
	}

	params._envFast = envFast
	params._envSlow = envSlow

	return data
}

return { transientShaper, default: transientShaper };
})();

const transientShaper = (() => {
const { default: transientShaperCurve } = module0;
// atom manifest — wraps the transient shaper kernel per @audio/compile CONTRACT.
// The kernel is causal (fast/slow envelope, no lookahead) and carries its continuation
// state (_envFast/_envSlow) on the options object passed in, mutating it in place. We
// own one such state object per channel in closure (fs fixed at construction; the
// kernel's own fixed 1ms/50ms envelope time constants aren't parameterized, so nothing
// needs \`restart\`) and refresh attackGain/sustainGain from the live params every block
// before calling the kernel directly on the (copied) output buffer.
//
// KNOWN KERNEL DEFECT (not fixed here — out of scope for a manifest wrapper): the
// kernel's \`transient = diff/envSlow\` ratio (transient-shaper.js) is unbounded. Right
// after a cold start or a near-silent passage, envSlow sits near zero while envFast
// rises fast, so the ratio — and thus the output gain — can spike to 30-40x for a few
// milliseconds. \`attackGain\`/\`sustainGain\` are range-limited to [-1, 2] here to keep
// that spike survivable, but the instability is in the kernel's math, not the range.

const transientShaper = (ctx) => {
	const states = []
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) states.push({
		fs: ctx.sampleRate,
		attackGain: ctx.params.attackGain[0],
		sustainGain: ctx.params.sustainGain[0],
		_envFast: 0,
		_envSlow: 0,
	})
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const attackGain = params.attackGain[0], sustainGain = params.sustainGain[0]
		for (let c = 0; c < inp.length; c++) {
			const st = states[c]
			st.attackGain = attackGain
			st.sustainGain = sustainGain
			out[c].set(inp[c])
			transientShaperCurve(out[c], st)
		}
	}
}
transientShaper.channels = 'any'
transientShaper.tail = 0
transientShaper.params = {
	attackGain:  { type: 'number', min: -1, max: 2, default: 0 },
	sustainGain: { type: 'number', min: -1, max: 2, default: 0 },
}

return transientShaper;
})();
`;
