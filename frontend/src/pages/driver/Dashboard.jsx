import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUser } from '../../utils/helpers'
import { getMyRatings } from '../../api/ratingAPI'
import { getDriverInvites } from '../../api/inviteAPI'

const DriverDashboard = () => {
  const [user, setUser] = useState(null)
  const [stats, setStats] = useState({
    activeJob: 0,
    monthlyEarning: 0,
    rating: 0,
    totalRatings: 0,
    totalApplications: 0,
  })
  const [inviteCount, setInviteCount] = useState(0)

  useEffect(() => {
    setUser(getUser())
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await getMyRatings()
        if (cancelled) return
        setStats((s) => ({
          ...s,
          rating: Number(res.data?.avgScore) || 0,
          totalRatings: res.data?.totalRatings ?? 0,
        }))
      } catch {
        /* ignore */
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
        const res = await getDriverInvites()
        if (cancelled) return
        setInviteCount((res.data?.invites || []).length)
      } catch {
        if (!cancelled) setInviteCount(0)
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
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Namaste, {user?.name || 'Driver'}! 👋
            </h2>
            <p className="text-sm text-gray-500">Aaj ka overview</p>
          </div>

          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-green-100 bg-green-50 text-xl">
                🔧
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.activeJob}
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
                  ₹{stats.monthlyEarning}
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
                  {Number(stats.rating).toFixed(1)}
                </p>
                <p className="text-sm text-gray-500">
                  Avg Rating ({stats.totalRatings})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 md:gap-4 md:p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-purple-100 bg-purple-50 text-xl">
                📋
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalApplications}
                </p>
                <p className="text-sm text-gray-500">Total Applications</p>
              </div>
            </div>
          </div>

          {/* Two columns */}
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
                  {stats.totalApplications}
                </span>
              </div>
              <p className="py-8 text-center text-gray-400">
                Aapne abhi koi job apply nahi ki
              </p>
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

          {stats.activeJob > 0 ? (
            <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5">
              <h3 className="font-semibold text-gray-800">Active Kaam</h3>
              <p className="py-8 text-center text-gray-400">
                Details baad mein add hongi
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-gray-100 bg-white p-5">
              <h3 className="font-semibold text-gray-800">Active Kaam</h3>
              <p className="py-8 text-center text-gray-400">
                Abhi koi active kaam nahi
              </p>
            </div>
          )}
        </div>
    </div>
  )
}

export default DriverDashboard
