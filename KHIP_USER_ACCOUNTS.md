# KHIP User Accounts & Access Guide

**Kwadaso HealthLink Integrated Platform**

This document lists all demo user accounts and provides a complete walkthrough of the patient journey from registration to discharge.

---

## Default Password

All accounts use the same password:

```
ChangeMe123!
```

**Important:** Change these passwords immediately in production.

---

## User Accounts

### System Administration

| Role | Name | Email | Staff ID | Department | Dashboard |
|------|------|-------|----------|------------|-----------|
| Super Admin | Kwadaso Super Admin | `superadmin@kwadaso.health` | KHS-SA-001 | Administration | `/super-admin/dashboard` |

**Access:** Full system access — staff management, roles, permissions, departments, settings, audit logs.

---

### Hospital Administration

| Role | Name | Email | Staff ID | Department | Dashboard |
|------|------|-------|----------|------------|-----------|
| Hospital Admin | Kwadaso Hospital Admin | `hospitaladmin@kwadaso.health` | KHS-HA-001 | Administration | `/hospital-admin/dashboard` |

**Access:** Hospital-level dashboards, department workload, staff activity, appointments, queue, billing oversight, notifications, reports.

---

### Public Health (Read-Only)

| Role | Name | Email | Staff ID | Department | Dashboard |
|------|------|-------|----------|------------|-----------|
| Municipal Health Director | Nana Owusu | `director@kwadaso.health` | KHS-MHD-001 | Public Health | `/unauthorized` |
| M&E Officer | Yaw Asare | `monitoring@kwadaso.health` | KHS-ME-001 | Public Health | `/unauthorized` |

**Access:** Cross-facility oversight and reporting (currently read-only/limited access).

---

### Records & Front Desk

| Role | Name | Email | Staff ID | Department | Dashboard |
|------|------|-------|----------|------------|-----------|
| Records Officer | Mr Man Miller | `recordofficer@kwadaso.health` | KHS-RO-001 | Records Office | `/records-officer` |
| Front Desk | Esi Boateng | `frontdesk@kwadaso.health` | KHS-FD-001 | Records Office | `/records-officer` |

**Access:** Patient registration, search, appointments, check-in, queue management, documents, visit history, print/export.

---

### Clinical (Doctor/PA)

| Role | Name | Email | Staff ID | Department | Dashboard |
|------|------|-------|----------|------------|-----------|
| Doctor | Dr Kwame Miller | `doctor@kwadaso.health` | KHS-DR-001 | General Consultation | `/clinician` |
| Physician Assistant | Abena Osei | `physicianassistant@kwadaso.health` | KHS-PA-001 | General Consultation | `/clinician` |

**Access:** Consultation queue, encounter management, SOAP notes, diagnoses, lab requests, prescriptions, referrals, follow-ups.

---

### Nursing & Triage

| Role | Name | Email | Staff ID | Department | Dashboard |
|------|------|-------|----------|------------|-----------|
| Nurse | Akosua Triage Nurse | `nurse@kwadaso.health` | KHS-NU-001 | Triage | `/nurse/dashboard` |

**Access:** Triage queue, vital signs capture, emergency flagging, immunizations, patient triage profile, queue board, notifications.

---

### Laboratory

| Role | Name | Email | Staff ID | Department | Dashboard |
|------|------|-------|----------|------------|-----------|
| Lab Technician | Kofi Antwi | `laboratory@kwadaso.health` | KHS-LT-001 | Laboratory | `/laboratory` |

**Access:** Lab request queue, sample collection/tracking, result entry, validation, critical alerts, test catalog, reports.

---

### Pharmacy

| Role | Name | Email | Staff ID | Department | Dashboard |
|------|------|-------|----------|------------|-----------|
| Pharmacist | Ama Mensah | `pharmacist@kwadaso.health` | KHS-PH-001 | Pharmacy | `/pharmacy` |

**Access:** Prescription queue, dispensing, medication stock, low stock alerts, expired medication tracking, reorder requests, reports.

---

### Billing

| Role | Name | Email | Staff ID | Department | Dashboard |
|------|------|-------|----------|------------|-----------|
| Billing Officer | Daniel Mensah | `billing@kwadaso.health` | KHS-BO-001 | Billing | `/billing` |

