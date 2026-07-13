import { Suspense } from "react"

import { LabResultEntryPage } from "@/components/laboratory/result-pages"

export default function LaboratoryResultEntryRoute() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading result workspace...</div>}>
      <LabResultEntryPage />
    </Suspense>
  )
}
