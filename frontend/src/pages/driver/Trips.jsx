import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getUser } from '../../utils/helpers'
import { getDriverTrips, createTrip, addExpense, submitTrip, createRepairRequest } from '../../api/tripAPI'

const DriverTrips = () => {
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [contract, setContract] = useState(null)
  const [trips, setTrips] = useState([])
  const [tab, setTab] = useState('active')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [tripForm, setTripForm] = useState({
    tripDate: new Date().toISOString().split('T')[0],
    fromLocation: '',
    toLocation: '',
    description: '',
  })

  const [expenseForm, setExpenseForm] = useState({
    category: 'diesel',
    amount: '',
    description: '',
  })

  const [repairForm, setRepairForm] = useState({
    description: '',
    amount: '',
  })

  useEffect(() => {
    setUser(getUser())
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const res = await getDriverTrips()
      const c = res.data?.contract || null
      const list = res.data?.trips || []
      setContract(c)
      setTrips(list)
      if (!c) {
        toast.error('Aapka contract transport type ka nahi hai')
        navigate('/driver/attendance')
      }
    } catch (e) {
      setContract(null)
      setTrips([])
      toast.error(e.response?.data?.message || 'Trips load nahi hue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const initials =
    user?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'D'

  const activeDraftTrip = useMemo(() => {
    return (trips || []).find((t) => t.status === 'draft') || null
  }, [trips])

  const historyTrips = useMemo(() => {
    return (trips || []).filter((t) => t.status !== 'draft')
  }, [trips])

  const transportTypeLabel = contract?.transportType === 'company_trip' ? 'Company Trip' : 'Malik Trip'

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
            </div>
          ) : !contract ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-600">
              Aapka contract transport type ka nahi hai
            </div>
          ) : (
            <>
              <div className="mb-6 rounded-2xl bg-green-50 p-4">
                <p className="text-sm font-semibold text-green-900">
                  {contract?.jobId?.title || 'Job'} · {contract?.jobId?.vehicleType || 'Vehicle'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-green-900/80">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold">
                    {transportTypeLabel}
                  </span>
                  <span>₹{Number(contract?.salaryPerMonth) || 0}/month</span>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 border border-gray-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setTab('active')}
                  className={`rounded-xl py-3 text-sm font-semibold ${
                    tab === 'active' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  Active Trip
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setTab('history')}
                  className={`rounded-xl py-3 text-sm font-semibold ${
                    tab === 'history' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  History
                </button>
              </div>

              {tab === 'active' ? (
                <>
                  {!activeDraftTrip ? (
                    <div className="rounded-2xl border border-gray-100 bg-white p-6">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {}}
                        className="mb-4 w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Nayi Trip Shuru Karo
                      </button>

                      <div className="grid gap-3">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Trip Date</label>
                          <input
                            type="date"
                            value={tripForm.tripDate}
                            onChange={(e) => setTripForm((f) => ({ ...f, tripDate: e.target.value }))}
                            className="input-field w-full"
                          />
                        </div>
                        <input
                          value={tripForm.fromLocation}
                          onChange={(e) => setTripForm((f) => ({ ...f, fromLocation: e.target.value }))}
                          placeholder="Patna"
                          className="input-field w-full"
                        />
                        <input
                          value={tripForm.toLocation}
                          onChange={(e) => setTripForm((f) => ({ ...f, toLocation: e.target.value }))}
                          placeholder="Delhi"
                          className="input-field w-full"
                        />
                        <input
                          value={tripForm.description}
                          onChange={(e) => setTripForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Cement delivery"
                          className="input-field w-full"
                        />
                        <button
                          type="button"
                          disabled={saving}
                          onClick={async () => {
                            try {
                              setSaving(true)
                              await createTrip(tripForm)
                              toast.success('Trip start ho gaya!')
                              await load()
                            } catch (e) {
                              toast.error(e.response?.data?.message || 'Trip start nahi hui')
                            } finally {
                              setSaving(false)
                            }
                          }}
                          className="w-full rounded-xl bg-green-700 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {saving ? 'Save ho raha hai...' : 'Trip Shuru Karo'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-gray-100 bg-white p-5 mb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {new Date(activeDraftTrip.tripDate).toLocaleDateString('en-IN')} · {activeDraftTrip.fromLocation || 'From'} → {activeDraftTrip.toLocation || 'To'}
                            </p>
                            {activeDraftTrip.description ? (
                              <p className="mt-1 text-xs text-gray-600">{activeDraftTrip.description}</p>
                            ) : null}
                          </div>
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                            {activeDraftTrip.transportType === 'company_trip' ? 'Company Trip' : 'Malik Trip'}
                          </span>
                        </div>
                      </div>

                      {activeDraftTrip.transportType === 'malik_trip' ? (
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 mb-4">
                          <h2 className="text-lg font-semibold text-gray-800">Kharche Add Karo</h2>
                          <div className="mt-4 grid gap-3">
                            <select
                              value={expenseForm.category}
                              onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
                              className="input-field w-full"
                            >
                              <option value="diesel">Diesel</option>
                              <option value="toll">Toll</option>
                              <option value="police">Police</option>
                              <option value="khana">Khaana</option>
                              <option value="repair">Repair</option>
                              <option value="other">Other</option>
                            </select>
                            <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
                              <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-gray-600">₹</span>
                              <input
                                type="number"
                                min={0}
                                value={expenseForm.amount}
                                onChange={(e) => setExpenseForm((f) => ({ ...f, amount: e.target.value }))}
                                className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                              />
                            </div>
                            <input
                              value={expenseForm.description}
                              onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
                              placeholder="Description (optional)"
                              className="input-field w-full"
                            />
                            <button
                              type="button"
                              disabled={saving || !expenseForm.amount}
                              onClick={async () => {
                                try {
                                  setSaving(true)
                                  await addExpense({
                                    tripId: activeDraftTrip._id,
                                    category: expenseForm.category,
                                    amount: expenseForm.amount,
                                    description: expenseForm.description,
                                  })
                                  toast.success('Expense add ho gaya!')
                                  setExpenseForm((f) => ({ ...f, amount: '', description: '' }))
                                  await load()
                                } catch (e) {
                                  toast.error(e.response?.data?.message || 'Expense add nahi hua')
                                } finally {
                                  setSaving(false)
                                }
                              }}
                              className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {saving ? 'Save ho raha hai...' : 'Expense Add Karo'}
                            </button>
                          </div>

                          <div className="mt-4 space-y-2">
                            {(activeDraftTrip.expenses || []).map((ex, idx) => (
                              <div key={idx} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                                <span className="text-xs font-semibold text-gray-700">{ex.category}</span>
                                <span className="text-xs font-semibold text-gray-900">₹{ex.amount}</span>
                              </div>
                            ))}
                            <div className="text-sm font-semibold text-gray-800">
                              Total: ₹{activeDraftTrip.totalExpenses || 0}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-gray-100 bg-white p-6 mb-4">
                          <p className="text-sm text-gray-700">
                            Company trip mein expense tracking nahi hoti
                          </p>
                        </div>
                      )}

                      <div className="rounded-xl bg-red-50 p-4 mb-4">
                        <p className="text-sm font-semibold text-red-900">
                          Gadi Kharab Hui? Repair Request Karo
                        </p>
                        <div className="mt-3 grid gap-3">
                          <input
                            value={repairForm.description}
                            onChange={(e) => setRepairForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Kya kharab hua?"
                            className="input-field w-full"
                          />
                          <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-red-200 bg-white">
                            <span className="flex items-center border-r border-red-200 bg-red-50 px-3 text-red-700">₹</span>
                            <input
                              type="number"
                              min={0}
                              value={repairForm.amount}
                              onChange={(e) => setRepairForm((f) => ({ ...f, amount: e.target.value }))}
                              className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={saving || !repairForm.description || !repairForm.amount}
                            onClick={async () => {
                              try {
                                setSaving(true)
                                await createRepairRequest({
                                  description: repairForm.description,
                                  amount: repairForm.amount,
                                })
                                toast.success('Repair request bhej di!')
                                setRepairForm({ description: '', amount: '' })
                              } catch (e) {
                                toast.error(e.response?.data?.message || 'Repair request nahi hui')
                              } finally {
                                setSaving(false)
                              }
                            }}
                            className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {saving ? 'Save ho raha hai...' : 'Repair Request Bhejo'}
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={async () => {
                          try {
                            setSaving(true)
                            await submitTrip({ tripId: activeDraftTrip._id })
                            toast.success('Trip submit ho gayi! Owner verify karega.')
                            await load()
                          } catch (e) {
                            toast.error(e.response?.data?.message || 'Submit nahi hua')
                          } finally {
                            setSaving(false)
                          }
                        }}
                        className="w-full rounded-xl bg-green-700 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {saving ? 'Save ho raha hai...' : 'Trip Complete — Submit Karo'}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-print w-full py-3 bg-gray-700 text-white rounded-xl text-sm mt-4"
                  >
                    Trip History PDF Download
                  </button>

                  <div className="print-area" style={{ display: 'none' }}>
                    <div className="print-heading">TRIP HISTORY RECORD</div>

                    <div className="print-row">
                      <span>Driver:</span>
                      <span>{user?.name}</span>
                    </div>

                    <div className="print-row">
                      <span>Vehicle Type:</span>
                      <span>{contract?.jobId?.vehicleType}</span>
                    </div>

                    <div className="print-row">
                      <span>Job:</span>
                      <span>{contract?.jobId?.title}</span>
                    </div>

                    <div className="print-row">
                      <span>Transport Type:</span>
                      <span>
                        {contract?.transportType === 'company_trip'
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

                    {(trips || [])
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
                                    {trip.expenses.map((exp, i) => (
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

                    {(trips || []).filter((t) => t.status !== 'draft').length ===
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
                        borderTop: '1px solid #eee',
                        paddingTop: '8px',
                      }}
                    >
                      Generated by DriverApp —{' '}
                      {new Date().toLocaleDateString('en-IN')}
                    </div>
                  </div>

                  {historyTrips.length === 0 ? (
                    <div className="py-8 text-center text-gray-400">Koi trip history nahi</div>
                  ) : (
                    historyTrips.map((t) => (
                      <div key={t._id} className="mb-3 rounded-2xl border border-gray-100 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {new Date(t.tripDate).toLocaleDateString('en-IN')} · {t.fromLocation || 'From'} → {t.toLocation || 'To'}
                            </p>
                            {t.description ? (
                              <p className="mt-1 text-xs text-gray-600">{t.description}</p>
                            ) : null}
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                              t.status === 'submitted'
                                ? 'bg-yellow-100 text-yellow-700'
                                : t.status === 'approved'
                                  ? 'bg-green-100 text-green-700'
                                  : t.status === 'rejected'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {t.status === 'submitted'
                              ? 'Review Pending'
                              : t.status === 'approved'
                                ? 'Approved'
                                : t.status === 'rejected'
                                  ? 'Rejected'
                                  : 'Partial Approve'}
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

export default DriverTrips