**Access:** Invoice creation/management, payment processing, NHIS/waivers, outstanding balances, patient statements, daily collections, financial reports.

---

## Complete Patient Journey Walkthrough

This section walks you through the entire patient flow from arrival to discharge, showing exactly what each role does and how the system connects everything.

---

### Step 1: Hospital Admin — Setup & Preparation

**Login:** `hospitaladmin@kwadaso.health`

Before patients arrive, the Hospital Admin ensures the system is ready.

#### What to Do:

1. **Log in** to the Hospital Admin dashboard
2. **Review Departments** — Confirm these departments exist:
   - Administration
   - Records Office
   - Triage
   - General Consultation
   - Laboratory
   - Pharmacy
   - Billing
3. **Review Staff** — Confirm staff accounts are active for each department
4. **Check Settings** — Verify hospital name, contact info, and configuration

#### What You'll See:
- Dashboard with operational metrics
- Department workload summaries
- Staff activity overview
- Active queue statistics

---

### Step 2: Records Officer — Patient Registration

**Login:** `recordofficer@kwadaso.health`

When a patient arrives at the hospital, the Records Officer creates their permanent record.

#### What to Do:

1. **Log in** to the Records Officer dashboard
2. **Navigate to Register** — Click "Register" in the sidebar
3. **Fill in Patient Information:**
   - First Name: `Akua`
   - Last Name: `Mensah`
   - Gender: `Female`
   - Date of Birth: `15/03/1990` (or estimated age: `34`)
   - Phone: `0240000001`
   - Community: `Kwadaso`
   - Address: `House 12, Kwadaso Estate`
   - NHIS Number: `NHIS-12345678` (optional)
   - Emergency Contact: `Kofi Mensah / 0240000002`
   - Blood Group: `O Positive` (if known)
4. **Click Save** — System generates patient number `SDA-P-0001`

#### What Happens in the System:
```
Patient record created → Status: ACTIVE
Patient linked to facility: SDA Hospital Kwadaso
Registered by: Records Officer
```

---

### Step 3: Records Officer — Appointment & Check-In

**Still logged in as:** `recordofficer@kwadaso.health`

Now create an appointment or check the patient in as a walk-in.

#### Option A: Book an Appointment

1. **Navigate to Appointments** — Click "Appointments" in the sidebar
2. **Click "New Appointment"**
3. **Fill in:**
   - Patient: `Akua Mensah (SDA-P-0001)`
   - Department: `General Consultation`
   - Clinician: `Dr Kwame Miller`
   - Date/Time: `Today, 10:00 AM`
   - Reason: `Fever and headache for 3 days`
4. **Click Save** — Appointment created with status `SCHEDULED`

#### Option B: Walk-In Check-In

1. **Navigate to Check-In** — Click "Check-In" in the sidebar
2. **Search for Patient** — Enter `Akua Mensah` or `SDA-P-0001`
3. **Click Check-In**
4. **System creates queue entry:**
   - Queue Number: `TR-001`
   - Status: `WAITING`
   - Priority: `ROUTINE`
   - Department: `Triage`

#### What Happens in the System:
```
Appointment created → Status: CHECKED_IN
Queue entry created → Status: WAITING
Queue number generated: TR-001
Patient now appears in Triage Queue
```

---

### Step 4: Nurse — Triage & Vital Signs

**Login:** `nurse@kwadaso.health`

The nurse sees the patient waiting in the triage queue.

#### What to Do:

1. **Log in** to the Nurse dashboard
2. **Navigate to Triage Queue** — Click "Triage Queue" in the sidebar
3. **Find the Patient** — Look for `TR-001 - Akua Mensah` with status `WAITING`

#### 4a. Start Triage

1. **Click "Start"** on the queue entry
2. **Status changes:** `WAITING` → `IN_TRIAGE`
3. The nurse is now actively assessing the patient

#### 4b. Capture Vital Signs

