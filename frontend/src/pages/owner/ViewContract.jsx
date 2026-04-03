import { useState, useEffect, useCallback } from 'react'
import {
  Link,
  NavLink,
  useNavigate,
  useLocation,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { toast } from 'react-hot-toast'
import {
  MdDashboard,
  MdDirectionsCar,
  MdPostAdd,
  MdAssignment,
  MdGroups,
  MdCalendarMonth,
  MdPayments,
  MdWarning,
  MdStar,
  MdSettings,
  MdHome,
  MdWork,
  MdMenu,
  MdPerson,
  MdChat,
} from 'react-icons/md'
import { getUser, clearAuth } from '../../utils/helpers'
import { getContractById, completeContract } from '../../api/contractAPI'

const navInactive =
  'flex items-center gap-3 px-6 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50'
const navActive =
  'flex items-center gap-3 px-6 py-3 text-sm font-medium border-r-2 border-blue-700 bg-blue-50 text-blue-700'

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', to: '/owner/dashboard', Icon: MdDashboard },
  { id: 'profile', label: 'Profile', to: '/owner/profile', Icon: MdPerson },
  {
    id: 'vehicles',
    label: 'Meri Gadiyaan',
    to: '/owner/profile?tab=vehicles',
    Icon: MdDirectionsCar,
  },
  { id: 'post-job', label: 'Job Post Karo', to: '/owner/post-job', Icon: MdPostAdd },
  { id: 'my-jobs', label: 'Meri Jobs', to: '/owner/jobs', Icon: MdWork },
  { id: 'applications', label: 'Applications', to: '/owner/applications', Icon: MdAssignment },
  { id: 'messages', label: 'Messages', to: '/owner/messages', Icon: MdChat },
  { id: 'drivers', label: 'Mere Drivers', to: '/owner/drivers', Icon: MdGroups },
  { id: 'attendance', label: 'Attendance', to: '/owner/attendance', Icon: MdCalendarMonth },
  { id: 'payments', label: 'Payments', to: '/owner/payments', Icon: MdPayments },
  { id: 'complaints', label: 'Complaints', to: '/owner/complaints', Icon: MdWarning },
  { id: 'ratings', label: 'Ratings', to: '/owner/ratings', Icon: MdStar },
  { id: 'settings', label: 'Settings', Icon: MdSettings },
]

