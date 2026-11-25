/**
 * audio.js kernels, each module as published, in its own scope, for an
 * `AudioWorklet`, which cannot import them:
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `timeCoef`, as `module0`
 * - `@audio/dynamics-envelope` 0.1.4 (MIT, Dmitry Iv.): `envelope`, as `module1`
 * - `@audio/dynamics-expander` 0.2.2 (MIT, Dmitry Iv.): `db2lin`, `lin2db`, `writer`, `concat`, as `module2`
 * - `@audio/dynamics-expander` 0.2.2 (MIT, Dmitry Iv.): `expander`, `expanderStream`, `expanderGain`, `upwardExpanderGain`, as `module3`
 * - `@audio/dynamics-unlimit` 0.2.1 (MIT, Dmitry Iv.): `db2lin`, `lin2db`, `timeCoef`, `writer`, `concat`, `GLIDE`, `glide`, as `module4`
 * - `@audio/dynamics-unlimit` 0.2.1 (MIT, Dmitry Iv.): `unlimit`, `unlimitStream`, `unlimitState`, `unlimitBlock`, `unlimitGain`, `unlimitDeficitGain`, as `module5`
 * - `@audio/dynamics-unlimit` 0.2.1 (MIT, Dmitry Iv.): `unlimit`
 */
export const UNLIMITER_KERNELS = `const module0 = (() => {
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

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

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

return { db2lin, lin2db, writer, concat };
})();

const module3 = (() => {
const { envelope } = module1;
const { writer, concat, db2lin, lin2db } = module2;

// Downward expander (\`mode: 'downward'\`, default): reduces gain below threshold
// by (T-L)·(ratio-1) dB, clamped at \`range\` dB of max reduction. Softer than a gate.
//
// Upward expander (\`mode: 'upward'\`): the de-compression complement — raises
// gain ABOVE threshold instead, undoing over-squashed dynamics. Four-quadrant
// dynamics taxonomy (Giannoulis, Massberg & Reiss 2012, JAES 60(6); Izhaki,
// Mixing Audio): downward/upward compression + downward/upward expansion.
// Classical substrate for de-limiting: transient-aware upward expansion
// restores crest factor a brickwall limiter flattened.
function expander(data, opts) {
  if (!(data instanceof Float32Array)) return writer(expanderStream(data))
  let s = expanderStream(opts)
  return concat(s.write(data), s.flush())
}

function expanderStream(opts = {}) {
  let mode = opts.mode ?? 'downward'
  let threshold = opts.threshold ?? -30
  let ratio = opts.ratio ?? 2
  let knee = opts.knee ?? 6
  // range's sign follows mode: downward is a max-reduction floor (negative),
  // upward is a max-lift ceiling (positive) — same shape as compressor's upRange.
  let range = opts.range ?? (mode === 'upward' ? 20 : -40)
  let gain = mode === 'upward' ? upwardExpanderGain : expanderGain
  let env = envelope(opts)

  return {
    write(chunk) {
      let out = new Float32Array(chunk.length)
      for (let i = 0; i < chunk.length; i++) {
        let x = chunk[i]
        let rDb = gain(lin2db(env(x)), threshold, ratio, knee, range)
        out[i] = x * db2lin(rDb)
      }
      return out
    },
    flush() { return new Float32Array(0) }
  }
}

// Soft-knee downward expansion curve. Returns gain reduction in dB (≤ 0).
function expanderGain(levelDb, threshold, ratio, kneeDb, rangeDb) {
  let d = levelDb - threshold
  let r
  if (d > kneeDb / 2) r = 0
  else if (d <= -kneeDb / 2) r = d * (ratio - 1)
  else {
    let x = d - kneeDb / 2
    r = -(ratio - 1) * x * x / (2 * kneeDb)
  }
  return r < rangeDb ? rangeDb : r
}

// Soft-knee upward expansion curve — the above-threshold complement of
// expanderGain. Returns gain LIFT in dB (≥ 0), clamped to \`rangeDb\`. Same
// engagement topology as compressorGain (off below threshold, engaged above);
// positive instead of negative, (ratio-1) coefficient instead of (1-1/ratio)
// — expander ratios are "dB out per dB in" beyond threshold, compressor
// ratios are "dB in per dB out".
function upwardExpanderGain(levelDb, threshold, ratio, kneeDb, rangeDb) {
  let d = levelDb - threshold
  let r
  if (d <= -kneeDb / 2) r = 0
  else if (d > kneeDb / 2) r = d * (ratio - 1)
  else {
    let x = d + kneeDb / 2
    r = (ratio - 1) * x * x / (2 * kneeDb)
  }
  return r > rangeDb ? rangeDb : r
}

return { expander, expanderStream, expanderGain, upwardExpanderGain, default: expander };
})();

const module4 = (() => {
// Local helpers (inlined family convention — no shared-dep package).

// e^(dB·ln10/20) and ln·20/ln10, not 10^(dB/20) and 20·log10: half the cost in V8 (exp and log take ~9 ns, pow
// and log10 ~17-19), a few double ulps from them, far under a float32 ulp.
const db2lin = (db) => Math.exp(db * (Math.LN10 / 20))

const lin2db = (lin) => 20 / Math.LN10 * Math.log(Math.max(Math.abs(lin), 1e-10))

// One-pole smoothing coefficient: y[n] = c·y[n-1] + (1-c)·x[n]. ms → coefficient.
function timeCoef(ms, sampleRate) {
  if (ms <= 0) return 0
  return Math.exp(-1 / (ms * 0.001 * sampleRate))
}

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

// A value that scales the signal, glided sample by sample so that a host's steps of it join into one line. A host hands
// each call the value at its first frame and, while a value moves (a \`smoothing\` ramp), calls with 32 frames at most
// (contract 1.0: Parameters, Time; What a host owes, 3). So the line through the values the calls bring, each at its
// call's first frame, is known 32 frames behind any call's first frame, however the host cut the calls; the glide plays
// it 32 frames late. Straight from the value of one call to the next's, it is the host's ramp itself, in the value's
// own unit, the same whether the host calls with 1, 32 or a mix of frames; drawn between each call's end and the next
// (a glide across each call), a ramp cut 32, 4, 32 would put 32 frames of it into 4. A value that follows a call of
// more than 32 frames came with no ramp: it is reached in a straight line over 32 frames. The first call of an
// instance starts on its value, and a value held 32 frames is the value itself, so a value that does not move is
// bit for bit what it was before the glide existed.
// \`g\`: the memory, GLIDE slots a value from j·GLIDE (made NaN): the value the last call brought, where in the ring its
// first frame is, its frames, the frames the line had been at that value before it (64 once held and the ring all of
// it; counted to 63 at most, so that a long call after a move cannot reach 64 before the ring is made all of it), how
// many of \`row\`'s hold it, then the line, a frame a slot, in a ring of 64. \`src\`: the param's array. The
// line's values for this call's \`n\` frames go to \`row\` from \`at\`: as they are, or with \`lin\` 1 the gain e^(v·ln10/20)
// of a value in dB, per sample, so the gain follows the host's ramp of the dB value. Returns 1 while they move, 0 when
// every one is the value (then \`row\` holds it, filled once, and a caller may run its kernel on the value alone). Only
// arrays and whole numbers cross the call.
const GLIDE = 69
function glide(g, j, src, row, at, n, lin) {
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

return { db2lin, lin2db, timeCoef, writer, concat, GLIDE, glide };
})();

const module5 = (() => {
const { upwardExpanderGain } = module3;
const { writer, concat, db2lin, lin2db, timeCoef } = module4;

// De-limiter — the classical, non-ML counterpart to iZotope Ozone 12's "Unlimiter"
// (Sept 2025), which introduced de-limiting as a category via a trained model. This
// atom does the same job with a transparent, inspectable recipe: transient-synchronous
// upward expansion, restoring the crest factor a brickwall limiter (or an over-eager
// bus compressor) flattened. Program-adaptive upward expansion gated to transients —
// one more cell in the four-quadrant dynamics taxonomy (Giannoulis, Massberg & Reiss
// 2012, JAES 60(6); Izhaki, Mixing Audio).
//
// Detector: a fast envelope (near-instant) and a slow envelope (sluggish), both
// @audio/dynamics-envelope's branching one-pole follower (written out in
// unlimitBlock, on typed state), both tracking the same input. Their gap in dB —
// "transientness" — is ~0 on sustained material AND on heavily-limited program
// (limiting flattens the fast/slow gap at former transients; that flatness is
// exactly what gets re-expanded from the residual micro-transients that survive
// limiting), and rises sharply on attacks. Gain lift follows transientness, not
// absolute level: an absolute-level upward expander would pump sustains; gating on
// transientness — not level — is what makes this a de-limiter and not a leveler.
//
// Curve: unlimitGain reuses upwardExpanderGain (@audio/dynamics-expander) as its
// gain-shape substrate rather than a hand-rolled min()/clamp — same soft-knee
// quadratic, with \`threshold\` pinned to KNEE/2 so the knee's lower half lands
// exactly at zero transientness (transientness can't go negative — max(0, ·) — so
// a knee centered on 0 like a normal expander's would waste its bottom half and,
// worse, leave a nonzero residual lift right at rest). The result: r(0) = 0 exactly,
// a quadratic soft launch through [0, KNEE], then a \`drive\` dB/dB linear slope
// beyond — no lift at all on sustained material, no hard corner at the resting state.
//
// Deficit mode (\`adaptive\`, default on) — the inverse-limiter insight: transientness
// alone cannot separate a limited attack from a natural one by its PRESENCE (any hard
// onset drives the fast envelope over the slow one), but it separates them perfectly
// by its SIZE — a brickwall limiter's fingerprint is attacks that are too small
// (3–8 dB of fast-over-slow where healthy program shows 12–25 dB). So the default
// mode lifts each onset by its transient DEFICIT: max(0, crestTarget − transientness),
// gated by onset presence (no onset → nothing to restore, however large the "deficit").
// Natural attacks at/above crestTarget get structurally ZERO lift — safety on dynamic
// material is a property of the curve, not a conservative default; flattened attacks
// get back exactly the dB they are missing. \`adaptive: false\` = raw proportional
// transient-following (a transient exaggerator, kept for manual sound design).
//
// v1 is zero-latency, no lookahead: it reacts to a transient already in progress, it
// cannot anticipate one. Lookahead attack-anticipation is a future option.
function unlimit(data, opts) {
  if (!(data instanceof Float32Array)) return writer(unlimitStream(data))
  let s = unlimitStream(opts)
  return concat(s.write(data), s.flush())
}

// Soft-knee width (dB) for the launch off the zero floor — see header. Not exposed
// as a param: it shapes unlimitGain's curve, not the detector or the amount/drive
// macro controls. Wide relative to a typical compressor/expander knee (6 dB, see
// @audio/dynamics-expander) because the quantity it's softening — transientness,
// not level — spans a much bigger natural range before it means anything.
const KNEE = 60

// Onset gate for deficit mode: lift engages only while an onset is actually in
// progress — transientness ramping 0 → 1 across [ONSET_FLOOR, ONSET_FLOOR + ONSET_SOFT]
// dB. Below the floor there is no attack to restore (sustains, silence).
const ONSET_FLOOR = 1.5
const ONSET_SOFT = 3

function unlimitStream(opts = {}) {
  let sr = opts.sampleRate || 44100
  let amount = opts.amount ?? 6
  let drive = opts.drive ?? 1
  let ceiling = opts.ceiling ?? null
  let ceilLin = ceiling == null ? Infinity : db2lin(ceiling)
  let adaptive = opts.adaptive ?? true
  let crestTarget = opts.crestTarget ?? 10

  // Two followers of |x|, fast and slow; a third smooths the target lift with the fast
  // one's own ballistics, so gain-curve corners and the amount/drive clamps don't zipper
  // sample-to-sample.
  let fastAttack = timeCoef(opts.fastAttack ?? 0.5, sr), fastRelease = timeCoef(opts.fastRelease ?? 20, sr)
  let slowAttack = timeCoef(opts.slowAttack ?? 20, sr), slowRelease = timeCoef(opts.slowRelease ?? 200, sr)

  // Deficit-mode gating, three pieces (each kills a distinct false-lift mode):
  // 1. Peak hold — an attack's size is its PEAK transientness, not the values its
  //    ramp transits through: hold the running max (release ~150 dB/s) and evaluate
  //    the deficit against it, so a healthy hit that shoots past crestTarget within
  //    a millisecond reads deficit-free from that moment on.
  // 2. Attack window — an attack is where transientness RISES; the long decay walking
  //    back down through the deficit range is not an onset (a decaying hit keeps the
  //    fast envelope above the slow one for its entire tail). Lift is allowed only
  //    within ~10 ms of a fresh peak; the tail is hard-gated regardless of deficit.
  // 3. Confirmation ramp (~3 ms) — keeps the rise transit itself from latching into
  //    the lift smoother: a healthy attack blows past crestTarget within ~1.5 ms
  //    (3× the fast envelope's 0.5 ms attack), collapsing its own deficit before the
  //    ramp opens; a limiter-flattened attack PLATEAUS its small transientness for
  //    the limiter's release duration (many ms), so its deficit is still standing
  //    when confirmation completes.
  // A flattened (limited) onset holds its small transientness plateau for many ms —
  // fresh peaks keep re-arming the window and the deficit stays open, so restoration
  // engages exactly there and nowhere else.
  // The state: the hold (xHold, dB), the samples since a fresh peak (attackT, from Infinity), the confirmation (0..1).
  let holdStep = 150 / sr // dB per sample
  let confirmStep = 1 / (0.003 * sr)
  let attackWin = Math.round(0.010 * sr) // samples
  let k = Float64Array.of(amount, drive, adaptive ? 1 : 0, crestTarget, ceilLin, fastAttack, fastRelease, slowAttack, slowRelease, holdStep, confirmStep, attackWin)
  let s = unlimitState()

  return {
    write(chunk) { return unlimitBlock(chunk, new Float32Array(chunk.length), s, k) },
    flush() { return new Float32Array(0) }
  }
}

/** One channel's state for unlimitBlock: the fast, slow and smoothing followers, xHold, attackT, confirm. */
const unlimitState = () => Float64Array.of(0, 0, 0, 0, Infinity, 0)

/** One block of one channel into \`out\` (which may be \`x\`), allocating nothing. \`s\`, the state (unlimitState). \`k\`,
 *  the settings: Float64Array(12), amount, drive, 1 for adaptive (0: proportional), crestTarget, the ceiling (linear,
 *  Infinity for none), the fast followers' attack and release coefficients, the slow one's, holdStep (dB a sample),
 *  confirmStep (a sample), attackWin (samples). \`cl\`: the ceiling (linear) for each sample (Float64Array, as long or
 *  longer), as a host's ramp moves it; empty (the default), \`k\`'s. */
function unlimitBlock(x, out, s, k, cl = NONE) {
  let amount = k[0], drive = k[1], adaptive = k[2] === 1, crestTarget = k[3], ceil = k[4], aF = k[5], rF = k[6], aS = k[7], rS = k[8]
  let holdStep = k[9], confirmStep = k[10], attackWin = k[11], ramp = cl.length > 0
  let fast = s[0], slow = s[1], smooth = s[2], xHold = s[3], attackT = s[4], confirm = s[5]
  for (let i = 0; i < x.length; i++) {
    let v = x[i], mag = v < 0 ? -v : v, c = mag > fast ? aF : rF
    fast = c * fast + (1 - c) * mag
    c = mag > slow ? aS : rS
    slow = c * slow + (1 - c) * mag
    let fastDb = lin2db(fast), slowDb = lin2db(slow)
    if (adaptive) {
      let t = fastDb - slowDb
      if (t < 0) t = 0
      if (t > xHold) { xHold = t; attackT = 0 }
      else { xHold = xHold - holdStep > 0 ? xHold - holdStep : 0; attackT++ }
      confirm = t > ONSET_FLOOR ? (confirm + confirmStep > 1 ? 1 : confirm + confirmStep) : 0
    }
    // both lifts, whichever mode: a call alone in a branch V8 compiled before it ran stays a call that boxes its numbers
    let deficit = confirm * unlimitDeficitGain(xHold, crestTarget, amount, drive), proportional = unlimitGain(fastDb, slowDb, amount, drive)
    let target = !adaptive ? proportional : attackT < attackWin ? deficit : 0
    mag = target < 0 ? -target : target
    c = mag > smooth ? aF : rF
    smooth = c * smooth + (1 - c) * mag
    let y = v * db2lin(smooth), ceilLin = ramp ? cl[i] : ceil
    let a = y < 0 ? -y : y
    if (a > ceilLin) y *= ceilLin / a
    out[i] = y
  }
  s[0] = fast; s[1] = slow; s[2] = smooth; s[3] = xHold; s[4] = attackT; s[5] = confirm
  return out
}
const NONE = new Float64Array(0)

// Pure mapping (legacy / adaptive:false): transientness (dB, fast envelope above slow)
// → target lift (dB), before ballistic smoothing. Proportional transient-following:
// amount caps total lift; drive is the dB-out-per-dB-in slope beyond the knee (see
// KNEE, above — threshold pinned to KNEE/2 so r(0) = 0). Note this mode lifts natural
// attacks as much as limited ones — it is a transient exaggerator, kept for manual work.
function unlimitGain(fastDb, slowDb, amount, drive) {
  let x = fastDb - slowDb
  if (x < 0) x = 0
  return upwardExpanderGain(x, KNEE / 2, drive + 1, KNEE, amount)
}

// Pure mapping (default, adaptive de-limit): transient DEFICIT → lift. The inverse-
// limiter insight: a brickwall limiter's fingerprint is attacks that are too SMALL —
// so restoration lifts each onset by what it is missing relative to healthy program
// (\`crestTarget\` dB of transientness), gated by onset presence so sustains and
// silence (zero transientness → full "deficit", but nothing to restore) stay
// untouched. Natural attacks at/above crestTarget have zero deficit → zero lift,
// structurally — safety on dynamic material is a property of the curve, not a small
// default. Takes the transientness measure directly (the stream feeds the PEAK-HELD
// value — an attack's size is its peak, not its ramp). drive scales the restoration
// (1 = restore to target); amount caps it.
function unlimitDeficitGain(transientnessDb, crestTarget, amount, drive) {
  let x = transientnessDb
  if (x < 0) x = 0
  let onset = (x - ONSET_FLOOR) / ONSET_SOFT
  if (onset <= 0) return 0
  if (onset > 1) onset = 1
  let deficit = crestTarget - x
  if (deficit <= 0) return 0
  let lift = deficit * drive
  return onset * (lift > amount ? amount : lift)
}

return { unlimit, unlimitStream, unlimitState, unlimitBlock, unlimitGain, unlimitDeficitGain, default: unlimit };
})();

const unlimit = (() => {
const { unlimitBlock, unlimitState } = module5;
const { db2lin, timeCoef, glide, GLIDE } = module4;
// atom manifest — wraps the de-limiter kernel per @audio/compile CONTRACT.
// Runs unlimit.js's unlimitBlock, unlimitStream's loop, per channel: fast/slow envelope
// pair feeds the transient detector; deficit mode (adaptive, default) evaluates the
// transient DEFICIT against crestTarget through three gates — peak hold (~150 dB/s
// release), 10 ms attack window after a fresh peak, ~3 ms confirmation ramp — see
// unlimit.js's header for why each exists; a third envelope matching the fast
// ballistics smooths the target lift so curve corners don't zipper. adaptive: false
// = legacy proportional transient-following (transient exaggerator).
// Every param is live: read each block, the followers' coefficients recomputed when
// their attack or release changes, their state kept. State and settings are typed
// arrays made here; a block allocates nothing.
//
// \`ceiling\`'s params-convention default has no null to switch off with (kernel default:
// null = off, peaks may exceed 0 dBFS by design). Same substitution the compressor
// manifest uses for upThreshold: pin the default above the maximum any signal can
// reach through this atom — amount's declared max is 18 dB, so a ceiling default of
// 24 dB can never engage for a ≤0 dBFS input, a mathematical no-op standing in for "off".
// amount, drive and crestTarget set the lift's target, which the smoothing follower
// follows at the fast ballistics. The ceiling clamps the output with nothing behind it,
// so it is smoothed (20 ms) and glided sample by sample (util.js glide, the linear
// ceiling e^(ceiling·ln10/20) of each sample's): a host's ramp of it is one line,
// however the host cut its calls. Held, it is k's, and the kernel runs as it ran.

const unlimit = (ctx) => {
	const sr = ctx.sampleRate, st = [], k = new Float64Array(12), at = new Float64Array(4).fill(NaN)
	const g = new Float64Array(GLIDE).fill(NaN), ceil = new Float64Array(ctx.maxBlockSize)
	for (let c = 0, N = ctx.maxChannels ?? 8; c < N; c++) st.push(unlimitState())
	k[9] = 150 / sr; k[10] = 1 / (0.003 * sr); k[11] = Math.round(0.010 * sr)
	return (inputs, outputs, params) => {
		const inp = inputs[0], out = outputs[0]
		if (!inp || !inp.length) return
		const fa = params.fastAttack[0], fr = params.fastRelease[0], sa = params.slowAttack[0], sl = params.slowRelease[0]
		k[0] = params.amount[0]; k[1] = params.drive[0]; k[2] = params.adaptive ? 1 : 0; k[3] = params.crestTarget[0]
		k[4] = db2lin(params.ceiling[0])
		if (fa !== at[0]) { at[0] = fa; k[5] = timeCoef(fa, sr) }
		if (fr !== at[1]) { at[1] = fr; k[6] = timeCoef(fr, sr) }
		if (sa !== at[2]) { at[2] = sa; k[7] = timeCoef(sa, sr) }
		if (sl !== at[3]) { at[3] = sl; k[8] = timeCoef(sl, sr) }
		const ramp = glide(g, 0, params.ceiling, ceil, 0, inp[0].length, 1) ? ceil : undefined
		for (let c = 0; c < inp.length; c++) unlimitBlock(inp[c], out[c], st[c], k, ramp)
	}
}
unlimit.channels = 'any'
unlimit.tail = 0
unlimit.params = {
	amount:      { type: 'number', min: 0, max: 18, default: 6, unit: 'dB' },
	drive:       { type: 'number', min: 0, max: 10, default: 1 },
	adaptive:    { type: 'bool', default: true },
	crestTarget: { type: 'number', min: 3, max: 25, default: 10, unit: 'dB' },
	ceiling:     { type: 'number', min: -60, max: 24, default: 24, unit: 'dB', smoothing: 0.02 },
	fastAttack:  { type: 'number', min: 0.1, max: 10, default: 0.5, unit: 'ms' },
	fastRelease: { type: 'number', min: 1, max: 100, default: 20, unit: 'ms' },
	slowAttack:  { type: 'number', min: 1, max: 200, default: 20, unit: 'ms' },
	slowRelease: { type: 'number', min: 10, max: 1000, default: 200, unit: 'ms' },
}

return unlimit;
})();
`;
