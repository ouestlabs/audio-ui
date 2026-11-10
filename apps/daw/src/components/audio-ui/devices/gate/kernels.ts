export const GATE_KERNELS = `const module0 = (() => {
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

const db2lin = (db) => Math.pow(10, db / 20)

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

return { writer, concat, db2lin, timeCoef };
})();

const module3 = (() => {
const { envelope } = module1;
const { writer, concat, db2lin, timeCoef } = module2;

// Noise gate with hysteresis, hold-then-close logic, look-ahead and smoothed
// gain transitions. The trigger envelope opens above \`threshold\` and, once
// open, only closes below \`closeThreshold\` (hysteresis prevents chatter near
// a single threshold); \`hold\` ms keeps the gate open after the level drops;
// attack/release smooth the gain trajectory. \`lookahead\` delays emission
// behind detection so the gate is already opening when a transient reaches
// the output — batch calls stay sample-aligned (write + flush covers the full
// signal, no silence prefix, no dropped tail); per-block hosts get the delay
// declared as latency (see audio.js).
function gate(data, opts) {
  if (!(data instanceof Float32Array)) return writer(gateStream(data))
  let s = gateStream(opts)
  return concat(s.write(data), s.flush())
}

function gateStream(opts = {}) {
  let sr = opts.sampleRate || 44100
  let threshold = opts.threshold ?? -40
  let closeThreshold = Math.min(opts.closeThreshold ?? threshold - 6, threshold)
  let range = opts.range ?? -60
  let hold = opts.hold ?? 10
  let attackMs = opts.attack ?? 0.1
  let releaseMs = opts.release ?? 100
  let lookahead = opts.lookahead ?? 0

  // Fast envelope drives the trigger; separate coefficients smooth the gate gain.
  let env = envelope({ sampleRate: sr, attack: 0.1, release: 5, detector: opts.detector })
  let openLin = db2lin(threshold)
  let closeLin = db2lin(closeThreshold)
  let closedLin = db2lin(range)
  let aa = timeCoef(attackMs, sr)
  let ar = timeCoef(releaseMs, sr)
  let holdSamp = Math.max(0, Math.round(hold * 0.001 * sr))
  let laSamp = Math.max(0, Math.round(lookahead * 0.001 * sr))

  let g = closedLin
  let held = 0
  let open = false
  let buf = laSamp ? new Float32Array(laSamp) : null
  let bi = 0, pending = 0

  // Detection consumes the incoming sample; with look-ahead, emission returns a
  // sample laSamp behind it scaled by the *current* gain — the gate state at
  // emission already reflects material laSamp ahead, so attacks open in time.
  function step(x) {
    let e = env(x)
    let target
    if (e > openLin) { open = true; held = holdSamp; target = 1 }
    else if (held > 0) { held--; target = 1 }
    else if (open && e > closeLin) target = 1     // hysteresis band: stay open
    else { open = false; target = closedLin }
    let c = target > g ? aa : ar
    g = c * g + (1 - c) * target
    if (!laSamp) return x * g
    if (pending < laSamp) { buf[bi] = x; bi = (bi + 1) % laSamp; pending++; return }
    let y = buf[bi] * g
    buf[bi] = x
    bi = (bi + 1) % laSamp
    return y
  }

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      let o = 0
      for (let i = 0; i < chunk.length; i++) {
        let y = step(chunk[i])
        if (y !== undefined) out[o++] = y
      }
      return o === chunk.length ? out : out.subarray(0, o)
    },
    flush() {
      let out = new Float32Array(pending)
      let o = 0
      while (o < out.length) {
        let y = step(0)
        if (y !== undefined) out[o++] = y
      }
      pending = 0
      return out
    }
  }
}

return { gateStream };
})();

const gate = (() => {
const { gateStream } = module3;
// atom manifest — wraps the dynamics gate kernel per @audio/compile CONTRACT.
// The gate state machine (hysteresis, hold, trigger envelope, gain smoothing,
// look-ahead delay line) lives in gateStream; all params seed it at construction
// (flags: restart). With lookahead > 0 the delay line emits late — declared
// latency lets the host compensate (limiter pattern: short emissions during
// delay-line fill land at the block tail).

const gate = (ctx) => {
	const streams = []
	const opts = {
		sampleRate: ctx.sampleRate,
		threshold: ctx.params.threshold[0],
		closeThreshold: ctx.params.closeThreshold[0],
		range: ctx.params.range[0],
		hold: ctx.params.hold[0],
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
		lookahead: ctx.params.lookahead[0],
	}
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) streams.push(gateStream(opts))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) {
			const w = streams[c].write(inp[c]), y = out[c]
			if (w.length === y.length) y.set(w)
			else { y.fill(0, 0, y.length - w.length); y.set(w, y.length - w.length) }
		}
	}
}
gate.channels = 'any'
gate.latency = (ctx) => Math.round(ctx.params.lookahead[0] * 0.001 * ctx.sampleRate)
gate.tail = 0
gate.params = {
	threshold:      { type: 'number', min: -80, max: 0, default: -40, unit: 'dB', flags: ['restart'] },
	closeThreshold: { type: 'number', min: -90, max: 0, default: -46, unit: 'dB', flags: ['restart'] },
	range:          { type: 'number', min: -90, max: 0, default: -60, unit: 'dB', flags: ['restart'] },
	hold:           { type: 'number', min: 0, max: 500, default: 10, unit: 'ms', flags: ['restart'] },
	attack:         { type: 'number', min: 0.01, max: 100, default: 0.1, unit: 'ms', flags: ['restart'] },
	release:        { type: 'number', min: 1, max: 1000, default: 100, unit: 'ms', flags: ['restart'] },
	lookahead:      { type: 'number', min: 0, max: 50, default: 0, unit: 'ms', flags: ['restart'] },
}

return gate;
})();
`;