import type { AudioStats } from './types';

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}

export function decodePcm(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export function analyzePcm(base64: string, sampleRate: number, channels: number): AudioStats {
  const bytes = decodePcm(base64);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleCount = Math.floor(bytes.length / 2);
  let peak = 0;
  let sumSquares = 0;
  let silent = 0;
  let clipped = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = view.getInt16(index * 2, true) / 32768;
    const absolute = Math.abs(sample);
    if (absolute > peak) peak = absolute;
    sumSquares += sample * sample;
    if (absolute < 0.015) silent += 1;
    if (absolute > 0.985) clipped += 1;
  }
  const rms = sampleCount ? Math.sqrt(sumSquares / sampleCount) : 0;
  const toDb = (value: number) => value > 0 ? 20 * Math.log10(value) : -90;
  return {
    duration: sampleCount / Math.max(1, sampleRate * channels),
    peakDb: Number(toDb(peak).toFixed(1)),
    rmsDb: Number(toDb(rms).toFixed(1)),
    silencePercent: Number((sampleCount ? (silent / sampleCount) * 100 : 0).toFixed(1)),
    clippingPercent: Number((sampleCount ? (clipped / sampleCount) * 100 : 0).toFixed(2)),
  };
}

export function pcmToWavUrl(base64: string, sampleRate: number, channels: number, bitDepth: number, autoMaster: boolean) {
  const bytes = decodePcm(base64);
  const mastered = new Uint8Array(bytes);
  if (autoMaster && bitDepth === 16) {
    const view = new DataView(mastered.buffer, mastered.byteOffset, mastered.byteLength);
    const sampleCount = Math.floor(mastered.length / 2);
    let max = 0;
    for (let index = 0; index < sampleCount; index += 1) max = Math.max(max, Math.abs(view.getInt16(index * 2, true)));
    const target = 29200;
    const gain = max > 0 && max < target ? Math.min(2.2, target / max) : 1;
    if (gain > 1.01) {
      for (let index = 0; index < sampleCount; index += 1) {
        const sample = view.getInt16(index * 2, true);
        view.setInt16(index * 2, Math.max(-32768, Math.min(32767, Math.round(sample * gain))), true);
      }
    }
  }
  const buffer = new ArrayBuffer(44 + mastered.length);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + mastered.length, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitDepth / 8), true);
  view.setUint16(32, channels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, mastered.length, true);
  new Uint8Array(buffer, 44).set(mastered);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

export function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
