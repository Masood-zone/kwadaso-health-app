import { EncounterWorkspace } from "@/components/clinician/encounter-workspace"

export default async function EncounterSummaryRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EncounterWorkspace encounterId={id} initialTab="Summary" />
}
