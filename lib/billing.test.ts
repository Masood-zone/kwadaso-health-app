import { describe, expect, it, vi } from "vitest"

import {
  BillingError,
  calculateInvoiceTotals,
  formatGhs,
  generateInvoiceNo,
  generateReceiptNo,
  recalculateInvoiceAfterPayments,
  toPesewas,
} from "@/lib/billing"

describe("billing money rules", () => {
  it("calculates item totals, discount, tax, and final total on the server", () => {
    const result = calculateInvoiceTotals(
      [
        {
          description: "Consultation",
          itemType: "CONSULTATION",
          quantity: 1,
          unitPrice: 150,
        },
        {
          description: "FBC",
          itemType: "LABORATORY",
          quantity: 2,
          unitPrice: 85.25,
        },
      ],
      20,
      5.5
    )
    expect(result).toMatchObject({
      subtotal: 320.5,
      discountAmount: 20,
      taxAmount: 5.5,
      totalAmount: 306,
    })
    expect(result.items[1].totalPrice).toBe(170.5)
  })

  it("uses integer pesewa rounding for decimal-safe calculations", () => {
    expect(toPesewas(0.1 + 0.2)).toBe(30)
    expect(
      calculateInvoiceTotals([
        { description: "Item", itemType: "OTHER", quantity: 3, unitPrice: 0.1 },
      ]).totalAmount
    ).toBe(0.3)
  })

  it("rejects a discount above the subtotal", () => {
    expect(() =>
      calculateInvoiceTotals(
        [
          {
            description: "Item",
            itemType: "OTHER",
            quantity: 1,
            unitPrice: 10,
          },
        ],
        10.01
      )
    ).toThrow(BillingError)
  })

  it("rejects zero-value invoices", () => {
    expect(() =>
      calculateInvoiceTotals([
        {
          description: "Unpriced service",
          itemType: "OTHER",
          quantity: 1,
          unitPrice: 0,
        },
      ])
    ).toThrow(BillingError)
  })

  it("formats only Ghana cedis for user-visible money", () => {
    expect(formatGhs(1234.5)).toBe("GH₵ 1,234.50")
    expect(formatGhs(0)).toBe("GH₵ 0.00")
  })

  it("generates distinct invoice and receipt namespaces", () => {
    expect(generateInvoiceNo("INV-KHIP")).toMatch(
      /^INV-KHIP-\d{14}-[A-F0-9]{6}$/
    )
    expect(generateReceiptNo("RCT-KHIP")).toMatch(
      /^RCT-KHIP-\d{14}-[A-F0-9]{6}$/
    )
  })
})

describe("invoice payment reconciliation", () => {
  it.each([
    [0, "ISSUED", 100],
    [40, "PARTIALLY_PAID", 60],
    [100, "PAID", 0],
  ])(
    "maps successful payment total %s to %s",
    async (paid, status, balance) => {
      const update = vi.fn().mockResolvedValue({ status, balanceDue: balance })
      const client = {
        invoice: {
          findUniqueOrThrow: vi
            .fn()
            .mockResolvedValue({ id: "invoice-1", totalAmount: 100 }),
          update,
        },
        payment: {
          aggregate: vi.fn().mockResolvedValue({ _sum: { amount: paid } }),
        },
      }
      await recalculateInvoiceAfterPayments(client as never, "invoice-1")
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "invoice-1" },
          data: expect.objectContaining({
            status,
            amountPaid: paid,
            balanceDue: balance,
          }),
        })
      )
    }
  )
})
