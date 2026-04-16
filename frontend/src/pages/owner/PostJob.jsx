import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { STATES, VEHICLE_TYPES } from '../../utils/constants'
import { getVehicles, createJob } from '../../api/ownerAPI'
import { checkSubscription } from '../../api/subscriptionAPI'

const PostJob = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)

  const [form, setForm] = useState({
    vehicleType: '',
    title: '',
    description: '',
    vehicleCategory: 'mining',
    salaryType: 'monthly',
    salaryPerDay: '',
    salaryPerMonth: '',
    salaryPerHour: '',
    dailyBhatta: '',
    hasBhatta: false,
    hasHourlyBonus: false,
    transportType: 'none',
    duration: '',
    startDate: '',
    vehicleId: '',
    location: {
      state: '',
      district: '',
      city: '',
      address: '',
    },
  })

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    toast('Subscription required — setup pending', { icon: '⚠️' })
  }, [])

  const loadVehicles = useCallback(async () => {
    setVehiclesLoading(true)
    try {
      const { data } = await getVehicles()
      setVehicles(data?.vehicles ?? [])
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('vehiclesLoadError')
      )
    } finally {
      setVehiclesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.vehicleType || !form.vehicleId) {
      toast.error(t('vehicleRequired'))
      return
    }
    try {
      const subRes = await checkSubscription()
      if (!subRes.data?.isActive) {
        navigate('/subscription')
        return
      }
    } catch {
      navigate('/subscription')
      return
    }
    setSubmitLoading(true)
    try {
      await createJob({
        vehicleType: form.vehicleType,
        title: form.title.trim(),
        description: form.description.trim(),
        location: {
          state: form.location?.state || '',
          district: (form.location?.district || '').trim(),
          city: (form.location?.city || '').trim(),
          address: (form.location?.address || '').trim(),
        },
        vehicleCategory: form.vehicleCategory,
        salaryType: form.salaryType,
        salaryPerDay: Number(form.salaryPerDay),
        salaryPerMonth: Number(form.salaryPerMonth),
        salaryPerHour: Number(form.salaryPerHour),
        dailyBhatta: Number(form.dailyBhatta) || 0,
        hasBhatta: form.hasBhatta || false,
        hasHourlyBonus: form.hasHourlyBonus || false,
        transportType: form.transportType,
        duration: Number(form.duration),
        startDate: form.startDate,
        vehicleId: form.vehicleId,
      })
      toast.success(t('jobPosted'))
      navigate('/owner/jobs')
    } catch (err) {
      toast.error(
        err.response?.data?.message || t('jobPostError')
      )
    } finally {
      setSubmitLoading(false)
    }
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
        <div className="p-4 md:p-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
              {vehiclesLoading ? (
                <p className="text-sm text-gray-500">{t('loading')}</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('vehicleType')}
                      </label>
                      <select
                        required
                        value={form.vehicleType}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            vehicleType: e.target.value,
                          }))
                        }
                        className="input-field w-full"
                      >
                        <option value="">{t('vehicleTypeSelect')}</option>
                        {VEHICLE_TYPES.map((vtType) => (
                          <option key={vtType} value={vtType}>
                            {vtType}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('jobTitle')}
                      </label>
                      <input
                        type="text"
                        required
                        value={form.title}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, title: e.target.value }))
                        }
                        placeholder={t('jobTitlePlaceholder')}
                        className="input-field w-full"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('workCategory')}
                      </label>
                      <select
                        required
                        value={form.vehicleCategory}
                        onChange={(e) => {
                          const vc = e.target.value
                          setForm((f) => ({
                            ...f,
                            vehicleCategory: vc,
                            salaryType: vc === 'transport' ? 'monthly' : 'monthly',
                            salaryPerDay: '',
                            salaryPerMonth: '',
                            salaryPerHour: '',
                            dailyBhatta: '',
                            hasBhatta: false,
                            hasHourlyBonus: false,
                            transportType: vc === 'transport' ? 'company_trip' : 'none',
                          }))
                        }}
                        className="input-field w-full"
                      >
                        <option value="mining">
                          {t('miningCategory')}
                        </option>
                        <option value="road">
                          {t('roadCategory')}
                        </option>
                        <option value="transport">
                          {t('transportCategory')}
                        </option>
                      </select>
                    </div>
                    <div>
                      {form.vehicleCategory !== 'transport' ? (
                        <>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            {t('salaryTypeLabel')}
                          </label>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  salaryType: 'monthly',
                                  salaryPerDay: '',
                                  salaryPerHour: '',
                                  dailyBhatta: '',
                                  hasBhatta: false,
                                  hasHourlyBonus: false,
                                }))
                              }
                              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                                form.salaryType === 'monthly'
                                  ? 'border-blue-700 bg-blue-700 text-white'
                                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              ○ {t('monthly')}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  salaryType: 'daily',
                                  salaryPerMonth: '',
                                  salaryPerHour: '',
                                  dailyBhatta: '',
                                  hasBhatta: false,
                                  hasHourlyBonus: false,
                                }))
                              }
                              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                                form.salaryType === 'daily'
                                  ? 'border-blue-700 bg-blue-700 text-white'
                                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              ○ {t('daily')}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  salaryType: 'hourly',
                                  salaryPerDay: '',
                                  salaryPerMonth: '',
                                  dailyBhatta: '',
                                  hasBhatta: false,
                                  hasHourlyBonus: false,
                                }))
                              }
                              className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                                form.salaryType === 'hourly'
                                  ? 'border-blue-700 bg-blue-700 text-white'
                                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              ○ {t('hourly')}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            {t('salaryTypeLabel')}
                          </label>
                          <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm font-semibold text-gray-700">
                            {t('monthly')}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('description')}
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      placeholder={t('descriptionPlaceholder')}
                      className="input-field w-full resize-y"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      {form.vehicleCategory === 'transport' ? (
                        <>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            {t('salaryPerMonth')}
                          </label>
                          <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
                            <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-gray-600">
                              ₹
                            </span>
                            <input
                              type="number"
                              required
                              min={0}
                              value={form.salaryPerMonth}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, salaryPerMonth: e.target.value }))
                              }
                              placeholder="25000"
                              className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                            />
                          </div>
                        </>
                      ) : form.salaryType === 'monthly' ? (
                        <>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            {t('salaryPerMonth')}
                          </label>
                          <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
                            <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-gray-600">
                              ₹
                            </span>
                            <input
                              type="number"
                              required
                              min={0}
                              value={form.salaryPerMonth}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, salaryPerMonth: e.target.value }))
                              }
                              placeholder="25000"
                              className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                            />
                          </div>
                        </>
                      ) : form.salaryType === 'daily' ? (
                        <>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            {t('salaryPerDay')}
                          </label>
                          <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
                            <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-gray-600">
                              ₹
                            </span>
                            <input
                              type="number"
                              required
                              min={0}
                              value={form.salaryPerDay}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, salaryPerDay: e.target.value }))
                              }
                              placeholder="800"
                              className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            {t('salaryPerHour')}
                          </label>
                          <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
                            <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-gray-600">
                              ₹
                            </span>
                            <input
                              type="number"
                              required
                              min={0}
                              value={form.salaryPerHour}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, salaryPerHour: e.target.value }))
                              }
                              placeholder="100"
                              className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                            />
                          </div>
                        </>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('durationLabel4')}
                      </label>
                      <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
                        <input
                          type="number"
                          required
                          min={1}
                          value={form.duration}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              duration: e.target.value,
                            }))
                          }
                          placeholder="30"
                          className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                        />
                        <span className="flex items-center border-l border-gray-200 bg-gray-50 px-3 text-sm text-gray-600">
                          {t('perDayUnit')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(form.vehicleCategory === 'mining' || form.vehicleCategory === 'road') &&
                    (form.salaryType === 'monthly' || form.salaryType === 'daily') && (
                      <>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                {t('dailyBhattaQuestion')}
                              </p>
                              <p className="mt-1 text-xs text-gray-600">
                                {t('bhattaNote')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  hasBhatta: !f.hasBhatta,
                                  dailyBhatta: !f.hasBhatta ? f.dailyBhatta : '',
                                }))
                              }
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                form.hasBhatta ? 'bg-blue-700' : 'bg-gray-300'
                              }`}
                              aria-pressed={form.hasBhatta}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                  form.hasBhatta ? 'translate-x-5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>

                          {form.hasBhatta && (
                            <div className="mt-3">
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                {t('bhatta')}
                              </label>
                              <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
                                <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-gray-600">
                                  ₹
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={form.dailyBhatta}
                                  onChange={(e) =>
                                    setForm((f) => ({ ...f, dailyBhatta: e.target.value }))
                                  }
                                  placeholder="200"
                                  className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                {t('hourlyBonusQuestion')}
                              </p>
                              <p className="mt-1 text-xs text-gray-600">
                                {t('hourlyBonusNote')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  hasHourlyBonus: !f.hasHourlyBonus,
                                  salaryPerHour: !f.hasHourlyBonus ? f.salaryPerHour : '',
                                }))
                              }
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                form.hasHourlyBonus ? 'bg-blue-700' : 'bg-gray-300'
                              }`}
                              aria-pressed={form.hasHourlyBonus}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                  form.hasHourlyBonus ? 'translate-x-5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>

                          {form.hasHourlyBonus && (
                            <div className="mt-3">
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                {t('salaryPerHour')}
                              </label>
                              <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
                                <span className="flex items-center border-r border-gray-200 bg-gray-50 px-3 text-gray-600">
                                  ₹
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={form.salaryPerHour}
                                  onChange={(e) =>
                                    setForm((f) => ({ ...f, salaryPerHour: e.target.value }))
                                  }
                                  placeholder="50"
                                  className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                  {form.vehicleCategory === 'transport' && (
                    <div className="rounded-2xl border border-gray-100 bg-white p-4">
                      <p className="text-sm font-semibold text-gray-800">{t('tripTypeLabel2')}</p>
                      <div className="mt-3 grid gap-2">
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, transportType: 'company_trip' }))}
                          className={`rounded-xl border p-4 text-left ${
                            form.transportType === 'company_trip'
                              ? 'border-blue-700 bg-blue-50'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-800">{t('companyTripTitle')}</p>
                          <p className="mt-1 text-xs text-gray-600">
                            {t('companyTripDesc')}
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, transportType: 'malik_trip' }))}
                          className={`rounded-xl border p-4 text-left ${
                            form.transportType === 'malik_trip'
                              ? 'border-blue-700 bg-blue-50'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-800">{t('malikTripTitle')}</p>
                          <p className="mt-1 text-xs text-gray-600">
                            {t('malikTripDesc')}
                          </p>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('startDateLabel2')}
                      </label>
                      <input
                        type="date"
                        required
                        min={today}
                        value={form.startDate}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            startDate: e.target.value,
                          }))
                        }
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('vehicleLabel3')}
                      </label>
                      <select
                        required
                        value={form.vehicleId}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            vehicleId: e.target.value,
                          }))
                        }
                        className="input-field w-full"
                      >
                        <option value="">{t('vehicleSelect')}</option>
                        {vehicles.map((v) => (
                          <option key={v._id} value={v._id}>
                            {v.vehicleType} — {v.vehicleNumber || v.vehicleModel || v._id}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('stateLabel')}
                      </label>
                      <select
                        required
                        value={form.location?.state || ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            location: {
                              ...(prev.location || {}),
                              state: e.target.value,
                            },
                          }))
                        }
                        className="input-field w-full"
                      >
                        <option value="">{t('stateSelect')}</option>
                        {STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('districtLabel')}
                      </label>
                      <input
                        type="text"
                        required
                        value={form.location?.district || ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            location: {
                              ...(f.location || {}),
                              district: e.target.value,
                            },
                          }))
                        }
                        className="input-field w-full"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('cityLabel')}
                      </label>
                      <input
                        type="text"
                        required
                        value={form.location?.city || ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            location: {
                              ...(f.location || {}),
                              city: e.target.value,
                            },
                          }))
                        }
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {t('addressLabel')}
                      </label>
                      <input
                        type="text"
                        required
                        value={form.location?.address || ''}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            location: {
                              ...(f.location || {}),
                              address: e.target.value,
                            },
                          }))
                        }
                        placeholder={t('addressPlaceholder')}
                        className="input-field w-full"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitLoading || vehicles.length === 0}
                    className="btn-primary min-h-[44px] disabled:opacity-60"
                  >
                    {submitLoading ? t('postingProgress') : t('postJobBtn')}
                  </button>
                  {vehicles.length === 0 && !vehiclesLoading && (
                    <p className="text-sm text-amber-700">
                      {t('addVehicleFirst')}
                    </p>
                  )}
                </form>
              )}
          </div>
        </div>
    </div>
  )
}

export default PostJob