const ViewContract = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [user, setUser] = useState(null)
  const [contract, setContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  const handlePrint = () => {
    window.print()
  }

  const profileNavActive =
    location.pathname === '/owner/profile' &&
    searchParams.get('tab') !== 'vehicles'
  const vehiclesNavActive =
    location.pathname === '/owner/profile' &&
    searchParams.get('tab') === 'vehicles'

  const placeholderNav = () => {
    // no placeholder toasts in navigation
  }

  useEffect(() => {
    setUser(getUser())
  }, [])

  const formatDate = (date) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const fetchContract = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      const res = await getContractById(id)
      setContract(res.data?.contract ?? null)
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Contract load nahi hua'
      )
      setContract(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchContract()
  }, [fetchContract])

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
    toast.success('Logout ho gaye!')
  }

  const handleComplete = async () => {
    if (!contract?._id) return
    if (
      !window.confirm(
        'Kya aap sure hain? Contract complete mark ho jayega.'
      )
    ) {
      return
    }
    try {
      setCompleting(true)
      await completeContract(contract._id)
      toast.success(
        'Contract complete ho gaya! Ab rating de sakte hain.'
      )
      await fetchContract()
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Complete nahi hua'
      )
    } finally {
      setCompleting(false)
    }
  }

  const initials =
    user?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'O'

  const salary = Number(contract?.salaryPerDay) || 0
  const duration = Number(contract?.duration) || 0
  const totalValue = salary * duration

  const driverLoc = [
    contract?.driverId?.location?.state,
    contract?.driverId?.location?.district,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div
                className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"
                aria-hidden
              />
            </div>
          ) : !contract ? (
            <p className="text-center text-gray-600">Contract nahi mila</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 text-sm"
              >
                ← Wapas Jaao
              </button>

              <div className="no-print mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-gray-800">
                  Joining Letter
                </h1>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="bg-gray-700 text-white px-4 py-2 rounded-xl text-sm"
                >
                  PDF Download Karo
                </button>
              </div>

              {contract.status === 'sent' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 flex items-center gap-3">
                  <span className="text-2xl">⏳</span>
                  <div>
                    <div className="font-semibold text-yellow-800">
                      Driver ke sign karne ka wait hai
                    </div>
                    <div className="text-sm text-yellow-600">
                      Driver ne abhi sign nahi kiya
                    </div>
                  </div>
                </div>
              )}

              {contract.status === 'active' && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <div className="font-bold text-green-800">
                        Contract Active Hai — Kaam Chal Raha Hai!
                      </div>
                      <div className="text-sm text-green-600">
                        Driver ne{' '}
                        {formatDate(contract.driverSignedAt)} ko sign kiya
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-xl font-bold text-green-700">
                      ₹{totalValue}
                    </div>
                    <div className="text-xs text-green-600">
                      Total Contract Value
                    </div>
                  </div>
                </div>
              )}

              {contract.status === 'completed' && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                  <p className="font-bold text-blue-900">
                    ✅ Contract Complete Ho Gaya
                  </p>
                  <p className="mt-1 text-sm text-blue-800">
                    Ab dono rating de sakte hain
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => navigate('/owner/ratings')}
                      className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                    >
                      Rating Do
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchContract()}
                      className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50"
                    >
                      History Dekho
                    </button>
                  </div>
                </div>
              )}

              <div className="print-area bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                <div className="print-heading">JOINING LETTER</div>

                <div className="print-row">
                  <span>Date:</span>
                  <span>{formatDate(contract.createdAt)}</span>
                </div>

                <div className="print-row">
                  <span>Owner:</span>
                  <span>{contract.ownerId?.name}</span>
                </div>

                <div className="print-row">
                  <span>Driver:</span>
                  <span>{contract.driverId?.name}</span>
                </div>

                <div className="print-row">
                  <span>Kaam:</span>
                  <span>
                    {contract.jobId?.title} — {contract.jobId?.vehicleType}
                  </span>
                </div>

                <div className="print-row">
                  <span>Location:</span>
                  <span>{contract.workLocation}</span>
                </div>

                <div className="print-row">
                  <span>Start Date:</span>
                  <span>{formatDate(contract.startDate)}</span>
                </div>

                <div className="print-row">
                  <span>Duration:</span>
                  <span>{contract.duration} din</span>
                </div>

                <div className="print-row">
                  <span>Salary:</span>
                  <span>
                    {contract.salaryType === 'daily' &&
                      `₹${contract.salaryPerDay}/din`}
                    {contract.salaryType === 'monthly' &&
                      `₹${contract.salaryPerMonth}/month`}
                    {contract.salaryType === 'hourly' &&
                      `₹${contract.salaryPerHour}/ghanta`}
                  </span>
                </div>

                {contract.hasBhatta && (
                  <div className="print-row">
                    <span>Daily Bhatta:</span>
                    <span>₹{contract.dailyBhatta}/din</span>
                  </div>
                )}

                <div style={{ marginTop: '16px' }}>
                  <strong>Shartein:</strong>
                  <p style={{ whiteSpace: 'pre-line', marginTop: '8px' }}>
                    {contract.terms}
                  </p>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <strong>Safety Conditions:</strong>
                  <p style={{ whiteSpace: 'pre-line', marginTop: '8px' }}>
                    {contract.safetyConditions}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: '40px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div>Owner Signature:</div>
                    <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                      {contract.ownerId?.name}
                    </div>
                  </div>
                  <div>
                    <div>Driver Signature:</div>
                    <div style={{ marginTop: '8px', fontWeight: 'bold' }}>
                      {contract.driverSigned
                        ? contract.driverId?.name
                        : '(Abhi sign nahi kiya)'}
                    </div>
                    {contract.driverSignedAt && (
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        {formatDate(contract.driverSignedAt)}
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: '40px',
                    fontSize: '11px',
                    color: '#666',
                    textAlign: 'center',
                    borderTop: '1px solid #eee',
                    paddingTop: '10px',
                  }}
                >
                  Generated by DriverApp —{' '}
                  {new Date().toLocaleDateString('en-IN')}
                </div>
              </div>

              {contract.status === 'active' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={completing}
                    className="bg-gray-700 text-white border border-gray-200 rounded-2xl p-4 text-center hover:bg-gray-800 transition-all disabled:opacity-50"
                  >
                    <div className="text-2xl mb-1">✅</div>
                    <div className="text-sm font-medium">
                      {completing
                        ? 'Ho raha hai...'
                        : 'Kaam Complete Karo'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/attendance')}
                    className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-all"
                  >
                    <div className="text-2xl mb-1">📅</div>
                    <div className="text-sm font-medium text-gray-700">
                      Attendance Dekho
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/payments')}
                    className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-all"
                  >
                    <div className="text-2xl mb-1">💰</div>
                    <div className="text-sm font-medium text-gray-700">
                      Payment Karo
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/complaints')}
                    className="bg-white border border-gray-200 rounded-2xl p-4 text-center hover:border-red-300 hover:bg-red-50 transition-all col-span-2 md:col-span-1"
                  >
                    <div className="text-2xl mb-1">⚠️</div>
                    <div className="text-sm font-medium text-gray-700">
                      Complaint
                    </div>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
    </div>
  )
}

export default ViewContract
