import * as glyphs from "../../core/glyphs.ts";
import { createIcon } from "./icon.tsx";

export const BotIcon = createIcon(glyphs.bot, "BotIcon");
export const RackIcon = createIcon(glyphs.rack, "RackIcon");
export const KnobIcon = createIcon(glyphs.knob, "KnobIcon");
export const WaveformIcon = createIcon(glyphs.waveform, "WaveformIcon");
export const BracesIcon = createIcon(glyphs.braces, "BracesIcon");
export const JackIcon = createIcon(glyphs.jack, "JackIcon");
export const TuningForkIcon = createIcon(glyphs.tuningfork, "TuningForkIcon");
export const ShapesIcon = createIcon(glyphs.shapes, "ShapesIcon");
export const PatchbayIcon = createIcon(glyphs.patchbay, "PatchbayIcon");
export const PlayheadIcon = createIcon(glyphs.playhead, "PlayheadIcon");
export const SparkleIcon = createIcon(glyphs.sparkle, "SparkleIcon");
export const MetronomeIcon = createIcon(glyphs.metronome, "MetronomeIcon");
export const FaderIcon = createIcon(glyphs.fader, "FaderIcon");
export const TracksIcon = createIcon(glyphs.tracks, "TracksIcon");
export const SineIcon = createIcon(glyphs.sine, "SineIcon");
export const SquareIcon = createIcon(glyphs.square, "SquareIcon");
export const SawtoothIcon = createIcon(glyphs.sawtooth, "SawtoothIcon");
export const TriangleIcon = createIcon(glyphs.triangle, "TriangleIcon");
export const LowpassIcon = createIcon(glyphs.lowpass, "LowpassIcon");
export const HighpassIcon = createIcon(glyphs.highpass, "HighpassIcon");
export const BandpassIcon = createIcon(glyphs.bandpass, "BandpassIcon");
export const NotchIcon = createIcon(glyphs.notch, "NotchIcon");
export const LowshelfIcon = createIcon(glyphs.lowshelf, "LowshelfIcon");
export const HighshelfIcon = createIcon(glyphs.highshelf, "HighshelfIcon");
export const PeakIcon = createIcon(glyphs.peak, "PeakIcon");
export const EnvelopeIcon = createIcon(glyphs.envelope, "EnvelopeIcon");
export const GridIcon = createIcon(glyphs.grid, "GridIcon");
export const FadersIcon = createIcon(glyphs.faders, "FadersIcon");
export const XYPadIcon = createIcon(glyphs.xypad, "XYPadIcon");
export const PadIcon = createIcon(glyphs.pad, "PadIcon");
export const PianoIcon = createIcon(glyphs.piano, "PianoIcon");
export const MeterIcon = createIcon(glyphs.meter, "MeterIcon");
export const GaugeIcon = createIcon(glyphs.gauge, "GaugeIcon");
export const SpectrumIcon = createIcon(glyphs.spectrum, "SpectrumIcon");
export const ScopeIcon = createIcon(glyphs.scope, "ScopeIcon");
export const PlotIcon = createIcon(glyphs.plot, "PlotIcon");
export const PlayIcon = createIcon(glyphs.play, "PlayIcon");
export const PauseIcon = createIcon(glyphs.pause, "PauseIcon");
export const StopIcon = createIcon(glyphs.stop, "StopIcon");
export const RecordIcon = createIcon(glyphs.record, "RecordIcon");
export const LoopIcon = createIcon(glyphs.loop, "LoopIcon");
export const MicIcon = createIcon(glyphs.mic, "MicIcon");
export const SpeakerIcon = createIcon(glyphs.speaker, "SpeakerIcon");
export const HeadphonesIcon = createIcon(glyphs.headphones, "HeadphonesIcon");
export const MidiIcon = createIcon(glyphs.midi, "MidiIcon");
export const SequencerIcon = createIcon(glyphs.sequencer, "SequencerIcon");
export const PianoRollIcon = createIcon(glyphs.pianoroll, "PianoRollIcon");
export const CompressorIcon = createIcon(glyphs.compressor, "CompressorIcon");
export const DelayIcon = createIcon(glyphs.delay, "DelayIcon");
export const ReverbIcon = createIcon(glyphs.reverb, "ReverbIcon");
export const DistortionIcon = createIcon(glyphs.distortion, "DistortionIcon");
export const StereoIcon = createIcon(glyphs.stereo, "StereoIcon");
export const TapeIcon = createIcon(glyphs.tape, "TapeIcon");
export const VinylIcon = createIcon(glyphs.vinyl, "VinylIcon");
export const ClipIcon = createIcon(glyphs.clip, "ClipIcon");
export const AutomationIcon = createIcon(glyphs.automation, "AutomationIcon");
export const MagnetIcon = createIcon(glyphs.magnet, "MagnetIcon");
export const MonoIcon = createIcon(glyphs.mono, "MonoIcon");
export const NoteIcon = createIcon(glyphs.note, "NoteIcon");
export const InsertIcon = createIcon(glyphs.insert, "InsertIcon");
export const CrateIcon = createIcon(glyphs.crate, "CrateIcon");
export const DialIcon = createIcon(glyphs.dial, "DialIcon");
export const ContrastIcon = createIcon(glyphs.contrast, "ContrastIcon");

/** Every icon, by the name its catalog entry carries. */
export const icons = {
  Automation: AutomationIcon,
  Bandpass: BandpassIcon,
  Bot: BotIcon,
  Braces: BracesIcon,
  Clip: ClipIcon,
  Compressor: CompressorIcon,
  Contrast: ContrastIcon,
  Crate: CrateIcon,
  Delay: DelayIcon,
  Dial: DialIcon,
  Distortion: DistortionIcon,
  Envelope: EnvelopeIcon,
  Fader: FaderIcon,
  Faders: FadersIcon,
  Gauge: GaugeIcon,
  Grid: GridIcon,
  Headphones: HeadphonesIcon,
  Highpass: HighpassIcon,
  Highshelf: HighshelfIcon,
  Insert: InsertIcon,
  Jack: JackIcon,
  Knob: KnobIcon,
  Loop: LoopIcon,
  Lowpass: LowpassIcon,
  Lowshelf: LowshelfIcon,
  Magnet: MagnetIcon,
  Meter: MeterIcon,
  Metronome: MetronomeIcon,
  Mic: MicIcon,
  Midi: MidiIcon,
  Mono: MonoIcon,
  Notch: NotchIcon,
  Note: NoteIcon,
  Pad: PadIcon,
  Patchbay: PatchbayIcon,
  Pause: PauseIcon,
  Peak: PeakIcon,
  Piano: PianoIcon,
  PianoRoll: PianoRollIcon,
  Play: PlayIcon,
  Playhead: PlayheadIcon,
  Plot: PlotIcon,
  Rack: RackIcon,
  Record: RecordIcon,
  Reverb: ReverbIcon,
  Sawtooth: SawtoothIcon,
  Scope: ScopeIcon,
  Sequencer: SequencerIcon,
  Shapes: ShapesIcon,
  Sine: SineIcon,
  Sparkle: SparkleIcon,
  Speaker: SpeakerIcon,
  Spectrum: SpectrumIcon,
  Square: SquareIcon,
  Stereo: StereoIcon,
  Stop: StopIcon,
  Tape: TapeIcon,
  Tracks: TracksIcon,
  Triangle: TriangleIcon,
  TuningFork: TuningForkIcon,
  Vinyl: VinylIcon,
  Waveform: WaveformIcon,
  XYPad: XYPadIcon,
};
