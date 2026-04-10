import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  useNavigate,
} from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getUser } from '../../utils/helpers'
import { getOwnerContracts } from '../../api/contractAPI'
import { getOwnerTrips } from '../../api/tripAPI'
import API from '../../api/axios'
import {
  getPaymentSummary,
  getPayments,
  getAdvances,
  handleAdvance as handleAdvanceApi,
} from '../../api/paymentAPI'
import jsPDF from 'jspdf'

const isAndroid = () =>
  typeof window !== 'undefined' &&
  window.Capacitor !== undefined

const isTransportContract = (contract) => {
  return (
    contract?.vehicleCategory === 'transport' ||
    contract?.transportType === 'company_trip' ||
    contract?.transportType === 'malik_trip' ||
    contract?.jobId?.vehicleCategory === 'transport'
  )
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

const tripFrom = (t) => t.fromLocation || t.from || ''
const tripTo = (t) => t.toLocation || t.to || ''
const tripCargo = (t) => t.cargo || t.description || ''
const expenseLabelTrip = (ex) => ex.type || ex.category || 'other'
const grandTotalTrip = (t) =>
  (Number(t.totalExpenses) || 0) + (Number(t.totalRepairs) || 0)
const tripApprovedAmount = (t) =>
  Number(t.approvedAmount) || Number(t.approvedExpenses) || 0

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
  const [proofPhoto, setProofPhoto] = useState(null)
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
  const [historyFilter, setHistoryFilter] = useState('sab')
  const [tripPayContext, setTripPayContext] = useState(null)
  const [tripEarnings, setTripEarnings] = useState([])
  const [tripPaymentsList, setTripPaymentsList] = useState([])
  const [tripTotal, setTripTotal] = useState(0)
  const [tripPaid, setTripPaid] = useState(0)
  const [tripNetDue, setTripNetDue] = useState(0)
  const [tripLoading, setTripLoading] = useState(false)
  const [printTrip, setPrintTrip] = useState(null)

  const cid = selectedContract?._id
  const selectedIsTransport = isTransportContract(selectedContract)

  const tabs = useMemo(
    () => [
      { id: 'summary', label: 'Summary' },
      { id: 'payment', label: 'Payment Karo' },
      ...(selectedIsTransport
        ? [{ id: 'trip', label: 'Trip Earnings' }]
        : []),
      { id: 'history', label: 'History' },
      { id: 'advance', label: 'Advance Requests' },
    ],
    [selectedIsTransport]
  )

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

  const loadOwnerTripEarnings = useCallback(async () => {
    try {
      setTripLoading(true)
      const tripsRes = await getOwnerTrips()
      const trips = tripsRes.data?.trips || []
      const approved = trips.filter((t) => t.status === 'approved')

      const loadTripPayments = async () => {
        try {
          const res = await API.get('/api/payments/history')
          const all = res.data?.payments || []
          console.log('All payments:', all)
          const tripPays = all.filter(
            (p) => p.paymentType === 'trip'
          )
          console.log('Trip payments:', tripPays)
          return tripPays
        } catch (err) {
          console.error(err)
          return []
        }
      }

      const tripPaymentsAllTypes = await loadTripPayments()
      const tripPayments = tripPaymentsAllTypes.filter(
        (p) => p.driverConfirmed === true
      )

      const tripPaidForTrip = (tripId, list) =>
        list
          .filter((p) => {
            const pTripId = p.tripId?._id || p.tripId
            return String(pTripId) === String(tripId)
          })
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

      const totalApproved = approved.reduce(
        (sum, t) => sum + tripApprovedAmount(t),
        0
      )
      const totalTripPaid = approved.reduce(
        (sum, trip) => sum + tripPaidForTrip(trip._id, tripPayments),
        0
      )
      const totalBaaki = totalApproved - totalTripPaid

      console.log('tripPayments:', tripPayments)
      console.log('tripEarnings:', approved)

      setTripEarnings(approved)
      setTripPaymentsList(tripPayments)
      setTripTotal(totalApproved)
      setTripPaid(totalTripPaid)
      setTripNetDue(totalBaaki)
    } catch (err) {
      console.error(err)
      toast.error(
        err.response?.data?.message || 'Trips load nahi hue'
      )
    } finally {
      setTripLoading(false)
    }
  }, [])

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
    if (tab === 'trip') return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        if (tab === 'summary') await loadSummary()
        else if (tab === 'payment') {
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

  useEffect(() => {
    if (
      tab !== 'trip' ||
      !contractsReady ||
      !selectedIsTransport
    ) {
      return
    }
    loadOwnerTripEarnings()
  }, [
    tab,
    contractsReady,
    selectedIsTransport,
    loadOwnerTripEarnings,
  ])

  useEffect(() => {
    if (!selectedIsTransport && tab === 'trip') {
      setTab('summary')
    }
  }, [selectedIsTransport, tab])

  useEffect(() => {
    if (tab !== 'payment') setTripPayContext(null)
  }, [tab])

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
      deductAdvance && openAdvance && !tripPayContext
        ? Math.min(
            Number(deductAmt) || 0,
            remainingAdvance,
            amt
          )
        : 0

    const driverIdVal =
      selectedContract.driverId?._id ||
      selectedContract.driverId

    setSubmittingPay(true)
    let didTripPayment = false
    try {
      const fd = new FormData()
      if (tripPayContext) {
        didTripPayment = true
        fd.append('paymentId', String(tripPayContext._id))
      }
      fd.append('contractId', String(cid))
      fd.append('driverId', String(driverIdVal))
      fd.append('amount', String(amt))
      fd.append('paymentType', payType)
      fd.append(
        'utrNumber',
        payType === 'upi' ? utr.trim() : ''
      )
      if (witness.trim()) {
        fd.append('witnessName', witness.trim())
      }
      if (note.trim()) {
        fd.append('note', note.trim())
      }
      if (!tripPayContext) {
        fd.append('month', String(payMonth))
        fd.append('year', String(payYear))
        if (ded > 0) {
          fd.append('advanceDeduction', String(ded))
          if (openAdvance?._id) {
            fd.append('advanceId', String(openAdvance._id))
          }
        }
      }
      if (proofPhoto) {
        fd.append('proofPhoto', proofPhoto)
      }

      await API.post('/api/payments/make', fd, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      if (didTripPayment) {
        toast.success(
          'Trip payment mark ho gayi! Driver confirm karega.'
        )
        setTripPayContext(null)
      } else {
        toast.success(
          'Payment mark ho gayi! Driver confirm karega.'
        )
      }
      setAmount('')
      setUtr('')
      setWitness('')
      setNote('')
      setProofPhoto(null)
      setDeductAdvance(false)
      setDeductAmt('')
      await loadSummary()
      await loadHistory()
      await loadAdvances()
      if (didTripPayment) await loadOwnerTripEarnings()
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
  const salaryPending = pendingPaymentRequests.filter(
    (p) => p.paymentType === 'salary' || !p.paymentType
  )
  const tripPending = pendingPaymentRequests.filter(
    (p) => p.paymentType === 'trip'
  )
  const salaryPendingRequests = pendingPaymentRequests.filter(
    (p) => !isTripPaymentRow(p)
  )
  const tripPendingRequests = pendingPaymentRequests.filter((p) =>
    isTripPaymentRow(p)
  )
  const ownerPendingConfirmations = s?.pendingPayments || []
  const netDue =
    s != null
      ? (Number(s.totalSalaryEarned) || 0) -
        (Number(s.totalPaid) || 0)
      : 0

  const payTabBankDetails = useMemo(() => {
    const fromRequest = (row) =>
      row &&
      (row.driverUpiId ||
        row.driverAccountNumber ||
        row.driverIfsc ||
        row.driverAccountName ||
        row.driverUpiQrCode)

    if (tripPayContext && fromRequest(tripPayContext)) {
      return {
        upiId: tripPayContext.driverUpiId || '',
        accountNumber: tripPayContext.driverAccountNumber || '',
        ifsc: tripPayContext.driverIfsc || '',
        accountName: tripPayContext.driverAccountName || '',
        qr: tripPayContext.driverUpiQrCode || '',
      }
    }

    const list = s?.pendingRequests || []
    const match = list.find(
      (p) =>
        Number(p.month) === payMonth &&
        Number(p.year) === payYear
    )

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
  }, [s, payMonth, payYear, tripPayContext])

  const filteredOwnerHistory =
    historyFilter === 'salary'
      ? payments.filter((p) => !isTripPaymentRow(p))
      : historyFilter === 'trip'
        ? payments.filter((p) => isTripPaymentRow(p))
        : payments

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

  const openPayTabFromRequest = (req) => {
    setTripPayContext(null)
    const amt =
      Number(req?.netAmount) ||
      Number(req?.amount) ||
      0
    if (amt > 0) setAmount(String(amt))
    if (req?.month) setPayMonth(Number(req.month))
    if (req?.year) setPayYear(Number(req.year))
    setTab('payment')
  }

  const openPayTabForTrip = (req) => {
    const amt =
      Number(req?.netAmount) ||
      Number(req?.amount) ||
      0
    if (amt > 0) setAmount(String(amt))
    setTripPayContext(req)
    setTab('payment')
  }

  const getTripPaid = (tripId) => {
    return tripPaymentsList
      .filter((p) => {
        const pTripId = p.tripId?._id || p.tripId
        return String(pTripId) === String(tripId)
      })
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  }

  const handleTripReceipt = (trip) => {
    setPrintTrip(trip)
    setTimeout(() => {
      window.print()
    }, 300)
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
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
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
                    {c.jobId?.title || 'Job'} —{' '}
                    {c.jobId?.vehicleCategory === 'transport'
                      ? '🚛 Transport'
                      : '🔧 Normal'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-2">
            {tabs.map(({ id, label }) => (
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
          ) : !cid && tab !== 'trip' ? (
            <p className="text-center text-gray-600">
              Koi active contract nahi
            </p>
          ) : loading && tab !== 'trip' ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : tab === 'summary' ? (
            s ? (
            <>
              {(salaryPendingRequests.length > 0 ||
                tripPendingRequests.length > 0) && (
                <div className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                  {salaryPendingRequests.length > 0 && (
                    <>
                  <h2 className="text-base font-semibold text-gray-900">
                    Driver ki Salary Payment Requests
                  </h2>
                  <ul className="mt-4 space-y-4">
                    {salaryPendingRequests.map((req) => {
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
                    </>
                  )}

                  {tripPendingRequests.length > 0 && (
                    <div
                      className={
                        salaryPendingRequests.length > 0
                          ? 'mt-8 border-t border-yellow-200 pt-6'
                          : ''
                      }
                    >
                      <h2 className="text-base font-semibold text-gray-900">
                        🚛 Trip Payment Requests
                      </h2>
                      <ul className="mt-4 space-y-4">
                        {tripPendingRequests.map((req) => {
                          const upi = String(
                            req.driverUpiId || ''
                          ).trim()
                          const routeLabel =
                            req.tripId &&
                            typeof req.tripId === 'object'
                              ? `${req.tripId.fromLocation || req.tripId.from || '—'} → ${req.tripId.toLocation || req.tripId.to || '—'}`
                              : null
                          return (
                            <li
                              key={req._id}
                              className="rounded-2xl border border-amber-100 bg-white p-4 shadow-sm"
                            >
                              <p className="text-sm font-semibold text-amber-900">
                                🚛 Trip Payment Request
                              </p>
                              <p className="mt-1 text-lg font-bold text-gray-800">
                                Amount:{' '}
                                {fmtMoney(req.netAmount || req.amount)}
                              </p>
                              {routeLabel ? (
                                <p className="text-sm text-gray-600">
                                  Route: {routeLabel}
                                </p>
                              ) : null}
                              <div className="mt-3 rounded-lg bg-blue-50 p-3">
                                <p className="text-xs font-medium text-blue-900">
                                  Driver UPI / Bank
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <p className="text-sm text-gray-800">
                                    <span className="text-gray-600">
                                      UPI ID:{' '}
                                    </span>
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
                              </div>
                              <p className="mt-2 text-xs text-gray-500">
                                Requested:{' '}
                                {fmtDate(
                                  req.driverRequestedAt || req.createdAt
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={() => openPayTabForTrip(req)}
                                className="mt-4 w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white hover:bg-amber-700"
                              >
                                Trip Payment Karo
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
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
                          {payoutMethodOf(pp) === 'upi' &&
                          pp.utrNumber ? (
                            <span className="ml-2 font-normal text-gray-600">
                              · UTR: {pp.utrNumber}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 text-xs text-amber-800">
                          {isTripPaymentRow(pp)
                            ? '🚛 Trip'
                            : '💰 Salary'}
                        </p>
                        <p className="mt-1 text-xs font-medium text-yellow-800">
                          Pending confirmation
                        </p>
                        <p className="text-xs text-gray-500">
                          {isTripPaymentRow(pp)
                            ? 'Trip payment'
                            : `Month ${pp.month}/${pp.year}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                <p className="text-xs text-green-800">
                  Total Salary Earned
                </p>
                <p className="text-xl font-bold text-green-900">
                  {fmtMoney(s.totalSalaryEarned)}
                </p>
                <p className="text-[10px] text-green-700">
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
                <p className="text-[10px] text-blue-700">
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
                <p className="text-[10px] text-gray-600">
                  Abhi baaki hai
                </p>
              </div>
            </div>
            </>
            ) : (
              <p className="text-center text-gray-500">
                Summary load nahi hui
              </p>
            )
          ) : tab === 'payment' ? (
            <>
              {s ? (
                <>
                  {salaryPending.length > 0 && (
                    <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4">
                      <h3
                        style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#111827',
                          marginBottom: '12px',
                        }}
                      >
                        Salary Payment Requests
                      </h3>
                      {salaryPending.map((p) => {
                        const m = Number(p.month) || 1
                        const y =
                          Number(p.year) || new Date().getFullYear()
                        const monthLabel = `${MONTH_NAMES[m - 1] || '—'} ${y}`
                        return (
                          <div
                            key={p._id}
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
                                marginBottom: '12px',
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontWeight: '600',
                                    fontSize: '15px',
                                  }}
                                >
                                  💰 Salary Payment
                                </div>
                                <div
                                  style={{
                                    fontSize: '13px',
                                    color: '#6B7280',
                                    marginTop: '4px',
                                  }}
                                >
                                  Driver: {p.driverId?.name || driverName}
                                </div>
                                <div
                                  style={{
                                    fontSize: '13px',
                                    color: '#6B7280',
                                    marginTop: '4px',
                                  }}
                                >
                                  Month: {monthLabel}
                                </div>
                                <div
                                  style={{
                                    fontSize: '20px',
                                    fontWeight: '700',
                                    color: '#1D4ED8',
                                    marginTop: '4px',
                                  }}
                                >
                                  ₹{p.netAmount ?? p.amount ?? 0}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => openPayTabFromRequest(p)}
                              className="w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                            >
                              Payment Karo
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {tripPending.length > 0 && (
                    <div
                      style={{
                        marginTop: salaryPending.length > 0 ? 24 : 0,
                        marginBottom: 24,
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#111827',
                          marginBottom: '12px',
                        }}
                      >
                        🚛 Trip Payment Requests
                      </h3>
                      {tripPending.map((p) => (
                        <div
                          key={p._id}
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
                              marginBottom: '12px',
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  fontWeight: '600',
                                  fontSize: '15px',
                                }}
                              >
                                🚛 Trip Payment
                              </div>
                              <div
                                style={{
                                  fontSize: '13px',
                                  color: '#6B7280',
                                  marginTop: '4px',
                                }}
                              >
                                Driver: {p.driverId?.name || driverName}
                              </div>
                              <div
                                style={{
                                  fontSize: '20px',
                                  fontWeight: '700',
                                  color: '#1D4ED8',
                                  marginTop: '4px',
                                }}
                              >
                                ₹{p.netAmount ?? p.amount ?? 0}
                              </div>
                            </div>
                          </div>
                          <p
                            style={{
                              fontSize: '13px',
                              fontWeight: '500',
                              color: '#374151',
                              marginBottom: '8px',
                            }}
                          >
                            Payment type
                          </p>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setPayType('upi')}
                              style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '10px',
                                border:
                                  payType === 'upi'
                                    ? '2px solid #1D4ED8'
                                    : '1px solid #E5E7EB',
                                background:
                                  payType === 'upi' ? '#EFF6FF' : '#fff',
                                fontSize: '13px',
                                fontWeight: '600',
                              }}
                            >
                              UPI
                            </button>
                            <button
                              type="button"
                              onClick={() => setPayType('cash')}
                              style={{
                                flex: 1,
                                padding: '8px',
                                borderRadius: '10px',
                                border:
                                  payType === 'cash'
                                    ? '2px solid #1D4ED8'
                                    : '1px solid #E5E7EB',
                                background:
                                  payType === 'cash' ? '#EFF6FF' : '#fff',
                                fontSize: '13px',
                                fontWeight: '600',
                              }}
                            >
                              Cash
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => openPayTabForTrip(p)}
                            className="mt-4 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800"
                          >
                            Mark Paid
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}

            <form
              onSubmit={onMakePayment}
              className="rounded-2xl border border-gray-100 bg-white p-6"
            >
              <h2 className="text-lg font-semibold text-gray-800">
                {tripPayContext
                  ? '🚛 Trip payment mark karein'
                  : 'Payment Karo'}
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Driver:{' '}
                <span className="font-medium">{driverName}</span>
              </p>
              {tripPayContext ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Trip payment alag hai — salary summary / net due par
                  asar nahi.
                </div>
              ) : null}

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

              {!tripPayContext ? (
                <>
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
                </>
              ) : null}

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
                  <div style={{ marginTop: '12px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '6px',
                      }}
                    >
                      Payment Proof Photo (optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        setProofPhoto(
                          e.target.files?.[0] || null
                        )
                        e.target.value = ''
                      }}
                      style={{ fontSize: '13px' }}
                    />
                    {proofPhoto ? (
                      <p
                        style={{
                          fontSize: '12px',
                          color: '#16A34A',
                          marginTop: '4px',
                        }}
                      >
                        ✅ {proofPhoto.name}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">
                  Cash payment — UTR ki zaroorat nahi.
                  <div style={{ marginTop: '12px' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#374151',
                        marginBottom: '6px',
                      }}
                    >
                      Payment Proof Photo (optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        setProofPhoto(
                          e.target.files?.[0] || null
                        )
                        e.target.value = ''
                      }}
                      style={{ fontSize: '13px' }}
                    />
                    {proofPhoto ? (
                      <p
                        style={{
                          fontSize: '12px',
                          color: '#16A34A',
                          marginTop: '4px',
                        }}
                      >
                        ✅ {proofPhoto.name}
                      </p>
                    ) : null}
                  </div>
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

              {openAdvance &&
                remainingAdvance > 0 &&
                !tripPayContext && (
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
                  : tripPayContext
                    ? 'Trip Payment Mark Karo'
                    : 'Payment Mark Karo'}
              </button>
            </form>
            </>
          ) : tab === 'trip' ? (
            selectedIsTransport ? (
            <div>
              <p className="mb-3 text-sm text-gray-600">
                Sab drivers ke owner-approved trips — salary alag
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
                    Total Paid
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
                  const paidForTrip = getTripPaid(trip._id)
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
                            {trip.driverId?.name || 'Driver'}
                          </div>
                          <div
                            style={{
                              fontWeight: '600',
                              fontSize: '14px',
                              color: '#374151',
                              marginTop: '6px',
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
                          Paid: ₹{paidForTrip}
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

                      <div style={{ marginTop: '12px' }}>
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
              <p className="text-gray-500">Koi payment nahi</p>
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
                          ? 'bg-blue-700 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {filteredOwnerHistory.length === 0 ? (
                  <p className="text-gray-500">
                    Is filter mein kuch nahi
                  </p>
                ) : (
              <ul className="space-y-3">
                {filteredOwnerHistory.map((p) => (
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
                    <p className="mt-1 text-xs font-semibold text-emerald-800">
                      {isTripPaymentRow(p)
                        ? '🚛 Trip'
                        : '💰 Salary'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {payoutMethodOf(p) === 'upi'
                        ? 'UPI'
                        : 'Cash'}{' '}
                      · {fmtDate(p.createdAt)} ·{' '}
                      {isTripPaymentRow(p)
                        ? 'Trip'
                        : `M${p.month}/Y${p.year}`}
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
                )}
              </>
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
              <span>Driver:</span>
              <span>{printTrip.driverId?.name || '—'}</span>
            </div>

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
                  {getUser()?.name || printTrip.ownerId?.name || 'Owner'}
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
                  {printTrip.driverId?.name || 'Driver'}
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

export default OwnerPayments
