# KHIP System Walkthrough

**Kwadaso HealthLink Integrated Platform**

A comprehensive guide to understanding how the KHIP hospital management system works, from patient registration to discharge.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Technology](#2-architecture--technology)
3. [Roles & Access Control](#3-roles--access-control)
4. [Complete Patient Journey](#4-complete-patient-journey)
   - [Stage 1: Patient Registration](#stage-1-patient-registration)
   - [Stage 2: Appointment & Check-In](#stage-2-appointment--check-in)
   - [Stage 3: Triage (Nurse)](#stage-3-triage-nurse)
   - [Stage 4: Clinical Consultation (Doctor/PA)](#stage-4-clinical-consultation-doctorpa)
   - [Stage 5: Laboratory](#stage-5-laboratory)
   - [Stage 6: Pharmacy](#stage-6-pharmacy)
   - [Stage 7: Billing](#stage-7-billing)
   - [Stage 8: Discharge](#stage-8-discharge)
5. [Role Dashboards](#5-role-dashboards)
6. [Database Models & Relationships](#6-database-models--relationships)
7. [State Machines](#7-state-machines)
8. [API Routes & Data Flow](#8-api-routes--data-flow)

---

## 1. System Overview

KHIP is a web-based hospital management system built for **SDA Hospital Kwadaso**, Ghana. It consolidates Electronic Health Records, appointment scheduling, laboratory information management, pharmacy, billing, referrals, and secure messaging into a single, mobile-responsive web application.

### What KHIP Does

- Manages staff accounts with role-based access control
- Registers patients and creates permanent medical records
- Handles patient flow from registration through triage, consultation, lab, pharmacy, and billing
- Tracks appointments, queue positions, and patient status in real-time
- Captures and stores vital signs, diagnoses, prescriptions, and lab results
- Generates invoices and processes payments
- Maintains complete audit trails for compliance

### Key Principles

1. **Role-Based Access**: Every user sees only what their role allows
2. **Facility-Scoped**: All data is scoped to the hospital facility
3. **Audit-Logged**: Every action is recorded with timestamp, user, and IP
4. **Queue-Driven**: Patient flow is managed through a shared queue system
5. **Encounter-Centered**: The clinical encounter links all patient interactions

---

## 2. Architecture & Technology

### Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, shadcn/ui, Tailwind CSS v4 |
| State & Data | TanStack React Query 5, Zustand 5 |
| Forms | React Hook Form + Zod validation |
| Authentication | Better Auth 1.6 |
| ORM | Prisma 7.8 (PostgreSQL driver adapter) |
| Database | PostgreSQL |
| HTTP Client | Axios |
| Icons | Lucide React |
| Notifications | Sonner (toast) |
| Package Manager | pnpm |

### Request Flow

```
Browser/Client
    ↓
Next.js Pages (Server Components)
    ↓
Service Layer (TanStack Query hooks)
    ↓
API Routes (app/api/)
    ↓
Prisma ORM
    ↓
PostgreSQL Database
```

### Authentication Flow

1. Staff member opens the website
2. Redirected to `/login` if not authenticated
3. Enters email and password
4. Better Auth validates credentials
5. Session cookie is established
6. User is redirected to their role's dashboard

### Route Protection

- **Server pages**: Each layout calls `requireRolePage(pathname, allowedRoles)`
- **API routes**: Each handler calls `requireRoleApi(request, allowedRoles)`
- **Client Axios**: Intercepts 401 responses and redirects to `/session-expired`

---

## 3. Roles & Access Control

### Available Roles

| Role | Dashboard | Description |
|------|-----------|-------------|
| `SUPER_ADMIN` | `/super-admin/dashboard` | Full system access — staff management, roles, permissions, departments, settings, audit logs |
| `HOSPITAL_ADMIN` | `/hospital-admin/dashboard` | Hospital-level dashboards, department workload, staff activity, appointments, queue, billing oversight |
| `MUNICIPAL_HEALTH_DIRECTOR` | `/unauthorized` | Cross-facility oversight (read-only) |
| `M_AND_E_OFFICER` | `/unauthorized` | Monitoring, evaluation, HMIS data (read-only) |
| `RECORDS_OFFICER` | `/records-officer` | Patient registration, records management, appointments, check-in, queue |
| `FRONT_DESK` | `/records-officer` | Patient check-in, appointment management |
| `DOCTOR` | `/clinician` | Clinical encounters, SOAP notes, diagnoses, prescriptions, referrals |
| `PHYSICIAN_ASSISTANT` | `/clinician` | Clinical encounters (supervised) |
| `NURSE` | `/nurse/dashboard` | Triage, vital signs capture, nursing notes, immunizations |
| `LAB_TECHNICIAN` | `/unauthorized` | Lab requests, sample tracking, result entry (UI in progress) |
| `PHARMACIST` | `/unauthorized` | Prescriptions, dispensing, stock management (UI in progress) |
| `BILLING_OFFICER` | `/unauthorized` | Invoicing, payment processing (UI in progress) |

### Permission Model

- Roles are assigned to users via the `UserRole` model
- Permissions can be attached to roles via `RolePermission`
- System roles are marked with `isSystem: true`
- Every user has a `defaultRole` that determines their primary dashboard

---

## 4. Complete Patient Journey

This section traces a patient through the entire system, from arrival to discharge.

### Stage 1: Patient Registration

**Who:** Records Officer
**Where:** `/records-officer/patients/register`
**Model:** `Patient`

When a new patient arrives at the hospital for the first time, the records officer creates their permanent folder.

#### What Happens

1. Records officer navigates to the Register page
2. Fills in the patient form:
   - **Required**: First name, last name, gender
   - **Optional**: Date of birth (or estimated age), phone, address, community, NHIS number, national ID, emergency contact, marital status, blood group
3. Submits the form
4. System generates a unique patient number (e.g., `SDA-P-0001`)
5. Patient record is created with status `ACTIVE`
6. Patient is linked to the registering facility

#### Database Record Created

```sql
Patient {
  id: "cuid"
  patientNo: "SDA-P-0001"  -- Auto-generated
  firstName: "Akua"
  lastName: "Mensah"
  gender: "FEMALE"
  status: "ACTIVE"
  registeredFacilityId: "facility-id"
  registeredById: "staff-id"
  -- ... other fields
}
```

#### What the Records Officer Sees

After registration, the officer can:
- Open the patient profile
- Book an appointment
- Send the patient to the queue
- Search for the patient later

---

### Stage 2: Appointment & Check-In

**Who:** Records Officer
**Where:** `/records-officer/appointments`, `/records-officer/check-in`
**Models:** `Appointment`, `PatientQueue`

There are two paths: **appointment-based** and **walk-in**.

#### Path A: Appointment Booking

1. Records officer selects a patient
2. Chooses a department (e.g., General Consultation)
3. Selects a clinician (doctor/PA)
4. Sets appointment date and time
5. Enters a reason for the visit
6. Saves the appointment

**Database Record Created:**

```sql
Appointment {
  appointmentNo: "APT-SDA-0001"
  patientId: "patient-id"
  facilityId: "facility-id"
  departmentId: "consultation-dept-id"
  clinicianId: "doctor-id"
  title: "OPD consultation"
  reason: "Fever and headache"
  scheduledAt: "2026-07-15T09:00:00Z"
  status: "SCHEDULED"
  createdById: "staff-id"
}
```

#### Path B: Walk-In Check-In

1. Patient arrives without appointment
2. Records officer finds or creates the patient record
3. Clicks "Check-In"
4. System creates a queue entry

**What Happens on Check-In:**

```sql
-- If appointment exists, update it
Appointment.status = "CHECKED_IN"

-- Create queue entry
PatientQueue {
  queueNo: "TR-001"  -- Auto-generated
  patientId: "patient-id"
  departmentId: "triage-dept-id"
  status: "WAITING"
  priority: "ROUTINE"
  arrivedAt: now()
}
```

#### The Queue System

The `PatientQueue` model tracks the patient's position in the hospital flow:

| Status | Meaning |
|--------|---------|
| `WAITING` | Patient has arrived, waiting for triage |
| `IN_TRIAGE` | Nurse is actively assessing the patient |
| `WITH_CLINICIAN` | Patient is ready for doctor/PA consultation |
| `AWAITING_LAB` | Lab tests have been ordered |
| `AWAITING_PHARMACY` | Medication has been prescribed |
| `COMPLETED` | Visit is finished |
| `CANCELLED` | Queue entry was cancelled |

---

### Stage 3: Triage (Nurse)

**Who:** Nurse
**Where:** `/nurse/triage-queue`, `/nurse/vitals/capture`
**Models:** `PatientQueue`, `VitalSigns`

The nurse is the first clinical contact after registration. Triage determines how urgent the patient's condition is.

#### Step 3a: Start Triage

1. Nurse opens the Triage Queue
2. Sees patients with status `WAITING`
3. Clicks "Start" on a patient
4. Queue status changes: `WAITING` → `IN_TRIAGE`

#### Step 3b: Capture Vital Signs

The nurse navigates to the Vitals Capture page and records:

| Vital | Field | Unit |
|-------|-------|------|
| Temperature | `temperatureC` | °C |
| Systolic Blood Pressure | `systolicBp` | mmHg |
| Diastolic Blood Pressure | `diastolicBp` | mmHg |
| Pulse Rate | `pulseRate` | bpm |
| Respiratory Rate | `respiratoryRate` | breaths/min |
| Oxygen Saturation | `oxygenSaturation` | % |
| Weight | `weightKg` | kg |
| Height | `heightCm` | cm |
| Pain Score | `painScore` | 0-10 |

**Auto-Calculations:**
- BMI is calculated from weight and height: `BMI = weight / (height/100)²`

**Triage Priority Assignment:**

Based on the vitals and clinical assessment, the nurse assigns a priority:

| Priority | Meaning | Color Code |
|----------|---------|------------|
| `ROUTINE` | Normal, non-urgent | Green |
| `PRIORITY` | Needs attention soon | Blue |
| `URGENT` | Needs immediate attention | Orange |
| `EMERGENCY` | Life-threatening | Red |

#### Step 3c: Send to Clinician

After capturing vitals, the nurse has two options:

1. **Save Vitals Only** - Saves vitals and stays on the page
2. **Save & Send To Clinician** - Saves vitals AND changes queue status

When "Send" is clicked:

```sql
-- Vitals are saved
VitalSigns {
  patientId: "patient-id"
  temperatureC: 38.4
  systolicBp: 128
  diastolicBp: 82
  pulseRate: 96
  triagePriority: "URGENT"
  capturedById: "nurse-id"
  capturedAt: now()
}

-- Queue status is updated
PatientQueue.status = "WITH_CLINICIAN"
PatientQueue.calledAt = now()
PatientQueue.priority = "URGENT"  -- Updated from triage
```

#### Emergency Path

If the patient is critical:
1. Nurse clicks "Flag" on the queue entry
2. Priority is set to `EMERGENCY`
3. A notification is sent to clinicians: `{ notifyClinician: true }`
4. Patient appears in the Emergency Watch panel
5. Patient is highlighted on the Queue Board

#### What the Nurse Sees

**Dashboard (`/nurse/dashboard`):**
- Metric cards: waiting count, triage count, emergency count, recent vitals
- Live Queue table: patients awaiting triage
- Emergency Watch sidebar: critical cases
- Recent Vitals sidebar: nurse's latest captures

**Triage Queue (`/nurse/triage-queue`):**
- Filterable table with search, date, department, priority, status
- Action buttons: Start, Send, Vitals, Flag, Cancel, Profile
- Real-time queue status

---

### Stage 4: Clinical Consultation (Doctor/PA)

**Who:** Doctor or Physician Assistant
**Where:** `/clinician`
**Models:** `Encounter`, `ClinicalNote`, `Diagnosis`, `Prescription`, `LabRequest`, `Referral`

The clinician is the primary decision-maker. They review the patient, create a clinical record, and order tests/medications.

#### Step 4a: Pick Up Patient

1. Doctor logs in and sees the clinician queue
2. Patients with status `WITH_CLINICIAN` are displayed
3. Doctor selects a patient to consult

#### Step 4b: Create Encounter

The doctor creates an `Encounter` — the central record for this visit:

```sql
Encounter {
  encounterNo: "ENC-SDA-0001"  -- Auto-generated
  patientId: "patient-id"
  facilityId: "facility-id"
  departmentId: "consultation-dept-id"
  clinicianId: "doctor-id"
  queueId: "queue-entry-id"
  visitType: "OPD"
  status: "DRAFT"
  chiefComplaint: "Fever and headache"
  startedAt: now()
}
```

#### Step 4c: Write Clinical Notes (SOAP)

The doctor writes a clinical note using the SOAP format:

```sql
ClinicalNote {
  patientId: "patient-id"
  encounterId: "encounter-id"
  subjective: "Patient reports 3-day history of fever and frontal headache..."
  objective: "Temp 38.4°C, BP 128/82, HR 96. Patient appears flushed..."
  assessment: "Likely viral Upper Respiratory Tract Infection..."
  plan: "1. Paracetamol 500mg TDS x 5 days
         2. Rest and fluids
         3. Return if symptoms worsen"
  notes: "Patient counseled on medication adherence"
  authoredById: "doctor-id"
  signedAt: now()  -- When doctor signs off
}
```

#### Step 4d: Record Diagnosis

```sql
Diagnosis {
  patientId: "patient-id"
  encounterId: "encounter-id"
  code: "J06.9"  -- ICD-10 code (optional)
  name: "Acute Upper Respiratory Tract Infection"
  isPrimary: true
  notes: "Viral etiology suspected"
  diagnosedById: "doctor-id"
}
```

#### Step 4e: Order Labs (if needed)

If lab tests are needed:

```sql
LabRequest {
  requestNo: "LAB-20260715-12345678-ABCDEFGH"
  patientId: "patient-id"
  encounterId: "encounter-id"
  requestedById: "doctor-id"
  priority: "ROUTINE"  -- or URGENT, STAT
  status: "REQUESTED"
  clinicalNotes: "Rule out malaria and typhoid"
  requestedAt: now()
}

-- For each test ordered
LabRequestTest {
  labRequestId: "lab-request-id"
  testId: "test-catalog-id"  -- e.g., "Malaria RDT", "Full Blood Count"
  notes: "Fasting not required"
}
```

**Queue transitions when labs are ordered:**
- `PatientQueue.status`: `WITH_CLINICIAN` → `AWAITING_LAB`
- `Encounter.status`: `IN_PROGRESS` → `AWAITING_LAB`

#### Step 4f: Prescribe Medication (if needed)

```sql
Prescription {
  prescriptionNo: "RX-20260715-12345678-ABCDEFGH"
  patientId: "patient-id"
  encounterId: "encounter-id"
  prescribedById: "doctor-id"
  status: "ISSUED"
  notes: "Take after meals"
  issuedAt: now()
}

PrescriptionItem {
  prescriptionId: "prescription-id"
  medicationId: "medication-id"  -- Links to Pharmacy stock
  medicineName: "Paracetamol 500mg"
  dosage: "500mg"
  frequency: "TDS"  -- Three times daily
  duration: "5 days"
  quantity: 15
  instructions: "Take one tablet after meals"
}
```

**Queue transitions when medication is prescribed:**
- `PatientQueue.status`: `WITH_CLINICIAN` → `AWAITING_PHARMACY`
- `Encounter.status`: `IN_PROGRESS` → `AWAITING_PHARMACY`

#### Step 4g: Create Referral (if needed)

If the patient needs to be referred to another facility or department:

```sql
Referral {
  referralNo: "REF-20260715-12345678-ABCDEFGH"
  patientId: "patient-id"
  encounterId: "encounter-id"
  fromFacilityId: "current-facility-id"
  toFacilityId: "target-facility-id"
  fromDepartmentId: "current-dept-id"
  toDepartmentId: "target-dept-id"
  referredById: "doctor-id"
  reason: "Requires specialist cardiology review"
  clinicalSummary: "Patient with chest pain and abnormal ECG..."
  urgency: "URGENT"
  status: "SENT"
  sentAt: now()
}
```

#### Step 4h: Complete the Encounter

When the doctor is finished:

1. Ensures a signed clinical note exists
2. Ensures a primary diagnosis is recorded
3. Checks that all pending lab requests are resolved
4. Optionally records a follow-up appointment or referral
5. Marks encounter as `COMPLETED`

```sql
Encounter.status = "COMPLETED"
Encounter.completedAt = now()
PatientQueue.status = "COMPLETED"
PatientQueue.completedAt = now()
```

---

### Stage 5: Laboratory

**Who:** Lab Technician
**Where:** (UI in progress — schema ready)
**Models:** `LabRequest`, `LabRequestTest`, `LabSample`, `LabResult`, `LabResultItem`

The lab processes tests ordered by the doctor.

#### Lab Workflow States

```
REQUESTED → SAMPLE_COLLECTED → PROCESSING → PARTIAL_RESULT → COMPLETED
```

| Status | Meaning |
|--------|---------|
| `REQUESTED` | Doctor has ordered the test |
| `SAMPLE_COLLECTED` | Sample has been collected from patient |
| `PROCESSING` | Lab is analyzing the sample |
| `PARTIAL_RESULT` | Some results are ready |
| `COMPLETED` | All results are finalized |
| `CANCELLED` | Test was cancelled |

#### Sample Tracking

```sql
LabSample {
  sampleNo: "SMP-001"
  labRequestId: "lab-request-id"
  sampleType: "Blood"
  status: "COLLECTED"
  collectedById: "nurse-id"
  collectedAt: now()
}
```

#### Result Entry

```sql
LabResult {
  id: "result-id"
  labRequestId: "lab-request-id"
  patientId: "patient-id"
  encounterId: "encounter-id"
  status: "ENTERED"  -- or VALIDATED, RELEASED
  validatedById: "senior-lab-tech-id"
  validatedAt: now()
}

LabResultItem {
  resultId: "result-id"
  testId: "test-catalog-id"
  testName: "Malaria RDT"
  value: "Positive"
  unit: null
  referenceRange: null
  isAbnormal: true
  notes: "Plasmodium falciparum suspected"
}
```

#### Return to Clinician

After results are ready:
- Lab marks the request as `COMPLETED`
- Queue status can transition back to `WITH_CLINICIAN` for doctor review
- Or directly to `COMPLETED` if no further action is needed

---

### Stage 6: Pharmacy

**Who:** Pharmacist
**Where:** (UI in progress — schema ready)
**Models:** `Prescription`, `PrescriptionItem`, `Dispensing`, `DispenseItem`, `MedicationStock`, `StockMovement`

The pharmacy dispenses medications prescribed by the doctor.

#### Pharmacy Workflow States

```
Prescription: DRAFT → ISSUED → PARTIALLY_DISPENSED → DISPENSED
Dispensing:   PENDING → PARTIAL → COMPLETED
```

When this facility cannot supply the remaining medicine, the pharmacist can
move an `ISSUED` or `PARTIALLY_DISPENSED` prescription to
`EXTERNALLY_RELEASED`. This records who handed the remainder back to the
patient, when it happened, and why. It completes the pharmacy queue and
encounter without creating a false dispensing record, reducing facility stock,
or creating a stock movement. Medicines already dispensed remain immutable.

#### Dispensing Process

1. Pharmacist receives the prescription
2. Verifies medication availability in stock
3. Creates a `Dispensing` record
4. For each `PrescriptionItem`, creates a `DispenseItem`
5. Updates `MedicationStock` (deducts quantity)
6. Records a `StockMovement` of type `DISPENSE`

```sql
Dispensing {
  dispenseNo: "DSP-001"
  prescriptionId: "prescription-id"
  patientId: "patient-id"
  status: "COMPLETED"
  dispensedById: "pharmacist-id"
  dispensedAt: now()
  counsellingNotes: "Take after meals. Complete full course."
}

DispenseItem {
  dispensingId: "dispensing-id"
  prescriptionItemId: "prescription-item-id"
  medicationId: "medication-id"
  medicineName: "Paracetamol 500mg"
  quantityDispensed: 15
  notes: null
}

-- Stock is deducted
MedicationStock.quantityOnHand = quantityOnHand - 15

-- Movement recorded
StockMovement {
  stockId: "stock-id"
  medicationId: "medication-id"
  type: "DISPENSE"
  quantity: 15
  reason: "Dispensed to patient SDA-P-0001"
  reference: "DSP-001"
  performedById: "pharmacist-id"
}
```

#### Stock Management

The pharmacy can also:
- Record new stock purchases (`PURCHASE`)
- Record donations (`DONATION`)
- Adjust stock for expired items (`EXPIRED`)
- Adjust stock for damaged items (`DAMAGED`)
- Transfer stock between facilities (`TRANSFER_OUT`, `TRANSFER_IN`)

---

### Stage 7: Billing

**Who:** Billing Officer
**Where:** (UI in progress — schema ready)
**Models:** `Invoice`, `InvoiceItem`, `Payment`

Billing generates invoices for services rendered and processes payments.

#### Invoice Lifecycle

```
DRAFT → ISSUED → PARTIALLY_PAID → PAID
```

> **Current enforcement:** Pharmacy can read the latest invoice status, but it
> cannot confirm payment and billing does not block dispensing, external
> prescription release, encounter completion, or queue completion. A strict
> financial-clearance gate is not yet implemented because NHIS, waiver,
> emergency, credit, and approved-discharge exceptions must be defined first.

| Status | Meaning |
|--------|---------|
| `DRAFT` | Invoice is being prepared |
| `ISSUED` | Invoice has been sent to patient |
| `PARTIALLY_PAID` | Some payment has been received |
| `PAID` | Fully paid |
| `VOID` | Invoice was voided |
| `CANCELLED` | Invoice was cancelled |

#### Creating an Invoice

```sql
Invoice {
  invoiceNo: "INV-SDA-0001"
  patientId: "patient-id"
  encounterId: "encounter-id"
  facilityId: "facility-id"
  status: "ISSUED"
  subtotal: 120.00
  discountAmount: 0.00
  taxAmount: 0.00
  totalAmount: 120.00
  amountPaid: 0.00
  balanceDue: 120.00
  issuedAt: now()
  createdById: "billing-staff-id"
}
```

#### Invoice Items

Each service or product is an invoice item:

```sql
InvoiceItem {
  invoiceId: "invoice-id"
  description: "Consultation Fee"
  itemType: "CONSULTATION"
  quantity: 1
  unitPrice: 50.00
  totalPrice: 50.00
  referenceId: null
}

InvoiceItem {
  invoiceId: "invoice-id"
  description: "Malaria RDT"
  itemType: "LAB_TEST"
  quantity: 1
  unitPrice: 20.00
  totalPrice: 20.00
  referenceId: "lab-request-id"  -- Links to lab request
}

InvoiceItem {
  invoiceId: "invoice-id"
  description: "Paracetamol 500mg x 15"
  itemType: "MEDICATION"
  quantity: 1
  unitPrice: 50.00
  totalPrice: 50.00
  referenceId: "prescription-id"  -- Links to prescription
}
```

#### Processing Payments

```sql
Payment {
  receiptNo: "RCP-001"
  invoiceId: "invoice-id"
  method: "CASH"  -- or MOBILE_MONEY, CARD, BANK_TRANSFER, NHIS, WAIVER
  status: "SUCCESSFUL"
  amount: 80.00
  reference: null
  receivedById: "billing-staff-id"
  paidAt: now()
}

-- Invoice is updated
Invoice.amountPaid = 80.00
Invoice.balanceDue = 40.00
Invoice.status = "PARTIALLY_PAID"
```

#### Payment Methods

| Method | Description |
|--------|-------------|
| `CASH` | Cash payment |
| `MOBILE_MONEY` | Mobile money (MTN, Vodafone, AirtelTigo) |
| `CARD` | Credit/debit card |
| `BANK_TRANSFER` | Bank transfer |
| `NHIS` | National Health Insurance Scheme |
| `WAIVER` | Fee waiver (charity, staff, etc.) |
| `OTHER` | Other payment method |

---

### Stage 8: Discharge

**Who:** System (automatic)
**Where:** N/A
**Models:** `PatientQueue`, `Encounter`

When all clinical activities are complete, the patient is discharged.

#### Completion Criteria

The encounter can be marked `COMPLETED` when:
- A signed clinical note exists
- A primary diagnosis is recorded
- All pending lab requests are resolved (or explicitly completed)
- A follow-up appointment or referral is recorded (warning if not)

#### What Happens

```sql
-- Queue entry is completed
PatientQueue {
  status: "COMPLETED"
  completedAt: now()
}

-- Encounter is completed
Encounter {
  status: "COMPLETED"
  completedAt: now()
}
```

#### After Discharge

- All records are permanently stored
- Patient can be searched and their history viewed
- Future visits can reference past encounters
- The patient folder remains active for re-visits

---

## 5. Role Dashboards

### Records Officer Dashboard

**URL:** `/records-officer`

**What It Shows:**
- Total patients registered
- Today's appointments
- Active queue count
- Recent registrations

**Key Actions:**
- Register new patients
- Book appointments
- Check in patients
- Manage queue
- View patient profiles
- Print/export records

### Nurse Dashboard

**URL:** `/nurse/dashboard`

**What It Shows:**
- Patients awaiting triage
- Emergency watch list
- Recent vitals captured
- Queue statistics

**Key Actions:**
- Start triage
- Capture vital signs
- Flag emergencies
- Send patients to clinician
- View patient profiles
- Manage immunizations

### Doctor/PA Dashboard (Clinician)

**URL:** `/clinician`

**What It Shows:**
- Patients awaiting consultation
- Active encounters
- Pending lab results
- Pending prescriptions

**Key Actions:**
- Create encounters
- Write SOAP notes
- Record diagnoses
- Order lab tests
- Prescribe medications
- Create referrals
- Complete encounters

### Hospital Admin Dashboard

**URL:** `/hospital-admin/dashboard`

**What It Shows:**
- Operational metrics
- Patient flow summary
- Department activity
- Staff activity
- Billing summary
- Recent audit logs

**Key Actions:**
- Manage staff (except super admin)
- Manage departments
- Oversee appointments
- Monitor queue
- View reports
- Send notifications
- Review audit logs

### Super Admin Dashboard

**URL:** `/super-admin/dashboard`

**What It Shows:**
- System-wide metrics
- Staff count by role
- Department count
- Recent audit activity

**Key Actions:**
- Manage all staff
- Manage roles and permissions
- Manage departments
- Update system settings
- Review audit logs
- Generate reports

---

## 6. Database Models & Relationships

### Core Models

```
┌─────────────────────────────────────────────────────────────────┐
│                         PATIENT                                  │
│  - patientNo, firstName, lastName, gender, dateOfBirth          │
│  - phone, community, residentialAddress                         │
│  - nhisNumber, nationalId, bloodGroup, status                   │
│  - registeredFacilityId, registeredById                         │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ├── PatientQueue (queue entries)
                ├── VitalSigns (vital signs records)
                ├── PatientAllergy (allergies)
                ├── ChronicCondition (chronic conditions)
                ├── MedicationHistory (past medications)
                ├── PatientDocument (uploaded documents)
                ├── ImmunizationRecord (vaccines)
                ├── Encounter (clinical visits)
                ├── Appointment (scheduled visits)
                ├── LabRequest (lab orders)
                ├── Prescription (medication orders)
                ├── Invoice (billing)
                └── Referral (referrals)
```

### Clinical Models

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENCOUNTER                                 │
│  - encounterNo, patientId, facilityId, departmentId             │
│  - clinicianId, queueId, visitType, status                      │
│  - chiefComplaint, startedAt, completedAt                       │
└───────────────┬─────────────────────────────────────────────────┘
                │
                ├── ClinicalNote (SOAP notes)
                ├── Diagnosis (diagnoses)
                ├── VitalSigns (vital signs)
                ├── LabRequest (lab orders)
                │     └── LabRequestTest
                │     └── LabSample
                │     └── LabResult
                │           └── LabResultItem
                ├── Prescription (medication orders)
                │     └── PrescriptionItem
                │           └── DispenseItem
                ├── Invoice (billing)
                │     └── InvoiceItem
                │     └── Payment
                └── Referral (referrals)
```

### Queue Flow Model

```
┌─────────────────────────────────────────────────────────────────┐
│                       PATIENT QUEUE                              │
│  - queueNo, patientId, appointmentId, departmentId              │
│  - assignedToId, priority, status                               │
│  - arrivedAt, calledAt, completedAt, cancelledAt                │
└───────────────┬─────────────────────────────────────────────────┘
                │
                └── Encounter (linked when doctor picks up patient)
```

### Key Relationships

| Relationship | Description |
|--------------|-------------|
| Patient → PatientQueue | One patient can have many queue entries |
| Patient → Encounter | One patient can have many encounters |
| Encounter → ClinicalNote | One encounter has one clinical note |
| Encounter → Diagnosis | One encounter can have many diagnoses |
| Encounter → Prescription | One encounter can have many prescriptions |
| Encounter → LabRequest | One encounter can have many lab requests |
| Encounter → Invoice | One encounter can have one invoice |
| Prescription → Dispensing | One prescription has one dispensing record |
| LabRequest → LabResult | One lab request has one result |
| Invoice → Payment | One invoice can have many payments |
| PatientQueue → Encounter | One queue entry links to one encounter |

---

## 7. State Machines

### PatientQueue Status Flow

```
                    ┌──────────────┐
                    │   WAITING    │
                    └──────┬───────┘
                           │
                    Nurse clicks "Start"
                           │
                           ▼
                    ┌──────────────┐
           ┌───────│  IN_TRIAGE   │◄──────────────┐
           │       └──────┬───────┘               │
           │              │                       │
           │     Nurse clicks "Send"              │
           │              │                       │
           │              ▼                       │
           │       ┌──────────────┐               │
           │       │WITH_CLINICIAN│───────────────┘
           │       └──────┬───────┘    (return from lab/pharmacy)
           │              │
           │    ┌─────────┼─────────┐
           │    │         │         │
           │    ▼         ▼         ▼
           │ ┌──────┐ ┌──────┐ ┌──────────┐
           │ │ AWAIT│ │ AWAIT│ │ COMPLETED│
           │ │ _LAB │ │ _PHAR│ │          │
           │ └──┬───┘ └──┬───┘ └──────────┘
           │    │         │
           │    └────┬────┘
           │         │
           │         ▼
           │  (back to WITH_CLINICIAN)
           │
    ┌──────┴───────┐
    │  CANCELLED   │
    └──────────────┘
```

### Encounter Status Flow

```
    ┌──────────┐
    │  DRAFT   │
    └────┬─────┘
         │
    Doctor starts consultation
         │
         ▼
    ┌──────────────┐
    │ IN_PROGRESS  │◄──────────────────────┐
    └──────┬───────┘                       │
           │                               │
    ┌──────┼───────┐                       │
    │      │       │                       │
    ▼      ▼       ▼                       │
┌──────┐┌──────┐┌──────────┐               │
│AWAIT ││AWAIT ││ COMPLETED│               │
│_LAB  ││_PHAR ││          │               │
└──┬───┘└──┬───┘└──────────┘               │
   │       │                               │
   └───┬───┘                               │
       │                                   │
       └───────────────────────────────────┘
            (return from lab/pharmacy)
```

### LabRequest Status Flow

```
┌───────────┐     ┌──────────────┐     ┌────────────┐
│ REQUESTED │────►│SAMPLE_COLLECT│────►│ PROCESSING │
└───────────┘     └──────────────┘     └─────┬──────┘
                                             │
                                    ┌────────┴────────┐
                                    │                  │
                                    ▼                  ▼
                             ┌─────────────┐    ┌──────────┐
                             │PARTIAL_RESULT│   │ COMPLETED│
                             └──────┬──────┘    └──────────┘
                                    │
                                    ▼
                             ┌──────────┐
                             │ COMPLETED│
                             └──────────┘
```

### Prescription Status Flow

```
┌───────┐     ┌────────┐     ┌─────────────────────┐     ┌───────────┐
│ DRAFT │────►│ ISSUED │────►│ PARTIALLY_DISPENSED │────►│ DISPENSED │
└───────┘     └────────┘     └─────────────────────┘     └───────────┘
```

### Invoice Status Flow

```
┌───────┐     ┌────────┐     ┌───────────────┐     ┌──────┐
│ DRAFT │────►│ ISSUED │────►│PARTIALLY_PAID │────►│ PAID │
└───────┘     └────────┘     └───────────────┘     └──────┘
```

---

## 8. API Routes & Data Flow

### Authentication Routes

| Method | Route | Description |
|--------|-------|-------------|
| ALL | `/api/auth/*` | Better Auth endpoints (sign in, sign out, sessions) |

### Records Officer Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/records-officer/dashboard` | Dashboard metrics and queue |
| GET | `/api/records-officer/patients` | Search patients |
| POST | `/api/records-officer/patients` | Register new patient |
| GET | `/api/records-officer/patients/:id` | Patient profile |
| PATCH | `/api/records-officer/patients/:id` | Update patient |
| GET | `/api/records-officer/patients/:id/documents` | Patient documents |
| POST | `/api/records-officer/patients/:id/documents` | Add document |
| GET | `/api/records-officer/appointments` | List appointments |
| POST | `/api/records-officer/appointments` | Create appointment |
| PATCH | `/api/records-officer/appointments/:id` | Update appointment |
| POST | `/api/records-officer/check-in` | Check in patient |
| GET | `/api/records-officer/queue` | Queue entries |
| POST | `/api/records-officer/queue` | Add to queue |
| PATCH | `/api/records-officer/queue/:id` | Update queue entry |

### Nurse Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/nurse/dashboard` | Dashboard metrics and queue |
| GET | `/api/nurse/triage-queue` | Triage queue entries |
| PATCH | `/api/nurse/triage-queue/:id` | Update queue status/priority |
| POST | `/api/nurse/triage-queue/:id/emergency-flag` | Flag as emergency |
| GET | `/api/nurse/patients/:id/vitals` | Patient vitals history |
| POST | `/api/nurse/patients/:id/vitals` | Capture vitals |
| PATCH | `/api/nurse/patients/:id/vitals/:vitalId` | Update vitals |
| GET | `/api/nurse/patients/:id/triage-profile` | Patient triage profile |
| GET | `/api/nurse/patients/:id/immunizations` | Immunization records |
| POST | `/api/nurse/patients/:id/immunizations` | Add immunization |
| PATCH | `/api/nurse/patients/:id/immunizations/:immunizationId` | Update immunization |
| GET | `/api/nurse/notifications` | Nurse notifications |
| PATCH | `/api/nurse/notifications/:id` | Update notification status |
| GET | `/api/nurse/lookups` | Departments, priorities, statuses |

### Hospital Admin Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/hospital-admin/dashboard` | Dashboard metrics |
| GET | `/api/hospital-admin/staff` | List staff |
| POST | `/api/hospital-admin/staff` | Create staff |
| PATCH | `/api/hospital-admin/staff/:id` | Update staff |
| GET | `/api/hospital-admin/departments` | List departments |
| POST | `/api/hospital-admin/departments` | Create department |
| PATCH | `/api/hospital-admin/departments/:id` | Update department |
| GET | `/api/hospital-admin/appointments` | List appointments |
| POST | `/api/hospital-admin/appointments` | Create appointment |
| PATCH | `/api/hospital-admin/appointments/:id` | Update appointment |
| GET | `/api/hospital-admin/queue` | Queue entries |
| POST | `/api/hospital-admin/queue` | Add to queue |
| PATCH | `/api/hospital-admin/queue/:id` | Update queue entry |
| GET | `/api/hospital-admin/reports` | Report exports |
| POST | `/api/hospital-admin/reports` | Create report |
| GET | `/api/hospital-admin/notifications` | Notifications |
| POST | `/api/hospital-admin/notifications` | Create notification |
| GET | `/api/hospital-admin/audit-logs` | Audit logs |

### Super Admin Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/super-admin/dashboard` | Dashboard metrics |
| GET | `/api/super-admin/staff` | List all staff |
| POST | `/api/super-admin/staff` | Create staff |
| PATCH | `/api/super-admin/staff/:id` | Update staff |
| GET | `/api/super-admin/roles` | List roles |
| GET | `/api/super-admin/permissions` | List permissions |
| PATCH | `/api/super-admin/roles/:id` | Update role permissions |
| GET | `/api/super-admin/departments` | List departments |
| POST | `/api/super-admin/departments` | Create department |
| PATCH | `/api/super-admin/departments/:id` | Update department |
| GET | `/api/super-admin/settings` | System settings |
| PATCH | `/api/super-admin/settings` | Update settings |
| GET | `/api/super-admin/audit-logs` | Audit logs |

### Clinician Routes (In Progress)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/clinician/dashboard` | Dashboard metrics |
| GET | `/api/clinician/queue` | Clinician queue |
| GET | `/api/clinician/encounters` | List encounters |
| POST | `/api/clinician/encounters` | Create encounter |
| PATCH | `/api/clinician/encounters/:id` | Update encounter |
| POST | `/api/clinician/encounters/:id/notes` | Create/update SOAP note |
| POST | `/api/clinician/encounters/:id/diagnoses` | Add diagnosis |
| POST | `/api/clinician/encounters/:id/prescriptions` | Create prescription |
| POST | `/api/clinician/encounters/:id/lab-requests` | Order labs |
| POST | `/api/clinician/encounters/:id/referrals` | Create referral |

---

## Appendix A: Default Seed Data

### Facility

| Field | Value |
|-------|-------|
| Code | `SDA-KWADASO` |
| Name | SDA Hospital Kwadaso |
| Type | HOSPITAL |
| Phone | +233 302 000 000 |
| Email | info@sdakwadaso.health |
| Address | SDA Hospital, Kwadaso, Kumasi |
| Municipality | Kwadaso |
| Region | Ashanti |

### Departments

| Code | Name | Type |
|------|------|------|
| ADMIN | Administration | ADMINISTRATION |
| RECORDS | Records Office | RECORDS |
| OPD | Outpatient Department | OPD |
| TRIAGE | Triage | TRIAGE |
| CONSULT | General Consultation | GENERAL_CONSULTATION |
| LAB | Laboratory | LABORATORY |
| PHARM | Pharmacy | PHARMACY |
| BILL | Billing | BILLING |
| PUBHEALTH | Public Health | PUBLIC_HEALTH |

### Demo Staff Accounts

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@kwadaso.health | ChangeMe123! |
| Hospital Admin | hospitaladmin@kwadaso.health | ChangeMe123! |
| Nurse | nurse@kwadaso.health | ChangeMe123! |
| Records Officer | recordofficer@kwadaso.health | ChangeMe123! |

### Sample Medications

| Code | Name | Category | Unit Cost | Selling Price |
|------|------|----------|-----------|---------------|
| MED-PAR-500 | Paracetamol 500mg | Analgesic | 0.25 | 0.50 |
| MED-AMO-500 | Amoxicillin 500mg | Antibiotic | 1.10 | 1.80 |
| MED-ORS-SAC | Oral Rehydration Salts | Rehydration | 0.75 | 1.20 |

---

## Appendix B: System Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_API_URL` | Yes | Base URL for API requests |
| `BETTER_AUTH_SECRET` | No | Secret key for session signing |
| `BETTER_AUTH_URL` | No | Base URL for auth callbacks |

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm seed` | Seed database with initial data |
| `pnpm prisma migrate dev` | Run database migrations |
| `pnpm prisma studio` | Open Prisma Studio |

---

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **Encounter** | A clinical visit between a patient and a clinician |
| **SOAP Note** | Subjective, Objective, Assessment, Plan — standard clinical note format |
| **Triage** | Initial assessment to determine urgency of care needed |
| **Queue** | System tracking patient flow through the hospital |
| **Queue Number** | Unique identifier for a patient's position in the queue |
| **Patient Number** | Unique identifier for a patient's permanent record |
| **Facility** | The hospital or health center using KHIP |
| **Department** | A functional unit within the facility (e.g., Triage, Lab, Pharmacy) |
| **Role** | The access level assigned to a staff member |
| **Audit Log** | Record of all system actions for compliance and security |
| **NHIS** | National Health Insurance Scheme (Ghana) |
| **OPD** | Outpatient Department |

---

*Document Version: 1.0*
*Last Updated: July 2026*
*KHIP — Kwadaso HealthLink Integrated Platform*
