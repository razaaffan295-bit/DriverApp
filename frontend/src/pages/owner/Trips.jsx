import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { getUser } from '../../utils/helpers'
import { getOwnerTrips, reviewTrip } from '../../api/tripAPI'

const OwnerTrips = () => {
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [trips, setTrips] = useState([])
  const [reviewByTripId, setReviewByTripId] = useState({})

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

  useEffect(() => {
    load()
  }, [])

  const pendingTrips = useMemo(() => {
    return (trips || []).filter((t) => t.status === 'submitted')
  }, [trips])

  const historyTrips = useMemo(() => {
    return (trips || []).filter((t) => t.status !== 'submitted')
  }, [trips])

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
        <div className="mx-auto max-w-3xl px-4 py-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 border border-gray-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setTab('pending')}
                  className={`rounded-xl py-3 text-sm font-semibold ${
                    tab === 'pending' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Pending
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setTab('history')}
                  className={`rounded-xl py-3 text-sm font-semibold ${
                    tab === 'history' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  History
                </button>
              </div>

              {tab === 'pending' ? (
                <div>
                  {pendingTrips.length === 0 ? (
                    <div className="py-8 text-center text-gray-400">Koi pending trip nahi</div>
                  ) : (
                    pendingTrips.map((t) => {
                      const review = reviewByTripId[t._id] || {
                        approvedExpenses: t.totalExpenses || 0,
                        ownerNote: '',
                      }
                      return (
                        <div key={t._id} className="mb-4 rounded-2xl border border-yellow-200 bg-white p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {t.driverId?.name || 'Driver'} {t.driverId?.phone ? `· ${t.driverId.phone}` : ''}
                              </p>
                              <p className="mt-1 text-xs text-gray-600">
                                {new Date(t.tripDate).toLocaleDateString('en-IN')} · {t.fromLocation || 'From'} → {t.toLocation || 'To'}
                              </p>
                              {t.description ? (
                                <p className="mt-1 text-xs text-gray-600">{t.description}</p>
                              ) : null}
                            </div>
                            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                              {t.transportType === 'company_trip' ? 'Company Trip' : 'Malik Trip'}
                            </span>
                          </div>

                          {t.transportType === 'malik_trip' ? (
                            <div className="mt-4">
                              <div className="space-y-2">
                                {(t.expenses || []).map((ex, idx) => (
                                  <div key={idx} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                                    <span className="text-xs font-semibold text-gray-700">{ex.category}</span>
                                    <span className="text-xs font-semibold text-gray-900">₹{ex.amount}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 text-sm font-semibold text-gray-800">
                                Total: ₹{t.totalExpenses || 0}
                              </div>

                              <div className="mt-4">
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                  Approved Amount:
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  value={review.approvedExpenses}
                                  onChange={(e) =>
                                    setReviewByTripId((p) => ({
                                      ...p,
                                      [t._id]: { ...review, approvedExpenses: e.target.value },
                                    }))
                                  }
                                  className="input-field w-full"
                                />
                              </div>
                              <div className="mt-3">
                                <textarea
                                  rows={3}
                                  value={review.ownerNote}
                                  onChange={(e) =>
                                    setReviewByTripId((p) => ({
                                      ...p,
                                      [t._id]: { ...review, ownerNote: e.target.value },
                                    }))
                                  }
                                  placeholder="Note..."
                                  className="input-field w-full resize-y"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 text-sm text-gray-700">
                              Company trip — no expenses
                              <div className="mt-3">
                                <textarea
                                  rows={3}
                                  value={review.ownerNote}
                                  onChange={(e) =>
                                    setReviewByTripId((p) => ({
                                      ...p,
                                      [t._id]: { ...review, ownerNote: e.target.value },
                                    }))
                                  }
                                  placeholder="Note..."
                                  className="input-field w-full resize-y"
                                />
                              </div>
                            </div>
                          )}

                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={async () => {
                                try {
                                  setSaving(true)
                                  await reviewTrip({
                                    tripId: t._id,
                                    action: 'approved',
                                    approvedExpenses: Number(review.approvedExpenses) || 0,
                                    ownerNote: review.ownerNote || '',
                                  })
                                  toast.success('Trip approved ho gayi!')
                                  await load()
                                } catch (e) {
                                  toast.error(e.response?.data?.message || 'Approve nahi hua')
                                } finally {
                                  setSaving(false)
                                }
                              }}
                              className="rounded-xl bg-green-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {saving ? 'Save...' : 'Approve Karo'}
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={async () => {
                                try {
                                  setSaving(true)
                                  await reviewTrip({
                                    tripId: t._id,
                                    action: 'rejected',
                                    approvedExpenses: 0,
                                    ownerNote: review.ownerNote || '',
                                  })
                                  toast.success('Trip reject ho gayi!')
                                  await load()
                                } catch (e) {
                                  toast.error(e.response?.data?.message || 'Reject nahi hua')
                                } finally {
                                  setSaving(false)
                                }
                              }}
                              className="rounded-xl border border-red-500 py-3 text-sm font-semibold text-red-600 disabled:opacity-60"
                            >
                              {saving ? 'Save...' : 'Reject Karo'}
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
                    className="no-print w-full py-3 bg-gray-700 text-white rounded-xl text-sm mt-4"
                  >
                    📄 Trip History PDF Download
                  </button>

                  <div className="print-area" style={{ display: 'none' }}>
                    <div className="print-heading">TRIP HISTORY RECORD</div>

                    <div className="print-row">
                      <span>Driver:</span>
                      <span>Multiple</span>
                    </div>

                    <div className="print-row">
                      <span>Vehicle Type:</span>
                      <span>
                        {historyTrips
                          .filter((t) => t.status !== 'draft')[0]?.contractId?.jobId?.vehicleType ||
                          historyTrips
                            .filter((t) => t.status !== 'draft')[0]?.jobId?.vehicleType ||
                          '—'}
                      </span>
                    </div>

                    <div className="print-row">
                      <span>Job:</span>
                      <span>
                        {historyTrips
                          .filter((t) => t.status !== 'draft')[0]?.contractId?.jobId?.title ||
                          historyTrips.filter((t) => t.status !== 'draft')[0]?.jobId?.title ||
                          '—'}
                      </span>
                    </div>

                    <div className="print-row">
                      <span>Transport Type:</span>
                      <span>
                        {historyTrips
                          .filter((t) => t.status !== 'draft')[0]?.contractId?.transportType ===
                        'company_trip'
                          ? 'Company Trip'
                          : 'Malik Trip'}
                      </span>
                    </div>

                    <div className="print-row">
                      <span>Print Date:</span>
                      <span>
                        {new Date().toLocaleDateString('en-IN')}
                      </span>
                    </div>

                    <br />

                    {historyTrips
                      .filter((t) => t.status !== 'draft')
                      .map((trip, index) => (
                        <div
                          key={index}
                          style={{
                            marginBottom: '20px',
                            borderBottom: '2px solid #000',
                            paddingBottom: '16px',
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 'bold',
                              fontSize: '13px',
                              marginBottom: '8px',
                            }}
                          >
                            Trip {index + 1} —{' '}
                            {new Date(trip.tripDate).toLocaleDateString('en-IN')}
                          </div>

                          <div className="print-row">
                            <span>Driver:</span>
                            <span>{trip.driverId?.name}</span>
                          </div>

                          <div className="print-row">
                            <span>From:</span>
                            <span>{trip.fromLocation || '—'}</span>
                          </div>

                          <div className="print-row">
                            <span>To:</span>
                            <span>{trip.toLocation || '—'}</span>
                          </div>

                          <div className="print-row">
                            <span>Description:</span>
                            <span>{trip.description || '—'}</span>
                          </div>

                          <div className="print-row">
                            <span>Status:</span>
                            <span>
                              {trip.status === 'approved'
                                ? 'Approved ✓'
                                : trip.status === 'rejected'
                                  ? 'Rejected ✗'
                                  : trip.status === 'submitted'
                                    ? 'Review Pending'
                                    : trip.status}
                            </span>
                          </div>

                          {trip.transportType === 'malik_trip' &&
                            (trip.expenses?.length || 0) > 0 && (
                              <>
                                <div
                                  style={{
                                    fontWeight: 'bold',
                                    marginTop: '10px',
                                    marginBottom: '6px',
                                  }}
                                >
                                  Expenses:
                                </div>

                                <table className="print-table">
                                  <thead>
                                    <tr>
                                      <th>Category</th>
                                      <th>Amount</th>
                                      <th>Description</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(trip.expenses || []).map((exp, i) => (
                                      <tr key={i}>
                                        <td style={{ textTransform: 'capitalize' }}>
                                          {exp.category}
                                        </td>
                                        <td>₹{exp.amount}</td>
                                        <td>{exp.description || '—'}</td>
                                      </tr>
                                    ))}
                                    <tr
                                      style={{
                                        fontWeight: 'bold',
                                        borderTop: '2px solid #000',
                                      }}
                                    >
                                      <td>Total Expenses</td>
                                      <td>₹{trip.totalExpenses}</td>
                                      <td />
                                    </tr>
                                    <tr style={{ fontWeight: 'bold' }}>
                                      <td>Approved Amount</td>
                                      <td>₹{trip.approvedExpenses || 0}</td>
                                      <td />
                                    </tr>
                                  </tbody>
                                </table>
                              </>
                            )}

                          {trip.ownerNote && (
                            <div
                              className="print-row"
                              style={{ marginTop: '8px' }}
                            >
                              <span>Owner Note:</span>
                              <span>{trip.ownerNote}</span>
                            </div>
                          )}
                        </div>
                      ))}

                    {historyTrips.filter((t) => t.status !== 'draft').length ===
                      0 && (
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '20px',
                          color: '#666',
                        }}
                      >
                        Koi trip record nahi
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: '20px',
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
                          _______________
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
                          {user?.name}
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
                      Generated by DriverApp —{' '}
                      {new Date().toLocaleDateString('en-IN')}
                    </div>
                  </div>

                  {historyTrips.length === 0 ? (
                    <div className="py-8 text-center text-gray-400">Koi history nahi</div>
                  ) : (
                    historyTrips.map((t) => (
                      <div key={t._id} className="mb-3 rounded-2xl border border-gray-100 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {t.driverId?.name || 'Driver'} {t.driverId?.phone ? `· ${t.driverId.phone}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-gray-600">
                              {new Date(t.tripDate).toLocaleDateString('en-IN')} · {t.fromLocation || 'From'} → {t.toLocation || 'To'}
                            </p>
                            {t.description ? (
                              <p className="mt-1 text-xs text-gray-600">{t.description}</p>
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
                            {t.status === 'approved' ? 'Approved' : t.status === 'rejected' ? 'Rejected' : 'Partial Approve'}
                          </span>
                        </div>
                        {t.transportType === 'malik_trip' && (
                          <div className="mt-3 text-sm text-gray-700">
                            <div>Total Expenses: ₹{t.totalExpenses || 0}</div>
                            <div>Approved: ₹{t.approvedExpenses || 0}</div>
                          </div>
                        )}
                        {t.ownerNote ? (
                          <div className="mt-2 text-xs text-gray-600">Owner Note: {t.ownerNote}</div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
    </div>
  )
}

export default OwnerTrips

