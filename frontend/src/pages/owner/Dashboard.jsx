import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getUser } from '../../utils/helpers'
import { getMyRatings } from '../../api/ratingAPI'
import { getVehicles, getOwnerJobs } from '../../api/ownerAPI'
import { getOwnerApplications as getApplications } from '../../api/ownerAPI'
import { getOwnerContracts } from '../../api/contractAPI'
import { getMyComplaints } from '../../api/complaintAPI'
import { getPayments } from '../../api/paymentAPI'

const OwnerDashboard = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [contracts, setContracts] = useState([])
  const [jobs, setJobs] = useState([])
  const [applications, setApplications] = useState([])
  const [complaints, setComplaints] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeDrivers: 0,
    openJobs: 0,
    pendingComplaints: 0,
    avgRating: 0,
    ratingCount: 0,
  })
  const [vacantVehicles, setVacantVehicles] = useState([])
  const [showBanner, setShowBanner] = useState(true)

  const thisMonth = new Date().getMonth() + 1
  const thisYear = new Date().getFullYear()

  useEffect(() => {
    setUser(getUser())
  }, [])

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [
          contractsRes,
          jobsRes,
          appsRes,
          complaintsRes,
          vehiclesRes,
          ratingsRes,
        ] = await Promise.allSettled([
          getOwnerContracts(),
          getOwnerJobs(),
          getApplications(),
          getMyComplaints(),
          getVehicles(),
          getMyRatings(),
        ])

        let contractsList = []

        if (contractsRes.status === 'fulfilled') {
          contractsList =
            contractsRes.value.data?.contracts || []
          setContracts(contractsList)
          const active = contractsList.filter(
            (c) => c.status === 'active'
          )
          setStats((s) => ({
            ...s,
            activeDrivers: active.length,
          }))
        }

        if (jobsRes.status === 'fulfilled') {
          const list = jobsRes.value.data?.jobs || []
          setJobs(list)
          setStats((s) => ({
            ...s,
            openJobs: list.filter((j) => j.status === 'open')
              .length,
          }))
        }

        if (appsRes.status === 'fulfilled') {
          setApplications(
            appsRes.value.data?.applications || []
          )
        }

        if (complaintsRes.status === 'fulfilled') {
          const list =
            complaintsRes.value.data?.complaints || []
          setComplaints(list)
          setStats((s) => ({
            ...s,
            pendingComplaints: list.filter(
              (c) => c.status === 'pending'
            ).length,
          }))
        }

        if (vehiclesRes.status === 'fulfilled') {
          const list = vehiclesRes.value.data?.vehicles || []
          setStats((s) => ({
            ...s,
            totalVehicles: list.length,
          }))
          const vacant = list.filter((v) => {
            const isActive =
              v?.isActive === true || v?.active === true
            const noDriver =
              v?.assignedDriver === null ||
              v?.assignedDriver === undefined
            return isActive && noDriver
          })
          setVacantVehicles(vacant)
        }

        if (ratingsRes.status === 'fulfilled') {
          setStats((s) => ({
            ...s,
            avgRating:
              ratingsRes.value.data?.avgScore || 0,
            ratingCount:
              ratingsRes.value.data?.totalRatings || 0,
          }))
        }

        const paymentResults = await Promise.allSettled(
          contractsList.map((c) =>
            getPayments({ contractId: c._id })
          )
        )
        const merged = []
        for (const pr of paymentResults) {
          if (
            pr.status === 'fulfilled' &&
            pr.value?.data?.payments
          ) {
            merged.push(...pr.value.data.payments)
          }
        }
        setPayments(merged)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  const thisMonthPayments = payments.filter(
    (p) =>
      p.month === thisMonth &&
      p.year === thisYear &&
      p.driverConfirmed === true
  )

  const thisMonthTotal = thisMonthPayments.reduce(
    (sum, p) => sum + (p.amount || 0),
    0
  )

  const pendingPayments = payments.filter(
    (p) =>
      p.status === 'pending' &&
      p.isDriverRequested &&
      !p.ownerMarkedPaid
  )

  const newApps = applications.filter((a) => {
    const raw = a.appliedAt || a.createdAt
    if (!raw) return false
    const d = new Date(raw)
    const now = new Date()
    return now - d < 7 * 24 * 60 * 60 * 1000
  })

  const profileIncomplete =
    user != null && user.isProfileComplete !== true

  const recentJobs = jobs.slice(0, 3)
  const recentApps = applications.slice(0, 3)

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
      <div className="p-4 md:p-6">
        {showBanner && vacantVehicles.length > 0 ? (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-orange-800 font-bold mb-1">
                🚛 Khali Gadi Alert!
              </p>
              <div className="mt-2 space-y-1 text-sm text-orange-600">
                {vacantVehicles.map((v) => (
                  <div key={v._id} className="truncate">
                    • {v.vehicleType} —{' '}
                    {v.vehicleNumber || '—'}
                  </div>
                ))}
              </div>
              <p className="text-orange-500 text-xs mt-1">
                Naya driver hire karein!
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <button
                type="button"
                onClick={() => navigate('/owner/post-job')}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Naya Driver Hire Karein
              </button>
              <button
                type="button"
                onClick={() => setShowBanner(false)}
                className="self-start text-sm font-semibold text-orange-700 hover:text-orange-900 sm:self-end"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ) : null}
        {profileIncomplete && (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-yellow-800">
                ⚠️ Profile incomplete hai
              </p>
              <p className="mt-1 text-sm text-yellow-600">
                Apni gadiyaan aur details add karein
              </p>
            </div>
            <Link
              to="/owner/profile"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600"
            >
              Profile Complete Karein
            </Link>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <div
              className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"
              role="status"
              aria-label="Loading"
            />
          </div>
        ) : (
          <>
            <div className="mb-2">
              <h2 className="text-2xl font-bold text-gray-800">
                Namaste, {user?.name || 'Owner'}! 👋
              </h2>
              <p className="text-sm text-gray-500">
                Aaj ka overview
              </p>
            </div>

            {/* Stats row 1 */}
            <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xl">
                  🚛
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalVehicles}
                  </p>
                  <p className="text-sm text-gray-500">
                    Total Gadiyaan
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-green-100 bg-green-50 text-xl">
                  👷
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.activeDrivers}
                  </p>
                  <p className="text-sm text-gray-500">
                    Active Drivers
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-yellow-100 bg-yellow-50 text-xl">
                  💼
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.openJobs}
                  </p>
                  <p className="text-sm text-gray-500">
                    Open Jobs
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-100 bg-amber-50 text-xl">
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
              <div
                className={`flex items-center gap-4 rounded-2xl border bg-white p-5 ${
                  stats.pendingComplaints > 0
                    ? 'border-red-200'
                    : 'border-gray-100'
                }`}
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ${
                    stats.pendingComplaints > 0
                      ? 'border border-red-100 bg-red-50'
                      : 'border border-red-100 bg-red-50'
                  }`}
                >
                  ⚠️
                </div>
                <div>
                  <p
                    className={`text-2xl font-bold ${
                      stats.pendingComplaints > 0
                        ? 'text-red-600'
                        : 'text-gray-900'
                    }`}
                  >
                    {stats.pendingComplaints}
                  </p>
                  <p className="text-sm text-gray-500">
                    Complaints
                  </p>
                </div>
              </div>
            </div>

            {/* Stats row 2 */}
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="flex flex-col justify-center rounded-2xl border border-gray-100 bg-white p-5">
                <p className="text-2xl font-bold text-gray-900">
                  ₹{thisMonthTotal}
                </p>
                <p className="text-sm text-gray-500">
                  Is Mahine Payments
                </p>
                <p className="text-xs text-gray-400">
                  {thisMonthPayments.length} payments
                </p>
              </div>
              <div
                className={`flex flex-col justify-center rounded-2xl border bg-white p-5 ${
                  pendingPayments.length > 0
                    ? 'border-orange-200'
                    : 'border-gray-100'
                }`}
              >
                <p
                  className={`text-2xl font-bold ${
                    pendingPayments.length > 0
                      ? 'text-orange-600'
                      : 'text-gray-900'
                  }`}
                >
                  {pendingPayments.length}
                </p>
                <p className="text-sm text-gray-500">
                  Pending Requests
                </p>
                <p className="text-xs text-orange-600">
                  Payment approve karo
                </p>
              </div>
              <div
                className={`flex flex-col justify-center rounded-2xl border bg-white p-5 ${
                  newApps.length > 0
                    ? 'border-blue-200'
                    : 'border-gray-100'
                }`}
              >
                <p
                  className={`text-2xl font-bold ${
                    newApps.length > 0
                      ? 'text-blue-600'
                      : 'text-gray-900'
                  }`}
                >
                  {newApps.length}
                </p>
                <p className="text-sm text-gray-500">
                  Nayi Applications
                </p>
                <p className="text-xs text-blue-600">
                  Last 7 din mein
                </p>
              </div>
              <div
                className={`flex flex-col justify-center rounded-2xl border bg-white p-5 ${
                  vacantVehicles.length > 0
                    ? 'border-red-200'
                    : 'border-gray-100'
                }`}
              >
                <p
                  className={`text-2xl font-bold ${
                    vacantVehicles.length > 0
                      ? 'text-red-600'
                      : 'text-gray-900'
                  }`}
                >
                  {vacantVehicles.length}
                </p>
                <p className="text-sm text-gray-500">
                  Khali Gadiyaan
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '24px',
              }}
            >
              <button
                type="button"
                onClick={() => navigate('/owner/post-job')}
                style={{
                  background: '#1D4ED8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
              >
                📝 Job Post Karo
              </button>

              <button
                type="button"
                onClick={() => navigate('/owner/applications')}
                style={{
                  background: '#F0F4FF',
                  color: '#1D4ED8',
                  border: '1px solid #BFDBFE',
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
              >
                📋 Applications Dekho
                {newApps.length > 0 ? (
                  <span
                    style={{
                      background: '#EF4444',
                      color: 'white',
                      borderRadius: '50%',
                      padding: '2px 6px',
                      fontSize: '11px',
                      marginLeft: '6px',
                    }}
                  >
                    {newApps.length}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => navigate('/owner/payments')}
                style={{
                  background: '#F0F4FF',
                  color: '#1D4ED8',
                  border: '1px solid #BFDBFE',
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
              >
                💰 Payments
                {pendingPayments.length > 0 ? (
                  <span
                    style={{
                      background: '#EF4444',
                      color: 'white',
                      borderRadius: '50%',
                      padding: '2px 6px',
                      fontSize: '11px',
                      marginLeft: '6px',
                    }}
                  >
                    {pendingPayments.length}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => navigate('/owner/drivers')}
                style={{
                  background: '#F0F4FF',
                  color: '#1D4ED8',
                  border: '1px solid #BFDBFE',
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                }}
              >
                👥 Mere Drivers
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-800">
                    Recent Jobs
                  </h3>
                  <Link
                    to="/owner/post-job"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Job Post Karo
                  </Link>
                </div>
                {recentJobs.length === 0 ? (
                  <p className="py-8 text-center text-gray-400">
                    Abhi koi job post nahi ki
                  </p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {recentJobs.map((j) => (
                      <div
                        key={j._id}
                        className="flex items-center justify-between gap-2 py-3 first:pt-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 text-sm">
                            {j.title}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {j.vehicleType} · {j.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-800">
                    Recent Applications
                  </h3>
                  <Link
                    to="/owner/applications"
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Sab Dekho
                  </Link>
                </div>
                {recentApps.length === 0 ? (
                  <p className="py-8 text-center text-gray-400">
                    Koi application nahi aayi abhi
                  </p>
                ) : (
                  <div>
                    {recentApps.map((a) => (
                      <div
                        key={a._id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '12px',
                          borderBottom: '1px solid #F3F4F6',
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontWeight: '600',
                              fontSize: '14px',
                            }}
                          >
                            {a.driverId?.name}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#9CA3AF',
                            }}
                          >
                            {a.jobId?.title}
                          </div>
                        </div>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '600',
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
          </>
        )}
      </div>
    </div>
  )
}

export default OwnerDashboard
