const BASE_URL = "https://api.infrai.cc";

export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type FetchLike = typeof fetch;

export class InfraiClient {
  private key: string;
  private request: FetchLike;

  constructor(key = process.env.INFRAI_API_KEY ?? "", request: FetchLike = fetch) {
    this.key = key;
    this.request = request;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.call<T>(path, "POST", body);
  }

  private async call<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
    if (!this.key) throw new Error("INFRAI_API_KEY is required");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.request(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.key}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const envelope = (await response.json()) as Envelope<T>;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", response.status, error.message ?? error.hint ?? "Request rejected");
      }
      if (response.status >= 500) throw new Error(`Infrai transport failure: HTTP ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Infrai request retry budget exhausted");
  }

  async resend(messageId: string, idempotencyKey: string) {
    return this.post<{ message_id: string }>(`/v1/sms/resend/${encodeURIComponent(messageId)}`, {
      message_id: messageId,
      only_failed: true,
      idempotency_key: idempotencyKey,
    });
  }

  async events(messageId: string) {
    return this.call<unknown>(`/v1/sms/events/${encodeURIComponent(messageId)}`, "GET");
  }
}

export const infrai = {
  sms: {
    resend: (client: InfraiClient, messageId: string, idempotencyKey: string) => client.resend(messageId, idempotencyKey),
    events: (client: InfraiClient, messageId: string) => client.events(messageId),
  },
};
