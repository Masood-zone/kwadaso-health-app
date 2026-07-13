import type { NextRequest } from "next/server"

import type { AuthenticatedStaff } from "@/lib/auth-session"
import { apiError, requireClinicianApi } from "@/lib/clinician"
import type { Prisma } from "@/lib/generated/prisma/client"

export function ok(data: unknown, message?: string, status = 200) {
  return Response.json({ success: true, data, ...(message ? { message } : {}) }, { status })
}

export function startOfDay(value = new Date()) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export function endOfDay(value = new Date()) {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

export const priorityRank = { EMERGENCY: 4, URGENT: 3, PRIORITY: 2, ROUTINE: 1 }

export function notificationWhere(actor: Pick<AuthenticatedStaff, "id" | "facilityId" | "defaultRole" | "departmentId">): Prisma.NotificationWhereInput {
  return {
    OR: [
      { recipientId: actor.id },
      { facilityId: actor.facilityId, recipientId: null, targetRole: actor.defaultRole },
      ...(actor.departmentId
        ? [{ facilityId: actor.facilityId, recipientId: null, targetDepartmentId: actor.departmentId }]
        : []),
    ],
  }
}

const errorMessages: Record<string, string> = {
  PATIENT_NOT_FOUND: "Patient was not found in this facility.",
  DEPARTMENT_NOT_FOUND: "Department was not found in this facility.",
  APPOINTMENT_NOT_FOUND: "Appointment was not found in this facility.",
  QUEUE_NOT_FOUND: "Queue item was not found.",
  QUEUE_NOT_READY: "Queue item is not ready for consultation.",
  QUEUE_CLAIMED: "Another clinician has already claimed this patient.",
  INVALID_QUEUE_TRANSITION: "That queue status transition is not allowed.",
  INVALID_ENCOUNTER_TRANSITION: "That encounter status transition is not allowed.",
  CANCELLATION_REASON_REQUIRED: "A cancellation reason is required.",
  ENCOUNTER_NOT_FOUND: "Encounter was not found.",
  NOTE_NOT_FOUND: "Clinical note was not found.",
  SIGNED_NOTE_LOCKED: "Signed clinical notes are locked.",
  DIAGNOSIS_NOT_FOUND: "Diagnosis was not found.",
  LAB_TEST_NOT_FOUND: "One or more laboratory tests are unavailable.",
  LAB_REQUEST_NOT_FOUND: "Lab request was not found.",
  LAB_REQUEST_LOCKED: "Lab request can no longer be edited or cancelled.",
  PRESCRIPTION_NOT_FOUND: "Prescription was not found.",
  PRESCRIPTION_LOCKED: "Dispensed prescriptions are locked.",
  REFERRAL_NOT_FOUND: "Referral was not found.",
  REFERRAL_LOCKED: "Received or completed referrals are locked.",
  CLINICIAN_NOT_FOUND: "Selected clinician is unavailable.",
  FACILITY_NOT_FOUND: "Referral facility was not found.",
  SIGNED_NOTE_REQUIRED: "Sign at least one clinical note before completing the encounter.",
  PRIMARY_DIAGNOSIS_REQUIRED: "Add a primary diagnosis before completing the encounter.",
  THREAD_NOT_FOUND: "Message thread was not found or is closed.",
  SUBJECT_REQUIRED: "A subject is required for a new message thread.",
  PARTICIPANT_NOT_FOUND: "One or more message participants are unavailable.",
  MEDICATION_NOT_FOUND: "One or more medications are unavailable in this facility.",
}

export function clinicianError(error: unknown, fallback = "Clinical action failed.") {
  const message = error instanceof Error ? error.message : fallback
  const status = message.includes("assigned to another") ? 403 : message.endsWith("_NOT_FOUND") ? 404 : 409
  return apiError(errorMessages[message] ?? message, status)
}

export async function withClinician(
  request: NextRequest,
  handler: (actor: AuthenticatedStaff) => Promise<Response>
) {
  const { staff, response } = await requireClinicianApi(request)
  if (response) return response
  try {
    return await handler(staff!)
  } catch (error) {
    return clinicianError(error)
  }
}