1. **Click "Vitals"** button on the queue entry
2. **Fill in Vital Signs:**
   - Temperature: `38.4` °C
   - Systolic BP: `128` mmHg
   - Diastolic BP: `82` mmHg
   - Pulse Rate: `96` bpm
   - Respiratory Rate: `21` breaths/min
   - Oxygen Saturation: `98` %
   - Weight: `65` kg
   - Height: `160` cm
   - Pain Score: `6` / 10
   - Triage Priority: `URGENT`
   - Nursing Notes: `Patient reports fever for 3 days with frontal headache. Mild dehydration observed.`
3. **System calculates BMI:** `25.4`

#### 4c. Send to Clinician

1. **Click "Save & Send To Clinician"**
2. **Status changes:** `IN_TRIAGE` → `WITH_CLINICIAN`
3. `calledAt` timestamp is set

#### What Happens in the System:
```
Vital signs recorded → Linked to patient
Queue priority updated → URGENT
Queue status updated → WITH_CLINICIAN
Patient now appears in Clinician Queue
```

---

### Step 5: Doctor/PA — Clinical Consultation

**Login:** `doctor@kwadaso.health`

The doctor sees the patient in the consultation queue.

#### What to Do:

1. **Log in** to the Clinician dashboard
2. **Navigate to Consultation Queue** — Click "Consultation Queue"
3. **Find the Patient** — Look for `TR-001 - Akua Mensah` with status `WITH_CLINICIAN`

#### 5a. Start Consultation

1. **Click on the patient** to open the encounter workspace
2. **Create Encounter:**
   - Chief Complaint: `Fever and headache for 3 days`
   - Visit Type: `OPD`
3. **System creates encounter** with status `DRAFT`

#### 5b. Write SOAP Notes

1. **Navigate to Clinical Notes**
2. **Fill in SOAP format:**
   - **Subjective:** `Patient is a 34-year-old female presenting with 3-day history of fever and frontal headache. Reports body aches and mild loss of appetite. No cough, no vomiting.`
   - **Objective:** `Temp 38.4°C, BP 128/82, HR 96, RR 21, SpO2 98%. Patient appears flushed but alert. Throat slightly erythematous. No meningeal signs.`
   - **Assessment:** `Likely viral Upper Respiratory Tract Infection. Malaria to be ruled out.`
   - **Plan:** `1. Paracetamol 500mg TDS x 5 days\n2. Rest and increased fluid intake\n3. Return if symptoms worsen or persist beyond 5 days`
3. **Sign the note** — Click "Sign Note"

#### 5c. Record Diagnosis

1. **Navigate to Diagnoses**
2. **Add Diagnosis:**
   - Name: `Acute Upper Respiratory Tract Infection`
   - ICD-10 Code: `J06.9`
   - Mark as: `Primary`
   - Notes: `Viral etiology suspected`
3. **Click Save**

#### 5d. Order Lab Tests

1. **Navigate to Lab Requests**
2. **Click "Order Labs"**
3. **Select Tests:**
   - Malaria RDT
   - Full Blood Count
4. **Add Clinical Notes:** `Rule out malaria and assess for infection`
5. **Priority:** `ROUTINE`
6. **Click Submit**

#### 5e. Prescribe Medication

1. **Navigate to Prescriptions**
2. **Click "Create Prescription"**
3. **Add Medications:**
   - Paracetamol 500mg — 1 tablet TDS x 5 days (Quantity: 15)
   - ORS Sachets — 1 sachet TDS x 3 days (Quantity: 9)
4. **Add Notes:** `Take after meals. Complete full course.`
5. **Click Submit**

#### 5f. Complete Encounter

1. **Review everything:** SOAP note signed, diagnosis recorded, labs ordered, prescription issued
2. **Click "Complete Encounter"**
3. **Status changes:**
   - Encounter: `COMPLETED`
   - Queue: `COMPLETED`

#### What Happens in the System:
```
Encounter created → Linked to patient, queue, clinician
SOAP note signed → Clinical record stored
Diagnosis recorded → Primary diagnosis flagged
Lab request created → Status: REQUESTED → Queue: AWAITING_LAB
Prescription created → Status: ISSUED → Queue: AWAITING_PHARMACY
Encounter completed → All records linked and stored
```

---

### Step 6: Lab Technician — Process Lab Tests

**Login:** `laboratory@kwadaso.health`

The lab technician sees the lab request in the queue.

#### What to Do:

