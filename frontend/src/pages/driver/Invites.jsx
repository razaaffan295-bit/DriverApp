import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { acceptInvite, getDriverInvites, rejectInvite } from '../../api/inviteAPI'

const DriverInvites = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [acceptingId, setAcceptingId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const res = await getDriverInvites()
        setInvites(res.data?.invites || [])
      } catch (e) {
        setInvites([])
        toast.error(
          e.response?.data?.message || t('invitesLoadError')
        )
      } finally {
        setLoading(false)
      }
    })()
  }, [t])

  const fmtDate = (date) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
        <div className="mx-auto max-w-2xl px-4 py-6">
          <h1 className="mb-4 text-xl font-bold text-gray-800">
            {t('invites')}
          </h1>
          {loading ? (
            <div className="flex justify-center py-16">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent"
                aria-label={t('loading')}
              />
            </div>
          ) : invites.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center">
              <p className="text-lg font-semibold text-gray-700">
                {t('noInvitesYet')}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {t('noInvitesMsg')}
              </p>
            </div>
          ) : (
            invites.map((inv) => (
              <div
                key={inv._id}
                className="bg-white rounded-2xl p-6 mb-4 border border-blue-100 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-gray-900">
                    🎯 {t('workOffer')}
                  </div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                    {t('offer')}
                  </span>
                </div>

                <div className="mt-4 flex gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">
                    {inv.ownerId?.name
                      ?.split(/\s+/)
                      .filter(Boolean)
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase() || 'O'}
                  </div>
                  <div>
                    <div className="font-bold text-lg text-gray-900">{inv.ownerId?.name}</div>
                    <div className="text-sm text-gray-500">{inv.ownerId?.phone}</div>
                    <div className="text-sm text-gray-500">
                      {inv.ownerId?.location?.state || '—'}{' '}
                      {inv.ownerId?.location?.district ? `· ${inv.ownerId.location.district}` : ''}
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-700">
                  <div>
                    <strong>{t('vehicleLabel')}:</strong>{' '}
                    {inv.vehicleId?.vehicleType || '—'}{' '}
                    {inv.vehicleId?.vehicleNumber ? `— ${inv.vehicleId.vehicleNumber}` : ''}
                  </div>
                  <div className="mt-1">
                    <strong>{t('categoryLabel')}:</strong>{' '}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold">
                      {inv.vehicleCategory}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mt-4">
                  {inv.salaryType === 'monthly' ? (
                    <div className="text-sm">
                      {t('monthlySalaryLabel')}:{' '}
                      <strong>
                        ₹{inv.salaryPerMonth}/{t('perMonth')}
                      </strong>
                    </div>
                  ) : inv.salaryType === 'daily' ? (
                    <div className="text-sm">
                      {t('dailyRateLabel')}:{' '}
                      <strong>
                        ₹{inv.salaryPerDay}/{t('perDay')}
                      </strong>
                    </div>
                  ) : (
                    <div className="text-sm">
                      {t('hourlyRateLabel')}:{' '}
                      <strong>
                        ₹{inv.salaryPerHour}/{t('perHour')}
                      </strong>
                    </div>
                  )}
                  {inv.hasBhatta ? (
                    <div className="mt-1 text-sm">
                      + {t('dailyBhattaLabel')}: ₹{inv.dailyBhatta}/
                      {t('perDay')}
                    </div>
                  ) : null}
                  {inv.hasHourlyBonus ? (
                    <div className="mt-1 text-sm">
                      + {t('hourlyBonusLabel')}: ₹{inv.salaryPerHour}/
                      {t('perHour')}
                    </div>
                  ) : null}
                  {inv.vehicleCategory === 'transport' ? (
                    <div className="mt-1 text-sm">
                      {t('tripTypeLabel')}:{' '}
                      {inv.transportType === 'company_trip'
                        ? t('companyTrip')
                        : t('malikTrip')}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 text-sm text-gray-700 space-y-1">
                  <div>
                    <strong>{t('durationLabel2')}:</strong>{' '}
                    {inv.duration} {t('days')}
                  </div>
                  <div>
                    <strong>{t('startDateLabel')}:</strong>{' '}
                    {fmtDate(inv.startDate)}
                  </div>
                  <div>
                    <strong>{t('workLocation')}:</strong>{' '}
                    {inv.workLocation || '—'}
                  </div>
                </div>

                {inv.terms ? (
                  <div className="mt-4 text-sm text-gray-700">
                    <strong>{t('termsLabel')}:</strong>
                    <p className="mt-1 whitespace-pre-line">{inv.terms}</p>
                  </div>
                ) : null}

                {inv.safetyConditions ? (
                  <div className="mt-4 text-sm text-gray-700">
                    <strong>{t('safetyLabel')}:</strong>
                    <p className="mt-1 whitespace-pre-line">{inv.safetyConditions}</p>
                  </div>
                ) : null}

                {rejectingId === inv._id ? (
                  <div className="mt-4">
                    <input
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder={t('inviteRejectReasonPlaceholder')}
                      className="input-field w-full"
                    />
                    <button
                      type="button"
                      disabled={!rejectReason.trim()}
                      onClick={async () => {
                        try {
                          await rejectInvite({ inviteId: inv._id, reason: rejectReason.trim() })
                          toast.success(t('offerRejected'))
                          const res = await getDriverInvites()
                          setInvites(res.data?.invites || [])
                          setRejectingId(null)
                          setRejectReason('')
                        } catch (e) {
                          toast.error(
                            e.response?.data?.message ||
                              t('rejectError')
                          )
                        }
                      }}
                      className="mt-3 w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white"
                    >
                      {t('confirm')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(null)
                        setRejectReason('')
                      }}
                      className="mt-2 w-full text-sm text-gray-500"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="mt-4">
                    <button
                      type="button"
                      disabled={acceptingId === inv._id}
                      onClick={async () => {
                        try {
                          setAcceptingId(inv._id)
                          await acceptInvite({ inviteId: inv._id })
                          toast.success(t('offerAccepted'))
                          navigate('/driver/active-job')
                        } catch (e) {
                          toast.error(
                            e.response?.data?.message ||
                              t('acceptError')
                          )
                        } finally {
                          setAcceptingId(null)
                        }
                      }}
                      className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white mb-2 disabled:opacity-60"
                    >
                      {acceptingId === inv._id
                        ? t('loading')
                        : `✅ ${t('confirm')} — ${t('startWork')}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingId(inv._id)}
                      className="w-full rounded-xl border border-red-400 py-3 text-sm font-semibold text-red-500"
                    >
                      ❌ {t('declineOffer')}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
    </div>
  )
}

export default DriverInvites

