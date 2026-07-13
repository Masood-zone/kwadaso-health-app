import type { NextRequest } from "next/server"

import { ensurePatientInFacility, invalidFields, writeClinicianAuditLog } from "@/lib/clinician"
import { ok, withClinician } from "@/lib/clinician-route"
import { messageSchema } from "@/lib/clinician-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

const include = {
  patient: true,
  participants: { include: { user: true } },
  messages: { include: { sender: true }, orderBy: { sentAt: "asc" as const } },
}

function serializeThread(thread: Awaited<ReturnType<typeof prisma.messageThread.findFirstOrThrow>>) {
  return thread
}

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => {
    const threads = await prisma.messageThread.findMany({ where: { participants: { some: { userId: actor.id } } }, include, orderBy: { updatedAt: "desc" } })
    return ok(threads.map((thread) => ({
      id: thread.id,
      subject: thread.subject,
      patientId: thread.patientId,
      patientName: thread.patient ? [thread.patient.firstName, thread.patient.otherNames, thread.patient.lastName].filter(Boolean).join(" ") : null,
      encounterId: thread.encounterId,
      priority: thread.priority,
      isClosed: thread.isClosed,
      participants: thread.participants.map((item) => ({ id: item.user.id, name: item.user.name, role: item.user.defaultRole })),
      messages: thread.messages.map((message) => ({ id: message.id, senderId: message.senderId, senderName: message.sender?.name ?? null, body: message.body, sentAt: message.sentAt.toISOString() })),
      updatedAt: thread.updatedAt.toISOString(),
    })))
  })
}

export async function POST(request: NextRequest) {
  return withClinician(request, async (actor) => {
    const parsed = messageSchema.safeParse(await request.json())
    if (!parsed.success) return invalidFields(parsed.error)
    const thread = await prisma.$transaction(async (tx) => {
      if (parsed.data.threadId) {
        const existing = await tx.messageThread.findFirst({ where: { id: parsed.data.threadId, isClosed: false, participants: { some: { userId: actor.id } } } })
        if (!existing) throw new Error("THREAD_NOT_FOUND")
        await tx.message.create({ data: { threadId: existing.id, senderId: actor.id, body: parsed.data.body } })
        await tx.messageThread.update({ where: { id: existing.id }, data: { updatedAt: new Date() } })
        await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.SEND, entityType: "MessageThread", entityId: existing.id, description: "Sent clinical message" })
        return existing
      }
      if (!parsed.data.subject) throw new Error("SUBJECT_REQUIRED")
      if (parsed.data.patientId && !(await ensurePatientInFacility(parsed.data.patientId, actor.facilityId, tx))) throw new Error("PATIENT_NOT_FOUND")
      if (parsed.data.encounterId && !(await tx.encounter.findFirst({ where: { id: parsed.data.encounterId, facilityId: actor.facilityId } }))) throw new Error("ENCOUNTER_NOT_FOUND")
      const participantIds = [...new Set([actor.id, ...parsed.data.participantIds])]
      const count = await tx.user.count({ where: { id: { in: participantIds }, facilityId: actor.facilityId, status: "ACTIVE" } })
      if (count !== participantIds.length) throw new Error("PARTICIPANT_NOT_FOUND")
      const created = await tx.messageThread.create({ data: { subject: parsed.data.subject, patientId: parsed.data.patientId, encounterId: parsed.data.encounterId, priority: parsed.data.priority, createdById: actor.id, participants: { create: participantIds.map((userId) => ({ userId })) }, messages: { create: { senderId: actor.id, body: parsed.data.body } } } })
      await writeClinicianAuditLog({ client: tx, request, actor, action: AuditAction.SEND, entityType: "MessageThread", entityId: created.id, description: `Created clinical message thread ${created.subject}` })
      return created
    })
    return ok(serializeThread(thread))
  })
}