1. **Log in** to the Laboratory dashboard
2. **Navigate to Lab Requests** — Click "Requests"
3. **Find the Request** — Look for the request from Dr Kwame Miller for Akua Mensah

#### 6a. Collect Sample

1. **Click on the request** to open details
2. **Click "Collect Sample"**
3. **Sample Type:** `Blood`
4. **Status changes:** `REQUESTED` → `SAMPLE_COLLECTED`
5. **Record collection time** and collector

#### 6b. Process Tests

1. **Navigate to Result Entry**
2. **Enter Results:**
   - Malaria RDT: `Positive` (Abnormal)
   - Full Blood Count:
     - WBC: `12,500 /µL` (High)
     - RBC: `4.2 x 10^6 /µL` (Normal)
     - Hemoglobin: `12.8 g/dL` (Normal)
     - Platelets: `180,000 /µL` (Normal)
3. **Status changes:** `SAMPLE_COLLECTED` → `PROCESSING` → `COMPLETED`

#### 6c. Validate Results

1. **Click "Validate"** on each result
2. **Status changes:** `ENTERED` → `VALIDATED`
3. **Release to Clinician**
4. **Status changes:** `VALIDATED` → `RELEASED`

#### What Happens in the System:
```
Sample collected → Tracking recorded
Results entered → Linked to lab request
Results validated → Quality check complete
Results released → Doctor can view
Queue status → WITH_CLINICIAN (doctor reviews results)
```

---

### Step 7: Pharmacist — Dispense Medication

**Login:** `pharmacist@kwadaso.health`

The pharmacist sees the prescription in the queue.

#### What to Do:

1. **Log in** to the Pharmacy dashboard
2. **Navigate to Prescriptions** — Click "Prescriptions"
3. **Find the Prescription** — Look for the prescription from Dr Kwame Miller for Akua Mensah

#### 7a. Verify and Dispense

1. **Click on the prescription** to open details
2. **Review medication list:**
   - Paracetamol 500mg x 15 tablets
   - ORS Sachets x 9 sachets
3. **Check stock availability** — Confirm items are in stock
4. **Click "Dispense"**
5. **For each item:**
   - Paracetamol: Quantity dispensed = 15
   - ORS: Quantity dispensed = 9
6. **Add Counselling Notes:** `Take paracetamol after meals. Mix ORS in clean water. Drink plenty of fluids. Rest.`

#### 7b. Confirm Dispensing

1. **Click "Complete Dispensing"**
2. **Status changes:** `PENDING` → `COMPLETED`
3. **Stock is updated:**
   - Paracetamol: 1200 - 15 = 1185 remaining
   - ORS: 90 - 9 = 81 remaining
4. **Stock movement recorded** for audit trail

#### What Happens in the System:
```
Prescription verified → Stock checked
Medications dispensed → Stock deducted
Dispensing recorded → Linked to prescription
Stock movement logged → Audit trail complete
Queue status → COMPLETED
```

---

### Step 8: Billing Officer — Invoice & Payment

**Login:** `billing@kwadaso.health`

The billing officer creates an invoice for the patient's visit.

#### What to Do:

1. **Log in** to the Billing dashboard
2. **Navigate to Invoices** — Click "Invoices"
3. **Click "Create Invoice"**

#### 8a. Create Invoice

1. **Select Patient:** `Akua Mensah (SDA-P-0001)`
2. **Link Encounter:** Select today's encounter
3. **Add Invoice Items:**
   - Consultation Fee: GHS 50.00
   - Malaria RDT: GHS 20.00
   - Full Blood Count: GHS 40.00
   - Paracetamol 500mg x 15: GHS 7.50
   - ORS Sachets x 9: GHS 10.80
4. **Subtotal:** GHS 128.30
5. **Tax (0%):** GHS 0.00
6. **Total:** GHS 128.30
7. **Click "Issue Invoice"**
8. **Status:** `ISSUED`

#### 8b. Process Payment

1. **Click on the invoice** to open details
2. **Click "Record Payment"**
3. **Payment Details:**
   - Amount: `128.30`
   - Method: `CASH`
   - Reference: (optional)
4. **Click "Submit Payment"**
5. **Payment recorded:**
   - Receipt Number: `RCP-001`
   - Status: `SUCCESSFUL`

