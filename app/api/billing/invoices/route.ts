import type { NextRequest } from "next/server"

import type { Prisma } from "@/lib/generated/prisma/client"
import {
  billingInvoiceInclude,
  billingOk,
  calculateInvoiceTotals,
  dateRange,
  ensureBillingEncounter,
  ensureBillingPatient,
  generateInvoiceNo,
  getInvoicePrefix,
  invoiceScope,
  pageData,
  parsePagination,
  serializeInvoice,
  serializeInvoiceList,
  validateInvoiceSources,
  withBilling,
  writeBillingAuditLog,
} from "@/lib/billing"
import { invoiceCreateSchema } from "@/lib/billing-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const params = request.nextUrl.searchParams
    const { page, pageSize, skip } = parsePagination(params)
    const search = params.get("search")?.trim()
    const patient = params.get("patient")?.trim()
    const status = params.get("status")
    const encounterId = params.get("encounterId")
    const createdById = params.get("createdById")
    const departmentId = params.get("departmentId")
    const balance = params.get("balance")
    const where: Prisma.InvoiceWhereInput = {
      ...invoiceScope(actor.facilityId),
      ...dateRange(params, "createdAt"),
      ...(status ? { status: status as never } : {}),
      ...(encounterId ? { encounterId } : {}),
      ...(createdById ? { createdById } : {}),
      ...(departmentId ? { encounter: { departmentId } } : {}),
      ...(balance === "outstanding" ? { balanceDue: { gt: 0 } } : {}),
      ...(balance === "clear" ? { balanceDue: { lte: 0 } } : {}),
      ...(search || patient ? {
        OR: [
          ...(search ? [{ invoiceNo: { contains: search, mode: "insensitive" as const } }] : []),
          { patient: { OR: [
            { patientNo: { contains: patient || search, mode: "insensitive" } },
            { firstName: { contains: patient || search, mode: "insensitive" } },
            { lastName: { contains: patient || search, mode: "insensitive" } },
          ] } },
        ],
      } : {}),
    }
    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({ where, include: billingInvoiceInclude, orderBy: { createdAt: "desc" }, skip, take: pageSize }),
      prisma.invoice.count({ where }),
    ])
    return billingOk(pageData(rows.map(serializeInvoiceList), total, page, pageSize))
  })
}

export async function POST(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const parsed = invoiceCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ success: false, message: "Invoice details are invalid.", code: "VALIDATION_ERROR", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const prefix = await getInvoicePrefix()
    const created = await prisma.$transaction(async (tx) => {
      await ensureBillingPatient(parsed.data.patientId, actor.facilityId, tx)
      if (parsed.data.encounterId) await ensureBillingEncounter(parsed.data.encounterId, parsed.data.patientId, actor.facilityId, tx)
      await validateInvoiceSources(parsed.data.items, actor.facilityId, parsed.data.patientId, tx)
      const totals = calculateInvoiceTotals(parsed.data.items, parsed.data.discountAmount, parsed.data.taxAmount)
      const invoice = await tx.invoice.create({
        data: {
          invoiceNo: generateInvoiceNo(prefix),
          patientId: parsed.data.patientId,
          encounterId: parsed.data.encounterId,
          facilityId: actor.facilityId,
          status: "DRAFT",
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          taxAmount: totals.taxAmount,
          totalAmount: totals.totalAmount,
          amountPaid: 0,
          balanceDue: totals.totalAmount,
          notes: parsed.data.notes,
          createdById: actor.id,
          items: { create: totals.items.map((item) => ({ description: item.description, itemType: item.itemType, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice, referenceId: item.referenceId, sourceKey: item.sourceKey })) },
        },
        include: billingInvoiceInclude,
      })
      await writeBillingAuditLog({ client: tx, request, actor, action: AuditAction.CREATE, entityType: "Invoice", entityId: invoice.id, description: `Created draft invoice ${invoice.invoiceNo}`, after: { invoiceNo: invoice.invoiceNo, subtotal: totals.subtotal, discountAmount: totals.discountAmount, taxAmount: totals.taxAmount, totalAmount: totals.totalAmount, itemCount: totals.items.length } })
      return invoice
    })
    return billingOk(serializeInvoice(created), "Draft invoice created.", 201)
  })
}
