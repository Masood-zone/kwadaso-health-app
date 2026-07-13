import { PatientBillingPage } from "@/components/billing/transaction-pages"
export default async function Page({ searchParams }: { searchParams: Promise<{ search?: string }> }) { const { search } = await searchParams; return <PatientBillingPage initialSearch={search} /> }
