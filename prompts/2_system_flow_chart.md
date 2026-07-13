# KHIP Patient Journey Flow Chart

Generate a flow chart showing the complete patient journey through the KHIP hospital management system.

## Title
KHIP Patient Journey Flow Chart

## Description
This flow chart shows how a patient moves through the hospital from registration to discharge, and which staff role handles each stage.

## Flow Chart

```kroki
@startuml
skinparam backgroundColor white
skinparam activityBackgroundColor #E8F5E9
skinparam activityBorderColor #004302
skinparam activityDiamondBackgroundColor #FFF4E8
skinparam activityDiamondBorderColor #F59A3D
skinparam arrowColor #004302

title KHIP Patient Journey Flow Chart

|Records Officer|
start
:Patient Arrives at Hospital;

if (New or Returning Patient?) then (New)
  :Register Patient;
  note right: Create Patient Record\nAssign Patient Number
  :Save Biodata;
else (Returning)
  :Search Existing Record;
endif

:Check-In Patient;
note right: Create Queue Entry\nGenerate Queue Number\nStatus: WAITING

|Nurse|
:Patient Appears in Triage Queue;
:Start Triage;
note right: Status: IN_TRIAGE

:Capture Vital Signs;
note right: Temperature, BP, Pulse\nRespiratory Rate, SpO2\nWeight, Height, BMI\nPain Score

:Assign Triage Priority;
note right: ROUTINE / PRIORITY\nURGENT / EMERGENCY

if (Emergency Case?) then (Yes)
  :Flag as Emergency;
  note right: Notify Clinician\nPriority: EMERGENCY
else (No)
endif

:Send to Clinician;
note right: Status: WITH_CLINICIAN\nCalledAt timestamp set

|Doctor / PA|
:Doctor Picks Up Patient;
:Create Encounter;
note right: EncounterStatus: DRAFT\nLinked to Queue Entry

:Write SOAP Notes;
note right
  **S**ubjective - Patient history
  **O**bjective - Examination findings
  **A**ssessment - Clinical judgment
  **P**lan - Treatment plan
end note

:Record Diagnosis;
note right: Mark Primary Diagnosis\nICD-10 Code (optional)

if (Lab Tests Needed?) then (Yes)
  :Order Laboratory Tests;
  note right: Create LabRequest\nStatus: REQUESTED\nQueue: AWAITING_LAB
else (No)
endif

if (Medication Prescribed?) then (Yes)
  :Prescribe Medication;
  note right: Create Prescription\nStatus: ISSUED\nQueue: AWAITING_PHARMACY
else (No)
endif

if (Referral Needed?) then (Yes)
  :Create Referral;
  note right: To another facility\nor department
else (No)
endif

|Lab Technician|
if (Lab Tests Ordered?) then (Yes)
  :Receive Lab Request;
  :Collect Sample;
  note right: SampleStatus: COLLECTED
  :Process Tests;
  note right: LabRequestStatus: PROCESSING
  :Enter Results;
  note right: LabResultStatus: ENTERED
  :Validate Results;
  note right: LabResultStatus: VALIDATED
  :Return Results to Doctor;
  note right: Queue: WITH_CLINICIAN
else (No)
endif

|Doctor / PA|
:Review Lab Results;
:Update Treatment Plan if needed;

|Pharmacist|
if (Prescription Issued?) then (Yes)
  :Receive Prescription;
  :Verify Stock Availability;
  :Dispense Medication;
  note right
    DispenseStatus: COMPLETED
    Update MedicationStock
    Record StockMovement
  end note
  :Provide Counselling Notes;
  :Return to Doctor;
  note right: Queue: WITH_CLINICIAN
else (No)
endif

|Doctor / PA|
:Complete Encounter;
note right
  EncounterStatus: COMPLETED
  QueueStatus: COMPLETED
  CompletedAt timestamp set
end note

|Billing Officer|
:Generate Invoice;
note right: InvoiceStatus: ISSUED\nLink to Encounter

:Process Payment;
note right
  PaymentMethod: CASH / MOBILE_MONEY\nCARD / NHIS / WAIVER
  Update amountPaid, balanceDue
end note

if (Fully Paid?) then (Yes)
  :Invoice Status: PAID;
else (No)
  :Invoice Status: PARTIALLY_PAID;
endif

|Records Officer|
:Discharge Patient;
note right
  All records permanently stored
  Patient can return for future visits
end note

stop

@enduml
```

## Theme
minimal
