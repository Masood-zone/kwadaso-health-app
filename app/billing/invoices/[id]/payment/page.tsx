import { RecordPaymentPage } from "@/components/billing/invoice-pages"
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <RecordPaymentPage invoiceId={id} /> }
