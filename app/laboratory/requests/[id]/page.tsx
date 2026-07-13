import { LabRequestDetailPage } from "@/components/laboratory/request-pages"

export default async function LaboratoryRequestRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LabRequestDetailPage id={id} />
}
