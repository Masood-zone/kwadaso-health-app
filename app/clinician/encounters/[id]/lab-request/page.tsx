import { EncounterWorkspace } from "@/components/clinician/encounter-workspace"

export default async function EncounterLabRequestRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EncounterWorkspace encounterId={id} initialTab="Lab Request" />
}
