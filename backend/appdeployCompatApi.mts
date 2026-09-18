import { ai, error, json, router, secrets, storage } from './appdeployShim.mjs';

type CharacterKey = 'boy' | 'girl';
type StyleKey = 'fun' | 'calm' | 'excited' | 'educational' | 'story' | 'silly';
type PronunciationEntry = { term: string; sayAs: string };
type TtsBody = {
  text?: string;
  voice?: string;
  age?: number;
  character?: CharacterKey;
  style?: StyleKey;
  childStrength?: number;
  expression?: string;
  speed?: number;
  pitch?: number;
  energy?: number;
  directorNotes?: string;
  pronunciation?: PronunciationEntry[];
  dialect?: string;
};
type VoiceLabBody = TtsBody & { voices?: string[] };
type QualityBody = {
  text?: string;
  pcmBase64?: string;
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  pronunciation?: PronunciationEntry[];
};
type DirectorBody = { scene?: string; age?: number; character?: CharacterKey; style?: StyleKey; dialect?: string };
type DialogueBody = {
  script?: string;
  speakerA?: string;
  speakerB?: string;
  voiceA?: string;
  voiceB?: string;
  ageA?: number;
  ageB?: number;
  style?: StyleKey;
  directorNotes?: string;
  pronunciation?: PronunciationEntry[];
  dialect?: string;
};
type MusicBody = {
  topic?: string;
  mode?: 'clip' | 'full';
  mood?: string;
  vocals?: boolean;
  lyricsHint?: string;
  songType?: 'educational' | 'call_response' | 'vocabulary' | 'movement' | 'jingle' | 'karaoke';
  bibleSummary?: string;
  dialect?: string;
};
type LyricsCheckBody = { topic?: string; lyrics?: string; ageRange?: string };
type ImageBody = { prompt?: string; aspectRatio?: string; imageSize?: string };
type TranscribeBody = { audioBase64?: string; mimeType?: string; smart?: boolean };
type VideoStartBody = {
  prompt?: string;
  model?: string;
  aspectRatio?: string;
  durationSeconds?: string;
  resolution?: string;
};
type VideoStatusBody = { operationName?: string };
type EpisodeBody = {
  idea?: string;
  duration?: number;
  learningGoal?: string;
  bible?: string;
  profileSummary?: string;
  pronunciation?: PronunciationEntry[];
  dialect?: string;
};
type DialectVariantsBody = { text?: string; presets?: Array<{ id?: string; label?: string; prompt?: string }> };
type SafetyReviewBody = { content?: string; audience?: string; dialect?: string; bible?: string };
type MetadataBody = { idea?: string; learningGoal?: string; characters?: string; dialect?: string; plan?: string };
type PostmortemBody = { metrics?: Record<string, string>; hypothesis?: string; notes?: string; format?: string };

const voices = ['Leda', 'Puck', 'Achird', 'Sadachbia', 'Aoede', 'Kore', 'Zephyr'];
const allowedVoices = new Set(voices);
const allowedStyles = new Set<StyleKey>(['fun', 'calm', 'excited', 'educational', 'story', 'silly']);
const allowedCharacters = new Set<CharacterKey>(['boy', 'girl']);
const styleNotes: Record<StyleKey, string> = {
  fun: 'مرح وعفوي وفضولي، بابتسامة واضحة وإيقاع مناسب للأطفال',
  calm: 'هادي ودافي ومطمّن، بسرعة مريحة من غير بطء مبالغ فيه',
  excited: 'متحمس وحيوي ومليان طاقة، من غير صريخ أو مبالغة',
  educational: 'تعليمي واضح وتفاعلي، مع تأكيد لطيف على الكلمات المهمة',
  story: 'حكّاء طفل لطيف، فيه دهشة وتلوين صوتي بسيط حسب أحداث الجملة',
  silly: 'مرح جدًا وخفيف الدم وكرتوني بدرجة بسيطة، من غير ما يبقى مصطنع',
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getGeminiKey() {
  try {
    return await secrets.readSecret('GEMINI_API_KEY');
  } catch {
    return null;
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Number(value))) : fallback;
}

function clampAge(value: unknown) {
  return Math.round(clamp(value, 4, 12, 7));
}

function clampStrength(value: unknown) {
  return Math.round(clamp(value, 1, 5, 4));
}

function cleanPronunciation(input: unknown) {
  if (!Array.isArray(input)) return [] as PronunciationEntry[];
  return input
    .map(item => item as Partial<PronunciationEntry>)
    .filter(item => typeof item.term === 'string' && typeof item.sayAs === 'string' && item.term.trim() && item.sayAs.trim())
    .slice(0, 40)
    .map(item => ({ term: item.term!.trim().slice(0, 80), sayAs: item.sayAs!.trim().slice(0, 120) }));
}

function pronunciationNotes(entries: PronunciationEntry[]) {
  if (!entries.length) return '';
  return `\n# PRONUNCIATION DICTIONARY\n${entries.map(item => `- انطق «${item.term}» كالتالي: «${item.sayAs}»`).join('\n')}\nاتبع القاموس في النطق فقط ولا تقرأ تعليماته بصوت مسموع.`;
}

