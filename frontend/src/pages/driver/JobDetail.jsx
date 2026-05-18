import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getJobDetail, applyJob } from '../../api/driverAPI'
import { checkSubscription } from '../../api/subscriptionAPI'
import API from '../../api/axios'
import { useDataCache } from '../../contexts/DataCacheContext'

const formatDate = (d) => {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

const JobDetail = () => {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [hasApplied, setHasApplied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [applyLoading, setApplyLoading] = useState(false)
  const [ownerRating, setOwnerRating] = useState(null)
  const {
    getCachedData,
    setCachedData,
    clearCache,
  } = useDataCache()

  const loadJob = useCallback(async (silent = false) => {
    if (!id) return
    if (!silent) setLoading(true)
    try {
      const { data } = await getJobDetail(id)
      setJob(data.job)
      setHasApplied(!!data.hasApplied)

      // Cache the job data
      setCachedData(`driver_job_${id}`, {
        job: data.job,
        hasApplied: !!data.hasApplied,
      })
    } catch (e) {
      if (!silent) {
        toast.error(
          e.response?.data?.message || t('jobLoadError')
        )
        navigate('/driver/jobs')
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [id, navigate, t, setCachedData])

  useEffect(() => {
    if (!id) return

    // Check cache for instant display
    const cached = getCachedData(`driver_job_${id}`)
    if (cached) {
      setJob(cached.job)
      setHasApplied(!!cached.hasApplied)
      setLoading(false)
      loadJob(true) // silent refresh
    } else {
      loadJob(false)
    }
  }, [id])

  useEffect(() => {
    const oid = job?.ownerId?._id || job?.ownerId
    if (!oid) {
      setOwnerRating(null)
      return undefined
    }
    let cancelled = false
    const fetchOwnerRating = async () => {
      try {
        const res = await API.get(
          `/api/ratings/user/${oid}`
        )
        if (!cancelled) setOwnerRating(res.data)
      } catch (err) {
        // Silent fail - rating is optional
      }
    }
    fetchOwnerRating()
    return () => {
      cancelled = true
    }
  }, [job])

  const owner = useMemo(
    () =>
      job?.ownerId && typeof job.ownerId === 'object'
        ? job.ownerId
        : null,
    [job]
  )

  const ownerInitials = useMemo(
    () =>
      owner?.name
        ?.split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'O',
    [owner]
  )

  const getSalaryDisplay = useCallback((jobData) => {
    if (!jobData) return '₹0'
    if (jobData.salaryType === 'monthly') {
      return `₹${jobData.salaryPerMonth || 0}/${t('perMonth')}`
    }
    if (jobData.salaryType === 'hourly') {
      return `₹${jobData.salaryPerHour || 0}/${t('perHour')}`
    }
    return `₹${jobData.salaryPerDay || 0}/${t('perDay')}`
  }, [t])

  const getTotalKamayi = useCallback((jobData) => {
    if (!jobData) return 0
    if (jobData.salaryType === 'monthly') {
      const months = Math.ceil((jobData.duration || 30) / 30)
      return (jobData.salaryPerMonth || 0) * months
    }
    if (jobData.salaryType === 'hourly') {
      return t('hourlyBasis')
    }
    return (jobData.salaryPerDay || 0) * (jobData.duration || 0)
  }, [t])

  const totalKamai = useMemo(
    () => getTotalKamayi(job),
    [job, getTotalKamayi]
  )

  const totalKamaiDisplay = useMemo(
    () =>
      typeof totalKamai === 'string'
        ? totalKamai
        : `₹${totalKamai}`,
    [totalKamai]
  )

  const ownerRatingRounded = useMemo(
    () => Math.round(Number(ownerRating?.avgScore) || 0),
    [ownerRating]
  )

  const recentRatings = useMemo(
    () => (ownerRating?.ratings || []).slice(0, 5),
    [ownerRating]
  )

  const handleApply = useCallback(async () => {
    if (!id || hasApplied) return
    setApplyLoading(true)
    try {
      const subRes = await checkSubscription()
      if (!subRes.data?.isActive) {
        navigate('/subscription')
        return
      }
      await applyJob(id)
      toast.success(t('appliedSuccess'))
      setHasApplied(true)

      // Clear caches
      clearCache(`driver_job_${id}`)
      clearCache('driver_applications')
      clearCache('driver_dashboard')
    } catch (err) {
      const code = err.response?.data?.code
      const msg =
        err.response?.data?.message ||
        t('applyError') ||
        'Apply nahi ho paya.'
      if (
        code === 'SUBSCRIPTION_REQUIRED' ||
        msg.toLowerCase().includes('subscription')
      ) {
        navigate('/subscription')
      } else {
        toast.error(msg)
      }
    } finally {
      setApplyLoading(false)
    }
  }, [id, hasApplied, navigate, t, clearCache])

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
        <div className="p-4 md:p-6">
          <button
            type="button"
            onClick={() => navigate('/driver/jobs')}
            className="mb-4 text-sm font-medium text-green-700 hover:text-green-800"
          >
            ← {t('back')}
          </button>

          {loading ? (
            <div className="flex justify-center py-16">
              <div
                className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent"
                role="status"
                aria-label={t('loading')}
              />
            </div>
          ) : !job ? null : (
            <>
              <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    {job.vehicleType}
                  </span>
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700 capitalize">
                    {job.status}
                  </span>
                </div>
                <h2 className="mt-4 text-2xl font-bold text-gray-900">
                  {job.title}
                </h2>

                <div className="mt-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                    {ownerInitials}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {owner?.name || t('owner')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {owner?.location?.state},{' '}
                      {owner?.location?.district}
                    </p>
                  </div>
                </div>

                <div className="mb-4 mt-6 rounded-2xl border border-gray-100 bg-white p-5">
                  <h3 className="mb-3 font-semibold text-gray-800">
                    {t('ownerRatingTitle')}
                  </h3>

                  {!ownerRating ||
                  ownerRating.total === 0 ? (
                    <div className="py-4 text-center">
                      <div className="mb-2 text-3xl" aria-hidden="true">★</div>
                      <p className="text-sm text-gray-400">
                        {t('noRatingYet')}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {t('firstDrivers')}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="text-4xl font-bold text-yellow-500">
                          {ownerRating.avgScore}
                        </div>
                        <div>
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={`text-xl ${
                                  star <= ownerRatingRounded
                                    ? 'text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                                aria-hidden="true"
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <div className="text-sm text-gray-500">
                            {ownerRating.total} {t('driversRated')}
                          </div>
                        </div>
                      </div>

                      <div className="max-h-48 space-y-3 overflow-y-auto">
                        {recentRatings.map((rating, i) => (
                            <div
                              key={rating._id || i}
                              className="rounded-xl bg-gray-50 p-3"
                            >
                              <div className="mb-1 flex items-center justify-between">
                                <div className="flex gap-0.5">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <span
                                      key={star}
                                      className={`text-sm ${
                                        star <= rating.score
                                          ? 'text-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                      aria-hidden="true"
                                    >
                                      ★
                                    </span>
                                  ))}
                                </div>
                                <span className="text-xs text-gray-400">
                                  {new Date(
                                    rating.createdAt
                                  ).toLocaleDateString('en-IN')}
                                </span>
                              </div>
                              {rating.review ? (
                                <p className="text-sm italic text-gray-600">
                                  &quot;{rating.review}&quot;
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs text-gray-400">
                                — {rating.ratedBy?.name || t('driver')}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      {t('salary')}
                    </p>
                    <p className="font-semibold text-green-700">
                      {getSalaryDisplay(job)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      {t('duration')}
                    </p>
                    <p className="font-medium text-gray-900">
                      {job.duration} {t('days')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      {t('startDate')}
                    </p>
                    <p className="font-medium text-gray-900">
                      {formatDate(job.startDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      {t('locationLabel')}
                    </p>
                    <p className="font-medium text-gray-900">
                      {job.location?.state},{' '}
                      {job.location?.district}, {job.location?.city}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-gray-500">
                      {t('vehicleType')}
                    </p>
                    <p className="font-medium text-gray-900">
                      {job.vehicleType}
                    </p>
                  </div>
                </div>

                <div className="mt-8 border-t border-gray-100 pt-6">
                  <h3 className="mb-2 text-base font-semibold text-gray-800">
                    {t('description')}
                  </h3>
                  <p className="whitespace-pre-wrap text-sm text-gray-600">
                    {job.description || '—'}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-bold text-green-700">
                      {t('totalEarningsLabel2')}:{' '}
                      {totalKamaiDisplay}
                    </p>
                    <p className="text-sm text-gray-500">
                      {job.duration} {t('days')} × {getSalaryDisplay(job)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={hasApplied || applyLoading}
                    onClick={handleApply}
                    className="rounded-xl bg-green-600 px-8 py-3 text-center text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {hasApplied
                      ? t('appliedDone')
                      : applyLoading
                        ? t('loading')
                        : t('applyJob')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
    </div>
  )
}

export default JobDetail
