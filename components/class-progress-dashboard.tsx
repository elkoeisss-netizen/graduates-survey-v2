"use client"

import { useState, type FormEvent } from "react"
import useSWR from "swr"
import { BarChart3, Check, ChevronDown, Circle, CircleHelp, LockKeyhole, LoaderCircle, RefreshCw, ShieldCheck, Users, X } from "lucide-react"
import type { ClassProgress, StudentProgress } from "@/lib/class-progress"

type PublicMissingStudent = Pick<StudentProgress, "seatNo" | "name" | "schoolFilled" | "departmentFilled" | "channelFilled">
type PublicClassProgress = Pick<ClassProgress, "className" | "total" | "completed" | "missing"> & { missingStudents: PublicMissingStudent[]; completedStudents: PublicMissingStudent[] }
type PublicStatsResponse = { classes: PublicClassProgress[] }

async function fetchPublicStats(url: string): Promise<PublicStatsResponse> {
  const response = await fetch(url, { cache: "no-store" })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || "目前無法取得班級統計資料。")
  return result
}

function formatSeatNo(seatNo: string | number) {
  return `${String(seatNo).padStart(2, "0")} 號`
}

function StudentList({ students, emptyMessage }: { students: StudentProgress[]; emptyMessage: string }) {
  if (!students.length) return <p className="private-empty">{emptyMessage}</p>

  return <ul className="private-student-list">{students.map((student, index) => <li key={`${student.seatNo}-${student.name}-${index}`}>
    <div className="private-student-heading"><span className="missing-seat">{formatSeatNo(student.seatNo)}</span><strong>{student.name}</strong><span className={student.filled ? "student-fill-status is-filled" : "student-fill-status is-missing"}>{student.filled ? "已填寫" : "未填寫"}</span></div>
    <div className="private-student-fields"><span>學校：{student.school || "未填寫"}</span><span>科系：{student.department || "未填寫"}</span><span>管道：{student.channel || "未填寫"}</span></div>
  </li>)}</ul>
}

function FieldCompletionIndicators({ student }: { student: PublicMissingStudent }) {
  const fields: [string, boolean | null][] = [["學校", student.schoolFilled], ["科系", student.departmentFilled], ["管道", student.channelFilled]]
  return <div className="public-missing-status">{fields.map(([label, filled]) => {
    const Icon = filled === true ? Check : filled === false ? Circle : CircleHelp
    const status = filled === true ? "已填" : filled === false ? "未填" : "狀態未提供"
    const className = filled === true ? "is-filled" : filled === false ? "is-missing" : "is-unknown"
    return <span className={className} aria-label={`${label}：${status}`} key={label}><Icon aria-hidden="true" />{label}</span>
  })}</div>
}

function PublicStatusStudentList({ students, emptyMessage }: { students: PublicMissingStudent[]; emptyMessage: string }) {
  if (!students.length) return <p className="private-empty">{emptyMessage}</p>

  return <ul className="public-missing-list">{students.map((student, index) => <li key={`${student.seatNo}-${student.name}-${index}`}>
    <div className="public-missing-heading"><span className="missing-seat">{formatSeatNo(student.seatNo)}</span><strong>{student.name}</strong></div>
    <FieldCompletionIndicators student={student} />
  </li>)}</ul>
}

