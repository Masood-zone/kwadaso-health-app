# Kwadaso Health System Walkthrough

This document explains the system in plain language, based on how the application is currently implemented.

The system is called the Kwadaso HealthLink Integrated Platform. It is a web-based hospital management system for SDA Hospital Kwadaso. Its main purpose is to help hospital staff sign in, see only the areas they are allowed to use, and manage everyday hospital work such as staff administration, patient registration, appointments, patient queues, triage, vitals, immunizations, reports, notifications, and audit logs.

## 1. The Big Picture

Think of the system as a digital hospital desk with different doors for different staff members.

When a staff member logs in, the system checks their role. A super admin sees system-wide administration tools. A hospital admin sees operational management tools. A records officer sees patient registration and front-desk tools. A nurse sees triage and nursing tools.

The application is built as a Next.js web app. Behind the scenes, it uses a PostgreSQL database through Prisma. Authentication is handled by Better Auth, and most data screens talk to the backend through API routes.

In simple terms:

1. A staff member opens the website.
2. They log in with an email and password.
3. The system checks who they are and what role they have.
4. They are sent to the correct dashboard.
5. Every page and every backend request checks permissions again.
6. Any created or updated records are saved in the database.

## 2. Login and Access Control

The login screen is the entry point for staff. Staff use email and password credentials.

The seeded demo accounts are:

| Role | Email | Password |
|---|---|---|
| Super Admin | `superadmin@kwadaso.health` | `ChangeMe123!` |
| Hospital Admin | `hospitaladmin@kwadaso.health` | `ChangeMe123!` |
| Nurse | `nurse@kwadaso.health` | `ChangeMe123!` |
| Records Officer | `recordofficer@kwadaso.health` | `ChangeMe123!` |

After login, the system automatically sends the user to their role's working area:

| Role | Main Area |
|---|---|
| Super Admin | `/super-admin/dashboard` |
| Hospital Admin | `/hospital-admin/dashboard` |
| Records Officer | `/records-officer` |
| Front Desk | `/records-officer` |
| Nurse | `/nurse/dashboard` |

If a staff member tries to open a page they are not allowed to use, the system redirects them to an unauthorized access page. If their session expires, the app sends them to the session-expired page.

## 3. Super Admin Walkthrough

The super admin is the highest-level system manager. This role is mainly for managing the hospital system itself.

The super admin menu currently includes:

| Menu Item | What It Does |
|---|---|
| Dashboard | Shows system overview, staff/role summaries, active departments, and recent audit activity. |
| Staff | Create and update staff accounts. |
| Roles | View system roles and manage permissions attached to roles. |
| Departments | Create and update hospital departments. |
| Audit Logs | Review system activity records. |
| Settings | Update hospital and system settings. |
| Reports | Present in the menu, but currently points to a placeholder link. |

### Staff Management

The super admin can create staff accounts by entering staff ID, name, email, role, department, status, and temporary password. Existing staff can also be edited.

This is useful when the hospital hires new staff, changes someone's department, suspends an account, or resets login details.

### Roles and Permissions

The roles page allows the super admin to view system roles and update permission assignments. In layman's terms, this controls what each category of staff is allowed to do in the system.

### Department Management

The departments page manages hospital units such as Administration, Records, OPD, Triage, Consultation, Laboratory, Pharmacy, Billing, and Public Health.

### Audit Logs

Audit logs are the system's activity history. They help answer questions like:

- Who created this record?
- Who changed this setting?
- When did an action happen?
- What kind of record was affected?

## 4. Hospital Admin Walkthrough

The hospital admin manages the day-to-day running of SDA Hospital Kwadaso. This role focuses on operations rather than full system control.

The hospital admin menu currently includes:

| Menu Item | What It Does |
|---|---|
| Dashboard | Shows operational metrics and hospital activity. |
| Staff | Create and update facility staff, except super admin accounts. |
| Departments | Manage departments within the facility. |
| Appointments | Create, update, check in, cancel, mark missed, and track appointments. |
| Queue | Add patients to queues and update queue status. |
| Settings | Update facility settings. |
| Reports | Create report export records and view recent exports. |
| Notifications | Create notices for roles, departments, individual staff, or all staff. |
| Audit Logs | View facility-level audit activity. |

### Dashboard and Oversight

