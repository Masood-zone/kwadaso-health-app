import type { NextRequest } from "next/server"
import { z } from "zod"

import {
  apiError,
  canTransitionEncounter,
  canTransitionQueue,
  ensureDepartmentInFacility,
  ensureMutableEncounter,
  ensurePatientInFacility,
  generateAppointmentNo,
  generateEncounterNo,
  generateLabRequestNo,
  generatePrescriptionNo,
  generateReferralNo,
  getAge,
  invalidFields,
  requireClinicianApi,
  writeClinicianAuditLog,
} from "@/lib/clinician"
import { reconcileEncounterAfterLaboratory } from "@/lib/laboratory"
import {
  clinicalNoteInclude,
  clinicianEncounterInclude,
  clinicianQueueInclude,
  diagnosisInclude,
  followUpInclude,
  getEncounterDetail,
  getPatientClinicalProfile,
  labRequestInclude,
  labResultInclude,
  prescriptionInclude,
  referralInclude,
  serializeDiagnosis,
  serializeEncounter,
  serializeFollowUp,
  serializeLabRequest,
  serializeLabResult,
  serializeNote,
  serializeNotification,
  serializePrescription,
  serializeQueue,
  serializeReferral,
} from "@/lib/clinician-data"
import {
  AuditAction,
  EncounterStatus,
  LabResultStatus,
  QueueStatus,
  type StaffRole,
} from "@/lib/generated/prisma/enums"
import type { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"

type RouteContext = { params: Promise<{ path?: string[] }> }

const encounterCreateSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().nullable().optional(),
  departmentId: z.string().min(1),
  visitType: z.enum([
    "OPD",
    "EMERGENCY",
    "FOLLOW_UP",
    "MATERNAL_CHILD_HEALTH",
    "IMMUNIZATION",
    "LAB_ONLY",
    "PHARMACY_ONLY",
    "REFERRAL",
  ]),
  chiefComplaint: z.string().trim().nullable().optional(),
  queueId: z.string().nullable().optional(),
})

const encounterUpdateSchema = z.object({
  departmentId: z.string().min(1).optional(),
  visitType: encounterCreateSchema.shape.visitType.optional(),
  chiefComplaint: z.string().trim().nullable().optional(),
  status: z
    .enum([
      "DRAFT",
      "IN_PROGRESS",
      "AWAITING_LAB",
      "AWAITING_PHARMACY",
      "CANCELLED",
    ])
    .optional(),
})

const noteSchema = z.object({
  subjective: z.string().trim().nullable().optional(),
  objective: z.string().trim().nullable().optional(),
  assessment: z.string().trim().nullable().optional(),
  plan: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  sign: z.boolean().optional(),
})

const diagnosisSchema = z.object({
  code: z.string().trim().nullable().optional(),
  name: z.string().trim().min(1),
  isPrimary: z.boolean().optional(),
  notes: z.string().trim().nullable().optional(),
})

const labRequestSchema = z.object({
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]),
  clinicalNotes: z.string().trim().nullable().optional(),
  tests: z
    .array(
      z.object({
        testId: z.string().min(1),
        notes: z.string().trim().nullable().optional(),
      })
    )
    .min(1),
})

const prescriptionItemSchema = z.object({
  medicationId: z.string().nullable().optional(),
  medicineName: z.string().trim().min(1),
  dosage: z.string().trim().nullable().optional(),
  frequency: z.string().trim().nullable().optional(),
  duration: z.string().trim().nullable().optional(),
  quantity: z.number().int().positive().nullable().optional(),
  instructions: z.string().trim().nullable().optional(),
})

const prescriptionSchema = z.object({
  status: z.enum(["DRAFT", "ISSUED"]),
  notes: z.string().trim().nullable().optional(),
  items: z.array(prescriptionItemSchema).min(1),
})

const followUpSchema = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480),
  departmentId: z.string().min(1),
  clinicianId: z.string().nullable().optional(),
  title: z.string().trim().nullable().optional(),
  reason: z.string().trim().min(1),
})

const referralSchema = z.object({
  toDepartmentId: z.string().nullable().optional(),
  toFacilityId: z.string().nullable().optional(),
  reason: z.string().trim().min(1),
  clinicalSummary: z.string().trim().nullable().optional(),
  urgency: z.enum(["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"]),
})

const queueUpdateSchema = z.object({
  status: z.enum([
    "WITH_CLINICIAN",
    "AWAITING_LAB",
    "AWAITING_PHARMACY",
    "COMPLETED",
    "CANCELLED",
  ]),
  notes: z.string().trim().nullable().optional(),
  cancellationReason: z.string().trim().nullable().optional(),
})

const messageSchema = z.object({
  threadId: z.string().optional(),
  subject: z.string().trim().min(1).optional(),
  patientId: z.string().nullable().optional(),
  encounterId: z.string().nullable().optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  participantIds: z.array(z.string()).default([]),
  body: z.string().trim().min(1),
})

function ok(data: unknown, message?: string) {
  return Response.json({ success: true, data, ...(message ? { message } : {}) })
}

