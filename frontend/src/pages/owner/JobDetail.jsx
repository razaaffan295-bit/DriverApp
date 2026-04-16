import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import {
  getJobById,
  getJobApplications,
  closeJob,
  acceptApplication,
  rejectApplication,
} from '../../api/ownerAPI'

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
  if (!job) return '—'
  if (job.salaryType === 'monthly') {
    return `₹${job.salaryPerMonth || 0}/${t('perMonth')}`
  }
  if (job.salaryType === 'hourly') {
    return `₹${job.salaryPerHour || 0}/${t('perHour')}`
  }
  return `₹${job.salaryPerDay || 0}/${t('perDay')}`
}

const statusBadgeClass = (s) => {
  if (s === 'active') return 'bg-emerald-100 text-emerald-800'
  if (s === 'accepted') return 'bg-green-100 text-green-700'
  if (s === 'rejected') return 'bg-red-100 text-red-500'
  return 'bg-yellow-100 text-yellow-700'
}

const OwnerJobDetail = () => {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [closeLoading, setCloseLoading] = useState(false)
  const [actionId, setActionId] = useState(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [jobRes, appsRes] = await Promise.all([
        getJobById(id),
        getJobApplications(id),
      ])
      setJob(jobRes.data?.job ?? null)
      setApplications(appsRes.data?.applications ?? [])
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('jobLoadError2')
      )
      navigate('/owner/jobs')
    } finally {
      setLoading(false)
    }
  }, [id, navigate, t])

  useEffect(() => {
    load()
  }, [load])

  const handleClose = async () => {
    if (!id || job?.status !== 'open') return
    setCloseLoading(true)
    try {
      await closeJob(id)
      toast.success(t('jobClosedMsg'))
      await load()
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('jobCloseError2')
      )
    } finally {
      setCloseLoading(false)
    }
  }

  const handleAccept = async (appId) => {
    setActionId(appId)
    try {
      await acceptApplication(appId)
      toast.success(t('appAccepted2'))
      await load()
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('acceptError3')
      )
    } finally {
      setActionId(null)
    }
  }

  const handleReject = async (appId) => {
    setActionId(appId)
    try {
      await rejectApplication(appId)
      toast.success(t('appRejected2'))
      await load()
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('rejectError4')
      )
    } finally {
      setActionId(null)
    }
  }

  if (loading) {
    return (
      <div
        style={{ minHeight: '100vh', background: '#F0F4FF' }}
        className="p-4 md:p-6"
      >
        <p className="text-sm text-gray-500">{t('loading')}</p>
      </div>
    )
  }

  if (!job) {
    return null
  }

  const loc = job.location || {}

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
      <div className="p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/owner/jobs')}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            ← {t('back')}
          </button>
        </div>

        <div
          className="mb-6 rounded-2xl border border-gray-100 bg-white p-5"
          aria-label={t('job')}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
              {job.vehicleType || '—'}
            </span>
            <span
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700"
              title={t('status')}
            >
              {job.status}
            </span>
          </div>
          <h1 className="mt-3 text-xl font-bold text-gray-900">
            {job.title}
          </h1>
          <p
            className="mt-4 text-sm text-gray-700 whitespace-pre-wrap"
            aria-label={t('description')}
          >
            {job.description || '—'}
          </p>

          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-gray-500">{t('salary')}</dt>
              <dd className="font-semibold text-blue-700">
                {getSalaryDisplay(job, t)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">{t('duration')}</dt>
              <dd className="font-medium text-gray-900">
                {job.duration != null ? `${job.duration} ${t('days')}` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">{t('startDate')}</dt>
              <dd className="font-medium text-gray-900">
                {formatJobDate(job.startDate)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">{t('vehicleType')}</dt>
              <dd className="font-medium text-gray-900 capitalize">
                {job.vehicleCategory || '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-gray-500">{t('locationLabel')}</dt>
              <dd className="font-medium text-gray-900">
                {[loc.state, loc.district, loc.city]
                  .filter(Boolean)
                  .join(', ') || '—'}
                {loc.address ? (
                  <span className="mt-1 block text-gray-600">
                    {loc.address}
                  </span>
                ) : null}
              </dd>
            </div>
          </dl>

          {job.status === 'open' && (
            <button
              type="button"
              disabled={closeLoading}
              onClick={handleClose}
              className="mt-6 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
            >
              {closeLoading ? t('closingJob') : t('closeJobBtn2')}
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('applications')} ({applications.length})
          </h2>
          {applications.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              {t('noApplicationsYet')}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {applications.map((app) => {
                const d = app.driverId
                return (
                  <li
                    key={app._id}
                    className="rounded-xl border border-gray-100 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900">
                          {d?.name || 'Driver'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {d?.phone || '—'}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {t('appliedLabel')}:{' '}
                          {formatJobDate(app.appliedAt)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${statusBadgeClass(app.status)}`}
                      >
                        {app.status}
                      </span>
                    </div>
                    {app.status === 'pending' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={actionId === app._id}
                          onClick={() => handleAccept(app._id)}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {t('acceptBtn2')}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === app._id}
                          onClick={() => handleReject(app._id)}
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {t('rejectBtn5')}
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default OwnerJobDetail
