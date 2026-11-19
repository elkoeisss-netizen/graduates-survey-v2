"use client"

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react"
import { mutate } from "swr"
import { ArrowLeft, Check, ChevronDown, GraduationCap, LockKeyhole, LoaderCircle, Settings2, ShieldCheck, Sparkles } from "lucide-react"
import { ClassProgressDashboard } from "@/components/class-progress-dashboard"

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxywSHpy6dMPeutRjHTcr4Qgp5gnTBX3Np49JfbJFW9hju1bqozcxxaBKL1VLHay0Sy/exec"
const OTHER_SCHOOL = "其他（外縣市或其他學校，請直接手動輸入）"
const OTHER_DEPARTMENT = "其他（自行輸入科系名稱或加註）"

const schools = ["國立旗美高中", "市立高雄高中", "市立新莊高中", "國立鳳山高中", "國立高雄師範大學附屬中學", "市立中山高中", "市立左營高中", "市立高雄高工", "市立高雄高商", "國立高餐大附中", "國立旗山農工", "市立三民家商", "私立中山工商", "私立樹德家商", "私立中華藝校", "文藻大學", "台南護專", "樹人醫專", "育英醫護", "大仁科大", "輔英科大", OTHER_SCHOOL]
const departmentGroups: [string, string[]][] = [
  ["普通科／學術學程", ["普通科", "綜合高中"]],
  ["1 機械群", ["機械科", "鑄造科", "板金科", "機械木模科", "配管科", "模具科", "機電科", "製圖科", "生物產業機電科", "電腦機械製圖科"]],
  ["2 動力機械群", ["汽車科", "重機科", "飛機修護科", "動力機械科", "農業機械科", "軌道車輛科"]],
  ["3 電機與電子群", ["資訊科", "電子科", "控制科", "電機科", "冷凍空調科", "航空電子科", "電子通信科", "電機空調科"]],
  ["4 土木與建築群", ["建築科", "土木科", "消防工程科", "空間測繪科"]],
  ["5 化工群", ["化工科", "紡織科", "染整科", "環境檢驗科"]],
  ["6 商業與管理群", ["商業經營科", "國際貿易科", "會計事務科", "資料處理科", "不動產事務科", "電子商務科", "流通管理科", "農產行銷科", "水產經營科", "航運管理科", "電競經營科"]],
  ["7 設計群", ["家具木工科", "美工科", "陶瓷工程科", "室內空間設計科", "圖文傳播科", "金屬工藝科", "家具設計科", "廣告設計科", "多媒體設計科", "室內設計科", "多媒體應用科", "美術工藝科"]],
  ["8 農業群", ["農場經營科", "園藝科", "森林科", "野生動物保育科", "造園科", "畜產保健科"]],
  ["9 食品群", ["食品加工科", "食品科", "水產食品科", "烘焙科", "食品營養科"]],
  ["10 家政群", ["家政科", "服裝科", "幼兒保育科", "美容科", "時尚模特兒科", "流行服飾科", "時尚造型科", "照顧服務科", "綜合職能科"]],
  ["11 餐旅群", ["餐飲管理科", "觀光事業科"]],
  ["12 水產群", ["水產養殖科", "漁業科"]],
  ["13 海事群", ["航海科", "輪機科"]],
  ["14 外語群", ["應用外語科(英文組)", "應用外語科(日文組)", "應用英語科", "應用日語科"]],
  ["15 藝術群", ["戲劇科", "音樂科", "舞蹈科", "美術科", "影劇科", "西樂科", "國樂科", "電影電視科", "表演藝術科", "多媒體動畫科", "時尚工藝科", "劇場藝術科", "原住民藝能科"]],
  ["16 醫護群", ["護理科", "醫事檢驗科", "醫學影像暨放射技術科", "物理治療科", "職能治療科", "視光科", "牙體技術科", "口腔衛生科", "老人服務事業科", "高齡健康照護科"]],
]
const channels = ["分區免試入學", "試辦學習區完全免試入學", "技優甄審", "專業群科甄選入學(高職)", "優先免試入學(五專)", "體育班特招甄選", "職校特色招生", "私校獨招", "實用技能", "身障適性輔導就學安置", "其他"]

