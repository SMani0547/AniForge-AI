import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readAiConfiguration } from '../src/ai/config.js';
import { AiProviderError, safeProviderError } from '../src/ai/errors.js';
import { createGoogleAiProvider } from '../src/ai/google-transport.js';
import { identifyImage, MAX_SOURCE_BYTES, type SourceImage } from '../src/ai/input.js';

async function writeOutput(path: string, content: string | Buffer): Promise<void> {
  try { await writeFile(path, content, { flag: 'wx' }); }
  catch { throw new AiProviderError('OUTPUT_WRITE_FAILED', 'Google AI returned output, but the local result could not be saved. Check disk access and AI Studio before retrying a billable request.'); }
}

async function main(): Promise<void> {
  const command = process.argv[2];
  if (!['analysis', 'video', 'edit'].includes(command ?? '')) {
    throw new AiProviderError('USAGE', 'Usage: smoke.ts analysis|video|edit --image ORIGINAL_IMAGE --attest-original [--prompt TEXT] [--interaction-id ID] [--output-dir PATH]');
  }
  // Check explicit paid opt-in before touching any user file or initiating a request.
  const config = readAiConfiguration(process.env);
  let values;
  try {
    ({ values } = parseArgs({
      args: process.argv.slice(3), strict: true, allowPositionals: false,
      options: {
        image: { type: 'string' }, prompt: { type: 'string' }, notes: { type: 'string' },
        'interaction-id': { type: 'string' }, 'output-dir': { type: 'string' },
        'attest-original': { type: 'boolean', default: false },
      },
    }));
  } catch { throw new AiProviderError('USAGE', 'Invalid arguments. See docs/model-verification.md for smoke command examples.'); }
  if (!values['attest-original']) throw new AiProviderError('COPYRIGHT_ATTESTATION_REQUIRED', 'Pass --attest-original to affirm ownership and permission to process the source content with Google AI.');
  const provider = createGoogleAiProvider(config);
  let sourceImage: SourceImage | undefined;
  if (command !== 'edit') {
    if (!values.image) throw new AiProviderError('IMAGE_REQUIRED', 'Pass --image with a path to your original PNG, JPEG, or WebP illustration.');
    try {
      const imagePath = resolve(values.image);
      const info = await stat(imagePath);
      if (!info.isFile() || info.size < 1 || info.size > MAX_SOURCE_BYTES) throw new AiProviderError('INVALID_SOURCE_IMAGE', 'Source image must be a file between 1 byte and 10 MiB.');
      const bytes = await readFile(imagePath);
      sourceImage = { bytes, mimeType: identifyImage(bytes), copyrightAttested: true };
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      throw new AiProviderError('SOURCE_READ_FAILED', 'Could not read the original image. Check the --image path and file access.');
    }
  }
  if (command !== 'analysis' && !values.prompt?.trim()) throw new AiProviderError('PROMPT_REQUIRED', 'Pass --prompt with the intended motion or edit; the smoke test never invents a prompt.');
  if (command === 'edit' && !values['interaction-id']) throw new AiProviderError('INTERACTION_REQUIRED', 'Pass --interaction-id from an earlier successful real video run.');
  // Every attempt gets its own directory; a failed run cannot overwrite earlier output.
  const runDirectory = join(resolve(values['output-dir'] ?? 'artifacts/ai-smoke'), `${command}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`);
  try { await mkdir(runDirectory, { recursive: true }); }
  catch { throw new AiProviderError('OUTPUT_WRITE_FAILED', 'Could not create the smoke output directory. Check --output-dir before making a billable request.'); }
  console.log(JSON.stringify({ status: 'requesting-real-google-ai', kind: command, model: command === 'analysis' ? config.analysisModel : config.videoModel }));
  if (command === 'analysis' && sourceImage) {
    const result = await provider.analyze({ sourceImage, ...(values.notes === undefined ? {} : { notes: values.notes }) });
    await writeOutput(join(runDirectory, 'analysis.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ status: 'succeeded', kind: 'analysis', outputDirectory: runDirectory, schemaValidated: true, realRequest: true }));
  } else {
    const result = command === 'edit'
      ? await provider.edit({ interactionId: values['interaction-id']!, prompt: values.prompt! })
      : await provider.generate({ sourceImage: sourceImage!, prompt: values.prompt! });
    await writeOutput(join(runDirectory, 'metadata.json'), JSON.stringify({
      model: result.model, interactionId: result.interactionId,
      parentInteractionId: command === 'edit' ? values['interaction-id'] : null,
      kind: command, prompt: values.prompt, mimeType: result.mimeType,
      bytes: result.bytes.length, createdAt: new Date().toISOString(), realRequest: true,
    }, null, 2));
    await writeOutput(join(runDirectory, 'video.mp4'), result.bytes);
    console.log(JSON.stringify({ status: 'succeeded', kind: command, outputDirectory: runDirectory, bytes: result.bytes.length, realRequest: true, playbackVerified: false }));
  }
}

main().catch((error: unknown) => {
  const safe = safeProviderError(error);
  console.error(JSON.stringify({ status: 'failed', code: safe.code, message: safe.message, retryable: safe.retryable }));
  process.exitCode = 1;
});
