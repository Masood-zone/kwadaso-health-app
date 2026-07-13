import { PatientMedicationHistoryPage } from "@/components/pharmacy/history-report-pages"
export default async function PharmacyPatientHistoryRoute({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PatientMedicationHistoryPage id={id} /> }
