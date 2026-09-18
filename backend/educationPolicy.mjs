const DEFAULT_ALLOWED_AGES = Object.freeze(['2-4', '4-6', '6-8', '8-12']);

const text = value => String(value ?? '').trim();
const list = value => Array.isArray(value) ? value.map(String).map(x => x.trim()).filter(Boolean) : [];

export function evaluateEducationalPlan(plan = {}) {
  const blockers = [];
  const warnings = [];

  const objective = text(plan.learningObjective);
  const ageBand = text(plan.ageBand);
  const teachingMethod = text(plan.teachingMethod);
  const recap = text(plan.recap);
  const interaction = text(plan.interaction);
  const originality = text(plan.originalityNote);
  const facts = list(plan.facts);
  const riskyClaims = list(plan.riskyClaims);
  const copiedElements = list(plan.copiedElements);

  if (objective.length < 12) blockers.push('learning-objective-required');
  if (!DEFAULT_ALLOWED_AGES.includes(ageBand)) blockers.push('age-band-required');
  if (teachingMethod.length < 8) blockers.push('teaching-method-required');
  if (recap.length < 6) warnings.push('recap-recommended');
  if (interaction.length < 6) warnings.push('interaction-recommended');
  if (originality.length < 10) blockers.push('originality-note-required');
  if (copiedElements.length) blockers.push('copied-elements-not-allowed');
  if (riskyClaims.length) blockers.push('risky-claims-require-review');
  if (!facts.length) warnings.push('fact-list-empty');

  const childValueSignals = [
    objective.length >= 12,
    teachingMethod.length >= 8,
    recap.length >= 6,
    interaction.length >= 6,
  ].filter(Boolean).length;

  return {
    passed: blockers.length === 0,
    blockers,
    warnings,
    score: Math.round((childValueSignals / 4) * 100),
    normalized: {
      learningObjective: objective,
      ageBand,
      teachingMethod,
      recap,
      interaction,
      originalityNote: originality,
      facts,
    },
  };
}

export function assertEducationalPlan(plan = {}) {
  const audit = evaluateEducationalPlan(plan);
  if (!audit.passed) {
    throw Object.assign(new Error(`educational policy blocked: ${audit.blockers.join(', ')}`), {
      code: 'educational_policy_block',
      status: 422,
      audit,
    });
  }
  return audit;
}

export function buildEducationalBrief({
  topic = '',
  ageBand = '4-6',
  learningObjective = '',
  dialect = 'ar-EG',
} = {}) {
  return {
    topic: text(topic),
    ageBand: DEFAULT_ALLOWED_AGES.includes(ageBand) ? ageBand : '4-6',
    learningObjective: text(learningObjective),
    dialect: text(dialect) || 'ar-EG',
    requirements: [
      'تعليم واضح يمكن لولي الأمر وصفه في جملة واحدة',
      'تكرار مفيد بدون حشو آلي',
      'سؤال أو تفاعل بسيط مناسب للعمر',
      'خاتمة تلخص ما تعلمه الطفل',
      'شخصيات ومشاهد أصلية وعدم تقليد عمل بعينه',
    ],
  };
}

export const EDUCATION_POLICY_VERSION = '1.0.0';
export const __test = { DEFAULT_ALLOWED_AGES };