function buildChildPrompt(input: Required<Pick<TtsBody, 'text' | 'age' | 'character' | 'style' | 'childStrength' | 'expression' | 'speed' | 'pitch' | 'energy' | 'directorNotes' | 'dialect'>> & { pronunciation: PronunciationEntry[] }) {
  const characterLabel = input.character === 'boy' ? 'ولد' : 'بنت';
  const strengthNotes = [
    '',
    'خلي الأداء طبيعي جدًا وقريب من طفل بيتكلم عادي.',
    'خلي الرنين شبابي وطفولي بوضوح من غير تصنّع.',
    'خلي طبقة الصوت وإيقاع الكلام أقرب لطفل حقيقي مع حماس لطيف.',
    'أكد بقوة على الإحساس الطفولي الطبيعي وتجنّب أي رنين ناضج أو إذاعي.',
    'أقصى إحساس طفولي طبيعي ممكن: رنين صغير، خفة، فضول، ونطق بسيط، من غير صوت كرتوني حاد.',
  ];
  const expression = input.expression && input.expression !== 'natural'
    ? `التعبير المطلوب: ${input.expression}.`
    : 'التعبير طبيعي ومتفاعل.';
  const speedLabel = input.speed < 0.94 ? 'أبطأ قليلًا وبوضوح تعليمي' : input.speed > 1.06 ? 'أسرع وحيوي لكن مفهوم' : 'طبيعي';
  const pitchLabel = input.pitch >= 2 ? 'أعلى نسبيًا وبإحساس صغير السن' : input.pitch <= -1 ? 'أخفض قليلًا من المعتاد لكن يظل طفوليًا' : 'متوسط طفولي';
  const energyLabel = input.energy >= 4 ? 'طاقة عالية ومبهجة' : input.energy <= 2 ? 'طاقة هادئة ولطيفة' : 'طاقة متوازنة';
  const director = input.directorNotes ? `ملاحظة المخرج: ${input.directorNotes}.` : '';
  const dialect = input.dialect || 'عامية مصرية طبيعية وواضحة ar-EG';
  return `# NATURAL EGYPTIAN CHILD VOICE\nشخصية خيالية لطفل مصري ${characterLabel}، العمر الصوتي حوالي ${input.age} سنوات. الصوت لازم يحس كمحادثة مصرية حقيقية، مش قراءة نص. ممنوع صوت بالغ أو مذيع أو قارئ أو أداء روبوتي.\n\n# PERFORMANCE\nاللهجة حصريًا عامية مصرية ar-EG: ${dialect}. الأداء: ${styleNotes[input.style]}. السرعة: ${speedLabel}. الطبقة: ${pitchLabel}. الطاقة: ${energyLabel}. ${strengthNotes[input.childStrength]} ${expression} ${director}\nاتكلم بعفوية كأنك بتكلم طفل قدامك: وقفات قصيرة غير منتظمة بشكل طبيعي، ابتسامة وإحساس مناسب للمعنى، من غير تمطيط مصطنع أو نبرة إعلان. لا تستخدم فصحى ولا خليجي ولا شامي. الكلمات الإنجليزية تتقال بوضوح وسط نفس الإيقاع المصري. انطق النص فقط من غير شرح.${pronunciationNotes(input.pronunciation)}\n\n# SCRIPT\n${input.text}`;
}

type ModelKind = 'text' | 'tts' | 'transcription' | 'music' | 'image' | 'video';
const retryableStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
let modelCache: { expiresAt: number; names: string[] } = { expiresAt: 0, names: [] };

function statusFromError(value: unknown) {
  return Number((value as { status?: number })?.status || 0);
}

async function listModelNames(apiKey: string) {
  if (modelCache.expiresAt > Date.now() && modelCache.names.length) return modelCache.names;
  let lastStatus = 500;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', { headers: { 'x-goog-api-key': apiKey } });
    lastStatus = response.status;
    if (response.ok) {
      const payload = await response.json() as { models?: Array<{ name?: string }> };
      const names = (payload.models || []).map(item => String(item.name || '').replace(/^models\//, '')).filter(Boolean);
      modelCache = { expiresAt: Date.now() + 5 * 60_000, names };
      return names;
    }
    if (!retryableStatuses.has(response.status)) break;
    await sleep(500 * (2 ** attempt) + Math.floor(Math.random() * 300));
  }
  const failure = new Error(`gemini_models_http_${lastStatus}`);
  (failure as { status?: number }).status = lastStatus;
  throw failure;
}

function modelsByKind(names: string[], kind: ModelKind) {
  if (kind === 'tts') return names.filter(name => name.includes('tts'));
  if (kind === 'transcription') return names.filter(name => name.includes('transcribe') && !name.includes('live'));
  if (kind === 'music') return names.filter(name => name.includes('lyria'));
  if (kind === 'image') return names.filter(name => name.includes('image'));
  if (kind === 'video') return names.filter(name => name.includes('veo'));
  return names.filter(name => name.startsWith('gemini-') && !/(tts|live|image|transcribe|veo|lyria|robot)/i.test(name) && /(flash|pro)/i.test(name)).sort().reverse();
}

async function candidateModels(apiKey: string, kind: ModelKind, preferred: string[]) {
  try {
    const names = await listModelNames(apiKey);
    const discovered = modelsByKind(names, kind);
    return Array.from(new Set([...preferred.filter(name => names.includes(name)), ...discovered, ...preferred])).slice(0, kind === 'text' ? 8 : 6);
  } catch {
    return preferred;
  }
}

async function postGemini(apiKey: string, model: string, payload: unknown, version = 'v1beta') {
  const endpoint = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;
  let lastStatus = 500;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload),
      });
      lastStatus = response.status;
      if (response.ok) return response.json() as Promise<any>;
      if (!retryableStatuses.has(response.status) || attempt === 3) break;
      const retryAfter = Number(response.headers.get('retry-after') || 0);
      const delay = retryAfter > 0 ? retryAfter * 1000 : Math.min(8000, 650 * (2 ** attempt) + Math.floor(Math.random() * 450));
      await sleep(delay);
    } catch {
      lastStatus = 503;
      if (attempt === 3) break;
      await sleep(Math.min(8000, 650 * (2 ** attempt) + Math.floor(Math.random() * 450)));
    }
  }
  const failure = new Error(`gemini_http_${lastStatus}`);
  (failure as { status?: number }).status = lastStatus;
  throw failure;
}

function platformFallbackInput(payload: unknown) {
  const body = payload as { contents?: Array<{ parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> }>; generationConfig?: { temperature?: number } };
  const parts = (body.contents || []).flatMap(item => item.parts || []);
  const prompt = parts.map(part => part.text || '').filter(Boolean).join('\n').trim() || 'نفذ المهمة المطلوبة بدقة.';
  const audios: Array<{ data: string; mimeType: string }> = [];
  let totalAudioBytes = 0;
  for (const part of parts) {
    const inline = part.inlineData;
    if (!inline?.data || !String(inline.mimeType || '').startsWith('audio/')) continue;
    const approxBytes = Math.floor(inline.data.length * 0.75);
    if (approxBytes > 2_000_000 || totalAudioBytes + approxBytes > 4_000_000 || audios.length >= 3) continue;
    audios.push({ data: inline.data, mimeType: inline.mimeType || 'audio/wav' });
    totalAudioBytes += approxBytes;
  }
  return { prompt, audios, temperature: body.generationConfig?.temperature };
}

