# KHIP User Accounts & Access Guide

**Kwadaso HealthLink Integrated Platform**

This document lists all demo user accounts for testing the KHIP system.

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

## Patient Flow Summary

```
Records Officer → Nurse → Doctor/PA → Lab/Pharmacy → Billing → Discharge
     ↓               ↓         ↓           ↓            ↓
 Registration    Triage   Consultation  Processing   Payment
```

1. **Records Officer** registers patient and creates queue entry
2. **Nurse** captures vitals and sends to clinician
3. **Doctor/PA** creates encounter, orders labs/prescriptions
4. **Lab Technician** processes lab tests and returns results
5. **Pharmacist** dispenses medications
6. **Billing Officer** creates invoice and processes payment
7. **Patient** is discharged

---

*Document Version: 1.0*
*Last Updated: July 2026*
*KHIP — Kwadaso HealthLink Integrated Platform*
