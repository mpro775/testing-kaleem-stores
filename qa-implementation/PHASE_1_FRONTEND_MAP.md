# Phase 1 Frontend Map

الخريطة مبدئية للمرحلة الثالثة. الفحص وجد أن المجلد الفعلي هو `platform-admin` وليس `platform-admin-ui`.

## ملاحظات من فحص platform-admin

- التطبيق React + Vite + MUI، ويدعم RTL عبر theme ومكونات MUI.
- routing مركزي في `src/app/router/platform-router.tsx` والمسارات في `route-paths.ts`.
- sidebar يعتمد `platformNavItems` و `platformPermissionMap`.
- API client الحالي يستخدم `platformApiRequest` مع access token و CSRF وتجديد session.
- الجلسة والصلاحيات في `PlatformSessionProvider`، مع `hasPermission` محلياً.
- توجد مكونات common مثل loading/error/empty/json viewer يمكن إعادة استخدامها.

## المسارات المقترحة

| Route | Purpose | Roles |
|---|---|---|
| `/platform/qa` | Dashboard QA مختصر وقائمة runs الجارية. | qa_tester/qa_lead/admin |
| `/platform/qa/scenarios` | قائمة السيناريوهات وحالتها. | qa_tester/qa_lead/admin |
| `/platform/qa/scenarios/:scenarioId` | معاينة السيناريو قبل التشغيل. | qa_tester/qa_lead/admin |
| `/platform/qa/runs` | قائمة runs. | qa_tester يرى الخاصة به، qa_lead/admin يرون الكل. |
| `/platform/qa/runs/:runId` | شاشة التنفيذ أو المراجعة. | qa_tester/qa_lead/admin |
| `/platform/qa/issues` | قائمة المشاكل المستخرجة من runs. | qa_lead/admin |
| `/platform/qa/dashboard` | مؤشرات الجاهزية والجودة. | qa_lead/admin |

## ما يراه كل دور

- `qa_tester`: زر تشغيل سيناريو، تنبيه run غير مكتمل، شاشة تنفيذ phased، رفع مرفقات، إنشاء issue، ملخص runs الخاصة به.
- `qa_lead`: كل runs، filters حسب السيناريو/المختبر/الحالة، مراجعة issues، إعادة فتح run، dashboard.
- `admin`: إدارة import/publish للسيناريوهات، رؤية كل شيء، إعدادات الأرشفة والنسخ.

## شاشة Run

- شريط مراحل ثابت يوضح التقدم والحالة.
- قسم تعليمات read-only لكل مرحلة.
- قائمة checks بحالات pass/fail/blocked/not_applicable.
- أسئلة textarea/rating حسب JSON.
- مرفقات مرتبطة بالـ check أو issue.
- حفظ تلقائي مع مؤشر last saved.
- زر Pause/Resume ثم Submit عند اكتمال الحد الأدنى.

## تنبيه الاستكمال

عند فتح سيناريو ولدى المستخدم run غير مكتمل، تعرض الواجهة حواراً بخيارين واضحين: `استكمال الاختبار السابق` أو `إنشاء اختبار جديد`. لا يعتمد القرار على localStorage؛ يتم جلبه من `/platform/qa/runs?scenarioId=...&status=open&mine=true`.

## إضافة الملاحة لاحقاً

- إضافة `qa` إلى `platformPaths`.
- إضافة permissions إلى `permission-map.ts`.
- إضافة عنصر sidebar بأيقونة مناسبة من MUI.
- إنشاء `features/platform/api/qa.api.ts` و `features/platform/pages/qa/*`.
