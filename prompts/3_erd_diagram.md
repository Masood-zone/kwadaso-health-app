# KHIP Entity Relationship Diagram

Generate an Entity Relationship Diagram (ERD) for the KHIP hospital management system database.

## Title
KHIP Database ERD

## Description
Complete database schema for the Kwadaso HealthLink Integrated Platform showing all models, their fields, and relationships. PostgreSQL database with Prisma ORM.

## ERD

```kroki
@startuml
skinparam backgroundColor white
skinparam classBackgroundColor #E8F5E9
skinparam classBorderColor #004302
skinparam classAttributeFontSize 11
skinparam defaultFontSize 12
skinparam arrowColor #004302

title KHIP Database Entity Relationship Diagram

' =============================
' ACCESS CONTROL
' =============================

class User {
  id: String PK
  staffId: String?
  email: String UK
  name: String
  firstName: String
  lastName: String
  passwordHash: String
  jobTitle: String?
  defaultRole: StaffRole
  status: UserStatus
  facilityId: String FK
  departmentId: String FK?
  emailVerified: Boolean
  createdAt: DateTime
  updatedAt: DateTime
}

class Role {
  id: String PK
  name: StaffRole UK
  description: String?
  isSystem: Boolean
}

class Permission {
  id: String PK
  name: String UK
  description: String?
}

class UserRole {
  id: String PK
  userId: String FK
  roleId: String FK
}

class RolePermission {
  id: String PK
  roleId: String FK
  permissionId: String FK
}

' =============================
' FACILITIES & DEPARTMENTS
' =============================

class Facility {
  id: String PK
  code: String UK
  name: String
  type: FacilityType
  phone: String?
  email: String?
  address: String?
  municipality: String?
  region: String?
  isActive: Boolean
}

class Department {
  id: String PK
  facilityId: String FK
  code: String
  name: String
  type: DepartmentType
  isActive: Boolean
}

' =============================
' PATIENT RECORDS
' =============================

class Patient {
  id: String PK
  patientNo: String UK
  firstName: String
  lastName: String
  otherNames: String?
  gender: Gender
  dateOfBirth: DateTime?
  estimatedAge: Int?
  phone: String?
  community: String?
  residentialAddress: String?
  nhisNumber: String?
  nationalId: String?
  bloodGroup: BloodGroup?
  maritalStatus: MaritalStatus?
  emergencyContactName: String?
  emergencyContactPhone: String?
  status: PatientStatus
  registeredFacilityId: String FK
  registeredById: String FK?
  createdAt: DateTime
  updatedAt: DateTime
}

class PatientAllergy {
  id: String PK
  patientId: String FK
  allergen: String
  reaction: String?
  severity: AllergySeverity
  notes: String?
}

class ChronicCondition {
  id: String PK
  patientId: String FK
  name: String
  status: String?
  diagnosedAt: DateTime?
  notes: String?
}

class MedicationHistory {
  id: String PK
  patientId: String FK
  medicationName: String
  dosage: String?
  frequency: String?
  notes: String?
}

class ImmunizationRecord {
  id: String PK
  patientId: String FK
  vaccineName: String
  dose: String?
  batchNumber: String?
  administeredAt: DateTime
  nextDueAt: DateTime?
  administeredById: String FK?
  notes: String?
}

class PatientDocument {
  id: String PK
  patientId: String FK
  documentType: String
  title: String
  fileUrl: String
  fileName: String
  uploadedById: String FK?
  uploadedAt: DateTime
}

' =============================
' QUEUE & APPOINTMENTS
' =============================

class PatientQueue {
  id: String PK
  queueNo: String
  patientId: String FK
  appointmentId: String FK?
  departmentId: String FK
  assignedToId: String FK?
  priority: TriagePriority
  status: QueueStatus
  arrivedAt: DateTime
  calledAt: DateTime?
  completedAt: DateTime?
  cancelledAt: DateTime?
  cancellationReason: String?
  reason: String?
  notes: String?
}

class Appointment {
  id: String PK
  appointmentNo: String UK
  patientId: String FK
  facilityId: String FK
  departmentId: String FK
  clinicianId: String FK?
  title: String
  reason: String?
  scheduledAt: DateTime
  checkedInAt: DateTime?
  status: AppointmentStatus
  cancellationReason: String?
  createdById: String FK?
  createdAt: DateTime
  updatedAt: DateTime
}

' =============================
' CLINICAL ENCOUNTERS
' =============================

class Encounter {
  id: String PK
  encounterNo: String UK
  patientId: String FK
  appointmentId: String FK?
  facilityId: String FK
  departmentId: String FK
  clinicianId: String FK?
  queueId: String FK?
  visitType: VisitType
  status: EncounterStatus
  chiefComplaint: String?
  startedAt: DateTime
  completedAt: DateTime?
  createdAt: DateTime
  updatedAt: DateTime
}

class VitalSigns {
  id: String PK
  patientId: String FK
  encounterId: String FK?
  temperatureC: Decimal?
  systolicBp: Int?
  diastolicBp: Int?
  pulseRate: Int?
  respiratoryRate: Int?
  oxygenSaturation: Int?
  weightKg: Decimal?
  heightCm: Decimal?
  bmi: Decimal?
  painScore: Int?
  triagePriority: TriagePriority
  notes: String?
  capturedById: String FK?
  capturedAt: DateTime
}

class ClinicalNote {
  id: String PK
  patientId: String FK
  encounterId: String FK
  subjective: String?
  objective: String?
  assessment: String?
  plan: String?
  notes: String?
  authoredById: String FK?
  signedAt: DateTime?
  createdAt: DateTime
  updatedAt: DateTime
}

class Diagnosis {
  id: String PK
  patientId: String FK
  encounterId: String FK
  code: String?
  name: String
  isPrimary: Boolean
  notes: String?
  diagnosedById: String FK?
  createdAt: DateTime
}

' =============================
' LABORATORY
' =============================

class LabRequest {
  id: String PK
  requestNo: String UK
  patientId: String FK
  encounterId: String FK?
  requestedById: String FK?
  priority: LabPriority
  status: LabRequestStatus
  clinicalNotes: String?
  requestedAt: DateTime
  completedAt: DateTime?
  cancelledAt: DateTime?
  cancellationReason: String?
}

class LabRequestTest {
  id: String PK
  labRequestId: String FK
  testId: String FK
  notes: String?
}

class LabTestCatalog {
  id: String PK
  code: String UK
  name: String
  category: String
  sampleType: String
  turnaroundTime: String?
  isActive: Boolean
}

class LabSample {
  id: String PK
  sampleNo: String UK
  labRequestId: String FK
  sampleType: String
  status: SampleStatus
  collectedById: String FK?
  collectedAt: DateTime?
  receivedById: String FK?
  receivedAt: DateTime?
  rejectionReason: String?
  notes: String?
}

class LabResult {
  id: String PK
  labRequestId: String UK
  patientId: String FK
  encounterId: String FK?
  status: LabResultStatus
  validatedById: String FK?
  validatedAt: DateTime?
  releasedAt: DateTime?
}

class LabResultItem {
  id: String PK
  resultId: String FK
  testId: String FK
  testName: String
  value: String?
  unit: String?
  referenceRange: String?
  isAbnormal: Boolean
  notes: String?
}

' =============================
' PHARMACY
' =============================

class Medication {
  id: String PK
  code: String UK
  name: String
  genericName: String?
  category: String
  dosageForm: String
  strength: String
  unit: String
  reorderLevel: Int
  isActive: Boolean
}

class MedicationStock {
  id: String PK
  facilityId: String FK
  medicationId: String FK
  batchNumber: String?
  expiryDate: DateTime?
  quantityOnHand: Int
  unitCost: Decimal
  sellingPrice: Decimal
  createdAt: DateTime
  updatedAt: DateTime
}

class StockMovement {
  id: String PK
  stockId: String FK
  medicationId: String FK
  type: StockMovementType
  quantity: Int
  reason: String?
  reference: String?
  performedById: String FK?
  createdAt: DateTime
}

class Prescription {
  id: String PK
  prescriptionNo: String UK
  patientId: String FK
  encounterId: String FK?
  prescribedById: String FK?
  status: PrescriptionStatus
  notes: String?
  issuedAt: DateTime?
  createdAt: DateTime
  updatedAt: DateTime
}

class PrescriptionItem {
  id: String PK
  prescriptionId: String FK
  medicationId: String FK?
  medicineName: String
  dosage: String?
  frequency: String?
  duration: String?
  quantity: Int?
  instructions: String?
}

class Dispensing {
  id: String PK
  dispenseNo: String UK
  prescriptionId: String UK
  patientId: String FK
  status: DispenseStatus
  dispensedById: String FK?
  dispensedAt: DateTime?
  counsellingNotes: String?
  createdAt: DateTime
  updatedAt: DateTime
}

class DispenseItem {
  id: String PK
  dispensingId: String FK
  prescriptionItemId: String FK?
  medicationId: String FK?
  medicineName: String
  quantityDispensed: Int
  notes: String?
}

' =============================
' BILLING & PAYMENTS
' =============================

class Invoice {
  id: String PK
  invoiceNo: String UK
  patientId: String FK
  encounterId: String FK?
  facilityId: String FK
  status: InvoiceStatus
  subtotal: Decimal
  discountAmount: Decimal
  taxAmount: Decimal
  totalAmount: Decimal
  amountPaid: Decimal
  balanceDue: Decimal
  issuedAt: DateTime?
  createdById: String FK?
  createdAt: DateTime
  updatedAt: DateTime
}

class InvoiceItem {
  id: String PK
  invoiceId: String FK
  description: String
  itemType: String?
  quantity: Int
  unitPrice: Decimal
  totalPrice: Decimal
  referenceId: String?
}

class Payment {
  id: String PK
  receiptNo: String UK
  invoiceId: String FK
  method: PaymentMethod
  status: PaymentStatus
  amount: Decimal
  reference: String?
  receivedById: String FK?
  paidAt: DateTime?
  createdAt: DateTime
}

' =============================
' REFERRALS & MESSAGING
' =============================

class Referral {
  id: String PK
  referralNo: String UK
  patientId: String FK
  encounterId: String FK?
  fromFacilityId: String FK
  toFacilityId: String FK?
  fromDepartmentId: String FK?
  toDepartmentId: String FK?
  referredById: String FK?
  receivedById: String FK?
  reason: String
  clinicalSummary: String?
  urgency: TriagePriority
  status: ReferralStatus
  sentAt: DateTime?
  receivedAt: DateTime?
  completedAt: DateTime?
}

class Notification {
  id: String PK
  facilityId: String FK
  type: NotificationType
  title: String
  body: String?
  priority: MessagePriority
  targetRole: StaffRole?
  targetUserId: String FK?
  targetDepartmentId: String FK?
  status: NotificationStatus
  readAt: DateTime?
  archivedAt: DateTime?
  createdById: String FK?
  createdAt: DateTime
}

class AuditLog {
  id: String PK
  actorId: String FK
  action: AuditAction
  entityType: String
  entityId: String?
  description: String?
  before: Json?
  after: Json?
  ipAddress: String?
  userAgent: String?
  createdAt: DateTime
}

' =============================
' RELATIONSHIPS
' =============================

User "1" -- "*" UserRole : has >
Role "1" -- "*" UserRole : assigned to >
Role "1" -- "*" RolePermission : has >
Permission "1" -- "*" RolePermission : granted to >

Facility "1" -- "*" Department : contains >
Facility "1" -- "*" User : employs >
Department "1" -- "*" User : employs >

Facility "1" -- "*" Patient : registers >
User "1" -- "*" Patient : registers >
Patient "1" -- "*" PatientAllergy : has >
Patient "1" -- "*" ChronicCondition : has >
Patient "1" -- "*" MedicationHistory : has >
Patient "1" -- "*" ImmunizationRecord : has >
Patient "1" -- "*" PatientDocument : has >

Patient "1" -- "*" PatientQueue : queued in >
Patient "1" -- "*" Appointment : books >
Patient "1" -- "*" Encounter : visits >
Patient "1" -- "*" VitalSigns : has >
Patient "1" -- "*" ClinicalNote : has >
Patient "1" -- "*" Diagnosis : has >
Patient "1" -- "*" LabRequest : ordered for >
Patient "1" -- "*" Prescription : prescribed for >
Patient "1" -- "*" Invoice : billed to >
Patient "1" -- "*" Referral : referred from >

Department "1" -- "*" PatientQueue : queues in >
Department "1" -- "*" Appointment : scheduled in >
Department "1" -- "*" Encounter : occurs in >

Appointment "1" -- "0..1" Encounter : generates >
PatientQueue "1" -- "0..1" Encounter : linked to >

User "1" -- "*" Encounter : clinicians >
User "1" -- "*" ClinicalNote : authors >
User "1" -- "*" Diagnosis : diagnoses >
User "1" -- "*" LabRequest : orders >
User "1" -- "*" Prescription : prescribes >
User "1" -- "*" Referral : refers >
User "1" -- "*" AuditLog : performs >

Encounter "1" -- "1" ClinicalNote : has >
Encounter "1" -- "*" Diagnosis : has >
Encounter "1" -- "*" LabRequest : orders >
Encounter "1" -- "*" Prescription : prescribes >
Encounter "1" -- "0..1" Invoice : generates >
Encounter "1" -- "*" Referral : creates >

LabRequest "1" -- "*" LabRequestTest : includes >
LabRequest "1" -- "*" LabSample : samples >
LabRequest "1" -- "0..1" LabResult : results >
LabTestCatalog "1" -- "*" LabRequestTest : tests >
LabResult "1" -- "*" LabResultItem : contains >
LabTestCatalog "1" -- "*" LabResultItem : measures >

Medication "1" -- "*" MedicationStock : stocked as >
Medication "1" -- "*" StockMovement : moved >
MedicationStock "1" -- "*" StockMovement : tracked in >
User "1" -- "*" StockMovement : performs >

Prescription "1" -- "*" PrescriptionItem : contains >
Medication "1" -- "0..1" PrescriptionItem : prescribed as >
Prescription "1" -- "0..1" Dispensing : dispensed as >
Dispensing "1" -- "*" DispenseItem : contains >
PrescriptionItem "1" -- "0..1" DispenseItem : dispensed as >
Medication "1" -- "0..1" DispenseItem : dispensed as >

Invoice "1" -- "*" InvoiceItem : contains >
Invoice "1" -- "*" Payment : paid via >
User "1" -- "*" Payment : receives >

Facility "1" -- "*" Referral : refers from >
Facility "1" -- "*" Referral : refers to >
Department "1" -- "*" Referral : from dept >
Department "1" -- "*" Referral : to dept >

Facility "1" -- "*" Notification : notifies in >
User "1" -- "*" Notification : targets >
Department "1" -- "*" Notification : targets >
User "1" -- "*" Notification : creates >

@enduml
```

## Theme
minimal
