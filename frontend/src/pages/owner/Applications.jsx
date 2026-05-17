import { useEffect, useState, useCallback } from 'react'
import {
  useNavigate,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import {
  getOwnerApplications,
  acceptApplication,
  rejectApplication,
  cancelApplication,
  getOwnerJobs,
  getPublicDriverProfile,
} from '../../api/ownerAPI'
import DriverProfileModal from '../../components/owner/DriverProfileModal'
import { getOwnerContracts } from '../../api/contractAPI'

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

const statusBadgeClass = (s) => {
  if (s === 'active') return 'bg-emerald-100 text-emerald-800'
  if (s === 'accepted') return 'bg-green-100 text-green-700'
  if (s === 'rejected') return 'bg-red-100 text-red-500'
  return 'bg-yellow-100 text-yellow-700'
}

const OwnerApplications = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [jobs, setJobs] = useState([])
  const [jobFilter, setJobFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [acceptId, setAcceptId] = useState(null)
  const [rejectId, setRejectId] = useState(null)
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [selectedApplication, setSelectedApplication] =
    useState(null)
  const [showModal, setShowModal] = useState(false)
  const [profileLoadingId, setProfileLoadingId] = useState(null)
  const [cancelId, setCancelId] = useState(null)
  const [driverProfileData, setDriverProfileData] =
    useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [appsRes, jobsRes, contractsRes] = await Promise.all([
        getOwnerApplications(),
        getOwnerJobs(),
        getOwnerContracts(),
      ])
      const rawApps = appsRes.data?.applications ?? []
      const contracts = contractsRes.data?.contracts ?? []
      const contractByKey = {}
      contracts.forEach((c) => {
        const jid = c.jobId?._id || c.jobId
        const did = c.driverId?._id || c.driverId
        if (!jid || !did) return
        const key = `${String(jid)}_${String(did)}`
        if (!contractByKey[key]) {
          contractByKey[key] = {
            contractId: c._id,
            contractStatus: c.status,
          }
        }
      })
      const merged = rawApps.map((app) => {
        const jid = app.jobId?._id || app.jobId
        const did = app.driverId?._id || app.driverId
        const key =
          jid && did ? `${String(jid)}_${String(did)}` : ''
        const hit = key ? contractByKey[key] : null
        return {
          ...app,
          contractId: hit?.contractId ?? app.contractId ?? null,
          contractStatus:
            hit?.contractStatus ?? app.contractStatus ?? null,
        }
      })
      setApplications(merged)
      setJobs(jobsRes.data?.jobs ?? [])
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('dataLoadError2')
      )
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const driverInitials = (name) =>
    name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'D'

  const filteredApplications =
    jobFilter === ''
      ? applications
      : applications.filter(
          (a) => String(a.jobId?._id || a.jobId) === jobFilter
        )

  const activeApps = filteredApplications.filter(
    (a) => a.status !== 'terminated'
  )

  const terminatedApps = filteredApplications.filter(
    (a) => a.status === 'terminated'
  )

  const handleAccept = async (id) => {
    setAcceptId(id)
    try {
      await acceptApplication(id)
      toast.success(t('driverAccepted'))
      await loadData()
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('acceptError2')
      )
    } finally {
      setAcceptId(null)
    }
  }

  const handleReject = async (id) => {
    setRejectId(id)
    try {
      await rejectApplication(id)
      toast.success(t('applicationRejected'))
      await loadData()
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('rejectError3')
      )
    } finally {
      setRejectId(null)
    }
  }

  const handleViewProfile = async (application) => {
    try {
      setProfileLoadingId(application._id)

      const driverId =
        application.driverId?._id ||
        application.driverId

      console.log('Full application:', application)
      console.log('Driver ID:', driverId)
      console.log('Job ID:', application.jobId)

      if (!driverId) {
        toast.error(t('driverIdError'))
        return
      }

      const res = await getPublicDriverProfile(driverId)
      const u = res.data?.user
      const p = res.data?.profile || {}
      if (!u) {
        toast.error(t('profileLoadError3'))
        return
      }

      setSelectedDriver({
        _id: driverId,
        name: u.name,
        location: u.location,
        isVerified: u.isVerified,
        phone: application.driverId?.phone,
        skills: p.skills ?? [],
        experience: p.experience,
        licenseType: p.licenseType,
        licenseNumber: p.licenseNumber,
        licenseExpiry: p.licenseExpiry,
        about: p.about,
        documents: p.documents,
      })
      setDriverProfileData({
        avgRating: res.data?.avgRating ?? 0,
        totalRatings: res.data?.totalRatings ?? 0,
        ratings: res.data?.ratings ?? [],
      })

      setSelectedApplication({
        ...application,
        jobId: application.jobId,
        _id: application._id,
        status: application.status,
        driverId: application.driverId,
      })

      setShowModal(true)
    } catch (error) {
      console.error(error)
      toast.error(t('profileLoadError3'))
    } finally {
      setProfileLoadingId(null)
    }
  }

  const goToContract = (app) => {
    const cid = app.contractId
    if (cid) navigate(`/owner/contracts/${cid}`)
  }

  const applicationStatusLabel = (s) => {
    if (s === 'pending') return t('pending')
    if (s === 'rejected') return t('rejected')
    if (s === 'accepted') return t('approved')
    if (s === 'hired') return t('hired')
    if (s === 'shortlisted') return t('shortlisted')
    return s
  }

  const contractStatusBadge = (app) => {
    if (!app.contractId) return null
    if (app.contractStatus === 'active') {
      return (
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
          {t('contractActive')}
        </span>
      )
    }
    if (app.contractStatus === 'sent') {
      return (
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
          {t('contractSent')}
        </span>
      )
    }
    return null
  }

  const handleCancelAccept = async (id) => {
    setCancelId(id)
    try {
      await cancelApplication(id)
      toast.success(t('cancelDone'))
      setShowModal(false)
      setSelectedDriver(null)
      setSelectedApplication(null)
      setDriverProfileData(null)
      await loadData()
    } catch (e) {
      toast.error(
        e.response?.data?.message || t('cancelError')
      )
    } finally {
      setCancelId(null)
    }
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
        <div className="p-4 md:p-6">
          <div className="mb-6 max-w-md">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('jobFilter')}
            </label>
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="input-field w-full"
            >
              <option value="">{t('allJobs')}</option>
              {jobs.map((j) => (
                <option key={j._id} value={j._id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">{t('loading')}</p>
          ) : filteredApplications.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-gray-600">
              {t('noApplications')}
            </div>
          ) : (
            <>
              <ul className="space-y-0">
              {activeApps.map((app) => {
                const d = app.driverId
                const prof = app.driverProfile
                const job = app.jobId
                const name = d?.name || 'Driver'
                const skills = prof?.skills ?? []
                return (
                  <li
                    key={app._id}
                    className="mb-4 rounded-2xl border border-gray-100 bg-white p-5"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 flex-1 gap-4">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-800">
                          {driverInitials(name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900">
                            {name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {d?.phone || '—'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {d?.location?.state},{' '}
                            {d?.location?.district}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {skills.map((s) => (
                              <span
                                key={s}
                                className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span className="text-yellow-400">
                              ★
                            </span>
                            <span className="text-sm font-medium text-gray-800">
                              {d?.totalRatings > 0
                                ? d?.avgRating
                                : t('newDriverLabel')}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({d?.totalRatings ?? 0} {t('reviewsLabel')})
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            {prof?.experience != null
                              ? `${prof.experience} ${t('experienceYears')}`
                              : '—'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {[
                              prof?.licenseType,
                              prof?.licenseNumber,
                            ]
                              .filter(Boolean)
                              .join(' — ') || 'License: —'}
                          </p>
                        </div>
                      </div>

                      <div className="flex-1 border-t border-gray-100 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                        <p className="text-sm font-medium text-gray-700">
                          {job?.title || 'Job'}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          {t('appliedOnLabel')} {formatApplied(app.appliedAt)}
                        </p>
                      </div>

                      <div className="flex flex-col items-stretch gap-3 lg:items-end lg:text-right">
                        <span
                          className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-semibold capitalize lg:self-end ${statusBadgeClass(app.status)}`}
                        >
                          {applicationStatusLabel(app.status)}
                        </span>
                        <button
                          type="button"
                          disabled={profileLoadingId === app._id}
                          onClick={() => handleViewProfile(app)}
                          className="rounded-lg border border-blue-600 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 disabled:opacity-60"
                        >
                          {profileLoadingId === app._id
                            ? t('loading')
                            : t('profileViewBtn')}
                        </button>
                        {app.status === 'pending' && (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={acceptId === app._id}
                              onClick={() => handleAccept(app._id)}
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-60"
                            >
                              {acceptId === app._id
                                ? '…'
                                : t('acceptBtn')}
                            </button>
                            <button
                              type="button"
                              disabled={rejectId === app._id}
                              onClick={() => handleReject(app._id)}
                              className="rounded-lg border border-red-400 px-4 py-2 text-sm text-red-500 hover:bg-red-50 disabled:opacity-60"
                            >
                              {rejectId === app._id
                                ? '…'
                                : t('rejectBtn4')}
                            </button>
                          </div>
                        )}
                        {app.status === 'active' && app.contractId && (
                          <div className="flex flex-col items-stretch gap-2 lg:items-end">
                            {contractStatusBadge(app)}
                            <button
                              type="button"
                              onClick={() => goToContract(app)}
                              className="rounded-lg border border-blue-700 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                            >
                              {t('viewContractBtn')}
                            </button>
                          </div>
                        )}
                        {app.status === 'accepted' && (
                          <>
                            {app.canCancelAccept && (
                              <button
                                type="button"
                                disabled={cancelId === app._id}
                                onClick={() =>
                                  handleCancelAccept(app._id)
                                }
                                className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-500 hover:bg-red-50 disabled:opacity-60"
                              >
                                {cancelId === app._id
                                  ? '…'
                                  : t('cancelAcceptBtn')}
                              </button>
                            )}
                            {app.contractId ? (
                              <div className="flex flex-col items-stretch gap-2 lg:items-end">
                                {contractStatusBadge(app)}
                                <button
                                  type="button"
                                  onClick={() => goToContract(app)}
                                  className="rounded-lg border border-blue-700 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                                >
                                  {t('viewContractBtn')}
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/owner/create-contract?jobId=${app.jobId?._id || app.jobId}&driverId=${app.driverId?._id || app.driverId}`
                                  )
                                }
                                className="rounded-lg bg-blue-700 px-4 py-2 text-sm text-white hover:bg-blue-800"
                              >
                                {t('createContract')}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
              </ul>

              {terminatedApps.length > 0 ? (
                <div className="border-t pt-6 mt-6">
                  <h2 className="mb-3 text-lg font-semibold text-gray-600">
                    {t('oldDrivers')}
                  </h2>
                  <div className="space-y-3">
                    {terminatedApps.map((app) => {
                      const d = app.driverId
                      const job = app.jobId
                      const name = d?.name || 'Driver'
                      return (
                        <div
                          key={app._id}
                          className="rounded-2xl bg-gray-50 p-5 border border-gray-100 mb-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex gap-3">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-700">
                                {driverInitials(name)}
                              </div>
                              <div>
                                <p className="text-gray-600 font-medium">
                                  {name}
                                </p>
                                <p className="text-sm text-gray-400">
                                  {d?.phone || '—'}
                                </p>
                                <p className="mt-1 text-sm text-gray-400">
                                  {job?.title || 'Job'}
                                </p>
                              </div>
                            </div>
                            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full">
                              {t('resignedLabel')}
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={profileLoadingId === app._id}
                              onClick={() => handleViewProfile(app)}
                              className="border border-gray-300 text-gray-600 text-xs px-3 py-1 rounded-lg hover:bg-white disabled:opacity-60"
                            >
                              {profileLoadingId === app._id
                                ? t('loading')
                                : t('profileViewBtn')}
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate('/owner/messages')}
                              className="border border-gray-300 text-gray-600 text-xs px-3 py-1 rounded-lg hover:bg-white"
                            >
                              {t('messageBtn2')}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>

      {showModal && (
        <DriverProfileModal
          driver={selectedDriver}
          driverProfileData={driverProfileData}
          selectedApplication={selectedApplication}
          applicationStatus={selectedApplication?.status}
          onClose={() => {
            setShowModal(false)
            setSelectedDriver(null)
            setSelectedApplication(null)
            setDriverProfileData(null)
          }}
          onAccept={async () => {
            if (!selectedApplication?._id) return
            setAcceptId(selectedApplication._id)
            try {
              await acceptApplication(selectedApplication._id)
              toast.success(t('driverAccepted'))
              setShowModal(false)
              setSelectedDriver(null)
              setSelectedApplication(null)
              setDriverProfileData(null)
              await loadData()
            } catch (e) {
              toast.error(
                e.response?.data?.message ||
                  t('acceptError2')
              )
            } finally {
              setAcceptId(null)
            }
          }}
          onReject={async () => {
            if (!selectedApplication?._id) return
            setRejectId(selectedApplication._id)
            try {
              await rejectApplication(selectedApplication._id)
              toast.success(t('applicationRejected'))
              setShowModal(false)
              setSelectedDriver(null)
              setSelectedApplication(null)
              setDriverProfileData(null)
              await loadData()
            } catch (e) {
              toast.error(
                e.response?.data?.message ||
                  t('rejectError3')
              )
            } finally {
              setRejectId(null)
            }
          }}
          acceptLoading={
            acceptId === selectedApplication?._id ||
            rejectId === selectedApplication?._id
          }
        />
      )}
    </div>
  )
}

export default OwnerApplications
