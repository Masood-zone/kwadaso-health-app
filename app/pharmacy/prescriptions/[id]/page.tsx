import { PrescriptionDetailPage } from "@/components/pharmacy/prescription-pages"

export default async function PharmacyPrescriptionDetailRoute({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PrescriptionDetailPage id={id} /> }
