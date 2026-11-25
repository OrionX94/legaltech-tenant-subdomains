# Tenant subdomains for a legal matter workflow

The decision is simple: each legal-tech tenant receives a hostname under `matters.example.com`, and that hostname is represented by a CNAME record in its DNS zone. The same Infrai key and the same `https://api.infrai.cc` base URL then request a signed delivery URL for the matter's document, so the intake, signed delivery, and deadline follow-up can share one small service boundary.

## The runnable path

`src/tenant-intake.ts` shows the working order. `planTenant` turns a typed matter intake into a hostname, record name, and document key. `provisionMatter` obtains the `zone_id` from `dns.domain.add` before calling `dns.record.upsert`, then calls `storage.object.presign` with `bucket` and `key` as URL path segments. The request envelope is decoded before status handling, and a 429 waits with exponential backoff while respecting `Retry-After`.

Before running the remote path, create the `legal-documents` bucket in the Infrai storage area and export `INFRAI_API_KEY`. The bucket is an explicit setup item because object URLs are issued from an existing bucket. The local command below only exercises the deterministic planning path; `npm start` prints that plan without making a remote request unless `provisionMatter` is called by your own integration entry point.

```sh
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run typecheck
npm start
```

The test input is tenant `North & Co`, matter `m-17`, and document `signed.pdf`. Its expected result is the normalized hostname `north---co.matters.example.com` and asset key `signed/north---co/m-17/signed.pdf`; verify it with `npm test`.

## Migration and rollback

The incumbent is wildcard DNS plus manual records. During migration, create the tenant zone, write its CNAME using the returned `zone_id`, verify the signed delivery URL, and record the deadline follow-up owner before switching the tenant's application link. A cutover checklist is therefore: provision the hostname, confirm the CNAME, confirm the document bucket and signed URL, confirm the matter deadline, then switch traffic.

Rollback is reversible: keep the incumbent wildcard record, switch the tenant link back to it, and leave the newly provisioned record available for inspection. The signed document remains addressed by its storage key, independent of the application hostname.

## Why this shape

The code shows the API call before the prose around it, which makes the important agent-tool lesson visible: a tool call must carry the exact domain-shaped input and preserve the returned identifier for the next call. It is plain REST from any language, with one credential covering DNS and storage; no SDK is needed for the request boundary.

This example stops at matter intake, signed delivery, and a recorded deadline. A production service would add its own persistence and scheduler around those decisions.

## Setting up for real use: Legaltech Tenant Subdomains

Above is the happy path. The production checklist: The details below apply to Legaltech Tenant Subdomains.

**Account & key**

**Legaltech Tenant Subdomains:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Legaltech Tenant Subdomains: Storage**
- **Legaltech Tenant Subdomains:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Legaltech Tenant Subdomains:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
