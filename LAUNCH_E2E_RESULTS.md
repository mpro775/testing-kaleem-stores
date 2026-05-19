# Launch E2E Results

Status: prepared for execution. No browser/API staging stack was running in this session, so runtime scenarios are marked `blocked` until executed by QA runner or Playwright against staging.

| Scenario | Steps | Expected Result | Actual Result | Status | UX Notes | Priority | Required Fix |
|---|---|---|---|---|---|---|---|
| Merchant electronics journey | account, OTP, store setup, brand, multi-category product, media, variants, warehouse stock, payment, delivery/pickup, theme, pages, SEO, preview, publish | merchant completes setup without technical help | not executed | blocked | use existing electronics scenario JSON/MD | P1 | run through platform QA runner |
| Merchant sports journey | same merchant flow with sports catalog and delivery inside/outside city | store can receive orders | not executed | blocked | use existing sports scenario | P1 | run through platform QA runner |
| Merchant women journey | same merchant flow with women-focused catalog | store can receive orders | not executed | blocked | use existing women scenario | P1 | run through platform QA runner |
| Simple pickup merchant | configure store pickup and no full delivery address | pickup checkout does not require full address | not executed | blocked | verify checkout copy is clear | P1 | run staging checkout |
| Customer delivery checkout | browse, filter, product, variant, cart, delivery checkout, payment, receipt, confirm | final total, discount, delivery fee, order confirmation visible | not executed | blocked | verify no legacy order status labels | P1 | run staging checkout |
| Customer pickup checkout | browse, product, cart, pickup checkout, payment, confirm | pickup order created without full address | not executed | blocked | verify pickup instructions | P1 | run staging checkout |
| Orders/payment journey | new order, receipt, approve/reject, confirmed, preparing, out_for_delivery, completed, cancel, return | legal transitions only and timelines visible | not executed | blocked | verify inventory not double-adjusted | P1 | run merchant QA |
| Subscription lifecycle | trial, nearing end, expired, invoice, receipt, finance approval, past_due, grace, suspension, reactivation | no duplicate invoices and YER visible | not executed | blocked | verify entitlement messaging | P1 | run worker twice in staging |
| Merchant RBAC | owner, manager, products staff, orders staff, reports viewer, finance viewer, support user | UI and API enforce permissions | not executed | blocked | verify buttons hidden and API denied | P1 | run direct API checks |
| Platform operations | super_admin, ops, finance, support, qa_tester, template_manager, auditor | step-up, audit, and permission boundaries hold | not executed | blocked | verify auditor read-only | P1 | run platform QA |
| Domains/templates/SEO | custom domain, TXT/CNAME failure, SSL states, template preview/publish reject invalid, product/category/page SEO, sitemap, robots, canonical | diagnostics clear and invalid template cannot publish | not executed | blocked | verify Arabic DNS guidance | P1 | run platform and storefront QA |
| Reports/webhooks/notifications | sales by category, inventory warehouse/variant, export, signed webhook, retry/replay, new order/receipt/low stock notifications | data uses truth sources, export permission enforced, notifications visible | not executed | blocked | verify sound preference | P1 | run backend and UI QA |

## Attachments

None in this session.

## Next Execution

Use the platform QA runner scenarios under `testing kaleem stores/qa-scenarios/json` and record concrete pass/fail evidence here after each run.
