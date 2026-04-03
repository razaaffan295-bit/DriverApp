import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getJobDetail, applyJob } from '../../api/driverAPI'
import API from '../../api/axios'

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
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [hasApplied, setHasApplied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [applyLoading, setApplyLoading] = useState(false)
  const [ownerRating, setOwnerRating] = useState(null)

  const loadJob = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const { data } = await getJobDetail(id)
      setJob(data.job)
      setHasApplied(!!data.hasApplied)
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Job load nahi ho payi.'
      )
      navigate('/driver/jobs')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => {
    toast('₹99/month subscription required — Razorpay setup pending', {
      icon: '⚠️',
    })
  }, [])

  useEffect(() => {
    loadJob()
  }, [loadJob])

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
        console.error(err)
      }
    }
    fetchOwnerRating()
    return () => {
      cancelled = true
    }
  }, [job])

  const owner = job?.ownerId && typeof job.ownerId === 'object'
    ? job.ownerId
    : null
  const ownerInitials =
    owner?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'O'

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

  const totalKamai = getTotalKamayi(job)

  const applied = hasApplied

  const handleApply = async () => {
    if (!id || applied) return
    toast('₹99/month subscription required — Razorpay setup pending', {
      icon: '⚠️',
    })
    setApplyLoading(true)
    try {
      await applyJob(id)
      toast.success(
        'Apply ho gaya! Owner ka reply aane tak wait karein'
      )
      setHasApplied(true)
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Apply nahi ho paya.'
      if (
        msg.includes('subscription') ||
        msg.includes('Subscription')
      ) {
        toast.error('₹99/month subscription required')
        toast('Razorpay setup pending', { icon: 'ℹ️' })
      } else {
        toast.error(msg)
      }
    } finally {
      setApplyLoading(false)
    }
  }

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
            ← Wapas Jaao
          </button>

          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
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
                      {owner?.name || 'Owner'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {owner?.location?.state},{' '}
                      {owner?.location?.district}
                    </p>
                  </div>
                </div>

                <div className="mb-4 mt-6 rounded-2xl border border-gray-100 bg-white p-5">
                  <h3 className="mb-3 font-semibold text-gray-800">
                    Owner ki Rating
                  </h3>

                  {!ownerRating ||
                  ownerRating.total === 0 ? (
                    <div className="py-4 text-center">
                      <div className="mb-2 text-3xl">★</div>
                      <p className="text-sm text-gray-400">
                        Abhi koi rating nahi
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Pehle driver hain — rate karne wale
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
                                  star <=
                                  Math.round(
                                    Number(ownerRating.avgScore)
                                  )
                                    ? 'text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <div className="text-sm text-gray-500">
                            {ownerRating.total} drivers ne rate kiya
                          </div>
                        </div>
                      </div>

                      <div className="max-h-48 space-y-3 overflow-y-auto">
                        {ownerRating.ratings
                          .slice(0, 5)
                          .map((rating, i) => (
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
                                — {rating.ratedBy?.name || 'Driver'}
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
                      Salary
                    </p>
                    <p className="font-semibold text-green-700">
                      {getSalaryDisplay(job)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      Duration
                    </p>
                    <p className="font-medium text-gray-900">
                      {job.duration} din
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      Start Date
                    </p>
                    <p className="font-medium text-gray-900">
                      {formatDate(job.startDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">
                      Location
                    </p>
                    <p className="font-medium text-gray-900">
                      {job.location?.state},{' '}
                      {job.location?.district}, {job.location?.city}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium text-gray-500">
                      Vehicle Type
                    </p>
                    <p className="font-medium text-gray-900">
                      {job.vehicleType}
                    </p>
                  </div>
                </div>

                <div className="mt-8 border-t border-gray-100 pt-6">
                  <h3 className="mb-2 text-base font-semibold text-gray-800">
                    Kaam ki Details
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
                      Total Kamayi:{' '}
                      {typeof totalKamai === 'string'
                        ? totalKamai
                        : `₹${totalKamai}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {job.duration} din × {getSalaryDisplay(job)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={applied || applyLoading}
                    onClick={handleApply}
                    className="rounded-xl bg-green-600 px-8 py-3 text-center text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {applied
                      ? 'Applied ✓'
                      : applyLoading
                        ? 'Apply ho raha hai...'
                        : 'Apply Karein'}
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
