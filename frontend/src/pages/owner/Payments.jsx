import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  useNavigate,
} from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getOwnerContracts } from '../../api/contractAPI'
import {
  getPaymentSummary,
  makePayment as makePaymentApi,
  getPayments,
  getAdvances,
  handleAdvance as handleAdvanceApi,
} from '../../api/paymentAPI'

 

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'pay', label: 'Payment Karo' },
  { id: 'history', label: 'History' },
  { id: 'advance', label: 'Advance Requests' },
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
      label: 'Abhi dena hai',
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

const OwnerPayments = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState('summary')
  const [contracts, setContracts] = useState([])
  const [selectedContract, setSelectedContract] = useState(null)
  const [contractsReady, setContractsReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState(null)
  const [payments, setPayments] = useState([])
  const [advances, setAdvances] = useState([])

  const [payMonth, setPayMonth] = useState(
    () => new Date().getMonth() + 1
  )
  const [payYear, setPayYear] = useState(
    () => new Date().getFullYear()
  )
  const [amount, setAmount] = useState('')
  const [payType, setPayType] = useState('upi')
  const [utr, setUtr] = useState('')
  const [witness, setWitness] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState('')
  const [deductAdvance, setDeductAdvance] = useState(false)
  const [deductAmt, setDeductAmt] = useState('')
  const [submittingPay, setSubmittingPay] = useState(false)

  const [expandAdvanceId, setExpandAdvanceId] = useState(null)
  const [apprAmt, setApprAmt] = useState('')
  const [apprType, setApprType] = useState('upi')
  const [apprUtr, setApprUtr] = useState('')
  const [apprWitness, setApprWitness] = useState('')
  const [apprNote, setApprNote] = useState('')
  const [apprPhoto, setApprPhoto] = useState('')
  const [handlingAdvance, setHandlingAdvance] = useState(false)
  const [printPayment, setPrintPayment] = useState(null)

  const cid = selectedContract?._id

  const loadContracts = useCallback(async () => {
    const res = await getOwnerContracts()
    const list = (res.data?.contracts || []).filter(
      (c) => c.status === 'active'
    )
    setContracts(list)
    setSelectedContract((prev) => {
      if (prev && list.some((x) => String(x._id) === String(prev._id))) {
        return prev
      }
      return list[0] || null
    })
  }, [])

  const loadSummary = useCallback(async () => {
    if (!cid) {
      setSummary(null)
      return
    }
    const res = await getPaymentSummary({ contractId: cid })
    setSummary(res.data?.summary ?? null)
  }, [cid])

  const loadHistory = useCallback(async () => {
    if (!cid) {
      setPayments([])
      return
    }
    const res = await getPayments({ contractId: cid })
    setPayments(res.data?.payments ?? [])
  }, [cid])

  const loadAdvances = useCallback(async () => {
    if (!cid) {
      setAdvances([])
      return
    }
    const res = await getAdvances({ contractId: cid })
    setAdvances(res.data?.advances ?? [])
  }, [cid])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await loadContracts()
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e.response?.data?.message || 'Load nahi hua'
          )
        }
      } finally {
        if (!cancelled) setContractsReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadContracts])

  useEffect(() => {
    if (!cid) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (tab === 'summary') await loadSummary()
        else if (tab === 'pay') {
          await Promise.all([
            loadSummary(),
            loadAdvances(),
          ])
        } else if (tab === 'history') await loadHistory()
        else if (tab === 'advance') await loadAdvances()
      } catch (e) {
        if (!cancelled) {
          toast.error(
            e.response?.data?.message || 'Load nahi hua'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [cid, tab, loadSummary, loadHistory, loadAdvances])

  const driverName =
    selectedContract?.driverId?.name || 'Driver'

  const monthlySalary =
    summary?.attendance?.reduce((acc, row) => {
      if (
        Number(row.month) === payMonth &&
        Number(row.year) === payYear
      ) {
        return acc + (Number(row.totalSalaryEarned) || 0)
      }
      return acc
    }, 0) ?? 0

  const openAdvance = advances.find(
    (a) =>
      (a.status === 'approved' || a.status === 'partial') &&
      !a.isCleared &&
      (Number(a.remaining) || 0) > 0
  )

  const remainingAdvance = Number(openAdvance?.remaining) || 0

  const netPayDisplay = (() => {
    const a = Number(amount) || 0
    const d =
      deductAdvance && openAdvance
        ? Math.min(
            Number(deductAmt) || 0,
            remainingAdvance,
            a
          )
        : 0
    return Math.max(0, a - d)
  })()

  const readPhoto = (file, setter) => {
    if (!file) {
      setter('')
      return
    }
    const r = new FileReader()
    r.onload = () => setter(String(r.result || ''))
    r.readAsDataURL(file)
  }

  const onMakePayment = async (e) => {
    e.preventDefault()
    if (!cid || !selectedContract) return
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      toast.error('Amount likhein')
      return
    }
    if (payType === 'upi' && !utr.trim()) {
      toast.error('UTR zaroori hai')
      return
    }
    const ded =
      deductAdvance && openAdvance
        ? Math.min(
            Number(deductAmt) || 0,
            remainingAdvance,
            amt
          )
        : 0

    setSubmittingPay(true)
    try {
      await makePaymentApi({
        contractId: cid,
        driverId:
          selectedContract.driverId?._id ||
          selectedContract.driverId,
        amount: amt,
        paymentType: payType,
        utrNumber: payType === 'upi' ? utr.trim() : '',
        paymentPhoto: photo || '',
        witnessName: witness,
        note,
        month: payMonth,
        year: payYear,
        advanceDeduction: ded,
        advanceId:
          ded > 0 && openAdvance ? openAdvance._id : undefined,
      })
      toast.success(
        'Payment mark ho gayi! Driver confirm karega.'
      )
      setAmount('')
      setUtr('')
      setWitness('')
      setNote('')
      setPhoto('')
      setDeductAdvance(false)
      setDeductAmt('')
      await loadSummary()
      await loadHistory()
      await loadAdvances()
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Payment nahi hui'
      )
    } finally {
      setSubmittingPay(false)
    }
  }

  const onRejectAdvance = async (advanceId) => {
    setHandlingAdvance(true)
    try {
      await handleAdvanceApi({
        advanceId,
        action: 'reject',
      })
      toast.success('Advance reject kar di')
      await loadAdvances()
      setExpandAdvanceId(null)
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Nahi hua'
      )
    } finally {
      setHandlingAdvance(false)
    }
  }

  const onApproveAdvance = async (advanceId) => {
    const appr = Number(apprAmt)
    if (!appr || appr <= 0) {
      toast.error('Approved amount likhein')
      return
    }
    if (apprType === 'upi' && !apprUtr.trim()) {
      toast.error('UTR zaroori hai')
      return
    }
    setHandlingAdvance(true)
    try {
      await handleAdvanceApi({
        advanceId,
        action: 'approve',
        approvedAmount: appr,
        paymentType: apprType,
        utrNumber: apprType === 'upi' ? apprUtr.trim() : '',
        paymentPhoto: apprPhoto || '',
        witnessName: apprWitness,
        note: apprNote,
      })
      toast.success('Advance approve ho gayi!')
      setExpandAdvanceId(null)
      setApprAmt('')
      setApprUtr('')
      setApprWitness('')
      setApprNote('')
      setApprPhoto('')
      await loadAdvances()
      await loadSummary()
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Nahi hua'
      )
    } finally {
      setHandlingAdvance(false)
    }
  }

  const pendingAdvances = advances.filter(
    (a) => a.status === 'pending'
  )

  const s = summary

  const pendingPaymentRequests = s?.pendingRequests || []
  const ownerPendingConfirmations = s?.pendingPayments || []
  const netDueStyle = s ? netDueUi(s.netDue) : null

  const payTabBankDetails = useMemo(() => {
    const list = s?.pendingRequests || []
    const match = list.find(
      (p) =>
        Number(p.month) === payMonth &&
        Number(p.year) === payYear
    )
    const fromRequest = (row) =>
      row &&
      (row.driverUpiId ||
        row.driverAccountNumber ||
        row.driverIfsc ||
        row.driverAccountName ||
        row.driverUpiQrCode)

    if (match && fromRequest(match)) {
      return {
        upiId: match.driverUpiId || '',
        accountNumber: match.driverAccountNumber || '',
        ifsc: match.driverIfsc || '',
        accountName: match.driverAccountName || '',
        qr: match.driverUpiQrCode || '',
      }
    }

    const bd = s?.driverBankDetails
    if (
      bd &&
      (bd.upiId ||
        bd.accountNumber ||
        bd.ifscCode ||
        bd.accountName ||
        bd.upiQrCode)
    ) {
      return {
        upiId: bd.upiId || '',
        accountNumber: bd.accountNumber || '',
        ifsc: bd.ifscCode || '',
        accountName: bd.accountName || '',
        qr: bd.upiQrCode || '',
      }
    }

    const any = list[0]
    if (any && fromRequest(any)) {
      return {
        upiId: any.driverUpiId || '',
        accountNumber: any.driverAccountNumber || '',
        ifsc: any.driverIfsc || '',
        accountName: any.driverAccountName || '',
        qr: any.driverUpiQrCode || '',
      }
    }

    return {
      upiId: '',
      accountNumber: '',
      ifsc: '',
      accountName: '',
      qr: '',
    }
  }, [s, payMonth, payYear])

  const copyUpi = async (text) => {
    const t = String(text || '').trim()
    if (!t) {
      toast.error('UPI ID nahi hai')
      return
    }
    try {
      await navigator.clipboard.writeText(t)
      toast.success('UPI ID copy ho gaya!')
    } catch {
      toast.error('Copy nahi hua')
    }
  }

  const handlePrintReceipt = (payment) => {
    setPrintPayment(payment)
    setTimeout(() => {
      window.print()
    }, 300)
  }

  const openPayTabFromRequest = (req) => {
    const amt =
      Number(req?.netAmount) ||
      Number(req?.amount) ||
      0
    if (amt > 0) setAmount(String(amt))
    if (req?.month) setPayMonth(Number(req.month))
    if (req?.year) setPayYear(Number(req.year))
    setTab('pay')
  }

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear()
    const set = new Set([y, y - 1, y - 2, payYear])
    ;(s?.pendingRequests || []).forEach((r) => {
      if (r?.year != null) set.add(Number(r.year))
    })
    return Array.from(set).sort((a, b) => b - a)
  }, [s, payYear])

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {contracts.length > 1 && (
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Contract / Driver
              </label>
              <select
                value={String(cid || '')}
                onChange={(e) => {
                  const c = contracts.find(
                    (x) => String(x._id) === e.target.value
                  )
                  setSelectedContract(c || null)
                }}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                {contracts.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.driverId?.name || 'Driver'} —{' '}
                    {c.jobId?.title || 'Job'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-2">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-xl px-4 py-2 text-sm font-medium ${
                  tab === id
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {!contractsReady ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : !cid ? (
            <p className="text-center text-gray-600">
              Koi active contract nahi
            </p>
          ) : loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : tab === 'summary' ? (
            s ? (
            <>
              {pendingPaymentRequests.length > 0 && (
                <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                  <h2 className="text-base font-semibold text-gray-900">
                    Driver ki Payment Requests
                  </h2>
                  <ul className="mt-4 space-y-4">
                    {pendingPaymentRequests.map((req) => {
                      const m = Number(req.month) || 1
                      const y = Number(req.year) || new Date().getFullYear()
                      const monthLabel = `${MONTH_NAMES[m - 1] || '—'} ${y}`
                      const upi = String(req.driverUpiId || '').trim()
                      return (
                        <li
                          key={req._id}
                          className="rounded-2xl border border-yellow-100 bg-white p-4 shadow-sm"
                        >
                          <p className="font-semibold text-gray-900">
                            {req.driverId?.name || driverName}
                          </p>
                          <p className="mt-1 text-lg font-bold text-gray-800">
                            Amount: {fmtMoney(req.netAmount || req.amount)}
                          </p>
                          <p className="text-sm text-gray-600">
                            Month: {monthLabel}
                          </p>
                          {req.note ? (
                            <p className="mt-2 text-sm text-gray-700">
                              Note: {req.note}
                            </p>
                          ) : null}
                          <div className="mt-3 rounded-lg bg-blue-50 p-3">
                            <p className="text-xs font-medium text-blue-900">
                              Driver UPI / Bank
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <p className="text-sm text-gray-800">
                                <span className="text-gray-600">UPI ID: </span>
                                {upi || '—'}
                              </p>
                              {upi ? (
                                <button
                                  type="button"
                                  onClick={() => copyUpi(upi)}
                                  className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-blue-700 shadow-sm ring-1 ring-blue-200"
                                >
                                  Copy
                                </button>
                              ) : null}
                            </div>
                            {req.driverAccountNumber ? (
                              <p className="mt-1 text-sm text-gray-700">
                                Account: {req.driverAccountNumber}
                              </p>
                            ) : null}
                            {req.driverIfsc ? (
                              <p className="text-sm text-gray-700">
                                IFSC: {req.driverIfsc}
                              </p>
                            ) : null}
                            {req.driverAccountName ? (
                              <p className="text-sm text-gray-700">
                                Name: {req.driverAccountName}
                              </p>
                            ) : null}
                            {req.driverUpiQrCode ? (
                              <div className="mt-3">
                                <p className="text-xs text-gray-600">
                                  QR Code
                                </p>
                                <img
                                  src={req.driverUpiQrCode}
                                  alt="UPI QR"
                                  className="mt-1 max-h-40 rounded-lg border border-blue-100 object-contain"
                                />
                              </div>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            Requested:{' '}
                            {fmtDate(req.driverRequestedAt || req.createdAt)}
                          </p>
                          <button
                            type="button"
                            onClick={() => openPayTabFromRequest(req)}
                            className="mt-4 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                          >
                            Payment Karo
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {ownerPendingConfirmations.length > 0 && (
                <div className="mb-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
                  <p className="font-semibold text-yellow-900">
                    ⏳ Driver ke confirm karne ka wait
                  </p>
                  <ul className="mt-3 space-y-3">
                    {ownerPendingConfirmations.map((pp) => (
                      <li
                        key={pp._id}
                        className="rounded-xl border border-yellow-100 bg-white p-3 text-sm"
                      >
                        <p className="font-bold text-gray-900">
                          {fmtMoney(pp.amount)}
                          {pp.paymentType === 'upi' &&
                          pp.utrNumber ? (
                            <span className="ml-2 font-normal text-gray-600">
                              · UTR: {pp.utrNumber}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs font-medium text-yellow-800">
                          Pending confirmation
                        </p>
                        <p className="text-xs text-gray-500">
                          Month {pp.month}/{pp.year}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                <p className="text-xs text-green-800">
                  Total Salary Due
                </p>
                <p className="text-xl font-bold text-green-900">
                  {fmtMoney(s.totalSalaryEarned)}
                </p>
                <p className="text-[10px] text-green-700">
                  Driver ne earn kiya
                </p>
              </div>
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs text-blue-800">
                  Total Paid
                </p>
                <p className="text-xl font-bold text-blue-900">
                  {fmtMoney(s.totalPaid)}
                </p>
                <p className="text-[10px] text-blue-700">
                  Driver confirm ke baad
                </p>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs text-amber-800">
                  Advance Diya
                </p>
                <p className="text-xl font-bold text-amber-900">
                  {fmtMoney(s.totalAdvance)}
                </p>
                <p className="text-[10px] text-amber-700">
                  Advance total
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
                  className={`text-[10px] ${netDueStyle.subClass}`}
                >
                  {netDueStyle.label}
                </p>
              </div>
            </div>
            </>
            ) : (
              <p className="text-center text-gray-500">
                Summary load nahi hui
              </p>
            )
          ) : tab === 'pay' ? (
            <form
              onSubmit={onMakePayment}
              className="rounded-2xl border border-gray-100 bg-white p-6"
            >
              <h2 className="text-lg font-semibold text-gray-800">
                Payment Karo
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Driver:{' '}
                <span className="font-medium">{driverName}</span>
              </p>

              {(payTabBankDetails.upiId ||
                payTabBankDetails.accountNumber ||
                payTabBankDetails.qr) && (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-gray-900">
                    Driver ki Payment Details:
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-sm text-gray-800">
                      UPI ID:{' '}
                      {(payTabBankDetails.upiId || '').trim() || '—'}
                    </p>
                    {(payTabBankDetails.upiId || '').trim() ? (
                      <button
                        type="button"
                        onClick={() =>
                          copyUpi(payTabBankDetails.upiId)
                        }
                        className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-blue-700 shadow-sm ring-1 ring-blue-200"
                      >
                        Copy
                      </button>
                    ) : null}
                  </div>
                  {payTabBankDetails.accountNumber ? (
                    <p className="mt-2 text-sm text-gray-700">
                      Account Number:{' '}
                      {payTabBankDetails.accountNumber}
                    </p>
                  ) : null}
                  {payTabBankDetails.ifsc ? (
                    <p className="text-sm text-gray-700">
                      IFSC: {payTabBankDetails.ifsc}
                    </p>
                  ) : null}
                  {payTabBankDetails.accountName ? (
                    <p className="text-sm text-gray-700">
                      Account Name: {payTabBankDetails.accountName}
                    </p>
                  ) : null}
                  {payTabBankDetails.qr ? (
                    <div className="mt-3">
                      <p className="text-xs text-gray-600">QR Code</p>
                      <img
                        src={payTabBankDetails.qr}
                        alt="UPI QR"
                        className="mt-1 max-h-40 rounded-lg border border-blue-100 object-contain"
                      />
                    </div>
                  ) : null}
                </div>
              )}

              <label className="mt-4 block text-sm font-medium text-gray-700">
                Month
              </label>
              <select
                value={payMonth}
                onChange={(e) =>
                  setPayMonth(Number(e.target.value))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name} {payYear}
                  </option>
                ))}
              </select>

              <label className="mt-3 block text-sm font-medium text-gray-700">
                Year
              </label>
              <select
                value={payYear}
                onChange={(e) =>
                  setPayYear(Number(e.target.value))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              >
                {yearOptions.map((yy) => (
                  <option key={yy} value={yy}>
                    {yy}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Is mahine salary (attendance):{' '}
                {fmtMoney(monthlySalary)}
              </p>

              <label className="mt-4 block text-sm font-medium text-gray-700">
                Kitna pay kar rahe ho?
              </label>
              <div className="mt-1 flex items-center rounded-xl border border-gray-200 px-3">
                <span className="text-gray-500">₹</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border-0 py-2 pl-1 text-sm focus:ring-0"
                  required
                />
              </div>

              <p className="mt-4 text-sm font-medium text-gray-700">
                Payment Type
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPayType('upi')}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium ${
                    payType === 'upi'
                      ? 'bg-blue-700 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  🏦 UPI/Bank
                </button>
                <button
                  type="button"
                  onClick={() => setPayType('cash')}
                  className={`flex-1 rounded-xl py-2 text-sm font-medium ${
                    payType === 'cash'
                      ? 'bg-blue-700 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  💵 Cash
                </button>
              </div>

              {payType === 'upi' ? (
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-700">
                    UTR Number
                  </label>
                  <input
                    type="text"
                    value={utr}
                    onChange={(e) => setUtr(e.target.value)}
                    placeholder="UTR123456789"
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Bank app mein transaction ID milegi
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-700">
                    Cash ki Photo (optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      readPhoto(
                        e.target.files?.[0],
                        setPhoto
                      )
                    }
                    className="mt-1 w-full text-sm"
                  />
                </div>
              )}

              <label className="mt-4 block text-sm font-medium text-gray-700">
                Witness Name (optional)
              </label>
              <input
                type="text"
                value={witness}
                onChange={(e) => setWitness(e.target.value)}
                placeholder="Koi third person jo present tha"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              />

              <label className="mt-4 block text-sm font-medium text-gray-700">
                Note (optional)
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 p-3 text-sm"
              />

              {openAdvance && remainingAdvance > 0 && (
                <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">
                    Advance Remaining:{' '}
                    {fmtMoney(remainingAdvance)}
                  </p>
                  <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={deductAdvance}
                      onChange={(e) =>
                        setDeductAdvance(e.target.checked)
                      }
                    />
                    Is payment se advance kaatna chahte ho?
                  </label>
                  {deductAdvance && (
                    <>
                      <label className="mt-2 block text-xs text-gray-600">
                        Kitna kaatna hai? (max{' '}
                        {fmtMoney(remainingAdvance)})
                      </label>
                      <div className="mt-1 flex items-center rounded-xl border border-gray-200 bg-white px-3">
                        <span>₹</span>
                        <input
                          type="number"
                          min="0"
                          max={remainingAdvance}
                          value={deductAmt}
                          onChange={(e) =>
                            setDeductAmt(e.target.value)
                          }
                          className="w-full border-0 py-2 pl-1 text-sm focus:ring-0"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <p className="mt-4 text-sm font-semibold text-gray-800">
                Driver ko milega: {fmtMoney(netPayDisplay)}
              </p>

              <button
                type="submit"
                disabled={submittingPay}
                className="mt-6 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {submittingPay
                  ? '…'
                  : 'Payment Mark Karo'}
              </button>
            </form>
          ) : tab === 'history' ? (
            payments.length === 0 ? (
              <p className="text-gray-500">Koi payment nahi</p>
            ) : (
              <ul className="space-y-3">
                {payments.map((p) => (
                  <li
                    key={p._id}
                    className="rounded-2xl border border-gray-100 bg-white p-4"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-bold">
                        {fmtMoney(p.amount)}
                        <span className="ml-2 text-sm font-normal text-gray-600">
                          net {fmtMoney(p.netAmount)}
                        </span>
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
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
                    <p className="mt-1 text-xs text-gray-500">
                      {p.paymentType} ·{' '}
                      {fmtDate(p.createdAt)} · M{p.month}/Y
                      {p.year}
                    </p>
                    {p.utrNumber ? (
                      <p className="text-xs text-gray-600">
                        UTR: {p.utrNumber}
                      </p>
                    ) : null}
                    {Number(p.advanceDeduction) > 0 && (
                      <p className="text-xs text-amber-600">
                        Advance kata:{' '}
                        {fmtMoney(p.advanceDeduction)}
                        {p.status === 'pending'
                          ? ' (confirm par apply)'
                          : ''}
                      </p>
                    )}
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
                      📄 Receipt
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div>
              {pendingAdvances.length === 0 ? (
                <p className="text-gray-500">
                  Koi pending advance request nahi
                </p>
              ) : (
                pendingAdvances.map((a) => (
                  <div
                    key={a._id}
                    className="mb-4 rounded-2xl border border-yellow-200 bg-white p-5"
                  >
                    <p className="font-semibold text-gray-900">
                      {a.driverId?.name || 'Driver'}
                    </p>
                    <p className="text-lg font-bold text-gray-800">
                      {fmtMoney(a.requestedAmount)}
                    </p>
                    {a.reason ? (
                      <p className="text-sm text-gray-600">
                        {a.reason}
                      </p>
                    ) : null}
                    <p className="text-xs text-gray-400">
                      {fmtDate(a.createdAt)}
                    </p>
                    {expandAdvanceId === a._id ? (
                      <div className="mt-4 space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-sm font-medium text-gray-800">
                          Kitna dena chahte ho?
                        </p>
                        <div className="flex items-center rounded-xl border bg-white px-3">
                          <span>₹</span>
                          <input
                            type="number"
                            value={apprAmt}
                            onChange={(e) =>
                              setApprAmt(e.target.value)
                            }
                            placeholder={String(
                              a.requestedAmount
                            )}
                            className="w-full border-0 py-2 pl-1 text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setApprType('upi')}
                            className={`flex-1 rounded-lg py-2 text-xs font-medium ${
                              apprType === 'upi'
                                ? 'bg-blue-700 text-white'
                                : 'bg-white text-gray-600'
                            }`}
                          >
                            UPI
                          </button>
                          <button
                            type="button"
                            onClick={() => setApprType('cash')}
                            className={`flex-1 rounded-lg py-2 text-xs font-medium ${
                              apprType === 'cash'
                                ? 'bg-blue-700 text-white'
                                : 'bg-white text-gray-600'
                            }`}
                          >
                            Cash
                          </button>
                        </div>
                        {apprType === 'upi' ? (
                          <input
                            type="text"
                            value={apprUtr}
                            onChange={(e) =>
                              setApprUtr(e.target.value)
                            }
                            placeholder="UTR"
                            className="w-full rounded-lg border px-3 py-2 text-sm"
                          />
                        ) : (
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              readPhoto(
                                e.target.files?.[0],
                                setApprPhoto
                              )
                            }
                            className="w-full text-xs"
                          />
                        )}
                        <input
                          type="text"
                          value={apprWitness}
                          onChange={(e) =>
                            setApprWitness(e.target.value)
                          }
                          placeholder="Witness (optional)"
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                        />
                        <textarea
                          rows={2}
                          value={apprNote}
                          onChange={(e) =>
                            setApprNote(e.target.value)
                          }
                          placeholder="Note"
                          className="w-full rounded-lg border p-2 text-sm"
                        />
                        <button
                          type="button"
                          disabled={handlingAdvance}
                          onClick={() => onApproveAdvance(a._id)}
                          className="w-full rounded-xl bg-blue-700 py-2 text-sm font-medium text-white disabled:opacity-50"
                        >
                          Approve Karo
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandAdvanceId(null)
                            setApprAmt('')
                          }}
                          className="w-full text-sm text-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandAdvanceId(a._id)
                            setApprAmt(String(a.requestedAmount))
                          }}
                          className="rounded-xl bg-blue-700 px-4 py-2 text-sm text-white"
                        >
                          Approve Karo
                        </button>
                        <button
                          type="button"
                          disabled={handlingAdvance}
                          onClick={() => onRejectAdvance(a._id)}
                          className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-500"
                        >
                          Reject Karo
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
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

export default OwnerPayments
