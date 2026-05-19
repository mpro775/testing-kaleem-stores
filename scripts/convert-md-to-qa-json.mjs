import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');

const OUTPUT_DIRS = {
  json: path.join(rootDir, 'qa-scenarios', 'json'),
  schemas: path.join(rootDir, 'qa-scenarios', 'schemas'),
  normalized: path.join(rootDir, 'qa-scenarios', 'normalized-md'),
  implementation: path.join(rootDir, 'qa-implementation'),
};

const CONVERTED_AT = '2026-05-17T00:00:00.000+03:00';

const SCENARIO_DEFINITIONS = [
  {
    match: /electronics/i,
    scenarioId: 'merchant-electronics',
    slug: 'merchant-electronics',
    codePrefix: 'MJ-ELEC',
    fallbackTitle: 'سيناريو اختبار متجر إلكترونيات',
    tags: ['merchant-journey', 'e2e', 'ux', 'manual-qa', 'electronics'],
    estimatedDurationMinutes: 180,
  },
  {
    match: /perfume|cosmetics/i,
    scenarioId: 'merchant-beauty',
    slug: 'merchant-beauty',
    codePrefix: 'MJ-BEAUTY',
    fallbackTitle: 'سيناريو اختبار متجر عطور ومستحضرات تجميل',
    tags: ['merchant-journey', 'e2e', 'ux', 'manual-qa', 'beauty'],
    estimatedDurationMinutes: 180,
  },
  {
    match: /womens|women/i,
    scenarioId: 'merchant-women',
    slug: 'merchant-women',
    codePrefix: 'MJ-WOMEN',
    fallbackTitle: 'سيناريو اختبار متجر نسائي',
    tags: ['merchant-journey', 'e2e', 'ux', 'manual-qa', 'women'],
    estimatedDurationMinutes: 180,
  },
  {
    match: /sports|(?:^|_)mens(?:_|$)/i,
    scenarioId: 'merchant-sports',
    slug: 'merchant-sports',
    codePrefix: 'MJ-SPORTS',
    fallbackTitle: 'سيناريو اختبار متجر رياضي رجالي',
    tags: ['merchant-journey', 'e2e', 'ux', 'manual-qa', 'sports'],
    estimatedDurationMinutes: 210,
  },
];

function pad(number) {
  return String(number).padStart(3, '0');
}

function cleanText(text) {
  return text
    .replace(/\r/g, '')
    .replace(/\s+$/gm, '')
    .trim();
}

function stripMarkdownPrefix(line) {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+[.)-]\s+/, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, '')
    .trim();
}

function isHeading(line) {
  return /^#{1,6}\s+/.test(line);
}

function headingText(line) {
  return stripMarkdownPrefix(line);
}

function isPhaseHeading(line) {
  return /^#{1,6}\s+المرحلة\s+/u.test(line.trim());
}

function isCheckbox(line) {
  return /^\s*[-*+]\s+\[[ xX]\]\s+/.test(line);
}

function isListOrNumbered(line) {
  return /^\s*([-*+]|\d+[.)-])\s+/.test(line);
}

function sectionKind(title) {
  const normalized = title.replace(/\d+/g, '').trim();
  if (/تحقق|قائمة التحقق|معايير نجاح|اختبار/.test(normalized)) return 'checks';
  if (/أسئلة|ملاحظات المختبر|تقييم/.test(normalized)) return 'questions';
  if (/خطوات|الخطوات|رحلة التنفيذ|المطلوب|الصفحات المطلوب/.test(normalized)) return 'instructions';
  if (/بيانات|منتجات|روابط|حسابات|اختبارية|تجريبية/.test(normalized)) return 'testData';
  if (/هدف|الهدف/.test(normalized)) return 'objective';
  return 'notes';
}

function classifyQuestionType(text) {
  return /تقييم|قيّم|قيم|درجة|مقياس|من\s+1\s+إلى\s+5|1\s*-\s*5|نجوم/.test(text) ? 'rating' : 'textarea';
}

function extractPhaseOrdinal(title) {
  const match = title.match(/المرحلة\s+([^:：-]+)/u);
  return match ? match[1].trim() : null;
}

function scenarioForFile(fileName) {
  return SCENARIO_DEFINITIONS.find((definition) => definition.match.test(fileName));
}

async function discoverScenarioFiles() {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
    .filter((fileName) => scenarioForFile(fileName))
    .sort((a, b) => {
      const left = scenarioForFile(a).scenarioId;
      const right = scenarioForFile(b).scenarioId;
      return left.localeCompare(right);
    });
}

function splitIntoPhaseBlocks(lines) {
  const blocks = [];
  let preface = [];
  let current = null;

  for (const line of lines) {
    if (isPhaseHeading(line)) {
      if (current) blocks.push(current);
      current = { heading: line, lines: [] };
      continue;
    }
    if (current) {
      current.lines.push(line);
    } else {
      preface.push(line);
    }
  }

  if (current) blocks.push(current);
  return { preface, blocks };
}