async function postTextGemini(apiKey: string, payload: unknown) {
  const models = [String(process.env.SOLY_GEMINI_TEXT_MODEL || 'gemini-3.5-flash-lite')];
  let lastError: unknown = null;
  for (const model of models) {
    try {
      const result = await postGemini(apiKey, model, payload);
      return { result, model };
    } catch (caught) {
      lastError = caught;
      const status = statusFromError(caught);
      if (status === 401 || status === 403) break;
    }
  }
  try {
    const fallback = platformFallbackInput(payload);
    const generated = await ai.generate({ prompt: fallback.prompt, audios: fallback.audios.length ? fallback.audios : undefined, temperature: fallback.temperature, thinkingMode: 'FAST', maxTokens: 4096 });
    return { result: { candidates: [{ content: { parts: [{ text: generated.text }] } }] }, model: 'platform-ai-fallback' };
  } catch (platformError) {
    throw lastError || platformError || new Error('text_recovery_failed');
  }
}

function extractText(payload: any) {
  return (payload?.candidates?.[0]?.content?.parts || []).map((part: any) => part.text || '').join('\n').trim();
}

function parseJsonText(value: string) {
  const clean = value.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(clean) as Record<string, unknown>;
}

async function generateChildPcm(apiKey: string, body: TtsBody) {
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new Error('missing_text');
  const voice = typeof body.voice === 'string' && allowedVoices.has(body.voice) ? body.voice : 'Leda';
  const age = clampAge(body.age);
  const character: CharacterKey = body.character && allowedCharacters.has(body.character) ? body.character : 'boy';
  const style: StyleKey = body.style && allowedStyles.has(body.style) ? body.style : 'fun';
  const childStrength = clampStrength(body.childStrength);
  const expression = typeof body.expression === 'string' ? body.expression.slice(0, 120) : 'natural';
  const speed = clamp(body.speed, 0.82, 1.18, 1);
  const pitch = clamp(body.pitch, -3, 5, 2);
  const energy = Math.round(clamp(body.energy, 1, 5, 4));
  const directorNotes = typeof body.directorNotes === 'string' ? body.directorNotes.trim().slice(0, 280) : '';
  const pronunciation = cleanPronunciation(body.pronunciation);
  const dialect = typeof body.dialect === 'string' ? body.dialect.trim().slice(0, 420) : 'عامية مصرية بيضاء ومهذبة';
  const prompt = buildChildPrompt({ text, age, character, style, childStrength, expression, speed, pitch, energy, directorNotes, pronunciation, dialect });
  const models = await candidateModels(apiKey, 'tts', ['gemini-3.1-flash-tts-preview', 'gemini-2.5-pro-preview-tts', 'gemini-2.5-flash-preview-tts']);
  let lastError: unknown = null;

  for (const model of models) {
    try {
      const payload = await postGemini(apiKey, model, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            languageCode: 'ar-EG',
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
        },
      });
      const pcmBase64 = payload?.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData)?.inlineData?.data;
      if (!pcmBase64) throw new Error('audio_missing');
      return { pcmBase64: pcmBase64 as string, model, voice, age, character, style, childStrength, speed, pitch, energy };
    } catch (caught) {
      lastError = caught;
      const status = statusFromError(caught);
      if (status === 401 || status === 403) break;
    }
  }
  throw lastError || new Error('tts_recovery_failed');
}

function pcmToWavBase64(pcmBase64: string, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const pcm = Buffer.from(pcmBase64, 'base64');
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * (bitDepth / 8), 28);
  header.writeUInt16LE(channels * (bitDepth / 8), 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString('base64');
}

