import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { analyzePcm, fileToBase64, pcmToWavUrl } from './audio';
import { childRecommended, defaultBible, defaultProfiles, defaultVideoRecord, dialectPresets, pipelineStages, qaItems, safetyItems, songTypes, standardVoiceTest, styleOptions, voiceMeta, voices } from './data';
import type { AudioResult, ChannelBible, CharacterKey, DialectKey, GrowthMetrics, MetadataPack, ProductionStage, Profile, PronunciationEntry, RightsEntry, StyleKey, Tab, VideoRecord, VoiceQuality, VoiceResult } from './types';

const WEB_VERSION = '7.15.0-alpha.1';

const tabs: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'voice', icon: '🎙️', label: 'الصوت' }, { id: 'dialects', icon: '🇪🇬', label: 'لهجات مصر' }, { id: 'lab', icon: '🧪', label: 'مختبر الأطفال' },
  { id: 'dialogue', icon: '👧🏻', label: 'حوار طفلين' }, { id: 'record', icon: '🎧', label: 'سجل وحوّل' }, { id: 'music', icon: '🎵', label: 'أغاني' },
  { id: 'image', icon: '🎨', label: 'صور' }, { id: 'video', icon: '🎬', label: 'فيديو' }, { id: 'studio', icon: '✨', label: 'حلقة كاملة' },
  { id: 'production', icon: '🎛️', label: 'المراجعة والنشر' }, { id: 'growth', icon: '📈', label: 'النمو' }, { id: 'characters', icon: '🧒', label: 'الشخصيات' },
  { id: 'bible', icon: '📚', label: 'إعدادات القناة' },
  { id: 'control', icon: '🧠', label: 'مركز سولي' },
];

