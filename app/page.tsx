import { redirectToStaffDashboard } from "@/lib/auth-session"

export default async function Page() {
  await redirectToStaffDashboard()
}
