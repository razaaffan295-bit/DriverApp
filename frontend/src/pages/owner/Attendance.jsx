import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  isNativeApp,
  generateAndOpenPDF,
} from '../../utils/pdfUpload'
import {
  ownerAddRecord,
  ownerDeleteRecord,
  ownerGetContracts,
  ownerGetRecords,
} from '../../api/attendanceAPI'
import { getUser } from '../../utils/helpers'

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

const OwnerAttendance = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    setUser(getUser())
  }, [])

  const [contracts, setContracts] = useState([])
  const [selectedContractId, setSelectedContractId] = useState('')
  const [selectedContract, setSelectedContract] = useState(null)
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
  const [selectedYear] = useState(
    new Date().getFullYear()
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString()
      .split('T')[0],
    status: '',
    hoursWorked: '',
    note: ''
  })

  useEffect(() => {
    const loadContracts = async () => {
      setLoading(true)
      try {
        const res = await ownerGetContracts()
        const list = (res.data?.contracts || [])
          .filter((c) => c.status === 'active')
          .filter((c) => c.vehicleCategory !== 'transport')
        setContracts(list)
        const first = list[0]?._id ? String(list[0]._id) : ''
        setSelectedContractId(first)
      } catch (e) {
        setContracts([])
        setSelectedContractId('')
        toast.error(
          e.response?.data?.message || t('contractsLoadError')
        )
      } finally {
        setLoading(false)
      }
    }

    loadContracts()
  }, [])

  useEffect(() => {
    const c = contracts.find((x) => String(x._id) === String(selectedContractId)) || null
    setSelectedContract(c)
  }, [contracts, selectedContractId])

  useEffect(() => {
    const loadRecords = async () => {
      if (!selectedContractId) {
        setRecords([])
        setSummary({
          presentDays: 0,
          absentDays: 0,
          halfDays: 0,
          totalHours: 0,
          grossTotal: 0
        })
        return
      }

      setLoading(true)
      try {
        const res = await ownerGetRecords({
          contractId: selectedContractId,
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
          s.grossTotal += calcSalary(selectedContract, r.status, Number(r.hoursWorked) || 0)
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
        toast.error(
          e.response?.data?.message || t('attendanceLoadError')
        )
      } finally {
        setLoading(false)
      }
    }

    loadRecords()
  }, [selectedContractId, selectedMonth, selectedYear, selectedContract])

  const driverName = selectedContract?.driverId?.name || t('driver')
  const driverPhone = selectedContract?.driverId?.phone || ''

  const formatRecordDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

  const showHoursInput = useMemo(() => {
    return selectedContract?.salaryType === 'hourly' || Boolean(selectedContract?.hasHourlyBonus)
  }, [selectedContract])

  const salaryPreview = useMemo(() => {
    if (!form.status) return 0
    return calcSalary(selectedContract, form.status, Number(form.hoursWorked) || 0)
  }, [selectedContract, form.status, form.hoursWorked])

  const handlePrint = async () => {
    if (isNativeApp()) {
      await generateAndOpenPDF(
        'attendance',
        {
          driverName: selectedContract?.driverId?.name || '',
          month: selectedMonth,
          year: selectedYear,
          presentDays: summary?.presentDays || 0,
          absentDays: summary?.absentDays || 0,
          halfDays: summary?.halfDays || 0,
          grossTotal: summary?.grossTotal || 0,
          records: (records || []).map(r => ({
            date: r.date,
            status: r.status,
            hoursWorked: r.hoursWorked || 0,
            salaryForDay: r.salaryForDay || 0,
          }))
        },
        `attendance-${selectedMonth}-${selectedYear}.pdf`
      )
    } else {
      window.print()
    }
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="mb-4 text-xl font-bold text-gray-800">
            {t('attendance')}
          </h1>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : contracts.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-600">
              {t('noData')}
            </div>
          ) : (
            <>
              <div className="mb-6 grid gap-4 sm:grid-cols-2 sm:items-end">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-800">
                    {t('selectDriver')}
                  </label>
                  <select
                    value={selectedContractId}
                    onChange={(e) => setSelectedContractId(e.target.value)}
                    className="input-field w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  >
                    {contracts.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.driverId?.name || t('driver')} — {c.jobId?.title || 'Job'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-800">
                    {t('month')}
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
              </div>

              <div className="mb-6 rounded-2xl bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-900">
                  {driverName} {driverPhone ? `· ${driverPhone}` : ''}
                </p>
                <div className="mt-1 text-sm text-blue-900/80">
                  {selectedContract?.jobId?.title || 'Job'} · {selectedContract?.jobId?.vehicleType || 'Vehicle'}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-blue-900/80">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 font-semibold">
                    {selectedContract?.salaryType || 'monthly'}
                  </span>
                  <span>
                    {selectedContract?.salaryType === 'monthly'
                      ? `₹${Number(selectedContract?.salaryPerMonth) || 0}/${t('perMonth')}`
                      : selectedContract?.salaryType === 'daily'
                        ? `₹${Number(selectedContract?.salaryPerDay) || 0}/${t('perDay')}`
                        : `₹${Number(selectedContract?.salaryPerHour) || 0}/${t('perHour')}`}
                  </span>
                  {selectedContract?.hasBhatta && (
                    <span>
                      ₹{Number(selectedContract?.dailyBhatta) || 0}/
                      {t('perDay')} {t('bhatta')}
                    </span>
                  )}
                  {selectedContract?.hasHourlyBonus && (
                    <span>
                      ₹{Number(selectedContract?.salaryPerHour) || 0}/
                      {t('perHour')} {t('bonus')}
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-blue-100 bg-blue-50/80 p-6">
                <h2 className="text-lg font-semibold text-blue-900">
                  {t('monthlySummary')}
                </h2>
                <p className="text-sm text-blue-700/80">
                  {MONTH_NAMES[selectedMonth - 1]} {selectedYear} · {driverName}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold text-green-600">
                      {summary?.presentDays ?? 0}
                    </div>
                    <div className="text-xs text-gray-600">{t('present')}</div>
                  </div>
                  <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold text-red-500">
                      {summary?.absentDays ?? 0}
                    </div>
                    <div className="text-xs text-gray-600">{t('absent')}</div>
                  </div>
                  <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold text-yellow-600">
                      {summary?.halfDays ?? 0}
                    </div>
                    <div className="text-xs text-gray-600">{t('halfDay')}</div>
                  </div>
                  <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                    <div className="text-2xl font-bold text-blue-700">
                      ₹{summary?.grossTotal ?? 0}
                    </div>
                    <div className="text-xs text-gray-600">{t('totalEarned')}</div>
                  </div>
                  {showHoursInput && (
                    <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                      <div className="text-2xl font-bold text-gray-900">
                        {summary?.totalHours ?? 0}
                      </div>
                      <div className="text-xs text-gray-600">{t('hours')}</div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-800">
                  {t('addRecord')}
                </h2>
                <div className="mt-4 grid gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('selectDate')}
                    </label>
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
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : 'border-gray-200 bg-gray-100 text-gray-600'
                      }`}
                    >
                      ✅ {t('present')}
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
                      🕐 {t('halfDay')}
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
                      ❌ {t('absent')}
                    </button>
                  </div>

                  {(selectedContract?.salaryType === 'hourly' || selectedContract?.hasHourlyBonus) && form.status && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('hoursWorkedToday')}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={form.hoursWorked}
                        onChange={(e) => setForm((f) => ({ ...f, hoursWorked: e.target.value }))}
                        placeholder="8"
                        className="input-field w-full"
                      />
                    </div>
                  )}

                  {form.status && (
                    <div className="rounded-xl bg-gray-50 p-3 mt-3">
                      <p className="text-sm font-semibold text-blue-700">
                        {t('todaySalary')}: ₹{salaryPreview}
                      </p>
                    </div>
                  )}

                  <div>
                    <input
                      value={form.note}
                      onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                      placeholder={t('addNote')}
                      className="input-field w-full"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={saving || !form.status || !selectedContractId}
                    onClick={async () => {
                      if (!selectedContractId) return
                      try {
                        setSaving(true)
                        await ownerAddRecord({
                          contractId: selectedContractId,
                          date: form.date,
                          status: form.status,
                          hoursWorked: Number(form.hoursWorked) || 0,
                          note: form.note || '',
                        })
                        toast.success(t('recordSaved'))
                        setForm((f) => ({ ...f, status: '', hoursWorked: '', note: '' }))
                        const res = await ownerGetRecords({
                          contractId: selectedContractId,
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
                          s.grossTotal += calcSalary(selectedContract, r.status, Number(r.hoursWorked) || 0)
                        })
                        s.totalHours = Math.round(s.totalHours * 100) / 100
                        s.grossTotal = Math.round(s.grossTotal)
                        setSummary(s)
                      } catch (e) {
                        toast.error(
                          e.response?.data?.message || t('saveError2')
                        )
                      } finally {
                        setSaving(false)
                      }
                    }}
                    className="w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                  >
                    {saving ? t('savingText') : t('saveRecord')}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-6">
                <h2 className="text-lg font-semibold text-gray-800">
                  {t('myRecords')}
                </h2>
                {records.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    {t('noRecordsThisMonth')}
                  </div>
                ) : (
                  <div className="mt-4">
                    {records.map((r) => (
                      <div
                        key={r._id}
                        className="mb-2 flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4"
                      >
                        <div>
                          <p className="font-semibold text-gray-800">
                            {formatRecordDate(r.date)}
                          </p>
                          <span
                            className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                              r.status === 'present'
                                ? 'bg-green-100 text-green-700'
                                : r.status === 'absent'
                                  ? 'bg-red-100 text-red-500'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {r.status === 'half_day' ? t('halfDay') : r.status}
                          </span>
                          {Number(r.hoursWorked) > 0 && (
                            <p className="mt-1 text-xs text-gray-600">
                              {Number(r.hoursWorked)} {t('hours')}
                            </p>
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
                              const ok = window.confirm(
                                t('confirmDelete')
                              )
                              if (!ok) return
                              try {
                                setSaving(true)
                                await ownerDeleteRecord(r._id)
                                toast.success(t('recordDeleted'))
                                const res = await ownerGetRecords({
                                  contractId: selectedContractId,
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
                                  s.grossTotal += calcSalary(selectedContract, x.status, Number(x.hoursWorked) || 0)
                                })
                                s.totalHours = Math.round(s.totalHours * 100) / 100
                                s.grossTotal = Math.round(s.grossTotal)
                                setSummary(s)
                              } catch (e) {
                                toast.error(
                                  e.response?.data?.message ||
                                    t('deleteError')
                                )
                              } finally {
                                setSaving(false)
                              }
                            }}
                            className="mt-2 text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-60"
                          >
                            {t('delete')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="print-area">
                  <div className="print-heading">
                    {t('attendanceSheet').toUpperCase()}
                  </div>

                  <div className="print-row">
                    <span>{t('driver')}:</span>
                    <span>{selectedContract?.driverId?.name}</span>
                  </div>
                  <div className="print-row">
                    <span>{t('phone')}:</span>
                    <span>{selectedContract?.driverId?.phone}</span>
                  </div>
                  <div className="print-row">
                    <span>{t('job')}:</span>
                    <span>{selectedContract?.jobId?.title}</span>
                  </div>
                  <div className="print-row">
                    <span>{t('vehicle')}:</span>
                    <span>{selectedContract?.jobId?.vehicleType}</span>
                  </div>
                  <div className="print-row">
                    <span>{t('salaryType')}:</span>
                    <span>{selectedContract?.salaryType}</span>
                  </div>
                  <div className="print-row">
                    <span>{t('month')}:</span>
                    <span>
                      {selectedMonth} / {selectedYear}
                    </span>
                  </div>
                  <div className="print-row">
                    <span>{t('owner')}:</span>
                    <span>{user?.name}</span>
                  </div>

                  <br />

                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>{t('date')}</th>
                        <th>{t('status')}</th>
                        {(selectedContract?.salaryType === 'hourly' ||
                          selectedContract?.hasHourlyBonus) && <th>{t('hours')}</th>}
                        <th>{t('salary')}</th>
                        <th>{t('notes')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record, i) => (
                        <tr key={record._id || i}>
                          <td>{new Date(record.date).toLocaleDateString('en-IN')}</td>
                          <td>
                            {record.status === 'present'
                              ? t('present')
                              : record.status === 'absent'
                                ? t('absent')
                                : t('halfDay')}
                          </td>
                          {(selectedContract?.salaryType === 'hourly' ||
                            selectedContract?.hasHourlyBonus) && (
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
                          <strong>{t('presentDays')}</strong>
                        </td>
                        <td>{summary.presentDays}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>{t('absentDays')}</strong>
                        </td>
                        <td>{summary.absentDays}</td>
                      </tr>
                      <tr>
                        <td>
                          <strong>{t('halfDays')}</strong>
                        </td>
                        <td>{summary.halfDays}</td>
                      </tr>
                      {(selectedContract?.salaryType === 'hourly' ||
                        selectedContract?.hasHourlyBonus) && (
                        <tr>
                          <td>
                            <strong>{t('totalHours')}</strong>
                          </td>
                          <td>{summary.totalHours}</td>
                        </tr>
                      )}
                      <tr>
                        <td>
                          <strong>{t('totalSalary')}</strong>
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
                      <div>{t('ownerSignature')}:</div>
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
                      <div>{t('driverSignature')}:</div>
                      <div
                        style={{
                          marginTop: '30px',
                          borderTop: '1px solid #000',
                          paddingTop: '4px',
                          width: '150px',
                        }}
                      >
                        {selectedContract?.driverId?.name}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: '20px',
                      fontSize: '11px',
                      color: '#666',
                      textAlign: 'center',
                      borderTop: '1px solid #eee',
                      paddingTop: '8px',
                    }}
                  >
                    {t('generatedBy')} —{' '}
                    {new Date().toLocaleDateString('en-IN')}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="no-print"
                  style={{
                    width: '100%',
                    padding: '14px',
                    background: '#1F2937',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginTop: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  📄 {t('downloadPDF')}
                </button>
              </div>
            </>
          )}
        </div>
    </div>
  )
}

export default OwnerAttendance
