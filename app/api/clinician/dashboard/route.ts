import type { NextRequest } from "next/server"

import { serializeLabResult, serializeNotification, serializeQueue, clinicianQueueInclude, labResultInclude } from "@/lib/clinician-data"
import { endOfDay, notificationWhere, ok, priorityRank, startOfDay, withClinician } from "@/lib/clinician-route"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withClinician(request, async (actor) => {
    const today = startOfDay()
    const endToday = endOfDay()
    const [waiting, active, awaitingLab, prescriptionsToday, followUpsDue, criticalResults, referralsToday, completedToday, queue, results, notifications] = await Promise.all([
      prisma.patientQueue.count({ where: { department: { facilityId: actor.facilityId }, status: "WITH_CLINICIAN", OR: [{ assignedToId: actor.id }, { assignedToId: null }] } }),
      prisma.encounter.count({ where: { facilityId: actor.facilityId, clinicianId: actor.id, status: { in: ["DRAFT", "IN_PROGRESS", "AWAITING_LAB", "AWAITING_PHARMACY"] } } }),
      prisma.labRequest.count({ where: { requestedById: actor.id, status: { in: ["REQUESTED", "SAMPLE_COLLECTED", "PROCESSING", "PARTIAL_RESULT"] }, encounter: { facilityId: actor.facilityId } } }),
      prisma.prescription.count({ where: { prescribedById: actor.id, issuedAt: { gte: today, lte: endToday } } }),
      prisma.appointment.count({ where: { facilityId: actor.facilityId, clinicianId: actor.id, scheduledAt: { lte: endToday }, status: { in: ["SCHEDULED", "RESCHEDULED"] } } }),
      prisma.labResult.count({ where: { encounter: { facilityId: actor.facilityId, clinicianId: actor.id }, criticalFlag: true, status: { in: ["VALIDATED", "RELEASED"] } } }),
      prisma.referral.count({ where: { referredById: actor.id, createdAt: { gte: today, lte: endToday } } }),
      prisma.encounter.count({ where: { clinicianId: actor.id, facilityId: actor.facilityId, completedAt: { gte: today, lte: endToday } } }),
      prisma.patientQueue.findMany({ where: { department: { facilityId: actor.facilityId }, status: { in: ["WITH_CLINICIAN", "AWAITING_LAB", "AWAITING_PHARMACY"] }, OR: [{ assignedToId: actor.id }, { assignedToId: null }] }, include: clinicianQueueInclude, orderBy: [{ priority: "desc" }, { arrivedAt: "asc" }], take: 8 }),
      prisma.labResult.findMany({ where: { encounter: { facilityId: actor.facilityId, clinicianId: actor.id }, criticalFlag: true, status: { in: ["VALIDATED", "RELEASED"] } }, include: labResultInclude, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.notification.findMany({ where: notificationWhere(actor), orderBy: { createdAt: "desc" }, take: 5 }),
    ])
    return ok({
      facilityName: actor.facility.name,
      clinicianName: actor.name,
      metrics: [
        { label: "Waiting", value: waiting, detail: "Ready for consultation", tone: "orange" },
        { label: "Active encounters", value: active, detail: "Assigned to you", tone: "green" },
        { label: "Awaiting lab", value: awaitingLab, detail: "Open laboratory requests", tone: "orange" },
        { label: "Prescriptions today", value: prescriptionsToday, detail: "Issued today", tone: "blue" },
        { label: "Follow-ups due", value: followUpsDue, detail: "Scheduled through today", tone: "orange" },
        { label: "Critical results", value: criticalResults, detail: "Validated or released", tone: "red" },
        { label: "Referrals today", value: referralsToday, detail: "Created by you", tone: "blue" },
        { label: "Completed", value: completedToday, detail: "Consultations today", tone: "green" },
      ],
      queue: queue.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]).map((item) => serializeQueue(item, actor.id)),
      criticalResults: results.map(serializeLabResult),
      notifications: notifications.map(serializeNotification),
    })
  })
}