function safeMediaPath(prefix: string, extension: string) {
  return `generated/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
}

async function storeBase64(path: string, content: string, contentType: string) {
  const [ok] = await storage.write([{ path, content, contentType }]);
  if (!ok) throw new Error('storage_write_failed');
  const [{ url }] = await storage.url([path]);
  return { path, url };
}

function externalError(caught: unknown) {
  const status = statusFromError(caught);
  if (status === 400) return error('راجع المدخلات', 400);
  if (status === 429) return error('حصة Gemini API الحالية للميديا غير متاحة أو وصلت للحد. راجع Billing / API quota ثم أعد المحاولة.', 429);
  if (status === 403) return error('المفتاح لا يملك صلاحية استخدام هذا المحرك حاليًا.', 403);
  return error('تعذر التنفيذ', 503);
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],

  'GET /api/capabilities': [async () => {
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    try {
      const names = await listModelNames(apiKey);
      return json({
        configured: true,
        totalModels: names.length,
        tts: names.filter((name: string) => name.includes('tts')),
        transcription: names.filter((name: string) => name.includes('transcribe')),
        music: names.filter((name: string) => name.includes('lyria')),
        video: names.filter((name: string) => name.includes('veo')),
        image: names.filter((name: string) => name.includes('image')),
        preferred: {
          tts: names.includes('gemini-3.1-flash-tts-preview') ? 'gemini-3.1-flash-tts-preview' : names.find((name: string) => name.includes('tts')) || null,
          transcription: names.includes('gemini-3.5-transcribe') ? 'gemini-3.5-transcribe' : names.find((name: string) => name.includes('transcribe') && !name.includes('live')) || null,
          music: names.includes('lyria-3.5') ? 'lyria-3.5' : names.find((name: string) => name.includes('lyria')) || null,
          video: names.includes('veo-3.1-lite-generate-preview') ? 'veo-3.1-lite-generate-preview' : names.find((name: string) => name.includes('veo')) || null,
        },
        resilience: { platformTextFallback: true, platformImageFallback: true, browserVoiceFallback: true, retryLayers: 4, dynamicModelRouting: true },
      });
    } catch (caught) {
      console.warn('Capabilities failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/director': [async ({ body }) => {
    const input = (body || {}) as DirectorBody;
    const scene = typeof input.scene === 'string' ? input.scene.trim() : '';
    if (!scene) return error('اكتب موقف الشخصية الأول.', 400);
    const age = clampAge(input.age);
    const character = input.character === 'girl' ? 'بنت' : 'ولد';
    const style: StyleKey = input.style && allowedStyles.has(input.style) ? input.style : 'fun';
    const dialect = typeof input.dialect === 'string' ? input.dialect.trim().slice(0, 420) : 'عامية مصرية طبيعية ar-EG';
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const prompt = `أنت مخرج أصوات أطفال. حلل هذا الموقف لشخصية طفل مصري ${character} عمره ${age} سنوات: ${scene}. اللهجة المطلوبة: ${dialect}. لا تحول أي لهجة مصرية إلى كاريكاتير. الأداء الأساسي ${styleNotes[style]}. أرجع JSON فقط بالمفاتيح: directorNotes نص عربي قصير، expression نص عربي قصير، speed رقم من 0.82 إلى 1.18، pitch رقم من -3 إلى 5، energy رقم من 1 إلى 5، reason جملة عربية قصيرة. لا تجعل الصوت بالغًا أو صاخبًا.`;
    try {
      const { result, model } = await postTextGemini(apiKey, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      });
      const data = parseJsonText(extractText(result));
      return json({ ...data, model });
    } catch (caught) {
      console.warn('Director failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/tts': [async ({ body }) => {
    const input = (body || {}) as TtsBody;
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text) return error('اكتب النص الأول.', 400);
    if (text.length > 1800) return error('النص لازم يكون أقل من 1800 حرف.', 400);
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    try {
      const result = await generateChildPcm(apiKey, input);
      return json({ ...result, sampleRate: 24000, channels: 1, bitDepth: 16 });
    } catch (caught) {
      console.warn('TTS failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/voice-lab': [async ({ body }) => {
    const input = (body || {}) as VoiceLabBody;
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    if (!text) return error('اكتب جملة الاختبار.', 400);
    const requested = Array.isArray(input.voices) ? input.voices.filter(name => allowedVoices.has(name)).slice(0, 4) : [];
    if (requested.length < 2) return error('اختار صوتين على الأقل وأقصى حاجة 4 أصوات.', 400);
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    try {
      const results = [];
      for (const voice of requested) {
        const result = await generateChildPcm(apiKey, { ...input, voice });
        results.push({ ...result, sampleRate: 24000, channels: 1, bitDepth: 16 });
      }
      return json({ results });
    } catch (caught) {
      console.warn('Voice lab failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/quality-check': [async ({ body }) => {
    const input = (body || {}) as QualityBody;
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    const pcmBase64 = typeof input.pcmBase64 === 'string' ? input.pcmBase64 : '';
    if (!text || !pcmBase64) return error('محتاج النص والصوت علشان أفحص الجودة.', 400);
    if (pcmBase64.length > 14_000_000) return error('ملف الصوت كبير على فحص الجودة.', 400);
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const dictionary = cleanPronunciation(input.pronunciation);
    const wavBase64 = pcmToWavBase64(pcmBase64, Math.round(clamp(input.sampleRate, 8000, 96000, 24000)), Math.round(clamp(input.channels, 1, 2, 1)), Math.round(clamp(input.bitDepth, 16, 16, 16)));
    const prompt = `راجع هذا التسجيل لصوت طفل مصري مقابل النص الأصلي. قيّم التطابق اللفظي ووضوح العامية ونطق الكلمات الإنجليزية فقط، ولا تحاول تحديد هوية المتحدث. النص الأصلي: ${text}. ${dictionary.length ? `قاموس النطق: ${dictionary.map(item => `${item.term}=>${item.sayAs}`).join(' | ')}` : ''} أرجع JSON فقط بالمفاتيح: transcript، score من 0 إلى 100، passed boolean، failedPhrases مصفوفة نصوص قصيرة تحتاج إعادة توليد، notes مصفوفة ملاحظات عربية قصيرة، englishWords مصفوفة كلمات إنجليزية مع ملاحظة النطق. اعتبر النجاح من 88 فأعلى.`;
    try {
      const { result, model } = await postTextGemini(apiKey, {
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'audio/wav', data: wavBase64 } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      });
      const data = parseJsonText(extractText(result));
      return json({ ...data, model });
    } catch (caught) {
      console.warn('Quality check failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/dialogue': [async ({ body }) => {
    const input = (body || {}) as DialogueBody;
    const script = typeof input.script === 'string' ? input.script.trim() : '';
    if (!script) return error('اكتب الحوار الأول.', 400);
    if (script.length > 2200) return error('الحوار طويل زيادة.', 400);
    const speakerA = (input.speakerA || 'توتو').slice(0, 30);
    const speakerB = (input.speakerB || 'لولو').slice(0, 30);
    const voiceA = allowedVoices.has(input.voiceA || '') ? input.voiceA as string : 'Leda';
    const voiceB = allowedVoices.has(input.voiceB || '') ? input.voiceB as string : 'Zephyr';
    const ageA = clampAge(input.ageA);
    const ageB = clampAge(input.ageB);
    const style: StyleKey = input.style && allowedStyles.has(input.style) ? input.style : 'fun';
    const directorNotes = typeof input.directorNotes === 'string' ? input.directorNotes.trim().slice(0, 280) : '';
    const pronunciation = cleanPronunciation(input.pronunciation);
    const dialect = typeof input.dialect === 'string' ? input.dialect.trim().slice(0, 420) : 'عامية مصرية طبيعية ar-EG';
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const prompt = `# NATURAL EGYPTIAN CHILD DIALOGUE\nحوار بين طفلين مصريين خياليين فقط. ${speakerA} عمره الصوتي ${ageA} سنوات، و${speakerB} عمره الصوتي ${ageB} سنوات. اللهجة حصريًا عامية مصرية ar-EG. ممنوع صوت بالغ أو إذاعي أو نبرة قراءة أو أداء روبوتي.\n# DIRECTOR NOTES\n${dialect}. الأداء ${styleNotes[style]}. ${directorNotes ? `الموقف: ${directorNotes}.` : ''} خلي الحوار عفوي كأن الطفلين قدام بعض، بوقفات وردود فعل طبيعية، من غير فصحى أو لهجات عربية أخرى. انطق الحوار فقط.${pronunciationNotes(pronunciation)}\n# SCRIPT\n${script}`;
    try {
      const payload = await postGemini(apiKey, 'gemini-3.1-flash-tts-preview', {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            languageCode: 'ar-EG',
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                { speaker: speakerA, voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceA } } },
                { speaker: speakerB, voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceB } } },
              ],
            },
          },
        },
      });
      const pcmBase64 = payload?.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData)?.inlineData?.data;
      if (!pcmBase64) throw new Error('audio_missing');
      return json({ pcmBase64, sampleRate: 24000, channels: 1, bitDepth: 16, model: 'gemini-3.1-flash-tts-preview' });
    } catch (caught) {
      console.warn('Dialogue TTS failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/transcribe': [async ({ body }) => {
    const input = (body || {}) as TranscribeBody;
    const audioBase64 = typeof input.audioBase64 === 'string' ? input.audioBase64 : '';
    const mimeType = typeof input.mimeType === 'string' ? input.mimeType : 'audio/mpeg';
    if (!audioBase64) return error('اختار ملف صوت الأول.', 400);
    if (audioBase64.length > 12_000_000) return error('الملف كبير. استخدم ملف أقل من حوالي 8 ميجا.', 400);
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    try {
      const models = await candidateModels(apiKey, 'transcription', ['gemini-3.5-transcribe']);
      let lastError: unknown = null;
      for (const model of models) {
        try {
          const payload = await postGemini(apiKey, model, {
            contents: [{ parts: [{ inlineData: { mimeType, data: audioBase64 } }] }],
            generationConfig: { transcriptionConfig: input.smart === false ? { mode: { type: 'verbatim' } } : { mode: 'smart' } },
          });
          const text = extractText(payload);
          if (text) return json({ text, model });
        } catch (caught) { lastError = caught; }
      }
      const fallback = await postTextGemini(apiKey, { contents: [{ parts: [{ text: 'فرّغ التسجيل التالي بدقة إلى نص عربي. حافظ على الكلمات الإنجليزية كما نُطقت، وأرجع النص فقط دون شرح.' }, { inlineData: { mimeType, data: audioBase64 } }] }], generationConfig: { temperature: 0.05 } });
      const text = extractText(fallback.result);
      if (!text) throw lastError || new Error('transcript_missing');
      return json({ text, model: fallback.model, recovered: true });
    } catch (caught) {
      console.warn('Transcription recovery failed', statusFromError(caught) || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/lyrics-check': [async ({ body }) => {
    const input = (body || {}) as LyricsCheckBody;
    const topic = typeof input.topic === 'string' ? input.topic.trim() : '';
    const lyrics = typeof input.lyrics === 'string' ? input.lyrics.trim() : '';
    if (!lyrics) return error('اكتب كلمات أو مسودة الأغنية الأول.', 400);
    const ageRange = typeof input.ageRange === 'string' ? input.ageRange.slice(0, 40) : '4-8';
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const prompt = `راجع كلمات أغنية أطفال مصرية لعمر ${ageRange}. الموضوع: ${topic || 'تعليمي عام'}. الكلمات: ${lyrics}. أرجع JSON فقط: kidSafe boolean، learningClarity من 0 إلى 100، memorability من 0 إلى 100، newWordCount رقم، issues مصفوفة، strengths مصفوفة، suggestedChorus نص قصير بالعامية المصرية البيضاء. ركز على بساطة الجمل وعدم التلقين الثقيل وعدم وجود إيحاءات أو سلوك خطر.`;
    try {
      const { result, model } = await postTextGemini(apiKey, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      });
      const data = parseJsonText(extractText(result));
      return json({ ...data, model });
    } catch (caught) {
      console.warn('Lyrics check failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/music': [async ({ body }) => {
    const input = (body || {}) as MusicBody;
    const topic = typeof input.topic === 'string' ? input.topic.trim() : '';
    if (!topic) return error('اكتب موضوع الأغنية.', 400);
    const mode = input.mode === 'full' ? 'full' : 'clip';
    const mood = typeof input.mood === 'string' ? input.mood.slice(0, 120) : 'cheerful, bouncy, educational';
    const songType = input.songType || 'educational';
    const vocals = songType === 'karaoke' ? false : input.vocals !== false;
    const lyricsHint = typeof input.lyricsHint === 'string' ? input.lyricsHint.trim().slice(0, 1800) : '';
    const bibleSummary = typeof input.bibleSummary === 'string' ? input.bibleSummary.trim().slice(0, 700) : '';
    const dialect = typeof input.dialect === 'string' ? input.dialect.trim().slice(0, 420) : 'عامية مصرية طبيعية ar-EG';
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const musicModels = await candidateModels(apiKey, 'music', mode === 'full' ? ['lyria-3.5', 'lyria-3-pro-preview', 'lyria-3-clip-preview'] : ['lyria-3-clip-preview', 'lyria-3.5', 'lyria-3-pro-preview']);
    const typeNotes: Record<string, string> = {
      educational: 'clear educational chorus, one learning objective, repetition without monotony',
      call_response: 'strong call-and-response between lead child voice and group response',
      vocabulary: 'teach a few vocabulary words using spaced repetition and clear pronunciation',
      movement: 'movement-and-dance cues, claps, stop/go moments, safe simple actions',
      jingle: 'very short recognizable character jingle with a memorable two-beat hook',
      karaoke: 'instrumental karaoke arrangement with obvious melodic spaces for children to sing along',
    };
    const prompt = vocals
      ? `Create an ORIGINAL Egyptian Arabic children's song about: ${topic}. Format: ${typeNotes[songType] || typeNotes.educational}. Mood: ${mood}. Dialect direction: ${dialect}. Keep it respectful and understandable, never caricature a regional accent. Use playful youthful vocals, simple memorable melody, clear Egyptian Arabic diction, family-friendly language, and no imitation of any existing artist or song. ${bibleSummary ? `Channel identity: ${bibleSummary}.` : ''} ${lyricsHint ? `Use these original lyric ideas when useful: ${lyricsHint}` : ''}`
      : `Create an ORIGINAL instrumental children's track about: ${topic}. Format: ${typeNotes[songType] || typeNotes.educational}. Mood: ${mood}. Bright playful arrangement, simple memorable motif, family-friendly, no vocals. ${bibleSummary ? `Channel identity: ${bibleSummary}.` : ''}`;
    let lastMusicError: unknown = null;
    for (const model of musicModels) {
      try {
        const payload = await postGemini(apiKey, model, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['AUDIO', 'TEXT'] } });
        const parts = payload?.candidates?.[0]?.content?.parts || [];
        const lyrics = parts.filter((part: any) => part.text).map((part: any) => part.text).join('\n').trim();
        const audioPart = parts.find((part: any) => part.inlineData?.data);
        const audioBase64 = audioPart?.inlineData?.data;
        const contentType = audioPart?.inlineData?.mimeType || 'audio/mpeg';
        if (!audioBase64) throw new Error('music_missing');
        const stored = await storeBase64(safeMediaPath('song', 'mp3'), audioBase64, contentType);
        return json({ ...stored, lyrics, model, contentType, recovered: model !== musicModels[0] });
      } catch (caught) { lastMusicError = caught; }
    }
    try {
      const fallback = await postTextGemini(apiKey, { contents: [{ parts: [{ text: `${prompt}\nتعذر إخراج الصوت الموسيقي الآن. اكتب بدلًا منه كلمات أصلية جاهزة، كورس، بنية Verse/Chorus، BPM تقريبي، وآلات مقترحة حتى يستمر الإنتاج بدون توقف.` }] }], generationConfig: { temperature: 0.55 } });
      return json({ url: '', lyrics: extractText(fallback.result), model: fallback.model, contentType: 'text/plain', degraded: true });
    } catch (caught) {
      console.warn('Music recovery failed', statusFromError(caught) || statusFromError(lastMusicError) || 'unknown');
      return externalError(lastMusicError || caught);
    }
  }],

  'POST /api/image': [async ({ body }) => {
    const input = (body || {}) as ImageBody;
    const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
    if (!prompt) return error('اكتب وصف الصورة.', 400);
    const aspectRatio = ['1:1', '9:16', '16:9', '4:5'].includes(input.aspectRatio || '') ? input.aspectRatio as string : '9:16';
    const imageSize = ['1K', '2K', '4K'].includes(input.imageSize || '') ? input.imageSize as string : '1K';
    const aspectEnums: Record<string, string> = {
      '1:1': 'ASPECT_RATIO_ONE_BY_ONE', '9:16': 'ASPECT_RATIO_NINE_BY_SIXTEEN',
      '16:9': 'ASPECT_RATIO_SIXTEEN_BY_NINE', '4:5': 'ASPECT_RATIO_FOUR_BY_FIVE',
    };
    const sizeEnums: Record<string, string> = {
      '1K': 'IMAGE_SIZE_ONE_K', '2K': 'IMAGE_SIZE_TWO_K', '4K': 'IMAGE_SIZE_FOUR_K',
    };
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const finalPrompt = `Create an original, family-friendly visual for a children's educational channel. All human characters must be fictional children, visually distinct and consistent, with warm expressive faces, clean professional animation styling, no resemblance to a real person, and no copyrighted characters. ${prompt}`;
    let lastImageError: unknown = null;
    const imageModels = await candidateModels(apiKey, 'image', ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-3.1-flash-lite-image', 'gemini-2.5-flash-image']);
    for (const model of imageModels) {
      const requestedSize = model.includes('flash-lite-image') || model.includes('2.5-flash-image') ? '1K' : imageSize;
      for (const version of ['v1', 'v1beta']) {
        try {
          const imageFormat: Record<string, string> = { aspectRatio: aspectEnums[aspectRatio] || 'ASPECT_RATIO_NINE_BY_SIXTEEN' };
          if (!model.includes('2.5-flash-image')) imageFormat.imageSize = sizeEnums[requestedSize] || 'IMAGE_SIZE_ONE_K';
          const payload = await postGemini(apiKey, model, { contents: [{ parts: [{ text: finalPrompt }] }], generationConfig: { responseModalities: ['IMAGE'], responseFormat: { image: imageFormat } } }, version);
          const imagePart = payload?.candidates?.[0]?.content?.parts?.find((part: any) => part.inlineData?.data);
          const imageBase64 = imagePart?.inlineData?.data;
          const contentType = imagePart?.inlineData?.mimeType || 'image/png';
          if (!imageBase64) throw new Error('image_missing');
          const extension = contentType.includes('jpeg') ? 'jpg' : 'png';
          const stored = await storeBase64(safeMediaPath('image', extension), imageBase64, contentType);
          return json({ ...stored, model, contentType, imageSizeUsed: requestedSize, recovered: model !== imageModels[0] || version !== 'v1' });
        } catch (caught) {
          lastImageError = caught;
          const status = statusFromError(caught);
          if (status === 401 || status === 403) break;
          // 429/5xx must continue through alternate image models and the
          // platform fallback instead of surfacing an avoidable hard failure.
        }
      }
    }
    try {
      const generated = await ai.imageGen({ prompt: `${finalPrompt}. Compose for ${aspectRatio}.`, maxOutputBytes: 1_000_000 });
      const extension = generated.image.mimeType.includes('jpeg') ? 'jpg' : 'png';
      const stored = await storeBase64(safeMediaPath('image-fallback', extension), generated.image.data, generated.image.mimeType);
      return json({ ...stored, model: 'platform-image-fallback', contentType: generated.image.mimeType, recovered: true });
    } catch (caught) {
      console.warn('Image recovery failed', statusFromError(caught) || statusFromError(lastImageError) || 'unknown');
      return externalError(lastImageError || caught);
    }
  }],

  'POST /api/video/start': [async ({ body }) => {
    const input = (body || {}) as VideoStartBody;
    const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
    if (!prompt) return error('اكتب وصف الفيديو.', 400);
    const model = ['veo-3.1-generate-preview', 'veo-3.1-lite-generate-preview'].includes(input.model || '') ? input.model as string : 'veo-3.1-lite-generate-preview';
    const aspectRatio = input.aspectRatio === '16:9' ? '16:9' : '9:16';
    const durationSeconds = 8;
    const resolution = ['720p', '1080p', '4k'].includes(input.resolution || '') ? input.resolution as string : '720p';
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const finalPrompt = `Original children's educational animation with fictional child characters only. Family-friendly, colorful, highly engaging, no copyrighted characters, no resemblance to real children. Egyptian kids-channel energy. ${prompt}`;
    const videoModels = await candidateModels(apiKey, 'video', [model, 'veo-3.1-lite-generate-preview', 'veo-3.1-fast-generate-preview', 'veo-3.1-generate-preview']);
    const resolutions = resolution === '4k' ? ['4k', '1080p', '720p'] : resolution === '1080p' ? ['1080p', '720p'] : ['720p'];
    let lastVideoError: unknown = null;
    for (const candidate of videoModels) {
      for (const candidateResolution of resolutions) {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${candidate}:predictLongRunning`, {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              body: JSON.stringify({ instances: [{ prompt: finalPrompt }], parameters: { aspectRatio, durationSeconds, resolution: candidateResolution, personGeneration: 'allow_all' } }),
            });
            if (!response.ok) {
              const failure = new Error(`gemini_http_${response.status}`); (failure as { status?: number }).status = response.status; throw failure;
            }
            const payload = await response.json() as { name?: string };
            if (!payload.name) throw new Error('operation_missing');
            return json({ operationName: payload.name, model: candidate, resolutionUsed: candidateResolution, recovered: candidate !== model || candidateResolution !== resolution });
          } catch (caught) {
            lastVideoError = caught;
            if (attempt === 0 && retryableStatuses.has(statusFromError(caught))) await sleep(900 + Math.floor(Math.random() * 400)); else break;
          }
        }
      }
    }
    try {
      const fallback = await postTextGemini(apiKey, { contents: [{ parts: [{ text: `حوّل وصف الفيديو التالي إلى Animatic Plan عملي من 4 لقطات قصيرة: ${finalPrompt}. لكل لقطة اكتب الحركة، الكاميرا، مدة تقريبية، المؤثر الصوتي، وصورة مرجعية مطلوبة. الهدف استمرار الإنتاج حتى يعود محرك الفيديو.` }] }], generationConfig: { temperature: 0.35 } });
      return json({ operationName: '', model: fallback.model, degraded: true, fallbackPlan: extractText(fallback.result) });
    } catch (caught) {
      console.warn('Video recovery failed', statusFromError(caught) || statusFromError(lastVideoError) || 'unknown');
      return externalError(lastVideoError || caught);
    }
  }],

  'POST /api/video/status': [async ({ body }) => {
    const input = (body || {}) as VideoStatusBody;
    const operationName = typeof input.operationName === 'string' ? input.operationName.trim() : '';
    if (!operationName || !operationName.startsWith('operations/')) return error('معرّف عملية الفيديو غير صحيح.', 400);
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${operationName}`, {
        headers: { 'x-goog-api-key': apiKey },
      });
      if (!response.ok) {
        const failure = new Error(`gemini_http_${response.status}`);
        (failure as any).status = response.status;
        throw failure;
      }
      const payload = await response.json() as any;
      if (!payload?.done) return json({ done: false });
      if (payload?.error) return error('فشل إنشاء الفيديو. غيّر الوصف وحاول تاني.', 503);
      const videoUri = payload?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      if (!videoUri) return error('الفيديو خلص لكن رابط الملف غير موجود.', 503);
      const cleanId = operationName.replace(/[^a-zA-Z0-9_-]/g, '-');
      const path = `generated/video-${cleanId}.mp4`;
      const existing = await storage.read([path]);
      if (!existing[0]?.content) {
        const videoResponse = await fetch(videoUri, { headers: { 'x-goog-api-key': apiKey } });
        if (!videoResponse.ok) throw new Error('video_download_failed');
        const buffer = Buffer.from(await videoResponse.arrayBuffer());
        const [ok] = await storage.write([{ path, content: buffer.toString('base64'), contentType: 'video/mp4' }]);
        if (!ok) throw new Error('video_storage_failed');
      }
      const [{ url }] = await storage.url([path]);
      return json({ done: true, url, path });
    } catch (caught) {
      console.warn('Video status failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/dialect-variants': [async ({ body }) => {
    const input = (body || {}) as DialectVariantsBody;
    const text = typeof input.text === 'string' ? input.text.trim() : '';
    const presets = Array.isArray(input.presets) ? input.presets.slice(0, 4).filter(item => item && typeof item.id === 'string' && typeof item.label === 'string' && typeof item.prompt === 'string') : [];
    if (!text) return error('اكتب النص اللي عايز تختبر لهجاته.', 400);
    if (presets.length < 2) return error('اختار لهجتين على الأقل.', 400);
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const presetText = presets.map(item => `${item.id}|${item.label}: ${String(item.prompt).slice(0, 420)}`).join('\n');
    const prompt = `أعد كتابة النص التالي كنسخ أداء لغوي للأطفال، نسخة لكل لهجة مصرية مطلوبة. حافظ على المعنى والمعلومة وعدد الجمل تقريبًا، واستخدم فروقًا خفيفة ومحترمة فقط، من غير سخرية أو اختراع كلمات محلية غير مؤكدة. لو اللهجة فصحى مبسطة فاجعلها سهلة جدًا. النص: ${text}\nاللهجات:\n${presetText}\nأرجع JSON فقط: {"variants":[{"dialectKey":"...","label":"...","text":"...","notes":"..."}]}.`;
    try {
      const { result, model } = await postTextGemini(apiKey, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.35 } });
      const data = parseJsonText(extractText(result));
      return json({ ...data, model });
    } catch (caught) {
      console.warn('Dialect variants failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/safety-review': [async ({ body }) => {
    const input = (body || {}) as SafetyReviewBody;
    const content = typeof input.content === 'string' ? input.content.trim().slice(0, 7000) : '';
    if (!content) return error('محتاج سيناريو أو خطة علشان أراجع السلامة.', 400);
    const audience = typeof input.audience === 'string' ? input.audience.slice(0, 120) : 'أطفال 4-8';
    const dialect = typeof input.dialect === 'string' ? input.dialect.slice(0, 300) : 'عامية مصرية بيضاء';
    const bible = typeof input.bible === 'string' ? input.bible.slice(0, 1400) : '';
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const prompt = `راجع محتوى أطفال لعمر ${audience}. اللهجة ${dialect}. قواعد القناة: ${bible}. المحتوى: ${content}. افحص ملاءمة العمر، الخوف والعنف والتنمر، السلوك القابل للتقليد، الصور النمطية، الضغط التجاري، صدق الادعاء التعليمي، الخصوصية، وضوح الحبكة، والتكرار الآلي. أرجع JSON فقط: score 0-100، passed boolean، risks مصفوفة، strengths مصفوفة، fixes مصفوفة، learningIntegrity نص قصير، privacyRisk boolean، commercialPressure boolean.`;
    try {
      const { result, model } = await postTextGemini(apiKey, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.15 } });
      const data = parseJsonText(extractText(result));
      return json({ ...data, model });
    } catch (caught) {
      console.warn('Safety review failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/metadata-pack': [async ({ body }) => {
    const input = (body || {}) as MetadataBody;
    const idea = typeof input.idea === 'string' ? input.idea.trim().slice(0, 500) : '';
    if (!idea) return error('اكتب فكرة الفيديو الأول.', 400);
    const learningGoal = typeof input.learningGoal === 'string' ? input.learningGoal.slice(0, 300) : '';
    const characters = typeof input.characters === 'string' ? input.characters.slice(0, 700) : '';
    const dialect = typeof input.dialect === 'string' ? input.dialect.slice(0, 350) : '';
    const plan = typeof input.plan === 'string' ? input.plan.slice(0, 3500) : '';
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const prompt = `اصنع حزمة نشر صادقة لفيديو أطفال مصري. الفكرة: ${idea}. الهدف: ${learningGoal}. الشخصيات: ${characters}. اللهجة: ${dialect}. الخطة: ${plan}. لا Clickbait ولا وعود تعليمية غير موجودة. أرجع JSON فقط: titles خمس عناوين قصيرة، description وصف فريد يبدأ بخلاصة أول سطرين، thumbnailTexts أربع عبارات من كلمة أو كلمتين، shortsHook خطاف صادق قصير، parentSummary سطر لولي الأمر، keywords كلمات مرتبطة فقط، publishNotes مصفوفة فحص قبل النشر.`;
    try {
      const { result, model } = await postTextGemini(apiKey, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.45 } });
      const data = parseJsonText(extractText(result));
      return json({ ...data, model });
    } catch (caught) {
      console.warn('Metadata pack failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/postmortem': [async ({ body }) => {
    const input = (body || {}) as PostmortemBody;
    const metrics = input.metrics && typeof input.metrics === 'object' ? input.metrics : {};
    const hypothesis = typeof input.hypothesis === 'string' ? input.hypothesis.slice(0, 700) : '';
    const notes = typeof input.notes === 'string' ? input.notes.slice(0, 1800) : '';
    const format = typeof input.format === 'string' ? input.format.slice(0, 80) : 'Shorts';
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const prompt = `اعمل Postmortem محافظ لفيديو أطفال بصيغة ${format}. الفرضية: ${hypothesis}. المقاييس: ${JSON.stringify(metrics)}. الملاحظات: ${notes}. لا تعتبر CTR وحده نجاحًا ولا تقارن Shorts بالفيديو الطويل مقارنة خام. فرّق بين الوصول والمشاهدة والولاء والجودة والتشغيل. أرجع JSON فقط: summary نص، wins مصفوفة، problems مصفوفة، nextTest نص لمتغير واحد، caution نص عن حدود الاستنتاج، operations مصفوفة تحسينات تشغيلية.`;
    try {
      const { result, model } = await postTextGemini(apiKey, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } });
      const data = parseJsonText(extractText(result));
      return json({ ...data, model });
    } catch (caught) {
      console.warn('Postmortem failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],

  'POST /api/episode-plan': [async ({ body }) => {
    const input = (body || {}) as EpisodeBody;
    const idea = typeof input.idea === 'string' ? input.idea.trim() : '';
    if (!idea) return error('اكتب فكرة الحلقة.', 400);
    const duration = Number.isFinite(input.duration) ? Math.min(90, Math.max(15, Math.round(input.duration as number))) : 30;
    const learningGoal = typeof input.learningGoal === 'string' ? input.learningGoal.trim().slice(0, 300) : '';
    if (learningGoal.length < 12) return error('اكتب هدف تعلم واضح ومحدد للحلقة قبل التوليد.', 422);
    const bible = typeof input.bible === 'string' ? input.bible.trim().slice(0, 1800) : '';
    const profileSummary = typeof input.profileSummary === 'string' ? input.profileSummary.trim().slice(0, 1000) : '';
    const pronunciation = cleanPronunciation(input.pronunciation);
    const dialect = typeof input.dialect === 'string' ? input.dialect.trim().slice(0, 420) : 'عامية مصرية طبيعية ar-EG';
    const apiKey = await getGeminiKey();
    if (!apiKey) return error('مفتاح Gemini غير مربوط بالتطبيق.', 503);
    const prompt = `أنت مخرج محتوى أطفال مصري. اللهجة المطلوبة: ${dialect}. لا تستخدم اللهجة بشكل ساخر أو مبالغ فيه. صمم حلقة أصلية مدتها ${duration} ثانية لفكرة: ${idea}. ${learningGoal ? `هدف التعلم: ${learningGoal}.` : ''} كل الشخصيات أطفال خياليون فقط. هوية القناة: ${bible || 'عامية مصرية بيضاء، تعليم ممتع، حبكة واضحة'}. الشخصيات المتاحة: ${profileSummary || 'اختر طفلين متمايزين'}. ${pronunciation.length ? `قاموس النطق: ${pronunciation.map(item => `${item.term}=>${item.sayAs}`).join(' | ')}.` : ''} اكتب: Hook لأول ثانيتين، هدف واحد قابل للقياس، الحوار بالعامية المصرية، ملاحظات Director Mode لكل جملة، لقطة بلقطة، Prompt صورة لكل لقطة، Prompt Veo 9:16 لكل لقطة، خطة مؤثرات Foley، وفكرة أغنية أو Jingle. أضف سؤال تفاعلي بسيط مناسب للعمر، ثم Recap قصير يثبت ما تعلمه الطفل، واذكر بوضوح كيف تختلف الحلقة عن أي محتوى مرجعي حتى تظل أصلية. اجعل الجمل قصيرة، السرد متماسك، وتجنب التكرار الآلي والمحتوى التعليمي الزائف.`;
    try {
      const { result, model } = await postTextGemini(apiKey, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.75 },
      });
      const plan = extractText(result);
      if (!plan) throw new Error('plan_missing');
      return json({ plan, model, educationalPolicy: { preflightPassed: true, fullReviewRequiredBeforeExport: true, learningObjective: learningGoal, requirements: ['interactive-question','recap','originality'] } });
    } catch (caught) {
      console.warn('Episode plan failed', (caught as any)?.status || 'unknown');
      return externalError(caught);
    }
  }],
});
