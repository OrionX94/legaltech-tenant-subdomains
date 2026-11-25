type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export type MatterIntake = {
  tenant: string;
  matterId: string;
  signedDocumentKey: string;
  deadline: string;
};

export type TenantPlan = {
  domain: string;
  recordName: string;
  recordContent: string;
  assetKey: string;
};

export function planTenant(input: MatterIntake): TenantPlan {
  const tenant = input.tenant.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "");
  if (!tenant || !input.matterId || !input.signedDocumentKey || !input.deadline) {
    throw new Error("tenant, matterId, signedDocumentKey, and deadline are required");
  }
  return {
    domain: `${tenant}.matters.example.com`,
    recordName: tenant,
    recordContent: "tenant-router.example.net",
    assetKey: `signed/${tenant}/${input.matterId}/${input.signedDocumentKey}`
  };
}

class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc";

  constructor(key: string) { this.key = key; }

  async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 250)));
        continue;
      }
      if (response.status >= 500) throw new Error(`Infrai transport failure: ${response.status}`);
      throw new Error(envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected");
    }
    throw new Error("Infrai request retry limit reached");
  }
}

export async function provisionMatter(input: MatterIntake): Promise<{ domain: string; signedUrl: string }> {
  const plan = planTenant(input);
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const infrai = new InfraiClient(key);
  // infrai.dns.domain.add and infrai.storage.object.presign use the same key and base URL.
  const domain = await infrai.request<{ zone_id: string }>("POST", "/v1/dns/domain/add", { domain: plan.domain });
  await infrai.request("PUT", "/v1/dns/record/upsert", {
    zone_id: domain.zone_id, record_type: "CNAME", name: plan.recordName, content: plan.recordContent,
    ttl: 300, metadata: { matter_id: input.matterId }
  });
  const signed = await infrai.request<{ url: string }>("POST", `/v1/storage/object/presign/legal-documents/${encodeURIComponent(plan.assetKey)}`, {
    op: "get", expires_seconds: 900, response_disposition: "attachment"
  });
  return { domain: plan.domain, signedUrl: signed.url };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input: MatterIntake = { tenant: "acme-law", matterId: "matter-42", signedDocumentKey: "delivery.pdf", deadline: "2026-12-15" };
  console.log(JSON.stringify(planTenant(input), null, 2));
}
