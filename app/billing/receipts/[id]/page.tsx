import { ReceiptPage } from "@/components/billing/transaction-pages"
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ReceiptPage paymentId={id} /> }