export function ClassProgressDashboard({ apiUrl }: { apiUrl: string }) {
  const statsUrl = `/api/dashboard/stats?apiUrl=${encodeURIComponent(apiUrl)}`
  const { data, error: statsError, isLoading, isValidating, mutate } = useSWR<PublicStatsResponse>(statsUrl, fetchPublicStats, { refreshInterval: 60_000, revalidateOnFocus: true })
  const [accessOpen, setAccessOpen] = useState(false)
  const [pin, setPin] = useState("")
  const [loading, setLoading] = useState(false)
  const [accessError, setAccessError] = useState("")
  const [privateClasses, setPrivateClasses] = useState<ClassProgress[] | null>(null)
  const [pendingClass, setPendingClass] = useState<string | null>(null)
  const [expandedMissing, setExpandedMissing] = useState<string | null>(null)
  const [expandedCompleted, setExpandedCompleted] = useState<string | null>(null)
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null)
  const classes = data?.classes ?? []

  function openAccess(className?: string) {
    setPendingClass(className ?? null)
    setAccessError("")
    setAccessOpen(true)
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setAccessError("")
    try {
      const response = await fetch("/api/dashboard/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, apiUrl }),
        cache: "no-store",
      })
      const result = await response.json()
      setPin("")
      if (!response.ok) throw new Error(result.error || "驗證或載入詳細資料失敗。")
      setPrivateClasses(result.classes)
      setExpandedMissing(pendingClass)
      setExpandedDetails(null)
      setPendingClass(null)
      setAccessOpen(false)
    } catch (cause) {
      setAccessError(cause instanceof Error ? cause.message : "連線發生問題，請稍後再試。")
    } finally {
      setLoading(false)
    }
  }

  function closeAccess() {
    setPin("")
    setAccessError("")
    setPendingClass(null)
    setAccessOpen(false)
  }

  function lockDetails() {
    setPrivateClasses(null)
    setExpandedMissing(null)
    setExpandedCompleted(null)
    setExpandedDetails(null)
  }

  function toggleMissing(className: string) {
    setExpandedMissing((current) => current === className ? null : className)
  }

  function toggleCompleted(className: string) {
    setExpandedCompleted((current) => current === className ? null : className)
  }

  const privateByClass = new Map((privateClasses ?? []).map((item) => [item.className, item]))

  return <section className="public-progress" aria-labelledby="public-progress-title">
    <div className="public-progress-heading">
      <div className="public-progress-title-wrap"><div className="public-progress-icon"><BarChart3 size={19} /></div><div><span className="section-kicker">LIVE CLASS OVERVIEW</span><h2 id="public-progress-title">各班填報進度</h2><p>公開呈現整體進度與學生填報狀態；實際學校、科系和升學管道僅限授權人員查看。</p></div></div>
      <div className="public-progress-actions"><button className="progress-refresh-button" type="button" onClick={() => void mutate()} disabled={isValidating} aria-label="重新整理班級進度">{isValidating ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}<span>更新</span></button>{privateClasses ? <button className="teacher-access-button is-unlocked" type="button" onClick={lockDetails}><ShieldCheck size={15} />已解鎖・鎖定明細</button> : <button className="teacher-access-button" type="button" onClick={() => openAccess()}><LockKeyhole size={15} />導師/小老師查詢</button>}</div>
    </div>

    {isLoading ? <div className="public-progress-state"><LoaderCircle className="spin" size={19} /><span>正在載入公開統計…</span></div> : statsError ? <div className="public-progress-state is-error" role="alert"><span>{statsError.message}</span><button className="secondary-button" type="button" onClick={() => void mutate()}>重試</button></div> : classes.length ? <div className="public-class-grid">{classes.map((classProgress) => {
      const percent = classProgress.total ? Math.min(100, Math.round((classProgress.completed / classProgress.total) * 100)) : 0
      const privateClass = privateByClass.get(classProgress.className)
      const missingExpanded = expandedMissing === classProgress.className
      const completedExpanded = expandedCompleted === classProgress.className
      const detailsExpanded = expandedDetails === classProgress.className
      const missingStudents = privateClass?.missingStudents ?? []
      const students = privateClass?.students.length ? privateClass.students : missingStudents
      return <article className="public-class-card" key={classProgress.className}>
        <div className="public-class-card-heading"><div className="public-class-name"><span>CLASS</span><h3>{classProgress.className}<small>班</small></h3></div><div className="public-class-percent">{percent}<small>%</small></div></div>
        <div className="public-class-counts"><span>總人數<strong>{classProgress.total} <small>人</small></strong></span><button className="filled-count-toggle" type="button" onClick={() => toggleCompleted(classProgress.className)} aria-label={`展開${classProgress.className}班已填寫名單，共${classProgress.completed}人`} aria-expanded={completedExpanded} aria-controls={`public-completed-${classProgress.className}`}><span>已填寫</span><strong className="filled-count-value">{classProgress.completed} <small>人</small><ChevronDown size={12} className={completedExpanded ? "is-expanded" : ""} /></strong></button><button className="missing-count" type="button" onClick={() => toggleMissing(classProgress.className)} aria-label={`展開${classProgress.className}班未完成名單，共${classProgress.missing}人`} aria-expanded={missingExpanded} aria-controls={`public-missing-${classProgress.className}`}><span>未填寫</span><strong className="missing-count-value">{classProgress.missing} <small>人</small><ChevronDown size={12} className={missingExpanded ? "is-expanded" : ""} /></strong></button></div>
        <div className="public-progress-track" role="progressbar" aria-label={`${classProgress.className} 班整體填報進度`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percent}%` }} /></div>
        <div className="public-progress-caption"><span>{classProgress.completed} / {classProgress.total} 人已完成</span><span>每分鐘自動更新</span></div>
        {completedExpanded && <section className="private-roster" id={`public-completed-${classProgress.className}`} aria-label={`${classProgress.className} 班已填寫學生名單`}><h4>已填寫學生名單</h4><PublicStatusStudentList students={classProgress.completedStudents} emptyMessage={classProgress.completed ? "GAS getStats 尚未提供此班已填寫學生名單。" : "目前沒有已填寫的學生。"} /></section>}
        {missingExpanded && <section className="private-roster" id={`public-missing-${classProgress.className}`} aria-label={`${classProgress.className} 班未完成填報名單`}><h4>尚未完成填報名單</h4>{privateClasses ? <StudentList students={missingStudents} emptyMessage="目前沒有未完成名單，或 GAS 未回傳名單資料。" /> : <PublicStatusStudentList students={classProgress.missingStudents} emptyMessage={classProgress.missing ? "GAS 尚未提供此班名單資料。" : "目前沒有尚未完成的學生。"} />}</section>}
        {detailsExpanded && privateClasses && <section className="private-roster" aria-label={`${classProgress.className} 班學生填報資料`}><h4>{privateClass?.students.length ? "全班填報明細" : "目前可取得的學生明細"}</h4><StudentList students={students} emptyMessage={privateClass?.students.length ? "GAS 尚未回傳此班學生詳細資料。" : "GAS 尚未回傳學生名單資料。"} />{!privateClass?.students.length && <p className="private-empty">目前 GAS getStats 僅回傳未完成名單；若要查看全班學生的就學明細，需讓 GAS 同時回傳完整 students 資料。</p>}</section>}
        {privateClasses && <button className="class-details-toggle" type="button" onClick={() => setExpandedDetails((current) => current === classProgress.className ? null : classProgress.className)} aria-expanded={detailsExpanded}>{detailsExpanded ? "收合學生明細" : "查看學生填報明細"}<ChevronDown size={15} className={detailsExpanded ? "is-expanded" : ""} /></button>}
      </article>
    })}</div> : <div className="public-progress-state"><Users size={18} /><span>尚未取得 901～905 班的統計資料。</span></div>}

    {accessOpen && <div className="modal-backdrop progress-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeAccess() }}><section className="progress-modal access-modal" role="dialog" aria-modal="true" aria-labelledby="progress-title">
      <header className="progress-modal-header"><div className="progress-heading-icon"><LockKeyhole size={20} /></div><div className="progress-heading-copy"><span className="section-kicker">AUTHORIZED STAFF</span><h2 id="progress-title">導師／小老師查詢</h2><p>驗證後可查看每位學生的學校、科系與升學管道。</p></div><button className="progress-close" type="button" onClick={closeAccess} aria-label="關閉密碼視窗"><X size={19} /></button></header>
      <form className="progress-access" onSubmit={handleUnlock}><div className="progress-lock-icon"><LockKeyhole size={19} /></div><div><h3>限校內授權人員使用</h3><p>請輸入四位數查詢密碼；完整就學內容僅供授權人員查看。</p></div><label className="sr-only" htmlFor="progress-pin">四位數查詢密碼</label><input id="progress-pin" className="survey-control progress-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="off" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="輸入四位數密碼" aria-describedby={accessError ? "progress-error" : undefined} />{accessError && <p className="error-message progress-error" id="progress-error" role="alert">{accessError}</p>}<button className="primary-button progress-submit" type="submit" disabled={loading || pin.length !== 4}>{loading ? <LoaderCircle className="spin" size={18} /> : <LockKeyhole size={17} />}{loading ? "驗證並載入中…" : "驗證並解鎖明細"}</button></form>
      <footer className="progress-modal-footer"><span>美濃國中輔導室製 ｜ 資料可重複登入修改</span><button className="secondary-button" type="button" onClick={closeAccess}>取消</button></footer>
    </section></div>}
  </section>
}
