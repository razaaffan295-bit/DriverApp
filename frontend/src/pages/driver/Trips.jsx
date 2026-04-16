import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getUser } from '../../utils/helpers'
import API from '../../api/axios'
import {
  getDriverTrips,
  createTrip,
  completeTrip,
} from '../../api/tripAPI'

const ACTIVE = ['draft', 'active']

const expenseLabel = (ex) =>
  ex.type || ex.category || 'other'

const fmtMoney = (n) =>
  `₹${Number.isFinite(Number(n)) ? Number(n) : 0}`

const fmtWhen = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

const DriverTrips = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [contract, setContract] = useState(null)
  const [trips, setTrips] = useState([])
  const [tab, setTab] = useState('active')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [printTrip, setPrintTrip] = useState(null)

  const [tripForm, setTripForm] = useState({
    tripDate: new Date().toISOString().split('T')[0],
    fromLocation: '',
    toLocation: '',
    cargo: '',
    description: '',
  })

  const [expenseForm, setExpenseForm] = useState({
    type: 'diesel',
    amount: '',
    note: '',
  })

  const [expenseImage, setExpenseImage] = useState(null)

  const [repairForm, setRepairForm] = useState({
    description: '',
    amount: '',
  })

  const [repairImage, setRepairImage] = useState(null)

  useEffect(() => {
    setUser(getUser())
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getDriverTrips()
      const c = res.data?.contract || null
      const list = res.data?.trips || []
      setContract(c)
      setTrips(list)
      if (!c) {
        toast.error(t('notTransportContract'))
        navigate('/driver/attendance')
      }
    } catch (e) {
      setContract(null)
      setTrips([])
      toast.error(e.response?.data?.message || 'Trips load nahi hue')
    } finally {
      setLoading(false)
    }
  }, [navigate, t])

  useEffect(() => {
    load()
  }, [load])

  const activeTrip = useMemo(
    () => (trips || []).find((t) => ACTIVE.includes(t.status)) || null,
    [trips]
  )

  const historyTrips = useMemo(
    () =>
      (trips || []).filter((t) => !ACTIVE.includes(t.status)),
    [trips]
  )

  const transportTypeLabel =
    contract?.transportType === 'company_trip'
      ? t('companyTrip')
      : t('malikTrip')

  const tripFrom = (t) => t.fromLocation || t.from || ''
  const tripTo = (t) => t.toLocation || t.to || ''
  const tripCargo = (t) => t.cargo || t.description || ''

  const grandTotal = (t) =>
    (Number(t.totalExpenses) || 0) + (Number(t.totalRepairs) || 0)

  const handleAddExpense = async () => {
    if (!activeTrip?._id) return
    try {
      setSaving(true)
      const formData = new FormData()
      formData.append('tripId', activeTrip._id)
      formData.append('type', expenseForm.type)
      formData.append('amount', expenseForm.amount)
      formData.append('note', expenseForm.note || '')
      if (expenseImage) {
        formData.append('image', expenseImage)
      }

      await API.post(
        '/api/trips/add-expense',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      toast.success(t('expenseAdded'))
      setExpenseForm((f) => ({
        ...f,
        amount: '',
        note: '',
      }))
      setExpenseImage(null)
      await load()
    } catch (err) {
      toast.error(
        err.response?.data?.message || t('expenseError')
      )
    } finally {
      setSaving(false)
    }
  }

  const handleAddRepair = async () => {
    if (!activeTrip?._id) return
    try {
      setSaving(true)
      const formData = new FormData()
      formData.append('tripId', activeTrip._id)
      formData.append('description', repairForm.description)
      formData.append('amount', repairForm.amount)
      if (repairImage) {
        formData.append('image', repairImage)
      }

      await API.post(
        '/api/trips/add-repair',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )
      toast.success(t('repairAdded'))
      setRepairForm({
        description: '',
        amount: '',
      })
      setRepairImage(null)
      await load()
    } catch (err) {
      toast.error(
        err.response?.data?.message || t('repairError')
      )
    } finally {
      setSaving(false)
    }
  }

  const handleTripReceipt = useCallback((trip) => {
    setPrintTrip(trip)
    setTimeout(() => {
      window.print()
    }, 300)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#F0FDF4' }}>
      <div className="mx-auto max-w-3xl px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
          </div>
        ) : !contract ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-600">
            {t('notTransportContract')}
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-2xl bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-900">
                {contract?.jobId?.title || 'Job'} ·{' '}
                {contract?.jobId?.vehicleType || 'Vehicle'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-green-900/80">
                <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold">
                  {transportTypeLabel}
                </span>
                <span>
                  ₹{Number(contract?.salaryPerMonth) || 0}/
                  {t('perMonth')}
                </span>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-gray-100 bg-white p-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setTab('active')}
                className={`rounded-xl py-3 text-sm font-semibold ${
                  tab === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {t('activeTrip')}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setTab('history')}
                className={`rounded-xl py-3 text-sm font-semibold ${
                  tab === 'history'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {t('tripHistory')}
              </button>
            </div>

            {tab === 'active' ? (
              <>
                {!activeTrip ? (
                  <div className="rounded-2xl border border-gray-100 bg-white p-6">
                    <p className="mb-4 text-center text-sm text-gray-600">
                      {t('noActiveTrip')}
                    </p>
                    <h2 className="mb-3 text-lg font-semibold text-gray-900">
                      {t('startNewTrip')}
                    </h2>
                    <div className="grid gap-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          {t('tripDate')}
                        </label>
                        <input
                          type="date"
                          value={tripForm.tripDate}
                          onChange={(e) =>
                            setTripForm((f) => ({
                              ...f,
                              tripDate: e.target.value,
                            }))
                          }
                          className="input-field w-full"
                        />
                      </div>
                      <input
                        value={tripForm.fromLocation}
                        onChange={(e) =>
                          setTripForm((f) => ({
                            ...f,
                            fromLocation: e.target.value,
                          }))
                        }
                        placeholder={`${t('from')} (e.g. Patna)`}
                        className="input-field w-full"
                      />
                      <input
                        value={tripForm.toLocation}
                        onChange={(e) =>
                          setTripForm((f) => ({
                            ...f,
                            toLocation: e.target.value,
                          }))
                        }
                        placeholder={`${t('to')} (e.g. Delhi)`}
                        className="input-field w-full"
                      />
                      <input
                        value={tripForm.cargo}
                        onChange={(e) =>
                          setTripForm((f) => ({
                            ...f,
                            cargo: e.target.value,
                          }))
                        }
                        placeholder={`${t('cargo')} / load`}
                        className="input-field w-full"
                      />
                      <input
                        value={tripForm.description}
                        onChange={(e) =>
                          setTripForm((f) => ({
                            ...f,
                            description: e.target.value,
                          }))
                        }
                        placeholder={t('noteOptional')}
                        className="input-field w-full"
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={async () => {
                          try {
                            setSaving(true)
                            await createTrip({
                              tripDate: tripForm.tripDate,
                              fromLocation: tripForm.fromLocation,
                              toLocation: tripForm.toLocation,
                              cargo: tripForm.cargo,
                              description:
                                tripForm.description ||
                                tripForm.cargo,
                            })
                            toast.success(t('tripStarted'))
                            await load()
                          } catch (e) {
                            toast.error(
                              e.response?.data?.message ||
                                t('tripStartError')
                            )
                          } finally {
                            setSaving(false)
                          }
                        }}
                        className="w-full rounded-xl bg-green-700 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {saving
                          ? t('loading')
                          : t('startTrip')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {tripFrom(activeTrip) || t('from')} →{' '}
                            {tripTo(activeTrip) || t('to')}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
                            {new Date(
                              activeTrip.tripDate
                            ).toLocaleDateString('en-IN')}
                          </p>
                          {tripCargo(activeTrip) ? (
                            <p className="mt-1 text-xs text-gray-600">
                              {t('cargo')}: {tripCargo(activeTrip)}
                            </p>
                          ) : null}
                        </div>
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                          {activeTrip.transportType ===
                          'company_trip'
                            ? t('companyTrip')
                            : t('malikTrip')}
                        </span>
                      </div>
                    </div>

                    {activeTrip.transportType === 'malik_trip' ? (
                      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-6">
                        <h2 className="text-lg font-semibold text-gray-800">
                          {t('addExpenseTitle')}
                        </h2>
                        <div className="mt-4 grid gap-3">
                          <select
                            value={expenseForm.type}
                            onChange={(e) =>
                              setExpenseForm((f) => ({
                                ...f,
                                type: e.target.value,
                              }))
                            }
                            className="input-field w-full"
                          >
                            <option value="diesel">{t('diesel')}</option>
                            <option value="toll">{t('toll')}</option>
                            <option value="police">{t('police')}</option>
                            <option value="khana">{t('food')}</option>
                            <option value="repair">{t('repair')}</option>
                            <option value="other">{t('other')}</option>
                          </select>
                          <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
                            <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-gray-600">
                              ₹
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={expenseForm.amount}
                              onChange={(e) =>
                                setExpenseForm((f) => ({
                                  ...f,
                                  amount: e.target.value,
                                }))
                              }
                              className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                            />
                          </div>
                          <input
                            value={expenseForm.note}
                            onChange={(e) =>
                              setExpenseForm((f) => ({
                                ...f,
                                note: e.target.value,
                              }))
                            }
                            placeholder={t('noteOptional')}
                            className="input-field w-full"
                          />
                          <div style={{ marginTop: '8px' }}>
                            <label
                              style={{
                                fontSize: '13px',
                                color: '#374151',
                                fontWeight: '500',
                              }}
                            >
                              {t('photo')} (optional)
                            </label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                setExpenseImage(
                                  e.target.files?.[0] || null
                                )
                                e.target.value = ''
                              }}
                              style={{
                                display: 'block',
                                marginTop: '4px',
                                fontSize: '13px',
                              }}
                            />
                            {expenseImage ? (
                              <p
                                style={{
                                  fontSize: '12px',
                                  color: '#16A34A',
                                  marginTop: '4px',
                                }}
                              >
                                ✅ {expenseImage.name}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            disabled={
                              saving || !expenseForm.amount
                            }
                            onClick={() => void handleAddExpense()}
                            className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {t('addExpense')}
                          </button>
                        </div>

                        <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                          <p className="text-sm font-semibold text-gray-800">
                            {t('expenseList')}
                          </p>
                          {(activeTrip.expenses || []).length ===
                          0 ? (
                            <p className="text-xs text-gray-500">
                              {t('noExpenseYet')}
                            </p>
                          ) : (
                            (activeTrip.expenses || []).map(
                              (ex, idx) => (
                                <div
                                  key={idx}
                                  className="rounded-xl bg-gray-50 p-3 text-sm"
                                >
                                  <div className="flex justify-between gap-2">
                                    <span className="font-semibold capitalize text-gray-800">
                                      {expenseLabel(ex)}
                                    </span>
                                    <span className="font-semibold">
                                      {fmtMoney(ex.amount)}
                                    </span>
                                  </div>
                                  {ex.note || ex.description ? (
                                    <p className="mt-1 text-xs text-gray-600">
                                      {ex.note || ex.description}
                                    </p>
                                  ) : null}
                                  <p className="mt-1 text-[10px] text-gray-400">
                                    {fmtWhen(ex.addedAt)}
                                  </p>
                                  {(ex.image || ex.photo) && (
                                    <img
                                      src={ex.image || ex.photo}
                                      alt=""
                                      className="mt-2 max-h-32 rounded-lg object-contain"
                                    />
                                  )}
                                </div>
                              )
                            )
                          )}
                          <p className="text-sm font-bold text-gray-900">
                          {t('totalExpenses')}:{' '}
                          {fmtMoney(activeTrip.totalExpenses)}
                        </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-6">
                        <p className="text-sm text-gray-700">
                          {t('companyTripNoExpense')}
                        </p>
                      </div>
                    )}

                    <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 p-6">
                      <h2 className="text-lg font-semibold text-amber-900">
                        {t('repairRecordTitle')}
                      </h2>
                      <p className="mt-1 text-xs text-amber-800">
                        {t('repairRecordNote')}
                      </p>
                      <div className="mt-4 grid gap-3">
                        <input
                          value={repairForm.description}
                          onChange={(e) =>
                            setRepairForm((f) => ({
                              ...f,
                              description: e.target.value,
                            }))
                          }
                          placeholder={t('whatRepair')}
                          className="input-field w-full"
                        />
                        <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-amber-200 bg-white">
                          <span className="flex items-center border-r border-amber-200 bg-amber-100 px-3 text-amber-800">
                            ₹
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={repairForm.amount}
                            onChange={(e) =>
                              setRepairForm((f) => ({
                                ...f,
                                amount: e.target.value,
                              }))
                            }
                            className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                          />
                        </div>
                        <div style={{ marginTop: '8px' }}>
                          <label
                            style={{
                              fontSize: '13px',
                              color: '#374151',
                              fontWeight: '500',
                            }}
                          >
                            {t('photo')} (optional)
                          </label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              setRepairImage(
                                e.target.files?.[0] || null
                              )
                              e.target.value = ''
                            }}
                            style={{
                              display: 'block',
                              marginTop: '4px',
                              fontSize: '13px',
                            }}
                          />
                          {repairImage ? (
                            <p
                              style={{
                                fontSize: '12px',
                                color: '#16A34A',
                                marginTop: '4px',
                              }}
                            >
                              ✅ {repairImage.name}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          disabled={
                            saving ||
                            !repairForm.description ||
                            !repairForm.amount
                          }
                          onClick={() => void handleAddRepair()}
                          className="w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {t('addRepair')}
                        </button>
                      </div>
                      <div className="mt-4 space-y-2">
                        {(activeTrip.repairs || []).map((r, i) => (
                          <div
                            key={i}
                            className="rounded-xl bg-white/80 p-3 text-sm"
                          >
                            <div className="flex justify-between gap-2">
                              <span className="text-gray-800">
                                {r.description}
                              </span>
                              <span className="font-semibold">
                                {fmtMoney(r.amount)}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400">
                              {fmtWhen(r.addedAt)}
                            </p>
                            {r.image ? (
                              <img
                                src={r.image}
                                alt=""
                                className="mt-2 max-h-32 rounded-lg"
                              />
                            ) : null}
                          </div>
                        ))}
                        <p className="text-sm font-bold text-amber-900">
                          {t('totalRepairs')}:{' '}
                          {fmtMoney(activeTrip.totalRepairs)}
                        </p>
                      </div>
                    </div>

                    <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 p-4">
                      <p className="text-sm text-green-900">
                        {t('totalExpenses')}:{' '}
                        <strong>
                          {fmtMoney(activeTrip.totalExpenses)}
                        </strong>
                      </p>
                      <p className="text-sm text-green-900">
                        {t('totalRepairs')}:{' '}
                        <strong>
                          {fmtMoney(activeTrip.totalRepairs)}
                        </strong>
                      </p>
                      <p className="mt-2 text-base font-bold text-green-950">
                        {t('grandTotal')}: {fmtMoney(grandTotal(activeTrip))}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        if (
                          !window.confirm(
                            t('submitTripConfirm')
                          )
                        ) {
                          return
                        }
                        try {
                          setSaving(true)
                          await completeTrip({
                            tripId: activeTrip._id,
                          })
                          toast.success(
                            t('tripSubmitted')
                          )
                          await load()
                        } catch (e) {
                          toast.error(
                            e.response?.data?.message ||
                              'Submit nahi hua'
                          )
                        } finally {
                          setSaving(false)
                        }
                      }}
                      className="w-full rounded-xl bg-green-800 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {t('completeTrip')}
                    </button>
                  </>
                )}
              </>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print mb-4 w-full rounded-xl bg-gray-700 py-3 text-sm text-white"
                >
                  {t('tripHistoryPrint')}
                </button>

                {historyTrips.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    {t('noTrips')}
                  </div>
                ) : (
                  historyTrips.map((tr) => {
                    const open = expandedId === tr._id
                    return (
                      <div
                        key={tr._id}
                        className="mb-3 rounded-2xl border border-gray-100 bg-white p-4"
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() =>
                            setExpandedId(open ? null : tr._id)
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {tripFrom(tr) || t('from')} →{' '}
                                {tripTo(tr) || t('to')}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {new Date(
                                  tr.tripDate
                                ).toLocaleDateString('en-IN')}{' '}
                                ·{' '}
                                {tr.submittedAt
                                  ? `${t('submitLabel')}: ${new Date(
                                      tr.submittedAt
                                    ).toLocaleDateString('en-IN')}`
                                  : ''}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                tr.status === 'submitted'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : tr.status === 'approved'
                                    ? 'bg-green-100 text-green-700'
                                    : tr.status === 'rejected'
                                      ? 'bg-red-100 text-red-700'
                                      : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {tr.status === 'submitted'
                                ? t('pending')
                                : tr.status === 'approved'
                                  ? t('approved')
                                  : tr.status === 'rejected'
                                    ? t('rejected')
                                    : tr.status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-700">
                            {fmtMoney(tr.totalExpenses)} expenses ·{' '}
                            {fmtMoney(tr.totalRepairs)} repairs · {t('grandTotal')}{' '}
                            {fmtMoney(grandTotal(tr))}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t('approved')}:{' '}
                            {fmtMoney(
                              tr.approvedAmount ??
                                tr.approvedExpenses ??
                                0
                            )}
                          </p>
                          {tr.ownerNote ? (
                            <p className="mt-1 text-xs text-gray-600">
                              Owner: {tr.ownerNote}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs font-medium text-green-700">
                            {open
                              ? t('hideDetails')
                              : t('showDetails')}
                          </p>
                        </button>
                        {open && (
                          <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
                            {tripCargo(tr) ? (
                              <p className="mb-2 text-gray-700">
                                {t('cargo')}: {tripCargo(tr)}
                              </p>
                            ) : null}
                            <p className="font-semibold text-gray-800">
                              {t('expensesTitle')}
                            </p>
                            <ul className="mt-1 space-y-2">
                              {(tr.expenses || []).map((ex, i) => (
                                <li
                                  key={i}
                                  className="rounded-lg bg-gray-50 p-2 text-xs"
                                >
                                  <span className="capitalize">
                                    {expenseLabel(ex)}
                                  </span>{' '}
                                  — {fmtMoney(ex.amount)}
                                  {ex.note || ex.description
                                    ? ` · ${ex.note || ex.description}`
                                    : ''}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-3 font-semibold text-gray-800">
                              {t('repairsTitle')}
                            </p>
                            <ul className="mt-1 space-y-2">
                              {(tr.repairs || []).map((r, i) => (
                                <li
                                  key={i}
                                  className="rounded-lg bg-amber-50 p-2 text-xs"
                                >
                                  {r.description} —{' '}
                                  {fmtMoney(r.amount)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleTripReceipt(tr)
                          }}
                          className="no-print mt-3 w-full rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-700"
                        >
                          {t('downloadPDF')}
                        </button>
                      </div>
                    )
                  })
                )}

                <div className="print-area hidden">
                  <div className="print-heading">
                    {t('tripHistory').toUpperCase()}
                  </div>
                  <div className="print-row">
                    <span>{t('driver')}</span>
                    <span>{user?.name}</span>
                  </div>
                  {historyTrips.map((trip, index) => (
                    <div key={trip._id} className="mt-4 border-b pb-4">
                      <strong>
                        {t('trip')} {index + 1} —{' '}
                        {new Date(trip.tripDate).toLocaleDateString(
                          'en-IN'
                        )}
                      </strong>
              <div className="print-row">
                <span>{t('route')}</span>
                <span>
                  {tripFrom(trip)} → {tripTo(trip)}
                </span>
              </div>
              <div className="print-row">
                <span>{t('status')}</span>
                <span>{trip.status}</span>
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
              <div className="print-row">
                <span>{t('driver')}:</span>
                <span>
                  {user?.name || printTrip.driverId?.name || '—'}{' '}
                  {printTrip.driverId?.phone || ''}
                </span>
              </div>
              <div className="print-row">
                <span>{t('owner')}:</span>
                <span>{printTrip.ownerId?.name || '—'}</span>
              </div>
              <h3 style={{ marginTop: '16px' }}>
                {t('expensesTitle')}
              </h3>
              {(printTrip.expenses || []).map((e, i) => (
                <div key={i} className="print-row">
                  <span>
                    {expenseLabel(e)} —{' '}
                    {e.note || e.description || '—'}
                  </span>
                  <span>₹{e.amount}</span>
                </div>
              ))}
              <h3 style={{ marginTop: '16px' }}>
                {t('repairsTitle')}
              </h3>
              {(printTrip.repairs || []).map((r, i) => (
                <div key={i} className="print-row">
                  <span>{r.description || '—'}</span>
                  <span>₹{r.amount}</span>
                </div>
              ))}
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
                <strong>₹{grandTotal(printTrip)}</strong>
              </div>
              <div className="print-row">
                <strong>{t('approvedAmount')}:</strong>
                <strong>
                  ₹
                  {printTrip.approvedAmount ??
                    printTrip.approvedExpenses ??
                    0}
                </strong>
              </div>
              {printTrip.ownerNote ? (
                <div className="print-row">
                  <span>{t('ownerNote')}:</span>
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
                <div>
                  {t('ownerSignature')}: ____________
                </div>
                <div>
                  {t('driverSignature')}: ____________
                </div>
              </div>
              <div
                style={{
                  textAlign: 'center',
                  marginTop: '20px',
                  fontSize: '11px',
                  color: '#666',
                }}
              >
                {t('generatedBy')} —{' '}
                {new Date().toLocaleDateString('en-IN')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DriverTrips