The dashboard gives the hospital admin a command-center view of the facility. It shows workload, patient flow, staff activity, and other operational indicators.

There are also specialized read-only summaries for areas such as billing, referrals, clinical work, laboratory activity, pharmacy stock, and sync jobs.

### Staff and Departments

Hospital admins can create and manage staff for the hospital. They can assign staff to departments and roles, activate or deactivate accounts, and update profile details.

They can also create or update departments used across appointments, queues, and reporting.

### Appointments

The appointment area allows the hospital admin to search for a patient, select a department and clinician, set the appointment time, enter a reason, and save the appointment.

Existing appointments can be updated. The system supports statuses such as scheduled, checked in, missed, cancelled, completed, and rescheduled.

### Queue Management

The queue page lets the hospital admin add a patient to a care queue. A queue entry includes the patient, department, priority, reason, notes, and optionally an appointment or assigned staff member.

This helps the facility track who is waiting, who is in triage, who is with a clinician, who is awaiting lab/pharmacy, and who has completed the visit.

### Reports

The reports page currently creates and lists report export metadata. It records information such as report type, title, status, row count, and generated date. This is not yet a full document generation engine, but the database and interface are prepared for reporting workflows.

### Notifications

Hospital admins can create operational notices. A notice can target a role, a department, a specific staff member, or everyone. Notifications can be marked as read or archived.

## 5. Records Officer Walkthrough

The records officer handles patient-facing front-desk work: patient folders, appointments, check-in, queue placement, documents, and visit summaries.

The records officer menu currently includes:

| Menu Item | What It Does |
|---|---|
| Dashboard | Shows patient records, today's appointments, and active queues. |
| Patients | Search and view patient folders. |
| Register | Create a new patient record and hospital number. |
| Appointments | Book and update appointments. |
| Check-In | Confirm arrival and generate a queue number. |
| Queue | Add walk-ins and update queue entries. |
| Documents | Directs staff to patient profiles for document handling. |
| Visit History | Directs staff to patient profiles for visit history. |
| Print / Export | Directs staff to patient profiles for summaries. |

### Registering a Patient

A records officer can create a patient folder by entering:

- Name and gender
- Date of birth or estimated age
- Contact details
- Residential address and community
- NHIS number or national ID
- Emergency contact
- Marital status and blood group

When registration succeeds, the system generates a patient number. The officer can then open the patient profile, book an appointment, or send the patient to the queue.

### Patient Directory

The patient directory lets staff search by name, patient number, phone, NHIS number, gender, status, or community. From the list, staff can open a patient profile or start booking an appointment.

### Patient Profile

The patient profile is the main patient folder. It shows biodata and related records such as appointments, queue history, visit history, documents, timeline items, and print/export options.

Records officers can update basic biodata and save document metadata such as document type, title, file URL, file name, and upload details.

### Appointments

The appointment desk allows the records officer to book appointments, update existing appointments, check in a patient, mark an appointment as missed, or cancel it.

### Check-In and Queue

Check-in confirms that the patient has arrived. The system then creates a queue number. This queue number is what the clinical team can use to identify and call the patient.

The queue monitor also supports walk-ins, priority updates, and cancellation before service starts.

### Duplicate Detection

The duplicate detection screen helps staff review possible duplicate patient records. It compares records and shows matching hints, but it does not automatically merge patient folders.

## 6. Nurse and Triage Walkthrough

The nurse area is focused on triage, vital signs, emergency handling, immunizations, and read-only patient summaries.

The nurse menu currently includes:

| Menu Item | What It Does |
|---|---|
| Dashboard | Shows waiting patients, emergency watch, recent vitals, and nursing metrics. |
| Triage Queue | Start triage, capture vitals, flag emergencies, send patients to clinicians. |
| Capture Vitals | Record vital signs and triage priority. |
| Emergency Cases | Track patients marked as emergency. |
| Immunizations | Add and update vaccine records. |
| Patient Vitals History | Review latest vitals for current queue patients. |
| Queue Board | Visual board of patient queue movement. |
| Notifications | View and update nursing notifications. |

### Triage Queue

The triage queue shows patients waiting for nursing attention. A nurse can:

- Start triage
- Capture vitals
- Send the patient to the clinician
- Flag an emergency
- Cancel a queue item
- Open the patient profile

