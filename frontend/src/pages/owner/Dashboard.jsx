import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getUser } from '../../utils/helpers'
import { getMyRatings } from '../../api/ratingAPI'
import { getVehicles } from '../../api/ownerAPI'

const OwnerDashboard = () => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeDrivers: 0,
    openJobs: 0,
    pendingComplaints: 0,
    avgRating: 0,
    ratingCount: 0,
  })
  const [applicationsBadge] = useState(0)
  const [vacantVehicles, setVacantVehicles] = useState([])
  const [showBanner, setShowBanner] = useState(true)

  useEffect(() => {
    setUser(getUser())
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getVehicles()
        const list = res.data?.vehicles || []
        const vacant = list.filter((v) => {
          const isActive = v?.isActive === true || v?.active === true
          const noDriver =
            v?.assignedDriver === null || v?.assignedDriver === undefined
          return isActive && noDriver
        })
        if (!cancelled) setVacantVehicles(vacant)
      } catch (e) {
        if (!cancelled) setVacantVehicles([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getMyRatings()
        if (cancelled) return
        setStats((s) => ({
          ...s,
          avgRating: Number(res.data?.avgScore) || 0,
          ratingCount: res.data?.totalRatings ?? 0,
        }))
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const profileIncomplete =
    user != null && user.isProfileComplete !== true

  return (
    <div className="min-h-screen bg-gray-50">
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
                      • {v.vehicleType} — {v.vehicleNumber || '—'}
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

          <div className="mb-2">
            <h2 className="text-2xl font-bold text-gray-800">
              Namaste, {user?.name || 'Owner'}! 👋
            </h2>
            <p className="text-sm text-gray-500">Aaj ka overview</p>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xl">
                🚛
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalVehicles}
                </p>
                <p className="text-sm text-gray-500">Total Gadiyaan</p>
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
                <p className="text-sm text-gray-500">Active Drivers</p>
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
                <p className="text-sm text-gray-500">Open Jobs</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-red-100 bg-red-50 text-xl">
                ⚠️
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.pendingComplaints}
                </p>
                <p className="text-sm text-gray-500">Complaints</p>
              </div>
            </div>
            <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-100 bg-amber-50 text-xl">
                ⭐
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.avgRating.toFixed(1)}
                </p>
                <p className="text-sm text-gray-500">
                  Avg Rating ({stats.ratingCount})
                </p>
              </div>
            </div>
          </div>

          {/* Two columns */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-800">Recent Jobs</h3>
                <Link
                  to="/owner/post-job"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Job Post Karo
                </Link>
              </div>
              <p className="py-8 text-center text-gray-400">
                Abhi koi job post nahi ki
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-800">
                  Nayi Applications
                </h3>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  {applicationsBadge}
                </span>
              </div>
              <p className="py-8 text-center text-gray-400">
                Koi application nahi aayi abhi
              </p>
            </div>
          </div>
        </div>
    </div>
  )
}

export default OwnerDashboard
