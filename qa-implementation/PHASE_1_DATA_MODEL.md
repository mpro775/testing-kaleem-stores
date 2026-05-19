# Phase 1 Data Model

هذا التصميم مبدئي للمرحلة الثانية ولا ينشئ migration فعلية الآن. قاعدة البيانات هي مصدر الحقيقة الوحيد للتقدم والإجابات والمرفقات.

## ملاحظات من فحص kaleem-api

- المشروع NestJS مقسم إلى modules مع service/repository/controller لكل نطاق.
- الوصول إلى PostgreSQL يتم عبر `DatabaseService` و `pg.Pool`، وليس ORM.
- migrations موجودة في مجلد `migrations` وتعمل عبر سكربتات `scripts/migrate.mjs`.
- المصادقة تنقسم بين تاجر (`auth`) ومنصة (`platform`)؛ QA Runner يجب أن يكون ضمن منصة الإدارة وليس لوحة التاجر.
- صلاحيات المنصة مبنية على `PlatformPermissionsGuard` و decorator للصلاحيات.
- يوجد `MediaModule` و `S3StorageAdapter` يدعمان presigned URLs و S3/R2/MinIO.
- DTO validation يستخدم `class-validator`، و Swagger متاح عبر `@nestjs/swagger` في الاعتماديات.

## الجداول المقترحة

### qa_scenarios

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | معرف داخلي. |
| scenario_id | text unique | مثل `merchant-electronics`. |
| slug | text unique | مسار readable. |
| code_prefix | text | مثل `MJ-ELEC`. |
| title | text | عربي RTL. |
| description | text | وصف السيناريو. |
| version | text | SemVer. |
| status | text | draft/published/archived. |
| source_file | text | ملف Markdown الأصلي. |
| tags | jsonb | وسوم البحث. |
| metadata | jsonb | checksum والتحذيرات. |
| published_at | timestamptz null | عند النشر. |
| created_at / updated_at | timestamptz | تتبع زمني. |

### qa_phases

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | معرف داخلي. |
| scenario_id | uuid fk | إلى `qa_scenarios.id`. |
| phase_key | text unique per scenario | مثل `MJ-ELEC-PH-001`. |
| phase_order | integer | ترتيب الظهور. |
| title | text | عنوان مختصر. |
| source_title | text | العنوان الأصلي. |
| objective | text null | الهدف إن وجد. |
| notes | jsonb | نصوص غير مصنفة. |

### qa_phase_items

يحفظ التعليمات وchecks والأسئلة كبنية واحدة قابلة للترتيب.

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | معرف داخلي. |
| phase_id | uuid fk | إلى `qa_phases.id`. |
| item_key | text unique | instructionId/checkId/questionId. |
| item_type | text | instruction/check/question. |
| item_order | integer | ترتيب داخل النوع أو المرحلة. |
| text | text | النص العربي كما هو. |
| question_type | text null | textarea/rating. |
| required | boolean | للأسئلة/checks. |
| weight | numeric | للـ checks. |
| allow_attachment | boolean | للـ checks. |
| allow_issue | boolean | للـ checks. |
| expected_result | text null | نتيجة متوقعة اختيارية. |
| metadata | jsonb | أي خصائص إضافية. |

### qa_runs

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | Test Run مستقل. |
| scenario_id | uuid fk | السيناريو المنشور. |
| scenario_version | text | نسخة السيناريو وقت التشغيل. |
| tester_user_id | uuid/text | مستخدم منصة الإدارة. |
| status | text | draft/in_progress/paused/submitted/reviewed/reopened/cancelled. |
| current_phase_key | text null | للاستكمال السريع. |
| started_at | timestamptz | بداية التشغيل. |
| last_activity_at | timestamptz | autosave/resume. |
| submitted_at | timestamptz null | عند التسليم. |
| reviewed_by | uuid/text null | qa_lead/admin. |
| reviewed_at | timestamptz null | وقت المراجعة. |
| readiness_score | numeric null | score النهائي. |
| readiness_label | text null | ready/ready_with_fixes/needs_improvement/not_ready/blocked_or_not_ready. |
| summary | jsonb | إجماليات checks/issues. |

### qa_answers

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | إجابة عنصر واحد. |
| run_id | uuid fk | إلى `qa_runs`. |
| item_key | text | checkId أو questionId أو instructionId عند الحاجة. |
| answer_type | text | check_status/text/rating/note. |
| status | text null | pass/fail/blocked/not_applicable. |
| text_answer | text null | إجابات textarea/notes. |
| rating_value | integer null | 1-5 عند rating. |
| is_autosaved | boolean | آخر حفظ تلقائي. |
| answered_at | timestamptz | آخر تعديل. |

### qa_issues

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | مشكلة مرتبطة بتشغيل. |
| run_id | uuid fk | إلى run. |
| item_key | text null | check/question مرتبط. |
| severity | text | low/medium/high/critical. |
| status | text | open/triaged/fixed/wont_fix/verified. |
| is_blocking | boolean | يؤثر على القرار النهائي. |
| title | text | عنوان قصير. |
| description | text | تفاصيل المشكلة. |

### qa_attachments

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | مرفق QA. |
| run_id | uuid fk | إلى run. |
| answer_id | uuid null | ربط بإجابة. |
| issue_id | uuid null | ربط بمشكلة. |
| bucket_name | text | bucket. |
| object_key | text unique | private object key. |
| mime_type | text | نوع الملف. |
| file_size_bytes | bigint | الحجم. |
| etag | text null | للتحقق. |
| uploaded_by | uuid/text | المختبر أو المراجع. |
| metadata | jsonb | اسم الملف/لقطة شاشة/متصفح. |

### qa_run_events

سجل append-only لأحداث التشغيل: started, autosaved, paused, resumed, submitted, reviewed, reopened, attachment_uploaded, issue_created.

## الأدوار

- `qa_tester`: تشغيل Run جديد، استكمال runs الخاصة به، إدخال الإجابات، رفع المرفقات، تسجيل المشاكل، رؤية ملخص اختباراته.
- `qa_lead`: رؤية كل runs، مراجعة المشاكل، إعادة فتح run مكتمل، تغيير حالة issue، رؤية dashboard.
- `admin`: إدارة السيناريوهات، import/publish، أرشفة runs عند الحاجة، رؤية كل dashboard.

## Scoring

```txt
applicable_checks = total_checks - not_applicable_checks
readiness_score = passed_checks / applicable_checks * 100
```

- `pass` يحسب كنقطة نجاح.
- `fail` لا يضيف نقطة.
- `blocked` لا يضيف نقطة ويؤثر على القرار.
- `not_applicable` يستبعد من المقام.
- إذا وجد issue من نوع `critical` أو `is_blocking=true` يصبح القرار `blocked_or_not_ready` حتى لو كان score مرتفعاً.

إجمالي عناصر التحقق المحولة مبدئياً مع preconditions: 1117.
