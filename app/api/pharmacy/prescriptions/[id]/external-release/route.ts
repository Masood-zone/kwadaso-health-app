import type { NextRequest } from "next/server"

import { AuditAction } from "@/lib/generated/prisma/enums"
import {
  ensurePharmacyPrescription,
  pharmacyOk,
  prescriptionScope,
  serializePrescriptionDetail,
  withPharmacy,
  writePharmacyAuditLog,
} from "@/lib/pharmacy"
import { prescriptionExternalReleaseSchema } from "@/lib/pharmacy-schemas"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return withPharmacy(request, async (actor) => {
    const { id } = await context.params
    const parsed = prescriptionExternalReleaseSchema.safeParse(
      await request.json()
    )
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          message: "Give a reason for releasing the prescription externally.",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      )
    }

    await prisma.$transaction(
      async (tx) => {
        const prescription = await ensurePharmacyPrescription(
          id,
          actor.facilityId,
          tx
        )
        if (!prescription) throw new Error("PRESCRIPTION_NOT_FOUND")
        if (!["ISSUED", "PARTIALLY_DISPENSED"].includes(prescription.status)) {
          throw new Error("PRESCRIPTION_LOCKED")
        }

        const dispensedByItem = new Map<string, number>()
        for (const dispensing of prescription.dispensings) {
          for (const item of dispensing.items) {
            if (!item.prescriptionItemId) continue
            dispensedByItem.set(
              item.prescriptionItemId,
              (dispensedByItem.get(item.prescriptionItemId) ?? 0) +
                item.quantityDispensed
            )
          }
        }
        const remainingItems = prescription.items
          .map((item) => ({
            prescriptionItemId: item.id,
            medicineName: item.medicineName,
            quantity: Math.max(
              0,
              (item.quantity ?? 0) - (dispensedByItem.get(item.id) ?? 0)
            ),
          }))
          .filter((item) => item.quantity > 0)
        if (!remainingItems.length) {
          throw new Error("PRESCRIPTION_ALREADY_FULFILLED")
        }

        const changed = await tx.prescription.updateMany({
          where: {
            id,
            status: prescription.status,
            ...prescriptionScope(actor.facilityId),
          },
          data: {
            status: "EXTERNALLY_RELEASED",
            externalReleaseReason: parsed.data.reason,
            externallyReleasedAt: new Date(),
            externallyReleasedById: actor.id,
          },
        })
        if (!changed.count) throw new Error("PRESCRIPTION_LOCKED")

        if (prescription.encounterId) {
          const encounter = await tx.encounter.updateMany({
            where: {
              id: prescription.encounterId,
              facilityId: actor.facilityId,
              status: "AWAITING_PHARMACY",
            },
            data: { status: "COMPLETED", completedAt: new Date() },
          })
          if (encounter.count && prescription.encounter?.queueId) {
            await tx.patientQueue.updateMany({
              where: {
                id: prescription.encounter.queueId,
                status: "AWAITING_PHARMACY",
              },
              data: { status: "COMPLETED", completedAt: new Date() },
            })
          }
        }

        if (prescription.prescribedById) {
          await tx.notification.create({
            data: {
              recipientId: prescription.prescribedById,
              facilityId: actor.facilityId,
              createdById: actor.id,
              type: "MESSAGE",
              priority: "NORMAL",
              title: `Prescription ${prescription.prescriptionNo} released externally`,
              body: parsed.data.reason,
              actionUrl: prescription.encounterId
                ? `/clinician/encounters/${prescription.encounterId}`
                : "/clinician/prescriptions",
              entityType: "Prescription",
              entityId: prescription.id,
            },
          })
        }

        await writePharmacyAuditLog({
          client: tx,
          request,
          actor,
          action: AuditAction.SEND,
          entityType: "Prescription",
          entityId: prescription.id,
          description: `Released the remaining items on ${prescription.prescriptionNo} for purchase from an external pharmacy`,
          before: { status: prescription.status },
          after: {
            status: "EXTERNALLY_RELEASED",
            reason: parsed.data.reason,
            remainingItems,
          },
        })
      },
      { maxWait: 5_000, timeout: 15_000 }
    )

    const updated = await ensurePharmacyPrescription(id, actor.facilityId)
    if (!updated) throw new Error("PRESCRIPTION_NOT_FOUND")
    return pharmacyOk(
      await serializePrescriptionDetail(updated),
      "Remaining prescription released for external purchase."
    )
  })
}
