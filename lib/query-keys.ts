export const dashboardQueryKeys = {
  superAdmin: ["super-admin", "dashboard"] as const,
  superAdminSummary: ["super-admin", "dashboard", "summary"] as const,
  hospitalAdmin: ["hospital-admin", "dashboard"] as const,
  recordsOfficer: ["records-officer", "dashboard"] as const,
  nurse: ["nurse", "dashboard"] as const,
  clinician: ["clinician", "dashboard"] as const,
  laboratory: ["laboratory", "dashboard"] as const,
  pharmacy: ["pharmacy", "dashboard"] as const,
  billing: ["billing", "dashboard"] as const,
}

export const queryKeyRoots = {
  superAdmin: ["super-admin"] as const,
  hospitalAdmin: ["hospital-admin"] as const,
  recordsOfficer: ["records-officer"] as const,
  nurse: ["nurse"] as const,
  clinician: ["clinician"] as const,
  laboratory: ["laboratory"] as const,
  pharmacy: ["pharmacy"] as const,
  billing: ["billing"] as const,
}
