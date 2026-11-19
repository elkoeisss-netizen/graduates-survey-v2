export type StudentProgress = {
  studentId?: string
  seatNo: string | number
  name: string
  school: string
  department: string
  channel: string
  schoolFilled: boolean | null
  departmentFilled: boolean | null
  channelFilled: boolean | null
  filled: boolean
}

export type ClassProgress = {
  className: string
  total: number
  completed: number
  missing: number
  missingStudents: StudentProgress[]
  completedStudents: StudentProgress[]
  students: StudentProgress[]
}

type RecordValue = Record<string, unknown>

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null
}

function firstValue(record: RecordValue, keys: string[]) {
  return keys.map((key) => record[key]).find((value) => value !== undefined && value !== null)
}

function textValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value)
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Math.max(0, Number(value))
  return undefined
}

function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value
  if (value === 1 || value === "1" || value === "true" || value === "已填寫" || value === "是") return true
  if (value === 0 || value === "0" || value === "false" || value === "未填寫" || value === "否") return false
  return undefined
}

function normalizeStudent(value: unknown): StudentProgress | null {
  if (typeof value === "string") {
    const match = value.match(/^\s*(\d+)\s*號?\s+(.+?)\s*$/)
    return match ? { seatNo: match[1], name: match[2], school: "", department: "", channel: "", schoolFilled: null, departmentFilled: null, channelFilled: null, filled: false } : null
  }

  const record = asRecord(value)
  if (!record) return null
  const studentId = textValue(firstValue(record, ["studentId", "studentID", "id", "學號"]))
  const seatNo = firstValue(record, ["seatNo", "seat", "studentNo", "number", "no", "座號"])
  const name = textValue(firstValue(record, ["name", "studentName", "fullName", "姓名"]))
  if (seatNo === undefined || !name) return null

  const schoolValue = firstValue(record, ["school", "schoolName", "acceptedSchool", "placement", "就讀學校", "錄取學校", "錄取／就讀學校"])
  const departmentValue = firstValue(record, ["department", "departmentName", "major", "科系", "科系名稱", "科組名稱", "錄取科組名稱"])
  const channelValue = firstValue(record, ["channel", "admissionChannel", "pathway", "升學管道"])
  const school = textValue(schoolValue)
  const department = textValue(departmentValue)
  const channel = textValue(channelValue)
  const submitted = booleanValue(firstValue(record, ["completed", "submitted", "filled", "isFilled", "isSubmitted", "已填寫", "填報完成"]))
  const schoolFilled = booleanValue(firstValue(record, ["schoolFilled", "hasSchool", "學校已填"])) ?? (schoolValue === undefined ? null : Boolean(school))
  const departmentFilled = booleanValue(firstValue(record, ["departmentFilled", "hasDepartment", "科系已填"])) ?? (departmentValue === undefined ? null : Boolean(department))
  const channelFilled = booleanValue(firstValue(record, ["channelFilled", "hasChannel", "管道已填"])) ?? (channelValue === undefined ? null : Boolean(channel))

  return { studentId: studentId || undefined, seatNo: seatNo as string | number, name, school, department, channel, schoolFilled, departmentFilled, channelFilled, filled: submitted ?? Boolean(schoolFilled && departmentFilled && channelFilled) }
}

function normalizeStudentList(value: unknown) {
  return Array.isArray(value) ? value.map(normalizeStudent).filter((student): student is StudentProgress => student !== null) : []
}

export function normalizeClassProgress(payload: unknown): ClassProgress[] {
  const root = asRecord(payload)
  const data = asRecord(root?.data)
  const rawClasses = firstValue(data || {}, ["classes", "classStats", "stats", "班級統計"]) ?? firstValue(root || {}, ["classes", "classStats", "stats", "班級統計"]) ?? root?.data
  const entries = Array.isArray(rawClasses)
    ? rawClasses.map((value) => ["", value] as const)
    : asRecord(rawClasses)
      ? Object.entries(rawClasses as RecordValue)
      : []

  return entries.flatMap(([key, value]) => {
    const record = asRecord(value)
    if (!record) return []
    const rawClassName = firstValue(record, ["className", "class", "classId", "classNo", "classNum", "classNumber", "班級"]) ?? key
    const className = String(rawClassName).match(/90[1-5]/)?.[0]
    if (!className) return []

    const students = normalizeStudentList(firstValue(record, ["students", "studentList", "records", "submissions", "responses", "全班學生", "學生資料"]))
    const explicitMissingValue = firstValue(record, ["missingStudents", "unfilledStudents", "pendingStudents", "notSubmittedStudents", "incompleteStudents", "notFilled", "studentsNotSubmitted", "uncompletedList", "未填寫名單"])
    const explicitCompletedValue = firstValue(record, ["completedStudents", "completedList", "filledStudents", "submittedStudents", "已填寫名單"])
    const missingStudents = normalizeStudentList(explicitMissingValue).map((student) => ({ ...student, filled: false }))
    const explicitCompletedStudents = normalizeStudentList(explicitCompletedValue).map((student) => ({ ...student, filled: true }))
    const totalValue = numberValue(firstValue(record, ["total", "totalCount", "studentCount", "totalStudents", "studentTotal", "總人數"]))
    const completedValue = numberValue(firstValue(record, ["completed", "submitted", "filled", "filledCount", "completedCount", "submittedCount", "已填寫人數"]))
    const explicitMissingCount = Array.isArray(explicitMissingValue) ? explicitMissingValue.length : numberValue(firstValue(record, ["missing", "unfilled", "pending", "notSubmitted", "notFilled", "unsubmittedCount", "unfilledCount", "missingCount", "未填寫人數"]))
    const total = totalValue ?? Math.max(students.length, explicitCompletedStudents.length) + Math.max(0, missingStudents.length - students.length)
    const completed = completedValue ?? (explicitCompletedStudents.length || (students.length ? students.filter((student) => student.filled).length : Math.max(0, total - (explicitMissingCount ?? missingStudents.length))))
    const missing = explicitMissingCount ?? (missingStudents.length || Math.max(0, total - completed))
    const listedStudents = [...students]
    for (const student of missingStudents) {
      const existingIndex = listedStudents.findIndex((existing) => String(existing.seatNo) === String(student.seatNo))
      if (existingIndex < 0) listedStudents.push(student)
      else listedStudents[existingIndex] = { ...listedStudents[existingIndex], ...student, filled: false }
    }
    for (const student of explicitCompletedStudents) {
      const existingIndex = listedStudents.findIndex((existing) => String(existing.seatNo) === String(student.seatNo))
      if (existingIndex < 0) listedStudents.push(student)
      else listedStudents[existingIndex] = { ...listedStudents[existingIndex], ...student, filled: true }
    }
    const derivedMissingStudents = missingStudents.length ? missingStudents : listedStudents.filter((student) => !student.filled)
    const completedStudents = explicitCompletedStudents.length ? explicitCompletedStudents : listedStudents.filter((student) => student.filled)

    return [{ className, total, completed, missing, missingStudents: derivedMissingStudents, completedStudents, students: listedStudents }]
  })
}