function buildDescription(preface, fallbackTitle) {
  const titleless = [];
  for (const line of preface) {
    if (!line.trim()) continue;
    if (/^#\s+/.test(line)) continue;
    titleless.push(line);
  }

  const compact = cleanText(titleless.join('\n'));
  if (!compact) {
    return `سيناريو اختبار يدوي لرحلة تاجر ${fallbackTitle.replace(/^سيناريو اختبار\s*/, '')}.`;
  }
  return compact.slice(0, 4000);
}

function collectGlobalPrefaceData(preface, codePrefix) {
  const preconditions = [];
  const testData = [];
  let activeSection = 'notes';

  for (const line of preface) {
    if (isHeading(line)) {
      activeSection = sectionKind(headingText(line));
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isCheckbox(trimmed)) {
      preconditions.push({
        checkId: `${codePrefix}-PRE-CHK-${pad(preconditions.length + 1)}`,
        order: preconditions.length + 1,
        text: stripMarkdownPrefix(trimmed),
        type: 'status',
        required: true,
        weight: 1,
        expectedResult: null,
        allowAttachment: true,
        allowIssue: true,
      });
      continue;
    }
    if (activeSection === 'testData' && !/^#/.test(trimmed)) {
      testData.push(stripMarkdownPrefix(trimmed));
    }
  }

  return { preconditions, testData };
}

function parsePhase(block, index, definition) {
  const phaseNumber = pad(index);
  const phaseId = `${definition.codePrefix}-PH-${phaseNumber}`;
  const sourceTitle = headingText(block.heading);
  const phase = {
    phaseId,
    order: index,
    title: sourceTitle.replace(/^المرحلة\s+[^:：-]+[:：-]?\s*/u, '').trim() || sourceTitle,
    sourceTitle,
    objective: null,
    instructions: [],
    checks: [],
    questions: [],
    testData: [],
    notes: [],
  };

  let activeSection = 'notes';
  let objectiveLines = [];
  const unclassified = [];

  for (const rawLine of block.lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isHeading(line)) {
      activeSection = sectionKind(headingText(line));
      continue;
    }

    if (isCheckbox(line)) {
      phase.checks.push({
        checkId: `${phaseId}-CHK-${pad(phase.checks.length + 1)}`,
        order: phase.checks.length + 1,
        text: stripMarkdownPrefix(line),
        type: 'status',
        required: true,
        weight: 1,
        expectedResult: null,
        allowAttachment: true,
        allowIssue: true,
      });
      continue;
    }

    const text = stripMarkdownPrefix(line);
    if (!text || /^[-|:]+$/.test(text)) continue;

    if (activeSection === 'objective') {
      objectiveLines.push(text);
      continue;
    }

    if (activeSection === 'instructions') {
      if (isListOrNumbered(line) || !isHeading(line)) {
        phase.instructions.push({
          instructionId: `${phaseId}-INST-${pad(phase.instructions.length + 1)}`,
          order: phase.instructions.length + 1,
          text,
        });
      }
      continue;
    }

    if (activeSection === 'questions' || /[؟?]\s*$/.test(text)) {
      phase.questions.push({
        questionId: `${phaseId}-Q-${pad(phase.questions.length + 1)}`,
        order: phase.questions.length + 1,
        text,
        type: classifyQuestionType(text),
        required: false,
      });
      continue;
    }

    if (activeSection === 'testData') {
      phase.testData.push(text);
      continue;
    }

    if (activeSection === 'checks') {
      phase.notes.push(text);
      continue;
    }

    unclassified.push(text);
  }

  phase.objective = objectiveLines.length > 0 ? objectiveLines.join('\n') : null;
  if (unclassified.length > 0) {
    phase.notes.push(...unclassified.slice(0, 100));
  }

  return phase;
}

function detectNumberingIssues(blocks) {
  const seen = new Set();
  const issues = [];
  blocks.forEach((block, index) => {
    const title = headingText(block.heading);
    const ordinal = extractPhaseOrdinal(title);
    if (!ordinal) return;
    if (seen.has(ordinal)) {
      issues.push(`تكرار ترقيم/اسم المرحلة "${ordinal}" عند الموضع ${index + 1}.`);
    }
    seen.add(ordinal);
  });
  return issues;
}

