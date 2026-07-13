import { StartConsultationPage } from "@/components/clinician/clinician-pages"

export default async function StartConsultationRoute({
  params,
}: {
  params: Promise<{ queueId: string }>
}) {
  const { queueId } = await params
  return <StartConsultationPage queueId={queueId} />
}
