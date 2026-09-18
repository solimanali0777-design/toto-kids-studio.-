import type { ChannelBible, DialectKey, Profile, StyleKey, VideoRecord } from './types';

export const voiceMeta = [
  ['Leda', 'طبيعي', true], ['Puck', 'مرح', true], ['Achird', 'ودود', true], ['Sadachbia', 'حيوي', true],
  ['Aoede', 'خفيف', true], ['Kore', 'هادي', true], ['Zephyr', 'مشرق', true],
] as const;

export const voices = voiceMeta.map(item => item[0]);
export const childRecommended = voiceMeta.filter(item => item[2]).map(item => item[0]);

export const styleOptions: Array<{ value: StyleKey; label: string }> = [
  { value: 'fun', label: 'مرح وعفوي' }, { value: 'calm', label: 'هادي ودافي' }, { value: 'excited', label: 'متحمس وحيوي' },
  { value: 'educational', label: 'تعليمي واضح' }, { value: 'story', label: 'حكّاء صغير' }, { value: 'silly', label: 'مضحك وكرتوني خفيف' },
];

export const dialectPresets: Array<{ id: DialectKey; label: string; region: string; prompt: string; sample: string }> = [
  { id: 'egyptian-white', label: 'مصري طبيعي', region: 'مصر', prompt: 'عامية مصرية طبيعية وواضحة ar-EG، كلام يومي عفوي كأن طفل مصري بيتكلم مع صاحبه، من غير فصحى ومن غير لهجة خليجية ومن غير نبرة مذيع أو قارئ ومن غير أداء روبوتي. استخدم وقفات وتنفس وإحساس محادثة طبيعيين، وخلي النطق مفهومًا لكل طفل مصري.', sample: 'بص يا صاحبي، تعالى نجرب سوا!' },
];

export const defaultProfiles: Profile[] = [
  { id: 'toto', name: 'توتو', voice: 'Leda', age: 7, character: 'boy', style: 'fun', childStrength: 5, speed: 1.02, pitch: 3, energy: 4, catchphrase: 'ياااه! شوف ده!', directorNotes: 'فضولي ومرح وبيتكلم كأنه بيكتشف الحاجة لأول مرة', dialectKey: 'egyptian-white' },
  { id: 'bibo', name: 'بيبو', voice: 'Achird', age: 8, character: 'boy', style: 'educational', childStrength: 4, speed: 0.98, pitch: 2, energy: 3, catchphrase: 'تعالى نجرب سوا!', directorNotes: 'واضح ومشجع ومش بيحسّس الطفل إنه في درس', dialectKey: 'egyptian-white' },
  { id: 'lolo', name: 'لولو', voice: 'Zephyr', age: 6, character: 'girl', style: 'fun', childStrength: 5, speed: 1.04, pitch: 4, energy: 5, catchphrase: 'أنا عارفاها!', directorNotes: 'مرحة وسريعة وبتضحك ضحكة صغيرة من غير صريخ', dialectKey: 'egyptian-white' },
  { id: 'mimi', name: 'ميمي', voice: 'Aoede', age: 7, character: 'girl', style: 'calm', childStrength: 4, speed: 0.94, pitch: 3, energy: 2, catchphrase: 'نفكر واحدة واحدة', directorNotes: 'هادية وحنينة ومطمّنة', dialectKey: 'egyptian-white' },
];

export const defaultBible: ChannelBible = {
  channelName: 'عالم توتو', dialect: 'عامية مصرية بيضاء مهذبة وبسيطة، مع اختبار اللهجة بدل افتراض أن لهجة واحدة تناسب كل الجمهور',
  audience: 'أطفال 4 إلى 8 سنوات مع مراعاة إن ولي الأمر هو بوابة الثقة',
  values: 'الفضول، المشاركة، النظافة، الصدق، مساعدة الأسرة، اللطف، التفكير والسؤال',
  forbidden: 'تنمر، خوف مبالغ، عنف، مقالب خطرة، ضغط شراء، تضليل تعليمي، تكرار آلي، تقليد طفل حقيقي أو شخصية محمية',
  visualStyle: 'هوية مصرية حديثة، ألوان دافئة وواضحة، خلفيات بسيطة، تعبيرات وجه قوية، ثبات ملابس وملامح الشخصية بين اللقطات',
  storyRules: 'Hook في أول ثانيتين، هدف واحد قابل للقياس، Logline وBeat Sheet، جمل قصيرة، مشكلة ومحاولات وحل، تفاعل مباشر، ونهاية بتكرار ذكي من غير حشو',
  audioRules: 'كل الشخصيات أطفال خياليون، لا أصوات إذاعية بالغة، Casting Brief لكل شخصية، وقفات طبيعية، الإنجليزية واضحة وسط المصري، الموسيقى لا تغطي الكلام، واختبار سماعة هاتف وسماعة رخيصة قبل الاعتماد',
};

