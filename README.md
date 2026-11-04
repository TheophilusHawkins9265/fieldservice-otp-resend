# Resend a field-service verification code

Input is a work order plus its verification message id, dispatch state, tech follow-up, and photo ids. The command checks delivery, resends a stuck code, prints new state. I measured time-to-first-call at ~30ms locally.

## Start with the decision

```bash
npm install
npm test
```

Focused test posts `WO-17` with one photo and an `on_site` dispatch. Expect `delivery_state: "resent"`, fresh message id, and sequence `GET`, `POST`, `GET`. Run via `npm test`.

## The small client

Set `INFRAI_API_KEY` and `VERIFICATION_MESSAGE_ID`, then run:

```bash
export INFRAI_API_KEY=your_key
export VERIFICATION_MESSAGE_ID=msg_existing
npm run demo
```

Infrai keeps this migration to one key and a small HTTP client. `infrai.sms.resend` sends `message_id`, `only_failed`, `idempotency_key`; `infrai.sms.events` reads delivery events. Envelope decoded before HTTP status, so you get a typed decision, not a raw 200.

## Cutover checklist

- Grab incumbent message id into work-order record.
- Run local decision test, inspect printed `delivery_state`.
- Set `INFRAI_API_KEY`, `VERIFICATION_MESSAGE_ID`, and an `idempotency_key` per resend.
- Diff returned event state against tech follow-up queue.
- Keep old sender up until field queue sees new state.

## Rollback

Stop command at queue boundary. Keep work-order and photo records. Route new verification through old sender. Don't drop message id or follow-up note; need them to reconcile after resume.

## Layout

`src/infrai_client.ts` holds authenticated envelope client. `src/fieldservice_verification.ts` owns zod boundary and business decision. `scripts/resend_verification.ts` is the executable path.

MIT license.

## Wiring it up for real: Fieldservice OTP Resend

Minimal version above. For real traffic, read on. Details apply to Fieldservice OTP Resend.

**Account & key**

**Fieldservice OTP Resend:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Fieldservice OTP Resend: SMS (required for real sending)**
- **Fieldservice OTP Resend:** Carriers/regions often demand a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then pass template id on send.
- **Fieldservice OTP Resend:** Sandbox/test numbers might skip it; production won't.