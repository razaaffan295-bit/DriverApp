import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  getPaymentSummary,
  getPayments,
  getAdvances,
  confirmPayment as confirmPaymentApi,
  rejectPayment as rejectPaymentApi,
  requestAdvance as requestAdvanceApi,
  requestPayment as requestPaymentApi,
} from '../../api/paymentAPI'

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'history', label: 'History' },
  { id: 'advance', label: 'Advance' },
  { id: 'request', label: 'Request Advance' },
]

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

const netDueUi = (netDueRaw) => {
  const n = Number(netDueRaw) || 0
  if (n < 0) {
    return {
      amount: fmtMoney(Math.abs(n)),
      label: 'Advance zyada diya gaya',
      colorClass: 'text-red-500',
      subClass: 'text-red-600',
    }
  }
  if (n > 0) {
    return {
      amount: fmtMoney(n),
      label: 'Abhi milna chahiye',
      colorClass: 'text-purple-600',
      subClass: 'text-purple-700',
    }
  }
  return {
    amount: '₹0',
    label: 'Sab barabar hai',
    colorClass: 'text-green-600',
    subClass: 'text-green-700',
  }
}

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'

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
  const [submittingPayReq, setSubmittingPayReq] = useState(false)
  const [printPayment, setPrintPayment] = useState(null)

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

  const refreshTab = useCallback(async () => {
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

  const currentMonthSalary =
    summary?.attendance?.find(
      (row) =>
        Number(row.month) === reqPayMonth &&
        Number(row.year) === reqPayYear
    )?.totalSalaryEarned ?? 0

  const upiFromProfile = summary?.driverBankDetails?.upiId?.trim()
  const hasUpi = Boolean(upiFromProfile)

  const pendingPayForSelection = (
    summary?.pendingRequests || []
  ).find(
    (pr) =>
      Number(pr.month) === reqPayMonth &&
      Number(pr.year) === reqPayYear
  )

  const anyPendingPayRequest = (
    summary?.pendingRequests || []
  ).some((pr) => pr.ownerMarkedPaid === false)

  const onRequestSalaryPayment = async () => {
    setSubmittingPayReq(true)
    try {
      await requestPaymentApi({
        month: reqPayMonth,
        year: reqPayYear,
        note: reqPayNote,
      })
      toast.success(
        'Payment request bhej di! Owner pay karega jaldi.'
      )
      setReqPayNote('')
      await loadSummary()
      await loadHistory()
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Request nahi gayi'
      )
    } finally {
      setSubmittingPayReq(false)
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
    setPrintPayment(payment)
    setTimeout(() => {
      window.print()
    }, 300)
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
  const netDueStyle = s ? netDueUi(s.netDue) : null
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
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-6 pb-6 md:pb-8">
          <div className="mb-6 flex flex-wrap gap-2">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
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

          {loading ? (
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
                <div className="mb-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                    <p className="text-xs text-green-800">
                      Total Salary Earned
                    </p>
                    <p className="text-xl font-bold text-green-900">
                      {fmtMoney(s.totalSalaryEarned)}
                    </p>
                    <p className="mt-1 text-[10px] text-green-700">
                      Attendance se calculate
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
                      Sirf driver confirm ke baad
                    </p>
                  </div>
                  <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-4">
                    <p className="text-xs text-yellow-800">
                      Advance Remaining
                    </p>
                    <p className="text-xl font-bold text-yellow-900">
                      {fmtMoney(s.totalAdvanceRemaining)}
                    </p>
                    <p className="mt-1 text-[10px] text-yellow-700">
                      Wapas karna hai
                    </p>
                  </div>
                  <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4">
                    <p className="text-xs text-purple-800">
                      Net Due
                    </p>
                    <p
                      className={`text-xl font-bold ${netDueStyle.colorClass}`}
                    >
                      {netDueStyle.amount}
                    </p>
                    <p
                      className={`mt-1 text-[10px] ${netDueStyle.subClass}`}
                    >
                      {netDueStyle.label}
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-6">
                  <h2 className="text-lg font-semibold text-green-900">
                    Salary Payment Request Karo
                  </h2>
                  <p className="mt-2 text-sm text-green-800">
                    Is mahine salary bani:{' '}
                    <span className="font-bold">
                      {fmtMoney(currentMonthSalary)}
                    </span>
                  </p>

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

                  {anyPendingPayRequest && pendingPayForSelection && (
                    <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                      <p className="font-semibold text-yellow-900">
                        ⏳ Payment request pending hai
                      </p>
                      <p className="text-sm text-yellow-800">
                        Owner pay karega — wait karein
                      </p>
                      <p className="mt-2 text-sm">
                        Amount: {fmtMoney(pendingPayForSelection.amount)}
                      </p>
                      <p className="text-xs text-yellow-700">
                        Requested on:{' '}
                        {fmtDate(
                          pendingPayForSelection.driverRequestedAt ||
                            pendingPayForSelection.createdAt
                        )}
                      </p>
                    </div>
                  )}

                  {anyPendingPayRequest && !pendingPayForSelection && (
                    <p className="mt-3 text-sm text-amber-800">
                      Koi aur mahine ki request pending hai — neeche
                      month check karein.
                    </p>
                  )}

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
                      submittingPayReq ||
                      !hasUpi ||
                      Number(currentMonthSalary) <= 0 ||
                      Boolean(pendingPayForSelection) ||
                      Boolean(
                        payments.some(
                          (p) =>
                            Number(p.month) === reqPayMonth &&
                            Number(p.year) === reqPayYear &&
                            ['pending', 'paid'].includes(p.status)
                        )
                      )
                    }
                    onClick={onRequestSalaryPayment}
                    className="mt-4 w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {submittingPayReq
                      ? 'Bhej rahe hain...'
                      : 'Payment Request Bhejo'}
                  </button>
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
                          p.paymentType === 'upi'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {p.paymentType === 'upi'
                          ? 'UPI'
                          : 'Cash'}
                      </span>
                      {p.paymentType === 'upi' && p.utrNumber && (
                        <p className="mt-2 text-sm text-gray-600">
                          UTR: {p.utrNumber}
                        </p>
                      )}
                      {p.paymentType === 'cash' && (
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
          ) : tab === 'history' ? (
            payments.length === 0 ? (
              <p className="text-gray-500">Koi history nahi</p>
            ) : (
              <ul className="space-y-3">
                {payments.map((p) => (
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
                      {p.paymentType === 'upi' ? 'UPI' : 'Cash'}
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
                      Month {p.month}/{p.year}
                    </p>
                    {p.status === 'rejected' &&
                      p.driverRejectionReason && (
                        <p className="mt-2 text-xs text-red-600">
                          Reason: {p.driverRejectionReason}
                        </p>
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
              <span>Payment Type:</span>
              <span>
                {printPayment.paymentType === 'upi'
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
    </div>
  )
}

export default DriverPayments
