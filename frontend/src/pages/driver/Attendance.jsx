import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getUser } from '../../utils/helpers'
import { getDriverActiveContract } from '../../api/contractAPI'
import {
  driverAddRecord,
  driverDeleteRecord,
  driverGetRecords,
} from '../../api/attendanceAPI'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const isAndroid = () => {
  try {
    return (
      typeof window !== 'undefined' &&
      window.Capacitor !== undefined &&
      window.Capacitor.isNativePlatform() === true
    )
  } catch (e) {
    return false
  }
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const calcSalary = (contract, status, hours) => {
  if (!contract) return 0
  const {
    salaryType,
    salaryPerDay,
    salaryPerMonth,
    salaryPerHour,
    hasBhatta,
    dailyBhatta,
    hasHourlyBonus,
  } = contract

  let base = 0
  const perDay =
    salaryType === 'monthly' ? (salaryPerMonth || 0) / 30 : (salaryPerDay || 0)

  if (salaryType === 'hourly') {
    if (status !== 'absent') {
      base = (hours || 0) * (salaryPerHour || 0)
    }
    return Math.round(base)
  }

  if (status === 'present') base = perDay
  else if (status === 'half_day') base = perDay / 2
  else return 0

  if (hasBhatta) {
    const bhatta = dailyBhatta || 0
    if (status === 'present') base += bhatta
    else if (status === 'half_day') base += bhatta / 2
  }

  if (hasHourlyBonus && status !== 'absent') {
    base += (hours || 0) * (salaryPerHour || 0)
  }

  return Math.round(base)
}

const savePDF = async (doc, filename) => {
  try {
    const isNative =
      typeof window !== 'undefined' &&
      window.Capacitor !== undefined &&
      window.Capacitor.isNativePlatform() === true

    if (isNative) {
      const base64 = doc.output('datauristring').split(',')[1]
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const fname = `${filename}_${Date.now()}.pdf`
      await Filesystem.writeFile({
        path: fname,
        data: base64,
        directory: Directory.Cache,
      })
      const fileUri = await Filesystem.getUri({
        path: fname,
        directory: Directory.Cache,
      })
      const { Share } = await import('@capacitor/share')
      await Share.share({
        title: filename,
        text: filename,
        url: fileUri.uri,
        dialogTitle: 'PDF Save Karo ya Share Karein',
      })
    } else {
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } catch (e) {
    try {
      doc.save(filename)
    } catch (err) {
      console.error('PDF save failed:', err)
    }
  }
}

const DriverAttendance = () => {
  const navigate = useNavigate()

  const [contract, setContract] = useState(null)
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState({
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    totalHours: 0,
    grossTotal: 0
  })
  const [selectedMonth, setSelectedMonth] =
    useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] =
    useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    status: '',
    hoursWorked: '',
    note: '',
  })

  useEffect(() => {
    setUser(getUser())
  }, [])

  useEffect(() => {
    const loadContract = async () => {
      setLoading(true)
      try {
        const res = await getDriverActiveContract()
        setContract(res.data?.contract || null)
      } catch (e) {
        setContract(null)
        toast.error(e.response?.data?.message || 'Contract load nahi hua')
      } finally {
        setLoading(false)
      }
    }
    loadContract()
  }, [])

  useEffect(() => {
    const loadRecords = async () => {
      setLoading(true)
      try {
        const res = await driverGetRecords({
          month: selectedMonth,
          year: selectedYear,
        })
        const list = res.data?.records ?? []
        setRecords(list)

        const s = {
          presentDays: 0,
          absentDays: 0,
          halfDays: 0,
          totalHours: 0,
          grossTotal: 0,
        }
        list.forEach((r) => {
          if (r.status === 'present') s.presentDays += 1
          else if (r.status === 'absent') s.absentDays += 1
          else if (r.status === 'half_day') s.halfDays += 1
          s.totalHours += Number(r.hoursWorked) || 0
          s.grossTotal += calcSalary(
            res.data?.contract || contract,
            r.status,
            Number(r.hoursWorked) || 0
          )
        })
        s.totalHours = Math.round(s.totalHours * 100) / 100
        s.grossTotal = Math.round(s.grossTotal)
        setSummary(s)
      } catch (e) {
        setRecords([])
        setSummary({
          presentDays: 0,
          absentDays: 0,
          halfDays: 0,
          totalHours: 0,
          grossTotal: 0
        })
        toast.error(e.response?.data?.message || 'Attendance load nahi hua')
      } finally {
        setLoading(false)
      }
    }

    loadRecords()
  }, [selectedMonth, selectedYear, contract])

  const showHoursInput = useMemo(() => {
    return contract?.salaryType === 'hourly' || Boolean(contract?.hasHourlyBonus)
  }, [contract])

  const salaryPreview = useMemo(() => {
    if (!form.status) return 0
    return calcSalary(contract, form.status, Number(form.hoursWorked) || 0)
  }, [contract, form.status, form.hoursWorked])

  const fmtDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  const isTransport =
    contract?.vehicleCategory === 'transport' ||
    contract?.jobId?.vehicleCategory === 'transport'

  const handlePrint = () => {
    if (isAndroid()) {
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text('Attendance Report', 14, 15)
      doc.setFontSize(10)
      doc.text(
        `Name: ${user?.name || ''}`,
        14, 25
      )
      doc.text(
        `Month: ${selectedMonth}/${selectedYear}`,
        14, 32
      )
      doc.text(
        `Present: ${summary?.presentDays || 0}`,
        14, 39
      )
      doc.text(
        `Absent: ${summary?.absentDays || 0}`,
        14, 46
      )
      doc.text(
        `Total Earned: Rs.${summary?.grossTotal || 0}`,
        14, 53
      )
      const rows = (records || []).map(r => [
        new Date(r.date)
          .toLocaleDateString('en-IN'),
        r.status,
        r.hoursWorked || 0,
        `Rs.${r.salaryForDay || 0}`
      ])
      autoTable(doc, {
        startY: 60,
        head: [['Date','Status','Hours','Salary']],
        body: rows,
        headStyles: { fillColor: [29,78,216] }
      })
      savePDF(doc, `attendance-${selectedMonth}-${selectedYear}.pdf`)
    } else {
      window.print()
    }
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
      <div className="mx-auto max-w-3xl p-4 md:p-6 pb-8">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            </div>
          ) : !contract ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center">
              <p className="text-gray-700">Koi active kaam nahi hai</p>
              <button
                type="button"
                onClick={() => navigate('/driver/jobs')}
                className="mt-6 rounded-xl bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700"
              >
                Jobs Dhundho
              </button>
            </div>
          ) : (
            <>
              <div className="no-print">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="no-print bg-gray-700 text-white px-4 py-2 rounded-xl text-sm w-full mt-4"
                >
                  📄 Attendance PDF Download
                </button>
              </div>

              {isTransport ? (
                <div
                  style={{
                    background: '#FFF7ED',
                    border: '1px solid #FED7AA',
                    borderRadius: '16px',
                    padding: '24px',
                    textAlign: 'center',
                    marginTop: '16px',
                  }}
                >
                  <p style={{ fontSize: '32px', marginBottom: '8px' }}>
                    🚛
                  </p>
                  <p
                    style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: '#92400E',
                      marginBottom: '8px',
                    }}
                  >
                    Transport Driver
                  </p>
                  <p style={{ fontSize: '14px', color: '#B45309' }}>
                    Aapke liye daily attendance nahi hoti. Trip records bharein aur month end pe salary request karein.
                  </p>
                  <button
                    onClick={() => navigate('/driver/trips')}
                    style={{
                      marginTop: '16px',
                      background: '#F97316',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px 24px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                    }}
                  >
                    Trip Records Dekho
                  </button>
                </div>
              ) : (
                <>
                  <div className="print-area" style={{ display: 'none' }}>
                    <div className="print-heading">ATTENDANCE SHEET</div>

                    <div className="print-row">
                      <span>Driver:</span>
                      <span>{user?.name}</span>
                    </div>

                    <div className="print-row">
                      <span>Job:</span>
                      <span>{contract?.jobId?.title}</span>
                    </div>

                    <div className="print-row">
                      <span>Vehicle:</span>
                      <span>{contract?.jobId?.vehicleType}</span>
                    </div>

                    <div className="print-row">
                      <span>Month:</span>
                      <span>
                        {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
                      </span>
                    </div>

                    <div className="print-row">
                      <span>Salary Type:</span>
                      <span>{contract?.salaryType}</span>
                    </div>

                    <br />

                    <table className="print-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Status</th>
                          {(contract?.salaryType === 'hourly' ||
                            contract?.hasHourlyBonus) && <th>Hours</th>}
                          <th>Salary</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record, i) => (
                          <tr key={i}>
                            <td>
                              {new Date(record.date).toLocaleDateString(
                                'en-IN'
                              )}
                            </td>
                            <td>
                              {record.status === 'present'
                                ? 'Present'
                                : record.status === 'absent'
                                  ? 'Absent'
                                  : 'Half Day'}
                            </td>
                            {(contract?.salaryType === 'hourly' ||
                              contract?.hasHourlyBonus) && (
                              <td>{record.hoursWorked || 0}</td>
                            )}
                            <td>₹{record.salaryForDay || 0}</td>
                            <td>{record.note || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <br />

                    <table className="print-table">
                      <tbody>
                        <tr>
                          <td>
                            <strong>Present Days</strong>
                          </td>
                          <td>{summary.presentDays}</td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Absent Days</strong>
                          </td>
                          <td>{summary.absentDays}</td>
                        </tr>
                        <tr>
                          <td>
                            <strong>Half Days</strong>
                          </td>
                          <td>{summary.halfDays}</td>
                        </tr>
                        {(contract?.salaryType === 'hourly' ||
                          contract?.hasHourlyBonus) && (
                          <tr>
                            <td>
                              <strong>Total Hours</strong>
                            </td>
                            <td>{summary.totalHours}</td>
                          </tr>
                        )}
                        <tr>
                          <td>
                            <strong>Total Salary</strong>
                          </td>
                          <td>
                            <strong>₹{summary.grossTotal}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div
                      style={{
                        marginTop: '40px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div>Driver Signature:</div>
                        <div
                          style={{
                            marginTop: '30px',
                            borderTop: '1px solid #000',
                            paddingTop: '4px',
                            width: '150px',
                          }}
                        >
                          {user?.name}
                        </div>
                      </div>
                      <div>
                        <div>Owner Signature:</div>
                        <div
                          style={{
                            marginTop: '30px',
                            borderTop: '1px solid #000',
                            paddingTop: '4px',
                            width: '150px',
                          }}
                        >
                          _______________
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: '20px',
                        fontSize: '11px',
                        color: '#666',
                        textAlign: 'center',
                      }}
                    >
                      Generated by DriverApp —{' '}
                      {new Date().toLocaleDateString('en-IN')}
                    </div>
                  </div>

                  <div className="mb-6 rounded-2xl bg-green-50 p-4">
                    <p className="text-sm font-semibold text-green-900">
                      {contract?.jobId?.title || 'Active Job'} · {contract?.jobId?.vehicleType || 'Vehicle'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-green-900/80">
                      <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold">
                        {contract?.salaryType || 'monthly'}
                      </span>
                      <span>
                        {contract?.salaryType === 'monthly'
                          ? `₹${Number(contract?.salaryPerMonth) || 0}/month`
                          : contract?.salaryType === 'daily'
                            ? `₹${Number(contract?.salaryPerDay) || 0}/din`
                            : `₹${Number(contract?.salaryPerHour) || 0}/ghanta`}
                      </span>
                      {contract?.hasBhatta && (
                        <span>₹{Number(contract?.dailyBhatta) || 0}/din bhatta</span>
                      )}
                      {contract?.hasHourlyBonus && (
                        <span>₹{Number(contract?.salaryPerHour) || 0}/ghanta bonus</span>
                      )}
                    </div>
                  </div>

                  <div className="mb-6">
                    <label className="mb-1 block text-sm font-semibold text-gray-800">
                      Month
                    </label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="input-field w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    >
                      {MONTH_NAMES.map((m, i) => (
                        <option key={m} value={i + 1}>
                          {m} {selectedYear}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-gray-50 p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{summary.presentDays}</div>
                        <div className="text-xs text-gray-600">Present</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-4 text-center">
                        <div className="text-2xl font-bold text-red-500">{summary.absentDays}</div>
                        <div className="text-xs text-gray-600">Absent</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-4 text-center">
                        <div className="text-2xl font-bold text-yellow-600">{summary.halfDays}</div>
                        <div className="text-xs text-gray-600">Half Day</div>
                      </div>
                      <div className="rounded-xl bg-gray-50 p-4 text-center">
                        <div className="text-2xl font-bold text-blue-700">₹{summary.grossTotal}</div>
                        <div className="text-xs text-gray-600">Gross Total</div>
                      </div>
                      {showHoursInput && (
                        <div className="rounded-xl bg-gray-50 p-4 text-center">
                          <div className="text-2xl font-bold text-gray-900">{summary.totalHours}</div>
                          <div className="text-xs text-gray-600">Total Hours</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6">
                    <h2 className="text-lg font-semibold text-gray-800">Record Add Karo</h2>

                    <div className="mt-4 grid gap-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Tarikh</label>
                        <input
                          type="date"
                          value={form.date}
                          max={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                          className="input-field w-full"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setForm((f) => ({ ...f, status: 'present' }))}
                          className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold ${
                            form.status === 'present'
                              ? 'border-green-600 bg-green-600 text-white'
                              : 'border-gray-200 bg-gray-100 text-gray-600'
                          }`}
                        >
                          ✅ Present
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setForm((f) => ({ ...f, status: 'half_day' }))}
                          className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold ${
                            form.status === 'half_day'
                              ? 'border-yellow-500 bg-yellow-500 text-white'
                              : 'border-gray-200 bg-gray-100 text-gray-600'
                          }`}
                        >
                          🕐 Half Day
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setForm((f) => ({ ...f, status: 'absent' }))}
                          className={`w-full rounded-xl border px-4 py-3 text-sm font-semibold ${
                            form.status === 'absent'
                              ? 'border-red-500 bg-red-500 text-white'
                              : 'border-gray-200 bg-gray-100 text-gray-600'
                          }`}
                        >
                          ❌ Absent
                        </button>
                      </div>

                      {(contract?.salaryType === 'hourly' || contract?.hasHourlyBonus) && form.status && (
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            Aaj kitne ghante kaam kiya?
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={24}
                            value={form.hoursWorked}
                            onChange={(e) => {
                              const val = e.target.value
                              setForm((prev) => ({
                                ...prev,
                                hoursWorked: val,
                              }))
                            }}
                            placeholder="8"
                            className="input-field w-full"
                          />
                        </div>
                      )}

                      {form.status && (
                        <div className="rounded-xl bg-gray-50 p-3 mt-3">
                          <p className="text-sm font-semibold text-green-700">
                            Is din ki salary: ₹{salaryPreview}
                          </p>
                        </div>
                      )}

                      <div>
                        <input
                          value={form.note}
                          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                          placeholder="Koi note..."
                          className="input-field w-full"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={saving || !form.status}
                        onClick={async () => {
                          try {
                            if (!form.date || !form.status) return
                            setSaving(true)
                            await driverAddRecord({
                              date: form.date,
                              status: form.status,
                              hoursWorked: Number(form.hoursWorked) || 0,
                              note: form.note || '',
                            })
                            toast.success('Record save ho gaya!')
                            setForm((f) => ({ ...f, status: '', hoursWorked: '', note: '' }))
                            const res = await driverGetRecords({
                              month: selectedMonth,
                              year: selectedYear,
                            })
                            const list = res.data?.records ?? []
                            setRecords(list)

                            const s = {
                              presentDays: 0,
                              absentDays: 0,
                              halfDays: 0,
                              totalHours: 0,
                              grossTotal: 0,
                            }
                            list.forEach((r) => {
                              if (r.status === 'present') s.presentDays += 1
                              else if (r.status === 'absent') s.absentDays += 1
                              else if (r.status === 'half_day') s.halfDays += 1
                              s.totalHours += Number(r.hoursWorked) || 0
                              s.grossTotal += calcSalary(contract, r.status, Number(r.hoursWorked) || 0)
                            })
                            s.totalHours = Math.round(s.totalHours * 100) / 100
                            s.grossTotal = Math.round(s.grossTotal)
                            setSummary(s)
                          } catch (e) {
                            toast.error(e.response?.data?.message || 'Save nahi hua')
                          } finally {
                            setSaving(false)
                          }
                        }}
                        className="w-full rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                      >
                        {saving ? 'Save ho raha hai...' : 'Record Save Karo'}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-6">
                    <h2 className="text-lg font-semibold text-gray-800">Mere Records</h2>
                    {records.length === 0 ? (
                      <div className="py-8 text-center text-gray-400">Is mahine koi record nahi</div>
                    ) : (
                      <div className="mt-4">
                        {records.map((r) => (
                          <div
                            key={r._id}
                            className="mb-2 flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4"
                          >
                            <div>
                              <p className="font-semibold text-gray-800">{fmtDate(r.date)}</p>
                              <span
                                className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  r.status === 'present'
                                    ? 'bg-green-100 text-green-700'
                                    : r.status === 'absent'
                                      ? 'bg-red-100 text-red-500'
                                      : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {r.status === 'half_day' ? 'Half Day' : r.status}
                              </span>
                              {Number(r.hoursWorked) > 0 && (
                                <p className="mt-1 text-xs text-gray-600">{Number(r.hoursWorked)} ghante</p>
                              )}
                              {r.note && (
                                <p className="mt-1 text-xs italic text-gray-600">{r.note}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-800">₹{r.salaryForDay || 0}</p>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={async () => {
                                  const ok = window.confirm('Pakka delete karein?')
                                  if (!ok) return
                                  try {
                                    setSaving(true)
                                    await driverDeleteRecord(r._id)
                                    toast.success('Delete ho gaya')
                                    const res = await driverGetRecords({
                                      month: selectedMonth,
                                      year: selectedYear,
                                    })
                                    const list = res.data?.records ?? []
                                    setRecords(list)

                                    const s = {
                                      presentDays: 0,
                                      absentDays: 0,
                                      halfDays: 0,
                                      totalHours: 0,
                                      grossTotal: 0,
                                    }
                                    list.forEach((x) => {
                                      if (x.status === 'present') s.presentDays += 1
                                      else if (x.status === 'absent') s.absentDays += 1
                                      else if (x.status === 'half_day') s.halfDays += 1
                                      s.totalHours += Number(x.hoursWorked) || 0
                                      s.grossTotal += calcSalary(contract, x.status, Number(x.hoursWorked) || 0)
                                    })
                                    s.totalHours = Math.round(s.totalHours * 100) / 100
                                    s.grossTotal = Math.round(s.grossTotal)
                                    setSummary(s)
                                  } catch (e) {
                                    toast.error(e.response?.data?.message || 'Delete nahi hua')
                                  } finally {
                                    setSaving(false)
                                  }
                                }}
                                className="mt-2 text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-60"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
    </div>
  )
}

export default DriverAttendance
