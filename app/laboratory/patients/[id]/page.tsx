import { LaboratoryPatientHistoryPage } from "@/components/laboratory/notification-history-pages"

export default async function LaboratoryPatientHistoryRoute({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LaboratoryPatientHistoryPage id={id} />
}
