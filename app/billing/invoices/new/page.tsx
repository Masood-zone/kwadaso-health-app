import { InvoiceCreatePage } from "@/components/billing/invoice-pages"
export default async function Page({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) { const { patientId } = await searchParams; return <InvoiceCreatePage initialPatientId={patientId} /> }
