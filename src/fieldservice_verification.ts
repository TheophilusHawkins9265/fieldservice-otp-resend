import { z } from "zod";
import { InfraiClient, infrai } from "./infrai_client.js";

export const resendRequest = z.object({
  work_order_id: z.string().min(1),
  verification_message_id: z.string().min(1),
  dispatch_status: z.enum(["assigned", "en_route", "on_site", "complete"]),
  technician_follow_up: z.string().min(1),
  photos: z.array(z.object({ id: z.string().min(1), captured_at: z.string().datetime() })).min(1),
  idempotency_key: z.string().min(1),
});

export type ResendRequest = z.infer<typeof resendRequest>;

export type DeliveryState = "resent" | "already_delivered" | "not_eligible";

export type ResendResult = {
  work_order_id: string;
  delivery_state: DeliveryState;
  message_id: string;
  dispatch_status: ResendRequest["dispatch_status"];
  photo_count: number;
  technician_follow_up: string;
  events?: unknown;
};

function wasDelivered(events: unknown): boolean {
  return Array.isArray(events) && events.some((event) => typeof event === "object" && event !== null && "status" in event && (event as { status?: string }).status === "delivered");
}

export async function resendStuckVerification(input: unknown, client: InfraiClient): Promise<ResendResult> {
  const request = resendRequest.parse(input);
  const events = await infrai.sms.events(client, request.verification_message_id);
  if (wasDelivered(events)) {
    return { work_order_id: request.work_order_id, delivery_state: "already_delivered", message_id: request.verification_message_id, dispatch_status: request.dispatch_status, photo_count: request.photos.length, technician_follow_up: request.technician_follow_up, events };
  }
  const resend = await infrai.sms.resend(client, request.verification_message_id, request.idempotency_key);
  const refreshedEvents = await infrai.sms.events(client, resend.message_id ?? request.verification_message_id);
  return { work_order_id: request.work_order_id, delivery_state: "resent", message_id: resend.message_id ?? request.verification_message_id, dispatch_status: request.dispatch_status, photo_count: request.photos.length, technician_follow_up: request.technician_follow_up, events: refreshedEvents };
}
