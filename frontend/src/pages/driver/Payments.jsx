import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getUser } from '../../utils/helpers'
import {
  getPaymentSummary,
  getPayments,
  getAdvances,
  confirmPayment as confirmPaymentApi,
  rejectPayment as rejectPaymentApi,
  requestAdvance as requestAdvanceApi,
  requestPayment as requestPaymentApi,
  requestTripPayment,
} from '../../api/paymentAPI'
import { getDriverTrips } from '../../api/tripAPI'
import {
  isNativeApp,
  generateAndOpenPDF,
} from '../../utils/pdfUpload'
import { useDataCache } from '../../contexts/DataCacheContext'

const tripFrom = (t) => t.fromLocation || t.from || ''
const tripTo = (t) => t.toLocation || t.to || ''
const tripCargo = (t) => t.cargo || t.description || ''
const expenseLabelTrip = (ex) => ex.type || ex.category || 'other'
const grandTotalTrip = (t) =>
  (Number(t.totalExpenses) || 0) + (Number(t.totalRepairs) || 0)

/** Backend may set approvedAmount to 0 while approvedExpenses holds the value — avoid `0 ?? x` */
const tripApprovedAmount = (t) =>
  Number(t.approvedAmount) ||
  Number(t.approvedExpenses) ||
  0

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

const lastFourMonthYearOptions = () => {
  const out = []
  const n = new Date()
  for (let i = 0; i < 4; i += 1) {
    const d = new Date(n.getFullYear(), n.getMonth() - i, 1)
    const month = d.getMonth() + 1
    const year = d.getFullYear()
    out.push({
      key: `${month}-${year}`,
      month,
      year,
      label: `${MONTH_NAMES[d.getMonth()]} ${year}`,
    })
  }
  return out
}

const fmtMoney = (n) =>
  `₹${Number.isFinite(Number(n)) ? Number(n) : 0}`

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

const isTripPaymentRow = (p) =>
  p.paymentType === 'trip' ||
  p.requestKind === 'trip' ||
  (p.tripId != null && p.tripId !== '')

const payoutMethodOf = (p) => {
  if (p.payoutMethod === 'cash' || p.payoutMethod === 'upi') {
    return p.payoutMethod
  }
  if (p.paymentType === 'cash' || p.paymentType === 'upi') {
    return p.paymentType
  }
  return 'upi'
}

