import assert from "node:assert/strict";
import { InfraiClient } from "./infrai_client.js";
import { resendStuckVerification } from "./fieldservice_verification.js";

const calls: string[] = [];
const fakeFetch: typeof fetch = async (input, init) => {
  calls.push(`${init?.method} ${String(input)}`);
  const data = calls.length === 1 ? [] : calls.length === 2 ? { message_id: "msg-new" } : [{ status: "sent" }];
  return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { "content-type": "application/json" } });
};

const result = await resendStuckVerification({
  work_order_id: "WO-17",
  verification_message_id: "msg-old",
  dispatch_status: "on_site",
  technician_follow_up: "Call after meter photo review",
  photos: [{ id: "photo-1", captured_at: "2026-10-28T08:00:00.000Z" }],
  idempotency_key: "WO-17-resend-1",
}, new InfraiClient("test-key", fakeFetch));

assert.equal(result.delivery_state, "resent");
assert.equal(result.message_id, "msg-new");
assert.equal(result.photo_count, 1);
assert.deepEqual(calls.map((call) => call.split(" ")[0]), ["GET", "POST", "GET"]);
console.log("field-service resend decision: passed");
