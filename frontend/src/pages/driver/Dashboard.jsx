import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUser } from '../../utils/helpers'
import { getPaymentSummary } from '../../api/paymentAPI'
import { getDriverActiveContract } from '../../api/contractAPI'
import { getDriverApplications as getMyApplications } from '../../api/driverAPI'
import { getMyRatings } from '../../api/ratingAPI'
import { driverGetRecords as getDriverAttendance } from '../../api/attendanceAPI'
import { getDriverInvites } from '../../api/inviteAPI'

const DriverDashboard = () => {
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

  const thisMonth = new Date().getMonth() + 1
  const thisYear = new Date().getFullYear()

  useEffect(() => {
    setUser(getUser())
  }, [])

  useEffect(() => {
    const loadAll = async () => {
      const m = new Date().getMonth() + 1
      const y = new Date().getFullYear()
      try {
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
        if (invitesRes.status === 'fulfilled') {
          setInviteCount(
            (invitesRes.value.data?.invites || []).length
          )
        }

        if (summaryRes.status === 'fulfilled') {
          setSummary(summaryRes.value.data?.summary)
        }
        if (contractRes.status === 'fulfilled') {
          setContract(contractRes.value.data?.contract)
        }
        if (appsRes.status === 'fulfilled') {
          setApplications(appsRes.value.data?.applications || [])
        }
        if (ratingsRes.status === 'fulfilled') {
          setStats((s) => ({
            ...s,
            avgRating: ratingsRes.value.data?.avgScore || 0,
            ratingCount: ratingsRes.value.data?.totalRatings || 0,
          }))
        }
        if (attendanceRes.status === 'fulfilled') {
          setAttendance(attendanceRes.value.data)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  const profileIncomplete =
    user != null && user.isProfileComplete !== true

  const monthEarned =
    summary?.attendance?.find(
      (x) => x.month === thisMonth && x.year === thisYear
    )?.totalSalaryEarned ?? 0

  const netDueRaw =
    summary?.netDue != null
      ? summary.netDue
      : Math.max(
          0,
          (summary?.totalSalaryEarned || 0) - (summary?.totalPaid || 0)
        )

  const pendingConfirmCount = summary?.pendingPayments?.length || 0

  const recentApps = applications.slice(0, 3)

  const jobSalaryLabel = (job) => {
    if (!job) return '—'
    if (job.salaryPerMonth != null && job.salaryPerMonth > 0) {
      return `₹${job.salaryPerMonth}/mahina`
    }
    if (job.salaryPerDay != null && job.salaryPerDay > 0) {
      return `₹${job.salaryPerDay}/din`
    }
    return '—'
  }

  const startDateLabel = (c) => {
    const d = c?.startDate || c?.jobId?.startDate
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString('hi-IN')
    } catch {
      return '—'
    }
  }

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
              aria-label="Loading"
            />
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">
                Namaste, {user?.name || 'Driver'}! 👋
              </h2>
              <p className="text-sm text-gray-500">Aaj ka overview</p>
              {inviteCount > 0 ? (
                <Link
                  to="/driver/invites"
                  className="mt-1 inline-block text-sm font-medium text-green-700 hover:text-green-800"
                >
                  {inviteCount} naya invite — dekhein
                </Link>
              ) : null}
            </div>

            {/* Row 1 stats */}
            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-green-100 bg-green-50 text-xl">
                  🔧
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {contract ? 1 : 0}
                  </p>
                  <p className="text-sm text-gray-500">Active Kaam</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xl">
                  💰
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{summary ? monthEarned : 0}
                  </p>
                  <p className="text-sm text-gray-500">Is Mahine Kamayi</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-yellow-100 bg-yellow-50 text-xl">
                  ⭐
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {Number(stats.avgRating || 0).toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Avg Rating ({stats.ratingCount})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-purple-100 bg-purple-50 text-xl">
                  📋
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {applications.length}
                  </p>
                  <p className="text-sm text-gray-500">Total Applications</p>
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
                  <p className="text-sm text-gray-500">Net Due (baaki)</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-100 bg-amber-50 text-xl">
                  ⏳
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {pendingConfirmCount}
                  </p>
                  <p className="text-sm text-gray-500">
                    pending confirmations
                  </p>
                </div>
              </div>
              <div className="flex min-h-[88px] flex-col justify-center gap-1 rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Active Contract
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
                      Kaam chal raha hai ✅
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    Koi active kaam nahi
                  </p>
                )}
              </div>
              <div className="flex min-h-[88px] flex-col justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 md:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Profile
                </p>
                {!profileIncomplete ? (
                  <p className="text-sm font-medium text-green-700">
                    Profile Complete ✅
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-amber-700">
                      Profile Incomplete ⚠️
                    </p>
                    <Link
                      to="/driver/profile"
                      className="text-sm font-semibold text-green-600 hover:text-green-700"
                    >
                      Profile →
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Two columns — Recent jobs + applications */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-800">Nayi Jobs</h3>
                  <Link
                    to="/driver/jobs"
                    className="text-sm font-medium text-green-600 hover:text-green-700"
                  >
                    Sab Dekho
                  </Link>
                </div>
                <p className="py-8 text-center text-gray-400">
                  Abhi koi job available nahi
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-800">
                    Meri Applications
                  </h3>
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                    {applications.length}
                  </span>
                </div>
                {recentApps.length === 0 ? (
                  <p className="py-8 text-center text-gray-400">
                    Aapne abhi koi job apply nahi ki
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
                            {a.jobId?.title || 'Job'}
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
                          {a.status}
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
                    📝 Profile incomplete hai
                  </p>
                  <p className="mt-1 text-sm text-green-600">
                    Documents aur skills add karein
                  </p>
                </div>
                <Link
                  to="/driver/profile"
                  className="inline-flex shrink-0 items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Profile Complete Karein
                </Link>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5">
              <h3 className="mb-3 font-semibold text-gray-800">
                Active Kaam
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
                      Start: {startDateLabel(contract)}
                    </p>
                    {attendance?.summary != null && (
                      <p className="mt-1 text-xs text-gray-500">
                        Is mahine: {attendance.summary.presentDays || 0}{' '}
                        din present
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
                      Attendance
                    </Link>
                    <Link
                      to="/driver/payments"
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-100"
                    >
                      Payments
                    </Link>
                    <Link
                      to="/driver/messages"
                      className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-100"
                    >
                      Messages
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-gray-400">
                  Abhi koi active kaam nahi
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
