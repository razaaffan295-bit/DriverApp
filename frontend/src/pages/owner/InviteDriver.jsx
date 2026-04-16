import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import API from '../../api/axios'
import { getVehicles } from '../../api/ownerAPI'
import { getOwnerInvites, sendInvite } from '../../api/inviteAPI'

const InviteDriver = () => {
  const { t } = useTranslation()
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [checking, setChecking] = useState(false)
  const [driverFound, setDriverFound] = useState(null)
  const [driverNotFound, setDriverNotFound] = useState(false)
  const [vehicles, setVehicles] = useState([])
  const [sending, setSending] = useState(false)
  const [sentInvites, setSentInvites] = useState([])

  const [form, setForm] = useState({
    vehicleId: '',
    vehicleCategory: 'mining',
    salaryType: 'monthly',
    salaryPerDay: '',
    salaryPerMonth: '',
    salaryPerHour: '',
    hasBhatta: false,
    dailyBhatta: '',
    hasHourlyBonus: false,
    transportType: 'none',
    duration: '30',
    startDate: new Date().toISOString().split('T')[0],
    terms: '',
    safetyConditions: '',
    workLocation: '',
  })

  useEffect(() => {
    ;(async () => {
      try {
        const [vRes, iRes] = await Promise.all([getVehicles(), getOwnerInvites()])
        setVehicles(vRes.data?.vehicles || [])
        setSentInvites(iRes.data?.invites || [])
      } catch (e) {
        toast.error(e.response?.data?.message || t('loadInviteError'))
      }
    })()
  }, [])

  const initials =
    driverFound?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'D'

  const statusBadge = (status) => {
    if (status === 'pending') return 'bg-yellow-100 text-yellow-700'
    if (status === 'accepted') return 'bg-green-100 text-green-700'
    if (status === 'rejected') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-700'
  }

  const statusLabel = (status) => {
    if (status === 'pending') return `⏳ ${t('pending')}`
    if (status === 'accepted') return `✅ ${t('approved')}`
    if (status === 'rejected') return `❌ ${t('rejected')}`
    return status
  }

  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—'

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
        <div className="mx-auto max-w-2xl px-4 py-6">
          {step === 1 ? (
            <div className="bg-white rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-900">{t('addDriver')}</h2>
              <p className="mt-1 text-sm text-gray-600">
                {t('inviteDriverNote')}
              </p>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-900">
                {t('inviteInfoNote')}
              </div>

              <input
                type="tel"
                placeholder={t('phone')}
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                  setDriverNotFound(false)
                }}
                className="input-field w-full"
              />

              <button
                type="button"
                disabled={checking || phone.length !== 10}
                onClick={async () => {
                  try {
                    setChecking(true)
                    const res = await API.get(`/api/auth/check-phone?phone=${phone}`)
                    const driver = res.data?.driver
                    setDriverFound(driver)
                    setDriverNotFound(false)
                    setStep(2)
                    toast.success(`${driver.name} ${t('driverFoundToast')}`)
                  } catch (e) {
                    if (e.response?.status === 404) {
                      setDriverFound(null)
                      setDriverNotFound(true)
                      toast.error(t('driverNotFoundToast'))
                    } else {
                      toast.error(e.response?.data?.message || t('checkError'))
                    }
                  } finally {
                    setChecking(false)
                  }
                }}
                className="mt-4 bg-blue-700 text-white w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
              >
                {checking ? t('loading') : t('search')}
              </button>

              {driverNotFound ? (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-red-900">{t('driverNotFoundMsg')}</p>
                  <p className="mt-1 text-sm text-red-800">
                    {t('driverNotFoundNote')}
                  </p>
                  <div className="mt-3 text-sm text-red-900 space-y-1">
                    <div>
                      {t('driverNotFoundSteps')
                        .split('\n')
                        .map((s, i) => (
                          <div key={i}>{s}</div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 && driverFound ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6">
                <div className="font-bold text-green-900">
                  ✅ {t('driverFoundMsg')}
                </div>
                <div className="mt-3 flex gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-800">
                    {initials}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{driverFound.name}</div>
                    <div className="text-sm text-gray-600">{driverFound.phone}</div>
                    <div className="text-sm text-gray-500">
                      {driverFound.location?.state || '—'} {driverFound.location?.district ? `· ${driverFound.location.district}` : ''}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1)
                        setDriverFound(null)
                        setPhone('')
                        setDriverNotFound(false)
                      }}
                      className="mt-2 text-sm text-blue-700 underline"
                    >
                      {t('wrongDriver')}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6">
                <h2 className="text-lg font-bold text-gray-900">
                  {t('workDetailsTitle')}
                </h2>

                <label className="mt-4 block text-sm font-semibold text-gray-800">
                  {t('whichVehicle')}
                </label>
                <select
                  value={form.vehicleId}
                  onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">{t('vehicleSelect2')}</option>
                  {vehicles.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.vehicleType} — {v.vehicleNumber}
                    </option>
                  ))}
                </select>

                <label className="mt-4 block text-sm font-semibold text-gray-800">
                  {t('vehicleCategoryLabel')}
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {['mining', 'road', 'transport'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          vehicleCategory: c,
                          transportType: c === 'transport' ? f.transportType : 'none',
                        }))
                      }
                      className={`rounded-xl py-2 text-sm font-semibold ${
                        form.vehicleCategory === c ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {c === 'mining'
                        ? t('miningLabel')
                        : c === 'road'
                          ? t('roadLabel')
                          : t('transportLabel')}
                    </button>
                  ))}
                </div>

                <label className="mt-4 block text-sm font-semibold text-gray-800">
                  {t('salaryTypeLabel4')}
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {['daily', 'monthly', 'hourly'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, salaryType: st }))}
                      className={`rounded-xl py-2 text-sm font-semibold ${
                        form.salaryType === st ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {st === 'daily'
                        ? t('daily')
                        : st === 'monthly'
                          ? t('monthly')
                          : t('hourly')}
                    </button>
                  ))}
                </div>

                {form.salaryType === 'daily' ? (
                  <>
                    <label className="mt-4 block text-sm font-semibold text-gray-800">
                      {t('salaryPerDayLabel')}
                    </label>
                    <input
                      value={form.salaryPerDay}
                      onChange={(e) => setForm((f) => ({ ...f, salaryPerDay: e.target.value }))}
                      className="input-field w-full"
                      placeholder="₹/din"
                      inputMode="numeric"
                    />
                  </>
                ) : form.salaryType === 'monthly' ? (
                  <>
                    <label className="mt-4 block text-sm font-semibold text-gray-800">
                      {t('salaryPerMonthLabel')}
                    </label>
                    <input
                      value={form.salaryPerMonth}
                      onChange={(e) => setForm((f) => ({ ...f, salaryPerMonth: e.target.value }))}
                      className="input-field w-full"
                      placeholder="₹/month"
                      inputMode="numeric"
                    />
                  </>
                ) : (
                  <>
                    <label className="mt-4 block text-sm font-semibold text-gray-800">
                      {t('salaryPerHourLabel')}
                    </label>
                    <input
                      value={form.salaryPerHour}
                      onChange={(e) => setForm((f) => ({ ...f, salaryPerHour: e.target.value }))}
                      className="input-field w-full"
                      placeholder="₹/ghanta"
                      inputMode="numeric"
                    />
                  </>
                )}

                {form.vehicleCategory !== 'transport' ? (
                  <>
                    <div className="mt-4 flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-800">
                        {t('bhatta')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, hasBhatta: !f.hasBhatta }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          form.hasBhatta ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {form.hasBhatta ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {form.hasBhatta ? (
                      <input
                        value={form.dailyBhatta}
                        onChange={(e) => setForm((f) => ({ ...f, dailyBhatta: e.target.value }))}
                        className="input-field w-full mt-2"
                        placeholder="₹/din"
                        inputMode="numeric"
                      />
                    ) : null}

                    <div className="mt-4 flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-800">
                        {t('hourlyBonusLabel3')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, hasHourlyBonus: !f.hasHourlyBonus }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          form.hasHourlyBonus ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {form.hasHourlyBonus ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {form.hasHourlyBonus ? (
                      <input
                        value={form.salaryPerHour}
                        onChange={(e) => setForm((f) => ({ ...f, salaryPerHour: e.target.value }))}
                        className="input-field w-full mt-2"
                        placeholder="₹/ghanta"
                        inputMode="numeric"
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    <label className="mt-4 block text-sm font-semibold text-gray-800">
                      {t('transportTypeLabel3')}
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {[
                        { id: 'company_trip', label: t('companyTripLabel') },
                        { id: 'malik_trip', label: t('malikTripLabel') },
                      ].map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, transportType: o.id }))}
                          className={`rounded-xl py-2 text-sm font-semibold ${
                            form.transportType === o.id ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <label className="mt-4 block text-sm font-semibold text-gray-800">
                  {t('durationDaysLabel2')}
                </label>
                <input
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  className="input-field w-full"
                  inputMode="numeric"
                />

                <label className="mt-4 block text-sm font-semibold text-gray-800">
                  {t('startDate')}
                </label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="input-field w-full"
                />

                <label className="mt-4 block text-sm font-semibold text-gray-800">
                  {t('workLocationLabel2')}
                </label>
                <input
                  value={form.workLocation}
                  onChange={(e) => setForm((f) => ({ ...f, workLocation: e.target.value }))}
                  className="input-field w-full"
                  placeholder={t('workLocationPlaceholder')}
                />

                <label className="mt-4 block text-sm font-semibold text-gray-800">
                  {t('termsLabel4')}
                </label>
                <textarea
                  rows={4}
                  value={form.terms}
                  onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
                  className="input-field w-full resize-y"
                  placeholder={t('termsPlaceholder')}
                />

                <label className="mt-4 block text-sm font-semibold text-gray-800">
                  {t('safetyConditionsLabel3')}
                </label>
                <textarea
                  rows={3}
                  value={form.safetyConditions}
                  onChange={(e) => setForm((f) => ({ ...f, safetyConditions: e.target.value }))}
                  className="input-field w-full resize-y"
                  placeholder={t('safetyPlaceholder')}
                />

                <button
                  type="button"
                  disabled={sending || phone.length !== 10 || !driverFound}
                  onClick={async () => {
                    try {
                      setSending(true)
                      await sendInvite({
                        driverPhone: phone,
                        vehicleId: form.vehicleId,
                        vehicleCategory: form.vehicleCategory,
                        salaryType: form.salaryType,
                        salaryPerDay: Number(form.salaryPerDay) || 0,
                        salaryPerMonth: Number(form.salaryPerMonth) || 0,
                        salaryPerHour: Number(form.salaryPerHour) || 0,
                        dailyBhatta: Number(form.dailyBhatta) || 0,
                        hasBhatta: Boolean(form.hasBhatta),
                        hasHourlyBonus: Boolean(form.hasHourlyBonus),
                        transportType: form.vehicleCategory === 'transport' ? form.transportType : 'none',
                        duration: Number(form.duration) || 30,
                        startDate: form.startDate,
                        terms: form.terms,
                        safetyConditions: form.safetyConditions,
                        workLocation: form.workLocation,
                      })
                      toast.success(t('inviteSentToast'))
                      const iRes = await getOwnerInvites()
                      setSentInvites(iRes.data?.invites || [])
                      setStep(3)
                    } catch (e) {
                      toast.error(e.response?.data?.message || t('inviteError'))
                    } finally {
                      setSending(false)
                    }
                  }}
                  className="mt-4 bg-blue-700 text-white w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
                >
                  {sending ? t('loading') : t('submit')}
                </button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <div className="bg-green-50 rounded-2xl p-8 text-center">
              <div className="text-3xl">🎉</div>
              <h2 className="mt-2 text-xl font-bold text-green-900">
                {t('inviteSentTitle')}
              </h2>
              <p className="mt-1 text-sm text-green-800">
                {t('inviteSentNote')}
              </p>
              <p className="mt-1 text-sm text-green-800">
                {t('inviteSentNote2')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep(1)
                  setPhone('')
                  setChecking(false)
                  setDriverFound(null)
                  setDriverNotFound(false)
                  setSending(false)
                  setForm({
                    vehicleId: '',
                    vehicleCategory: 'mining',
                    salaryType: 'monthly',
                    salaryPerDay: '',
                    salaryPerMonth: '',
                    salaryPerHour: '',
                    hasBhatta: false,
                    dailyBhatta: '',
                    hasHourlyBonus: false,
                    transportType: 'none',
                    duration: '30',
                    startDate: new Date().toISOString().split('T')[0],
                    terms: '',
                    safetyConditions: '',
                    workLocation: '',
                  })
                }}
                className="mt-6 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white"
              >
                {t('addDriver')}
              </button>
            </div>
          ) : null}

          <div className="mt-10">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">
              {t('sentInvitesTitle')}
            </h2>
            {sentInvites.length === 0 ? (
              <p className="text-sm text-gray-500">{t('noInvitesSent')}</p>
            ) : (
              <div className="space-y-3">
                {sentInvites.map((inv) => (
                  <div key={inv._id} className="bg-white rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {inv.driverId?.name || 'Driver'} · {inv.driverPhone}
                        </div>
                        <div className="text-sm text-gray-600">
                          {inv.vehicleId?.vehicleType || 'Vehicle'} {inv.vehicleId?.vehicleNumber ? `— ${inv.vehicleId.vehicleNumber}` : ''}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {inv.salaryType === 'monthly'
                            ? `₹${inv.salaryPerMonth}/${t('perMonth')}`
                            : inv.salaryType === 'daily'
                              ? `₹${inv.salaryPerDay}/${t('perDay')}`
                              : `₹${inv.salaryPerHour}/${t('perHour')}`}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {t('sentLabel')}: {fmtDate(inv.createdAt)}
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(inv.status)}`}>
                        {statusLabel(inv.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </div>
  )
}

export default InviteDriver