export const standardVoiceTest = 'ياااه! شوف القطة! تفتكر اسمها إيه؟ [laughs] دي Cat. قول معايا: كات. طب لو القطة نامت؟ هنتكلم بهدوء شوية. وبعدين فجأة... مياااو! برافو يا بطل!';
export const songTypes = [['educational', 'أنشودة تعليمية'], ['call_response', 'سؤال ورد'], ['vocabulary', 'حفظ كلمات'], ['movement', 'حركة ورقص'], ['jingle', 'Jingle للشخصية'], ['karaoke', 'Karaoke بدون غناء']] as const;

export const pipelineStages = [
  ['brief', 'Brief'], ['research', 'Research'], ['script', 'Script'], ['storyboard', 'Storyboard'], ['animatic', 'Animatic'], ['assets', 'Assets'], ['voice', 'Voice'], ['animation', 'Animation'], ['edit', 'Edit'], ['safety', 'Safety'], ['qa', 'QA'], ['metadata', 'Metadata'], ['upload', 'Upload'], ['scheduled', 'Scheduled'], ['published', 'Published'], ['postmortem', 'Postmortem'],
] as const;

export const safetyItems = [
  ['age', 'ملاءمة العمر واللغة'], ['fear', 'لا خوف أو عنف أو تنمر زائد'], ['imitable', 'لا سلوك خطر قابل للتقليد'], ['education', 'المعلومة التعليمية صادقة ومفهومة'], ['commercial', 'لا ضغط شراء أو ترويج مفرط'], ['privacy', 'لا بيانات طفل حقيقي أو موقع أو روتين'], ['links', 'الروابط الخارجية آمنة وموجهة للوالد'], ['madeforkids', 'قرار Made for Kids موثق وسببه مكتوب'], ['stereotypes', 'لا صور نمطية أو سخرية من لهجة/منطقة'], ['humanreview', 'راجع إنسان القصة قبل النشر'],
] as const;

export const qaItems = [
  ['phone', 'اختبار على شاشة ومكبر هاتف'], ['speaker', 'اختبار سماعة رخيصة'], ['headphones', 'اختبار سماعة رأس'], ['captions', 'مراجعة captions والأسماء واللهجات'], ['audio', 'الصوت واضح والموسيقى لا تغطي الحوار'], ['visual', 'ثبات الشخصية والاستمرارية البصرية'], ['render', 'لا أخطاء تصيير أو إطارات مكسورة'], ['claims', 'فحص claims وwarnings بعد الرفع الخاص'], ['metadata', 'العنوان والوصف والصورة صادقون'], ['private', 'تشغيل النسخة Private/Unlisted بعد معالجة YouTube'],
] as const;

export const defaultVideoRecord: VideoRecord = { videoId: 'EP-001', promise: 'تعليم كلمة واحدة أو سلوك واحد داخل قصة قصيرة', audience: '4-8 سنوات + ولي الأمر', market: 'مصر', language: 'العربية / عامية مصرية', madeForKids: 'نعم', madeForKidsReason: 'الشخصيات والأغاني واللغة والقصة موجهة للأطفال', ideaSource: 'فكرة تحريرية / Trends / ملاحظة ولي أمر', nextPolicyReview: '' };

