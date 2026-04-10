import { useState, useEffect, useCallback, useMemo } from 'react'
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
import jsPDF from 'jspdf'

const isAndroid = () =>
  typeof window !== 'undefined' &&
  window.Capacitor !== undefined

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

  const navigate = useNavigate()

  const loadSummary = useCallback(async () => {
    const res = await getPaymentSummary()
    setSummary(res.data?.summary ?? null)
  }, [])

  const loadHistory = useCallback(async () => {
    const res = await getPayments()
    setPayments(res.data?.payments ?? [])
  }, [])

  const loadAdvances = useCallback(async () => {
    const res = await getAdvances()
    setAdvances(res.data?.advances ?? [])
  }, [])

  const loadTripEarnings = useCallback(async () => {
    try {
      setTripLoading(true)
      const [tripsRes, paymentsRes] = await Promise.all([
        getDriverTrips(),
        getPayments(),
      ])

      const trips = tripsRes.data?.trips || []
      const approved = trips.filter((t) => t.status === 'approved')

      const allPayments = paymentsRes.data?.payments || []
      const tripPayments = allPayments.filter(
        (p) =>
          (p.paymentType === 'trip' || p.requestKind === 'trip') &&
          p.driverConfirmed === true
      )

      const totalApproved = approved.reduce(
        (sum, t) => sum + tripApprovedAmount(t),
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
    } catch (err) {
      console.error(err)
      toast.error(
        err.response?.data?.message || 'Trips load nahi hue'
      )
    } finally {
      setTripLoading(false)
    }
  }, [])

  const refreshTab = useCallback(async () => {
    if (tab === 'trip') return
    setLoading(true)
    try {
      if (tab === 'summary') {
        await Promise.all([loadSummary(), loadHistory()])
      } else if (tab === 'history') await loadHistory()
      else if (tab === 'advance' || tab === 'request') {
        await Promise.all([loadSummary(), loadAdvances()])
      }
    } catch (e) {
      if (tab === 'summary') setSummary(null)
      toast.error(
        e.response?.data?.message || 'Load nahi hua'
      )
    } finally {
      setLoading(false)
    }
  }, [tab, loadSummary, loadHistory, loadAdvances])

  useEffect(() => {
    refreshTab()
  }, [refreshTab])

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

  const pendingPayments = payments.filter(
    (p) =>
      p.ownerMarkedPaid &&
      !p.driverConfirmed &&
      p.status === 'pending' &&
      !p.driverRejected
  )

  const pendingAdvanceRequest = advances.some(
    (a) => a.status === 'pending'
  )

  const [reqPayMonth, reqPayYear] = reqPayKey
    .split('-')
    .map((x) => Number(x))

  const upiFromProfile = summary?.driverBankDetails?.upiId?.trim()
  const hasUpi = Boolean(upiFromProfile)

  const handleRequest = async () => {
    const due =
      (summary?.totalSalaryEarned || 0) -
      (summary?.totalPaid || 0)

    if (due <= 0) {
      toast.error('Koi payment baaki nahi hai')
      return
    }

    const amt = Number(requestAmount) || 0
    if (amt <= 0 || amt > due) {
      toast.error(
        amt > due
          ? 'Amount net due se zyada nahi ho sakta'
          : 'Amount likhein'
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
      toast.success('Payment request bhej di!')
      setReqPayNote('')
      await loadSummary()
      await loadHistory()
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Request nahi gayi'
      )
    } finally {
      setRequesting(false)
    }
  }

  const onConfirm = async (paymentId) => {
    setConfirmingId(paymentId)
    try {
      await confirmPaymentApi({ paymentId })
      toast.success('Confirm ho gaya!')
      await loadHistory()
      await loadSummary()
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Confirm nahi hua'
      )
    } finally {
      setConfirmingId(null)
    }
  }

  const onRejectSubmit = async (paymentId) => {
    try {
      await rejectPaymentApi({
        paymentId,
        reason: rejectReason,
      })
      toast.success('Reject kar diya')
      setRejectingId(null)
      setRejectReason('')
      await loadHistory()
      await loadSummary()
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Reject nahi hua'
      )
    }
  }

  const handlePrintReceipt = (payment) => {
    if (isAndroid()) {
      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text('Payment Receipt', 14, 20)
      doc.setFontSize(11)
      doc.text(
        `Amount: Rs.${payment.amount}`,
        14, 35
      )
      doc.text(
        `Type: ${payment.payoutMethod?.toUpperCase() || 'UPI'}`,
        14, 44
      )
      if (payment.utrNumber) {
        doc.text(
          `UTR: ${payment.utrNumber}`,
          14, 53
        )
      }
      doc.text(
        `Date: ${new Date(payment.createdAt || payment.ownerPaidAt).toLocaleDateString('en-IN')}`,
        14, 62
      )
      doc.text(
        `Driver: ${payment.driverId?.name || ''}`,
        14, 71
      )
      doc.text(
        `Owner: ${payment.ownerId?.name || ''}`,
        14, 80
      )
      doc.save(`receipt-${payment._id}.pdf`)
    } else {
      setPrintPayment(payment)
      setTimeout(() => {
        window.print()
      }, 300)
    }
  }

  const onRequestAdvance = async (e) => {
    e.preventDefault()
    const amt = Number(reqAmount)
    if (!amt || amt <= 0) {
      toast.error('Amount likhein')
      return
    }
    setSubmittingReq(true)
    try {
      await requestAdvanceApi({
        requestedAmount: amt,
        reason: reqReason,
      })
      toast.success(
        'Request bhej di! Owner ka wait karein.'
      )
      setReqAmount('')
      setReqReason('')
      await loadAdvances()
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Request nahi gayi'
      )
    } finally {
      setSubmittingReq(false)
    }
  }

  const s = summary
  const netDue =
    (summary?.totalSalaryEarned || 0) -
    (summary?.totalPaid || 0)

  const driverTabs = useMemo(
    () => [
      { id: 'summary', label: 'Summary' },
      ...(isTransport
        ? [{ id: 'trip', label: 'Trip Earnings' }]
        : []),
      { id: 'history', label: 'History' },
      { id: 'advance', label: 'Advance' },
      { id: 'request', label: 'Request Advance' },
    ],
    [isTransport]
  )

  const filteredHistory =
    historyFilter === 'salary'
      ? payments.filter((p) => !isTripPaymentRow(p))
      : historyFilter === 'trip'
        ? payments.filter((p) => isTripPaymentRow(p))
        : payments

  const getTripPaidAmount = (tripId) =>
    tripPaymentsList
      .filter(
        (p) =>
          String(p.tripId?._id ?? p.tripId) === String(tripId)
      )
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  const handleTripPaymentRequest = async (trip) => {
    const approvedAmt = tripApprovedAmount(trip)
    const paidSoFar = getTripPaidAmount(trip._id)
    const baaki = Math.max(0, approvedAmt - paidSoFar)
    if (!baaki) {
      toast.error('Abhi koi baaki amount nahi')
      return
    }
    setTripRequestingId(trip._id)
    try {
      await requestTripPayment({
        tripId: trip._id,
        amount: baaki,
      })
      toast.success('Trip payment request bhej di!')
      await loadTripEarnings()
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Request nahi gayi'
      )
    } finally {
      setTripRequestingId(null)
    }
  }

  const handleTripReceipt = (trip) => {
    setPrintTrip(trip)
    setTimeout(() => {
      window.print()
    }, 300)
  }

  const repayPct =
    s && s.totalAdvance > 0
      ? Math.min(
          100,
          Math.round(
            (s.totalAdvanceRepaid / s.totalAdvance) * 100
          )
        )
      : 0

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
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            </div>
          ) : tab === 'summary' ? (
            !s ? (
              <p className="text-center text-gray-600">
                Koi active kaam nahi — pehle contract sign karein
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
                    🚛 Transport Driver — Fixed Monthly Salary: ₹{summary?.contract?.salaryPerMonth || 0}/month
                  </div>
                )}

                <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                    <p className="text-xs text-green-800">
                      Total Earned
                    </p>
                    <p className="text-xl font-bold text-green-900">
                      {fmtMoney(s.totalSalaryEarned)}
                    </p>
                    <p className="mt-1 text-[10px] text-green-700">
                      Attendance se total
                    </p>
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                    <p className="text-xs text-blue-800">
                      Total Paid
                    </p>
                    <p className="text-xl font-bold text-blue-900">
                      {fmtMoney(s.totalPaid)}
                    </p>
                    <p className="mt-1 text-[10px] text-blue-700">
                      Confirmed payments
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs text-gray-800">Net Due</p>
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
                      Baaki lena hai
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-6">
                  <h2 className="text-lg font-semibold text-green-900">
                    Salary Payment Request Karo
                  </h2>
                  {netDue <= 0 ? (
                    <p className="mt-3 text-sm text-green-800">
                      Abhi koi payment baaki nahi
                    </p>
                  ) : (
                    <>
                      <div className="mt-3 text-sm text-green-900">
                        Baaki lena hai:{' '}
                        <strong>
                          ₹{Math.max(0, netDue)}
                        </strong>
                      </div>

                      <label className="mt-4 block text-sm font-medium text-gray-800">
                        Kitna payment mangna hai? (max ₹
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
                            ⚠️ Pehle apna UPI ID set karein!
                          </p>
                          <button
                            type="button"
                            onClick={() => navigate('/driver/profile')}
                            className="mt-3 rounded-xl bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
                          >
                            Profile Update Karo
                          </button>
                        </div>
                      )}

                      <div className="mt-4 text-sm text-gray-700">
                        <span className="text-gray-500">Aapka UPI ID:</span>{' '}
                        {hasUpi ? (
                          <span className="font-medium text-gray-900">
                            {upiFromProfile}
                          </span>
                        ) : (
                          <span className="text-amber-700">
                            UPI ID set nahi hai
                          </span>
                        )}
                      </div>

                      <label className="mt-4 block text-sm font-medium text-gray-800">
                        Kaunsa mahina?
                      </label>
                      <select
                        value={reqPayKey}
                        onChange={(e) => setReqPayKey(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-green-200 bg-white px-3 py-2 text-sm"
                      >
                        {lastFourMonthYearOptions().map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))}
                      </select>

                      <label className="mt-4 block text-sm font-medium text-gray-800">
                        Owner ko note (optional)
                      </label>
                      <textarea
                        rows={2}
                        value={reqPayNote}
                        onChange={(e) => setReqPayNote(e.target.value)}
                        placeholder="Owner ko kuch batana ho..."
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
                          ? 'Bhej rahe hain...'
                          : 'Payment Request Bhejo'}
                      </button>
                    </>
                  )}
                </div>

                <h2 className="mb-3 mt-8 font-semibold text-gray-800">
                  Confirm Karne Wali Payments
                </h2>
                {pendingPayments.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Koi pending confirmation nahi
                  </p>
                ) : (
                  pendingPayments.map((p) => (
                    <div
                      key={p._id}
                      className="mb-4 rounded-2xl border border-yellow-200 bg-white p-5"
                    >
                      <p className="text-xl font-bold text-gray-900">
                        Amount: {fmtMoney(p.amount)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Net Amount: {fmtMoney(p.netAmount)}
                      </p>
                      <span
                        className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          payoutMethodOf(p) === 'upi'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {payoutMethodOf(p) === 'upi'
                          ? 'UPI'
                          : 'Cash'}
                      </span>
                      {payoutMethodOf(p) === 'upi' && p.utrNumber && (
                        <p className="mt-2 text-sm text-gray-600">
                          UTR: {p.utrNumber}
                        </p>
                      )}
                      {payoutMethodOf(p) === 'cash' && (
                        <p className="mt-2 text-sm text-gray-600">
                          Cash payment
                          {p.witnessName
                            ? ` · Witness: ${p.witnessName}`
                            : ''}
                        </p>
                      )}
                      {p.note ? (
                        <p className="text-sm text-gray-500">
                          Note: {p.note}
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
                            Owner ka proof:
                          </p>
                          <a
                            href={p.paymentPhoto || p.proofPhoto}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={p.paymentPhoto || p.proofPhoto}
                              alt="proof"
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
                          Advance kata:{' '}
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
                            placeholder="Kya problem hai? Batayein..."
                            rows={3}
                            className="w-full rounded-xl border border-gray-200 p-3 text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => onRejectSubmit(p._id)}
                            className="w-full rounded-xl border border-red-400 py-2 text-sm font-medium text-red-500"
                          >
                            Reject Karo
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(null)
                              setRejectReason('')
                            }}
                            className="w-full text-sm text-gray-500"
                          >
                            Cancel
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
                              : '✅ Confirm — Paisa Mila'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingId(p._id)}
                            className="w-full rounded-xl border border-red-400 py-3 text-sm font-medium text-red-500"
                          >
                            ❌ Reject — Nahi Mila
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
                Sirf owner-approved trips — alag salary se
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
                    Total Approved
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
                    Total Mila
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
                    Baaki Milna Hai
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
                >
                  Loading...
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
                  >
                    🚛
                  </div>
                  Koi approved trip nahi
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
                            Cargo: {tripCargo(trip) || '—'}
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
                            Approved
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
                          Approved: ₹{approvedForTrip}
                        </span>
                        <span style={{ color: '#1D4ED8' }}>
                          Mila: ₹{paidForTrip}
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
                          Baaki: ₹{baakiForTrip}
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
                              : '💰 Payment Request Bhejo'}
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
                            ✅ Poora Mil Gaya
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
                            ✅ Request Bhej Di
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
                          📄 Receipt
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
              <p className="text-gray-500">Koi history nahi</p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    { id: 'sab', label: 'Sab' },
                    { id: 'salary', label: 'Salary' },
                    { id: 'trip', label: 'Trip' },
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
                  <p className="text-gray-500">Is filter mein kuch nahi</p>
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
                            ? '🚛 Trip'
                            : '💰 Salary'}
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
                            ? '✅ Confirmed'
                            : p.status === 'rejected'
                              ? '❌ Driver ne reject kiya'
                              : '⏳ Driver confirm karega'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {fmtDate(p.createdAt)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      {payoutMethodOf(p) === 'upi' ? 'UPI' : 'Cash'}
                      {p.utrNumber
                        ? ` · UTR: ${p.utrNumber}`
                        : ''}
                    </p>
                    {Number(p.advanceDeduction) > 0 && (
                      <p className="text-xs text-amber-600">
                        Advance deduction:{' '}
                        {fmtMoney(p.advanceDeduction)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      {isTripPaymentRow(p)
                        ? 'Trip payment'
                        : `Month ${p.month}/${p.year}`}
                    </p>
                    {p.status === 'rejected' &&
                      p.driverRejectionReason && (
                        <p className="mt-2 text-xs text-red-600">
                          Reason: {p.driverRejectionReason}
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
                          Payment Proof:
                        </p>
                        <a
                          href={p.paymentPhoto || p.proofPhoto}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <img
                            src={p.paymentPhoto || p.proofPhoto}
                            alt="payment proof"
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
                      📄 Receipt Download
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
                    Advance Balance
                  </h3>
                  <p className="text-sm text-amber-800">
                    Total: {fmtMoney(s.totalAdvance)}
                  </p>
                  <p className="text-sm text-amber-800">
                    Repaid: {fmtMoney(s.totalAdvanceRepaid)}
                  </p>
                  <p className="text-lg font-bold text-red-600">
                    Remaining:{' '}
                    {fmtMoney(s.totalAdvanceRemaining)}
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-amber-200">
                    <div
                      className="h-full bg-amber-600 transition-all"
                      style={{ width: `${repayPct}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-amber-700">
                    Repayment: {repayPct}%
                  </p>
                </div>
              )}
              {advances.length === 0 ? (
                <p className="text-gray-500">Koi advance record nahi</p>
              ) : (
                advances.map((a) => (
                  <div
                    key={a._id}
                    className="mb-4 rounded-2xl border border-gray-100 bg-white p-4"
                  >
                    <p className="text-sm text-gray-600">
                      Requested: {fmtMoney(a.requestedAmount)}
                    </p>
                    <p className="text-sm text-gray-600">
                      Approved: {fmtMoney(a.approvedAmount)}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize">
                      {a.status}
                    </span>
                    <p className="mt-1 text-xs text-gray-500">
                      {a.paymentType} · Remaining:{' '}
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
                  Ek request pending hai — owner ka wait karein
                </div>
              )}
              <form
                onSubmit={onRequestAdvance}
                className="rounded-2xl border border-gray-100 bg-white p-6"
              >
                <h2 className="text-lg font-semibold text-gray-800">
                  Advance Request
                </h2>
                <label className="mt-4 block text-sm font-medium text-gray-700">
                  Kitna advance chahiye?
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
                  Kyun chahiye? (optional)
                </label>
                <textarea
                  rows={3}
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="Ghar mein zarurat hai, medical emergency, etc."
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
                    ? 'Bhej rahe hain...'
                    : 'Advance Request Bhejo'}
                </button>
              </form>
            </div>
          )}
        </div>

      <div className="print-area" style={{ display: 'none' }}>
        {printPayment && (
          <div>
            <div className="print-heading">PAYMENT RECEIPT</div>

            <div className="print-row">
              <span>Receipt Date:</span>
              <span>
                {new Date().toLocaleDateString('en-IN')}
              </span>
            </div>

            <div className="print-row">
              <span>Payment Date:</span>
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
              <span>Amount Paid:</span>
              <span style={{ fontWeight: 'bold' }}>
                ₹{printPayment.amount}
              </span>
            </div>

            {Number(printPayment.advanceDeduction) > 0 && (
              <div className="print-row">
                <span>Advance Deduction:</span>
                <span>-₹{printPayment.advanceDeduction}</span>
              </div>
            )}

            <div className="print-row">
              <span>
                <strong>Net Amount:</strong>
              </span>
              <span>
                <strong>₹{printPayment.netAmount}</strong>
              </span>
            </div>

            <div className="print-row">
              <span>Category:</span>
              <span>
                {isTripPaymentRow(printPayment)
                  ? 'Trip'
                  : 'Salary'}
              </span>
            </div>

            <div className="print-row">
              <span>Payout:</span>
              <span>
                {payoutMethodOf(printPayment) === 'upi'
                  ? 'UPI/Bank Transfer'
                  : 'Cash'}
              </span>
            </div>

            {printPayment.utrNumber && (
              <div className="print-row">
                <span>UTR Number:</span>
                <span>{printPayment.utrNumber}</span>
              </div>
            )}

            {printPayment.witnessName && (
              <div className="print-row">
                <span>Witness:</span>
                <span>{printPayment.witnessName}</span>
              </div>
            )}

            <div className="print-row">
              <span>Month:</span>
              <span>
                {printPayment.month}/{printPayment.year}
              </span>
            </div>

            <div className="print-row">
              <span>Status:</span>
              <span>
                {printPayment.status === 'paid'
                  ? '✓ Confirmed'
                  : printPayment.status}
              </span>
            </div>

            {printPayment.note && (
              <div className="print-row">
                <span>Note:</span>
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
                <div>Owner:</div>
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
                <div>Driver:</div>
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
                  Owner Signature:
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
                  Driver Signature:
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
              Generated by DriverApp —{' '}
              {new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
        )}
      </div>

      <div className="print-area" style={{ display: 'none' }}>
        {printTrip && (
          <div>
            <div className="print-heading">TRIP RECEIPT</div>

            <div className="print-row">
              <span>Route:</span>
              <span>
                {tripFrom(printTrip)} → {tripTo(printTrip)}
              </span>
            </div>

            <div className="print-row">
              <span>Cargo:</span>
              <span>{tripCargo(printTrip) || '—'}</span>
            </div>

            <div className="print-row">
              <span>Date:</span>
              <span>
                {new Date(
                  printTrip.createdAt || printTrip.tripDate
                ).toLocaleDateString('en-IN')}
              </span>
            </div>

            <br />
            <strong>Expenses:</strong>
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
            <strong>Repairs:</strong>
            {(printTrip.repairs || []).map((r, i) => (
              <div key={i} className="print-row">
                <span>{r.description}</span>
                <span>₹{r.amount}</span>
              </div>
            ))}

            <br />
            <div className="print-row">
              <strong>Total Expenses:</strong>
              <strong>₹{printTrip.totalExpenses || 0}</strong>
            </div>

            <div className="print-row">
              <strong>Total Repairs:</strong>
              <strong>₹{printTrip.totalRepairs || 0}</strong>
            </div>

            <div className="print-row">
              <strong>Grand Total:</strong>
              <strong>₹{grandTotalTrip(printTrip)}</strong>
            </div>

            <div className="print-row">
              <strong>Approved Amount:</strong>
              <strong>₹{tripApprovedAmount(printTrip)}</strong>
            </div>

            {printTrip.ownerNote && (
              <div className="print-row">
                <span>Owner Note:</span>
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
                Owner Signature:
                <div
                  style={{
                    borderTop: '1px solid #000',
                    width: '150px',
                    marginTop: '30px',
                    paddingTop: '4px',
                  }}
                >
                  {printTrip.ownerId?.name || 'Owner'}
                </div>
              </div>
              <div>
                Driver Signature:
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
                    'Driver'}
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
              Generated by DriverApp —{' '}
              {new Date().toLocaleDateString('en-IN')}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DriverPayments
