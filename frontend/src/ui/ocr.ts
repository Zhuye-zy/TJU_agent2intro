declare global {
  interface Window {
    Tesseract?: { createWorker: (langs: string[], oem: number, options: Record<string, unknown>) => Promise<TesseractWorker> };
  }
}

interface TesseractWorker {
  recognize: (image: Blob) => Promise<{ data?: { text?: string; confidence?: number } }>;
}

let workerPromise: Promise<TesseractWorker> | null = null;
let progressState = { index: 0, total: 1, callback: (_: number) => undefined as void };

function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise<NonNullable<Window['Tesseract']>>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>('script[data-scene-ocr]');
    if (!script) {
      script = document.createElement('script');
      script.src = '/vendor/tesseract/tesseract.min.js';
      script.async = true;
      script.dataset.sceneOcr = '1';
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => (window.Tesseract ? resolve(window.Tesseract) : reject(new Error('ocr_script_unavailable'))), { once: true });
    script.addEventListener('error', () => reject(new Error('ocr_script_unavailable')), { once: true });
  });
}

async function renderVariant(file: File, max: number, quality: number): Promise<{ blob: Blob; preview: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas_unavailable');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('encode_failed')), 'image/jpeg', quality));
  return { blob, preview: canvas.toDataURL('image/jpeg', 0.6) };
}

export async function preparePhoto(file: File): Promise<{ blobs: Blob[]; preview: string }> {
  const large = await renderVariant(file, 1600, 0.85);
  const small = await renderVariant(file, 640, 0.85);
  return { blobs: [large.blob, small.blob], preview: large.preview };
}

function textScore(text: string): number {
  const compact = text.replace(/\s+/g, '');
  const cjk = compact.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  return cjk * 2 + compact.length;
}

export async function recognizeScene(blobs: Blob[], onProgress: (value: number) => void): Promise<string> {
  const tesseract = await loadTesseract();
  workerPromise ??= tesseract.createWorker(['chi_sim', 'eng'], 1, {
    workerPath: '/vendor/tesseract/worker.min.js',
    corePath: '/vendor/tesseract/tesseract-core-simd-lstm.wasm.js',
    langPath: '/vendor/tesseract',
    logger: (message: { status: string; progress: number }) => {
      if (message.status === 'recognizing text') progressState.callback((progressState.index + message.progress) / progressState.total);
    },
  }).catch((error: unknown) => { workerPromise = null; throw error; });
  const worker = await workerPromise;
  progressState = { index: 0, total: blobs.length, callback: onProgress };
  let best = '';
  for (const [index, blob] of blobs.entries()) {
    progressState.index = index;
    const result = await worker.recognize(blob);
    const text = String(result?.data?.text ?? '').replace(/\s+/g, ' ').trim();
    if (textScore(text) > textScore(best)) best = text;
  }
  onProgress(1);
  return best;
}
