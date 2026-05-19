# Phase 1 API Contract

هذا العقد مبدئي للمرحلة الثانية داخل `kaleem-api`. لا توجد endpoints منفذة في هذه المرحلة.

## ملاحظات من فحص backend

- النمط الحالي يعتمد Controller + Service + Repository.
- منصة الإدارة تستخدم `/platform/...` و guards خاصة بالمنصة.
- يفضل أن يكون QA Runner تحت prefix `/platform/qa` لأنه أداة داخلية لإدارة الجودة وليس جزءاً من لوحة التاجر.
- الاستجابات الحالية JSON مباشرة، والأخطاء تمر عبر filters في `common/filters`.

## الصلاحيات المقترحة

| Permission | الدور |
|---|---|
| `platform.qa.scenarios.read` | qa_tester/qa_lead/admin |
| `platform.qa.scenarios.write` | admin |
| `platform.qa.runs.read_own` | qa_tester |
| `platform.qa.runs.read_all` | qa_lead/admin |
| `platform.qa.runs.write_own` | qa_tester |
| `platform.qa.runs.review` | qa_lead/admin |
| `platform.qa.issues.manage` | qa_lead/admin |

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/platform/qa/scenarios` | قائمة السيناريوهات مع filters. |
| GET | `/platform/qa/scenarios/:scenarioId` | تفاصيل سيناريو منشور أو draft حسب الصلاحية. |
| POST | `/platform/qa/scenarios/import` | استيراد JSON من ملفات seed أو upload لاحقاً. |
| POST | `/platform/qa/scenarios/:scenarioId/publish` | نشر نسخة. |
| POST | `/platform/qa/runs` | إنشاء Run جديد أو طلب استكمال الموجود. |
| GET | `/platform/qa/runs` | قائمة runs؛ own أو all حسب الصلاحية. |
| GET | `/platform/qa/runs/:runId` | تفاصيل run والإجابات. |
| PATCH | `/platform/qa/runs/:runId/answers` | Autosave batch للإجابات. |
| POST | `/platform/qa/runs/:runId/pause` | إيقاف مؤقت. |
| POST | `/platform/qa/runs/:runId/submit` | تسليم run للمراجعة. |
| POST | `/platform/qa/runs/:runId/reopen` | إعادة فتح بواسطة qa_lead/admin. |
| POST | `/platform/qa/runs/:runId/issues` | إنشاء issue مرتبط. |
| PATCH | `/platform/qa/issues/:issueId` | تحديث حالة/severity/blocking. |
| POST | `/platform/qa/runs/:runId/attachments/presign` | إنشاء presigned upload private. |
| POST | `/platform/qa/runs/:runId/attachments/confirm` | تأكيد upload وحفظ metadata. |
| GET | `/platform/qa/attachments/:attachmentId/download` | presigned download قصير العمر. |
| GET | `/platform/qa/dashboard` | ملخص الجودة. |

## Create Run

```json
{
  "scenarioId": "merchant-electronics",
  "mode": "new"
}
```

إذا وجد run غير مكتمل لنفس المختبر والسيناريو، يعيد API خيارين للواجهة:

```json
{
  "hasOpenRun": true,
  "openRunId": "uuid",
  "actions": ["resume_previous", "create_new"]
}
```

## Autosave Answers

```json
{
  "currentPhaseKey": "MJ-ELEC-PH-003",
  "answers": [
    { "itemKey": "MJ-ELEC-PH-003-CHK-001", "answerType": "check_status", "status": "pass" },
    { "itemKey": "MJ-ELEC-PH-003-Q-001", "answerType": "text", "textAnswer": "الملاحظة" }
  ]
}
```

## Attachment Presign

```json
{
  "fileName": "checkout-error.png",
  "contentType": "image/png",
  "fileSizeBytes": 482133,
  "itemKey": "MJ-ELEC-PH-010-CHK-004"
}
```

لا يجب أن تكون الملفات public افتراضياً. التحميل والتحميل المعاكس يتمان عبر URLs قصيرة العمر.
