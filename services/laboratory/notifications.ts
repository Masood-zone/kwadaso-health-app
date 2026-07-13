"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { laboratoryGet, laboratoryMutate, laboratoryQuery } from "@/services/laboratory/client"
import type { LaboratoryNotificationItem, LaboratoryNotificationUpdatePayload, LaboratoryPage } from "@/types/laboratory"

export function useLaboratoryNotifications(page = 1) {
  return useQuery({ queryKey: ["laboratory", "notifications", page], queryFn: () => laboratoryGet<LaboratoryPage<LaboratoryNotificationItem>>(laboratoryQuery("/laboratory/notifications", { page })) })
}

export function useUpdateLaboratoryNotification() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: ({ id, payload }: { id: string; payload: LaboratoryNotificationUpdatePayload }) => laboratoryMutate<LaboratoryNotificationItem, LaboratoryNotificationUpdatePayload>("patch", `/laboratory/notifications/${id}`, payload), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["laboratory", "notifications"] }) })
}