export const toolboxItems = [
  { category: 'Google', name: 'Gemini API / AI Studio', role: 'النص والصوت والتحليل وتوجيه الإنتاج', status: 'مفعّل في التطبيق', rights: 'راجع حدود المشروع والفوترة والخصوصية وقت الاستخدام' },
  { category: 'Google', name: 'NotebookLM', role: 'مصادر تربوية ومراجعة الحبكة والحقائق', status: 'مساند', rights: 'لا ترفع بيانات طفل تعريفية' },
  { category: 'Google', name: 'Flow / Veo / Imagen', role: 'مشاهد وصور وتحريك مرجعي', status: 'حسب الإتاحة', rights: 'احتفظ بسجل الموديل والإصدار وSynthID' },
  { category: 'Google', name: 'YouTube Studio / Analytics / Trends', role: 'النشر والقياس وفجوات المحتوى', status: 'أساسي', rights: 'Made for Kids يقيّد بعض البيانات والميزات' },
  { category: 'Google', name: 'Drive / Docs / Sheets / Looker Studio', role: 'أرشفة وقوالب ولوحات تشغيل', status: 'مقترح', rights: 'صلاحيات ونسخ احتياطي وبنية مجلدات ثابتة' },
  { category: 'صوت', name: 'Google Cloud TTS / Chirp + SSML', role: 'نطق متقدم وتحكم أدق عند ربط Cloud', status: 'مسار توسعة', rights: 'فوترة Cloud مستقلة وشروط أصوات منفصلة' },
  { category: 'صوت', name: 'ElevenLabs', role: 'تعليق صوتي وتمثيل بديل', status: 'اختياري', rights: 'الخطة التجارية وإذن الاستنساخ عند الحاجة' },
  { category: 'صوت', name: 'Lahajati / Narakeet', role: 'بدائل للعربية واللهجات', status: 'اختياري', rights: 'اختبر الجودة وشروط الاستخدام التجاري' },
  { category: 'Lip Sync', name: 'Hedra / Sync Labs', role: 'مزامنة الفم وتعبيرات الوجه', status: 'اختياري', rights: 'استخدم شخصيات وأصوات تملك حقوقها' },
  { category: 'فيديو', name: 'Runway / Kling / Pika', role: 'حركة ولقطات بديلة ومؤثرات', status: 'اختياري', rights: 'راجع العلامة المرئية وحقوق الخطة الحالية' },
  { category: 'تصميم', name: 'Canva / Adobe Firefly', role: 'هوية وThumbnails وأصول بصرية', status: 'مقترح', rights: 'عناصر المكتبة والمخرجات قد تحمل شروطًا منفصلة' },
  { category: 'مونتاج', name: 'CapCut / Premiere', role: 'المونتاج وCaptions والتجميع', status: 'مقترح', rights: 'ليس كل قالب أو صوت أو عنصر تجاريًا' },
  { category: 'تحسين', name: 'Topaz Video AI', role: 'رفع دقة وتنعيم لقطات عند الحاجة', status: 'اختياري', rights: 'لا يستخدم كبديل لمصدر أصلي مرخص' },
  { category: 'محلي مفتوح', name: 'ComfyUI / Stable Diffusion', role: 'صور محلية وتحكم عقدي', status: 'بديل محلي', rights: 'رخص checkpoint وLoRA وcustom nodes منفصلة' },
  { category: 'محلي مفتوح', name: 'LTX-Video', role: 'تجارب فيديو محلية', status: 'بديل محلي', rights: 'رخصة checkpoint قد تختلف عن الكود' },
  { category: 'محلي مفتوح', name: 'Piper', role: 'TTS محلي', status: 'بديل محلي', rights: 'رخصة كل صوت وإذن استخدامه التجاري' },
  { category: 'محلي مفتوح', name: 'Whisper / Subtitle Edit', role: 'تفريغ وترجمة ومراجعة Captions', status: 'بديل محلي', rights: 'راجع الأسماء واللهجات يدويًا' },
  { category: 'تحريك', name: 'Blender / Synfig', role: 'تحريك 2D/3D وأصول قابلة للتحكم', status: 'بديل احترافي', rights: 'سجل الإضافات والأصول وملفات المصدر' },
  { category: 'مونتاج مفتوح', name: 'Kdenlive / Shotcut', role: 'تجميع وتصدير محلي', status: 'بديل محلي', rights: 'احتفظ بالماستر والمصدر' },
  { category: 'DAM', name: 'ResourceSpace / Nextcloud', role: 'إدارة أصول وحقوق ونسخ احتياطي', status: 'للتوسع', rights: 'راجع صلاحيات الفريق والنسخ الاحتياطي' },
  { category: 'أتمتة', name: 'Activepieces / n8n', role: 'سير عمل وربط مراحل الإنتاج', status: 'للتوسع', rights: 'أسرار الاتصال والتراخيص تختلف' },
  { category: 'نشر', name: 'Metricool / Buffer', role: 'تقويم ونشر متعدد وتقارير', status: 'عند الحاجة', rights: 'لا يتجاوز قيود Made for Kids' },
  { category: 'بحث', name: 'vidIQ / TubeBuddy', role: 'أفكار وكلمات ومنافسين', status: 'مساند', rights: 'ليس بديلًا عن YouTube Studio ولا يضمن المشاهدات' },
  { category: 'استعادة', name: 'Platform AI Fallback', role: 'مسار نص وصور احتياطي عندما تتعطل موديلات Gemini الأساسية', status: 'مفعّل تلقائيًا', rights: 'مسار استعادة داخلي؛ لا يلغي مراجعة الحقوق أو الخصوصية' },
  { category: 'محلي', name: 'Browser SpeechSynthesis', role: 'معاينة صوت طوارئ من أصوات الجهاز عند تعذر TTS السحابي', status: 'مفعّل عند توفره', rights: 'للمعاينة والاستمرارية؛ جودة الصوت والرخصة تختلف حسب نظام الجهاز' },
] as const;