const DriverPayments = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState('summary')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [payments, setPayments] = useState([])
  const [advances, setAdvances] = useState([])
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [confirmingId, setConfirmingId] = useState(null)
  const [reqAmount, setReqAmount] = useState('')
  const [reqReason, setReqReason] = useState('')
  const [submittingReq, setSubmittingReq] = useState(false)
  const [reqPayKey, setReqPayKey] = useState(() => {
    const d = new Date()
    return `${d.getMonth() + 1}-${d.getFullYear()}`
  })
  const [reqPayNote, setReqPayNote] = useState('')
  const [requesting, setRequesting] = useState(false)
  const [printPayment, setPrintPayment] = useState(null)
  const [historyFilter, setHistoryFilter] = useState('sab')
  const [requestAmount, setRequestAmount] = useState(0)
  const [tripEarnings, setTripEarnings] = useState([])
  const [tripPaymentsList, setTripPaymentsList] = useState([])
  const [tripTotal, setTripTotal] = useState(0)
  const [tripPaid, setTripPaid] = useState(0)
  const [tripNetDue, setTripNetDue] = useState(0)
  const [tripLoading, setTripLoading] = useState(false)
  const [tripRequestingId, setTripRequestingId] = useState(null)
  const [printTrip, setPrintTrip] = useState(null)
  const printPaymentTimeoutRef = useRef(null)
  const printTripTimeoutRef = useRef(null)
  const {
    getCachedData,
    setCachedData,
    clearCache
  } = useDataCache()

  const navigate = useNavigate()

  useEffect(() => {
    return () => {
      if (printPaymentTimeoutRef.current) {
        clearTimeout(printPaymentTimeoutRef.current)
      }
      if (printTripTimeoutRef.current) {
        clearTimeout(printTripTimeoutRef.current)
      }
      setPrintPayment(null)
      setPrintTrip(null)
    }
  }, [])

  const loadSummary = useCallback(async () => {
    const res = await getPaymentSummary()
    const summaryData = res.data?.summary ?? null
    setSummary(summaryData)
    setCachedData('driver_payments_summary', summaryData)
  }, [setCachedData])

  const loadHistory = useCallback(async () => {
    const res = await getPayments()
    const list = res.data?.payments ?? []
    setPayments(list)
    setCachedData('driver_payments_history', list)
  }, [setCachedData])

  const loadAdvances = useCallback(async () => {
    const res = await getAdvances()
    const list = res.data?.advances ?? []
    setAdvances(list)
    setCachedData('driver_payments_advances', list)
  }, [setCachedData])

  const loadTripEarnings = useCallback(async () => {
    try {
      setTripLoading(true)
      const [tripsRes, paymentsRes] = await Promise.all([
        getDriverTrips(),
        getPayments(),
      ])

      const trips = tripsRes.data?.trips || []
      const approved = trips.filter((tr) => tr.status === 'approved')

      const allPayments = paymentsRes.data?.payments || []
      const tripPayments = allPayments.filter(
        (p) =>
          (p.paymentType === 'trip' || p.requestKind === 'trip') &&
          p.driverConfirmed === true
      )

      const totalApproved = approved.reduce(
        (sum, tr) => sum + tripApprovedAmount(tr),
        0
      )

      const totalTripPaid = tripPayments.reduce(
        (sum, p) => sum + (Number(p.amount) || 0),
        0
      )

      const netDueTrips = totalApproved - totalTripPaid

      setTripEarnings(approved)
      setTripPaymentsList(tripPayments)
      setTripTotal(totalApproved)
      setTripPaid(totalTripPaid)
      setTripNetDue(netDueTrips)
      setCachedData('driver_trip_earnings', {
        earnings: approved,
        paymentsList: tripPayments,
        total: totalApproved,
        paid: totalTripPaid,
        netDue: netDueTrips,
      })
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        t('tripsLoadError') ||
        'Trips load nahi hue'
      )
    } finally {
      setTripLoading(false)
    }
  }, [t, setCachedData])

  const refreshTab = useCallback(async (silent = false) => {
    if (tab === 'trip') return
    if (!silent) setLoading(true)
    try {
      if (tab === 'summary') {
        await Promise.all([loadSummary(), loadHistory()])
      } else if (tab === 'history') await loadHistory()
      else if (tab === 'advance' || tab === 'request') {
        await Promise.all([loadSummary(), loadAdvances()])
      }
    } catch (e) {
      if (!silent) {
        if (tab === 'summary') setSummary(null)
        toast.error(
          e.response?.data?.message ||
          t('loadError') ||
          'Load nahi hua'
        )
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [tab, loadSummary, loadHistory, loadAdvances, t])

  useEffect(() => {
    if (tab === 'trip') {
      const cached = getCachedData('driver_trip_earnings')
      if (cached) {
        setTripEarnings(cached.earnings || [])
        setTripPaymentsList(cached.paymentsList || [])
        setTripTotal(cached.total || 0)
        setTripPaid(cached.paid || 0)
        setTripNetDue(cached.netDue || 0)
        setTripLoading(false)
      }
      return
    }

    const cachedSummary = getCachedData('driver_payments_summary')
    const cachedHistory = getCachedData('driver_payments_history')
    const cachedAdvances = getCachedData('driver_payments_advances')

    let hasCachedData = false

    if (tab === 'summary' || tab === 'advance' || tab === 'request') {
      if (cachedSummary) {
        setSummary(cachedSummary)
        hasCachedData = true
      }
    }
    if (tab === 'summary' || tab === 'history') {
      if (cachedHistory) {
        setPayments(cachedHistory)
        hasCachedData = true
      }
    }
    if (tab === 'advance' || tab === 'request') {
      if (cachedAdvances) {
        setAdvances(cachedAdvances)
        hasCachedData = true
      }
    }

    if (hasCachedData) {
      setLoading(false)
      refreshTab(true)
    } else {
      refreshTab(false)
    }
  }, [tab])

  const isTransport = summary?.isTransport || false

  useEffect(() => {
    if (!isTransport && tab === 'trip') {
      setTab('summary')
    }
  }, [isTransport, tab])

  useEffect(() => {
    if (tab !== 'trip' || !isTransport) return
    loadTripEarnings()
  }, [tab, isTransport, loadTripEarnings])

  useEffect(() => {
    if (summary) {
      const due =
        (summary.totalSalaryEarned || 0) -
        (summary.totalPaid || 0)
      if (due > 0) {
        setRequestAmount(due)
      } else {
        setRequestAmount(0)
      }
    }
  }, [summary])

  const pendingPayments = useMemo(
    () =>
      payments.filter(
        (p) =>
          p.ownerMarkedPaid &&
          !p.driverConfirmed &&
          p.status === 'pending' &&
          !p.driverRejected
      ),
    [payments]
  )

  const pendingAdvanceRequest = useMemo(
    () => advances.some((a) => a.status === 'pending'),
    [advances]
  )

  const { reqPayMonth, reqPayYear } = useMemo(() => {
    const parts = reqPayKey.split('-').map((x) => Number(x))
    return {
      reqPayMonth: parts[0],
      reqPayYear: parts[1],
    }
  }, [reqPayKey])

  const upiFromProfile = summary?.driverBankDetails?.upiId?.trim()
  const hasUpi = Boolean(upiFromProfile)

  const handleRequest = useCallback(async () => {
    const due =
      (summary?.totalSalaryEarned || 0) -
      (summary?.totalPaid || 0)

    if (due <= 0) {
      toast.error(t('noAmountDue'))
      return
    }

    const amt = Number(requestAmount) || 0
    if (amt <= 0 || amt > due) {
      toast.error(
        amt > due
          ? t('amountExceeds')
          : t('enterAmount')
      )
      return
    }

    try {
      setRequesting(true)
      await requestPaymentApi({
        amount: amt,
        month: reqPayMonth,
        year: reqPayYear,
        note: reqPayNote || '',
      })
      toast.success(t('paymentRequestSent'))
      setReqPayNote('')

      clearCache('driver_payments_summary')
      clearCache('driver_payments_history')
      clearCache('driver_dashboard')

      await loadSummary()
      await loadHistory()
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        t('requestError') ||
        'Request nahi gayi'
      )
    } finally {
      setRequesting(false)
    }
  }, [
    summary,
    requestAmount,
    reqPayMonth,
    reqPayYear,
    reqPayNote,
    t,
    loadSummary,
    loadHistory,
    clearCache,
  ])

  const onConfirm = useCallback(async (paymentId) => {
    setConfirmingId(paymentId)
    try {
      await confirmPaymentApi({ paymentId })
      toast.success(t('confirmDone'))
      clearCache('driver_payments_summary')
      clearCache('driver_payments_history')
      clearCache('driver_dashboard')
      await loadHistory()
      await loadSummary()
    } catch (e) {
      toast.error(
        e.response?.data?.message ||
        t('confirmError') ||
        'Confirm nahi hua'
      )
    } finally {
      setConfirmingId(null)
    }
  }, [t, loadHistory, loadSummary, clearCache])

  const onRejectSubmit = useCallback(async (paymentId) => {
    try {
      await rejectPaymentApi({
        paymentId,
        reason: rejectReason,
      })
      toast.success(t('rejectDone'))
      setRejectingId(null)
      setRejectReason('')
      clearCache('driver_payments_summary')
      clearCache('driver_payments_history')
      await loadHistory()
      await loadSummary()
    } catch (e) {
      toast.error(
        e.response?.data?.message ||
        t('rejectError') ||
        'Reject nahi hua'
      )
    }
  }, [rejectReason, t, loadHistory, loadSummary, clearCache])

  const handlePrintReceipt = useCallback(async (payment) => {
    try {
      if (isNativeApp()) {
        await generateAndOpenPDF(
          'payment',
          {
            amount: payment.amount,
            netAmount: payment.netAmount || payment.amount,
            payoutMethod: payment.payoutMethod || 'upi',
            utrNumber: payment.utrNumber || '',
            date: new Date(
              payment.ownerPaidAt || payment.createdAt
            ).toLocaleDateString('en-IN'),
            driverName: payment.driverId?.name || '',
            ownerName: payment.ownerId?.name || '',
            status: payment.status,
          },
          `receipt-${payment._id}.pdf`
        )
      } else {
        setPrintPayment(payment)
        if (printPaymentTimeoutRef.current) {
          clearTimeout(printPaymentTimeoutRef.current)
        }
        printPaymentTimeoutRef.current = setTimeout(() => {
          window.print()
          setTimeout(() => {
            setPrintPayment(null)
          }, 500)
        }, 300)
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        'PDF generation failed'
      )
    }
  }, [])

  const onRequestAdvance = useCallback(async (e) => {
    e.preventDefault()
    const amt = Number(reqAmount)
    if (!amt || amt <= 0) {
      toast.error(t('enterAmount'))
      return
    }
    setSubmittingReq(true)
    try {
      await requestAdvanceApi({
        requestedAmount: amt,
        reason: reqReason,
      })
      toast.success(t('advanceRequested'))
      setReqAmount('')
      setReqReason('')
      clearCache('driver_payments_advances')
      await loadAdvances()
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        t('requestError') ||
        'Request nahi gayi'
      )
    } finally {
      setSubmittingReq(false)
    }
  }, [reqAmount, reqReason, t, loadAdvances, clearCache])

  const s = summary

  const netDue = useMemo(
    () =>
      (summary?.totalSalaryEarned || 0) -
      (summary?.totalPaid || 0),
    [summary]
  )

  const driverTabs = useMemo(
    () => [
      { id: 'summary', label: t('status') },
      ...(isTransport
        ? [{ id: 'trip', label: t('tripEarnings') }]
        : []),
      { id: 'history', label: t('paymentHistory') },
      { id: 'advance', label: t('advance') },
      { id: 'request', label: t('requestAdvance') },
    ],
    [isTransport, t]
  )

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'salary') {
      return payments.filter((p) => !isTripPaymentRow(p))
    }
    if (historyFilter === 'trip') {
      return payments.filter((p) => isTripPaymentRow(p))
    }
    return payments
  }, [historyFilter, payments])

  const tripPaidMap = useMemo(() => {
    const map = new Map()
    tripPaymentsList.forEach((p) => {
      const tripId = String(p.tripId?._id ?? p.tripId ?? '')
      if (!tripId) return
      const current = map.get(tripId) || 0
      map.set(tripId, current + (Number(p.amount) || 0))
    })
    return map
  }, [tripPaymentsList])

  const getTripPaidAmount = useCallback(
    (tripId) => tripPaidMap.get(String(tripId)) || 0,
    [tripPaidMap]
  )

  const handleTripPaymentRequest = useCallback(async (trip) => {
    const approvedAmt = tripApprovedAmount(trip)
    const paidSoFar = getTripPaidAmount(trip._id)
    const baaki = Math.max(0, approvedAmt - paidSoFar)
    if (!baaki) {
      toast.error(t('noAmountDue'))
      return
    }
    setTripRequestingId(trip._id)
    try {
      await requestTripPayment({
        tripId: trip._id,
        amount: baaki,
      })
      toast.success(t('tripPaymentRequestSent'))
      clearCache('driver_trip_earnings')
      clearCache('driver_payments_history')
      await loadTripEarnings()
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        t('requestError') ||
        'Request nahi gayi'
      )
    } finally {
      setTripRequestingId(null)
    }
  }, [getTripPaidAmount, t, loadTripEarnings, clearCache])

  const handleTripReceipt = useCallback(async (trip) => {
    try {
      if (isNativeApp()) {
        await generateAndOpenPDF(
          'trip',
          {
            from: trip.fromLocation || trip.from || '',
            to: trip.toLocation || trip.to || '',
            cargo: trip.cargo || trip.description || '',
            date: new Date(
              trip.tripDate || trip.createdAt
            ).toLocaleDateString('en-IN'),
            totalExpenses: trip.totalExpenses || 0,
            totalRepairs: trip.totalRepairs || 0,
            grandTotal: grandTotalTrip(trip),
            approvedAmount: tripApprovedAmount(trip),
            driverName: trip.driverId?.name || '',
            ownerName: trip.ownerId?.name || '',
          },
          `trip-receipt-${trip._id}.pdf`
        )
      } else {
        setPrintTrip(trip)
        if (printTripTimeoutRef.current) {
          clearTimeout(printTripTimeoutRef.current)
        }
        printTripTimeoutRef.current = setTimeout(() => {
          window.print()
          setTimeout(() => {
            setPrintTrip(null)
          }, 500)
        }, 300)
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
        'PDF generation failed'
      )
    }
  }, [])

  const repayPct = useMemo(() => {
    if (!summary || !summary.totalAdvance || summary.totalAdvance <= 0) {
      return 0
    }
    return Math.min(
      100,
      Math.round(
        (summary.totalAdvanceRepaid / summary.totalAdvance) * 100
      )
    )
  }, [summary])

  const monthOptions = useMemo(
    () => lastFourMonthYearOptions(),
    []
  )

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
      <div className="mx-auto max-w-2xl px-4 py-6 pb-6 md:pb-8">
          <div className="mb-6 flex flex-wrap gap-2">
            {driverTabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id)
                  if (id === 'trip') loadTripEarnings()
                }}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  tab === id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading && tab !== 'trip' ? (
            <div className="flex justify-center py-16">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent"
                role="status"
                aria-label={t('loading')}
              />
            </div>
          ) : tab === 'summary' ? (
            !s ? (
              <p className="text-center text-gray-600">
                {t('noActiveJob')}
              </p>
            ) : (
              <>
                {isTransport && (
                  <div
                    style={{
                      background: '#FFF7ED',
                      border: '1px solid #FED7AA',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: '#92400E',
                    }}
                  >
                    <span aria-hidden="true">🚛</span> {t('transportFixedSalary')}: ₹
                    {summary?.contract?.salaryPerMonth || 0}/{t('perMonth')}
                  </div>
                )}

                <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                    <p className="text-xs text-green-800">
                      {t('totalEarned')}
                    </p>
                    <p className="text-xl font-bold text-green-900">
                      {fmtMoney(s.totalSalaryEarned)}
                    </p>
                    <p className="mt-1 text-[10px] text-green-700">
                      {t('attendanceTotal')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-xs text-blue-800">
                      {t('totalPaid')}
                    </p>
                    <p className="text-xl font-bold text-blue-900">
                      {fmtMoney(s.totalPaid)}
                    </p>
                    <p className="mt-1 text-[10px] text-blue-700">
                      {t('confirmedPayments')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs text-gray-800">{t('netDue')}</p>
                    <p
                      className={`text-xl font-bold ${
                        netDue > 0
                          ? 'text-red-600'
                          : netDue === 0
                            ? 'text-green-600'
                            : 'text-red-500'
                      }`}
                    >
                      {fmtMoney(netDue)}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-600">
                      {t('amountDue')}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-6">
                  <h2 className="text-lg font-semibold text-green-900">
                    {t('requestSalaryPayment')}
                  </h2>
                  {netDue <= 0 ? (
                    <p className="mt-3 text-sm text-green-800">
                      {t('noPaymentDue')}
                    </p>
                  ) : (
                    <>
                      <div className="mt-3 text-sm text-green-900">
                        {t('amountDueLabel')}:{' '}
                        <strong>
                          ₹{Math.max(0, netDue)}
                        </strong>
                      </div>

                      <label className="mt-4 block text-sm font-medium text-gray-800">
                        {t('howMuchPayment')} (max ₹
                        {Math.max(0, Math.floor(netDue))})
                      </label>
                      <div className="mt-1 flex items-center rounded-xl border border-green-200 bg-white px-3">
                        <span className="text-gray-500">₹</span>
                        <input
                          type="number"
                          min={1}
                          max={Math.max(1, netDue)}
                          step={1}
                          value={
                            requestAmount === 0 ? '' : requestAmount
                          }
                          onChange={(e) => {
                            const raw = e.target.value
                            if (raw === '') {
                              setRequestAmount(0)
                              return
                            }
                            const v = Number(raw)
                            if (!Number.isFinite(v)) return
                            const cap = Math.max(0, netDue)
                            setRequestAmount(
                              Math.min(
                                Math.max(0, v),
                                cap || 0
                              )
                            )
                          }}
                          className="w-full border-0 py-2 pl-1 text-sm focus:ring-0"
                        />
                      </div>

                      {!hasUpi && (
                        <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                          <p className="text-sm font-medium text-yellow-900">
                            <span aria-hidden="true">⚠️</span> {t('setUpiFirst')}
                          </p>
                          <button
                            type="button"
                            onClick={() => navigate('/driver/profile')}
                            className="mt-3 rounded-xl bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
                          >
                            {t('updateProfile')}
                          </button>
                        </div>
                      )}

                      <div className="mt-4 text-sm text-gray-700">
                        <span className="text-gray-500">
                          {t('yourUpiId')}:
                        </span>{' '}
                        {hasUpi ? (
                          <span className="font-medium text-gray-900">
                            {upiFromProfile}
                          </span>
                        ) : (
                          <span className="text-amber-700">
                            {t('upiNotSet')}
                          </span>
                        )}
                      </div>

                      <label className="mt-4 block text-sm font-medium text-gray-800">
                        {t('whichMonth')}
                      </label>
                      <select
                        value={reqPayKey}
                        onChange={(e) => setReqPayKey(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-green-200 bg-white px-3 py-2 text-sm"
                      >
                        {monthOptions.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>

                      <label className="mt-4 block text-sm font-medium text-gray-800">
                        {t('noteToOwner')}
                      </label>
                      <textarea
                        rows={2}
                        value={reqPayNote}
                        onChange={(e) => setReqPayNote(e.target.value)}
                        placeholder={t('noteToOwnerPlaceholder')}
                        maxLength={500}
                        className="mt-1 w-full rounded-xl border border-green-200 bg-white p-3 text-sm"
                      />

                      <button
                        type="button"
                        disabled={
                          requesting ||
                          netDue <= 0 ||
                          Number(requestAmount) <= 0 ||
                          Number(requestAmount) > netDue
                        }
                        onClick={handleRequest}
                        className="mt-4 w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {requesting
                          ? t('sending')
                          : t('sendPaymentRequest')}
                      </button>
                    </>
                  )}
                </div>

                <h2 className="mb-3 mt-8 font-semibold text-gray-800">
                  {t('confirmPendingPayments')}
                </h2>
                {pendingPayments.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {t('noPendingConfirmation')}
                  </p>
                ) : (
                  pendingPayments.map((p) => (
                    <div
                      key={p._id}
                      className="mb-4 rounded-2xl border border-yellow-200 bg-white p-5"
                    >
                      <p className="text-xl font-bold text-gray-900">
                        {t('amount')}: {fmtMoney(p.amount)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t('netAmount')}: {fmtMoney(p.netAmount)}
                      </p>
                      <span
                        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          payoutMethodOf(p) === 'upi'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {payoutMethodOf(p) === 'upi'
                          ? t('upi')
                          : t('cash')}
                      </span>
                      {payoutMethodOf(p) === 'upi' && p.utrNumber && (
                        <p className="mt-2 text-sm text-gray-600">
                          {t('utrNumber')}: {p.utrNumber}
                        </p>
                      )}
                      {payoutMethodOf(p) === 'cash' && (
                        <p className="mt-2 text-sm text-gray-600">
                          {t('cashPayment')}
                          {p.witnessName
                            ? ` · ${t('witness')}: ${p.witnessName}`
                            : ''}
                        </p>
                      )}
                      {p.note ? (
                        <p className="text-sm text-gray-500">
                          {t('notes')}: {p.note}
                        </p>
                      ) : null}
                      {(p.paymentPhoto || p.proofPhoto) && (
                        <div style={{ marginTop: '8px' }}>
                          <p
                            style={{
                              fontSize: '12px',
                              color: '#6B7280',
                              marginBottom: '4px',
                            }}
                          >
                            {t('ownerProof')}:
                          </p>
                          <a
                            href={p.paymentPhoto || p.proofPhoto}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={p.paymentPhoto || p.proofPhoto}
                              alt="proof"
                              onError={(e) => {
                                e.target.style.display = 'none'
                              }}
                              style={{
                                width: '100px',
                                height: '100px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                cursor: 'pointer',
                              }}
                            />
                          </a>
                        </div>
                      )}
                      {Number(p.advanceDeduction) > 0 && (
                        <p className="text-sm text-amber-600">
                          {t('advanceDeduction')}:{' '}
                          {fmtMoney(p.advanceDeduction)}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-gray-400">
                        {fmtDate(p.ownerPaidAt || p.createdAt)}
                      </p>
                      {rejectingId === p._id ? (
                        <div className="mt-4 space-y-2">
                          <textarea
                            value={rejectReason}
                            onChange={(e) =>
                              setRejectReason(e.target.value)
                            }
                            placeholder={t('rejectReasonPlaceholder')}
                            rows={3}
                            maxLength={500}
                            className="w-full rounded-xl border border-gray-200 p-3 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => onRejectSubmit(p._id)}
                            className="w-full rounded-xl border border-red-400 py-2 text-sm font-medium text-red-500"
                          >
                            {t('rejectBtn')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null)
                              setRejectReason('')
                            }}
                            className="w-full text-sm text-gray-500"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 flex flex-col gap-2">
                          <button
                            type="button"
                            disabled={confirmingId === p._id}
                            onClick={() => onConfirm(p._id)}
                            className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            {confirmingId === p._id
                              ? '…'
                              : <><span aria-hidden="true">✅</span> {t('confirm')} — {t('moneyReceived')}</>}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingId(p._id)}
                            className="w-full rounded-xl border border-red-400 py-3 text-sm font-medium text-red-500"
                          >
                            <span aria-hidden="true">❌</span> {t('rejectBtn')} — {t('moneyNotReceived')}
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            )
          ) : tab === 'trip' ? (
            isTransport ? (
            <div>
              <p className="mb-3 text-sm text-gray-600">
                {t('ownerApprovedTrips')}
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '12px',
                  marginBottom: '20px',
                }}
              >
                <div
                  style={{
                    background: '#F0FDF4',
                    borderRadius: '14px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#16A34A',
                    }}
                  >
                    ₹{tripTotal}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#6B7280',
                      marginTop: '4px',
                    }}
                  >
                    {t('totalApproved')}
                  </div>
                </div>

                <div
                  style={{
                    background: '#EFF6FF',
                    borderRadius: '14px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#1D4ED8',
                    }}
                  >
                    ₹{tripPaid}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#6B7280',
                      marginTop: '4px',
                    }}
                  >
                    {t('totalReceived')}
                  </div>
                </div>

                <div
                  style={{
                    background:
                      tripNetDue > 0 ? '#FEF2F2' : '#F0FDF4',
                    borderRadius: '14px',
                    padding: '16px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color:
                        tripNetDue > 0 ? '#EF4444' : '#16A34A',
                    }}
                  >
                    ₹{Math.max(0, tripNetDue)}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#6B7280',
                      marginTop: '4px',
                    }}
                  >
                    {t('amountLeft')}
                  </div>
                </div>
              </div>

              {tripLoading ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px',
                    color: '#9CA3AF',
                  }}
                  role="status"
                  aria-label={t('loading')}
                >
                  {t('loading')}
                </div>
              ) : tripEarnings.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px',
                    color: '#9CA3AF',
                  }}
                >
                  <div
                    style={{ fontSize: '32px', marginBottom: '8px' }}
                    aria-hidden="true"
                  >
                    🚛
                  </div>
                  {t('noApprovedTrips')}
                </div>
              ) : (
                tripEarnings.map((trip, i) => {
                  const paidForTrip = getTripPaidAmount(trip._id)
                  const approvedForTrip = tripApprovedAmount(trip)
                  const baakiForTrip = Math.max(
                    0,
                    approvedForTrip - paidForTrip
                  )
                  return (
                    <div
                      key={trip._id || i}
                      style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '16px',
                        marginBottom: '12px',
                        border: '1px solid #E5E7EB',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: '600',
                              fontSize: '15px',
                              color: '#111827',
                            }}
                          >
                            {tripFrom(trip) || '—'} →{' '}
                            {tripTo(trip) || '—'}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#9CA3AF',
                              marginTop: '4px',
                            }}
                          >
                            {new Date(
                              trip.tripDate || trip.createdAt
                            ).toLocaleDateString('en-IN')}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#6B7280',
                              marginTop: '2px',
                            }}
                          >
                            {t('cargo')}: {tripCargo(trip) || '—'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div
                            style={{
                              fontWeight: '700',
                              fontSize: '18px',
                              color: '#16A34A',
                            }}
                          >
                            ₹{approvedForTrip}
                          </div>
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#9CA3AF',
                            }}
                          >
                            {t('approved')}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: '8px',
                          fontSize: '13px',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        <span style={{ color: '#6B7280' }}>
                          {t('approved')}: ₹{approvedForTrip}
                        </span>
                        <span style={{ color: '#1D4ED8' }}>
                          {t('totalReceived')}: ₹{paidForTrip}
                        </span>
                        <span
                          style={{
                            color:
                              baakiForTrip > 0
                                ? '#EF4444'
                                : '#16A34A',
                            fontWeight: '600',
                          }}
                        >
                          {t('remaining')}: ₹{baakiForTrip}
                        </span>
                      </div>

                      <div
                        style={{
                          marginTop: '12px',
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        {baakiForTrip > 0 &&
                        !trip.paymentRequested ? (
                          <button
                            type="button"
                            onClick={() =>
                              handleTripPaymentRequest(trip)
                            }
                            disabled={
                              tripRequestingId === trip._id
                            }
                            style={{
                              padding: '8px 16px',
                              background: '#16A34A',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '13px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              opacity:
                                tripRequestingId === trip._id
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            {tripRequestingId === trip._id
                              ? '…'
                              : <><span aria-hidden="true">💰</span> {t('sendPaymentRequestBtn')}</>}
                          </button>
                        ) : baakiForTrip <= 0 ? (
                          <span
                            style={{
                              padding: '8px 16px',
                              color: '#16A34A',
                              fontSize: '13px',
                              fontWeight: '600',
                            }}
                          >
                            <span aria-hidden="true">✅</span> {t('allReceived')}
                          </span>
                        ) : (
                          <span
                            style={{
                              padding: '8px 16px',
                              background: '#F3F4F6',
                              color: '#9CA3AF',
                              borderRadius: '8px',
                              fontSize: '13px',
                            }}
                          >
                            <span aria-hidden="true">✅</span> {t('requestSent')}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleTripReceipt(trip)}
                          style={{
                            padding: '8px 16px',
                            background: '#F3F4F6',
                            color: '#374151',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          <span aria-hidden="true">📄</span> {t('tripReceipt')}
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            ) : null
          ) : tab === 'history' ? (
            payments.length === 0 ? (
              <p className="text-gray-500">{t('noPayments')}</p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    { id: 'sab', label: t('filterAll') },
                    { id: 'salary', label: t('salary') },
                    { id: 'trip', label: t('trip') },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setHistoryFilter(id)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium ${
                        historyFilter === id
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {filteredHistory.length === 0 ? (
                  <p className="text-gray-500">{t('noFilterData')}</p>
                ) : (
              <ul className="space-y-3">
                {filteredHistory.map((p) => (
                  <li
                    key={p._id}
                    className="rounded-2xl border border-gray-100 bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-gray-900">
                          {fmtMoney(p.amount)}
                          <span className="ml-2 text-sm font-normal text-gray-600">
                            (net {fmtMoney(p.netAmount)})
                          </span>
                        </p>
                        <span className="mt-1 mr-2 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                          {isTripPaymentRow(p)
                            ? <><span aria-hidden="true">🚛</span> {t('trip')}</>
                            : <><span aria-hidden="true">💰</span> {t('salary')}</>}
                        </span>
                        <span
                          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                            p.status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : p.status === 'rejected'
                                ? 'bg-red-100 text-red-500'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {p.status === 'paid'
                            ? <><span aria-hidden="true">✅</span> {t('approved')}</>
                            : p.status === 'rejected'
                              ? <><span aria-hidden="true">❌</span> {t('rejected')}</>
                              : <><span aria-hidden="true">⏳</span> {t('pending')}</>}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {fmtDate(p.createdAt)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      {payoutMethodOf(p) === 'upi' ? t('upi') : t('cash')}
                      {p.utrNumber
                        ? ` · ${t('utrNumber')}: ${p.utrNumber}`
                        : ''}
                    </p>
                    {Number(p.advanceDeduction) > 0 && (
                      <p className="text-xs text-amber-600">
                        {t('advanceDeduction')}:{' '}
                        {fmtMoney(p.advanceDeduction)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {isTripPaymentRow(p)
                        ? t('tripPaymentLabel')
                        : `${t('month')} ${p.month}/${p.year}`}
                    </p>
                    {p.status === 'rejected' &&
                      p.driverRejectionReason && (
                        <p className="mt-2 text-xs text-red-600">
                          {t('reason')}: {p.driverRejectionReason}
                        </p>
                      )}
                    {(p.paymentPhoto || p.proofPhoto) && (
                      <div style={{ marginTop: '8px' }}>
                        <p
                          style={{
                            fontSize: '12px',
                            color: '#6B7280',
                            marginBottom: '4px',
                          }}
                        >
                          {t('paymentProof') || 'Payment Proof'}:
                        </p>
                        <a
                          href={p.paymentPhoto || p.proofPhoto}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={p.paymentPhoto || p.proofPhoto}
                            alt="payment proof"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                            style={{
                              width: '80px',
                              height: '80px',
                              objectFit: 'cover',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              border: '1px solid #E5E7EB',
                            }}
                          />
                        </a>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handlePrintReceipt(p)}
                      className="no-print"
                      style={{
                        marginTop: '8px',
                        padding: '6px 12px',
                        background: '#F3F4F6',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        color: '#374151',
                      }}
                    >
                      <span aria-hidden="true">📄</span> {t('downloadPDF')}
                    </button>
                  </li>
                ))}
              </ul>
                )}
              </>
            )
          ) : tab === 'advance' ? (
            <>
              {s && s.totalAdvance > 0 && (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="font-semibold text-amber-900">
                    {t('advanceBalance')}
                  </h3>
                  <p className="text-sm text-amber-800">
                    {t('totalEarned')}: {fmtMoney(s.totalAdvance)}
                  </p>
                  <p className="text-sm text-amber-800">
                    {t('repaid')}: {fmtMoney(s.totalAdvanceRepaid)}
                  </p>
                  <p className="text-lg font-bold text-red-600">
                    {t('remaining')}:{' '}
                    {fmtMoney(s.totalAdvanceRemaining)}
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-200">
                    <div
                      className="h-full bg-amber-600 transition-all"
                      style={{ width: `${repayPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-amber-700">
                    {t('repayment')}: {repayPct}%
                  </p>
                </div>
              )}
              {advances.length === 0 ? (
                <p className="text-gray-500">{t('noAdvance')}</p>
              ) : (
                advances.map((a) => (
                  <div
                    key={a._id}
                    className="mb-4 rounded-2xl border border-gray-100 bg-white p-4"
                  >
                    <p className="text-sm text-gray-600">
                      {t('requested')}: {fmtMoney(a.requestedAmount)}
                    </p>
                    <p className="text-sm text-gray-600">
                      {t('approved')}: {fmtMoney(a.approvedAmount)}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">
                      {a.status === 'pending'
                        ? t('pending')
                        : a.status === 'approved'
                          ? t('approved')
                          : a.status === 'rejected'
                            ? t('rejected')
                            : a.status}
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      {a.paymentType} · {t('remaining')}:{' '}
                      {fmtMoney(a.remaining)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {fmtDate(a.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </>
          ) : (
            <div>
              {pendingAdvanceRequest && (
                <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                  {t('pendingRequestMsg')}
                </div>
              )}
              <form
                onSubmit={onRequestAdvance}
                className="rounded-2xl border border-gray-100 bg-white p-6"
              >
                <h2 className="text-lg font-semibold text-gray-800">
                  {t('requestAdvance')}
                </h2>
                <label className="mt-4 block text-sm font-medium text-gray-700">
                  {t('howMuchAdvance')}
                </label>
                <div className="mt-1 flex items-center rounded-xl border border-gray-200 px-3">
                  <span className="text-gray-500">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={reqAmount}
                    onChange={(e) => setReqAmount(e.target.value)}
                    className="w-full border-0 py-2 pl-1 text-sm focus:ring-0"
                    required
                  />
                </div>
                <label className="mt-4 block text-sm font-medium text-gray-700">
                  {t('whyAdvance')}
                </label>
                <textarea
                  rows={3}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder={t('advancePlaceholder')}
                  maxLength={500}
                  className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm"
                />
                <button
                  type="submit"
                  disabled={
                    submittingReq || pendingAdvanceRequest
                  }
                  className="mt-6 w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submittingReq
                    ? t('sending')
                    : t('sendAdvanceRequest')}
                </button>
              </form>
            </div>
          )}
        </div>

      <div className="print-area" style={{ display: 'none' }}>
        {printPayment && (
          <div>
            <div className="print-heading">
              {t('paymentReceipt').toUpperCase()}
            </div>

            <div className="print-row">
              <span>{t('receiptDate')}:</span>
              <span>
                {new Date().toLocaleDateString('en-IN')}
              </span>
            </div>

            <div className="print-row">
              <span>{t('paymentDate')}:</span>
              <span>
                {printPayment.ownerPaidAt || printPayment.createdAt
                  ? new Date(
                      printPayment.ownerPaidAt || printPayment.createdAt
                    ).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '—'}
              </span>
            </div>

            <div className="print-row">
              <span>{t('amountPaid')}:</span>
              <span style={{ fontWeight: 'bold' }}>
                ₹{printPayment.amount}
              </span>
            </div>

            {Number(printPayment.advanceDeduction) > 0 && (
              <div className="print-row">
                <span>{t('advanceDeduction')}:</span>
                <span>-₹{printPayment.advanceDeduction}</span>
              </div>
            )}

            <div className="print-row">
              <span>
                <strong>{t('netAmount')}:</strong>
              </span>
              <span>
                <strong>₹{printPayment.netAmount}</strong>
              </span>
            </div>

            <div className="print-row">
              <span>{t('category')}:</span>
              <span>
                {isTripPaymentRow(printPayment)
                  ? t('trip')
                  : t('salary')}
              </span>
            </div>

            <div className="print-row">
              <span>{t('payout')}:</span>
              <span>
                {payoutMethodOf(printPayment) === 'upi'
                  ? `${t('upi')}/${t('bankAccount')}`
                  : t('cash')}
              </span>
            </div>

            {printPayment.utrNumber && (
              <div className="print-row">
                <span>{t('utrNumber')}:</span>
                <span>{printPayment.utrNumber}</span>
              </div>
            )}

            {printPayment.witnessName && (
              <div className="print-row">
                <span>{t('witness')}:</span>
                <span>{printPayment.witnessName}</span>
              </div>
            )}

            <div className="print-row">
              <span>{t('month')}:</span>
              <span>
                {printPayment.month}/{printPayment.year}
              </span>
            </div>

            <div className="print-row">
              <span>{t('status')}:</span>
              <span>
                {printPayment.status === 'paid'
                  ? `✓ ${t('confirmDone')}`
                  : printPayment.status}
              </span>
            </div>

            {printPayment.note && (
              <div className="print-row">
                <span>{t('notes')}:</span>
                <span>{printPayment.note}</span>
              </div>
            )}

            <div
              style={{
                marginTop: '40px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div>{t('owner')}:</div>
                <div
                  style={{
                    fontWeight: 'bold',
                    marginTop: '4px',
                  }}
                >
                  {printPayment.ownerId?.name}
                </div>
              </div>
              <div>
                <div>{t('driver')}:</div>
                <div
                  style={{
                    fontWeight: 'bold',
                    marginTop: '4px',
                  }}
                >
                  {printPayment.driverId?.name}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '40px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    marginBottom: '30px',
                  }}
                >
                  {t('ownerSignature')}:
                </div>
                <div
                  style={{
                    borderTop: '1px solid #000',
                    width: '150px',
                    paddingTop: '4px',
                  }}
                >
                  {printPayment.ownerId?.name}
                </div>
              </div>
              <div>
                <div
                  style={{
                    marginBottom: '30px',
                  }}
                >
                  {t('driverSignature')}:
                </div>
                <div
                  style={{
                    borderTop: '1px solid #000',
                    width: '150px',
                    paddingTop: '4px',
                  }}
                >
                  {printPayment.driverId?.name}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: '24px',
                textAlign: 'center',
                fontSize: '11px',
                color: '#666',
                borderTop: '1px solid #eee',
                paddingTop: '8px',
              }}
            >
              {t('generatedBy')} —{' '}
              {new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
        )}
      </div>

      <div className="print-area" style={{ display: 'none' }}>
        {printTrip && (
          <div>
            <div className="print-heading">
              {t('tripReceipt').toUpperCase()}
            </div>

            <div className="print-row">
              <span>{t('route')}:</span>
              <span>
                {tripFrom(printTrip)} → {tripTo(printTrip)}
              </span>
            </div>

            <div className="print-row">
              <span>{t('cargo')}:</span>
              <span>{tripCargo(printTrip) || '—'}</span>
            </div>

            <div className="print-row">
              <span>{t('date')}:</span>
              <span>
                {new Date(
                  printTrip.createdAt || printTrip.tripDate
                ).toLocaleDateString('en-IN')}
              </span>
            </div>

            <br />
            <strong>{t('expense')}:</strong>
            {(printTrip.expenses || []).map((e, i) => (
              <div key={i} className="print-row">
                <span>
                  {expenseLabelTrip(e)}{' '}
                  {e.note ? `— ${e.note}` : ''}
                </span>
                <span>₹{e.amount}</span>
              </div>
            ))}

            <br />
            <strong>{t('repair')}:</strong>
            {(printTrip.repairs || []).map((r, i) => (
              <div key={i} className="print-row">
                <span>{r.description}</span>
                <span>₹{r.amount}</span>
              </div>
            ))}

            <br />
            <div className="print-row">
              <strong>{t('totalExpenses')}:</strong>
              <strong>₹{printTrip.totalExpenses || 0}</strong>
            </div>

            <div className="print-row">
              <strong>{t('totalRepairs')}:</strong>
              <strong>₹{printTrip.totalRepairs || 0}</strong>
            </div>

            <div className="print-row">
              <strong>{t('grandTotal')}:</strong>
              <strong>₹{grandTotalTrip(printTrip)}</strong>
            </div>

            <div className="print-row">
              <strong>
                {t('approved')} {t('amount')}:
              </strong>
              <strong>₹{tripApprovedAmount(printTrip)}</strong>
            </div>

            {printTrip.ownerNote && (
              <div className="print-row">
                <span>{t('ownerNote')}:</span>
                <span>{printTrip.ownerNote}</span>
              </div>
            )}

            <div
              style={{
                marginTop: '40px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div>
                {t('ownerSignature')}:
                <div
                  style={{
                    borderTop: '1px solid #000',
                    width: '150px',
                    marginTop: '30px',
                    paddingTop: '4px',
                  }}
                >
                  {printTrip.ownerId?.name || t('owner')}
                </div>
              </div>
              <div>
                {t('driverSignature')}:
                <div
                  style={{
                    borderTop: '1px solid #000',
                    width: '150px',
                    marginTop: '30px',
                    paddingTop: '4px',
                  }}
                >
                  {printTrip.driverId?.name ||
                    getUser()?.name ||
                    t('driver')}
                </div>
              </div>
            </div>

            <div
              style={{
                textAlign: 'center',
                marginTop: '20px',
                fontSize: '11px',
                color: '#666',
                borderTop: '1px solid #eee',
                paddingTop: '8px',
              }}
            >
              {t('generatedBy')} —{' '}
              {new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DriverPayments
