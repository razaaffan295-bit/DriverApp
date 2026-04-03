import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getDriverApplications } from '../../api/driverAPI'
import { getDriverActiveContract } from '../../api/contractAPI'

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

const DriverApplications = () => {
  const navigate = useNavigate()
  const [applications, setApplications] = useState([])
  const [activeContract, setActiveContract] = useState(null)
  const [filter, setFilter] = useState('sab')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [appsRes, contractRes] = await Promise.all([
        getDriverApplications(),
        getDriverActiveContract().catch(() => ({ data: { contract: null } })),
      ])
      setApplications(appsRes?.data?.applications ?? [])
      setActiveContract(contractRes?.data?.contract ?? null)
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Applications load nahi ho payeen.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const activeContractJobId = activeContract?.jobId?._id || activeContract?.jobId

  const getRealStatus = (app) => {
    if (app.status === 'terminated') return 'terminated'
    if (app.status === 'active') {
      const appJobId = app.jobId?._id || app.jobId
      if (activeContractJobId && String(activeContractJobId) === String(appJobId)) {
        return 'active'
      }
      return 'terminated'
    }
    return app.status
  }

  const filtered =
    filter === 'sab'
      ? applications
      : filter === 'active'
        ? applications.filter((a) => {
            const real = getRealStatus(a)
            if (real !== 'active') return false
            const appJobId = a.jobId?._id || a.jobId
            return (
              activeContractJobId &&
              String(activeContractJobId) === String(appJobId)
            )
          })
        : applications.filter((a) => getRealStatus(a) === filter)

  const statusBlock = (status) => {
    if (status === 'pending') {
      return (
        <div className="rounded-lg bg-yellow-100 px-3 py-2 text-sm text-yellow-700">
          ⏳ Owner ka reply aane ka wait karein
        </div>
      )
    }
    if (status === 'accepted') {
      return (
        <div className="space-y-2">
          <div className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-700">
            ✅ Congratulations! Accept ho gaye
          </div>
          <Link
            to="/driver/active-job"
            className="inline-block rounded-lg border border-green-600 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
          >
            Joining Letter / Active Kaam
          </Link>
        </div>
      )
    }
    if (status === 'active') {
      return (
        <div className="space-y-2">
          <div className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-800">
            ✅ Kaam chal raha hai
          </div>
          <Link
            to="/driver/active-job"
            className="inline-block rounded-lg border border-emerald-600 px-4 py-2 text-sm text-emerald-800 hover:bg-emerald-50"
          >
            Active Kaam Dekho
          </Link>
        </div>
      )
    }
    if (status === 'terminated') {
      return (
        <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
          Kaam Khatam — Resign Ho Gayi
        </div>
      )
    }
    return (
      <div className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-500">
        ❌ Is baar nahi hua, doosri jobs try karein
      </div>
    )
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
      <div className="p-4 md:p-6 pb-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {[
            { key: 'sab', label: 'Sab' },
            { key: 'pending', label: 'Pending' },
            { key: 'accepted', label: 'Accepted' },
            { key: 'active', label: 'Active' },
            { key: 'rejected', label: 'Rejected' },
            { key: 'terminated', label: 'Terminated' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                filter === key
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center">
            <p className="text-gray-700">
              Aapne abhi koi job apply nahi ki
            </p>
            <Link
              to="/driver/jobs"
              className="mt-4 inline-block rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Jobs Dhundho
            </Link>
          </div>
        ) : (
          <ul>
            {filtered.map((app) => {
              const realStatus = getRealStatus(app)
              const job = app.jobId
              const owner = app.ownerId
              const title = job?.title || 'Job'
              return (
                <li
                  key={app._id}
                  className={`mb-4 rounded-2xl border p-5 ${
                    realStatus === 'terminated'
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2
                      className={`text-lg font-semibold ${
                        realStatus === 'terminated'
                          ? 'text-gray-600'
                          : 'text-gray-900'
                      }`}
                    >
                      {title}
                    </h2>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      {job?.vehicleType || '—'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-600">
                    👤 {owner?.name || 'Owner'}
                  </p>
                  <p className="text-sm text-gray-600">
                    📍 {owner?.location?.state},{' '}
                    {owner?.location?.district}
                  </p>
                  <p className="text-sm text-gray-600">
                    ₹{job?.salaryPerDay ?? '—'}/din
                  </p>
                  <p className="text-sm text-gray-600">
                    {job?.duration ?? '—'} din
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    Applied {formatApplied(app.appliedAt)}
                  </p>
                  <div className="mt-4">
                    {realStatus === 'terminated' ? (
                      <div className="bg-gray-100 text-gray-500 text-xs px-2 py-1 rounded-full inline-block">
                        Kaam Khatam — Resign Ho Gayi
                      </div>
                    ) : (
                      statusBlock(realStatus)
                    )}
                  </div>

                  {realStatus === 'terminated' ? null : app.status === 'rejected' ? (
                    <span className="mt-2 block text-xs italic text-gray-400">
                      Message option band hai
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate('/driver/messages')}
                      className="mt-3 rounded-lg border border-green-400 px-3 py-1 text-sm text-green-600 hover:bg-green-50"
                    >
                      Message Karo
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default DriverApplications
