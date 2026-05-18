import { useEffect, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { getUser } from '../../utils/helpers'
import { getPaymentSummary } from '../../api/paymentAPI'
import { getDriverActiveContract } from '../../api/contractAPI'
import { getDriverApplications as getMyApplications } from '../../api/driverAPI'
import { getMyRatings } from '../../api/ratingAPI'
import { driverGetRecords as getDriverAttendance } from '../../api/attendanceAPI'
import { getDriverInvites } from '../../api/inviteAPI'
import { useDataCache } from '../../contexts/DataCacheContext'

const formatStartDate = (c) => {
  const d = c?.startDate || c?.jobId?.startDate
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('hi-IN')
  } catch {
    return '—'
  }
}

const DriverDashboard = () => {
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [summary, setSummary] = useState(null)
  const [contract, setContract] = useState(null)
  const [applications, setApplications] = useState([])
  const [attendance, setAttendance] = useState(null)
  const [loading, setLoading] = useState(true)
  const [inviteCount, setInviteCount] = useState(0)
  const [stats, setStats] = useState({
    avgRating: 0,
    ratingCount: 0,
  })
  const { getCachedData, setCachedData } = useDataCache()

  const jobSalaryLabel = useCallback((job) => {
    if (!job) return '—'
    if (job.salaryPerMonth != null && job.salaryPerMonth > 0) {
      return `₹${job.salaryPerMonth}/${t('perMonth') || 'mahina'}`
    }
    if (job.salaryPerDay != null && job.salaryPerDay > 0) {
      return `₹${job.salaryPerDay}/${t('perDay') || 'din'}`
    }
    return '—'
  }, [t])

  const { thisMonth, thisYear } = useMemo(() => {
    const now = new Date()
    return {
      thisMonth: now.getMonth() + 1,
      thisYear: now.getFullYear(),
    }
  }, [])

  useEffect(() => {
    setUser(getUser())
  }, [])

  useEffect(() => {
    const loadFresh = async (silent) => {
      const m = new Date().getMonth() + 1
      const y = new Date().getFullYear()
      try {
        if (!silent) setLoading(true)

        const [
          summaryRes,
          contractRes,
          appsRes,
          ratingsRes,
          attendanceRes,
          invitesRes,
        ] = await Promise.allSettled([
          getPaymentSummary(),
          getDriverActiveContract(),
          getMyApplications(),
          getMyRatings(),
          getDriverAttendance({ month: m, year: y }),
          getDriverInvites(),
        ])

        let nextSummary = null
        let nextContract = null
        let nextApplications = []
        let nextAttendance = null
        let nextInviteCount = 0
        let nextStats = {
          avgRating: 0,
          ratingCount: 0,
        }

        if (invitesRes.status === 'fulfilled') {
          nextInviteCount =
            (invitesRes.value.data?.invites || []).length
          setInviteCount(nextInviteCount)
        }

        if (summaryRes.status === 'fulfilled') {
          nextSummary = summaryRes.value.data?.summary
          setSummary(nextSummary)
        }
        if (contractRes.status === 'fulfilled') {
          nextContract = contractRes.value.data?.contract
          setContract(nextContract)
        }
        if (appsRes.status === 'fulfilled') {
          nextApplications =
            appsRes.value.data?.applications || []
          setApplications(nextApplications)
        }
        if (ratingsRes.status === 'fulfilled') {
          nextStats = {
            avgRating: ratingsRes.value.data?.avgScore || 0,
            ratingCount: ratingsRes.value.data?.totalRatings || 0,
          }
          setStats(nextStats)
        }
        if (attendanceRes.status === 'fulfilled') {
          nextAttendance = attendanceRes.value.data
          setAttendance(nextAttendance)
        }

        setCachedData('driver_dashboard', {
          summary: nextSummary,
          contract: nextContract,
          applications: nextApplications,
          attendance: nextAttendance,
          inviteCount: nextInviteCount,
          stats: nextStats,
        })
      } catch (err) {
        // Silent fail - Promise.allSettled handles individual errors
      } finally {
        if (!silent) setLoading(false)
      }
    }

    const loadAll = async () => {
      const cached = getCachedData('driver_dashboard')
      if (cached) {
        setSummary(cached.summary ?? null)
        setContract(cached.contract ?? null)
        setApplications(cached.applications || [])
        setAttendance(cached.attendance ?? null)
        setInviteCount(cached.inviteCount || 0)
        setStats(cached.stats || { avgRating: 0, ratingCount: 0 })
        setLoading(false)
        loadFresh(true)
        return
      }
      loadFresh(false)
    }

    loadAll()
  }, [])

  const profileIncomplete = useMemo(
    () => user != null && user.isProfileComplete !== true,
    [user]
  )

  const monthEarned = useMemo(
    () =>
      summary?.attendance?.find(
        (x) => x.month === thisMonth && x.year === thisYear
      )?.totalSalaryEarned ?? 0,
    [summary, thisMonth, thisYear]
  )

  const netDueRaw = useMemo(
    () =>
      summary?.netDue != null
        ? summary.netDue
        : Math.max(
            0,
            (summary?.totalSalaryEarned || 0) -
              (summary?.totalPaid || 0)
          ),
    [summary]
  )

  const pendingConfirmCount = useMemo(
    () => summary?.pendingPayments?.length || 0,
    [summary]
  )

  const recentApps = useMemo(
    () => applications.slice(0, 3),
    [applications]
  )

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
      <div className="p-4 md:p-6">
        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center">
            <div
              className="h-10 w-10 animate-spin rounded-full border-4 border-green-200 border-t-green-600"
              role="status"
              aria-label={t('loading')}
            />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                {t('greeting')}, {user?.name || t('driver')}!{' '}
                <span aria-hidden="true">👋</span>
              </h2>
              <p className="text-sm text-gray-500">{t('todayOverview')}</p>
              {inviteCount > 0 ? (
                <Link
                  to="/driver/invites"
                  className="mt-1 inline-block text-sm font-medium text-green-700 hover:text-green-800"
                >
                  {inviteCount} {t('newInvite')}
                </Link>
              ) : null}
            </div>

            {/* Row 1 stats */}
            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-green-100 bg-green-50 text-xl"
                  aria-hidden="true"
                >
                  🔧
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {contract ? 1 : 0}
                  </p>
                  <p className="text-sm text-gray-500">{t('activeWork')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xl"
                  aria-hidden="true"
                >
                  💰
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{summary ? monthEarned : 0}
                  </p>
                  <p className="text-sm text-gray-500">
                    {t('thisMonthEarnings')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-yellow-100 bg-yellow-50 text-xl"
                  aria-hidden="true"
                >
                  ⭐
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {Number(stats.avgRating || 0).toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {t('avgRating')} ({stats.ratingCount})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-purple-100 bg-purple-50 text-xl"
                  aria-hidden="true"
                >
                  📋
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {applications.length}
                  </p>
                  <p className="text-sm text-gray-500">
                    {t('totalApplications')}
                  </p>
                </div>
              </div>
            </div>

            {/* Row 2 stats */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div
                className={`flex items-center gap-3 rounded-2xl border bg-white p-4 md:gap-4 md:p-5 ${
                  netDueRaw > 0
                    ? 'border-red-200'
                    : 'border-green-200'
                }`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ${
                    netDueRaw > 0
                      ? 'border border-red-100 bg-red-50'
                      : 'border border-green-100 bg-green-50'
                  }`}
                  aria-hidden="true"
                >
                  💸
                </div>
                <div>
                  <p
                    className={`text-2xl font-bold ${
                      netDueRaw > 0 ? 'text-red-600' : 'text-green-600'
                    }`}
                  >
                    ₹{Math.max(0, netDueRaw)}
                  </p>
                  <p className="text-sm text-gray-500">{t('netDueLabel')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-100 bg-amber-50 text-xl"
                  aria-hidden="true"
                >
                  ⏳
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {pendingConfirmCount}
                  </p>
                  <p className="text-sm text-gray-500">
                    {t('pendingConfirmations')}
                  </p>
                </div>
              </div>
              <div className="flex min-h-[88px] flex-col justify-center gap-1 rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t('activeContract')}
                </p>
                {contract?.jobId ? (
                  <>
                    <p className="font-semibold text-gray-900">
                      {contract.jobId.title}
                    </p>
                    <p className="text-sm text-gray-600">
                      {contract.jobId.vehicleType}
                    </p>
                    <p className="text-sm text-green-600">
                      {t('workInProgress')}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    {t('noActiveJob')}
                  </p>
                )}
              </div>
              <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t('profile')}
                </p>
                {!profileIncomplete ? (
                  <p className="text-sm font-medium text-green-700">
                    {t('profileComplete')}
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-amber-700">
                      {t('profileIncomplete') || 'Profile Incomplete'}{' '}
                      <span aria-hidden="true">⚠️</span>
                    </p>
                    <Link
                      to="/driver/profile"
                      className="text-sm font-semibold text-green-600 hover:text-green-700"
                    >
                      {t('profile')}{' '}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Two columns — Recent jobs + applications */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-800">
                    {t('newJobs')}
                  </h3>
                  <Link
                    to="/driver/jobs"
                    className="text-sm font-medium text-green-600 hover:text-green-700"
                  >
                    {t('seeAll')}
                  </Link>
                </div>
                <p className="py-8 text-center text-gray-400">
                  {t('noJobsAvailable')}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-800">
                    {t('myApplications')}
                  </h3>
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                    {applications.length}
                  </span>
                </div>
                {recentApps.length === 0 ? (
                  <p className="py-8 text-center text-gray-400">
                    {t('noApplicationsYet')}
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {recentApps.map((a) => (
                      <div
                        key={a._id}
                        className="flex items-center justify-between gap-2 py-3 first:pt-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 text-sm">
                            {a.jobId?.title || t('job')}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {a.jobId?.vehicleType || '—'}
                          </p>
                        </div>
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                          style={{
                            background:
                              a.status === 'accepted'
                                ? '#DCFCE7'
                                : a.status === 'rejected'
                                  ? '#FEE2E2'
                                  : '#FEF3C7',
                            color:
                              a.status === 'accepted'
                                ? '#16A34A'
                                : a.status === 'rejected'
                                  ? '#EF4444'
                                  : '#D97706',
                          }}
                        >
                          {a.status === 'accepted'
                            ? t('approved')
                            : a.status === 'rejected'
                              ? t('rejected')
                              : a.status === 'active'
                                ? t('active')
                                : t('pending')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {profileIncomplete && (
              <div className="mt-6 mb-6 flex flex-col gap-4 rounded-2xl border border-green-200 bg-green-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-green-800">
                    <span aria-hidden="true">📝</span>{' '}
                    {t('profileIncompleteMsg')}
                  </p>
                  <p className="mt-1 text-sm text-green-600">
                    {t('addDocumentsSkills')}
                  </p>
                </div>
                <Link
                  to="/driver/profile"
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  {t('completeProfileBtn')}
                </Link>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5">
              <h3 className="mb-3 font-semibold text-gray-800">
                {t('activeJob')}
              </h3>
              {contract?.jobId ? (
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {contract.jobId.title}
                    </p>
                    <p className="text-sm text-gray-600">
                      {contract.jobId.vehicleType} ·{' '}
                      {jobSalaryLabel(contract.jobId)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t('startDate')}: {formatStartDate(contract)}
                    </p>
                    {attendance?.summary != null && (
                      <p className="mt-1 text-xs text-gray-500">
                        {t('thisMonthPresent')}:{' '}
                        {attendance.summary.presentDays || 0}{' '}
                        {t('daysPresent')}
                        {attendance.summary.grossTotal
                          ? ` · ₹${attendance.summary.grossTotal}`
                          : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/driver/attendance"
                      className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                      {t('attendance')}
                    </Link>
                    <Link
                      to="/driver/payments"
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-100"
                    >
                      {t('payments')}
                    </Link>
                    <Link
                      to="/driver/messages"
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-100"
                    >
                      {t('messages')}
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-gray-400">
                  {t('noActiveJob')}
                </p>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  )
}

export default DriverDashboard
