# Phase 1 Acceptance Checklist

## Scenario Conversion
- [x] تم اكتشاف كل ملفات Markdown الخاصة بالسيناريوهات.
- [x] تم توليد 4 ملفات JSON.
- [x] كل JSON يحتوي scenarioId و version و codePrefix.
- [x] كل Phase لها phaseId و order و title.
- [x] كل Check له checkId و order و text.
- [x] كل Question له questionId و type.
- [x] تم توليد normalized-md لكل سيناريو.
- [x] تم إنشاء conversion report.

## Schema
- [x] تم إنشاء qa-scenario.schema.json.
- [x] كل ملفات JSON صالحة JSON ومطابقة للفحص البنيوي الأدنى في السكربت.

## Data Model
- [x] تم تصميم جميع جداول QA المطلوبة.
- [x] تم تضمين qa_runs و qa_answers و qa_attachments.
- [x] تم تصميم resume/autosave.
- [x] تم تصميم roles.

## Backend/Frontend Planning
- [x] تم فحص kaleem-api.
- [x] تم فحص platform-admin الموجود فعلياً؛ `platform-admin-ui` غير موجود.
- [x] تم كتابة API contract.
- [x] تم كتابة frontend map.
- [x] تم كتابة S3 attachments design.

## Final
- [x] لا توجد تغييرات إنتاجية في الكود الحالي.
- [x] كل المخرجات موجودة داخل testing kaleem stores.