type Student = { row: number; studentId: string; className: string; seatNo: string | number; name: string; school?: string; department?: string; channel?: string; note?: string }

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <div className="survey-field"><label className="field-label">{label}</label>{children}{hint && <p className="field-hint">{hint}</p>}</div>
}

function SelectField({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <Field label={label}><div className="select-wrap"><select className="survey-control" value={value} onChange={(event) => onChange(event.target.value)}><option value="">請選擇</option>{children}</select><ChevronDown aria-hidden="true" className="select-icon" size={18} /></div></Field>
}

export function GraduateSurvey() {
  const studentIdInputRef = useRef<HTMLInputElement>(null)
  const [apiUrl, setApiUrl] = useState(GAS_API_URL)
  const [draftUrl, setDraftUrl] = useState(GAS_API_URL)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [studentId, setStudentId] = useState("")
  const [student, setStudent] = useState<Student | null>(null)
  const [school, setSchool] = useState("")
  const [schoolOther, setSchoolOther] = useState("")
  const [department, setDepartment] = useState("")
  const [departmentOther, setDepartmentOther] = useState("")
  const [departmentExtra, setDepartmentExtra] = useState("")
  const [showDepartmentExtra, setShowDepartmentExtra] = useState(false)
  const [channel, setChannel] = useState("")
  const [channelOther, setChannelOther] = useState("")
  const [note, setNote] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const isCustomSchool = school === OTHER_SCHOOL
  const isCustomDepartment = department === OTHER_DEPARTMENT
  const isCustomChannel = channel === "其他"
  const finalDepartment = useMemo(() => isCustomDepartment ? departmentOther.trim() : [department, departmentExtra.trim()].filter(Boolean).join("（") + (departmentExtra.trim() ? "）" : ""), [department, departmentExtra, departmentOther, isCustomDepartment])

  function hydrateStudent(data: Student) {
    setStudent(data)
    const savedSchool = data.school || ""
    setSchool(schools.includes(savedSchool) ? savedSchool : savedSchool ? OTHER_SCHOOL : "")
    setSchoolOther(schools.includes(savedSchool) ? "" : savedSchool)
    const knownDepartments = departmentGroups.flatMap(([, options]) => options)
    const savedDepartment = data.department || ""
    const match = knownDepartments.find((option) => savedDepartment === option || savedDepartment.startsWith(`${option}（`))
    setDepartment(match || (savedDepartment ? OTHER_DEPARTMENT : ""))
    setDepartmentOther(match ? "" : savedDepartment)
    setDepartmentExtra(match && savedDepartment !== match ? savedDepartment.slice(match.length).replace(/^（|）$/g, "") : "")
    setShowDepartmentExtra(Boolean(match && savedDepartment !== match))
    const savedChannel = data.channel || ""
    setChannel(channels.includes(savedChannel) ? savedChannel : savedChannel ? "其他" : "")
    setChannelOther(channels.includes(savedChannel) ? "" : savedChannel)
    setNote(data.note || "")
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    if (!studentId.trim()) { setError("請先輸入學號。") ; return }
    setLoading(true)
    try {
      const response = await fetch(`${apiUrl}?studentId=${encodeURIComponent(studentId.trim())}`)
      const result = await response.json()
      if (result.status !== "success" || !result.data) throw new Error(result.message || "查無此學號，請確認輸入是否正確。")
      hydrateStudent(result.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "連線發生問題，請稍後再試。")
    } finally { setLoading(false) }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!student) return
    setError("")
    setLoading(true)
    try {
      const payload = { action: "updateStudent", row: student.row, school: isCustomSchool ? schoolOther.trim() : school, department: finalDepartment, channel: isCustomChannel ? channelOther.trim() : channel, note }
      const response = await fetch(apiUrl, { method: "POST", body: JSON.stringify(payload) })
      const result = await response.json()
      if (result.status !== "success") throw new Error(result.message || "儲存失敗，請確認資料後重試。")
      void mutate(`/api/dashboard/stats?apiUrl=${encodeURIComponent(apiUrl)}`)
      setSuccess(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "連線發生問題，請稍後再試。")
    } finally { setLoading(false) }
  }

  function logout() {
    setStudent(null); setStudentId(""); setSchool(""); setSchoolOther(""); setDepartment(""); setDepartmentOther(""); setDepartmentExtra(""); setChannel(""); setChannelOther(""); setNote(""); setError(""); setSuccess(false)
    requestAnimationFrame(() => {
      studentIdInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      studentIdInputRef.current?.focus({ preventScroll: true })
    })
  }

  return <main className="survey-shell">
    <div className="ambient ambient-one" aria-hidden="true" /><div className="ambient ambient-two" aria-hidden="true" />
    <header className="topbar"><a className="brand" href="#top" aria-label="畢業生進路調查首頁"><span className="brand-mark"><GraduationCap size={21} /></span><span>校園進路調查</span></a><button className="settings-button" onClick={() => { setDraftUrl(apiUrl); setSettingsOpen(true) }}><Settings2 size={16} />連線設定</button></header>
    <section className="main-content" id="top">
      <div className="hero-copy"><h1>每一段旅程，<br className="mobile-break" />都從這裡開始。</h1><p>填寫你的升學進路，讓我們一起為下一站做好準備。</p></div>
      <ClassProgressDashboard apiUrl={apiUrl} />
      {!student ? <section className="login-card" aria-labelledby="login-title"><div className="card-icon"><GraduationCap size={25} /></div><div className="card-heading"><span className="section-kicker">WELCOME, GRADUATE</span><h2 id="login-title">畢業生進路調查系統</h2><p>請輸入個人學號進行填報與查詢</p></div><form onSubmit={handleLookup} className="form-stack"><Field label="學生學號" hint="資料採嚴格個資保護，僅限本人檢視。"><input id="student-id" ref={studentIdInputRef} className="survey-control student-input" inputMode="numeric" autoComplete="off" value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="例如 1310101" aria-label="學生學號" /></Field>{error && <p className="error-message" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={19} /> : <LockKeyhole size={18} />}{loading ? "查詢中…" : "查詢 / 進入填報"}</button></form><div className="privacy-note"><ShieldCheck size={17} /><span>美濃國中輔導室製 ｜ 資料可重複登入修改</span></div></section> : <div className="form-page">
        <section className="student-card"><div className="student-avatar"><GraduationCap size={22} /></div><div className="student-details"><span className="student-tag">個人資料</span><div className="student-name">{student.name}<span>{student.className} 班・{student.seatNo} 號</span></div><div className="student-id-line">學號 {student.studentId}</div></div><button className="logout-button" onClick={logout}><ArrowLeft size={15} />切換學號</button></section>
        <form onSubmit={handleSave} className="edit-card"><div className="edit-card-header"><div><span className="section-kicker">YOUR NEXT CHAPTER</span><h2>填寫升學進路</h2><p>請依照目前錄取或就讀狀況填寫，完成後記得儲存。</p></div><div className="progress-icon"><Sparkles size={20} /></div></div>
          <div className="form-fields"><SelectField label="錄取／就讀學校" value={school} onChange={(value) => { setSchool(value); if (value !== OTHER_SCHOOL) setSchoolOther("") }}>{schools.map((option) => <option key={option} value={option}>{option}</option>)}</SelectField>{isCustomSchool && <Field label="請手動輸入學校名稱"><input className="survey-control" value={schoolOther} onChange={(event) => setSchoolOther(event.target.value)} placeholder="輸入學校全名" /></Field>}
          <SelectField label="錄取科組名稱" value={department} onChange={(value) => { setDepartment(value); setDepartmentExtra(""); if (value !== OTHER_DEPARTMENT) setDepartmentOther("") }}>{departmentGroups.map(([group, options]) => <optgroup key={group} label={group}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</optgroup>)}<optgroup label="其他"><option value={OTHER_DEPARTMENT}>{OTHER_DEPARTMENT}</option></optgroup></SelectField>{isCustomDepartment ? <Field label="請輸入科系名稱或補充說明"><input className="survey-control" value={departmentOther} onChange={(event) => setDepartmentOther(event.target.value)} placeholder="例如：普通科（棒球）" /></Field> : department && <div className="extra-toggle-wrap"><label className="check-row"><input type="checkbox" checked={showDepartmentExtra} onChange={(event) => setShowDepartmentExtra(event.target.checked)} /><span>需要加註科組資訊</span></label>{showDepartmentExtra && <Field label="科組補充說明"><input className="survey-control" value={departmentExtra} onChange={(event) => setDepartmentExtra(event.target.value)} placeholder="例如：棒球專長班" /></Field>}</div>}
          <SelectField label="升學管道" value={channel} onChange={(value) => { setChannel(value); if (value !== "其他") setChannelOther("") }}>{channels.map((option) => <option key={option} value={option}>{option}</option>)}</SelectField>{isCustomChannel && <Field label="請輸入升學管道"><input className="survey-control" value={channelOther} onChange={(event) => setChannelOther(event.target.value)} placeholder="輸入升學管道" /></Field>}
          <Field label="備註" hint="補充說明專用；無特殊狀況可免填。"><textarea className="survey-control survey-textarea" value={note} onChange={(event) => setNote(event.target.value)} placeholder="補充說明專用（例如：放棄升學準備就業、重考、體育班備取等特殊狀況，無則免填）" rows={4} /></Field></div>
          {error && <p className="error-message" role="alert">{error}</p>}<div className="submit-row"><p><ShieldCheck size={15} />美濃國中輔導室製 ｜ 資料可重複登入修改</p><button className="primary-button save-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={19} /> : <Check size={19} />}{loading ? "儲存中…" : "確認送出 / 儲存資料"}</button></div>
        </form>
      </div>}
    </section>
    <footer className="site-footer"><span>美濃國中輔導室製 ｜ 資料可重複登入修改</span><span>© 116 畢業生進路調查</span></footer>
    {settingsOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="modal-close" onClick={() => setSettingsOpen(false)} aria-label="關閉設定">×</button><div className="settings-icon"><Settings2 size={20} /></div><h2 id="settings-title">連線設定</h2><p>確認或更新進路調查系統的 API 網址。</p><label className="field-label" htmlFor="api-url">API 網址</label><input id="api-url" className="survey-control" type="url" value={draftUrl} onChange={(event) => setDraftUrl(event.target.value)} /><div className="modal-actions"><button className="secondary-button" onClick={() => setSettingsOpen(false)}>取消</button><button className="primary-button modal-save" onClick={() => { if (draftUrl.trim()) setApiUrl(draftUrl.trim()); setSettingsOpen(false) }}>儲存設定</button></div></section></div>}
    {success && <div className="modal-backdrop"><section className="success-modal" role="alertdialog" aria-modal="true" aria-labelledby="success-title"><div className="success-mark"><Check size={28} /></div><span className="section-kicker">SAVED SUCCESSFULLY</span><h2 id="success-title">儲存資料，填寫完成</h2><p>填報資料已儲存，班級進度也已更新。返回首頁後可查詢下一位學生。</p><button className="primary-button" onClick={logout}>返回學號查詢</button></section></div>}
  </main>
}
