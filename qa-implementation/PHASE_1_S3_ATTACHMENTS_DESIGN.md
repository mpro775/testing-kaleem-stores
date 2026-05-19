# Phase 1 S3 Attachments Design

التصميم يستفيد من `MediaModule` و `S3StorageAdapter` الموجودين في `kaleem-api`، لكنه يفصل مرفقات QA عن وسائط المتجر.

## مبادئ

- الملفات private افتراضياً.
- لا يتم حفظ URL دائم public في `qa_attachments`.
- access يتم عبر presigned GET قصير العمر.
- object key يجب أن يحتوي runId ولا يعتمد على اسم الملف وحده.
- يتم تأكيد upload عبر headObject ومطابقة content type والحجم وetag إن توفر.

## Object Key

```txt
qa-runs/{runId}/{itemKey|general}/{timestamp}-{safeFileName}
qa-issues/{issueId}/{timestamp}-{safeFileName}
```

## Presign Flow

1. الواجهة تطلب `POST /platform/qa/runs/:runId/attachments/presign` مع الحجم والنوع.
2. API يتحقق من صلاحية المستخدم على run.
3. API يولد object key ويعيد presigned PUT.
4. الواجهة ترفع مباشرة إلى S3/R2/MinIO.
5. الواجهة ترسل confirm مع objectKey وetag إن وجد.
6. API ينفذ headObject ويحفظ سجل `qa_attachments`.

## السياسات

- الحد الأقصى المقترح: 10MB للصورة، 50MB للفيديو القصير عند الحاجة.
- الأنواع المسموحة مبدئياً: png, jpeg, webp, gif, mp4, webm, pdf, txt.
- منع تنفيذ أو عرض HTML مرفوع كمحتوى موثوق.
- URLs للتحميل صالحة 5-10 دقائق فقط.
- لا يملك `qa_tester` تنزيل مرفقات runs لا تخصه إلا إذا كان لديه صلاحية lead/admin.

## علاقة MediaModule

يمكن إعادة استخدام adapter الحالي، لكن يفضل Repository مستقل لـ QA حتى لا تختلط وسائط المتجر ببيانات الاختبار. إن تم استخدام جدول media_assets الحالي لاحقاً، يجب تمييز `metadata.source = qa_runner` وربط QA بجدول join مستقل.
