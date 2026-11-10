export const COMPANDER_KERNELS = `const module0 = (() => {
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

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

return { writer, concat, db2lin, lin2db };
})();

const module3 = (() => {
const { envelope } = module1;
const { writer, concat, db2lin, lin2db } = module2;

// Multi-segment compander (SoX \`compand\`). Arbitrary piecewise-linear transfer
// in dB. A single curve unifies compression, expansion and gating: points below
// the identity line reduce loud parts; points above raise quiet parts.
function compand(data, opts) {
  if (!(data instanceof Float32Array)) return writer(compandStream(data))
  let s = compandStream(opts)
  return concat(s.write(data), s.flush())
}

function compandStream(opts = {}) {
  // Points: [[inDb, outDb], ...]. Default = mild compression above -20 dB.
  let points = (opts.points || [[-90, -90], [-60, -60], [-20, -20], [0, -8]])
    .slice().sort((a, b) => a[0] - b[0])
  let env = envelope({ ...opts, attack: opts.attack ?? 5, release: opts.release ?? 200 })

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let lvl = lin2db(env(x))
        let mapped = transfer(points, lvl)
        out[i] = x * db2lin(mapped - lvl)
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}

function transfer(points, x) {
  if (x <= points[0][0]) return points[0][1] + (x - points[0][0])
  if (x >= points[points.length - 1][0]) {
    let [xE, yE] = points[points.length - 1]
    return yE + (x - xE)
  }
  for (let i = 1; i < points.length; i++) {
    let [x1, y1] = points[i]
    if (x <= x1) {
      let [x0, y0] = points[i - 1]
      let t = (x - x0) / (x1 - x0)
      return y0 + t * (y1 - y0)
    }
  }
  return x
}

return { compandStream, default: compand };
})();

const compand = (() => {
const { compandStream } = module3;
// atom manifest — wraps the SoX-style compand kernel per @audio/compile CONTRACT.
// The kernel's transfer curve is an arbitrary array of [inDb, outDb] points — arrays
// aren't a valid CONTRACT param type (number/enum/bool only). Scalarized: the input
// breakpoints stay fixed at the kernel's own default shape (-90/-60/-20/0 dB) and the
// four output levels become restart-flagged number params, assembled into a \`points\`
// array only at construction (stream-per-channel style, like the gate pilot).

const IN_DB = [-90, -60, -20, 0]

const compand = (ctx) => {
	const streams = []
	const opts = {
		sampleRate: ctx.sampleRate,
		points: IN_DB.map((inDb, i) => [inDb, ctx.params[\`out\${i}\`][0]]),
		attack: ctx.params.attack[0],
		release: ctx.params.release[0],
	}
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) streams.push(compandStream(opts))
	return (inputs, outputs) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		for (let c = 0; c < inp.length; c++) out[c].set(streams[c].write(inp[c]))
	}
}
compand.channels = 'any'
compand.tail = 0
compand.params = {
	out0:    { type: 'number', min: -90, max: 0, default: -90, unit: 'dB', flags: ['restart'] },
	out1:    { type: 'number', min: -90, max: 0, default: -60, unit: 'dB', flags: ['restart'] },
	out2:    { type: 'number', min: -90, max: 0, default: -20, unit: 'dB', flags: ['restart'] },
	out3:    { type: 'number', min: -90, max: 0, default: -8, unit: 'dB', flags: ['restart'] },
	attack:  { type: 'number', min: 0.1, max: 200, default: 5, unit: 'ms', flags: ['restart'] },
	release: { type: 'number', min: 1, max: 2000, default: 200, unit: 'ms', flags: ['restart'] },
}

return compand;
})();
`;