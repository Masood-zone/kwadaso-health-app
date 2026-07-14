const tlsModesWithoutHostnameVerification = new Set([
  "allow",
  "prefer",
  "require",
  "verify-ca",
])

export function getVerifiedDatabaseUrl(value: string | undefined) {
  if (!value) throw new Error("DATABASE_URL is required")

  const url = new URL(value)
  const sslMode = url.searchParams.get("sslmode")
  if (!sslMode || tlsModesWithoutHostnameVerification.has(sslMode)) {
    url.searchParams.set("sslmode", "verify-full")
  }
  return url.toString()
}

export function assertProductionTlsEnvironment(
  deploymentEnvironment = process.env.VERCEL_ENV,
  rejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED
) {
  if (deploymentEnvironment === "production" && rejectUnauthorized === "0") {
    throw new Error(
      "NODE_TLS_REJECT_UNAUTHORIZED=0 is not allowed in production"
    )
  }
}
