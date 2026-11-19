import { timingSafeEqual } from "node:crypto"

function getDashboardPin() {
  return process.env.TEACHER_DASHBOARD_PIN || ""
}

export function isDashboardPinConfigured() {
  return /^\d{4}$/.test(getDashboardPin())
}

export function isDashboardPinValid(pin: unknown) {
  const expectedPin = getDashboardPin()
  if (!/^\d{4}$/.test(expectedPin) || typeof pin !== "string" || !/^\d{4}$/.test(pin)) return false

  const expected = Buffer.from(expectedPin)
  const supplied = Buffer.from(pin)
  return expected.length === supplied.length && timingSafeEqual(expected, supplied)
}
