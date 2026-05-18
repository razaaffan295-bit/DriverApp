import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { STATES, VEHICLE_TYPES } from '../../utils/constants'
import { searchJobs } from '../../api/driverAPI'
import { useDataCache } from '../../contexts/DataCacheContext'

const formatDate = (d) => {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

const JobSearch = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    state: '',
    vehicleType: '',
  })
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const {
    getCachedData,
    setCachedData,
    clearCache,
  } = useDataCache()

  const fetchJobs = useCallback(
    async (pageNum, append, silent = false) => {
      if (!silent) {
        if (append) setLoadingMore(true)
        else setLoading(true)
      }
      try {
        const params = { page: pageNum }
        if (filters.state) params.state = filters.state
        if (filters.vehicleType) params.vehicleType = filters.vehicleType
        const { data } = await searchJobs(params)
        const list = data?.jobs ?? []
        const newTotal = data?.total ?? 0
        setTotal(newTotal)
        setJobs((prev) => {
          const updated = append ? [...prev, ...list] : list
          // Cache only page 1 results (initial view)
          if (pageNum === 1 && !append) {
            const cacheKey = `driver_jobs_${filters.state || 'all'}_${filters.vehicleType || 'all'}`
            setCachedData(cacheKey, {
              jobs: updated,
              total: newTotal,
            })
          }
          return updated
        })
      } catch (e) {
        if (!silent) {
          toast.error(
            e.response?.data?.message || t('jobsLoadError')
          )
          if (!append) setJobs([])
        }
      } finally {
        if (!silent) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [filters.state, filters.vehicleType, t, setCachedData]
  )

  useEffect(() => {
    setPage(1)

    // Check cache for instant display
    const cacheKey = `driver_jobs_${filters.state || 'all'}_${filters.vehicleType || 'all'}`
    const cached = getCachedData(cacheKey)

    if (cached) {
      setJobs(cached.jobs || [])
      setTotal(cached.total || 0)
      setLoading(false)
      fetchJobs(1, false, true) // silent refresh
    } else {
      fetchJobs(1, false, false)
    }
  }, [filters.state, filters.vehicleType])

  const handleDhundho = useCallback(() => {
    setPage(1)
    // Clear cache for fresh search
    const cacheKey = `driver_jobs_${filters.state || 'all'}_${filters.vehicleType || 'all'}`
    clearCache(cacheKey)
    fetchJobs(1, false, false)
  }, [filters.state, filters.vehicleType, fetchJobs, clearCache])

  const handleLoadMore = useCallback(() => {
    const next = page + 1
    setPage(next)
    fetchJobs(next, true, false)
  }, [page, fetchJobs])

  const ownerName = useCallback((ownerId) => {
    if (!ownerId) return '—'
    if (typeof ownerId === 'object' && ownerId.name) {
      return ownerId.name
    }
    return '—'
  }, [])

  const hasMore = useMemo(
    () => jobs.length < total,
    [jobs.length, total]
  )

  const getSalaryDisplay = useCallback((job) => {
    if (!job) return '₹0'
    if (job.salaryType === 'monthly') {
      return `₹${job.salaryPerMonth || 0}/${t('perMonth')}`
    }
    if (job.salaryType === 'hourly') {
      return `₹${job.salaryPerHour || 0}/${t('perHour')}`
    }
    return `₹${job.salaryPerDay || 0}/${t('perDay')}`
  }, [t])

  const getTotalKamayi = useCallback((job) => {
    if (!job) return 0
    if (job.salaryType === 'monthly') {
      const months = Math.ceil((job.duration || 30) / 30)
      return (job.salaryPerMonth || 0) * months
    }
    if (job.salaryType === 'hourly') {
      return t('hourlyBasis')
    }
    return (job.salaryPerDay || 0) * (job.duration || 0)
  }, [t])

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
      <div className="p-4 md:p-6 pb-8">
        <h1 className="mb-4 text-xl font-bold text-gray-800">
          {t('jobSearch')}
        </h1>
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-gray-700">
            {t('filter')}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 sm:max-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                {t('state')}
              </label>
              <select
                value={filters.state}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, state: e.target.value }))
                }
                className="input-field w-full"
              >
                <option value="">{t('all')}</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1 sm:max-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                {t('vehicleType')}
              </label>
              <select
                value={filters.vehicleType}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    vehicleType: e.target.value,
                  }))
                }
                className="input-field w-full"
              >
                <option value="">{t('all')}</option>
                {VEHICLE_TYPES.map((vt) => (
                  <option key={vt} value={vt}>
                    {vt}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleDhundho}
              className="rounded-xl bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              {loading ? t('loading') : t('search')}
            </button>
          </div>
        </div>

        {loading && jobs.length === 0 ? (
          <div className="flex justify-center py-16">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent"
              role="status"
              aria-label={t('loading')}
            />
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
            <p className="text-gray-700">{t('noJobs')}</p>
            <p className="mt-1 text-sm text-gray-500">
              {t('tryChangeFilter')}
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-0">
              {jobs.map((job) => (
                <li
                  key={job._id}
                  className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 transition-all hover:border-green-200 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      {job.vehicleType}
                    </span>
                    <div className="text-right">
                      <span className="block text-[10px] font-medium uppercase text-gray-500">
                        {t('salary')}
                      </span>
                      <span className="text-xl font-bold text-green-700">
                        {getSalaryDisplay(job)}
                      </span>
                    </div>
                  </div>
                  <h3 className="mb-1 mt-3 text-lg font-semibold text-gray-900">
                    {job.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    <span aria-hidden="true">👤</span>{' '}
                    {ownerName(job.ownerId)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span
                      className="text-sm text-yellow-400"
                      aria-hidden="true"
                    >
                      ★
                    </span>
                    <span className="text-sm text-gray-600">
                      {job.ownerId?.totalRatings > 0
                        ? job.ownerId.avgRating
                        : t('newOwner')}
                    </span>
                    {job.ownerId?.totalRatings > 0 ? (
                      <span className="text-xs text-gray-400">
                        ({job.ownerId.totalRatings} {t('reviews')})
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-500">
                    <span aria-hidden="true">📍</span>{' '}
                    {job.location?.state},{' '}
                    {job.location?.district}, {job.location?.city}
                  </p>
                  <p className="text-sm text-gray-500">
                    <span aria-hidden="true">📅</span>{' '}
                    {t('startLabel')}: {formatDate(job.startDate)}
                  </p>
                  <p className="text-sm text-gray-500">
                    <span aria-hidden="true">⏱️</span>{' '}
                    {job.duration} {t('durationDays')}
                  </p>
                  <p className="text-sm text-gray-500">
                    <span aria-hidden="true">💰</span>{' '}
                    {t('totalApprox')}:{' '}
                    {typeof getTotalKamayi(job) === 'string'
                      ? getTotalKamayi(job)
                      : `₹${getTotalKamayi(job)}`}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/driver/jobs/${job._id}`)
                    }
                    className="mt-4 rounded-lg border border-green-600 px-4 py-2 text-sm text-green-600 hover:bg-green-50"
                  >
                    {t('jobDetailsBtn')}
                  </button>
                </li>
              ))}
            </ul>
            {hasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  className="rounded-xl border border-green-600 px-6 py-2 text-sm font-medium text-green-700 hover:bg-green-50 disabled:opacity-60"
                >
                  {loadingMore ? t('loading') : t('showMore')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default JobSearch