function startOfDay(value = new Date()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(value = new Date()) {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

const priorityRank = { EMERGENCY: 4, URGENT: 3, PRIORITY: 2, ROUTINE: 1 }

async function getDashboard(
  actor: NonNullable<Awaited<ReturnType<typeof requireClinicianApi>>["staff"]>
) {
  const today = startOfDay()
  const endToday = endOfDay()
  const activeEncounterStatuses = [
    "DRAFT",
    "IN_PROGRESS",
    "AWAITING_LAB",
    "AWAITING_PHARMACY",
  ] as const
  const [
    waiting,
    active,
    awaitingLab,
    prescriptionsToday,
    followUpsDue,
    criticalResults,
    referralsToday,
    completedToday,
    queue,
    results,
    notifications,
  ] = await Promise.all([
    prisma.patientQueue.count({
      where: {
        department: { facilityId: actor.facilityId },
        status: "WITH_CLINICIAN",
        OR: [{ assignedToId: actor.id }, { assignedToId: null }],
      },
    }),
    prisma.encounter.count({
      where: {
        facilityId: actor.facilityId,
        clinicianId: actor.id,
        status: { in: [...activeEncounterStatuses] },
      },
    }),
    prisma.labRequest.count({
      where: {
        requestedById: actor.id,
        status: {
          in: ["REQUESTED", "SAMPLE_COLLECTED", "PROCESSING", "PARTIAL_RESULT"],
        },
        encounter: { facilityId: actor.facilityId },
      },
    }),
    prisma.prescription.count({
      where: {
        prescribedById: actor.id,
        issuedAt: { gte: today, lte: endToday },
      },
    }),
    prisma.appointment.count({
      where: {
        facilityId: actor.facilityId,
        clinicianId: actor.id,
        scheduledAt: { lte: endToday },
        status: { in: ["SCHEDULED", "RESCHEDULED"] },
      },
    }),
    prisma.labResult.count({
      where: {
        encounter: { facilityId: actor.facilityId, clinicianId: actor.id },
        criticalFlag: true,
        status: { in: ["VALIDATED", "RELEASED"] },
      },
    }),
    prisma.referral.count({
      where: {
        referredById: actor.id,
        createdAt: { gte: today, lte: endToday },
      },
    }),
    prisma.encounter.count({
      where: {
        clinicianId: actor.id,
        facilityId: actor.facilityId,
        completedAt: { gte: today, lte: endToday },
      },
    }),
    prisma.patientQueue.findMany({
      where: {
        department: { facilityId: actor.facilityId },
        status: { in: ["WITH_CLINICIAN", "AWAITING_LAB", "AWAITING_PHARMACY"] },
        OR: [{ assignedToId: actor.id }, { assignedToId: null }],
      },
      include: clinicianQueueInclude,
      orderBy: [{ priority: "desc" }, { arrivedAt: "asc" }],
      take: 8,
    }),
    prisma.labResult.findMany({
      where: {
        encounter: { facilityId: actor.facilityId, clinicianId: actor.id },
        criticalFlag: true,
        status: { in: ["VALIDATED", "RELEASED"] },
      },
      include: labResultInclude,
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.notification.findMany({
      where: notificationWhere(actor),
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  return {
    facilityName: actor.facility.name,
    clinicianName: actor.name,
    metrics: [
      {
        label: "Waiting",
        value: waiting,
        detail: "Ready for consultation",
        tone: "orange",
      },
      {
        label: "Active encounters",
        value: active,
        detail: "Assigned to you",
        tone: "green",
      },
      {
        label: "Awaiting lab",
        value: awaitingLab,
        detail: "Open laboratory requests",
        tone: "orange",
      },
      {
        label: "Prescriptions today",
        value: prescriptionsToday,
        detail: "Issued today",
        tone: "blue",
      },
      {
        label: "Follow-ups due",
        value: followUpsDue,
        detail: "Scheduled through today",
        tone: "orange",
      },
      {
        label: "Critical results",
        value: criticalResults,
        detail: "Validated or released",
        tone: "red",
      },
      {
        label: "Referrals today",
        value: referralsToday,
        detail: "Created by you",
        tone: "blue",
      },
      {
        label: "Completed",
        value: completedToday,
        detail: "Consultations today",
        tone: "green",
      },
    ],
    queue: queue
      .sort((left, right) => priorityRank[right.priority] - priorityRank[left.priority])
      .map((item) => serializeQueue(item, actor.id)),
    criticalResults: results.map(serializeLabResult),
    notifications: notifications.map(serializeNotification),
  }
}

function notificationWhere(actor: {
  id: string
  facilityId: string
  defaultRole: StaffRole
  departmentId: string | null
}): Prisma.NotificationWhereInput {
  return {
    OR: [
      { recipientId: actor.id },
      {
        facilityId: actor.facilityId,
        recipientId: null,
        targetRole: actor.defaultRole,
      },
      ...(actor.departmentId
        ? [
            {
              facilityId: actor.facilityId,
              recipientId: null,
              targetDepartmentId: actor.departmentId,
            },
          ]
        : []),
    ],
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { staff: actor, response } = await requireClinicianApi(request)
  if (response) return response
  const path = (await context.params).path ?? []
  const [resource, id, child] = path

  if (resource === "dashboard") return ok(await getDashboard(actor!))

  if (resource === "lookups") {
    const [departments, clinicians, staff, labTests, medications, facilities] =
      await Promise.all([
        prisma.department.findMany({
          where: { facilityId: actor!.facilityId, isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          where: {
            facilityId: actor!.facilityId,
            status: "ACTIVE",
            defaultRole: { in: ["DOCTOR", "PHYSICIAN_ASSISTANT"] },
          },
          orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          where: { facilityId: actor!.facilityId, status: "ACTIVE" },
          orderBy: { name: "asc" },
        }),
        prisma.labTestCatalog.findMany({
          where: { facilityId: actor!.facilityId, isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.medication.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
        }),
        prisma.facility.findMany({ orderBy: { name: "asc" } }),
      ])
    return ok({
      departments: departments.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
      })),
      clinicians: clinicians.map((item) => ({
        id: item.id,
        name: item.name,
        role: item.defaultRole,
        departmentId: item.departmentId,
      })),
      staff: staff.map((item) => ({
        id: item.id,
        name: item.name,
        role: item.defaultRole,
        departmentId: item.departmentId,
      })),
      labTests: labTests.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        sampleType: item.sampleType,
      })),
      medications: medications.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        genericName: item.genericName,
        strength: item.strength,
        dosageForm: item.dosageForm,
      })),
      facilities: facilities.map((item) => ({ id: item.id, name: item.name })),
    })
  }

  if (resource === "consultation-queue") {
    const status = request.nextUrl.searchParams.get("status")
    const priority = request.nextUrl.searchParams.get("priority")
    const departmentId = request.nextUrl.searchParams.get("departmentId")
    const search = request.nextUrl.searchParams.get("search")?.trim()
    const queueNo = request.nextUrl.searchParams.get("queueNo")?.trim()
    const date = request.nextUrl.searchParams.get("date")
    const entries = await prisma.patientQueue.findMany({
      where: {
        department: { facilityId: actor!.facilityId },
        status: status
          ? (status as QueueStatus)
          : { in: ["WITH_CLINICIAN", "AWAITING_LAB"] },
        OR: [{ assignedToId: actor!.id }, { assignedToId: null }],
        ...(priority ? { priority: priority as never } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(queueNo
          ? { queueNo: { contains: queueNo, mode: "insensitive" } }
          : {}),
        ...(date
          ? {
              arrivedAt: {
                gte: startOfDay(new Date(date)),
                lte: endOfDay(new Date(date)),
              },
            }
          : {}),
        ...(search
          ? {
              patient: {
                OR: [
                  {
                    patientNo: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    firstName: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    lastName: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              },
            }
          : {}),
      },
      include: clinicianQueueInclude,
      orderBy: [{ priority: "desc" }, { arrivedAt: "asc" }],
    })
    return ok(
      entries
        .sort(
          (left, right) => priorityRank[right.priority] - priorityRank[left.priority]
        )
        .map((item) => serializeQueue(item, actor!.id))
    )
  }

  if (resource === "patients" && id && child === "clinical-profile") {
    const profile = await getPatientClinicalProfile(
      id,
      actor!.facilityId,
      actor!.id
    )
    if (!profile) return apiError("Patient was not found.", 404)
    await writeClinicianAuditLog({
      request,
      actor: actor!,
      action: AuditAction.READ,
      entityType: "PatientClinicalProfile",
      entityId: id,
      description: `Clinician viewed clinical profile ${profile.patientNo}`,
    })
    return ok(profile)
  }

  if (resource === "patients" && !id) {
    const search = request.nextUrl.searchParams.get("search")?.trim()
    const patients = await prisma.patient.findMany({
      where: {
        registeredFacilityId: actor!.facilityId,
        status: "ACTIVE",
        ...(search
          ? {
              OR: [
                { patientNo: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        encounters: { orderBy: { startedAt: "desc" }, take: 1 },
        queueEntries: {
          where: {
            status: {
              in: [
                "IN_TRIAGE",
                "WITH_CLINICIAN",
                "AWAITING_LAB",
                "AWAITING_PHARMACY",
              ],
            },
          },
          orderBy: { arrivedAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 100,
    })
    return ok(
      patients.map((patient) => ({
        id: patient.id,
        patientNo: patient.patientNo,
        name: [patient.firstName, patient.otherNames, patient.lastName]
          .filter(Boolean)
          .join(" "),
        gender: patient.gender,
        age: getAge(patient.dateOfBirth, patient.estimatedAge),
        phone: patient.phone,
        community: patient.community,
        latestEncounterStatus: patient.encounters[0]?.status ?? null,
        activeQueueStatus: patient.queueEntries[0]?.status ?? null,
      }))
    )
  }

  if (resource === "encounters" && id) {
    const detail = await getEncounterDetail(id, actor!.facilityId, actor!.id)
    if (!detail) return apiError("Encounter was not found.", 404)
    if (child === "clinical-notes") return ok(detail.clinicalNotes)
    if (child === "diagnoses") return ok(detail.diagnoses)
    return ok(detail)
  }

  if (resource === "encounters") {
    const status = request.nextUrl.searchParams.get("status")
    const encounters = await prisma.encounter.findMany({
      where: {
        facilityId: actor!.facilityId,
        ...(status ? { status: status as EncounterStatus } : {}),
      },
      include: clinicianEncounterInclude,
      orderBy: { startedAt: "desc" },
      take: 200,
    })
    return ok(encounters.map((item) => serializeEncounter(item, actor!.id)))
  }

  if (resource === "lab-requests") {
    const record = id
      ? await prisma.labRequest.findFirst({
          where: { id, encounter: { facilityId: actor!.facilityId } },
          include: labRequestInclude,
        })
      : null
    if (id)
      return record
        ? ok(serializeLabRequest(record))
        : apiError("Lab request was not found.", 404)
    const rows = await prisma.labRequest.findMany({
      where: { encounter: { facilityId: actor!.facilityId } },
      include: labRequestInclude,
      orderBy: { requestedAt: "desc" },
    })
    return ok(rows.map(serializeLabRequest))
  }

  if (resource === "lab-results") {
    const where: Prisma.LabResultWhereInput = {
      encounter: { facilityId: actor!.facilityId },
      status: LabResultStatus.RELEASED,
    }
    if (id) {
      const record = await prisma.labResult.findFirst({
        where: { id, ...where },
        include: labResultInclude,
      })
      if (!record) return apiError("Released lab result was not found.", 404)
      await writeClinicianAuditLog({
        request,
        actor: actor!,
        action: AuditAction.READ,
        entityType: "LabResult",
        entityId: id,
        description: `Clinician reviewed result ${record.resultNo}`,
      })
      return ok(serializeLabResult(record))
    }
    const rows = await prisma.labResult.findMany({
      where,
      include: labResultInclude,
      orderBy: { createdAt: "desc" },
    })
    return ok(rows.map(serializeLabResult))
  }

  if (resource === "prescriptions") {
    if (id) {
      const record = await prisma.prescription.findFirst({
        where: { id, encounter: { facilityId: actor!.facilityId } },
        include: prescriptionInclude,
      })
      return record
        ? ok(serializePrescription(record))
        : apiError("Prescription was not found.", 404)
    }
    const rows = await prisma.prescription.findMany({
      where: { encounter: { facilityId: actor!.facilityId } },
      include: prescriptionInclude,
      orderBy: { createdAt: "desc" },
    })
    return ok(rows.map(serializePrescription))
  }

  if (resource === "referrals") {
    if (id) {
      const record = await prisma.referral.findFirst({
        where: { id, fromFacilityId: actor!.facilityId },
        include: referralInclude,
      })
      return record
        ? ok(serializeReferral(record))
        : apiError("Referral was not found.", 404)
    }
    const rows = await prisma.referral.findMany({
      where: { fromFacilityId: actor!.facilityId },
      include: referralInclude,
      orderBy: { createdAt: "desc" },
    })
    return ok(rows.map(serializeReferral))
  }

  if (resource === "follow-ups") {
    const rows = await prisma.appointment.findMany({
      where: {
        facilityId: actor!.facilityId,
        scheduledAt: { gte: startOfDay() },
        createdBy: {
          defaultRole: { in: ["DOCTOR", "PHYSICIAN_ASSISTANT"] },
        },
      },
      include: followUpInclude,
      orderBy: { scheduledAt: "asc" },
    })
    return ok(rows.map(serializeFollowUp))
  }

  if (resource === "messages") {
    const threads = await prisma.messageThread.findMany({
      where: { participants: { some: { userId: actor!.id } } },
      include: {
        patient: true,
        participants: { include: { user: true } },
        messages: { include: { sender: true }, orderBy: { sentAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    })
    return ok(
      threads.map((thread) => ({
        id: thread.id,
        subject: thread.subject,
        patientId: thread.patientId,
        patientName: thread.patient
          ? [
              thread.patient.firstName,
              thread.patient.otherNames,
              thread.patient.lastName,
            ]
              .filter(Boolean)
              .join(" ")
          : null,
        encounterId: thread.encounterId,
        priority: thread.priority,
        isClosed: thread.isClosed,
        participants: thread.participants.map((item) => ({
          id: item.user.id,
          name: item.user.name,
          role: item.user.defaultRole,
        })),
        messages: thread.messages.map((message) => ({
          id: message.id,
          senderId: message.senderId,
          senderName: message.sender?.name ?? null,
          body: message.body,
          sentAt: message.sentAt.toISOString(),
        })),
        updatedAt: thread.updatedAt.toISOString(),
      }))
    )
  }

  if (resource === "notifications") {
    const rows = await prisma.notification.findMany({
      where: notificationWhere(actor!),
      orderBy: { createdAt: "desc" },
      take: 100,
    })
    return ok(rows.map(serializeNotification))
  }

  return apiError("Clinician resource was not found.", 404)
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { staff: actor, response } = await requireClinicianApi(request)
  if (response) return response
  const path = (await context.params).path ?? []
  const [resource, id, child] = path
  const body: unknown = await request.json()

  try {
    if (resource === "encounters" && !id) {
      const parsed = encounterCreateSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const values = parsed.data
      const encounter = await prisma.$transaction(async (tx) => {
        const patient = await ensurePatientInFacility(
          values.patientId,
          actor!.facilityId,
          tx
        )
        if (!patient) throw new Error("PATIENT_NOT_FOUND")
        const department = await ensureDepartmentInFacility(
          values.departmentId,
          actor!.facilityId,
          tx
        )
        if (!department) throw new Error("DEPARTMENT_NOT_FOUND")
        if (values.appointmentId) {
          const appointment = await tx.appointment.findFirst({
            where: {
              id: values.appointmentId,
              patientId: values.patientId,
              facilityId: actor!.facilityId,
            },
          })
          if (!appointment) throw new Error("APPOINTMENT_NOT_FOUND")
        }
        if (values.queueId) {
          const queue = await tx.patientQueue.findFirst({
            where: {
              id: values.queueId,
              patientId: values.patientId,
              department: { facilityId: actor!.facilityId },
            },
          })
          if (!queue) throw new Error("QUEUE_NOT_FOUND")
          if (
            !["IN_TRIAGE", "WITH_CLINICIAN", "AWAITING_LAB"].includes(
              queue.status
            )
          )
            throw new Error("QUEUE_NOT_READY")
          const claimed = await tx.patientQueue.updateMany({
            where: {
              id: queue.id,
              OR: [{ assignedToId: null }, { assignedToId: actor!.id }],
            },
            data: {
              assignedToId: actor!.id,
              status: "WITH_CLINICIAN",
              calledAt: queue.calledAt ?? new Date(),
            },
          })
          if (claimed.count !== 1) throw new Error("QUEUE_CLAIMED")
        }
        const created = await tx.encounter.create({
          data: {
            encounterNo: generateEncounterNo(),
            patientId: values.patientId,
            appointmentId: values.appointmentId ?? null,
            queueId: values.queueId ?? null,
            facilityId: actor!.facilityId,
            departmentId: values.departmentId,
            clinicianId: actor!.id,
            visitType: values.visitType,
            chiefComplaint: values.chiefComplaint,
            status: "IN_PROGRESS",
            startedAt: new Date(),
          },
          include: clinicianEncounterInclude,
        })
        if (values.appointmentId)
          await tx.appointment.update({
            where: { id: values.appointmentId },
            data: { status: "IN_PROGRESS", clinicianId: actor!.id },
          })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: AuditAction.CREATE,
          entityType: "Encounter",
          entityId: created.id,
          description: `Started encounter ${created.encounterNo}`,
          after: {
            patientId: created.patientId,
            queueId: created.queueId,
            status: created.status,
          },
        })
        return created
      })
      return ok(
        serializeEncounter(encounter, actor!.id),
        "Consultation started."
      )
    }

    if (resource === "encounters" && id && child === "clinical-notes") {
      const parsed = noteSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const note = await prisma.$transaction(async (tx) => {
        const checked = await ensureMutableEncounter(id, actor!, tx)
        if (checked.error || !checked.encounter)
          throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
        const { sign, ...noteValues } = parsed.data
        const created = await tx.clinicalNote.create({
          data: {
            patientId: checked.encounter.patientId,
            encounterId: id,
            authoredById: actor!.id,
            ...noteValues,
            signedAt: sign ? new Date() : null,
          },
          include: clinicalNoteInclude,
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: parsed.data.sign ? AuditAction.APPROVE : AuditAction.CREATE,
          entityType: "ClinicalNote",
          entityId: created.id,
          description: parsed.data.sign
            ? "Created and signed clinical note"
            : "Created clinical note draft",
          after: {
            encounterId: id,
            signedAt: created.signedAt?.toISOString() ?? null,
          },
        })
        return created
      })
      return ok(serializeNote(note))
    }

    if (resource === "encounters" && id && child === "diagnoses") {
      const parsed = diagnosisSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const diagnosis = await prisma.$transaction(async (tx) => {
        const checked = await ensureMutableEncounter(id, actor!, tx)
        if (checked.error || !checked.encounter)
          throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
        if (parsed.data.isPrimary)
          await tx.diagnosis.updateMany({
            where: { encounterId: id, isPrimary: true },
            data: { isPrimary: false },
          })
        const created = await tx.diagnosis.create({
          data: {
            ...parsed.data,
            patientId: checked.encounter.patientId,
            encounterId: id,
            diagnosedById: actor!.id,
          },
          include: diagnosisInclude,
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: AuditAction.CREATE,
          entityType: "Diagnosis",
          entityId: created.id,
          description: `Added diagnosis ${created.name}`,
          after: {
            encounterId: id,
            code: created.code,
            isPrimary: created.isPrimary,
          },
        })
        return created
      })
      return ok(serializeDiagnosis(diagnosis))
    }

    if (resource === "encounters" && id && child === "lab-requests") {
      const parsed = labRequestSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const record = await prisma.$transaction(async (tx) => {
        const checked = await ensureMutableEncounter(id, actor!, tx)
        if (checked.error || !checked.encounter)
          throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
        const tests = await tx.labTestCatalog.count({
          where: {
            id: { in: parsed.data.tests.map((item) => item.testId) },
            facilityId: actor!.facilityId,
            isActive: true,
          },
        })
        if (
          tests !== new Set(parsed.data.tests.map((item) => item.testId)).size
        )
          throw new Error("LAB_TEST_NOT_FOUND")
        const created = await tx.labRequest.create({
          data: {
            requestNo: generateLabRequestNo(),
            patientId: checked.encounter.patientId,
            encounterId: id,
            requestedById: actor!.id,
            priority: parsed.data.priority,
            clinicalNotes: parsed.data.clinicalNotes,
            status: "REQUESTED",
            tests: {
              create: parsed.data.tests.map((item) => ({
                testId: item.testId,
                notes: item.notes,
              })),
            },
          },
          include: labRequestInclude,
        })
        await tx.encounter.update({
          where: { id },
          data: { status: "AWAITING_LAB" },
        })
        if (checked.encounter.queueId)
          await tx.patientQueue.update({
            where: { id: checked.encounter.queueId },
            data: { status: "AWAITING_LAB" },
          })
        await tx.notification.createMany({
          data: [
            {
              facilityId: actor!.facilityId,
              createdById: actor!.id,
              targetRole: "LAB_TECHNICIAN",
              type: "LAB_RESULT",
              priority: parsed.data.priority === "STAT" ? "URGENT" : "NORMAL",
              title: `New lab request ${created.requestNo}`,
              body: created.clinicalNotes,
              actionUrl: `/laboratory/requests/${created.id}`,
              entityType: "LabRequest",
              entityId: created.id,
            },
          ],
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: AuditAction.CREATE,
          entityType: "LabRequest",
          entityId: created.id,
          description: `Created lab request ${created.requestNo}`,
          after: {
            encounterId: id,
            priority: created.priority,
            testCount: created.tests.length,
          },
        })
        return created
      })
      return ok(serializeLabRequest(record))
    }

    if (resource === "encounters" && id && child === "prescriptions") {
      const parsed = prescriptionSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const record = await prisma.$transaction(async (tx) => {
        const checked = await ensureMutableEncounter(id, actor!, tx)
        if (checked.error || !checked.encounter)
          throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
        const created = await tx.prescription.create({
          data: {
            prescriptionNo: generatePrescriptionNo(),
            patientId: checked.encounter.patientId,
            encounterId: id,
            prescribedById: actor!.id,
            status: parsed.data.status,
            notes: parsed.data.notes,
            issuedAt: parsed.data.status === "ISSUED" ? new Date() : null,
            items: { create: parsed.data.items },
          },
          include: prescriptionInclude,
        })
        if (created.status === "ISSUED") {
          await tx.encounter.update({
            where: { id },
            data: { status: "AWAITING_PHARMACY" },
          })
          if (checked.encounter.queueId)
            await tx.patientQueue.update({
              where: { id: checked.encounter.queueId },
              data: { status: "AWAITING_PHARMACY" },
            })
          await tx.notification.create({
            data: {
              facilityId: actor!.facilityId,
              createdById: actor!.id,
              targetRole: "PHARMACIST",
              type: "MESSAGE",
              title: `Prescription ${created.prescriptionNo} ready`,
              actionUrl: `/pharmacy/prescriptions/${created.id}`,
              entityType: "Prescription",
              entityId: created.id,
            },
          })
        }
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: AuditAction.CREATE,
          entityType: "Prescription",
          entityId: created.id,
          description: `${created.status === "ISSUED" ? "Issued" : "Drafted"} prescription ${created.prescriptionNo}`,
          after: {
            encounterId: id,
            status: created.status,
            itemCount: created.items.length,
          },
        })
        return created
      })
      return ok(serializePrescription(record))
    }

    if (resource === "encounters" && id && child === "follow-up") {
      const parsed = followUpSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const record = await prisma.$transaction(async (tx) => {
        const checked = await ensureMutableEncounter(id, actor!, tx)
        if (checked.error || !checked.encounter)
          throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
        if (
          !(await ensureDepartmentInFacility(
            parsed.data.departmentId,
            actor!.facilityId,
            tx
          ))
        )
          throw new Error("DEPARTMENT_NOT_FOUND")
        if (parsed.data.clinicianId) {
          const clinician = await tx.user.findFirst({
            where: {
              id: parsed.data.clinicianId,
              facilityId: actor!.facilityId,
              status: "ACTIVE",
              defaultRole: { in: ["DOCTOR", "PHYSICIAN_ASSISTANT"] },
            },
          })
          if (!clinician) throw new Error("CLINICIAN_NOT_FOUND")
        }
        const created = await tx.appointment.create({
          data: {
            appointmentNo: generateAppointmentNo(),
            patientId: checked.encounter.patientId,
            facilityId: actor!.facilityId,
            departmentId: parsed.data.departmentId,
            clinicianId: parsed.data.clinicianId ?? actor!.id,
            title: parsed.data.title ?? "Clinical follow-up",
            reason: parsed.data.reason,
            scheduledAt: new Date(parsed.data.scheduledAt),
            durationMinutes: parsed.data.durationMinutes,
            status: "SCHEDULED",
            createdById: actor!.id,
          },
          include: followUpInclude,
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: AuditAction.CREATE,
          entityType: "Appointment",
          entityId: created.id,
          description: `Scheduled follow-up ${created.appointmentNo}`,
          after: {
            encounterId: id,
            scheduledAt: created.scheduledAt.toISOString(),
          },
        })
        return created
      })
      return ok(serializeFollowUp(record))
    }

    if (resource === "encounters" && id && child === "referrals") {
      const parsed = referralSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      if (!parsed.data.toDepartmentId && !parsed.data.toFacilityId)
        return apiError(
          "Choose an internal department or schema-backed facility."
        )
      const record = await prisma.$transaction(async (tx) => {
        const checked = await ensureMutableEncounter(id, actor!, tx)
        if (checked.error || !checked.encounter)
          throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
        if (
          parsed.data.toDepartmentId &&
          !(await ensureDepartmentInFacility(
            parsed.data.toDepartmentId,
            actor!.facilityId,
            tx
          ))
        )
          throw new Error("DEPARTMENT_NOT_FOUND")
        if (
          parsed.data.toFacilityId &&
          !(await tx.facility.findUnique({
            where: { id: parsed.data.toFacilityId },
          }))
        )
          throw new Error("FACILITY_NOT_FOUND")
        const created = await tx.referral.create({
          data: {
            referralNo: generateReferralNo(),
            patientId: checked.encounter.patientId,
            encounterId: id,
            fromFacilityId: actor!.facilityId,
            toFacilityId: parsed.data.toFacilityId,
            fromDepartmentId: checked.encounter.departmentId,
            toDepartmentId: parsed.data.toDepartmentId,
            referredById: actor!.id,
            reason: parsed.data.reason,
            clinicalSummary: parsed.data.clinicalSummary,
            urgency: parsed.data.urgency,
            status: "SENT",
            sentAt: new Date(),
          },
          include: referralInclude,
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: AuditAction.SEND,
          entityType: "Referral",
          entityId: created.id,
          description: `Sent referral ${created.referralNo}`,
          after: {
            encounterId: id,
            toDepartmentId: created.toDepartmentId,
            toFacilityId: created.toFacilityId,
          },
        })
        return created
      })
      return ok(serializeReferral(record))
    }

    if (resource === "encounters" && id && child === "complete") {
      const acknowledgement = z
        .object({ acknowledged: z.literal(true) })
        .safeParse(body)
      if (!acknowledgement.success)
        return apiError("Legal record acknowledgement is required.")
      const completed = await prisma.$transaction(async (tx) => {
        const checked = await ensureMutableEncounter(id, actor!, tx)
        if (checked.error || !checked.encounter)
          throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
        const [signedNote, primaryDiagnosis] = await Promise.all([
          tx.clinicalNote.findFirst({
            where: { encounterId: id, signedAt: { not: null } },
          }),
          tx.diagnosis.findFirst({
            where: { encounterId: id, isPrimary: true },
          }),
        ])
        if (!signedNote) throw new Error("SIGNED_NOTE_REQUIRED")
        if (!primaryDiagnosis) throw new Error("PRIMARY_DIAGNOSIS_REQUIRED")
        const record = await tx.encounter.update({
          where: { id },
          data: { status: "COMPLETED", completedAt: new Date() },
          include: clinicianEncounterInclude,
        })
        if (record.queueId)
          await tx.patientQueue.update({
            where: { id: record.queueId },
            data: { status: "COMPLETED", completedAt: new Date() },
          })
        if (record.appointmentId)
          await tx.appointment.update({
            where: { id: record.appointmentId },
            data: { status: "COMPLETED" },
          })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: AuditAction.APPROVE,
          entityType: "Encounter",
          entityId: id,
          description: `Completed and locked encounter ${record.encounterNo}`,
          before: { status: checked.encounter.status },
          after: {
            status: record.status,
            completedAt: record.completedAt?.toISOString(),
          },
        })
        return record
      })
      return ok(
        serializeEncounter(completed, actor!.id),
        "Encounter completed and locked."
      )
    }

    if (resource === "messages") {
      const parsed = messageSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const thread = await prisma.$transaction(async (tx) => {
        if (parsed.data.threadId) {
          const existing = await tx.messageThread.findFirst({
            where: {
              id: parsed.data.threadId,
              isClosed: false,
              participants: { some: { userId: actor!.id } },
            },
          })
          if (!existing) throw new Error("THREAD_NOT_FOUND")
          await tx.message.create({
            data: {
              threadId: existing.id,
              senderId: actor!.id,
              body: parsed.data.body,
            },
          })
          await tx.messageThread.update({
            where: { id: existing.id },
            data: { updatedAt: new Date() },
          })
          await writeClinicianAuditLog({
            client: tx,
            request,
            actor: actor!,
            action: AuditAction.SEND,
            entityType: "MessageThread",
            entityId: existing.id,
            description: "Sent clinical message",
          })
          return existing
        }
        if (!parsed.data.subject) throw new Error("SUBJECT_REQUIRED")
        if (
          parsed.data.patientId &&
          !(await ensurePatientInFacility(
            parsed.data.patientId,
            actor!.facilityId,
            tx
          ))
        )
          throw new Error("PATIENT_NOT_FOUND")
        if (parsed.data.encounterId) {
          const encounter = await tx.encounter.findFirst({
            where: {
              id: parsed.data.encounterId,
              facilityId: actor!.facilityId,
            },
          })
          if (!encounter) throw new Error("ENCOUNTER_NOT_FOUND")
        }
        const participantIds = [
          ...new Set([actor!.id, ...parsed.data.participantIds]),
        ]
        const staffCount = await tx.user.count({
          where: {
            id: { in: participantIds },
            facilityId: actor!.facilityId,
            status: "ACTIVE",
          },
        })
        if (staffCount !== participantIds.length)
          throw new Error("PARTICIPANT_NOT_FOUND")
        const created = await tx.messageThread.create({
          data: {
            subject: parsed.data.subject,
            patientId: parsed.data.patientId,
            encounterId: parsed.data.encounterId,
            priority: parsed.data.priority,
            createdById: actor!.id,
            participants: {
              create: participantIds.map((userId) => ({ userId })),
            },
            messages: {
              create: { senderId: actor!.id, body: parsed.data.body },
            },
          },
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: AuditAction.SEND,
          entityType: "MessageThread",
          entityId: created.id,
          description: `Created clinical message thread ${created.subject}`,
        })
        return created
      })
      return ok(thread)
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Clinical action failed."
    const known: Record<string, string> = {
      PATIENT_NOT_FOUND: "Patient was not found in this facility.",
      DEPARTMENT_NOT_FOUND: "Department was not found in this facility.",
      APPOINTMENT_NOT_FOUND: "Appointment was not found in this facility.",
      QUEUE_NOT_FOUND: "Queue item was not found.",
      QUEUE_NOT_READY: "Queue item is not ready for consultation.",
      QUEUE_CLAIMED: "Another clinician has already claimed this patient.",
      LAB_TEST_NOT_FOUND: "One or more laboratory tests are unavailable.",
      CLINICIAN_NOT_FOUND: "Selected clinician is unavailable.",
      FACILITY_NOT_FOUND: "Referral facility was not found.",
      SIGNED_NOTE_REQUIRED:
        "Sign at least one clinical note before completing the encounter.",
      PRIMARY_DIAGNOSIS_REQUIRED:
        "Add a primary diagnosis before completing the encounter.",
      THREAD_NOT_FOUND: "Message thread was not found or is closed.",
      SUBJECT_REQUIRED: "A subject is required for a new message thread.",
      PARTICIPANT_NOT_FOUND:
        "One or more message participants are unavailable.",
    }
    return apiError(
      known[message] ?? message,
      message.includes("assigned to another") ? 403 : 409
    )
  }

  return apiError("Clinician resource was not found.", 404)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { staff: actor, response } = await requireClinicianApi(request)
  if (response) return response
  const path = (await context.params).path ?? []
  const [resource, id, child, childId] = path
  if (!id) return apiError("Resource identifier is required.", 400)
  const body: unknown = await request.json()

  try {
    if (resource === "consultation-queue") {
      const parsed = queueUpdateSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const row = await prisma.$transaction(async (tx) => {
        const before = await tx.patientQueue.findFirst({
          where: { id, department: { facilityId: actor!.facilityId } },
          include: clinicianQueueInclude,
        })
        if (!before) throw new Error("QUEUE_NOT_FOUND")
        if (before.assignedToId && before.assignedToId !== actor!.id)
          throw new Error("QUEUE_CLAIMED")
        if (!canTransitionQueue(before.status, parsed.data.status))
          throw new Error("INVALID_QUEUE_TRANSITION")
        if (
          parsed.data.status === "CANCELLED" &&
          !parsed.data.cancellationReason
        )
          throw new Error("CANCELLATION_REASON_REQUIRED")
        const claimed = await tx.patientQueue.updateMany({
          where: {
            id,
            OR: [{ assignedToId: null }, { assignedToId: actor!.id }],
          },
          data: { assignedToId: actor!.id },
        })
        if (claimed.count !== 1) throw new Error("QUEUE_CLAIMED")
        const updated = await tx.patientQueue.update({
          where: { id },
          data: {
            status: parsed.data.status,
            notes: parsed.data.notes,
            ...(parsed.data.status === "WITH_CLINICIAN"
              ? { calledAt: before.calledAt ?? new Date() }
              : {}),
            ...(parsed.data.status === "COMPLETED"
              ? { completedAt: before.completedAt ?? new Date() }
              : {}),
            ...(parsed.data.status === "CANCELLED"
              ? {
                  cancelledAt: before.cancelledAt ?? new Date(),
                  cancellationReason: parsed.data.cancellationReason,
                }
              : {}),
          },
          include: clinicianQueueInclude,
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: AuditAction.UPDATE,
          entityType: "PatientQueue",
          entityId: id,
          description: `Updated queue ${updated.queueNo} to ${updated.status}`,
          before: { status: before.status, assignedToId: before.assignedToId },
          after: { status: updated.status, assignedToId: updated.assignedToId },
        })
        return updated
      })
      return ok(serializeQueue(row, actor!.id))
    }

    if (resource === "encounters" && !child) {
      const parsed = encounterUpdateSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const row = await prisma.$transaction(async (tx) => {
        const checked = await ensureMutableEncounter(id, actor!, tx)
        if (checked.error || !checked.encounter)
          throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
        if (
          parsed.data.departmentId &&
          !(await ensureDepartmentInFacility(
            parsed.data.departmentId,
            actor!.facilityId,
            tx
          ))
        )
          throw new Error("DEPARTMENT_NOT_FOUND")
        if (
          parsed.data.status &&
          !canTransitionEncounter(checked.encounter.status, parsed.data.status)
        )
          throw new Error("INVALID_ENCOUNTER_TRANSITION")
        const updated = await tx.encounter.update({
          where: { id },
          data: parsed.data,
          include: clinicianEncounterInclude,
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: AuditAction.UPDATE,
          entityType: "Encounter",
          entityId: id,
          description: `Updated encounter ${updated.encounterNo}`,
          before: {
            status: checked.encounter.status,
            chiefComplaint: checked.encounter.chiefComplaint,
          },
          after: {
            status: updated.status,
            chiefComplaint: updated.chiefComplaint,
          },
        })
        return updated
      })
      return ok(serializeEncounter(row, actor!.id))
    }

    if (resource === "encounters" && child === "clinical-notes" && childId) {
      const parsed = noteSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const row = await prisma.$transaction(async (tx) => {
        const checked = await ensureMutableEncounter(id, actor!, tx)
        if (checked.error)
          throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
        const before = await tx.clinicalNote.findFirst({
          where: { id: childId, encounterId: id, authoredById: actor!.id },
        })
        if (!before) throw new Error("NOTE_NOT_FOUND")
        if (before.signedAt) throw new Error("SIGNED_NOTE_LOCKED")
        const { sign, ...noteValues } = parsed.data
        const updated = await tx.clinicalNote.update({
          where: { id: childId },
          data: { ...noteValues, signedAt: sign ? new Date() : null },
          include: clinicalNoteInclude,
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: sign ? AuditAction.APPROVE : AuditAction.UPDATE,
          entityType: "ClinicalNote",
          entityId: childId,
          description: sign
            ? "Signed clinical note"
            : "Updated clinical note draft",
          before: { signedAt: null },
          after: { signedAt: updated.signedAt?.toISOString() ?? null },
        })
        return updated
      })
      return ok(serializeNote(row))
    }

    if (resource === "encounters" && child === "diagnoses" && childId) {
      const parsed = diagnosisSchema.safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const row = await prisma.$transaction(async (tx) => {
        const checked = await ensureMutableEncounter(id, actor!, tx)
        if (checked.error)
          throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
        const before = await tx.diagnosis.findFirst({
          where: { id: childId, encounterId: id },
        })
        if (!before) throw new Error("DIAGNOSIS_NOT_FOUND")
        if (parsed.data.isPrimary)
          await tx.diagnosis.updateMany({
            where: { encounterId: id, isPrimary: true, id: { not: childId } },
            data: { isPrimary: false },
          })
        const updated = await tx.diagnosis.update({
          where: { id: childId },
          data: parsed.data,
          include: diagnosisInclude,
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: AuditAction.UPDATE,
          entityType: "Diagnosis",
          entityId: childId,
          description: `Updated diagnosis ${updated.name}`,
          before: { name: before.name, isPrimary: before.isPrimary },
          after: { name: updated.name, isPrimary: updated.isPrimary },
        })
        return updated
      })
      return ok(serializeDiagnosis(row))
    }

    if (resource === "lab-requests") {
      const parsed = z
        .object({
          clinicalNotes: z.string().trim().nullable().optional(),
          cancel: z.boolean().optional(),
          cancellationReason: z.string().trim().nullable().optional(),
        })
        .safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const row = await prisma.$transaction(async (tx) => {
        const before = await tx.labRequest.findFirst({
          where: {
            id,
            requestedById: actor!.id,
            encounter: { facilityId: actor!.facilityId },
          },
          include: { samples: true },
        })
        if (!before) throw new Error("LAB_REQUEST_NOT_FOUND")
        if (
          before.status !== "REQUESTED" ||
          before.samples.some(
            (sample) => sample.status !== "PENDING_COLLECTION"
          )
        )
          throw new Error("LAB_REQUEST_LOCKED")
        if (parsed.data.cancel && !parsed.data.cancellationReason)
          throw new Error("CANCELLATION_REASON_REQUIRED")
        const updated = await tx.labRequest.update({
          where: { id },
          data: {
            clinicalNotes: parsed.data.clinicalNotes,
            ...(parsed.data.cancel
              ? {
                  status: "CANCELLED",
                  cancelledAt: new Date(),
                  cancellationReason: parsed.data.cancellationReason,
                }
              : {}),
          },
          include: labRequestInclude,
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action: parsed.data.cancel ? AuditAction.REJECT : AuditAction.UPDATE,
          entityType: "LabRequest",
          entityId: id,
          description: parsed.data.cancel
            ? `Cancelled lab request ${updated.requestNo}`
            : `Updated lab request ${updated.requestNo}`,
          before: { status: before.status },
          after: { status: updated.status },
        })
        if (parsed.data.cancel) {
          await reconcileEncounterAfterLaboratory(tx, updated.encounterId, {
            request,
            actor: actor!,
          })
        }
        return updated
      })
      return ok(serializeLabRequest(row))
    }

    if (resource === "prescriptions") {
      const parsed = z
        .object({
          status: z.enum(["DRAFT", "ISSUED", "CANCELLED"]),
          notes: z.string().trim().nullable().optional(),
          items: z.array(prescriptionItemSchema).min(1).optional(),
        })
        .safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const row = await prisma.$transaction(async (tx) => {
        const before = await tx.prescription.findFirst({
          where: {
            id,
            prescribedById: actor!.id,
            encounter: { facilityId: actor!.facilityId },
          },
          include: prescriptionInclude,
        })
        if (!before) throw new Error("PRESCRIPTION_NOT_FOUND")
        if (
          ["PARTIALLY_DISPENSED", "DISPENSED"].includes(before.status) ||
          before.dispensing
        )
          throw new Error("PRESCRIPTION_LOCKED")
        if (before.encounterId) {
          const checked = await ensureMutableEncounter(
            before.encounterId,
            actor!,
            tx
          )
          if (checked.error)
            throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
        }
        if (parsed.data.items) {
          await tx.prescriptionItem.deleteMany({
            where: { prescriptionId: id },
          })
          await tx.prescriptionItem.createMany({
            data: parsed.data.items.map((item) => ({
              ...item,
              prescriptionId: id,
            })),
          })
        }
        const updated = await tx.prescription.update({
          where: { id },
          data: {
            status: parsed.data.status,
            notes: parsed.data.notes,
            issuedAt:
              parsed.data.status === "ISSUED"
                ? (before.issuedAt ?? new Date())
                : before.issuedAt,
          },
          include: prescriptionInclude,
        })
        if (updated.status === "ISSUED" && updated.encounterId) {
          const encounter = await tx.encounter.update({
            where: { id: updated.encounterId },
            data: { status: "AWAITING_PHARMACY" },
          })
          if (encounter.queueId)
            await tx.patientQueue.update({
              where: { id: encounter.queueId },
              data: { status: "AWAITING_PHARMACY" },
            })
        }
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action:
            parsed.data.status === "CANCELLED"
              ? AuditAction.REJECT
              : AuditAction.UPDATE,
          entityType: "Prescription",
          entityId: id,
          description: `Updated prescription ${updated.prescriptionNo} to ${updated.status}`,
          before: { status: before.status },
          after: { status: updated.status },
        })
        return updated
      })
      return ok(serializePrescription(row))
    }

    if (resource === "referrals") {
      const parsed = z
        .object({
          status: z.enum(["DRAFT", "SENT", "CANCELLED"]),
          reason: z.string().trim().min(1).optional(),
          clinicalSummary: z.string().trim().nullable().optional(),
          urgency: z
            .enum(["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"])
            .optional(),
        })
        .safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const row = await prisma.$transaction(async (tx) => {
        const before = await tx.referral.findFirst({
          where: {
            id,
            fromFacilityId: actor!.facilityId,
            referredById: actor!.id,
          },
        })
        if (!before) throw new Error("REFERRAL_NOT_FOUND")
        if (["RECEIVED", "ACCEPTED", "COMPLETED"].includes(before.status))
          throw new Error("REFERRAL_LOCKED")
        const updated = await tx.referral.update({
          where: { id },
          data: {
            ...parsed.data,
            sentAt:
              parsed.data.status === "SENT"
                ? (before.sentAt ?? new Date())
                : before.sentAt,
          },
          include: referralInclude,
        })
        await writeClinicianAuditLog({
          client: tx,
          request,
          actor: actor!,
          action:
            parsed.data.status === "CANCELLED"
              ? AuditAction.REJECT
              : AuditAction.UPDATE,
          entityType: "Referral",
          entityId: id,
          description: `Updated referral ${updated.referralNo}`,
          before: { status: before.status },
          after: { status: updated.status },
        })
        return updated
      })
      return ok(serializeReferral(row))
    }

    if (resource === "notifications") {
      const parsed = z
        .object({ status: z.enum(["READ", "ARCHIVED"]) })
        .safeParse(body)
      if (!parsed.success) return invalidFields(parsed.error)
      const visible = await prisma.notification.findFirst({
        where: { id, ...notificationWhere(actor!) },
      })
      if (!visible) return apiError("Notification was not found.", 404)
      const updated = await prisma.notification.update({
        where: { id },
        data: {
          status: parsed.data.status,
          readAt:
            parsed.data.status === "READ"
              ? (visible.readAt ?? new Date())
              : visible.readAt,
        },
      })
      await writeClinicianAuditLog({
        request,
        actor: actor!,
        action: AuditAction.UPDATE,
        entityType: "Notification",
        entityId: id,
        description: `Marked notification ${parsed.data.status.toLowerCase()}`,
      })
      return ok(serializeNotification(updated))
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Clinical update failed."
    const known: Record<string, string> = {
      QUEUE_NOT_FOUND: "Queue item was not found.",
      QUEUE_CLAIMED: "Another clinician has already claimed this patient.",
      INVALID_QUEUE_TRANSITION: "That queue status transition is not allowed.",
      INVALID_ENCOUNTER_TRANSITION:
        "That encounter status transition is not allowed.",
      CANCELLATION_REASON_REQUIRED: "A cancellation reason is required.",
      NOTE_NOT_FOUND: "Clinical note was not found.",
      SIGNED_NOTE_LOCKED: "Signed clinical notes are locked.",
      DIAGNOSIS_NOT_FOUND: "Diagnosis was not found.",
      LAB_REQUEST_NOT_FOUND: "Lab request was not found.",
      LAB_REQUEST_LOCKED: "Lab request can no longer be edited or cancelled.",
      PRESCRIPTION_NOT_FOUND: "Prescription was not found.",
      PRESCRIPTION_LOCKED: "Dispensed prescriptions are locked.",
      REFERRAL_NOT_FOUND: "Referral was not found.",
      REFERRAL_LOCKED: "Received or completed referrals are locked.",
    }
    return apiError(
      known[message] ?? message,
      message.includes("assigned to another") ? 403 : 409
    )
  }
  return apiError("Clinician resource was not found.", 404)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { staff: actor, response } = await requireClinicianApi(request)
  if (response) return response
  const path = (await context.params).path ?? []
  const [resource, encounterId, child, diagnosisId] = path
  if (
    resource !== "encounters" ||
    child !== "diagnoses" ||
    !encounterId ||
    !diagnosisId
  )
    return apiError("Clinician resource was not found.", 404)
  try {
    await prisma.$transaction(async (tx) => {
      const checked = await ensureMutableEncounter(encounterId, actor!, tx)
      if (checked.error) throw new Error(checked.error ?? "ENCOUNTER_NOT_FOUND")
      const diagnosis = await tx.diagnosis.findFirst({
        where: { id: diagnosisId, encounterId },
      })
      if (!diagnosis) throw new Error("DIAGNOSIS_NOT_FOUND")
      await tx.diagnosis.delete({ where: { id: diagnosisId } })
      await writeClinicianAuditLog({
        client: tx,
        request,
        actor: actor!,
        action: AuditAction.DELETE,
        entityType: "Diagnosis",
        entityId: diagnosisId,
        description: `Removed diagnosis ${diagnosis.name}`,
        before: {
          code: diagnosis.code,
          name: diagnosis.name,
          isPrimary: diagnosis.isPrimary,
        },
      })
    })
    return ok({ id: diagnosisId }, "Diagnosis removed.")
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Diagnosis could not be removed."
    return apiError(
      message === "DIAGNOSIS_NOT_FOUND" ? "Diagnosis was not found." : message,
      message.includes("assigned to another") ? 403 : 409
    )
  }
}
