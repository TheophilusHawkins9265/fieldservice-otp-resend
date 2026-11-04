import { InfraiClient } from "../src/infrai_client.js";
import { resendStuckVerification } from "../src/fieldservice_verification.js";

const input = {
  work_order_id: process.env.WORK_ORDER_ID ?? "WO-demo",
  verification_message_id: process.env.VERIFICATION_MESSAGE_ID,
  dispatch_status: "on_site" as const,
  technician_follow_up: "Confirm access after delivery",
  photos: [{ id: "photo-demo", captured_at: new Date().toISOString() }],
  idempotency_key: process.env.RESEND_IDEMPOTENCY_KEY ?? `WO-demo-${Date.now()}`,
};

if (!input.verification_message_id) throw new Error("VERIFICATION_MESSAGE_ID is required");
const result = await resendStuckVerification(input, new InfraiClient());
console.log(JSON.stringify(result, null, 2));
