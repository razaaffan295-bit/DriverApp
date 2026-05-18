import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getDriverApplications } from '../../api/driverAPI'
import { getDriverActiveContract } from '../../api/contractAPI'
import { useDataCache } from '../../contexts/DataCacheContext'

const formatApplied = (d) => {
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

const DriverApplications = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [activeContract, setActiveContract] = useState(null)
  const [filter, setFilter] = useState('sab')
  const [loading, setLoading] = useState(true)
  const {
    getCachedData,
    setCachedData,
    clearCache
  } = useDataCache()

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [appsRes, contractRes] = await Promise.all([
        getDriverApplications(),
        getDriverActiveContract().catch(() => ({ data: { contract: null } })),
      ])
      const apps = appsRes?.data?.applications ?? []
      const contract = contractRes?.data?.contract ?? null
      setApplications(apps)
      setActiveContract(contract)

      // Cache the data
      setCachedData('driver_applications', {
        applications: apps,
        activeContract: contract,
      })
    } catch (e) {
      if (!silent) {
        toast.error(
          e.response?.data?.message || t('appsLoadError')
        )
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [t, setCachedData])

  useEffect(() => {
    const cached = getCachedData('driver_applications')
    if (cached) {
      setApplications(cached.applications || [])
      setActiveContract(cached.activeContract || null)
      setLoading(false)
      loadData(true) // silent refresh
    } else {
      loadData(false)
    }
  }, [])

  const getSalaryDisplay = useCallback((jobData) => {
    if (!jobData) return '—'
    if (jobData.salaryType === 'monthly') {
      return `₹${jobData.salaryPerMonth || 0}/${t('perMonth')}`
    }
    if (jobData.salaryType === 'hourly') {
      return `₹${jobData.salaryPerHour || 0}/${t('perHour')}`
    }
    return `₹${jobData.salaryPerDay || 0}/${t('perDay')}`
  }, [t])

  const activeContractJobId = useMemo(
    () => activeContract?.jobId?._id || activeContract?.jobId,
    [activeContract]
  )

  const getRealStatus = useCallback((app) => {
    if (app.status === 'terminated') return 'terminated'
    if (app.status === 'active') {
      const appJobId = app.jobId?._id || app.jobId
      if (
        activeContractJobId &&
        String(activeContractJobId) === String(appJobId)
      ) {
        return 'active'
      }
      return 'terminated'
    }
    return app.status
  }, [activeContractJobId])

  const filtered = useMemo(() => {
    if (filter === 'sab') return applications
    if (filter === 'active') {
      return applications.filter((a) => {
        const real = getRealStatus(a)
        if (real !== 'active') return false
        const appJobId = a.jobId?._id || a.jobId
        return (
          activeContractJobId &&
          String(activeContractJobId) === String(appJobId)
        )
      })
    }
    return applications.filter((a) => getRealStatus(a) === filter)
  }, [filter, applications, getRealStatus, activeContractJobId])

  const statusBlock = useCallback((status) => {
    if (status === 'pending') {
      return (
        <div className="rounded-lg bg-yellow-100 px-3 py-2 text-sm text-yellow-700">
          <span aria-hidden="true">⏳</span> {t('waitingForReply')}
        </div>
      )
    }
    if (status === 'accepted') {
      return (
        <div className="space-y-2">
          <div className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-700">
            <span aria-hidden="true">✅</span> {t('congratsAccepted')}
          </div>
          <Link
            to="/driver/active-job"
            className="inline-block rounded-lg border border-green-600 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
          >
            {t('joiningLetter')}
          </Link>
        </div>
      )
    }
    if (status === 'active') {
      return (
        <div className="space-y-2">
          <div className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
            <span aria-hidden="true">✅</span> {t('workInProgressMsg')}
          </div>
          <Link
            to="/driver/active-job"
            className="inline-block rounded-lg border border-emerald-600 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50"
          >
            {t('viewActiveWork')}
          </Link>
        </div>
      )
    }
    if (status === 'terminated') {
      return (
        <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
          {t('workEnded')}
        </div>
      )
    }
    return (
      <div className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-500">
        <span aria-hidden="true">❌</span> {t('tryOtherJobs')}
      </div>
    )
  }, [t])

  const filterButtons = useMemo(() => [
    { key: 'sab', label: t('all') },
    { key: 'pending', label: t('pending') },
    { key: 'accepted', label: t('approved') },
    { key: 'active', label: t('active') },
    { key: 'rejected', label: t('rejected') },
    { key: 'terminated', label: t('terminated') },
  ], [t])

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
      <div className="p-4 md:p-6 pb-8">
        <h1 className="mb-4 text-xl font-bold text-gray-800">
          {t('applications')}
        </h1>
        <div className="mb-6 flex flex-wrap gap-2">
          {filterButtons.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                filter === key
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-green-600 border-t-transparent"
              role="status"
              aria-label={t('loading')}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
            <p className="text-gray-700">
              {t('noApplications')}
            </p>
            <Link
              to="/driver/jobs"
              className="mt-4 inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              {t('findJobs')}
            </Link>
          </div>
        ) : (
          <ul>
            {filtered.map((app) => {
              const realStatus = getRealStatus(app)
              const job = app.jobId
              const owner = app.ownerId
              const title = job?.title || t('job')
              return (
                <li
                  key={app._id}
                  className={`mb-4 rounded-2xl border p-5 ${
                    realStatus === 'terminated'
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2
                      className={`text-lg font-semibold ${
                        realStatus === 'terminated'
                          ? 'text-gray-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {title}
                    </h2>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      {job?.vehicleType || '—'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    <span aria-hidden="true">👤</span> {owner?.name || t('owner')}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span aria-hidden="true">📍</span> {owner?.location?.state},{' '}
                    {owner?.location?.district}
                  </p>
                  <p className="text-sm text-gray-600">
                    {getSalaryDisplay(job)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {job?.duration ?? '—'} {t('durationDaysLabel')}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    {t('appliedOn')} {formatApplied(app.appliedAt)}
                  </p>
                  <div className="mt-4">
                    {realStatus === 'terminated' ? (
                      <div className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full inline-block">
                        {t('workEnded')}
                      </div>
                    ) : (
                      statusBlock(realStatus)
                    )}
                  </div>

                  {realStatus === 'terminated' ? null : app.status === 'rejected' ? (
                    <span className="mt-2 block text-xs italic text-gray-400">
                      {t('messagingDisabled')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate('/driver/messages')}
                      className="mt-3 rounded-lg border border-green-400 px-3 py-1 text-sm text-green-600 hover:bg-green-50"
                    >
                      {t('messageBtn')}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default DriverApplications