The queue can be filtered by patient, queue number, date, department, priority, and status.

### Capturing Vitals

The vitals screen records:

- Temperature
- Pulse
- Blood pressure
- Respiratory rate
- Oxygen saturation
- Weight
- Height
- Pain score
- Triage priority
- Nursing notes

When weight and height are entered, the interface calculates BMI. The nurse can either save the vitals only or save the vitals and send the patient to the clinician queue.

### Emergency Cases

Emergency cases are queue entries marked with emergency priority. The emergency page highlights these patients, shows their notes and latest vitals if available, and gives the nurse quick action buttons.

### Patient Profile for Nurses

The nurse patient profile is mostly read-only. It shows biodata, emergency contact, active queue, blood group, latest clinical status, vitals history, allergies, chronic conditions, medication history, immunizations, and queue history.

Nurses can capture vitals and manage immunizations, but they cannot edit doctor diagnoses, prescriptions, lab results, or billing records from this area.

### Immunizations

The immunization area allows nurses to record vaccines, dose, batch number, administered date, next due date, and notes. Existing immunization records can also be updated.

### Notifications

Nurses can view notices assigned to them or their role. They can mark notifications as read or archive them.

## 7. Current Demo Data

The seed script prepares the system with:

- SDA Hospital Kwadaso as the facility
- Departments such as Administration, Records, OPD, Triage, Consultation, Laboratory, Pharmacy, Billing, and Public Health
- Four staff demo accounts: super admin, hospital admin, nurse, and records officer
- Sample pharmacy stock
- Sample patients
- A sample appointment
- Sample queue entries
- A sample encounter
- Sample vitals
- A sample invoice
- A sample audit log

This means a developer or reviewer can seed the database and immediately see realistic records in dashboards and workflow screens.

## 8. What Is Implemented Now

The following areas are currently implemented with pages, API routes, and database-backed workflows:

- Staff login and session handling
- Role-based page protection
- Super admin dashboard, staff, roles, departments, settings, and audit logs
- Hospital admin dashboard, staff, departments, settings, appointments, queue, reports, notifications, audit logs, and oversight summaries
- Records officer dashboard, patient registration, patient directory, patient profile, appointments, check-in, queue, duplicate review, documents metadata, visit history views, and print/export audit actions
- Nurse dashboard, triage queue, vitals capture, emergency flagging, queue board, patient triage profile, immunizations, vitals history, and notifications

## 9. What Is Prepared for Later

The database schema is larger than the current user interface. It already includes models for:

- Clinical encounters and SOAP notes
- Diagnoses
- Laboratory requests, samples, and results
- Pharmacy prescriptions, dispensing, and stock movement
- Billing invoices and payments
- Referrals
- Internal messaging
- Offline sync jobs
- Report exports

Some of these areas are partly visible through dashboards or read-only summaries, but they do not yet all have full end-user screens. For example, the schema supports laboratory and pharmacy workflows, but the current implemented role dashboards focus mainly on administration, records, triage, appointments, queueing, notifications, reports metadata, and audit trails.

## 10. Typical Patient Flow in the Current Build

A realistic flow through the currently implemented system looks like this:

1. The records officer registers a patient or finds an existing patient folder.
2. The records officer books an appointment or checks the patient in.
3. Check-in creates a queue number.
4. The nurse opens the triage queue.
5. The nurse starts triage for the patient.
6. The nurse records vital signs and assigns a triage priority.
7. If the case is serious, the nurse flags it as emergency.
8. The nurse sends the patient to the clinician queue.
9. Hospital admins can monitor the activity from dashboards, queue views, patient-flow views, reports, notifications, and audit logs.

## 11. How to Run the System Locally

For a developer or examiner running the project:

```bash
pnpm install
pnpm prisma migrate dev
pnpm seed
pnpm dev
```

The application then runs at:

```text
http://localhost:3000
```

## 12. Simple Summary

In plain terms, the system is a role-based hospital operations platform. It already handles the most important front-office and triage workflows: staff login, patient registration, appointment booking, check-in, queue management, vital signs capture, immunization records, notifications, and administrative oversight.

The larger hospital modules, such as laboratory, pharmacy, billing, clinical notes, referrals, messaging, and offline sync, are represented in the database and partly in summaries, but many of those full working screens are still future-facing.
