import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { STATES, VEHICLE_TYPES } from '../../utils/constants'
import { searchJobs } from '../../api/driverAPI'

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

  const fetchJobs = useCallback(
    async (pageNum, append) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const params = { page: pageNum }
        if (filters.state) params.state = filters.state
        if (filters.vehicleType) params.vehicleType = filters.vehicleType
        const { data } = await searchJobs(params)
        const list = data?.jobs ?? []
        setTotal(data?.total ?? 0)
        setJobs((prev) => (append ? [...prev, ...list] : list))
      } catch (e) {
        toast.error(
          e.response?.data?.message || 'Jobs load nahi ho payeen.'
        )
        if (!append) setJobs([])
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filters.state, filters.vehicleType]
  )

  useEffect(() => {
    setPage(1)
    fetchJobs(1, false)
  }, [fetchJobs])

  const handleDhundho = () => {
    setPage(1)
    fetchJobs(1, false)
  }

  const handleLoadMore = () => {
    const next = page + 1
    setPage(next)
    fetchJobs(next, true)
  }

  const ownerName = (ownerId) => {
    if (!ownerId) return '—'
    if (typeof ownerId === 'object' && ownerId.name) return ownerId.name
    return '—'
  }

  const hasMore = jobs.length < total

  const getSalaryDisplay = (job) => {
    if (!job) return '₹0'
    if (job.salaryType === 'monthly') {
      return `₹${job.salaryPerMonth || 0}/month`
    }
    if (job.salaryType === 'hourly') {
      return `₹${job.salaryPerHour || 0}/ghanta`
    }
    return `₹${job.salaryPerDay || 0}/din`
  }

  const getTotalKamayi = (job) => {
    if (!job) return 0
    if (job.salaryType === 'monthly') {
      const months = Math.ceil((job.duration || 30) / 30)
      return (job.salaryPerMonth || 0) * months
    }
    if (job.salaryType === 'hourly') {
      return 'Ghante ke hisaab se'
    }
    return (job.salaryPerDay || 0) * (job.duration || 0)
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
      <div className="p-4 md:p-6 pb-8">
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-0 flex-1 sm:max-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                State
              </label>
              <select
                value={filters.state}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, state: e.target.value }))
                }
                className="input-field w-full"
              >
                <option value="">Sab States</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 flex-1 sm:max-w-[200px]">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Vehicle Type
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
                <option value="">Sab Types</option>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
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
              {loading ? 'Dhundh rahe...' : 'Dhundho'}
            </button>
          </div>
        </div>

        {loading && jobs.length === 0 ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
            <p className="text-gray-700">Koi job nahi mili</p>
            <p className="mt-1 text-sm text-gray-500">
              Filter change karke try karein
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
                    <span className="text-xl font-bold text-green-700">
                      {getSalaryDisplay(job)}
                    </span>
                  </div>
                  <h3 className="mb-1 mt-3 text-lg font-semibold text-gray-900">
                    {job.title}
                  </h3>
                  <p className="text-sm text-gray-500">
                    👤 {ownerName(job.ownerId)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-sm text-yellow-400">
                      ★
                    </span>
                    <span className="text-sm text-gray-600">
                      {job.ownerId?.totalRatings > 0
                        ? job.ownerId.avgRating
                        : 'New'}
                    </span>
                    {job.ownerId?.totalRatings > 0 ? (
                      <span className="text-xs text-gray-400">
                        ({job.ownerId.totalRatings} reviews)
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-500">
                    📍 {job.location?.state},{' '}
                    {job.location?.district}, {job.location?.city}
                  </p>
                  <p className="text-sm text-gray-500">
                    📅 Start: {formatDate(job.startDate)}
                  </p>
                  <p className="text-sm text-gray-500">
                    ⏱️ {job.duration} din
                  </p>
                  <p className="text-sm text-gray-500">
                    💰 Total (approx):{' '}
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
                    Job Details Dekho
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
                  {loadingMore ? 'Loading...' : 'Aur dikhao'}
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
