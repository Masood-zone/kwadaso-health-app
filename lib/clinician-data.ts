import type { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import { fullName, getAge, getCompletionState, toNumber } from "@/lib/clinician"

export const clinicianEncounterInclude = {
  patient: true,
  department: true,
  clinician: true,
} satisfies Prisma.EncounterInclude

export const clinicianQueueInclude = {
  patient: {
    include: {
      vitalSigns: { orderBy: { capturedAt: "desc" }, take: 1 },
      allergies: true,
    },
  },
  department: true,
  assignedTo: true,
  appointment: true,
  encounter: { include: clinicianEncounterInclude },
} satisfies Prisma.PatientQueueInclude

export const clinicalNoteInclude = {
  authoredBy: true,
} satisfies Prisma.ClinicalNoteInclude

export const diagnosisInclude = {
  diagnosedBy: true,
} satisfies Prisma.DiagnosisInclude

export const labRequestInclude = {
  patient: true,
  requestedBy: true,
  tests: { include: { test: true, result: true } },
} satisfies Prisma.LabRequestInclude

export const labResultInclude = {
  patient: true,
  test: true,
  items: true,
} satisfies Prisma.LabResultInclude

export const prescriptionInclude = {
  patient: true,
  prescribedBy: true,
  items: true,
  dispensing: true,
} satisfies Prisma.PrescriptionInclude

export const referralInclude = {
  patient: true,
  fromDepartment: true,
  toDepartment: true,
  toFacility: true,
  referredBy: true,
} satisfies Prisma.ReferralInclude

export const followUpInclude = {
  patient: true,
  department: true,
  clinician: true,
} satisfies Prisma.AppointmentInclude

type EncounterRecord = Prisma.EncounterGetPayload<{
  include: typeof clinicianEncounterInclude
}>
type QueueRecord = Prisma.PatientQueueGetPayload<{
  include: typeof clinicianQueueInclude
}>
type NoteRecord = Prisma.ClinicalNoteGetPayload<{
  include: typeof clinicalNoteInclude
}>
type DiagnosisRecord = Prisma.DiagnosisGetPayload<{
  include: typeof diagnosisInclude
}>
type LabRequestRecord = Prisma.LabRequestGetPayload<{
  include: typeof labRequestInclude
}>
type LabResultRecord = Prisma.LabResultGetPayload<{
  include: typeof labResultInclude
}>
type PrescriptionRecord = Prisma.PrescriptionGetPayload<{
  include: typeof prescriptionInclude
}>
type ReferralRecord = Prisma.ReferralGetPayload<{
  include: typeof referralInclude
}>
type FollowUpRecord = Prisma.AppointmentGetPayload<{
  include: typeof followUpInclude
}>

export function serializeVitals(vital: {
  id: string
  temperatureC: { toString(): string } | number | null
  systolicBp: number | null
  diastolicBp: number | null
  pulseRate: number | null
  respiratoryRate: number | null
  oxygenSaturation: number | null
  weightKg: { toString(): string } | number | null
  heightCm: { toString(): string } | number | null
  bmi: { toString(): string } | number | null
  painScore: number | null
  triagePriority: string
  capturedAt: Date
}) {
  return {
    id: vital.id,
    temperatureC: toNumber(vital.temperatureC),
    systolicBp: vital.systolicBp,
    diastolicBp: vital.diastolicBp,
    pulseRate: vital.pulseRate,
    respiratoryRate: vital.respiratoryRate,
    oxygenSaturation: vital.oxygenSaturation,
    weightKg: toNumber(vital.weightKg),
    heightCm: toNumber(vital.heightCm),
    bmi: toNumber(vital.bmi),
    painScore: vital.painScore,
    triagePriority: vital.triagePriority,
    capturedAt: vital.capturedAt.toISOString(),
  }
}

export function serializeEncounter(record: EncounterRecord, actorId?: string) {
  return {
    id: record.id,
    encounterNo: record.encounterNo,
    patientId: record.patientId,
    patientName: fullName(record.patient),
    patientNo: record.patient.patientNo,
    appointmentId: record.appointmentId,
    queueId: record.queueId,
    facilityId: record.facilityId,
    departmentId: record.departmentId,
    departmentName: record.department.name,
    clinicianId: record.clinicianId,
    clinicianName: record.clinician?.name ?? null,
    visitType: record.visitType,
    status: record.status,
    chiefComplaint: record.chiefComplaint,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    canEdit:
      Boolean(actorId) &&
      record.clinicianId === actorId &&
      !["COMPLETED", "CANCELLED"].includes(record.status),
  }
}

export function serializeQueue(record: QueueRecord, actorId?: string) {
  return {
    id: record.id,
    queueNo: record.queueNo,
    patientId: record.patientId,
    patientName: fullName(record.patient),
    patientNo: record.patient.patientNo,
    gender: record.patient.gender,
    age: getAge(record.patient.dateOfBirth, record.patient.estimatedAge),
    departmentId: record.departmentId,
    departmentName: record.department.name,
    appointmentId: record.appointmentId,
    assignedToId: record.assignedToId,
    assignedToName: record.assignedTo?.name ?? null,
    priority: record.priority,
    status: record.status,
    reason: record.reason,
    notes: record.notes,
    arrivedAt: record.arrivedAt.toISOString(),
    waitingMinutes: Math.max(
      0,
      Math.floor((Date.now() - record.arrivedAt.getTime()) / 60_000)
    ),
    allergies: record.patient.allergies.map((allergy) => ({
      id: allergy.id,
      allergen: allergy.allergen,
      severity: allergy.severity,
    })),
    latestVitals: record.patient.vitalSigns[0]
      ? serializeVitals(record.patient.vitalSigns[0])
      : null,
    encounter: record.encounter
      ? serializeEncounter(record.encounter, actorId)
      : null,
  }
}

export function serializeNote(note: NoteRecord) {
  return {
    id: note.id,
    patientId: note.patientId,
    encounterId: note.encounterId,
    subjective: note.subjective,
    objective: note.objective,
    assessment: note.assessment,
    plan: note.plan,
    notes: note.notes,
    authoredById: note.authoredById,
    authoredByName: note.authoredBy?.name ?? null,
    signedAt: note.signedAt?.toISOString() ?? null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  }
}

export function serializeDiagnosis(diagnosis: DiagnosisRecord) {
  return {
    id: diagnosis.id,
    patientId: diagnosis.patientId,
    encounterId: diagnosis.encounterId,
    code: diagnosis.code,
    name: diagnosis.name,
    isPrimary: diagnosis.isPrimary,
    notes: diagnosis.notes,
    diagnosedById: diagnosis.diagnosedById,
    diagnosedByName: diagnosis.diagnosedBy?.name ?? null,
    createdAt: diagnosis.createdAt.toISOString(),
  }
}

export function serializeLabRequest(request: LabRequestRecord) {
  return {
    id: request.id,
    requestNo: request.requestNo,
    patientId: request.patientId,
    patientName: fullName(request.patient),
    encounterId: request.encounterId,
    requestedById: request.requestedById,
    requestedByName: request.requestedBy?.name ?? null,
    priority: request.priority,
    status: request.status,
    clinicalNotes: request.clinicalNotes,
    requestedAt: request.requestedAt.toISOString(),
    completedAt: request.completedAt?.toISOString() ?? null,
    cancelledAt: request.cancelledAt?.toISOString() ?? null,
    tests: request.tests.map((item) => ({
      id: item.id,
      testId: item.testId,
      name: item.test.name,
      notes: item.notes,
      resultId: item.result?.id ?? null,
    })),
  }
}

export function serializeLabResult(result: LabResultRecord) {
  return {
    id: result.id,
    resultNo: result.resultNo,
    patientId: result.patientId,
    patientName: fullName(result.patient),
    encounterId: result.encounterId,
    testName: result.test.name,
    status: result.status,
    resultText: result.resultText,
    abnormalFlag: result.abnormalFlag,
    criticalFlag: result.criticalFlag,
    releasedAt: result.releasedAt?.toISOString() ?? null,
    validatedAt: result.validatedAt?.toISOString() ?? null,
    notes: result.notes,
    items: result.items.map((item) => ({
      id: item.id,
      parameterName: item.parameterName,
      value: item.value,
      unit: item.unit,
      referenceRange: item.referenceRange,
      isAbnormal: item.isAbnormal,
    })),
  }
}

export function serializePrescription(prescription: PrescriptionRecord) {
  return {
    id: prescription.id,
    prescriptionNo: prescription.prescriptionNo,
    patientId: prescription.patientId,
    patientName: fullName(prescription.patient),
    encounterId: prescription.encounterId,
    prescribedById: prescription.prescribedById,
    prescribedByName: prescription.prescribedBy?.name ?? null,
    status: prescription.status,
    notes: prescription.notes,
    issuedAt: prescription.issuedAt?.toISOString() ?? null,
    createdAt: prescription.createdAt.toISOString(),
    items: prescription.items.map((item) => ({
      id: item.id,
      medicationId: item.medicationId,
      medicineName: item.medicineName,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      quantity: item.quantity,
      instructions: item.instructions,
    })),
    dispensingStatus: prescription.dispensing?.status ?? null,
  }
}

export function serializeReferral(referral: ReferralRecord) {
  return {
    id: referral.id,
    referralNo: referral.referralNo,
    patientId: referral.patientId,
    patientName: fullName(referral.patient),
    encounterId: referral.encounterId,
    toDepartmentId: referral.toDepartmentId,
    toFacilityId: referral.toFacilityId,
    fromDepartmentName: referral.fromDepartment?.name ?? null,
    toDepartmentName: referral.toDepartment?.name ?? null,
    toFacilityName: referral.toFacility?.name ?? null,
    referredByName: referral.referredBy?.name ?? null,
    reason: referral.reason,
    clinicalSummary: referral.clinicalSummary,
    urgency: referral.urgency,
    status: referral.status,
    sentAt: referral.sentAt?.toISOString() ?? null,
    createdAt: referral.createdAt.toISOString(),
  }
}

export function serializeFollowUp(appointment: FollowUpRecord) {
  return {
    id: appointment.id,
    appointmentNo: appointment.appointmentNo,
    patientId: appointment.patientId,
    patientName: fullName(appointment.patient),
    departmentName: appointment.department?.name ?? null,
    clinicianName: appointment.clinician?.name ?? null,
    scheduledAt: appointment.scheduledAt.toISOString(),
    durationMinutes: appointment.durationMinutes,
    title: appointment.title,
    reason: appointment.reason,
    status: appointment.status,
  }
}

export function serializeNotification(notification: {
  id: string
  type: string
  priority: string
  status: string
  title: string
  body: string | null
  actionUrl: string | null
  createdAt: Date
}) {
  return {
    id: notification.id,
    type: notification.type,
    priority: notification.priority,
    status: notification.status,
    title: notification.title,
    body: notification.body,
    actionUrl: notification.actionUrl,
    createdAt: notification.createdAt.toISOString(),
  }
}

export async function getPatientClinicalProfile(
  patientId: string,
  facilityId: string,
  actorId?: string
) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, registeredFacilityId: facilityId },
    include: {
      allergies: true,
      chronicConditions: true,
      medicationHistory: true,
      immunizations: { orderBy: { administeredAt: "desc" } },
      vitalSigns: { orderBy: { capturedAt: "desc" }, take: 50 },
    },
  })
  if (!patient) return null

  const [
    encounters,
    diagnoses,
    notes,
    labRequests,
    labResults,
    prescriptions,
    referrals,
    appointments,
    queues,
    invoice,
    dispensing,
  ] = await Promise.all([
    prisma.encounter.findMany({
      where: { patientId, facilityId },
      include: clinicianEncounterInclude,
      orderBy: { startedAt: "desc" },
    }),
    prisma.diagnosis.findMany({
      where: { patientId, encounter: { facilityId } },
      include: diagnosisInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.clinicalNote.findMany({
      where: { patientId, encounter: { facilityId } },
      include: clinicalNoteInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.labRequest.findMany({
      where: {
        patientId,
        OR: [{ encounter: { facilityId } }, { encounterId: null }],
      },
      include: labRequestInclude,
      orderBy: { requestedAt: "desc" },
    }),
    prisma.labResult.findMany({
      where: {
        patientId,
        status: "RELEASED",
        test: { facilityId },
        OR: [{ encounter: { facilityId } }, { encounterId: null }],
      },
      include: labResultInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.prescription.findMany({
      where: {
        patientId,
        OR: [{ encounter: { facilityId } }, { encounterId: null }],
      },
      include: prescriptionInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.referral.findMany({
      where: { patientId, fromFacilityId: facilityId },
      include: referralInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: { patientId, facilityId },
      include: followUpInclude,
      orderBy: { scheduledAt: "desc" },
    }),
    prisma.patientQueue.findMany({
      where: { patientId, department: { facilityId } },
      include: clinicianQueueInclude,
      orderBy: { arrivedAt: "desc" },
    }),
    prisma.invoice.findFirst({
      where: { patientId, facilityId },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    }),
    prisma.dispensing.findFirst({
      where: { patientId },
      orderBy: { createdAt: "desc" },
      select: { status: true },
    }),
  ])

  const serializedQueues = queues.map((item) => serializeQueue(item, actorId))
  return {
    id: patient.id,
    patientNo: patient.patientNo,
    name: fullName(patient),
    firstName: patient.firstName,
    lastName: patient.lastName,
    otherNames: patient.otherNames,
    gender: patient.gender,
    age: getAge(patient.dateOfBirth, patient.estimatedAge),
    dateOfBirth: patient.dateOfBirth?.toISOString() ?? null,
    bloodGroup: patient.bloodGroup,
    phone: patient.phone,
    community: patient.community,
    residentialAddress: patient.residentialAddress,
    allergies: patient.allergies.map((item) => ({
      id: item.id,
      allergen: item.allergen,
      reaction: item.reaction,
      severity: item.severity,
      notes: item.notes,
    })),
    chronicConditions: patient.chronicConditions.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      diagnosedAt: item.diagnosedAt?.toISOString() ?? null,
      notes: item.notes,
    })),
    medicationHistory: patient.medicationHistory.map((item) => ({
      id: item.id,
      medicationName: item.medicationName,
      dosage: item.dosage,
      frequency: item.frequency,
      startDate: item.startDate?.toISOString() ?? null,
      endDate: item.endDate?.toISOString() ?? null,
      notes: item.notes,
    })),
    immunizations: patient.immunizations.map((item) => ({
      id: item.id,
      vaccineName: item.vaccineName,
      dose: item.dose,
      administeredAt: item.administeredAt.toISOString(),
      nextDueAt: item.nextDueAt?.toISOString() ?? null,
    })),
    vitalSigns: patient.vitalSigns.map(serializeVitals),
    encounters: encounters.map((item) => serializeEncounter(item, actorId)),
    diagnoses: diagnoses.map(serializeDiagnosis),
    clinicalNotes: notes.map(serializeNote),
    labRequests: labRequests.map(serializeLabRequest),
    labResults: labResults.map(serializeLabResult),
    prescriptions: prescriptions.map(serializePrescription),
    referrals: referrals.map(serializeReferral),
    appointments: appointments.map(serializeFollowUp),
    queueHistory: serializedQueues,
    activeQueue:
      serializedQueues.find((item) =>
        [
          "IN_TRIAGE",
          "WITH_CLINICIAN",
          "AWAITING_LAB",
          "AWAITING_PHARMACY",
        ].includes(item.status)
      ) ?? null,
    billingStatus: invoice?.status ?? null,
    dispensingStatus: dispensing?.status ?? null,
  }
}

export async function getEncounterDetail(
  encounterId: string,
  facilityId: string,
  actorId: string
) {
  const encounter = await prisma.encounter.findFirst({
    where: { id: encounterId, facilityId },
    include: clinicianEncounterInclude,
  })
  if (!encounter) return null
  const [
    patient,
    notes,
    diagnoses,
    labRequests,
    prescriptions,
    referrals,
    followUps,
  ] = await Promise.all([
    getPatientClinicalProfile(encounter.patientId, facilityId, actorId),
    prisma.clinicalNote.findMany({
      where: { encounterId },
      include: clinicalNoteInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.diagnosis.findMany({
      where: { encounterId },
      include: diagnosisInclude,
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    }),
    prisma.labRequest.findMany({
      where: { encounterId },
      include: labRequestInclude,
      orderBy: { requestedAt: "desc" },
    }),
    prisma.prescription.findMany({
      where: { encounterId },
      include: prescriptionInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.referral.findMany({
      where: { encounterId },
      include: referralInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.appointment.findMany({
      where: {
        patientId: encounter.patientId,
        facilityId,
        createdAt: { gte: encounter.startedAt },
      },
      include: followUpInclude,
      orderBy: { scheduledAt: "asc" },
    }),
  ])
  if (!patient) return null
  const completion = getCompletionState({
    hasSignedNote: notes.some((note) => Boolean(note.signedAt)),
    hasPrimaryDiagnosis: diagnoses.some((diagnosis) => diagnosis.isPrimary),
    pendingLabCount: labRequests.filter((request) =>
      [
        "REQUESTED",
        "SAMPLE_COLLECTED",
        "PROCESSING",
        "PARTIAL_RESULT",
      ].includes(request.status)
    ).length,
    hasFollowUp: followUps.length > 0,
    hasReferral: referrals.length > 0,
  })
  return {
    ...serializeEncounter(encounter, actorId),
    patient,
    clinicalNotes: notes.map(serializeNote),
    diagnoses: diagnoses.map(serializeDiagnosis),
    labRequests: labRequests.map(serializeLabRequest),
    prescriptions: prescriptions.map(serializePrescription),
    referrals: referrals.map(serializeReferral),
    followUps: followUps.map(serializeFollowUp),
    completion,
  }
}
