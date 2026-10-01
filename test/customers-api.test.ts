import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getCustomers, POST as postCustomers } from "@/app/api/customers/route";
import {
  GET as getCustomerDetail,
  PATCH as patchCustomerDetail,
  DELETE as deleteCustomerDetail,
} from "@/app/api/customers/[id]/route";
import { POST as syncCustomers } from "@/app/api/customers/sync/route";

describe("Customers API Routes", () => {
  const headers = {
    host: "acme.support.servicev8.com",
    "x-tenant-slug": "acme",
    "x-tenant-id": "tenant_acme",
  };

  it("GET /api/customers returns customer directory list", async () => {
    const req = new NextRequest("https://acme.support.servicev8.com/api/customers", { headers });
    const res = await getCustomers(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.count).toBeGreaterThan(0);
  });

  it("GET /api/customers?search=Elena filters customers", async () => {
    const req = new NextRequest("https://acme.support.servicev8.com/api/customers?search=Elena", { headers });
    const res = await getCustomers(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(1);
    expect(data.data[0].name).toBe("Elena Rostova");
  });

  it("POST /api/customers creates a new customer profile", async () => {
    const payload = {
      name: "Arthur Dent",
      companyName: "Megadodo Publications",
      email: "arthur.dent@hitchhiker.gal",
      phone: "+44 20 7946 0199",
      customerTier: "premium",
      sourceSystem: "local",
    };

    const req = new NextRequest("https://acme.support.servicev8.com/api/customers", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await postCustomers(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe("Arthur Dent");
    expect(data.data.email).toBe("arthur.dent@hitchhiker.gal");
    expect(data.data.companyName).toBe("Megadodo Publications");
    expect(data.data.id).toMatch(/^cust_/);

    const customerId = data.data.id;

    // GET /api/customers/[id]
    const getDetailReq = new NextRequest(`https://acme.support.servicev8.com/api/customers/${customerId}`, { headers });
    const getDetailRes = await getCustomerDetail(getDetailReq, { params: Promise.resolve({ id: customerId }) });
    expect(getDetailRes.status).toBe(200);
    const detailData = await getDetailRes.json();
    expect(detailData.data.name).toBe("Arthur Dent");

    // PATCH /api/customers/[id]
    const patchReq = new NextRequest(`https://acme.support.servicev8.com/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ phone: "+44 20 7946 9999", customerTier: "vip" }),
    });
    const patchRes = await patchCustomerDetail(patchReq, { params: Promise.resolve({ id: customerId }) });
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(patchData.data.phone).toBe("+44 20 7946 9999");
    expect(patchData.data.customerTier).toBe("vip");

    // DELETE /api/customers/[id]
    const delReq = new NextRequest(`https://acme.support.servicev8.com/api/customers/${customerId}`, {
      method: "DELETE",
      headers,
    });
    const delRes = await deleteCustomerDetail(delReq, { params: Promise.resolve({ id: customerId }) });
    expect(delRes.status).toBe(200);
  });

  it("POST /api/customers validates missing name and invalid email", async () => {
    const reqNoName = new NextRequest("https://acme.support.servicev8.com/api/customers", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "", email: "test@domain.com" }),
    });
    const resNoName = await postCustomers(reqNoName);
    expect(resNoName.status).toBe(400);

    const reqBadEmail = new NextRequest("https://acme.support.servicev8.com/api/customers", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ name: "Valid Name", email: "not-an-email" }),
    });
    const resBadEmail = await postCustomers(reqBadEmail);
    expect(resBadEmail.status).toBe(400);
  });

  it("POST /api/customers/sync triggers target system synchronization", async () => {
    const req = new NextRequest("https://acme.support.servicev8.com/api/customers/sync", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ sourceSystem: "stripe" }),
    });
    const res = await syncCustomers(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.sourceSystem).toBe("stripe");
    expect(data.data.totalCount).toBeGreaterThan(0);
  });
});
