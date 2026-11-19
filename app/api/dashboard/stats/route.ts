import { NextRequest, NextResponse } from "next/server"
import { normalizeClassProgress } from "@/lib/class-progress"
import { isDashboardPinConfigured, isDashboardPinValid } from "@/lib/dashboard-auth"

const DEFAULT_GAS_API_URL = "https://script.google.com/macros/s/AKfycbxywSHpy6dMPeutRjHTcr4Qgp5gnTBX3Np49JfbJFW9hju1bqozcxxaBKL1VLHay0Sy/exec"
const attempts = new Map<string, { count: number; lockedUntil: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000
const NO_STORE = { "Cache-Control": "no-store" }

function isAllowedGasUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "script.google.com" && /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname) && !url.username && !url.password
  } catch {
    return false
  }
}

function hasSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin")
  return !origin || origin === request.nextUrl.origin
}

function getClientKey(request: NextRequest) {
  return request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"
}

function getApiUrl(value: unknown) {
  const apiUrl = typeof value === "string" && value.trim() ? value.trim() : DEFAULT_GAS_API_URL
  return isAllowedGasUrl(apiUrl) ? apiUrl : null
}

async function fetchClassProgress(apiUrl: string) {
  const gasUrl = new URL(apiUrl)
  gasUrl.search = ""
  gasUrl.hash = ""
  gasUrl.searchParams.set("action", "getStats")

  const upstream = await fetch(gasUrl, { cache: "no-store", redirect: "follow" })
  if (!upstream.ok) throw new Error("upstream")
  return normalizeClassProgress(await upstream.json())
}

async function fetchStudentDetails(apiUrl: string, studentId: string) {
  const studentUrl = new URL(apiUrl)
  studentUrl.search = ""
  studentUrl.hash = ""
  studentUrl.searchParams.set("studentId", studentId)
  const response = await fetch(studentUrl, { next: { revalidate: 60 }, redirect: "follow" })
  if (!response.ok) return null
  const result = await response.json()
  const data = result?.data
  if (result?.status !== "success" || !data || typeof data !== "object") return null
  const school = typeof data.school === "string" ? data.school.trim() : ""
  const department = typeof data.department === "string" ? data.department.trim() : ""
  const channel = typeof data.channel === "string" ? data.channel.trim() : ""
  return { school, department, channel, schoolFilled: Boolean(school), departmentFilled: Boolean(department), channelFilled: Boolean(channel) }
}

async function addStudentDetails(apiUrl: string, classes: ReturnType<typeof normalizeClassProgress>) {
  const candidates = new Map<string, { classIndex: number; studentId: string }>()
  classes.forEach((classProgress, classIndex) => {
    for (const student of [...classProgress.missingStudents, ...classProgress.completedStudents]) {
      if (student.studentId && (!student.school || !student.department || !student.channel)) {
        candidates.set(`${classIndex}-${student.studentId}`, { classIndex, studentId: student.studentId })
      }
    }
  })
  const students = [...candidates.entries()]
  const details = new Map<string, Awaited<ReturnType<typeof fetchStudentDetails>>>()
  let cursor = 0
  const workers = Array.from({ length: Math.min(8, students.length) }, async () => {
    while (cursor < students.length) {
      const index = cursor++
      const [key, { studentId }] = students[index]
      try {
        details.set(key, await fetchStudentDetails(apiUrl, studentId))
      } catch {
        details.set(key, null)
      }
    }
  })
  await Promise.all(workers)

  return classes.map((classProgress, classIndex) => {
    const enrich = (student: ReturnType<typeof normalizeClassProgress>[number]["students"][number]) => {
      const detail = student.studentId ? details.get(`${classIndex}-${student.studentId}`) : null
      return detail ? { ...student, ...detail } : student
    }
    const missingStudents = classProgress.missingStudents.map((student) => {
      const detail = student.studentId ? details.get(`${classIndex}-${student.studentId}`) : null
      return detail ? { ...student, ...detail } : { ...student, schoolFilled: null, departmentFilled: null, channelFilled: null }
    })
    return {
      ...classProgress,
      students: classProgress.students.map(enrich),
      completedStudents: classProgress.completedStudents.map(enrich),
      missingStudents,
    }
  })
}

export async function GET(request: NextRequest) {
  const apiUrl = getApiUrl(request.nextUrl.searchParams.get("apiUrl"))
  if (!apiUrl) return NextResponse.json({ error: "GAS API 網址格式不正確。" }, { status: 400, headers: NO_STORE })

  try {
    const classes = await addStudentDetails(apiUrl, await fetchClassProgress(apiUrl))
    return NextResponse.json({ classes: classes.map(({ className, total, completed, missing, missingStudents, completedStudents }) => ({
      className,
      total,
      completed,
      missing,
      missingStudents: missingStudents.map(({ seatNo, name, schoolFilled, departmentFilled, channelFilled }) => ({ seatNo, name, schoolFilled, departmentFilled, channelFilled })),
      completedStudents: completedStudents.map(({ seatNo, name, schoolFilled, departmentFilled, channelFilled }) => ({ seatNo, name, schoolFilled, departmentFilled, channelFilled })),
    })) }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "無法取得公開班級統計，請確認 GAS getStats 服務。" }, { status: 502, headers: NO_STORE })
  }
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "不允許的來源。" }, { status: 403, headers: NO_STORE })
  if (!isDashboardPinConfigured()) return NextResponse.json({ error: "管理密碼尚未完成伺服器設定。" }, { status: 503, headers: NO_STORE })

  const clientKey = getClientKey(request)
  const current = attempts.get(clientKey)
  const now = Date.now()
  if (current?.lockedUntil && current.lockedUntil > now) {
    return NextResponse.json({ error: "嘗試次數過多，請稍後再試。" }, { status: 429, headers: NO_STORE })
  }

  let pin: unknown
  let requestedApiUrl: unknown
  try {
    const body = await request.json()
    pin = body?.pin
    requestedApiUrl = body?.apiUrl
  } catch {
    return NextResponse.json({ error: "請重新輸入四位數密碼。" }, { status: 400, headers: NO_STORE })
  }

  if (!isDashboardPinValid(pin)) {
    const count = current?.lockedUntil && current.lockedUntil <= now ? 1 : (current?.count || 0) + 1
    attempts.set(clientKey, { count, lockedUntil: count >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0 })
    return NextResponse.json({ error: count >= MAX_ATTEMPTS ? "嘗試次數過多，請 15 分鐘後再試。" : "密碼不正確，請重新輸入。" }, { status: count >= MAX_ATTEMPTS ? 429 : 401, headers: NO_STORE })
  }
  attempts.delete(clientKey)

  const apiUrl = getApiUrl(requestedApiUrl)
  if (!apiUrl) return NextResponse.json({ error: "GAS API 網址格式不正確。" }, { status: 400, headers: NO_STORE })

  try {
    const classes = await addStudentDetails(apiUrl, await fetchClassProgress(apiUrl))
    const safeClasses = classes.map((classProgress) => ({
      ...classProgress,
      students: classProgress.students.map(({ studentId: _studentId, ...student }) => student),
      missingStudents: classProgress.missingStudents.map(({ studentId: _studentId, ...student }) => student),
      completedStudents: classProgress.completedStudents.map(({ studentId: _studentId, ...student }) => student),
    }))
    return NextResponse.json({ classes: safeClasses }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "無法取得班級詳細資料，請確認 GAS getStats 服務。" }, { status: 502, headers: NO_STORE })
  }
}
