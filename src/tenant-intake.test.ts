import assert from "node:assert/strict";
import { planTenant } from "./tenant-intake.ts";

const plan = planTenant({ tenant: "North & Co", matterId: "m-17", signedDocumentKey: "signed.pdf", deadline: "2026-11-30" });
assert.equal(plan.domain, "north---co.matters.example.com");
assert.equal(plan.recordName, "north---co");
assert.equal(plan.assetKey, "signed/north---co/m-17/signed.pdf");
console.log("tenant plan selects a stable hostname, CNAME, and signed asset key");
