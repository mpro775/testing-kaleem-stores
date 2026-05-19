# QA Scenarios

هذا المجلد يحتوي السيناريوهات اليدوية المطبعة لرحلة التاجر في Kaleem Stores. ملفات JSON هي المصدر الذي يمكن استخدامه لاحقاً في seed/import لنظام QA Runner.

## التشغيل

```bash
node scripts/convert-md-to-qa-json.mjs
```

ينتج السكربت:

- `qa-scenarios/json/*.json` للسيناريوهات المنظمة.
- `qa-scenarios/normalized-md/*.normalized.md` لنسخة Markdown موحدة قابلة للمراجعة.
- `qa-scenarios/schemas/qa-scenario.schema.json` لتعريف بنية JSON.
- `qa-implementation/PHASE_1_CONVERSION_REPORT.md` لتقرير التحويل.

## السيناريوهات

- `merchant-beauty`: 31 مراحل، 248 checks، 133 أسئلة.
- `merchant-electronics`: 34 مراحل، 296 checks، 135 أسئلة.
- `merchant-sports`: 33 مراحل، 277 checks، 156 أسئلة.
- `merchant-women`: 31 مراحل، 264 checks، 128 أسئلة.

## قواعد IDs

- السيناريو يستخدم `scenarioId` ثابتاً مثل `merchant-electronics`.
- كل مرحلة تستخدم الصيغة `{codePrefix}-PH-001`.
- كل خطوة تستخدم `{codePrefix}-PH-001-INST-001`.
- كل check يستخدم `{codePrefix}-PH-001-CHK-001`.
- كل سؤال يستخدم `{codePrefix}-PH-001-Q-001`.
- لا تستخدم UUID عشوائي لهذه العناصر لأن نتائج الاختبارات المستقبلية سترتبط بها.

## التعديل والنسخ

- تعديل النصوص البسيطة يرفع patch version.
- إضافة مرحلة أو check جوهري ترفع minor version.
- تغيير جذري في رحلة الاختبار يرفع major version.
- لا تحذف IDs قديمة عشوائياً؛ أرشف العنصر أو أضف بديلًا جديدًا حتى تبقى نتائج runs السابقة قابلة للقراءة.
