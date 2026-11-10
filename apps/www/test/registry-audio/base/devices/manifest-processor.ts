// A processor of `manifestWorklet`, made as an AudioWorklet host makes it.

export interface Processor {
  port: { onmessage: ((event: { data: unknown }) => void) | null };
  process: (
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ) => boolean;
}

/** The processor a worklet's source registers, for `model`, its posts kept. As a host does, each block gets every parameter it declares, at its default unless set. */
export function madeProcessor(source: string, model: string, rate: number) {
  const posted: number[] = [];
  class AudioWorkletProcessor {
    readonly port = {
      onmessage: null,
      postMessage: (value: number) => posted.push(value),
    };
  }
  let Made: (new (options: unknown) => Processor) | undefined;
  new Function(
    "AudioWorkletProcessor",
    "registerProcessor",
    "sampleRate",
    "currentTime",
    source
  )(
    AudioWorkletProcessor,
    (_name: string, registered: new (options: unknown) => Processor) => {
      Made = registered;
    },
    rate,
    0
  );
  if (!Made) {
    throw new Error("The worklet registered no processor");
  }
  const processor = new Made({ processorOptions: { model } });
  const declared = (
    Made as unknown as {
      parameterDescriptors: { defaultValue: number; name: string }[];
    }
  ).parameterDescriptors;
  const process = processor.process.bind(processor);
  processor.process = (inputs, outputs, parameters) =>
    process(inputs, outputs, {
      ...Object.fromEntries(
        declared.map(({ defaultValue, name }) => [
          name,
          Float32Array.of(defaultValue),
        ])
      ),
      ...parameters,
    });
  return { posted, processor };
}
