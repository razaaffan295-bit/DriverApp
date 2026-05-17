import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getOwnerJobs, closeJob } from '../../api/ownerAPI'

const formatJobDate = (d) => {
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

const getSalaryDisplay = (job, t) => {
  if (!job) return '₹0'
  if (job.salaryType === 'monthly') {
    return `₹${job.salaryPerMonth || 0}/${t('perMonth')}`
  }
  if (job.salaryType === 'hourly') {
    return `₹${job.salaryPerHour || 0}/${t('perHour')}`
  }
  return `₹${job.salaryPerDay || 0}/${t('perDay')}`
}

const OwnerJobs = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [filter, setFilter] = useState('sab')
  const [loading, setLoading] = useState(true)
  const [closeLoadingId, setCloseLoadingId] = useState(null)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await getOwnerJobs()
      setJobs(data?.jobs ?? [])
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('jobsLoadError')
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  const filteredJobs =
    filter === 'sab'
      ? jobs
      : jobs.filter((j) => j.status === filter)

  const statusBadge = (status) => {
    if (status === 'open') {
      return 'bg-green-100 text-green-700'
    }
    if (status === 'filled') {
      return 'bg-blue-100 text-blue-700'
    }
    return 'bg-gray-100 text-gray-500'
  }

  const handleClose = async (id) => {
    setCloseLoadingId(id)
    try {
      await closeJob(id)
      toast.success(t('jobClosed'))
      await loadJobs()
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('jobCloseError')
      )
    } finally {
      setCloseLoadingId(null)
    }
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
        <div className="p-4 md:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-bold text-gray-800">
              {t('myJobs')}
            </h2>
            <button
              type="button"
              onClick={() => navigate('/owner/post-job')}
              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              {t('postJobBtn2')}
            </button>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            {[
              { key: 'sab', label: t('all') },
              { key: 'open', label: t('active') },
              { key: 'filled', label: t('filledLabel') },
              { key: 'closed', label: t('completed') },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  filter === key
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">{t('loading')}</p>
          ) : filteredJobs.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
              <p className="text-gray-600">
                {jobs.length === 0
                  ? t('noJobs')
                  : t('noFilterJobs')}
              </p>
              {jobs.length === 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/owner/post-job')}
                  className="mt-4 rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                >
                  {t('postFirstJob')}
                </button>
              )}
            </div>
          ) : (
            <ul className="space-y-0">
              {filteredJobs.map((j) => {
                const appCount = Array.isArray(j.applicants)
                  ? j.applicants.length
                  : 0
                return (
                  <li
                    key={j._id}
                    role="presentation"
                    onClick={() => navigate(`/owner/jobs/${j._id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/owner/jobs/${j._id}`)
                      }
                    }}
                    className="mb-4 cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 transition-colors hover:border-blue-200"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        {j.vehicleType}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusBadge(j.status)}`}
                      >
                        {j.status === 'open'
                          ? t('active')
                          : j.status === 'closed'
                            ? t('completed')
                            : j.status}
                      </span>
                    </div>
                    <h3 className="mb-1 mt-3 text-lg font-semibold text-gray-900">
                      {j.title}
                    </h3>
                    <p className="text-sm text-gray-500">
                      📍 {j.location?.state}, {j.location?.district},{' '}
                      {j.location?.city}
                    </p>
                    <p className="text-sm text-gray-500">
                      📅 {formatJobDate(j.startDate)}
                    </p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold text-blue-700">
                          {getSalaryDisplay(j, t)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {j.duration} {t('durationDays2')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {t('applications')}: {appCount}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/owner/jobs/${j._id}`)
                          }}
                          className="rounded-lg border border-blue-700 px-3 py-1 text-sm text-blue-700"
                        >
                          {t('viewBtn')}
                        </button>
                        {j.status === 'open' && (
                          <button
                            type="button"
                            disabled={closeLoadingId === j._id}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleClose(j._id)
                            }}
                            className="text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                          >
                            {closeLoadingId === j._id
                              ? t('closingProgress')
                              : t('closeJobBtn')}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
    </div>
  )
}

export default OwnerJobs