#### 8c. Update Invoice Status

1. **Invoice automatically updates:**
   - Amount Paid: GHS 128.30
   - Balance Due: GHS 0.00
   - Status: `PAID`

#### 8d. Print Receipt

1. **Click "Print Receipt"**
2. **Receipt shows:**
   - Patient name and number
   - Itemized charges
   - Payment method
   - Receipt number
   - Date and time

#### What Happens in the System:
```
Invoice created → Linked to patient and encounter
Items added → Linked to services provided
Payment recorded → Receipt generated
Invoice status → PAID
Balance → GHS 0.00
```

---

### Step 9: Discharge — Patient Leaves

**System automatically handles discharge when all steps are complete.**

#### Discharge Criteria:

- [x] Patient registered
- [x] Triage completed (vitals captured)
- [x] Consultation completed (SOAP note signed, diagnosis recorded)
- [x] Lab tests processed (results released)
- [x] Medications dispensed (stock updated)
- [x] Invoice paid (balance = 0)

#### What Happens:

1. **Queue status:** `COMPLETED`
2. **Encounter status:** `COMPLETED`
3. **Patient record:** All data permanently stored
4. **Patient can leave** the hospital

#### For Future Visits:

- Patient's record is searchable by name or patient number
- All previous encounters, vitals, lab results, and prescriptions are available
- New visit can reference past medical history

---

## Visual Flow Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           KHIP Patient Journey                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  HOSPITAL    │    │   RECORDS    │    │    NURSE     │    │    DOCTOR    │  │
│  │    ADMIN     │    │   OFFICER    │    │              │    │              │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │                   │          │
│    Setup System      Register Patient    Start Triage      Create Encounter   │
│    Check Staff       Book Appointment    Capture Vitals    Write SOAP Notes   │
│    Verify Depts      Check-In Patient    Send to Clinician Order Labs        │
│                                        │                   Prescribe Meds    │
│                                        │                   Complete Visit     │
│                                        │                                     │
│                                        ▼                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                     │
│  │   BILLING    │    │  PHARMACIST  │    │     LAB      │                     │
│  │   OFFICER    │    │              │    │  TECHNICIAN  │                     │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                     │
│         │                   │                   │                              │
│    Create Invoice      Dispense Meds      Collect Sample                      │
│    Process Payment     Update Stock       Enter Results                       │
│    Print Receipt       Record Movement    Validate & Release                  │
│         │                   │                   │                              │
│         └───────────────────┴───────────────────┘                              │
│                                 │                                              │
│                                 ▼                                              │
│                        ┌──────────────┐                                        │
│                        │   DISCHARGE  │                                        │
│                        │   Patient    │                                        │
│                        │   Leaves     │                                        │
│                        └──────────────┘                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference by Role

### Login Testing Checklist

Use this checklist to test each role's access:

- [ ] **Super Admin** — Can manage all staff, roles, permissions, departments, settings
- [ ] **Hospital Admin** — Can manage facility staff, departments, appointments, queue
- [ ] **Records Officer** — Can register patients, book appointments, check-in patients
- [ ] **Front Desk** — Same access as Records Officer
- [ ] **Doctor** — Can create encounters, write SOAP notes, order labs, prescribe meds
- [ ] **Physician Assistant** — Same access as Doctor
- [ ] **Nurse** — Can capture vitals, triage patients, flag emergencies
- [ ] **Lab Technician** — Can process lab requests, enter results, validate
- [ ] **Pharmacist** — Can dispense medications, manage stock
- [ ] **Billing Officer** — Can create invoices, process payments
- [ ] **Municipal Health Director** — Limited/read-only access
- [ ] **M&E Officer** — Limited/read-only access

---

## Departments

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

---

## Facility

| Field | Value |
|-------|-------|
| Name | SDA Hospital Kwadaso |
| Code | SDA-KWADASO |
| Type | Hospital |
| Phone | +233 302 000 000 |
| Email | info@sdakwadaso.health |
| Address | SDA Hospital, Kwadaso, Kumasi |
| Municipality | Kwadaso |
| Region | Ashanti |

---

*Document Version: 2.0*
*Last Updated: July 2026*
*KHIP — Kwadaso HealthLink Integrated Platform*
