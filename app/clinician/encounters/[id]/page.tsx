import { EncounterWorkspace } from "@/components/clinician/encounter-workspace"

export default async function EncounterRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EncounterWorkspace encounterId={id} />
}
