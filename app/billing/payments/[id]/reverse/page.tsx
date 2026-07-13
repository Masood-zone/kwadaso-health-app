import { PaymentReversalPage } from "@/components/billing/transaction-pages"
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PaymentReversalPage paymentId={id} /> }