type ScoreEntry = { sum: number; count: number };
type LyricsReview = { kidSafe?: boolean; learningClarity?: number; memorability?: number; newWordCount?: number; issues?: string[]; strengths?: string[]; suggestedChorus?: string };
type DialectVariant = { dialectKey?: string; label?: string; text?: string; notes?: string };
type SafetyReview = { score?: number; passed?: boolean; risks?: string[]; strengths?: string[]; fixes?: string[]; learningIntegrity?: string; privacyRisk?: boolean; commercialPressure?: boolean };
type Postmortem = { summary?: string; wins?: string[]; problems?: string[]; nextTest?: string; caution?: string; operations?: string[] };
type OwnerAuthStatus = { configured?: boolean; disabled?: boolean; authenticated?: boolean };
type WorkSummary = {
  sessionId?: string;
  goal?: string;
  state?: string;
  counts?: { pending?: number; running?: number; blocked?: number; done?: number; skipped?: number };
  nextAction?: { id?: string; title?: string; status?: string } | null;
  blockedTasks?: Array<{ id?: string; title?: string; blocker?: string; alternatives?: string[] }>;
  updatedAt?: string;
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

function voiceLabel(name: string) {
  const item = voiceMeta.find(voice => voice[0] === name);
  return item ? `${item[0]} — ${item[1]}${item[2] ? ' ⭐' : ''}` : name;
}

function profileSummary(profiles: Profile[]) {
  return profiles.map(item => `${item.name}: ${item.character === 'boy' ? 'ولد' : 'بنت'} ${item.age} سنين، ${item.style}، جملته المميزة «${item.catchphrase}»`).join(' | ');
}

function bibleSummary(bible: ChannelBible) {
  return `القناة ${bible.channelName}. الجمهور ${bible.audience}. اللهجة ${bible.dialect}. القيم ${bible.values}. الممنوع ${bible.forbidden}. قواعد السرد ${bible.storyRules}. قواعد الصوت ${bible.audioRules}.`;
}

function App() {
  const [tab, setTab] = useState<Tab>('voice');
  const [text, setText] = useState('بُص يا صاحبي! دي بقرة! عارف البقرة بتقول إيه؟ مووو! شاطر! وبالإنجليزي بنقول عليها Cow.');
  const [voice, setVoice] = useState('Leda');
  const [age, setAge] = useState(7);
  const [character, setCharacter] = useState<CharacterKey>('boy');
  const [style, setStyle] = useState<StyleKey>('fun');
  const [childStrength, setChildStrength] = useState(5);
  const [expression, setExpression] = useState('natural');
  const [speed, setSpeed] = useState(1.02);
  const [pitch, setPitch] = useState(3);
  const [energy, setEnergy] = useState(4);
  const [directorNotes, setDirectorNotes] = useState('');
  const [directorScene, setDirectorScene] = useState('توتو شاف حيوان جديد لأول مرة، فرحان ومندهش وعايز يخلي الطفل يخمن اسمه');
  const [directorReason, setDirectorReason] = useState('');
  const [autoQa, setAutoQa] = useState(true);
  const [autoMaster, setAutoMaster] = useState(true);
  const [loading, setLoading] = useState('');
  const [message, setMessage] = useState('');
  const [audioResults, setAudioResults] = useState<AudioResult[]>([]);

  const [profiles, setProfiles] = useState<Profile[]>(() => loadJson('toto_profiles_v3', defaultProfiles));
  const [profileId, setProfileId] = useState('toto');
  const [dictionary, setDictionary] = useState<PronunciationEntry[]>(() => loadJson('toto_dictionary_v3', [
    { id: 'cow', term: 'Cow', sayAs: 'كاو' },
    { id: 'moo', term: 'Moo', sayAs: 'موو' },
  ]));
  const [bible, setBible] = useState<ChannelBible>(() => loadJson('toto_bible_v3', defaultBible));
  const [voiceScores, setVoiceScores] = useState<Record<string, ScoreEntry>>(() => loadJson('toto_voice_scores_v3', {}));
  const [revealedBlind, setRevealedBlind] = useState<Record<string, boolean>>({});
  const [controlMode, setControlMode] = useState<'economy' | 'balanced' | 'quality'>(() => loadJson('toto_control_mode', 'balanced'));
  const [dialectKey, setDialectKey] = useState<DialectKey>(() => loadJson('toto_dialect_v4', 'egyptian-white'));
  const [dialectText, setDialectText] = useState('بص يا صاحبي، النهارده هنكتشف حيوان جديد. تفتكر اسمه إيه؟');
  const [dialectTargets, setDialectTargets] = useState<DialectKey[]>(['egyptian-white', 'cairo-light', 'delta-damietta-light']);
  const [dialectVariants, setDialectVariants] = useState<DialectVariant[]>([]);
  const [videoRecord, setVideoRecord] = useState<VideoRecord>(() => loadJson('toto_video_record_v4', defaultVideoRecord));
  const [stages, setStages] = useState<ProductionStage[]>(() => loadJson('toto_stages_v4', pipelineStages.map(item => ({ id: item[0], label: item[1], status: 'todo' as const, reviewer: '', decidedAt: '', notes: '' }))));
  const [rights, setRights] = useState<RightsEntry[]>(() => loadJson('toto_rights_v4', []));
  const [newRight, setNewRight] = useState<RightsEntry>({ id: '', asset: '', source: '', tool: '', license: '', commercial: 'review', evidence: '', createdAt: '' });
  const [safetyChecks, setSafetyChecks] = useState<Record<string, boolean>>(() => loadJson('toto_safety_v4', Object.fromEntries(safetyItems.map(item => [item[0], false])) as Record<string, boolean>));
  const [qaChecks, setQaChecks] = useState<Record<string, boolean>>(() => loadJson('toto_qa_v4', Object.fromEntries(qaItems.map(item => [item[0], false])) as Record<string, boolean>));
  const [safetyReview, setSafetyReview] = useState<SafetyReview | null>(null);
  const [metadataPack, setMetadataPack] = useState<MetadataPack | null>(null);
  const [exportChecks, setExportChecks] = useState({ ownedSource: false, licenseChecked: false, noThirdPartyWatermark: false, keepProvenance: true });
  const [growth, setGrowth] = useState<GrowthMetrics>(() => loadJson('toto_growth_v4', { impressions: '', ctr: '', avgViewDuration: '', retention: '', newViewers: '', returningViewers: '', engagedViews: '', stayedToWatch: '', claims: '', rework: '' }));
  const [experiment, setExperiment] = useState('فرضية واحدة: تغيير اللهجة فقط مع تثبيت الفكرة والطول والجودة');
  const [growthNotes, setGrowthNotes] = useState('');
  const [postmortem, setPostmortem] = useState<Postmortem | null>(null);
  const [ownerAuth, setOwnerAuth] = useState<OwnerAuthStatus | null>(null);
  const [runtimeVersion, setRuntimeVersion] = useState('');
  const [ownerTokenInput, setOwnerTokenInput] = useState('');
  const [focusGoal, setFocusGoal] = useState(() => loadJson('toto_focus_goal_v1', 'تطوير Toto Kids Studio بدون فقدان السياق، مع اجتياز الاختبارات قبل الدمج'));
  const [workSummary, setWorkSummary] = useState<WorkSummary | null>(null);
  const [focusBlocker, setFocusBlocker] = useState('');

  const [labText, setLabText] = useState(standardVoiceTest);
  const [labVoices, setLabVoices] = useState<string[]>(['Leda', 'Zephyr', 'Puck', 'Achird']);
  const [blindLab, setBlindLab] = useState(true);

  const [dialogueScript, setDialogueScript] = useState('توتو: لولو! عارفة البقرة بتقول إيه؟\nلولو: مووو! سهلة جدًا!\nتوتو: برافو! وبالإنجليزي اسمها Cow.');
  const [voiceA, setVoiceA] = useState('Leda');
  const [voiceB, setVoiceB] = useState('Zephyr');

  const [recordFile, setRecordFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState('');

  const [musicTopic, setMusicTopic] = useState('أغنية قصيرة تعلم الطفل إن Cow يعني بقرة وصوتها Moo');
  const [musicMode, setMusicMode] = useState<'clip' | 'full'>('clip');
  const [musicMood, setMusicMood] = useState('مبهجة، سهلة الحفظ، مع تصفيق خفيف');
  const [songType, setSongType] = useState<'educational' | 'call_response' | 'vocabulary' | 'movement' | 'jingle' | 'karaoke'>('call_response');
  const [musicVocals, setMusicVocals] = useState(true);
  const [lyricsDraft, setLyricsDraft] = useState('');
  const [lyricsReview, setLyricsReview] = useState<LyricsReview | null>(null);
  const [musicUrl, setMusicUrl] = useState('');
  const [lyrics, setLyrics] = useState('');

  const [imagePrompt, setImagePrompt] = useState('توتو ولولو في مزرعة ملونة، يشاوروا بحماس على بقرة لطيفة، أسلوب 3D كرتوني أصلي، لقطة Shorts جذابة');
  const [imageAspect, setImageAspect] = useState('9:16');
  const [imageSize, setImageSize] = useState('1K');
  const [imageUrl, setImageUrl] = useState('');

  const [videoPrompt, setVideoPrompt] = useState('طفلان كرتونيان يقفان في مزرعة ملونة، بقرة لطيفة تقول موو، الطفلان يضحكان ويشاوران عليها، حركة كاميرا ناعمة، طاقة عالية لفيديو تعليمي للأطفال');
  const [videoModel, setVideoModel] = useState('veo-3.1-lite-generate-preview');
  const [videoResolution, setVideoResolution] = useState('720p');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFallbackPlan, setVideoFallbackPlan] = useState('');

  const [episodeIdea, setEpisodeIdea] = useState('تعليم الطفل إن Cow يعني بقرة وصوتها Moo');
  const [learningGoal, setLearningGoal] = useState('الطفل يكرر كلمة Cow وصوت Moo في نهاية الفيديو');
  const [episodePlan, setEpisodePlan] = useState('');

  const [newTerm, setNewTerm] = useState('');
  const [newSayAs, setNewSayAs] = useState('');
  const [newProfile, setNewProfile] = useState<Profile>({
    id: '', name: '', voice: 'Leda', age: 7, character: 'boy', style: 'fun', childStrength: 5,
    speed: 1, pitch: 3, energy: 4, catchphrase: '', directorNotes: '', dialectKey: 'egyptian-white',
  });
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  const currentProfile = useMemo(() => profiles.find(item => item.id === profileId), [profiles, profileId]);
  const selectedDialect = useMemo(() => dialectPresets.find(item => item.id === dialectKey) || dialectPresets[0], [dialectKey]);
  const safetyDone = useMemo(() => safetyItems.every(item => safetyChecks[item[0]]), [safetyChecks]);
  const qaDone = useMemo(() => qaItems.every(item => qaChecks[item[0]]), [qaChecks]);
  const cleanExportReady = exportChecks.ownedSource && exportChecks.licenseChecked && exportChecks.noThirdPartyWatermark && exportChecks.keepProvenance;
  const rankedVoices = useMemo(() => (Object.entries(voiceScores) as Array<[string, ScoreEntry]>)
    .map(([name, score]) => ({ name, average: score.count ? score.sum / score.count : 0, count: score.count }))
    .sort((a, b) => b.average - a.average), [voiceScores]);
  const usageGuard = useMemo(() => {
    let score = 1;
    if (musicMode === 'full') score += 2;
    if (videoResolution === '1080p') score += 2;
    if (videoResolution === '4k') score += 4;
    if (imageSize === '4K') score += 1;
    if (controlMode === 'quality') score += 1;
    return score >= 6 ? 'مرتفع' : score >= 3 ? 'متوسط' : 'منخفض';
  }, [controlMode, imageSize, musicMode, videoResolution]);

  useEffect(() => { localStorage.setItem('toto_profiles_v3', JSON.stringify(profiles)); }, [profiles]);
  useEffect(() => { localStorage.setItem('toto_dictionary_v3', JSON.stringify(dictionary)); }, [dictionary]);
  useEffect(() => { localStorage.setItem('toto_bible_v3', JSON.stringify(bible)); }, [bible]);
  useEffect(() => { localStorage.setItem('toto_voice_scores_v3', JSON.stringify(voiceScores)); }, [voiceScores]);
  useEffect(() => { localStorage.setItem('toto_control_mode', JSON.stringify(controlMode)); }, [controlMode]);
  useEffect(() => { localStorage.setItem('toto_dialect_v4', JSON.stringify(dialectKey)); }, [dialectKey]);
  useEffect(() => { localStorage.setItem('toto_video_record_v4', JSON.stringify(videoRecord)); }, [videoRecord]);
  useEffect(() => { localStorage.setItem('toto_stages_v4', JSON.stringify(stages)); }, [stages]);
  useEffect(() => { localStorage.setItem('toto_rights_v4', JSON.stringify(rights)); }, [rights]);
  useEffect(() => { localStorage.setItem('toto_safety_v4', JSON.stringify(safetyChecks)); }, [safetyChecks]);
  useEffect(() => { localStorage.setItem('toto_qa_v4', JSON.stringify(qaChecks)); }, [qaChecks]);
  useEffect(() => { localStorage.setItem('toto_growth_v4', JSON.stringify(growth)); }, [growth]);
  useEffect(() => { void checkOwnerAuth(); }, []);
  useEffect(() => { localStorage.setItem('toto_focus_goal_v1', JSON.stringify(focusGoal)); }, [focusGoal]);
  useEffect(() => { if (tab === 'control') void loadFocusStatus(); }, [tab]);
  useEffect(() => {
    if (!currentProfile) return;
    setVoice(currentProfile.voice);
    setAge(currentProfile.age);
    setCharacter(currentProfile.character);
    setStyle(currentProfile.style);
    setChildStrength(currentProfile.childStrength);
    setSpeed(currentProfile.speed);
    setPitch(currentProfile.pitch);
    setEnergy(currentProfile.energy);
    setDirectorNotes(currentProfile.directorNotes);
    setDialectKey(currentProfile.dialectKey || 'egyptian-white');
  }, [currentProfile]);
  useEffect(() => {
    if (controlMode === 'economy') { setVideoModel('veo-3.1-lite-generate-preview'); setVideoResolution('720p'); setImageSize('1K'); }
    if (controlMode === 'balanced') { setVideoModel('veo-3.1-lite-generate-preview'); setVideoResolution('720p'); setImageSize('2K'); }
    if (controlMode === 'quality') { setVideoModel('veo-3.1-generate-preview'); setVideoResolution('1080p'); setImageSize('4K'); }
  }, [controlMode]);
  useEffect(() => {
    void checkRuntimeVersion();
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker.register('./sw.js')
        .then(registration => registration.update())
        .catch(() => undefined);
    }
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  function clearAudio() {
    audioResults.forEach(item => URL.revokeObjectURL(item.url));
    setAudioResults([]);
  }

  function errorStatus(value: unknown) {
    return Number((value as { status?: number })?.status || 0);
  }

  function errorMessage(value: unknown) {
    const data = (value as { data?: { message?: string; error?: string } })?.data;
    return String(data?.message || data?.error || (value as { message?: string })?.message || '').trim();
  }

  async function recoverCall(label: string, runner: () => Promise<{ data: any }>, attempts = 3) {
    let lastError: unknown = null;
    const retryable = new Set([408, 425, 429, 499, 500, 502, 503, 504]);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await runner();
      } catch (caught) {
        lastError = caught;
        const status = errorStatus(caught);
        if (!retryable.has(status) || attempt >= attempts - 1) break;
        const base = status === 429 ? 1800 : 700;
        setLoading(`${label} — محاولة استرجاع ${attempt + 2}/${attempts}`);
        await new Promise(resolve => setTimeout(resolve, base * (2 ** attempt) + Math.floor(Math.random() * 400)));
      }
    }
    throw lastError || new Error('recovery_exhausted');
  }

  function recoverPost(path: string, body: unknown, label = 'تشغيل المهمة') {
    return recoverCall(label, () => api.post(path, body));
  }

  function showError(value: unknown) {
    const status = errorStatus(value);
    const detail = errorMessage(value);
    if (status === 401) {
      setOwnerAuth(current => ({ ...(current || {}), authenticated: false }));
      setMessage('جلسة المالك مقفولة. افتحها من أعلى الصفحة وكمل.');
      return;
    }
    if (status === 403) {
      setMessage(detail || 'المحرك الحالي مش مسموح للمفتاح المستخدم. هنحتاج محرك بديل أو صلاحية صحيحة.');
      return;
    }
    if (status === 404) {
      setMessage('اتكشف عدم تطابق بين نسخة الواجهة والسيرفر. حدّث الصفحة؛ ولو استمر، الإصدار المنشور محتاج مزامنة.');
      return;
    }
    if (status === 429) {
      setMessage('ضغط/حصة مؤقتة على مزود التوليد. جرّبنا الاسترجاع تلقائيًا؛ المهمة نفسها محفوظة وممكن تتعاد بعد هدوء الحصة.');
      return;
    }
    if ([408, 499, 502, 503, 504].includes(status)) {
      setMessage(detail || 'المزود اتأخر أو غير متاح مؤقتًا. البرنامج حاول الاسترجاع تلقائيًا من غير ما يضيّع إعداداتك.');
      return;
    }
    setMessage(detail || 'حصل خطأ غير متوقع، واتحفظت إعداداتك الحالية.');
  }

  async function checkRuntimeVersion() {
    try {
      const { data } = await api.get('/health');
      const serverVersion = String((data as { version?: string })?.version || '');
      setRuntimeVersion(serverVersion);
      if (serverVersion && serverVersion !== WEB_VERSION) {
        setMessage(`في تحديث جديد بيتثبت: الواجهة ${WEB_VERSION} والسيرفر ${serverVersion}. هنعمل مزامنة تلقائية مع أول تحديث للصفحة.`);
      }
    } catch {
      setRuntimeVersion('');
    }
  }

  async function checkOwnerAuth() {
    try {
      const { data } = await api.authStatus();
      setOwnerAuth(data as OwnerAuthStatus);
    } catch {
      setOwnerAuth({ configured: false, disabled: false, authenticated: false });
    }
  }

  async function loginOwner() {
    if (!ownerTokenInput.trim()) { setMessage('اكتب Owner Token.'); return; }
    setLoading('owner-login'); setMessage('');
    try {
      await api.login(ownerTokenInput.trim());
      setOwnerTokenInput('');
      await checkOwnerAuth();
      setMessage('تم فتح جلسة المالك بأمان.');
    } catch (caught) {
      showError(caught);
    } finally {
      setLoading('');
    }
  }

  async function logoutOwner() {
    setLoading('owner-logout'); setMessage('');
    try {
      await api.logout();
      await checkOwnerAuth();
      setMessage('تم قفل جلسة المالك.');
    } catch (caught) {
      showError(caught);
    } finally {
      setLoading('');
    }
  }

  async function loadFocusStatus() {
    setLoading('focus-status');
    try {
      const { data } = await api.tool('soly.work.session.read', { sessionId: 'active' }, ['project:work:read']);
      setWorkSummary((data as any)?.result?.summary || null);
    } catch (caught) {
      if ((caught as { status?: number })?.status === 404) setWorkSummary(null);
      else showError(caught);
    } finally {
      setLoading('');
    }
  }

  async function startFocusSession() {
    setLoading('focus-start');
    try {
      const tasks = [
        { id: 'ci', title: 'تشغيل وفحص Core Resilience CI', status: 'running' },
        { id: 'gateway', title: 'تثبيت Work Continuity وModel Router داخل Gateway', status: 'done' },
        { id: 'education', title: 'فرض هدف تعليمي وأصالة على Episode Plan', status: 'done' },
        { id: 'chaos', title: 'اختبارات فوضى واسترجاع آمن', status: 'done' },
        { id: 'shortform', title: 'مخطط Shorts رأسي 9:16', status: 'done' },
        { id: 'control-ui', title: 'تفعيل مركز سولي في الواجهة', status: 'running' },
        { id: 'review', title: 'مراجعة PR والاختبارات قبل الدمج', status: 'pending' },
      ];
      const { data } = await api.tool('soly.work.session.create', { sessionId: 'active', goal: focusGoal, tasks }, ['project:work:write']);
      setWorkSummary((data as any)?.result?.summary || null);
      setMessage('جلسة المتابعة اتسجلت');
    } catch (caught) {
      showError(caught);
    } finally {
      setLoading('');
    }
  }

  async function completeFocusTask() {
    const taskId = workSummary?.nextAction?.id;
    if (!taskId) return;
    setLoading('focus-complete');
    try {
      const { data } = await api.tool('soly.work.checkpoint', { sessionId: 'active', taskId, status: 'done', note: 'اكتملت من مركز سولي' }, ['project:work:write']);
      setWorkSummary((data as any)?.result?.summary || null);
    } catch (caught) {
      showError(caught);
    } finally {
      setLoading('');
    }
  }

  async function blockFocusTask() {
    const taskId = workSummary?.nextAction?.id;
    if (!taskId) return;
    setLoading('focus-block');
    try {
      const { data } = await api.tool('soly.work.checkpoint', {
        sessionId: 'active',
        taskId,
        status: 'blocked',
        blocker: focusBlocker || 'المسار الحالي متعطل',
        alternatives: ['انتقل لأول مهمة مستقلة متاحة ثم ارجع للعائق لاحقًا'],
        nextAction: 'continue-next-independent-task',
      }, ['project:work:write']);
      setWorkSummary((data as any)?.result?.summary || null);
      setFocusBlocker('');
    } catch (caught) {
      showError(caught);
    } finally {
      setLoading('');
    }
  }

  function resultToAudio(result: VoiceResult, label: string, blindCode?: string): AudioResult {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label,
      blindCode,
      model: result.model,
      voice: result.voice,
      pcmBase64: result.pcmBase64,
      stats: analyzePcm(result.pcmBase64, result.sampleRate, result.channels),
      url: pcmToWavUrl(result.pcmBase64, result.sampleRate, result.channels, result.bitDepth, autoMaster),
    };
  }

  function voicePayload(extra: Record<string, unknown> = {}) {
    return { text, voice, age, character, style, childStrength, expression, speed, pitch, energy, directorNotes, pronunciation: dictionary, dialect: selectedDialect.prompt, ...extra };
  }

  async function checkQuality(itemId: string, sourceText = text) {
    const item = audioResults.find(result => result.id === itemId);
    if (!item) return;
    setLoading('بنفحص النطق والتطابق وجودة التسجيل...');
    try {
      const response = await recoverPost('/api/quality-check', {
        text: sourceText,
        pcmBase64: item.pcmBase64,
        sampleRate: 24000,
        channels: 1,
        bitDepth: 16,
        pronunciation: dictionary,
      });
      const quality = response.data as VoiceQuality;
      setAudioResults(current => current.map(result => result.id === itemId ? { ...result, quality } : result));
    } catch (caught) {
      showError(caught);
    } finally {
      setLoading('');
    }
  }

  async function generateVoice() {
    clearAudio(); setMessage(''); setLoading('بنجهّز Voice DNA ونمثل الجملة...');
    try {
      const response = await recoverPost('/api/tts', voicePayload());
      const result = response.data as VoiceResult;
      const audio = resultToAudio(result, currentProfile?.name || 'طفل');
      setAudioResults([audio]);
      if (autoQa) {
        setLoading('الصوت جاهز، بنعمل فحص نطق تلقائي...');
        const qualityResponse = await recoverPost('/api/quality-check', {
          text, pcmBase64: result.pcmBase64, sampleRate: result.sampleRate, channels: result.channels, bitDepth: result.bitDepth, pronunciation: dictionary,
        });
        setAudioResults([{ ...audio, quality: qualityResponse.data as VoiceQuality }]);
      }
    } catch (caught) {
      showError(caught);
    } finally { setLoading(''); }
  }

  async function repairPhrase(phrase: string) {
    setLoading(`بنعيد الجملة اللي فيها مشكلة: ${phrase}`);
    try {
      const response = await recoverPost('/api/tts', voicePayload({ text: phrase }));
      const result = response.data as VoiceResult;
      const repaired = resultToAudio(result, `إصلاح • ${currentProfile?.name || 'طفل'}`);
      setAudioResults(current => [...current, repaired]);
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  async function runDirector() {
    setMessage(''); setLoading('المخرج بيحوّل الموقف لإحساس وسرعة وطاقة...');
    try {
      const response = await recoverPost('/api/director', { scene: directorScene, age, character, style, dialect: selectedDialect.prompt });
      const data = response.data as { directorNotes?: string; expression?: string; speed?: number; pitch?: number; energy?: number; reason?: string };
      if (data.directorNotes) setDirectorNotes(data.directorNotes);
      if (data.expression) setExpression(data.expression);
      if (typeof data.speed === 'number') setSpeed(data.speed);
      if (typeof data.pitch === 'number') setPitch(data.pitch);
      if (typeof data.energy === 'number') setEnergy(data.energy);
      setDirectorReason(data.reason || 'تم ضبط الأداء حسب الموقف.');
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  function saveCurrentDna() {
    if (!currentProfile) return;
    setProfiles(current => current.map(item => item.id === currentProfile.id ? {
      ...item, voice, age, character, style, childStrength, speed, pitch, energy, directorNotes, dialectKey,
    } : item));
    setMessage(`اتحفظ Voice DNA الجديد لشخصية ${currentProfile.name}.`);
  }

  async function runVoiceLab() {
    clearAudio(); setMessage(''); setLoading('بنعمل اختبار أعمى لنفس الأداء على كل خامة...');
    try {
      const response = await recoverPost('/api/voice-lab', {
        text: labText, voices: labVoices, age, character, style, childStrength: 5, expression: 'natural', speed, pitch, energy, directorNotes, pronunciation: dictionary,
      });
      const results = (response.data as { results: VoiceResult[] }).results;
      const letters = ['A', 'B', 'C', 'D'];
      setAudioResults(results.map((result, index) => resultToAudio(result, blindLab ? `اختبار ${letters[index]}` : voiceLabel(result.voice), blindLab ? letters[index] : undefined)));
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  function rateVoice(itemId: string, name: string, score: number) {
    setVoiceScores(current => {
      const previous = current[name] || { sum: 0, count: 0 };
      return { ...current, [name]: { sum: previous.sum + score, count: previous.count + 1 } };
    });
    setRevealedBlind(current => ({ ...current, [itemId]: true }));
    setMessage('اتسجل تقييمك. الترتيب بيتعلم من ذوق مشروعنا مش من أسماء الأصوات.');
  }

  async function generateDialogue() {
    clearAudio(); setMessage(''); setLoading('بنمثل الحوار بصوت طفلين...');
    try {
      const response = await recoverPost('/api/dialogue', {
        script: dialogueScript, speakerA: 'توتو', speakerB: 'لولو', voiceA, voiceB, ageA: 7, ageB: 6, style, directorNotes, pronunciation: dictionary, dialect: selectedDialect.prompt,
      });
      const result = response.data as VoiceResult;
      setAudioResults([resultToAudio({ ...result, voice: `${voiceA} + ${voiceB}` }, 'توتو + لولو')]);
    } catch (caught) {
      showError(caught);
    } finally { setLoading(''); }
  }

  async function transcribe() {
    if (!recordFile) { setMessage('اختار تسجيل صوت الأول.'); return; }
    if (recordFile.size > 8 * 1024 * 1024) { setMessage('اختار ملف أقل من 8 ميجا.'); return; }
    setMessage(''); setLoading('بنسمع تسجيلك ونطلع الكلام...');
    try {
      const audioBase64 = await fileToBase64(recordFile);
      const response = await recoverPost('/api/transcribe', { audioBase64, mimeType: recordFile.type || 'audio/mpeg', smart: true });
      setTranscript((response.data as { text: string }).text);
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  async function reviewLyrics() {
    if (!lyricsDraft.trim()) { setMessage('اكتب مسودة كلمات الأول علشان نراجعها.'); return; }
    setLoading('بنراجع الكلمات تربويًا وسهولة الحفظ...'); setMessage('');
    try {
      const response = await recoverPost('/api/lyrics-check', { topic: musicTopic, lyrics: lyricsDraft, ageRange: bible.audience });
      setLyricsReview(response.data as LyricsReview);
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  async function generateMusic() {
    setMessage(''); setMusicUrl(''); setLyrics(''); setLoading(musicMode === 'clip' ? 'بنلحن مقطع 30 ثانية...' : 'بنكوّن أغنية كاملة...');
    try {
      const response = await recoverPost('/api/music', {
        topic: musicTopic, mode: musicMode, mood: musicMood, vocals: musicVocals, lyricsHint: lyricsDraft, songType, bibleSummary: bibleSummary(bible), dialect: selectedDialect.prompt,
      });
      const data = response.data as { url: string; lyrics: string; model: string; degraded?: boolean };
      setMusicUrl(data.url || ''); setLyrics(data.lyrics || '');
      if (data.degraded) setMessage('كملت الشغل بخطة كلمات وتلحين احتياطية بدل إيقاف المشروع؛ الصوت الموسيقي نفسه يتولد عند رجوع أحد محركات الموسيقى.');
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  async function generateImage() {
    setMessage(''); setImageUrl(''); setLoading('بنرسم المشهد مع هوية القناة...');
    try {
      const response = await recoverPost('/api/image', { prompt: `${imagePrompt}. Visual identity: ${bible.visualStyle}`, aspectRatio: imageAspect, imageSize });
      setImageUrl((response.data as { url: string }).url);
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  async function generateVideo() {
    setMessage(''); setVideoUrl(''); setVideoFallbackPlan(''); setLoading('بدأنا Smart Video Router...');
    try {
      const start = await recoverPost('/api/video/start', { prompt: videoPrompt, model: videoModel, aspectRatio: '9:16', durationSeconds: '8', resolution: videoResolution }, 'توليد الفيديو');
      const startData = start.data as { operationName: string; degraded?: boolean; fallbackPlan?: string; model?: string; resolutionUsed?: string };
      if (startData.degraded) {
        setVideoFallbackPlan(startData.fallbackPlan || 'اتعمل مسار Animatic احتياطي.');
        setMessage('محرك الفيديو الأساسي ماوقفش خط الإنتاج: اتعمل Animatic Plan تلقائي تقدر تكمل بيه لحد ما يتاح التوليد المرئي.');
        return;
      }
      const operationName = startData.operationName;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 8000));
        const status = await recoverPost('/api/video/status', { operationName });
        const data = status.data as { done: boolean; url?: string };
        if (data.done && data.url) { setVideoUrl(data.url); setLoading(''); return; }
        setLoading(`Veo شغال... فحص ${attempt + 1}`);
      }
      setMessage('الفيديو لسه بيتولد. ارجع للتبويب بعد شوية لو ما ظهرش.');
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  async function buildEpisode() {
    setMessage(''); setEpisodePlan(''); setLoading('بنستخدم ذاكرة القناة وVoice DNA ونبني خطة الإنتاج...');
    try {
      const response = await recoverPost('/api/episode-plan', {
        idea: episodeIdea,
        duration: 30,
        learningGoal,
        bible: bibleSummary(bible),
        profileSummary: profileSummary(profiles),
        pronunciation: dictionary,
        dialect: selectedDialect.prompt,
      });
      setEpisodePlan((response.data as { plan: string }).plan);
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  function toggleLabVoice(name: string) {
    setLabVoices(current => current.includes(name) ? current.filter(item => item !== name) : current.length < 4 ? [...current, name] : current);
  }

  function saveProfile() {
    if (!newProfile.name.trim()) { setMessage('اكتب اسم الشخصية.'); return; }
    const id = `char-${Date.now()}`;
    setProfiles(current => [...current, { ...newProfile, id, name: newProfile.name.trim() }]);
    setNewProfile({ id: '', name: '', voice: 'Leda', age: 7, character: 'boy', style: 'fun', childStrength: 5, speed: 1, pitch: 3, energy: 4, catchphrase: '', directorNotes: '', dialectKey });
    setMessage('اتحفظت الشخصية وVoice DNA بتاعها في ذاكرة المشروع.');
  }

  function addDictionaryEntry() {
    if (!newTerm.trim() || !newSayAs.trim()) { setMessage('اكتب الكلمة وطريقة نطقها.'); return; }
    setDictionary(current => [...current.filter(item => item.term.toLowerCase() !== newTerm.trim().toLowerCase()), { id: `word-${Date.now()}`, term: newTerm.trim(), sayAs: newSayAs.trim() }]);
    setNewTerm(''); setNewSayAs(''); setMessage('اتضافت الكلمة لقاموس نطق القناة.');
  }

  async function generateDialectVariants() {
    if (dialectTargets.length < 2) { setMessage('اختار لهجتين على الأقل للمقارنة.'); return; }
    setLoading('بنكتب نفس الفكرة بلمسات مصرية مختلفة من غير كاريكاتير...'); setMessage(''); setDialectVariants([]);
    try {
      const presets = dialectTargets.map(id => dialectPresets.find(item => item.id === id)).filter(Boolean).map(item => ({ id: item!.id, label: item!.label, prompt: item!.prompt }));
      const response = await recoverPost('/api/dialect-variants', { text: dialectText, presets });
      setDialectVariants((response.data as { variants?: DialectVariant[] }).variants || []);
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  function cycleStage(id: string) {
    const order = ['todo', 'working', 'approved'] as const;
    setStages(current => current.map(stage => {
      if (stage.id !== id) return stage;
      const next = order[(order.indexOf(stage.status) + 1) % order.length];
      return { ...stage, status: next, decidedAt: next === 'approved' ? new Date().toISOString().slice(0, 10) : stage.decidedAt };
    }));
  }

  function addRightsEntry() {
    if (!newRight.asset.trim() || !newRight.tool.trim()) { setMessage('اكتب الأصل والأداة على الأقل.'); return; }
    const entry = { ...newRight, id: `asset-${Date.now()}`, createdAt: new Date().toISOString().slice(0, 10) };
    setRights(current => [entry, ...current]);
    setNewRight({ id: '', asset: '', source: '', tool: '', license: '', commercial: 'review', evidence: '', createdAt: '' });
    setMessage('اتضاف الأصل لسجل الحقوق والمكونات.');
  }

  async function runSafetyReview() {
    const content = episodePlan || text;
    setLoading('مراجع السلامة بيفحص العمر والصدق التعليمي والمخاطر...'); setSafetyReview(null); setMessage('');
    try {
      const response = await recoverPost('/api/safety-review', { content, audience: bible.audience, dialect: selectedDialect.prompt, bible: bibleSummary(bible) });
      setSafetyReview(response.data as SafetyReview);
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  async function generateMetadataPack() {
    setLoading('بنجهز عنوان ووصف وThumbnail من غير Clickbait...'); setMetadataPack(null); setMessage('');
    try {
      const response = await recoverPost('/api/metadata-pack', { idea: episodeIdea, learningGoal, characters: profileSummary(profiles), dialect: selectedDialect.label, plan: episodePlan });
      setMetadataPack(response.data as MetadataPack);
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  async function runPostmortem() {
    setLoading('بنقرأ المقاييس مع بعض من غير مطاردة CTR لوحده...'); setPostmortem(null); setMessage('');
    try {
      const response = await recoverPost('/api/postmortem', { metrics: growth as unknown as Record<string, string>, hypothesis: experiment, notes: growthNotes, format: 'Shorts / long-form منفصلين في التفسير' });
      setPostmortem(response.data as Postmortem);
    } catch (caught) { showError(caught); } finally { setLoading(''); }
  }

  function exportProject() {
    const payload = { version: 4, exportedAt: new Date().toISOString(), bible, profiles, dictionary, dialectKey, videoRecord, stages, rights, safetyChecks, qaChecks, growth };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'toto-project-backup.json'; anchor.click(); URL.revokeObjectURL(url);
  }

  async function importProject(file: File | null) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      if (parsed.bible) setBible(parsed.bible as ChannelBible);
      if (Array.isArray(parsed.profiles)) setProfiles(parsed.profiles as Profile[]);
      if (Array.isArray(parsed.dictionary)) setDictionary(parsed.dictionary as PronunciationEntry[]);
      if (typeof parsed.dialectKey === 'string') setDialectKey(parsed.dialectKey as DialectKey);
      if (parsed.videoRecord) setVideoRecord(parsed.videoRecord as VideoRecord);
      if (Array.isArray(parsed.stages)) setStages(parsed.stages as ProductionStage[]);
      if (Array.isArray(parsed.rights)) setRights(parsed.rights as RightsEntry[]);
      if (parsed.safetyChecks) setSafetyChecks(parsed.safetyChecks as Record<string, boolean>);
      if (parsed.qaChecks) setQaChecks(parsed.qaChecks as Record<string, boolean>);
      if (parsed.growth) setGrowth(parsed.growth as GrowthMetrics);
      setMessage('تم استرجاع نسخة المشروع.');
    } catch { setMessage('ملف النسخة الاحتياطية غير صالح.'); }
  }

  async function installApp() {
    const prompt = installPrompt as Event & { prompt?: () => Promise<void> };
    if (!prompt?.prompt) return;
    await prompt.prompt(); setInstallPrompt(null);
  }

  function renderAudioResults(sourceText: string) {
    if (!audioResults.length) return null;
    return <div className='inline-results'>
      {audioResults.map(item => <article className='audio-card' key={item.id}>
        <div className='audio-title'><strong>{item.label}</strong>{item.quality && <div className={item.quality.passed ? 'score good' : 'score bad'}>{Math.round(item.quality.score || 0)}%</div>}</div>
        <audio controls src={item.url} />
        {tab === 'lab' && <div className='rating'><span>قيّم:</span>{[1, 2, 3, 4, 5].map(score => <button key={score} onClick={() => rateVoice(item.id, item.voice, score)}>{score}★</button>)}{blindLab && revealedBlind[item.id] && <small>{item.voice}</small>}</div>}
        {item.quality?.failedPhrases?.map(phrase => <button className='repair' key={phrase} onClick={() => repairPhrase(phrase)}>أعد «{phrase}»</button>)}
        {!item.quality && <button className='secondary' disabled={Boolean(loading)} onClick={() => checkQuality(item.id, sourceText)}>فحص النطق</button>}
        <a className='download' href={item.url} download={`${item.label.replace(/\s+/g, '-')}.wav`}>تحميل WAV</a>
      </article>)}
    </div>;
  }

  return (
    <main className='shell'>
      <header className='hero'>
        <div className='brand-mark'><img src='./icon.svg' alt='شعار Toto Kids Studio' /></div>
        <div className='hero-copy'>
          <p className='eyebrow'>TOTO KIDS STUDIO</p>
          <h1>Toto Kids Studio <span>7.15 Alpha</span></h1>
          <p>إنتاج أطفال مصري متكامل، مع Soly Focus وحماية جلسة المالك.</p>
        </div>
        {installPrompt && <button className='install' onClick={installApp}>📲 تثبيت</button>}
      </header>

      {ownerAuth && !ownerAuth.authenticated && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>OWNER SESSION</p><h2>حماية مفاتيح التوليد والحسابات</h2></div><span className='badge hot'>مقفول</span></div>
        {!ownerAuth.configured && !ownerAuth.disabled ? <p className='hint'>السيرفر محتاج متغير <code>SOLY_OWNER_TOKEN</code> قبل أي تشغيل إنتاجي لـ7.15. لحد ما يتظبط، التوليد والأدوات الحساسة مقفولة افتراضيًا.</p> : <>
          <p className='hint'>اكتب Owner Token مرة واحدة. السيرفر يحوله لجلسة HttpOnly؛ التوكن نفسه لا يتحفظ في LocalStorage.</p>
          <div className='action-row'><input type='password' value={ownerTokenInput} onChange={event => setOwnerTokenInput(event.target.value)} placeholder='Owner Token' autoComplete='current-password' /><button className='primary' disabled={Boolean(loading)} onClick={loginOwner}>🔐 فتح جلسة المالك</button></div>
        </>}
      </section>}
      {ownerAuth?.authenticated && !ownerAuth.disabled && <div className='action-row'><span className='badge good-badge'>🔒 جلسة المالك مفتوحة</span><button className='mini' disabled={Boolean(loading)} onClick={logoutOwner}>قفل الجلسة</button></div>}

      <nav className='tabs'>
        {tabs.map(item => <button key={item.id} className={tab === item.id ? 'tab active' : 'tab'} onClick={() => { setTab(item.id); setMessage(''); }}>{item.icon}<span>{item.label}</span></button>)}
      </nav>

      {tab === 'voice' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>CHILD-ONLY VOICE DNA</p><h2>صوت الشخصية مش اسم المحرك</h2></div><span className='badge'>QA تلقائي</span></div>
        <div className='grid three'>
          <label>الشخصية<select value={profileId} onChange={event => setProfileId(event.target.value)}>{profiles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>الخامة الأساسية<select value={voice} onChange={event => setVoice(event.target.value)}>{voices.map(name => <option key={name} value={name}>{voiceLabel(name)}</option>)}</select></label>
          <label>اللهجة<select value={dialectKey} onChange={event => setDialectKey(event.target.value as DialectKey)}>{dialectPresets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        </div>
        <label className='field'>النص<textarea value={text} onChange={event => setText(event.target.value)} maxLength={1800} /></label>

        <div className='director-card'>
          <div className='section-head'><div><p className='kicker'>DIRECTOR MODE</p><h3>قول الموقف.. وسيب الأداء على المخرج</h3></div><span className='badge hot'>جديد</span></div>
          <textarea value={directorScene} onChange={event => setDirectorScene(event.target.value)} />
          <button className='secondary wide' disabled={Boolean(loading)} onClick={runDirector}>🎭 حلّل الموقف واضبط الأداء</button>
          {directorReason && <p className='hint success'>{directorReason}</p>}
        </div>

        <div className='grid three'>
          <label>العمر<input type='range' min='4' max='12' value={age} onChange={event => setAge(Number(event.target.value))} /><strong>{age} سنين</strong></label>
          <label>الطفولية<input type='range' min='1' max='5' value={childStrength} onChange={event => setChildStrength(Number(event.target.value))} /><strong>{childStrength}/5</strong></label>
          <label>الطاقة<input type='range' min='1' max='5' value={energy} onChange={event => setEnergy(Number(event.target.value))} /><strong>{energy}/5</strong></label>
          <label>السرعة<input type='range' min='0.82' max='1.18' step='0.02' value={speed} onChange={event => setSpeed(Number(event.target.value))} /><strong>{speed.toFixed(2)}×</strong></label>
          <label>الطبقة<input type='range' min='-3' max='5' value={pitch} onChange={event => setPitch(Number(event.target.value))} /><strong>{pitch > 0 ? '+' : ''}{pitch}</strong></label>
          <label>الأسلوب<select value={style} onChange={event => setStyle(event.target.value as StyleKey)}>{styleOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        </div>
        <label className='field'>ملاحظات المخرج<input value={directorNotes} onChange={event => setDirectorNotes(event.target.value)} placeholder='مثال: متردد في أول كلمة وبعدها يفرح' /></label>
        <label className='field'>تعبير إضافي<input value={expression} onChange={event => setExpression(event.target.value)} placeholder='طبيعي / دهشة / ضحكة صغيرة...' /></label>
        <div className='switch-row'>
          <label><input type='checkbox' checked={autoQa} onChange={event => setAutoQa(event.target.checked)} /> فحص النطق تلقائي بعد التوليد</label>
          <label><input type='checkbox' checked={autoMaster} onChange={event => setAutoMaster(event.target.checked)} /> Auto Master للصوت</label>
        </div>
        <p className='hint'>📖 قاموس القناة فيه {dictionary.length} كلمة ثابتة. البرنامج يستخدمه في كل توليد علشان أسماء الشخصيات والكلمات الإنجليزية ما تتغيرش.</p>
        <div className='action-row'><button className='secondary' onClick={saveCurrentDna}>💾 احفظ DNA</button><button className='primary grow' disabled={Boolean(loading)} onClick={generateVoice}>🎙️ ولّد الصوت</button></div>
        {tab === 'voice' && renderAudioResults(text)}
      </section>}

      {tab === 'dialects' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>EGYPT DIALECT LAB</p><h2>اختبر اللهجة بدل ما نفترضها</h2></div><span className='badge gold'>A/B لغوي</span></div>
        <p className='hint'>اللهجات هنا توجيه أداء خفيف ومحترم وليست ضمانًا لمحاكاة محلية 100%. الهدف القرب والوضوح، مش الكاريكاتير.</p>
        <div className='dialect-grid'>{dialectPresets.map(item => <button key={item.id} className={dialectTargets.includes(item.id) ? 'dialect-card selected' : 'dialect-card'} onClick={() => setDialectTargets(current => current.includes(item.id) ? current.filter(id => id !== item.id) : current.length < 4 ? [...current, item.id] : current)}><strong>{item.label}</strong><span>{item.region}</span><small>{item.sample}</small></button>)}</div>
        <label className='field'>النص الأساسي<textarea value={dialectText} onChange={event => setDialectText(event.target.value)} /></label>
        <button className='primary wide' disabled={Boolean(loading) || dialectTargets.length < 2} onClick={generateDialectVariants}>🇪🇬 ولّد نسخ اللهجات للمقارنة</button>
        {dialectVariants.length > 0 && <div className='variant-list'>{dialectVariants.map((variant, index) => <article className='variant-card' key={`${variant.dialectKey}-${index}`}><div><strong>{variant.label || variant.dialectKey}</strong><small>{variant.notes}</small></div><p>{variant.text}</p><button className='secondary' onClick={() => { setText(variant.text || ''); setDialectKey((variant.dialectKey || 'egyptian-white') as DialectKey); setTab('voice'); }}>استخدم في الصوت</button></article>)}</div>}
      </section>}

      {tab === 'lab' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>BLIND CHILD VOICE LAB</p><h2>نختار بالأذن مش باسم الموديل</h2></div><span className='badge'>2–4 أصوات</span></div>
        <label className='switch-line'><input type='checkbox' checked={blindLab} onChange={event => setBlindLab(event.target.checked)} /> اختبار أعمى: اخفي أسماء الأصوات لحد ما تقيّم</label>
        <label className='field'>اختبار الأداء القياسي<textarea value={labText} onChange={event => setLabText(event.target.value)} /></label>
        <button className='mini' onClick={() => setLabText(standardVoiceTest)}>إرجاع اختبار الضحك + السؤال + الهدوء + الإنجليزي</button>
        <div className='voice-grid'>{voiceMeta.map(item => <button key={item[0]} className={labVoices.includes(item[0]) ? 'voice-chip selected' : item[2] ? 'voice-chip recommended' : 'voice-chip'} onClick={() => toggleLabVoice(item[0])}>{item[0]}<small>{item[1]} {item[2] ? '⭐' : ''}</small></button>)}</div>
        <button className='primary wide' disabled={Boolean(loading) || labVoices.length < 2} onClick={runVoiceLab}>🧪 ابدأ الاختبار الأعمى</button>
        {rankedVoices.length > 0 && <div className='ranking'><h3>🏆 ترتيب مشروعنا</h3>{rankedVoices.slice(0, 7).map(item => <div key={item.name}><strong>{item.name}</strong><span>{item.average.toFixed(1)}/5 • {item.count} تقييم</span></div>)}</div>}
        {tab === 'lab' && renderAudioResults(labText)}
      </section>}

      {tab === 'dialogue' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>MULTI-SPEAKER</p><h2>حوار طفلين بنفس هوية القناة</h2></div></div>
        <label className='field'>الحوار<textarea className='tall' value={dialogueScript} onChange={event => setDialogueScript(event.target.value)} /></label>
        <div className='grid two'>
          <label>توتو<select value={voiceA} onChange={event => setVoiceA(event.target.value)}>{voices.map(name => <option key={name} value={name}>{voiceLabel(name)}</option>)}</select></label>
          <label>لولو<select value={voiceB} onChange={event => setVoiceB(event.target.value)}>{voices.map(name => <option key={name} value={name}>{voiceLabel(name)}</option>)}</select></label>
        </div>
        <button className='primary wide' disabled={Boolean(loading)} onClick={generateDialogue}>👧🏻 مثّل الحوار</button>
        {tab === 'dialogue' && renderAudioResults(dialogueScript)}
      </section>}

      {tab === 'record' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>TRANSCRIBE → CHILD VOICE</p><h2>مثّل بطريقتك وبعدين حوّله للشخصية</h2></div></div>
        <label className='upload-box'>🎧 اختار تسجيلك<input type='file' accept='audio/*' onChange={event => setRecordFile(event.target.files?.[0] || null)} /><span>{recordFile ? `${recordFile.name} • ${(recordFile.size / 1024 / 1024).toFixed(1)} MB` : 'MP3 / WAV / M4A — لحد 8 ميجا'}</span></label>
        <button className='secondary wide' disabled={Boolean(loading) || !recordFile} onClick={transcribe}>📝 استخرج الكلام</button>
        {transcript && <div className='result-box'><h3>النص المستخرج</h3><textarea value={transcript} onChange={event => setTranscript(event.target.value)} /><button className='primary' onClick={() => { setText(transcript); setTab('voice'); }}>🎙️ افتحه في Voice DNA</button></div>}
      </section>}

      {tab === 'music' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>KIDS SONG STUDIO</p><h2>مش أغنية وخلاص.. أغنية لها وظيفة</h2></div><span className='badge'>Lyria</span></div>
        <label className='field'>فكرة الأغنية<textarea value={musicTopic} onChange={event => setMusicTopic(event.target.value)} /></label>
        <div className='grid three'>
          <label>القالب<select value={songType} onChange={event => setSongType(event.target.value as typeof songType)}>{songTypes.map(item => <option key={item[0]} value={item[0]}>{item[1]}</option>)}</select></label>
          <label>المدة<select value={musicMode} onChange={event => setMusicMode(event.target.value as 'clip' | 'full')}><option value='clip'>30 ثانية Shorts</option><option value='full'>أغنية كاملة</option></select></label>
          <label>الغناء<select value={musicVocals ? 'yes' : 'no'} onChange={event => setMusicVocals(event.target.value === 'yes')} disabled={songType === 'karaoke'}><option value='yes'>غناء وكلمات</option><option value='no'>موسيقى فقط</option></select></label>
        </div>
        <label className='field'>المود<input value={musicMood} onChange={event => setMusicMood(event.target.value)} /></label>
        <label className='field'>مسودة كلماتك أو الفكرة اللغوية<textarea value={lyricsDraft} onChange={event => setLyricsDraft(event.target.value)} placeholder='اختياري، لكن لو كتبت كلمات نقدر نعمل فحص تربوي قبل التلحين' /></label>
        <div className='action-row'><button className='secondary' disabled={Boolean(loading) || !lyricsDraft.trim()} onClick={reviewLyrics}>🛡️ راجع الكلمات</button><button className='primary grow' disabled={Boolean(loading)} onClick={generateMusic}>🎵 ولّد الأغنية</button></div>
        {lyricsReview && <div className='quality-card'><div className={lyricsReview.kidSafe ? 'score good' : 'score bad'}>{lyricsReview.kidSafe ? 'آمنة للأطفال' : 'محتاجة تعديل'}</div><p>وضوح التعلم: <strong>{lyricsReview.learningClarity ?? '-'}%</strong> • سهولة الحفظ: <strong>{lyricsReview.memorability ?? '-'}%</strong> • كلمات جديدة: <strong>{lyricsReview.newWordCount ?? '-'}</strong></p>{lyricsReview.issues?.length ? <p>ملاحظات: {lyricsReview.issues.join(' • ')}</p> : null}{lyricsReview.suggestedChorus && <p>كورس مقترح: <strong>{lyricsReview.suggestedChorus}</strong></p>}</div>}
        {musicUrl && <div className='result-box'><h3>الأغنية جاهزة</h3><audio controls src={musicUrl} /><a className='download' href={musicUrl} download>تحميل MP3</a>{lyrics && <pre className='lyrics'>{lyrics}</pre>}</div>}
      </section>}

      {tab === 'image' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>IMAGE STUDIO</p><h2>صور بنفس هوية القناة</h2></div></div>
        <label className='field'>وصف الصورة<textarea className='tall' value={imagePrompt} onChange={event => setImagePrompt(event.target.value)} /></label>
        <div className='grid two'>
          <label>المقاس<select value={imageAspect} onChange={event => setImageAspect(event.target.value)}><option value='9:16'>9:16 Shorts</option><option value='16:9'>16:9 YouTube</option><option value='1:1'>1:1</option><option value='4:5'>4:5</option></select></label>
          <label>الدقة<select value={imageSize} onChange={event => setImageSize(event.target.value)}><option value='1K'>1K سريع</option><option value='2K'>2K</option><option value='4K'>4K أعلى جودة</option></select></label>
        </div>
        <button className='primary wide' disabled={Boolean(loading)} onClick={generateImage}>🎨 ارسم المشهد</button>
        {imageUrl && <div className='image-result'><img src={imageUrl} alt='مشهد أطفال مولد' /><a className='download' href={imageUrl} download>تحميل الصورة</a></div>}
      </section>}

      {tab === 'video' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>VEO</p><h2>مشهد كرتوني رأسي</h2></div><span className={`badge risk-${usageGuard}`}>استهلاك {usageGuard}</span></div>
        <label className='field'>وصف المشهد<textarea className='tall' value={videoPrompt} onChange={event => setVideoPrompt(event.target.value)} /></label>
        <div className='grid two'>
          <label>الموديل<select value={videoModel} onChange={event => setVideoModel(event.target.value)}><option value='veo-3.1-lite-generate-preview'>Lite — أوفر</option><option value='veo-3.1-generate-preview'>Veo 3.1 — جودة</option></select></label>
          <label>الدقة<select value={videoResolution} onChange={event => setVideoResolution(event.target.value)}><option value='720p'>720p</option><option value='1080p'>1080p</option><option value='4k'>4K</option></select></label>
        </div>
        <p className='hint warning'>حارس الاستخدام لا يشتري أي خطة ولا Credits. هو بس يخليك شايف المسار الأغلى قبل التوليد.</p>
        <button className='primary wide' disabled={Boolean(loading)} onClick={generateVideo}>🎬 ولّد 8 ثواني</button>
        {videoUrl && <div className='result-box'><video controls playsInline src={videoUrl} /><a className='download' href={videoUrl} download>تحميل MP4</a></div>}
        {videoFallbackPlan && <div className='result-box'><h3>Animatic Rescue Plan</h3><pre className='plan'>{videoFallbackPlan}</pre></div>}
      </section>}

      {tab === 'studio' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>CHANNEL BIBLE → EPISODE</p><h2>مخرج الحلقة بذاكرة ثابتة</h2></div><span className='badge hot'>Anti-template</span></div>
        <label className='field'>فكرة الحلقة<textarea value={episodeIdea} onChange={event => setEpisodeIdea(event.target.value)} /></label>
        <label className='field'>الهدف القابل للقياس<input value={learningGoal} onChange={event => setLearningGoal(event.target.value)} /></label>
        <p className='hint'>هيستخدم {profiles.length} شخصيات محفوظة + {dictionary.length} كلمات نطق + قواعد القناة، ويطلع Director Notes لكل جملة بدل سيناريو آلي مكرر.</p>
        <button className='primary wide' disabled={Boolean(loading)} onClick={buildEpisode}>✨ ابنِ خطة الحلقة كاملة</button>
        {episodePlan && <div className='result-box'><h3>خطة الإنتاج</h3><pre className='plan'>{episodePlan}</pre></div>}
      </section>}

      {tab === 'production' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>PRODUCTION OS</p><h2>الحلقة لها سجل وبوابات اعتماد</h2></div><span className={safetyDone && qaDone ? 'badge good-badge' : 'badge gold'}>{safetyDone && qaDone ? 'QA جاهز' : 'مراجعة مطلوبة'}</span></div>
        <div className='grid three'><label>Video ID<input value={videoRecord.videoId} onChange={event => setVideoRecord(current => ({ ...current, videoId: event.target.value }))} /></label><label>السوق<input value={videoRecord.market} onChange={event => setVideoRecord(current => ({ ...current, market: event.target.value }))} /></label><label>Made for Kids<select value={videoRecord.madeForKids} onChange={event => setVideoRecord(current => ({ ...current, madeForKids: event.target.value }))}><option>نعم</option><option>مراجعة</option><option>لا</option></select></label></div>
        <label className='field'>الوعد التحريري<input value={videoRecord.promise} onChange={event => setVideoRecord(current => ({ ...current, promise: event.target.value }))} /></label>
        <label className='field'>سبب قرار الجمهور<input value={videoRecord.madeForKidsReason} onChange={event => setVideoRecord(current => ({ ...current, madeForKidsReason: event.target.value }))} /></label>
        <label className='field'>مصدر الفكرة وتاريخ الفحص<input value={videoRecord.ideaSource} onChange={event => setVideoRecord(current => ({ ...current, ideaSource: event.target.value }))} /></label>
        <div className='divider' /><div className='section-head'><h3>خط الإنتاج</h3><span className='badge'>{stages.filter(stage => stage.status === 'approved').length}/{stages.length}</span></div>
        <div className='pipeline'>{stages.map(stage => <button key={stage.id} className={`stage ${stage.status}`} onClick={() => cycleStage(stage.id)}><span>{stage.status === 'approved' ? '✓' : stage.status === 'working' ? '◐' : '○'}</span><strong>{stage.label}</strong><small>{stage.status === 'approved' ? stage.decidedAt : stage.status === 'working' ? 'شغال' : 'لسه'}</small></button>)}</div>
        <div className='split-panels'>
          <div className='lux-card'><div className='section-head'><h3>🛡️ Safety Sign-off</h3><span>{Object.values(safetyChecks).filter(Boolean).length}/{safetyItems.length}</span></div>{safetyItems.map(item => <label className='check-line' key={item[0]}><input type='checkbox' checked={Boolean(safetyChecks[item[0]])} onChange={event => setSafetyChecks(current => ({ ...current, [item[0]]: event.target.checked }))} />{item[1]}</label>)}<button className='secondary wide' disabled={Boolean(loading)} onClick={runSafetyReview}>AI مراجعة سلامة للسيناريو</button>{safetyReview && <div className='review-box'><strong>{Math.round(safetyReview.score || 0)}% {safetyReview.passed ? '✓' : '⚠'}</strong><p>{safetyReview.learningIntegrity}</p>{safetyReview.risks?.length ? <p>مخاطر: {safetyReview.risks.join(' • ')}</p> : null}{safetyReview.fixes?.length ? <p>إصلاحات: {safetyReview.fixes.join(' • ')}</p> : null}</div>}</div>
          <div className='lux-card'><div className='section-head'><h3>✅ QA Matrix</h3><span>{Object.values(qaChecks).filter(Boolean).length}/{qaItems.length}</span></div>{qaItems.map(item => <label className='check-line' key={item[0]}><input type='checkbox' checked={Boolean(qaChecks[item[0]])} onChange={event => setQaChecks(current => ({ ...current, [item[0]]: event.target.checked }))} />{item[1]}</label>)}</div>
        </div>
        <div className='divider' /><div className='section-head'><h3>📜 سجل الحقوق والمكونات</h3><span className='badge'>{rights.length} أصل</span></div>
        <div className='grid three'><label>الأصل<input value={newRight.asset} onChange={event => setNewRight(current => ({ ...current, asset: event.target.value }))} placeholder='صورة المشهد 03' /></label><label>الأداة<input value={newRight.tool} onChange={event => setNewRight(current => ({ ...current, tool: event.target.value }))} placeholder='Gemini / Canva...' /></label><label>الحالة<select value={newRight.commercial} onChange={event => setNewRight(current => ({ ...current, commercial: event.target.value as RightsEntry['commercial'] }))}><option value='review'>مراجعة</option><option value='cleared'>مسموح</option><option value='blocked'>موقوف</option></select></label></div>
        <div className='grid two'><label>المصدر/الرابط<input value={newRight.source} onChange={event => setNewRight(current => ({ ...current, source: event.target.value }))} /></label><label>الرخصة/الإثبات<input value={newRight.license} onChange={event => setNewRight(current => ({ ...current, license: event.target.value }))} /></label></div><button className='secondary wide' onClick={addRightsEntry}>＋ أضف الأصل للسجل</button>
        {rights.length > 0 && <div className='rights-list'>{rights.map(item => <article key={item.id}><div><strong>{item.asset}</strong><span>{item.tool} • {item.createdAt}</span></div><em className={`right-${item.commercial}`}>{item.commercial === 'cleared' ? 'مسموح' : item.commercial === 'blocked' ? 'موقوف' : 'مراجعة'}</em></article>)}</div>}
        <div className='clean-export'><div className='section-head'><div><p className='kicker'>CLEAN EXPORT</p><h3>نسخة نظيفة بطريقة مرخصة</h3></div><span className={cleanExportReady ? 'badge good-badge' : 'badge gold'}>{cleanExportReady ? 'جاهز' : 'تحقق'}</span></div><p>مش بنشيل علامة ملكية لطرف ثالث ولا SynthID. لو أداة بتضيف علامة مرئية، استخدم المصدر الأصلي أو خطة/تصدير يسمح بنسخة بلا علامة. علامتك أنت داخل المشروع تقدر تستبعدها قبل التصدير من المصدر.</p><label className='check-line'><input type='checkbox' checked={exportChecks.ownedSource} onChange={event => setExportChecks(current => ({ ...current, ownedSource: event.target.checked }))} />عندي الأصل أو المشروع المصدر</label><label className='check-line'><input type='checkbox' checked={exportChecks.licenseChecked} onChange={event => setExportChecks(current => ({ ...current, licenseChecked: event.target.checked }))} />راجعت حق الاستخدام والتصدير</label><label className='check-line'><input type='checkbox' checked={exportChecks.noThirdPartyWatermark} onChange={event => setExportChecks(current => ({ ...current, noThirdPartyWatermark: event.target.checked }))} />الملف لا يحتوي علامة ملكية ظاهرة لطرف ثالث</label><label className='check-line'><input type='checkbox' checked={exportChecks.keepProvenance} onChange={event => setExportChecks(current => ({ ...current, keepProvenance: event.target.checked }))} />أحافظ على بيانات المصدر/SynthID ولا أتحايل عليها</label></div>
        <div className='divider' /><button className='primary wide' disabled={Boolean(loading)} onClick={generateMetadataPack}>🧲 جهز حزمة العنوان والوصف والThumbnail</button>{metadataPack && <div className='meta-pack'><h3>حزمة النشر</h3><strong>عناوين</strong>{metadataPack.titles?.map(title => <p key={title}>{title}</p>)}<strong>Thumbnail</strong><p>{metadataPack.thumbnailTexts?.join(' • ')}</p><strong>الوصف</strong><p>{metadataPack.description}</p><strong>Shorts Hook</strong><p>{metadataPack.shortsHook}</p></div>}
      </section>}

      {tab === 'growth' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>GROWTH LAB</p><h2>قرار من عدة مؤشرات مش CTR لوحده</h2></div><span className='badge gold'>Postmortem</span></div><p className='hint'>افصل Shorts عن الفيديو الطويل، وثبت متغيرًا واحدًا في كل تجربة. الأرقام هنا تدخلها من YouTube Analytics؛ البرنامج لا يخترع بيانات.</p>
        <div className='grid three'><label>Impressions<input value={growth.impressions} onChange={event => setGrowth(current => ({ ...current, impressions: event.target.value }))} /></label><label>CTR<input value={growth.ctr} onChange={event => setGrowth(current => ({ ...current, ctr: event.target.value }))} /></label><label>Retention<input value={growth.retention} onChange={event => setGrowth(current => ({ ...current, retention: event.target.value }))} /></label><label>Avg View Duration<input value={growth.avgViewDuration} onChange={event => setGrowth(current => ({ ...current, avgViewDuration: event.target.value }))} /></label><label>New viewers<input value={growth.newViewers} onChange={event => setGrowth(current => ({ ...current, newViewers: event.target.value }))} /></label><label>Returning<input value={growth.returningViewers} onChange={event => setGrowth(current => ({ ...current, returningViewers: event.target.value }))} /></label><label>Engaged Views<input value={growth.engagedViews} onChange={event => setGrowth(current => ({ ...current, engagedViews: event.target.value }))} /></label><label>Stayed to watch<input value={growth.stayedToWatch} onChange={event => setGrowth(current => ({ ...current, stayedToWatch: event.target.value }))} /></label><label>Claims / إعادة عمل<input value={`${growth.claims} ${growth.rework}`.trim()} onChange={event => setGrowth(current => ({ ...current, claims: event.target.value }))} /></label></div>
        <label className='field'>فرضية التجربة<input value={experiment} onChange={event => setExperiment(event.target.value)} /></label><label className='field'>ملاحظات الحلقة<textarea value={growthNotes} onChange={event => setGrowthNotes(event.target.value)} /></label><button className='primary wide' disabled={Boolean(loading)} onClick={runPostmortem}>📈 حلل الحلقة وحدد التجربة التالية</button>{postmortem && <div className='postmortem'><h3>Postmortem</h3><p>{postmortem.summary}</p>{postmortem.wins?.length ? <p><strong>نجح:</strong> {postmortem.wins.join(' • ')}</p> : null}{postmortem.problems?.length ? <p><strong>مشاكل:</strong> {postmortem.problems.join(' • ')}</p> : null}<p><strong>التجربة الجاية:</strong> {postmortem.nextTest}</p><p className='hint warning'>{postmortem.caution}</p></div>}
      </section>}

      {tab === 'characters' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>VOICE DNA LIBRARY</p><h2>كل شخصية لها تمثيلها الخاص</h2></div><span className='badge'>{profiles.length} أطفال</span></div>
        <div className='profile-list'>{profiles.map(item => <article className='profile-card' key={item.id}><div className='avatar'>{item.character === 'boy' ? '👦🏻' : '👧🏻'}</div><div><strong>{item.name}</strong><span>{voiceLabel(item.voice)} • {item.age} سنين • {dialectPresets.find(d => d.id === (item.dialectKey || 'egyptian-white'))?.label}</span><small>{item.catchphrase || item.directorNotes}</small></div><button onClick={() => { setProfileId(item.id); setTab('voice'); }}>استخدم</button></article>)}</div>
        <div className='divider' />
        <h3>شخصية طفل جديدة</h3>
        <div className='grid two'>
          <label>الاسم<input value={newProfile.name} onChange={event => setNewProfile(current => ({ ...current, name: event.target.value }))} placeholder='مثال: سوسو' /></label>
          <label>الخامة<select value={newProfile.voice} onChange={event => setNewProfile(current => ({ ...current, voice: event.target.value }))}>{childRecommended.map(name => <option key={name} value={name}>{voiceLabel(name)}</option>)}</select></label>
          <label>العمر<input type='range' min='4' max='12' value={newProfile.age} onChange={event => setNewProfile(current => ({ ...current, age: Number(event.target.value) }))} /><strong>{newProfile.age} سنين</strong></label>
          <label>الشخصية<select value={newProfile.character} onChange={event => setNewProfile(current => ({ ...current, character: event.target.value as CharacterKey }))}><option value='boy'>ولد طفل</option><option value='girl'>بنت طفلة</option></select></label>
          <label>جملة مميزة<input value={newProfile.catchphrase} onChange={event => setNewProfile(current => ({ ...current, catchphrase: event.target.value }))} placeholder='مثال: يلا نجرب!' /></label>
          <label>ملاحظات تمثيل<input value={newProfile.directorNotes} onChange={event => setNewProfile(current => ({ ...current, directorNotes: event.target.value }))} placeholder='فضولي، هادي، بيتحمس بسرعة...' /></label>
          <label>اللهجة<select value={newProfile.dialectKey || 'egyptian-white'} onChange={event => setNewProfile(current => ({ ...current, dialectKey: event.target.value as DialectKey }))}>{dialectPresets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        </div>
        <button className='primary wide' onClick={saveProfile}>💾 احفظ Voice DNA</button>
      </section>}

      {tab === 'bible' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>CHANNEL BIBLE</p><h2>ذاكرة مستقلة عن أي موديل</h2></div><span className='badge'>محفوظة محليًا</span></div>
        <p className='hint'>حتى لو غيرنا Gemini أو أضفنا محرك صوت تاني، هوية القناة وقواعدها تفضل ثابتة.</p>
        <div className='grid two'>
          <label>اسم العالم/القناة<input value={bible.channelName} onChange={event => setBible(current => ({ ...current, channelName: event.target.value }))} /></label>
          <label>الجمهور<input value={bible.audience} onChange={event => setBible(current => ({ ...current, audience: event.target.value }))} /></label>
        </div>
        <label className='field'>اللهجة<textarea value={bible.dialect} onChange={event => setBible(current => ({ ...current, dialect: event.target.value }))} /></label>
        <label className='field'>القيم<textarea value={bible.values} onChange={event => setBible(current => ({ ...current, values: event.target.value }))} /></label>
        <label className='field'>الممنوع<textarea value={bible.forbidden} onChange={event => setBible(current => ({ ...current, forbidden: event.target.value }))} /></label>
        <label className='field'>قواعد السرد<textarea value={bible.storyRules} onChange={event => setBible(current => ({ ...current, storyRules: event.target.value }))} /></label>
        <label className='field'>قواعد الصوت<textarea value={bible.audioRules} onChange={event => setBible(current => ({ ...current, audioRules: event.target.value }))} /></label>
        <label className='field'>الهوية البصرية<textarea value={bible.visualStyle} onChange={event => setBible(current => ({ ...current, visualStyle: event.target.value }))} /></label>
        <div className='divider' />
        <div className='section-head'><h3>قاموس النطق المصري</h3><span className='badge'>{dictionary.length} كلمة</span></div>
        <div className='dictionary'>{dictionary.map(item => <div key={item.id}><strong>{item.term}</strong><span>→ {item.sayAs}</span><button onClick={() => setDictionary(current => current.filter(entry => entry.id !== item.id))}>×</button></div>)}</div>
        <div className='grid two'><label>الكلمة<input value={newTerm} onChange={event => setNewTerm(event.target.value)} placeholder='Cow' /></label><label>النطق المعتمد<input value={newSayAs} onChange={event => setNewSayAs(event.target.value)} placeholder='كاو' /></label></div>
        <button className='secondary wide' onClick={addDictionaryEntry}>＋ أضف للقاموس</button>
        <div className='divider' /><div className='action-row'><button className='secondary grow' onClick={exportProject}>⬇️ نسخة احتياطية Project DNA</button><label className='secondary grow import-button'>⬆️ استرجاع نسخة<input type='file' accept='application/json' onChange={event => importProject(event.target.files?.[0] || null)} /></label></div>
      </section>}

      {tab === 'control' && <section className='panel'>
        <div className='section-head'><div><p className='kicker'>SOLY FOCUS CONTROL</p><h2>حالة الشغل محفوظة والخطوة الجاية واضحة</h2></div><span className={workSummary?.state === 'completed' ? 'badge good-badge' : 'badge gold'}>{workSummary?.state === 'completed' ? 'مكتمل' : workSummary ? 'شغال' : 'ابدأ جلسة'}</span></div>
        <p className='hint'>لو مسار اتعطل، سجله كـ Blocked وكمل أول مهمة مستقلة متاحة. المركز لا ينشر ولا يدفع ولا يغيّر أسرار تلقائيًا.</p>
        <p className='hint'>نسخة الواجهة: <strong>{WEB_VERSION}</strong> • نسخة السيرفر: <strong>{runtimeVersion || 'جاري الفحص'}</strong></p>
        <label className='field'>هدف الجلسة<textarea value={focusGoal} onChange={event => setFocusGoal(event.target.value)} /></label>
        <div className='grid two'>
          <label>وضع التشغيل<select value={controlMode} onChange={event => setControlMode(event.target.value as 'economy' | 'balanced' | 'quality')}><option value='economy'>اقتصادي — أقل استهلاك</option><option value='balanced'>متوازن</option><option value='quality'>جودة — أعلى استهلاك</option></select></label>
          <div className='hint'>الوضع الحالي يضبط الفيديو والصورة محليًا. أي خدمة مدفوعة تظل محتاجة قرار صريح؛ مركز سولي لا يشتري Credits.</div>
        </div>
        <div className='action-row'><button className='primary grow' disabled={Boolean(loading)} onClick={startFocusSession}>🧠 ابدأ/أعد بناء جلسة المتابعة</button><button className='secondary grow' disabled={Boolean(loading)} onClick={loadFocusStatus}>↻ تحديث الحالة</button></div>
        {workSummary && <div className='lux-card'>
          <div className='section-head'><h3>التقدم</h3><span className='badge'>{workSummary.counts?.done || 0} تم • {workSummary.counts?.blocked || 0} متعطل • {workSummary.counts?.pending || 0} منتظر</span></div>
          <p><strong>الهدف:</strong> {workSummary.goal}</p>
          {workSummary.nextAction ? <div className='recovery-card'><strong>الخطوة التالية</strong><p>{workSummary.nextAction.title}</p><div className='action-row'><button className='primary grow' disabled={Boolean(loading)} onClick={completeFocusTask}>✓ خلصت — هات اللي بعدها</button></div><label className='field'>لو المسار متعطل<input value={focusBlocker} onChange={event => setFocusBlocker(event.target.value)} placeholder='مثال: Provider quota / صلاحية ناقصة' /></label><button className='secondary wide' disabled={Boolean(loading)} onClick={blockFocusTask}>⤴ سجّل العائق وكمل مسار تاني</button></div> : <p className='hint success'>مفيش مهام Pending أو Running في الجلسة الحالية.</p>}
          {workSummary.blockedTasks?.length ? <div className='rights-list'>{workSummary.blockedTasks.map(item => <article key={item.id}><div><strong>{item.title}</strong><span>{item.blocker || 'عائق مسجل'}</span></div><em className='right-review'>Blocked</em></article>)}</div> : null}
          <p className='hint'>آخر تحديث: {workSummary.updatedAt || 'غير معروف'}</p>
        </div>}
      </section>}

      {loading && <div className='floating-status' aria-label='جاري التنفيذ'><span className='spinner' /></div>}
      {message && <div className='message' role='alert'>{message}{message === 'تعذر التنفيذ' && <button className='mini' onClick={() => setMessage('')}>إعادة</button>}</div>}

      <footer>Toto Kids Studio • Soly Focus 7.15 dev</footer>
    </main>
  );
}

export default App;