function buildScenario(fileName, source) {
  const definition = scenarioForFile(fileName);
  const lines = source.split(/\r?\n/);
  const firstTitle = lines.find((line) => /^#\s+/.test(line));
  const { preface, blocks } = splitIntoPhaseBlocks(lines);
  const globalData = collectGlobalPrefaceData(preface, definition.codePrefix);
  const phases = blocks.map((block, index) => parsePhase(block, index + 1, definition));
  const checksum = createHash('sha256').update(source, 'utf8').digest('hex');
  const numberingIssues = detectNumberingIssues(blocks);
  const emptyPhases = phases
    .filter((phase) => phase.instructions.length === 0 && phase.checks.length === 0 && phase.questions.length === 0)
    .map((phase) => phase.phaseId);

  const scenario = {
    scenarioId: definition.scenarioId,
    version: '1.0.0',
    slug: definition.slug,
    codePrefix: definition.codePrefix,
    title: firstTitle ? headingText(firstTitle) : definition.fallbackTitle,
    description: buildDescription(preface, definition.fallbackTitle),
    language: 'ar',
    direction: 'rtl',
    status: 'draft',
    estimatedDurationMinutes: definition.estimatedDurationMinutes,
    sourceFile: fileName,
    tags: definition.tags,
    preconditions: globalData.preconditions,
    testData: globalData.testData,
    phases,
    scoring: {
      passWeight: 1,
      failWeight: 0,
      blockedWeight: 0,
      notApplicableExcluded: true,
      readinessBands: [
        { min: 85, max: 100, label: 'ready' },
        { min: 70, max: 84, label: 'ready_with_fixes' },
        { min: 50, max: 69, label: 'needs_improvement' },
        { min: 0, max: 49, label: 'not_ready' },
      ],
    },
    metadata: {
      createdFromMarkdown: true,
      convertedAt: CONVERTED_AT,
      checksum: `sha256:${checksum}`,
      conversionWarnings: [
        ...numberingIssues,
        ...emptyPhases.map((phaseId) => `${phaseId} لا يحتوي عناصر مصنفة كتعليمات أو checks أو أسئلة.`),
      ],
    },
  };

  return {
    scenario,
    stats: {
      sourceFile: fileName,
      scenarioId: scenario.scenarioId,
      phases: phases.length,
      instructions: phases.reduce((total, phase) => total + phase.instructions.length, 0),
      checks: phases.reduce((total, phase) => total + phase.checks.length, 0),
      questions: phases.reduce((total, phase) => total + phase.questions.length, 0),
      preconditions: globalData.preconditions.length,
      hasNumberingIssues: numberingIssues.length > 0,
      hasUnclassifiedSections: phases.some((phase) => phase.notes.length > 0),
      hasQuestionsNeedingReview: phases.some((phase) => phase.questions.some((question) => question.type === 'rating')),
      hasTestData: globalData.testData.length > 0 || phases.some((phase) => phase.testData.length > 0),
      warnings: scenario.metadata.conversionWarnings,
    },
  };
}

function buildSchema() {
  const idPattern = '^[A-Z]+-[A-Z]+(-[A-Z]+)?-(PRE-CHK|PH)-[0-9]{3}';
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://kaleem.local/schemas/qa-scenario.schema.json',
    title: 'Kaleem Merchant QA Scenario',
    type: 'object',
    additionalProperties: true,
    required: [
      'scenarioId',
      'version',
      'slug',
      'codePrefix',
      'title',
      'description',
      'language',
      'direction',
      'status',
      'sourceFile',
      'phases',
      'scoring',
      'metadata',
    ],
    properties: {
      scenarioId: { type: 'string', pattern: '^merchant-[a-z0-9-]+$' },
      version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
      slug: { type: 'string' },
      codePrefix: { type: 'string', pattern: '^MJ-[A-Z]+$' },
      title: { type: 'string', minLength: 1 },
      description: { type: 'string' },
      language: { const: 'ar' },
      direction: { const: 'rtl' },
      status: { enum: ['draft', 'published', 'archived'] },
      estimatedDurationMinutes: { type: 'integer', minimum: 1 },
      sourceFile: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      preconditions: {
        type: 'array',
        items: { $ref: '#/$defs/check' },
      },
      testData: { type: 'array', items: { type: 'string' } },
      phases: {
        type: 'array',
        minItems: 1,
        items: { $ref: '#/$defs/phase' },
      },
      scoring: {
        type: 'object',
        required: ['passWeight', 'failWeight', 'blockedWeight', 'notApplicableExcluded', 'readinessBands'],
        properties: {
          passWeight: { type: 'number' },
          failWeight: { type: 'number' },
          blockedWeight: { type: 'number' },
          notApplicableExcluded: { type: 'boolean' },
          readinessBands: {
            type: 'array',
            items: {
              type: 'object',
              required: ['min', 'max', 'label'],
              properties: {
                min: { type: 'number' },
                max: { type: 'number' },
                label: { enum: ['ready', 'ready_with_fixes', 'needs_improvement', 'not_ready'] },
              },
            },
          },
        },
      },
      metadata: {
        type: 'object',
        required: ['createdFromMarkdown', 'convertedAt', 'checksum'],
        properties: {
          createdFromMarkdown: { type: 'boolean' },
          convertedAt: { type: 'string' },
          checksum: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
          conversionWarnings: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    $defs: {
      phase: {
        type: 'object',
        additionalProperties: false,
        required: ['phaseId', 'order', 'title', 'sourceTitle', 'instructions', 'checks', 'questions', 'testData', 'notes'],
        properties: {
          phaseId: { type: 'string', pattern: idPattern },
          order: { type: 'integer', minimum: 1 },
          title: { type: 'string', minLength: 1 },
          sourceTitle: { type: 'string', minLength: 1 },
          objective: { type: ['string', 'null'] },
          instructions: { type: 'array', items: { $ref: '#/$defs/instruction' } },
          checks: { type: 'array', items: { $ref: '#/$defs/check' } },
          questions: { type: 'array', items: { $ref: '#/$defs/question' } },
          testData: { type: 'array', items: { type: 'string' } },
          notes: { type: 'array', items: { type: 'string' } },
        },
      },
      instruction: {
        type: 'object',
        additionalProperties: false,
        required: ['instructionId', 'order', 'text'],
        properties: {
          instructionId: { type: 'string' },
          order: { type: 'integer', minimum: 1 },
          text: { type: 'string', minLength: 1 },
        },
      },
      check: {
        type: 'object',
        additionalProperties: false,
        required: ['checkId', 'order', 'text', 'type', 'required', 'weight', 'expectedResult', 'allowAttachment', 'allowIssue'],
        properties: {
          checkId: { type: 'string' },
          order: { type: 'integer', minimum: 1 },
          text: { type: 'string', minLength: 1 },
          type: { enum: ['status'] },
          required: { type: 'boolean' },
          weight: { type: 'number' },
          expectedResult: { type: ['string', 'null'] },
          allowAttachment: { type: 'boolean' },
          allowIssue: { type: 'boolean' },
        },
      },
      question: {
        type: 'object',
        additionalProperties: false,
        required: ['questionId', 'order', 'text', 'type', 'required'],
        properties: {
          questionId: { type: 'string' },
          order: { type: 'integer', minimum: 1 },
          text: { type: 'string', minLength: 1 },
          type: { enum: ['textarea', 'rating'] },
          required: { type: 'boolean' },
        },
      },
    },
  };
}

function buildNormalizedMarkdown(scenario) {
  const lines = [
    `# ${scenario.title}`,
    '',
    `- scenarioId: \`${scenario.scenarioId}\``,
    `- version: \`${scenario.version}\``,
    `- sourceFile: \`${scenario.sourceFile}\``,
    `- status: \`${scenario.status}\``,
    '',
    '## الوصف',
    scenario.description,
    '',
  ];

  if (scenario.preconditions.length > 0) {
    lines.push('## متطلبات قبل البدء', '');
    for (const check of scenario.preconditions) {
      lines.push(`- [ ] (${check.checkId}) ${check.text}`);
    }
    lines.push('');
  }

  for (const phase of scenario.phases) {
    lines.push(`# ${phase.sourceTitle}`, '');
    lines.push(`- phaseId: \`${phase.phaseId}\``);
    lines.push(`- order: \`${phase.order}\``);
    if (phase.objective) {
      lines.push('', '## الهدف', phase.objective);
    }
    if (phase.instructions.length > 0) {
      lines.push('', '## خطوات التنفيذ');
      for (const item of phase.instructions) {
        lines.push(`${item.order}. (${item.instructionId}) ${item.text}`);
      }
    }
    if (phase.checks.length > 0) {
      lines.push('', '## تحقق المرحلة');
      for (const check of phase.checks) {
        lines.push(`- [ ] (${check.checkId}) ${check.text}`);
      }
    }
    if (phase.questions.length > 0) {
      lines.push('', '## أسئلة المرحلة');
      for (const question of phase.questions) {
        lines.push(`- (${question.questionId}, ${question.type}) ${question.text}`);
      }
    }
    if (phase.testData.length > 0) {
      lines.push('', '## بيانات اختبار');
      for (const item of phase.testData) {
        lines.push(`- ${item}`);
      }
    }
    if (phase.notes.length > 0) {
      lines.push('', '## ملاحظات للتحويل');
      for (const note of phase.notes.slice(0, 20)) {
        lines.push(`- ${note}`);
      }
      if (phase.notes.length > 20) {
        lines.push(`- ... ${phase.notes.length - 20} ملاحظات إضافية محفوظة في JSON.`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildConversionReport(results) {
  const rows = results.map(({ stats }) => {
    const needsReview = stats.warnings.length > 0 || stats.hasUnclassifiedSections ? 'نعم' : 'لا';
    return `| ${stats.scenarioId} | ${stats.phases} | ${stats.instructions} | ${stats.checks} | ${stats.questions} | ${needsReview} |`;
  });

  const details = results.flatMap(({ stats }) => [
    `## ${stats.scenarioId}`,
    '',
    `- الملف الأصلي: \`${stats.sourceFile}\``,
    `- عدد المراحل: ${stats.phases}`,
    `- عدد خطوات التنفيذ: ${stats.instructions}`,
    `- عدد عناصر التحقق داخل المراحل: ${stats.checks}`,
    `- عدد أسئلة UX/الملاحظات: ${stats.questions}`,
    `- متطلبات قبل البدء المحفوظة كـ preconditions: ${stats.preconditions}`,
    `- مشاكل ترقيم: ${stats.hasNumberingIssues ? 'نعم' : 'لا'}`,
    `- أقسام غير مصنفة بالكامل: ${stats.hasUnclassifiedSections ? 'نعم، محفوظة داخل notes' : 'لا'}`,
    `- أسئلة تحتاج مراجعة: ${stats.hasQuestionsNeedingReview ? 'نعم، توجد أسئلة rating' : 'لا'}`,
    `- بيانات اختبار مستخرجة: ${stats.hasTestData ? 'نعم' : 'لا'}`,
    '',
    ...(stats.warnings.length > 0
      ? ['### Needs Manual Review', '', ...stats.warnings.map((warning) => `- ${warning}`), '']
      : []),
  ]);

  return [
    '# Phase 1 Conversion Report',
    '',
    `تم توليد هذا التقرير بواسطة \`scripts/convert-md-to-qa-json.mjs\` في ${CONVERTED_AT}.`,
    '',
    '## الملخص العام',
    '',
    '| Scenario | Phases | Instructions | Checks | Questions | Needs Review |',
    '|---|---:|---:|---:|---:|---|',
    ...rows,
    '',
    '## تفاصيل السيناريوهات',
    '',
    ...details,
    '## قرارات التحويل',
    '',
    '- لم يتم اعتبار checkbox مكتمل `[x]` كإجابة فعلية، بل كعنصر تحقق فقط.',
    '- تم حفظ checkboxes الموجودة قبل أول مرحلة في `preconditions` حتى لا تضيع متطلبات بدء الاختبار.',
    '- تم تصحيح ترتيب المراحل حسب الظهور الفعلي في الملف، مع حفظ العنوان الأصلي في `sourceTitle`.',
    '- أي نص لا يمكن تصنيفه بثقة داخل مرحلة تم حفظه في `notes` بدلاً من تحويله إلى check جديد.',
    '- `convertedAt` ثابت عمداً حتى تكون المخرجات deterministic عند إعادة تشغيل السكربت.',
    '',
  ].join('\n');
}

function buildScenariosReadme(results) {
  return [
    '# QA Scenarios',
    '',
    'هذا المجلد يحتوي السيناريوهات اليدوية المطبعة لرحلة التاجر في Kaleem Stores. ملفات JSON هي المصدر الذي يمكن استخدامه لاحقاً في seed/import لنظام QA Runner.',
    '',
    '## التشغيل',
    '',
    '```bash',
    'node scripts/convert-md-to-qa-json.mjs',
    '```',
    '',
    'ينتج السكربت:',
    '',
    '- `qa-scenarios/json/*.json` للسيناريوهات المنظمة.',
    '- `qa-scenarios/normalized-md/*.normalized.md` لنسخة Markdown موحدة قابلة للمراجعة.',
    '- `qa-scenarios/schemas/qa-scenario.schema.json` لتعريف بنية JSON.',
    '- `qa-implementation/PHASE_1_CONVERSION_REPORT.md` لتقرير التحويل.',
    '',
    '## السيناريوهات',
    '',
    ...results.map(({ scenario, stats }) => `- \`${scenario.scenarioId}\`: ${stats.phases} مراحل، ${stats.checks} checks، ${stats.questions} أسئلة.`),
    '',
    '## قواعد IDs',
    '',
    '- السيناريو يستخدم `scenarioId` ثابتاً مثل `merchant-electronics`.',
    '- كل مرحلة تستخدم الصيغة `{codePrefix}-PH-001`.',
    '- كل خطوة تستخدم `{codePrefix}-PH-001-INST-001`.',
    '- كل check يستخدم `{codePrefix}-PH-001-CHK-001`.',
    '- كل سؤال يستخدم `{codePrefix}-PH-001-Q-001`.',
    '- لا تستخدم UUID عشوائي لهذه العناصر لأن نتائج الاختبارات المستقبلية سترتبط بها.',
    '',
    '## التعديل والنسخ',
    '',
    '- تعديل النصوص البسيطة يرفع patch version.',
    '- إضافة مرحلة أو check جوهري ترفع minor version.',
    '- تغيير جذري في رحلة الاختبار يرفع major version.',
    '- لا تحذف IDs قديمة عشوائياً؛ أرشف العنصر أو أضف بديلًا جديدًا حتى تبقى نتائج runs السابقة قابلة للقراءة.',
    '',
  ].join('\n');
}

function buildDataModelDoc(results) {
  const totalChecks = results.reduce((sum, item) => sum + item.stats.checks + item.stats.preconditions, 0);
  return [
    '# Phase 1 Data Model',
    '',
    'هذا التصميم مبدئي للمرحلة الثانية ولا ينشئ migration فعلية الآن. قاعدة البيانات هي مصدر الحقيقة الوحيد للتقدم والإجابات والمرفقات.',
    '',
    '## ملاحظات من فحص kaleem-api',
    '',
    '- المشروع NestJS مقسم إلى modules مع service/repository/controller لكل نطاق.',
    '- الوصول إلى PostgreSQL يتم عبر `DatabaseService` و `pg.Pool`، وليس ORM.',
    '- migrations موجودة في مجلد `migrations` وتعمل عبر سكربتات `scripts/migrate.mjs`.',
    '- المصادقة تنقسم بين تاجر (`auth`) ومنصة (`platform`)؛ QA Runner يجب أن يكون ضمن منصة الإدارة وليس لوحة التاجر.',
    '- صلاحيات المنصة مبنية على `PlatformPermissionsGuard` و decorator للصلاحيات.',
    '- يوجد `MediaModule` و `S3StorageAdapter` يدعمان presigned URLs و S3/R2/MinIO.',
    '- DTO validation يستخدم `class-validator`، و Swagger متاح عبر `@nestjs/swagger` في الاعتماديات.',
    '',
    '## الجداول المقترحة',
    '',
    '### qa_scenarios',
    '',
    '| Column | Type | Notes |',
    '|---|---|---|',
    '| id | uuid pk | معرف داخلي. |',
    '| scenario_id | text unique | مثل `merchant-electronics`. |',
    '| slug | text unique | مسار readable. |',
    '| code_prefix | text | مثل `MJ-ELEC`. |',
    '| title | text | عربي RTL. |',
    '| description | text | وصف السيناريو. |',
    '| version | text | SemVer. |',
    '| status | text | draft/published/archived. |',
    '| source_file | text | ملف Markdown الأصلي. |',
    '| tags | jsonb | وسوم البحث. |',
    '| metadata | jsonb | checksum والتحذيرات. |',
    '| published_at | timestamptz null | عند النشر. |',
    '| created_at / updated_at | timestamptz | تتبع زمني. |',
    '',
    '### qa_phases',
    '',
    '| Column | Type | Notes |',
    '|---|---|---|',
    '| id | uuid pk | معرف داخلي. |',
    '| scenario_id | uuid fk | إلى `qa_scenarios.id`. |',
    '| phase_key | text unique per scenario | مثل `MJ-ELEC-PH-001`. |',
    '| phase_order | integer | ترتيب الظهور. |',
    '| title | text | عنوان مختصر. |',
    '| source_title | text | العنوان الأصلي. |',
    '| objective | text null | الهدف إن وجد. |',
    '| notes | jsonb | نصوص غير مصنفة. |',
    '',
    '### qa_phase_items',
    '',
    'يحفظ التعليمات وchecks والأسئلة كبنية واحدة قابلة للترتيب.',
    '',
    '| Column | Type | Notes |',
    '|---|---|---|',
    '| id | uuid pk | معرف داخلي. |',
    '| phase_id | uuid fk | إلى `qa_phases.id`. |',
    '| item_key | text unique | instructionId/checkId/questionId. |',
    '| item_type | text | instruction/check/question. |',
    '| item_order | integer | ترتيب داخل النوع أو المرحلة. |',
    '| text | text | النص العربي كما هو. |',
    '| question_type | text null | textarea/rating. |',
    '| required | boolean | للأسئلة/checks. |',
    '| weight | numeric | للـ checks. |',
    '| allow_attachment | boolean | للـ checks. |',
    '| allow_issue | boolean | للـ checks. |',
    '| expected_result | text null | نتيجة متوقعة اختيارية. |',
    '| metadata | jsonb | أي خصائص إضافية. |',
    '',
    '### qa_runs',
    '',
    '| Column | Type | Notes |',
    '|---|---|---|',
    '| id | uuid pk | Test Run مستقل. |',
    '| scenario_id | uuid fk | السيناريو المنشور. |',
    '| scenario_version | text | نسخة السيناريو وقت التشغيل. |',
    '| tester_user_id | uuid/text | مستخدم منصة الإدارة. |',
    '| status | text | draft/in_progress/paused/submitted/reviewed/reopened/cancelled. |',
    '| current_phase_key | text null | للاستكمال السريع. |',
    '| started_at | timestamptz | بداية التشغيل. |',
    '| last_activity_at | timestamptz | autosave/resume. |',
    '| submitted_at | timestamptz null | عند التسليم. |',
    '| reviewed_by | uuid/text null | qa_lead/admin. |',
    '| reviewed_at | timestamptz null | وقت المراجعة. |',
    '| readiness_score | numeric null | score النهائي. |',
    '| readiness_label | text null | ready/ready_with_fixes/needs_improvement/not_ready/blocked_or_not_ready. |',
    '| summary | jsonb | إجماليات checks/issues. |',
    '',
    '### qa_answers',
    '',
    '| Column | Type | Notes |',
    '|---|---|---|',
    '| id | uuid pk | إجابة عنصر واحد. |',
    '| run_id | uuid fk | إلى `qa_runs`. |',
    '| item_key | text | checkId أو questionId أو instructionId عند الحاجة. |',
    '| answer_type | text | check_status/text/rating/note. |',
    '| status | text null | pass/fail/blocked/not_applicable. |',
    '| text_answer | text null | إجابات textarea/notes. |',
    '| rating_value | integer null | 1-5 عند rating. |',
    '| is_autosaved | boolean | آخر حفظ تلقائي. |',
    '| answered_at | timestamptz | آخر تعديل. |',
    '',
    '### qa_issues',
    '',
    '| Column | Type | Notes |',
    '|---|---|---|',
    '| id | uuid pk | مشكلة مرتبطة بتشغيل. |',
    '| run_id | uuid fk | إلى run. |',
    '| item_key | text null | check/question مرتبط. |',
    '| severity | text | low/medium/high/critical. |',
    '| status | text | open/triaged/fixed/wont_fix/verified. |',
    '| is_blocking | boolean | يؤثر على القرار النهائي. |',
    '| title | text | عنوان قصير. |',
    '| description | text | تفاصيل المشكلة. |',
    '',
    '### qa_attachments',
    '',
    '| Column | Type | Notes |',
    '|---|---|---|',
    '| id | uuid pk | مرفق QA. |',
    '| run_id | uuid fk | إلى run. |',
    '| answer_id | uuid null | ربط بإجابة. |',
    '| issue_id | uuid null | ربط بمشكلة. |',
    '| bucket_name | text | bucket. |',
    '| object_key | text unique | private object key. |',
    '| mime_type | text | نوع الملف. |',
    '| file_size_bytes | bigint | الحجم. |',
    '| etag | text null | للتحقق. |',
    '| uploaded_by | uuid/text | المختبر أو المراجع. |',
    '| metadata | jsonb | اسم الملف/لقطة شاشة/متصفح. |',
    '',
    '### qa_run_events',
    '',
    'سجل append-only لأحداث التشغيل: started, autosaved, paused, resumed, submitted, reviewed, reopened, attachment_uploaded, issue_created.',
    '',
    '## الأدوار',
    '',
    '- `qa_tester`: تشغيل Run جديد، استكمال runs الخاصة به، إدخال الإجابات، رفع المرفقات، تسجيل المشاكل، رؤية ملخص اختباراته.',
    '- `qa_lead`: رؤية كل runs، مراجعة المشاكل، إعادة فتح run مكتمل، تغيير حالة issue، رؤية dashboard.',
    '- `admin`: إدارة السيناريوهات، import/publish، أرشفة runs عند الحاجة، رؤية كل dashboard.',
    '',
    '## Scoring',
    '',
    '```txt',
    'applicable_checks = total_checks - not_applicable_checks',
    'readiness_score = passed_checks / applicable_checks * 100',
    '```',
    '',
    '- `pass` يحسب كنقطة نجاح.',
    '- `fail` لا يضيف نقطة.',
    '- `blocked` لا يضيف نقطة ويؤثر على القرار.',
    '- `not_applicable` يستبعد من المقام.',
    '- إذا وجد issue من نوع `critical` أو `is_blocking=true` يصبح القرار `blocked_or_not_ready` حتى لو كان score مرتفعاً.',
    '',
    `إجمالي عناصر التحقق المحولة مبدئياً مع preconditions: ${totalChecks}.`,
    '',
  ].join('\n');
}

function buildApiContractDoc() {
  return [
    '# Phase 1 API Contract',
    '',
    'هذا العقد مبدئي للمرحلة الثانية داخل `kaleem-api`. لا توجد endpoints منفذة في هذه المرحلة.',
    '',
    '## ملاحظات من فحص backend',
    '',
    '- النمط الحالي يعتمد Controller + Service + Repository.',
    '- منصة الإدارة تستخدم `/platform/...` و guards خاصة بالمنصة.',
    '- يفضل أن يكون QA Runner تحت prefix `/platform/qa` لأنه أداة داخلية لإدارة الجودة وليس جزءاً من لوحة التاجر.',
    '- الاستجابات الحالية JSON مباشرة، والأخطاء تمر عبر filters في `common/filters`.',
    '',
    '## الصلاحيات المقترحة',
    '',
    '| Permission | الدور |',
    '|---|---|',
    '| `platform.qa.scenarios.read` | qa_tester/qa_lead/admin |',
    '| `platform.qa.scenarios.write` | admin |',
    '| `platform.qa.runs.read_own` | qa_tester |',
    '| `platform.qa.runs.read_all` | qa_lead/admin |',
    '| `platform.qa.runs.write_own` | qa_tester |',
    '| `platform.qa.runs.review` | qa_lead/admin |',
    '| `platform.qa.issues.manage` | qa_lead/admin |',
    '',
    '## Endpoints',
    '',
    '| Method | Path | Purpose |',
    '|---|---|---|',
    '| GET | `/platform/qa/scenarios` | قائمة السيناريوهات مع filters. |',
    '| GET | `/platform/qa/scenarios/:scenarioId` | تفاصيل سيناريو منشور أو draft حسب الصلاحية. |',
    '| POST | `/platform/qa/scenarios/import` | استيراد JSON من ملفات seed أو upload لاحقاً. |',
    '| POST | `/platform/qa/scenarios/:scenarioId/publish` | نشر نسخة. |',
    '| POST | `/platform/qa/runs` | إنشاء Run جديد أو طلب استكمال الموجود. |',
    '| GET | `/platform/qa/runs` | قائمة runs؛ own أو all حسب الصلاحية. |',
    '| GET | `/platform/qa/runs/:runId` | تفاصيل run والإجابات. |',
    '| PATCH | `/platform/qa/runs/:runId/answers` | Autosave batch للإجابات. |',
    '| POST | `/platform/qa/runs/:runId/pause` | إيقاف مؤقت. |',
    '| POST | `/platform/qa/runs/:runId/submit` | تسليم run للمراجعة. |',
    '| POST | `/platform/qa/runs/:runId/reopen` | إعادة فتح بواسطة qa_lead/admin. |',
    '| POST | `/platform/qa/runs/:runId/issues` | إنشاء issue مرتبط. |',
    '| PATCH | `/platform/qa/issues/:issueId` | تحديث حالة/severity/blocking. |',
    '| POST | `/platform/qa/runs/:runId/attachments/presign` | إنشاء presigned upload private. |',
    '| POST | `/platform/qa/runs/:runId/attachments/confirm` | تأكيد upload وحفظ metadata. |',
    '| GET | `/platform/qa/attachments/:attachmentId/download` | presigned download قصير العمر. |',
    '| GET | `/platform/qa/dashboard` | ملخص الجودة. |',
    '',
    '## Create Run',
    '',
    '```json',
    '{',
    '  "scenarioId": "merchant-electronics",',
    '  "mode": "new"',
    '}',
    '```',
    '',
    'إذا وجد run غير مكتمل لنفس المختبر والسيناريو، يعيد API خيارين للواجهة:',
    '',
    '```json',
    '{',
    '  "hasOpenRun": true,',
    '  "openRunId": "uuid",',
    '  "actions": ["resume_previous", "create_new"]',
    '}',
    '```',
    '',
    '## Autosave Answers',
    '',
    '```json',
    '{',
    '  "currentPhaseKey": "MJ-ELEC-PH-003",',
    '  "answers": [',
    '    { "itemKey": "MJ-ELEC-PH-003-CHK-001", "answerType": "check_status", "status": "pass" },',
    '    { "itemKey": "MJ-ELEC-PH-003-Q-001", "answerType": "text", "textAnswer": "الملاحظة" }',
    '  ]',
    '}',
    '```',
    '',
    '## Attachment Presign',
    '',
    '```json',
    '{',
    '  "fileName": "checkout-error.png",',
    '  "contentType": "image/png",',
    '  "fileSizeBytes": 482133,',
    '  "itemKey": "MJ-ELEC-PH-010-CHK-004"',
    '}',
    '```',
    '',
    'لا يجب أن تكون الملفات public افتراضياً. التحميل والتحميل المعاكس يتمان عبر URLs قصيرة العمر.',
    '',
  ].join('\n');
}

function buildFrontendMapDoc() {
  return [
    '# Phase 1 Frontend Map',
    '',
    'الخريطة مبدئية للمرحلة الثالثة. الفحص وجد أن المجلد الفعلي هو `platform-admin` وليس `platform-admin-ui`.',
    '',
    '## ملاحظات من فحص platform-admin',
    '',
    '- التطبيق React + Vite + MUI، ويدعم RTL عبر theme ومكونات MUI.',
    '- routing مركزي في `src/app/router/platform-router.tsx` والمسارات في `route-paths.ts`.',
    '- sidebar يعتمد `platformNavItems` و `platformPermissionMap`.',
    '- API client الحالي يستخدم `platformApiRequest` مع access token و CSRF وتجديد session.',
    '- الجلسة والصلاحيات في `PlatformSessionProvider`، مع `hasPermission` محلياً.',
    '- توجد مكونات common مثل loading/error/empty/json viewer يمكن إعادة استخدامها.',
    '',
    '## المسارات المقترحة',
    '',
    '| Route | Purpose | Roles |',
    '|---|---|---|',
    '| `/platform/qa` | Dashboard QA مختصر وقائمة runs الجارية. | qa_tester/qa_lead/admin |',
    '| `/platform/qa/scenarios` | قائمة السيناريوهات وحالتها. | qa_tester/qa_lead/admin |',
    '| `/platform/qa/scenarios/:scenarioId` | معاينة السيناريو قبل التشغيل. | qa_tester/qa_lead/admin |',
    '| `/platform/qa/runs` | قائمة runs. | qa_tester يرى الخاصة به، qa_lead/admin يرون الكل. |',
    '| `/platform/qa/runs/:runId` | شاشة التنفيذ أو المراجعة. | qa_tester/qa_lead/admin |',
    '| `/platform/qa/issues` | قائمة المشاكل المستخرجة من runs. | qa_lead/admin |',
    '| `/platform/qa/dashboard` | مؤشرات الجاهزية والجودة. | qa_lead/admin |',
    '',
    '## ما يراه كل دور',
    '',
    '- `qa_tester`: زر تشغيل سيناريو، تنبيه run غير مكتمل، شاشة تنفيذ phased، رفع مرفقات، إنشاء issue، ملخص runs الخاصة به.',
    '- `qa_lead`: كل runs، filters حسب السيناريو/المختبر/الحالة، مراجعة issues، إعادة فتح run، dashboard.',
    '- `admin`: إدارة import/publish للسيناريوهات، رؤية كل شيء، إعدادات الأرشفة والنسخ.',
    '',
    '## شاشة Run',
    '',
    '- شريط مراحل ثابت يوضح التقدم والحالة.',
    '- قسم تعليمات read-only لكل مرحلة.',
    '- قائمة checks بحالات pass/fail/blocked/not_applicable.',
    '- أسئلة textarea/rating حسب JSON.',
    '- مرفقات مرتبطة بالـ check أو issue.',
    '- حفظ تلقائي مع مؤشر last saved.',
    '- زر Pause/Resume ثم Submit عند اكتمال الحد الأدنى.',
    '',
    '## تنبيه الاستكمال',
    '',
    'عند فتح سيناريو ولدى المستخدم run غير مكتمل، تعرض الواجهة حواراً بخيارين واضحين: `استكمال الاختبار السابق` أو `إنشاء اختبار جديد`. لا يعتمد القرار على localStorage؛ يتم جلبه من `/platform/qa/runs?scenarioId=...&status=open&mine=true`.',
    '',
    '## إضافة الملاحة لاحقاً',
    '',
    '- إضافة `qa` إلى `platformPaths`.',
    '- إضافة permissions إلى `permission-map.ts`.',
    '- إضافة عنصر sidebar بأيقونة مناسبة من MUI.',
    '- إنشاء `features/platform/api/qa.api.ts` و `features/platform/pages/qa/*`.',
    '',
  ].join('\n');
}

function buildS3DesignDoc() {
  return [
    '# Phase 1 S3 Attachments Design',
    '',
    'التصميم يستفيد من `MediaModule` و `S3StorageAdapter` الموجودين في `kaleem-api`، لكنه يفصل مرفقات QA عن وسائط المتجر.',
    '',
    '## مبادئ',
    '',
    '- الملفات private افتراضياً.',
    '- لا يتم حفظ URL دائم public في `qa_attachments`.',
    '- access يتم عبر presigned GET قصير العمر.',
    '- object key يجب أن يحتوي runId ولا يعتمد على اسم الملف وحده.',
    '- يتم تأكيد upload عبر headObject ومطابقة content type والحجم وetag إن توفر.',
    '',
    '## Object Key',
    '',
    '```txt',
    'qa-runs/{runId}/{itemKey|general}/{timestamp}-{safeFileName}',
    'qa-issues/{issueId}/{timestamp}-{safeFileName}',
    '```',
    '',
    '## Presign Flow',
    '',
    '1. الواجهة تطلب `POST /platform/qa/runs/:runId/attachments/presign` مع الحجم والنوع.',
    '2. API يتحقق من صلاحية المستخدم على run.',
    '3. API يولد object key ويعيد presigned PUT.',
    '4. الواجهة ترفع مباشرة إلى S3/R2/MinIO.',
    '5. الواجهة ترسل confirm مع objectKey وetag إن وجد.',
    '6. API ينفذ headObject ويحفظ سجل `qa_attachments`.',
    '',
    '## السياسات',
    '',
    '- الحد الأقصى المقترح: 10MB للصورة، 50MB للفيديو القصير عند الحاجة.',
    '- الأنواع المسموحة مبدئياً: png, jpeg, webp, gif, mp4, webm, pdf, txt.',
    '- منع تنفيذ أو عرض HTML مرفوع كمحتوى موثوق.',
    '- URLs للتحميل صالحة 5-10 دقائق فقط.',
    '- لا يملك `qa_tester` تنزيل مرفقات runs لا تخصه إلا إذا كان لديه صلاحية lead/admin.',
    '',
    '## علاقة MediaModule',
    '',
    'يمكن إعادة استخدام adapter الحالي، لكن يفضل Repository مستقل لـ QA حتى لا تختلط وسائط المتجر ببيانات الاختبار. إن تم استخدام جدول media_assets الحالي لاحقاً، يجب تمييز `metadata.source = qa_runner` وربط QA بجدول join مستقل.',
    '',
  ].join('\n');
}

function buildResumableRunsDoc() {
  return [
    '# Phase 1 Resumable Runs Design',
    '',
    'Resume Later يعتمد على قاعدة البيانات وليس localStorage. localStorage يمكن استخدامه فقط cache مؤقت للـ UI ولا يكون مصدر الحقيقة.',
    '',
    '## حالات run',
    '',
    '| Status | Meaning |',
    '|---|---|',
    '| draft | run أنشئ ولم يبدأ فعلياً. |',
    '| in_progress | المختبر يعمل حالياً. |',
    '| paused | المختبر اختار الاستكمال لاحقاً. |',
    '| submitted | تم التسليم للمراجعة. |',
    '| reviewed | تمت المراجعة. |',
    '| reopened | أعيد فتحه بعد المراجعة. |',
    '| cancelled | ألغي دون اعتماد. |',
    '',
    '## Autosave',
    '',
    '- يتم إرسال batch كل 5-10 ثوان بعد آخر تغيير أو عند الانتقال بين المراحل.',
    '- كل request يحتوي `currentPhaseKey` ونسخة answers المعدلة.',
    '- API يستخدم upsert على `(run_id, item_key)`.',
    '- تحديث `qa_runs.last_activity_at` مع كل autosave ناجح.',
    '- النزاعات تعالج عبر `updated_at` أو `revision` لاحقاً إذا ظهرت جلسات متعددة لنفس run.',
    '',
    '## Resume Detection',
    '',
    'عند فتح صفحة السيناريو:',
    '',
    '```txt',
    'GET /platform/qa/runs?scenarioId=merchant-electronics&mine=true&status=open',
    '```',
    '',
    'إذا وجد run بحالة draft/in_progress/paused/reopened، تعرض الواجهة خيار الاستكمال أو إنشاء run جديد. المختبر غير مقيد بمرة واحدة؛ كل run مستقل.',
    '',
    '## Submit',
    '',
    '- يمنع submit إذا لا توجد أي إجابات على checks.',
    '- يحسب score مبدئي server-side.',
    '- يقفل answers عن qa_tester بعد submit إلا إذا أعاد qa_lead فتح run.',
    '',
    '## Audit/Event Log',
    '',
    'كل انتقال حالة يسجل في `qa_run_events` مع actor، timestamp، requestId، وmetadata. هذا يساعد لاحقاً في التحقيق في فقدان حفظ أو اختلاف score.',
    '',
  ].join('\n');
}

function buildAcceptanceChecklist(results) {
  const totalScenarios = results.length;
  return [
    '# Phase 1 Acceptance Checklist',
    '',
    '## Scenario Conversion',
    '- [x] تم اكتشاف كل ملفات Markdown الخاصة بالسيناريوهات.',
    `- [x] تم توليد ${totalScenarios} ملفات JSON.`,
    '- [x] كل JSON يحتوي scenarioId و version و codePrefix.',
    '- [x] كل Phase لها phaseId و order و title.',
    '- [x] كل Check له checkId و order و text.',
    '- [x] كل Question له questionId و type.',
    '- [x] تم توليد normalized-md لكل سيناريو.',
    '- [x] تم إنشاء conversion report.',
    '',
    '## Schema',
    '- [x] تم إنشاء qa-scenario.schema.json.',
    '- [x] كل ملفات JSON صالحة JSON ومطابقة للفحص البنيوي الأدنى في السكربت.',
    '',
    '## Data Model',
    '- [x] تم تصميم جميع جداول QA المطلوبة.',
    '- [x] تم تضمين qa_runs و qa_answers و qa_attachments.',
    '- [x] تم تصميم resume/autosave.',
    '- [x] تم تصميم roles.',
    '',
    '## Backend/Frontend Planning',
    '- [x] تم فحص kaleem-api.',
    '- [x] تم فحص platform-admin الموجود فعلياً؛ `platform-admin-ui` غير موجود.',
    '- [x] تم كتابة API contract.',
    '- [x] تم كتابة frontend map.',
    '- [x] تم كتابة S3 attachments design.',
    '',
    '## Final',
    '- [x] لا توجد تغييرات إنتاجية في الكود الحالي.',
    '- [x] كل المخرجات موجودة داخل testing kaleem stores.',
    '',
  ].join('\n');
}

function validateScenario(scenario) {
  const errors = [];
  for (const key of ['scenarioId', 'version', 'slug', 'codePrefix', 'title', 'description', 'phases', 'scoring', 'metadata']) {
    if (scenario[key] === undefined || scenario[key] === null) errors.push(`missing ${key}`);
  }
  if (!Array.isArray(scenario.phases) || scenario.phases.length === 0) {
    errors.push('phases must be non-empty');
  }
  for (const phase of scenario.phases) {
    for (const key of ['phaseId', 'order', 'title', 'sourceTitle', 'instructions', 'checks', 'questions', 'testData', 'notes']) {
      if (phase[key] === undefined) errors.push(`${phase.phaseId ?? 'phase'} missing ${key}`);
    }
    for (const check of phase.checks) {
      if (!check.checkId || !check.text) errors.push(`${phase.phaseId} has invalid check`);
    }
    for (const question of phase.questions) {
      if (!question.questionId || !question.text || !['textarea', 'rating'].includes(question.type)) {
        errors.push(`${phase.phaseId} has invalid question`);
      }
    }
  }
  return errors;
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function ensureDirs() {
  await Promise.all(Object.values(OUTPUT_DIRS).map((dir) => fs.mkdir(dir, { recursive: true })));
}

async function main() {
  await ensureDirs();
  const files = await discoverScenarioFiles();
  const results = [];

  for (const fileName of files) {
    const source = await fs.readFile(path.join(rootDir, fileName), 'utf8');
    const result = buildScenario(fileName, source);
    const errors = validateScenario(result.scenario);
    if (errors.length > 0) {
      throw new Error(`Validation failed for ${fileName}:\n${errors.join('\n')}`);
    }
    results.push(result);
  }

  if (results.length !== 4) {
    throw new Error(`Expected 4 scenario files, found ${results.length}`);
  }

  for (const { scenario } of results) {
    await writeJson(path.join(OUTPUT_DIRS.json, `${scenario.scenarioId}.json`), scenario);
    await fs.writeFile(
      path.join(OUTPUT_DIRS.normalized, `${scenario.scenarioId}.normalized.md`),
      buildNormalizedMarkdown(scenario),
      'utf8',
    );
  }

  await writeJson(path.join(OUTPUT_DIRS.schemas, 'qa-scenario.schema.json'), buildSchema());
  await fs.writeFile(path.join(rootDir, 'qa-scenarios', 'README.md'), buildScenariosReadme(results), 'utf8');
  await fs.writeFile(path.join(OUTPUT_DIRS.implementation, 'PHASE_1_CONVERSION_REPORT.md'), buildConversionReport(results), 'utf8');
  await fs.writeFile(path.join(OUTPUT_DIRS.implementation, 'PHASE_1_DATA_MODEL.md'), buildDataModelDoc(results), 'utf8');
  await fs.writeFile(path.join(OUTPUT_DIRS.implementation, 'PHASE_1_API_CONTRACT.md'), buildApiContractDoc(), 'utf8');
  await fs.writeFile(path.join(OUTPUT_DIRS.implementation, 'PHASE_1_FRONTEND_MAP.md'), buildFrontendMapDoc(), 'utf8');
  await fs.writeFile(path.join(OUTPUT_DIRS.implementation, 'PHASE_1_S3_ATTACHMENTS_DESIGN.md'), buildS3DesignDoc(), 'utf8');
  await fs.writeFile(path.join(OUTPUT_DIRS.implementation, 'PHASE_1_RESUMABLE_RUNS_DESIGN.md'), buildResumableRunsDoc(), 'utf8');
  await fs.writeFile(path.join(OUTPUT_DIRS.implementation, 'PHASE_1_ACCEPTANCE_CHECKLIST.md'), buildAcceptanceChecklist(results), 'utf8');

  const summary = results.map(({ stats }) => ({
    scenarioId: stats.scenarioId,
    phases: stats.phases,
    instructions: stats.instructions,
    checks: stats.checks,
    questions: stats.questions,
    preconditions: stats.preconditions,
    warnings: stats.warnings.length,
  }));
  console.log(JSON.stringify({ converted: results.length, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
