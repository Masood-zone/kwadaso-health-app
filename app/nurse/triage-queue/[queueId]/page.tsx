import { NurseVitalsCapturePage } from "@/components/nurse/nurse-pages"

export default async function NurseQueueVitalsRoute({
  params,
}: {
  params: Promise<{ queueId: string }>
}) {
  const { queueId } = await params
  return <NurseVitalsCapturePage queueId={queueId} />
}
