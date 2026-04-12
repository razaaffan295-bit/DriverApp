import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import jsPDF from 'jspdf'
import { getUser } from '../../utils/helpers'
import { savePDF, isNativeApp } from '../../utils/pdfUpload'
import { getOwnerTrips, handleTrip } from '../../api/tripAPI'
import { getOwnerContracts } from '../../api/contractAPI'
import { getPayments } from '../../api/paymentAPI'

const fmtMoney = (n) =>
  `₹${Number.isFinite(Number(n)) ? Number(n) : 0}`

const expenseLabel = (ex) => ex.type || ex.category || 'other'

const grandTotal = (t) =>
  (Number(t.totalExpenses) || 0) + (Number(t.totalRepairs) || 0)

const tripApprovedAmount = (t) =>
  Number(t.approvedAmount) || Number(t.approvedExpenses) || 0

const tripFrom = (t) => t.fromLocation || t.from || ''
const tripTo = (t) => t.toLocation || t.to || ''
const tripCargo = (t) => t.cargo || t.description || ''

const OwnerTrips = () => {
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [trips, setTrips] = useState([])
  const [reviewByTripId, setReviewByTripId] = useState({})
  const [expandTripId, setExpandTripId] = useState(null)
  const [printTrip, setPrintTrip] = useState(null)
  const [tripPayments, setTripPayments] = useState([])

  const handleTripReceipt = async (trip) => {
    if (isNativeApp()) {
      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.text('Trip Receipt', 14, 20)
      doc.setFontSize(11)
      doc.text(`Route: ${tripFrom(trip)} → ${tripTo(trip)}`, 14, 32)
      doc.text(`Cargo: ${tripCargo(trip) || '-'}`, 14, 40)
      doc.text(
        `Date: ${new Date(
          trip.tripDate || trip.createdAt
        ).toLocaleDateString('en-IN')}`,
        14,
        48
      )
      doc.text(
        `Total Expenses: Rs.${trip.totalExpenses || 0}`,
        14,
        56
      )
      doc.text(
        `Total Repairs: Rs.${trip.totalRepairs || 0}`,
        14,
        64
      )
      doc.text(`Grand Total: Rs.${grandTotal(trip)}`, 14, 72)
      doc.text(
        `Approved: Rs.${tripApprovedAmount(trip)}`,
        14,
        80
      )
      await savePDF(doc, `trip-receipt-${trip._id}.pdf`)
    } else {
      setPrintTrip(trip)
      setTimeout(() => window.print(), 300)
    }
  }

  useEffect(() => {
    setUser(getUser())
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await getOwnerTrips()
      setTrips(res.data?.trips || [])
    } catch (e) {
      setTrips([])
      toast.error(e.response?.data?.message || 'Trips load nahi hue')
    } finally {
      setLoading(false)
    }
  }

  const loadTripPayments = async () => {
    try {
      const contractsRes = await getOwnerContracts()
      const raw = contractsRes.data?.contracts || []
      const merged = []
      for (const c of raw) {
        try {
          const res = await getPayments({ contractId: c._id })
          merged.push(...(res.data?.payments || []))
        } catch (e) {
          console.error(e)
        }
      }
      const tripPays = merged.filter(
        (p) =>
          p.paymentType === 'trip' && p.driverConfirmed === true
      )
      setTripPayments(tripPays)
    } catch (err) {
      console.error(err)
    }
  }

  const getTripPaid = (tripId) => {
    const tid = String(tripId)
    return tripPayments
      .filter((p) => {
        const pid = p.tripId?._id ?? p.tripId
        return String(pid) === tid
      })
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  }

  useEffect(() => {
    load()
    loadTripPayments()
  }, [])

  const pendingTrips = useMemo(
    () => (trips || []).filter((t) => t.status === 'submitted'),
    [trips]
  )

  const historyTrips = useMemo(
    () => (trips || []).filter((t) => t.status !== 'submitted'),
    [trips]
  )

  useEffect(() => {
    setReviewByTripId((prev) => {
      const next = { ...prev }
      pendingTrips.forEach((t) => {
        const id = String(t._id)
        if (next[id] == null) {
          next[id] = {
            approvedAmount: grandTotal(t),
            note: '',
          }
        }
      })
      return next
    })
  }, [pendingTrips])

  const isPdf = (url) =>
    url &&
    (url.toLowerCase().includes('.pdf') ||
      url.toLowerCase().includes('/pdf'))

  const getThumbUrl = (url) => {
    if (!url) return ''
    if (url.includes('cloudinary.com')) {
      return url.replace(
        '/upload/',
        '/upload/w_150,h_150,c_fill,q_auto/'
      )
    }
    return url
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F0F4FF' }}>
      <div className="mx-auto max-w-3xl px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-gray-100 bg-white p-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setTab('pending')}
                className={`rounded-xl py-3 text-sm font-semibold ${
                  tab === 'pending'
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                Pending
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setTab('history')}
                className={`rounded-xl py-3 text-sm font-semibold ${
                  tab === 'history'
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                History
              </button>
            </div>

            {tab === 'pending' ? (
              <div>
                {pendingTrips.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    Koi pending trip nahi
                  </div>
                ) : (
                  pendingTrips.map((t) => {
                    const tid = String(t._id)
                    const review = reviewByTripId[tid] || {
                      approvedAmount: grandTotal(t),
                      note: '',
                    }
                    const expOpen = expandTripId === `${t._id}-exp`
                    const repOpen = expandTripId === `${t._id}-rep`
                    return (
                      <div
                        key={t._id}
                        className="mb-4 rounded-2xl border border-yellow-200 bg-white p-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {t.driverId?.name || 'Driver'}{' '}
                              {t.driverId?.phone
                                ? `· ${t.driverId.phone}`
                                : ''}
                            </p>
                            <p className="mt-1 text-xs text-gray-600">
                              {tripFrom(t) || 'From'} →{' '}
                              {tripTo(t) || 'To'}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              Submit:{' '}
                              {t.submittedAt
                                ? new Date(
                                    t.submittedAt
                                  ).toLocaleString('en-IN')
                                : new Date(
                                    t.tripDate
                                  ).toLocaleDateString('en-IN')}
                            </p>
                            {tripCargo(t) ? (
                              <p className="mt-1 text-xs text-gray-600">
                                Cargo: {tripCargo(t)}
                              </p>
                            ) : null}
                          </div>
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                            {t.transportType === 'company_trip'
                              ? 'Company Trip'
                              : 'Malik Trip'}
                          </span>
                        </div>

                        <div className="mt-3 rounded-xl bg-blue-50/50 p-3 text-sm">
                          <p>
                            Total expenses:{' '}
                            <strong>{fmtMoney(t.totalExpenses)}</strong>
                          </p>
                          <p>
                            Total repairs:{' '}
                            <strong>{fmtMoney(t.totalRepairs)}</strong>
                          </p>
                          <p className="mt-1 font-bold text-blue-900">
                            Grand total: {fmtMoney(grandTotal(t))}
                          </p>
                        </div>

                        {t.transportType === 'malik_trip' ? (
                          <>
                            <button
                              type="button"
                              className="mt-3 w-full rounded-lg border border-gray-200 py-2 text-left text-sm font-medium text-gray-800"
                              onClick={() =>
                                setExpandTripId(
                                  expOpen ? null : `${t._id}-exp`
                                )
                              }
                            >
                              {expOpen ? '▼' : '▶'} Expense list (
                              {(t.expenses || []).length})
                            </button>
                            {expOpen && (
                              <div className="mt-2 space-y-2">
                                {(t.expenses || []).map((expense, idx) => (
                                  <div
                                    key={idx}
                                    className="rounded-xl bg-gray-50 p-3 text-xs"
                                  >
                                    <div className="flex justify-between font-semibold">
                                      <span className="capitalize">
                                        {expenseLabel(expense)}
                                      </span>
                                      <span>{fmtMoney(expense.amount)}</span>
                                    </div>
                                    {expense.note || expense.description ? (
                                      <p className="mt-1 text-gray-600">
                                        {expense.note || expense.description}
                                      </p>
                                    ) : null}
                                    {(expense.image || expense.photo) && (
                                      <a
                                        href={
                                          expense.image || expense.photo
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          display: 'inline-block',
                                          marginTop: '6px',
                                        }}
                                      >
                                        {isPdf(
                                          expense.image || expense.photo
                                        ) ? (
                                          <div
                                            style={{
                                              width: '50px',
                                              height: '50px',
                                              background: '#FEF2F2',
                                              borderRadius: '6px',
                                              border: '1px solid #FECACA',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                            }}
                                          >
                                            <span
                                              style={{ fontSize: '18px' }}
                                            >
                                              📄
                                            </span>
                                            <span
                                              style={{
                                                fontSize: '9px',
                                                color: '#EF4444',
                                              }}
                                            >
                                              PDF
                                            </span>
                                          </div>
                                        ) : (
                                          <img
                                            src={getThumbUrl(
                                              expense.image || expense.photo
                                            )}
                                            alt="proof"
                                            style={{
                                              width: '50px',
                                              height: '50px',
                                              objectFit: 'cover',
                                              borderRadius: '6px',
                                              border: '1px solid #E5E7EB',
                                              cursor: 'pointer',
                                            }}
                                          />
                                        )}
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            <button
                              type="button"
                              className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-left text-sm font-medium text-gray-800"
                              onClick={() =>
                                setExpandTripId(
                                  repOpen ? null : `${t._id}-rep`
                                )
                              }
                            >
                              {repOpen ? '▼' : '▶'} Repair list (
                              {(t.repairs || []).length})
                            </button>
                            {repOpen && (
                              <div className="mt-2 space-y-2">
                                {(t.repairs || []).map((repair, i) => (
                                  <div
                                    key={i}
                                    className="rounded-xl bg-amber-50 p-3 text-xs"
                                  >
                                    <div className="flex justify-between font-semibold">
                                      <span>{repair.description}</span>
                                      <span>{fmtMoney(repair.amount)}</span>
                                    </div>
                                    {repair.image ? (
                                      <a
                                        href={repair.image}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          display: 'inline-block',
                                          marginTop: '6px',
                                        }}
                                      >
                                        {isPdf(repair.image) ? (
                                          <div
                                            style={{
                                              width: '50px',
                                              height: '50px',
                                              background: '#FEF2F2',
                                              borderRadius: '6px',
                                              border: '1px solid #FECACA',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                            }}
                                          >
                                            <span
                                              style={{ fontSize: '18px' }}
                                            >
                                              📄
                                            </span>
                                            <span
                                              style={{
                                                fontSize: '9px',
                                                color: '#EF4444',
                                              }}
                                            >
                                              PDF
                                            </span>
                                          </div>
                                        ) : (
                                          <img
                                            src={getThumbUrl(repair.image)}
                                            alt="repair proof"
                                            style={{
                                              width: '50px',
                                              height: '50px',
                                              objectFit: 'cover',
                                              borderRadius: '6px',
                                              border: '1px solid #E5E7EB',
                                              cursor: 'pointer',
                                            }}
                                          />
                                        )}
                                      </a>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="mt-3 text-sm text-gray-500">
                              Company trip — kharche nahi hote
                            </p>
                            {(t.repairs || []).length > 0 && (
                              <>
                                <button
                                  type="button"
                                  className="mt-2 w-full rounded-lg border border-gray-200 py-2 text-left text-sm font-medium text-gray-800"
                                  onClick={() =>
                                    setExpandTripId(
                                      repOpen ? null : `${t._id}-rep`
                                    )
                                  }
                                >
                                  {repOpen ? '▼' : '▶'} Repair list (
                                  {(t.repairs || []).length})
                                </button>
                                {repOpen && (
                                  <div className="mt-2 space-y-2">
                                    {(t.repairs || []).map((repair, i) => (
                                      <div
                                        key={i}
                                        className="rounded-xl bg-amber-50 p-3 text-xs"
                                      >
                                        <div className="flex justify-between font-semibold">
                                          <span>{repair.description}</span>
                                          <span>{fmtMoney(repair.amount)}</span>
                                        </div>
                                        {repair.image ? (
                                          <a
                                            href={repair.image}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                              display: 'inline-block',
                                              marginTop: '6px',
                                            }}
                                          >
                                            {isPdf(repair.image) ? (
                                              <div
                                                style={{
                                                  width: '50px',
                                                  height: '50px',
                                                  background: '#FEF2F2',
                                                  borderRadius: '6px',
                                                  border: '1px solid #FECACA',
                                                  display: 'flex',
                                                  flexDirection: 'column',
                                                  alignItems: 'center',
                                                  justifyContent: 'center',
                                                }}
                                              >
                                                <span
                                                  style={{ fontSize: '18px' }}
                                                >
                                                  📄
                                                </span>
                                                <span
                                                  style={{
                                                    fontSize: '9px',
                                                    color: '#EF4444',
                                                  }}
                                                >
                                                  PDF
                                                </span>
                                              </div>
                                            ) : (
                                              <img
                                                src={getThumbUrl(repair.image)}
                                                alt="repair proof"
                                                style={{
                                                  width: '50px',
                                                  height: '50px',
                                                  objectFit: 'cover',
                                                  borderRadius: '6px',
                                                  border: '1px solid #E5E7EB',
                                                  cursor: 'pointer',
                                                }}
                                              />
                                            )}
                                          </a>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}

                        <div className="mt-4">
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            Approve amount (default: grand total)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={review.approvedAmount}
                            onChange={(e) =>
                                    setReviewByTripId((p) => ({
                                      ...p,
                                      [tid]: {
                                        ...review,
                                        approvedAmount: e.target.value,
                                      },
                                    }))
                                  }
                            className="input-field w-full"
                          />
                        </div>
                        <div className="mt-3">
                          <textarea
                            rows={2}
                            value={review.note}
                            onChange={(e) =>
                              setReviewByTripId((p) => ({
                                ...p,
                                [tid]: {
                                  ...review,
                                  note: e.target.value,
                                },
                              }))
                            }
                            placeholder="Note (optional)"
                            className="input-field w-full resize-y"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTripReceipt(t)}
                          className="no-print mt-3 w-full rounded-xl border border-gray-300 py-2 text-sm font-medium text-gray-800"
                        >
                          Receipt download / print
                        </button>

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                              try {
                                setSaving(true)
                                await handleTrip({
                                  tripId: t._id,
                                  action: 'approved',
                                  approvedAmount:
                                    Number(review.approvedAmount) ||
                                    0,
                                  note: review.note || '',
                                })
                                toast.success('Trip approve ho gayi!')
                                await load()
                                await loadTripPayments()
                              } catch (e) {
                                toast.error(
                                  e.response?.data?.message ||
                                    'Approve nahi hua'
                                )
                              } finally {
                                setSaving(false)
                              }
                            }}
                            className="rounded-xl bg-green-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            Approve karo
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={async () => {
                              try {
                                setSaving(true)
                                await handleTrip({
                                  tripId: t._id,
                                  action: 'rejected',
                                  approvedAmount: 0,
                                  note: review.note || '',
                                })
                                toast.success('Trip reject ho gayi!')
                                await load()
                                await loadTripPayments()
                              } catch (e) {
                                toast.error(
                                  e.response?.data?.message ||
                                    'Reject nahi hua'
                                )
                              } finally {
                                setSaving(false)
                              }
                            }}
                            className="rounded-xl border-2 border-red-500 py-3 text-sm font-semibold text-red-600 disabled:opacity-60"
                          >
                            Reject karo
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print mb-4 w-full rounded-xl bg-gray-700 py-3 text-sm text-white"
                >
                  Trip history print
                </button>

                {historyTrips.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    Koi history nahi
                  </div>
                ) : (
                  historyTrips.map((t) => {
                    const gt =
                      (Number(t.totalExpenses) || 0) +
                      (Number(t.totalRepairs) || 0)
                    const paid = getTripPaid(t._id)
                    const baaki = gt - paid
                    return (
                    <div
                      key={t._id}
                      className="mb-3 rounded-2xl border border-gray-100 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {t.driverId?.name || 'Driver'}{' '}
                            {t.driverId?.phone
                              ? `· ${t.driverId.phone}`
                              : ''}
                          </p>
                          <p className="mt-1 text-xs text-gray-600">
                            {tripFrom(t)} → {tripTo(t)}
                          </p>
                          <p className="mt-2 text-sm text-gray-700">
                            Expenses {fmtMoney(t.totalExpenses)} · Repairs{' '}
                            {fmtMoney(t.totalRepairs)} · Grand{' '}
                            {fmtMoney(grandTotal(t))}
                          </p>
                          <p className="text-xs text-gray-600">
                            Approved:{' '}
                            {fmtMoney(
                              t.approvedAmount ??
                                t.approvedExpenses ??
                                0
                            )}
                          </p>
                          {t.status === 'approved' ? (
                            <div
                              style={{
                                display: 'flex',
                                gap: '8px',
                                flexWrap: 'wrap',
                                marginTop: '12px',
                                fontSize: '13px',
                              }}
                            >
                              <span
                                style={{
                                  background: '#F9FAFB',
                                  color: '#374151',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontWeight: '600',
                                }}
                              >
                                Total Expenses: ₹
                                {Number(t.totalExpenses) || 0}
                              </span>
                              <span
                                style={{
                                  background: '#F9FAFB',
                                  color: '#374151',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontWeight: '600',
                                }}
                              >
                                Total Repairs: ₹
                                {Number(t.totalRepairs) || 0}
                              </span>
                              <span
                                style={{
                                  background: '#F0FDF4',
                                  color: '#16A34A',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontWeight: '600',
                                }}
                              >
                                Grand Total: ₹{gt}
                              </span>
                              <span
                                style={{
                                  background: '#EFF6FF',
                                  color: '#1D4ED8',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontWeight: '600',
                                }}
                              >
                                Approved: ₹
                                {t.approvedAmount || 0}
                              </span>
                              <span
                                style={{
                                  background: '#EFF6FF',
                                  color: '#1D4ED8',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                }}
                              >
                                Paid: ₹{paid}
                              </span>
                              <span
                                style={{
                                  background:
                                    baaki > 0 ? '#FEF2F2' : '#F0FDF4',
                                  color:
                                    baaki > 0 ? '#EF4444' : '#16A34A',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontWeight: '600',
                                }}
                              >
                                Baaki: ₹{Math.max(0, baaki)}
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            t.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : t.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {t.status === 'approved'
                            ? 'Approved'
                            : t.status === 'rejected'
                              ? 'Rejected'
                              : t.status}
                        </span>
                      </div>
                      {t.ownerNote ? (
                        <p className="mt-2 text-xs text-gray-600">
                          Note: {t.ownerNote}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleTripReceipt(t)}
                        className="no-print mt-3 w-full rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-700"
                      >
                        Trip receipt download
                      </button>
                    </div>
                    )
                  })
                )}

                <div className="print-area hidden">
                  <div className="print-heading">OWNER TRIP HISTORY</div>
                  <div className="print-row">
                    <span>Owner</span>
                    <span>{user?.name}</span>
                  </div>
                  {historyTrips.map((trip, i) => (
                    <div key={trip._id} className="mt-4">
                      <strong>Trip {i + 1}</strong>
                      <div className="print-row">
                        <span>Driver</span>
                        <span>{trip.driverId?.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

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
              <div className="print-row">
                <span>Driver:</span>
                <span>
                  {printTrip.driverId?.name || '—'}{' '}
                  {printTrip.driverId?.phone || ''}
                </span>
              </div>
              <div className="print-row">
                <span>Owner:</span>
                <span>{user?.name || '—'}</span>
              </div>
              <h3 style={{ marginTop: '16px' }}>Expenses</h3>
              {(printTrip.expenses || []).map((e, i) => (
                <div key={i} className="print-row">
                  <span>
                    {expenseLabel(e)} — {e.note || e.description || '—'}
                  </span>
                  <span>₹{e.amount}</span>
                </div>
              ))}
              <h3 style={{ marginTop: '16px' }}>Repairs</h3>
              {(printTrip.repairs || []).map((r, i) => (
                <div key={i} className="print-row">
                  <span>{r.description || '—'}</span>
                  <span>₹{r.amount}</span>
                </div>
              ))}
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
                <strong>₹{grandTotal(printTrip)}</strong>
              </div>
              <div className="print-row">
                <strong>Approved Amount:</strong>
                <strong>
                  ₹
                  {printTrip.approvedAmount ??
                    printTrip.approvedExpenses ??
                    0}
                </strong>
              </div>
              {printTrip.ownerNote ? (
                <div className="print-row">
                  <span>Owner Note:</span>
                  <span>{printTrip.ownerNote}</span>
                </div>
              ) : null}
              <div
                style={{
                  marginTop: '40px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <div>Owner Signature: ____________</div>
                <div>Driver Signature: ____________</div>
              </div>
              <div
                style={{
                  textAlign: 'center',
                  marginTop: '20px',
                  fontSize: '11px',
                  color: '#666',
                }}
              >
                Generated by DriverApp —{' '}
                {new Date().toLocaleDateString('en-IN')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OwnerTrips
