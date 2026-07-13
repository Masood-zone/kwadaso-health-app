"use client"

import { useQuery } from "@tanstack/react-query"

import { laboratoryGet } from "@/services/laboratory/client"
import type { LaboratoryPatientHistory } from "@/types/laboratory"

export function useLaboratoryPatientHistory(id?: string) {
  return useQuery({ queryKey: ["laboratory", "patient", id], enabled: Boolean(id), queryFn: () => laboratoryGet<LaboratoryPatientHistory>(`/laboratory/patients/${id}/history`) })
}
