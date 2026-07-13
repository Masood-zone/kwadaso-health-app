import { LabSampleDetailPage } from "@/components/laboratory/sample-pages"

export default async function LaboratorySampleRoute({
  params,
}: {
  params: Promise<{ sampleId: string }>
}) {
  const { sampleId } = await params
  return <LabSampleDetailPage id={sampleId} />
}
