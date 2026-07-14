import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  audit: vi.fn(),
  ensureInvoice: vi.fn(),
  recalculateInvoice: vi.fn(),
  serializePayment: vi.fn(),
  transaction: vi.fn(),
  withBilling: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}))

vi.mock("@/lib/billing", () => {
  class BillingError extends Error {
    constructor(
      message: string,
      public code: string,
      public status = 400
    ) {
      super(message)
    }
  }

  return {
    billingOk: (data: unknown, message?: string, status = 200) =>
      Response.json({ success: true, data, message }, { status }),
    BillingError,
    ensureBillingInvoice: mocks.ensureInvoice,
    generateReceiptNo: () => "RCT-TEST-001",
    recalculateInvoiceAfterPayments: mocks.recalculateInvoice,
    serializePayment: mocks.serializePayment,
    toPesewas: (value: unknown) => Math.round(Number(value) * 100),
    withBilling: mocks.withBilling,
    writeBillingAuditLog: mocks.audit,
  }
})

import { POST } from "@/app/api/billing/invoices/[id]/payments/route"

const actor = { id: "billing-officer-1", facilityId: "facility-1" }

function request() {
  return new NextRequest(
    "https://khms.test/api/billing/invoices/invoice-1/payments",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "CASH", amount: 25 }),
    }
  )
}

describe("billing payment route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withBilling.mockImplementation(async (_request, handler) =>
      handler(actor)
    )
    mocks.ensureInvoice.mockResolvedValue({
      id: "invoice-1",
      invoiceNo: "INV-001",
      status: "ISSUED",
      balanceDue: 50,
    })
    mocks.recalculateInvoice.mockResolvedValue({
      id: "invoice-1",
      invoiceNo: "INV-001",
      status: "PARTIALLY_PAID",
      balanceDue: 25,
    })
    mocks.serializePayment.mockImplementation((payment) => payment)
  })

  it("records and recalculates a payment in a transaction with enough time", async () => {
    const created = {
      id: "payment-1",
      receiptNo: "RCT-TEST-001",
      invoiceId: "invoice-1",
      amount: 25,
      method: "CASH",
    }
    const payment = { ...created, status: "SUCCESSFUL" }
    const tx = {
      payment: {
        create: vi.fn().mockResolvedValue(created),
        findUniqueOrThrow: vi.fn().mockResolvedValue(payment),
      },
      notification: { create: vi.fn() },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const response = await POST(request(), {
      params: Promise.resolve({ id: "invoice-1" }),
    })

    expect(response.status).toBe(201)
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
      maxWait: 10_000,
      timeout: 30_000,
    })
    expect(tx.payment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        receiptNo: "RCT-TEST-001",
        invoiceId: "invoice-1",
        method: "CASH",
        status: "SUCCESSFUL",
        amount: 25,
        receivedById: "billing-officer-1",
      }),
    })
    expect(mocks.recalculateInvoice).toHaveBeenCalledWith(tx, "invoice-1")
    expect(mocks.audit).toHaveBeenCalled()
    expect(tx.notification.create).not.toHaveBeenCalled()
  })
})
