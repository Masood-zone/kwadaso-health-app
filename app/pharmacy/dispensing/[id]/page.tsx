import { DispensingDetailPage } from "@/components/pharmacy/prescription-pages"

export default async function PharmacyDispensingDetailRoute({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <DispensingDetailPage id={id} /> }
