# Phase 1 Resumable Runs Design

Resume Later يعتمد على قاعدة البيانات وليس localStorage. localStorage يمكن استخدامه فقط cache مؤقت للـ UI ولا يكون مصدر الحقيقة.

## حالات run

| Status | Meaning |
|---|---|
| draft | run أنشئ ولم يبدأ فعلياً. |
| in_progress | المختبر يعمل حالياً. |
| paused | المختبر اختار الاستكمال لاحقاً. |
| submitted | تم التسليم للمراجعة. |
| reviewed | تمت المراجعة. |
| reopened | أعيد فتحه بعد المراجعة. |
| cancelled | ألغي دون اعتماد. |

## Autosave

- يتم إرسال batch كل 5-10 ثوان بعد آخر تغيير أو عند الانتقال بين المراحل.
- كل request يحتوي `currentPhaseKey` ونسخة answers المعدلة.
- API يستخدم upsert على `(run_id, item_key)`.
- تحديث `qa_runs.last_activity_at` مع كل autosave ناجح.
- النزاعات تعالج عبر `updated_at` أو `revision` لاحقاً إذا ظهرت جلسات متعددة لنفس run.

## Resume Detection

عند فتح صفحة السيناريو:

```txt
GET /platform/qa/runs?scenarioId=merchant-electronics&mine=true&status=open
```

إذا وجد run بحالة draft/in_progress/paused/reopened، تعرض الواجهة خيار الاستكمال أو إنشاء run جديد. المختبر غير مقيد بمرة واحدة؛ كل run مستقل.

## Submit

- يمنع submit إذا لا توجد أي إجابات على checks.
- يحسب score مبدئي server-side.
- يقفل answers عن qa_tester بعد submit إلا إذا أعاد qa_lead فتح run.

## Audit/Event Log

كل انتقال حالة يسجل في `qa_run_events` مع actor، timestamp، requestId، وmetadata. هذا يساعد لاحقاً في التحقيق في فقدان حفظ أو اختلاف score.
