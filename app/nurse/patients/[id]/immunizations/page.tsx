import { NurseImmunizationsPage } from "@/components/nurse/nurse-pages"

export default async function NursePatientImmunizationsRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <NurseImmunizationsPage patientId={id} />
}
