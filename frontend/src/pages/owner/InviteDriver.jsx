import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
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
import API from '../../api/axios'
import { clearAuth, getUser } from '../../utils/helpers'
import { getVehicles } from '../../api/ownerAPI'
import { getOwnerInvites, sendInvite } from '../../api/inviteAPI'

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

const InviteDriver = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [checking, setChecking] = useState(false)
  const [driverFound, setDriverFound] = useState(null)
  const [driverNotFound, setDriverNotFound] = useState(false)
  const [vehicles, setVehicles] = useState([])
  const [sending, setSending] = useState(false)
  const [sentInvites, setSentInvites] = useState([])
  const [user, setUser] = useState(null)

  const [form, setForm] = useState({
    vehicleId: '',
    vehicleCategory: 'mining',
    salaryType: 'monthly',
    salaryPerDay: '',
    salaryPerMonth: '',
    salaryPerHour: '',
    hasBhatta: false,
    dailyBhatta: '',
    hasHourlyBonus: false,
    transportType: 'none',
    duration: '30',
    startDate: new Date().toISOString().split('T')[0],
    terms: '',
    safetyConditions: '',
    workLocation: '',
  })

  const profileNavActive =
    location.pathname === '/owner/profile' && searchParams.get('tab') !== 'vehicles'
  const vehiclesNavActive =
    location.pathname === '/owner/profile' && searchParams.get('tab') === 'vehicles'

  useEffect(() => {
    setUser(getUser())
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const [vRes, iRes] = await Promise.all([getVehicles(), getOwnerInvites()])
        setVehicles(vRes.data?.vehicles || [])
        setSentInvites(iRes.data?.invites || [])
      } catch (e) {
        toast.error(e.response?.data?.message || 'Load nahi hua')
      }
    })()
  }, [])

  const initials =
    driverFound?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'D'

  const handleLogout = () => {
    clearAuth()
    navigate('/login')
    toast.success('Logout ho gaye!')
  }

  const placeholderNav = () => {
    // no placeholder toasts in navigation
  }

  const statusBadge = (status) => {
    if (status === 'pending') return 'bg-yellow-100 text-yellow-700'
    if (status === 'accepted') return 'bg-green-100 text-green-700'
    if (status === 'rejected') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-700'
  }

  const statusLabel = (status) => {
    if (status === 'pending') return '⏳ Pending'
    if (status === 'accepted') return '✅ Accept'
    if (status === 'rejected') return '❌ Reject'
    return status
  }

  const fmtDate = (d) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—'

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-2xl px-4 py-6">
          {step === 1 ? (
            <div className="bg-white rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-bold text-gray-900">Driver Ka Phone Number</h2>
              <p className="mt-1 text-sm text-gray-600">
                Driver ko pehle DriverApp mein signup karwao, phir yahan unka number dalo.
              </p>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-900">
                ℹ️ Driver ko pehle DriverApp download karwa ke signup karwao. Phir unka phone number yahan enter karo.
              </div>

              <input
                type="tel"
                placeholder="Driver ka phone number"
                maxLength={10}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                  setDriverNotFound(false)
                }}
                className="input-field w-full"
              />

              <button
                type="button"
                disabled={checking || phone.length !== 10}
                onClick={async () => {
                  try {
                    setChecking(true)
                    const res = await API.get(`/api/auth/check-phone?phone=${phone}`)
                    const driver = res.data?.driver
                    setDriverFound(driver)
                    setDriverNotFound(false)
                    setStep(2)
                    toast.success(`${driver.name} mil gaya! Ab details bharo.`)
                  } catch (e) {
                    if (e.response?.status === 404) {
                      setDriverFound(null)
                      setDriverNotFound(true)
                      toast.error('❌ Is number pe koi driver registered nahi hai.')
                    } else {
                      toast.error(e.response?.data?.message || 'Check nahi hua')
                    }
                  } finally {
                    setChecking(false)
                  }
                }}
                className="mt-4 bg-blue-700 text-white w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
              >
                {checking ? 'Dhundh raha hai...' : 'Driver Dhundho'}
              </button>

              {driverNotFound ? (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="font-semibold text-red-900">❌ Is number pe koi driver registered nahi hai.</p>
                  <p className="mt-1 text-sm text-red-800">
                    Driver ko DriverApp mein signup karwao, phir wapas aao.
                  </p>
                  <div className="mt-3 text-sm text-red-900 space-y-1">
                    <div>1. Driver ko app download karwao</div>
                    <div>2. Driver apna profile banaye</div>
                    <div>3. Wapas aao aur number enter karo</div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 && driverFound ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6">
                <div className="font-bold text-green-900">✅ Driver Mil Gaya!</div>
                <div className="mt-3 flex gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-800">
                    {initials}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{driverFound.name}</div>
                    <div className="text-sm text-gray-600">{driverFound.phone}</div>
                    <div className="text-sm text-gray-500">
                      {driverFound.location?.state || '—'} {driverFound.location?.district ? `· ${driverFound.location.district}` : ''}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setStep(1)
                        setDriverFound(null)
                        setPhone('')
                        setDriverNotFound(false)
                      }}
                      className="mt-2 text-sm text-blue-700 underline"
                    >
                      Galat driver hai?
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6">
                <h2 className="text-lg font-bold text-gray-900">Kaam Ki Details</h2>

                <label className="mt-4 block text-sm font-semibold text-gray-800">Kaun Si Gadi Pe?</label>
                <select
                  value={form.vehicleId}
                  onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
                  className="input-field w-full"
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.vehicleType} — {v.vehicleNumber}
                    </option>
                  ))}
                </select>

                <label className="mt-4 block text-sm font-semibold text-gray-800">Vehicle Category</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {['mining', 'road', 'transport'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          vehicleCategory: c,
                          transportType: c === 'transport' ? f.transportType : 'none',
                        }))
                      }
                      className={`rounded-xl py-2 text-sm font-semibold ${
                        form.vehicleCategory === c ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {c === 'mining' ? 'Mining' : c === 'road' ? 'Road' : 'Transport'}
                    </button>
                  ))}
                </div>

                <label className="mt-4 block text-sm font-semibold text-gray-800">Salary Type</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {['daily', 'monthly', 'hourly'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, salaryType: t }))}
                      className={`rounded-xl py-2 text-sm font-semibold ${
                        form.salaryType === t ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {t === 'daily' ? 'Daily' : t === 'monthly' ? 'Monthly' : 'Hourly'}
                    </button>
                  ))}
                </div>

                {form.salaryType === 'daily' ? (
                  <>
                    <label className="mt-4 block text-sm font-semibold text-gray-800">Salary Per Day</label>
                    <input
                      value={form.salaryPerDay}
                      onChange={(e) => setForm((f) => ({ ...f, salaryPerDay: e.target.value }))}
                      className="input-field w-full"
                      placeholder="₹/din"
                      inputMode="numeric"
                    />
                  </>
                ) : form.salaryType === 'monthly' ? (
                  <>
                    <label className="mt-4 block text-sm font-semibold text-gray-800">Salary Per Month</label>
                    <input
                      value={form.salaryPerMonth}
                      onChange={(e) => setForm((f) => ({ ...f, salaryPerMonth: e.target.value }))}
                      className="input-field w-full"
                      placeholder="₹/month"
                      inputMode="numeric"
                    />
                  </>
                ) : (
                  <>
                    <label className="mt-4 block text-sm font-semibold text-gray-800">Salary Per Hour</label>
                    <input
                      value={form.salaryPerHour}
                      onChange={(e) => setForm((f) => ({ ...f, salaryPerHour: e.target.value }))}
                      className="input-field w-full"
                      placeholder="₹/ghanta"
                      inputMode="numeric"
                    />
                  </>
                )}

                {form.vehicleCategory !== 'transport' ? (
                  <>
                    <div className="mt-4 flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-800">Bhatta</label>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, hasBhatta: !f.hasBhatta }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          form.hasBhatta ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {form.hasBhatta ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {form.hasBhatta ? (
                      <input
                        value={form.dailyBhatta}
                        onChange={(e) => setForm((f) => ({ ...f, dailyBhatta: e.target.value }))}
                        className="input-field w-full mt-2"
                        placeholder="₹/din"
                        inputMode="numeric"
                      />
                    ) : null}

                    <div className="mt-4 flex items-center justify-between">
                      <label className="text-sm font-semibold text-gray-800">Hourly Bonus</label>
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, hasHourlyBonus: !f.hasHourlyBonus }))}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          form.hasHourlyBonus ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {form.hasHourlyBonus ? 'ON' : 'OFF'}
                      </button>
                    </div>
                    {form.hasHourlyBonus ? (
                      <input
                        value={form.salaryPerHour}
                        onChange={(e) => setForm((f) => ({ ...f, salaryPerHour: e.target.value }))}
                        className="input-field w-full mt-2"
                        placeholder="₹/ghanta"
                        inputMode="numeric"
                      />
                    ) : null}
                  </>
                ) : (
                  <>
                    <label className="mt-4 block text-sm font-semibold text-gray-800">Transport Type</label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {[
                        { id: 'company_trip', label: 'Company Trip' },
                        { id: 'malik_trip', label: 'Malik Trip' },
                      ].map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, transportType: o.id }))}
                          className={`rounded-xl py-2 text-sm font-semibold ${
                            form.transportType === o.id ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <label className="mt-4 block text-sm font-semibold text-gray-800">Duration (din)</label>
                <input
                  value={form.duration}
                  onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                  className="input-field w-full"
                  inputMode="numeric"
                />

                <label className="mt-4 block text-sm font-semibold text-gray-800">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="input-field w-full"
                />

                <label className="mt-4 block text-sm font-semibold text-gray-800">Work Location</label>
                <input
                  value={form.workLocation}
                  onChange={(e) => setForm((f) => ({ ...f, workLocation: e.target.value }))}
                  className="input-field w-full"
                  placeholder="Site ka address"
                />

                <label className="mt-4 block text-sm font-semibold text-gray-800">Terms</label>
                <textarea
                  rows={4}
                  value={form.terms}
                  onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
                  className="input-field w-full resize-y"
                  placeholder={'1. Roz time pe aana hoga\n2. Machine ka dhyan rakhna hoga'}
                />

                <label className="mt-4 block text-sm font-semibold text-gray-800">Safety Conditions</label>
                <textarea
                  rows={3}
                  value={form.safetyConditions}
                  onChange={(e) => setForm((f) => ({ ...f, safetyConditions: e.target.value }))}
                  className="input-field w-full resize-y"
                  placeholder={'1. Helmet pehenna zaroori\n2. Safety belt use karna'}
                />

                <button
                  type="button"
                  disabled={sending || phone.length !== 10 || !driverFound}
                  onClick={async () => {
                    try {
                      setSending(true)
                      await sendInvite({
                        driverPhone: phone,
                        vehicleId: form.vehicleId,
                        vehicleCategory: form.vehicleCategory,
                        salaryType: form.salaryType,
                        salaryPerDay: Number(form.salaryPerDay) || 0,
                        salaryPerMonth: Number(form.salaryPerMonth) || 0,
                        salaryPerHour: Number(form.salaryPerHour) || 0,
                        dailyBhatta: Number(form.dailyBhatta) || 0,
                        hasBhatta: Boolean(form.hasBhatta),
                        hasHourlyBonus: Boolean(form.hasHourlyBonus),
                        transportType: form.vehicleCategory === 'transport' ? form.transportType : 'none',
                        duration: Number(form.duration) || 30,
                        startDate: form.startDate,
                        terms: form.terms,
                        safetyConditions: form.safetyConditions,
                        workLocation: form.workLocation,
                      })
                      toast.success('Invite bhej diya! Driver ke accept karne ka wait karein.')
                      const iRes = await getOwnerInvites()
                      setSentInvites(iRes.data?.invites || [])
                      setStep(3)
                    } catch (e) {
                      toast.error(e.response?.data?.message || 'Invite nahi gaya')
                    } finally {
                      setSending(false)
                    }
                  }}
                  className="mt-4 bg-blue-700 text-white w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
                >
                  {sending ? 'Bhej raha hai...' : 'Invite Bhejo'}
                </button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <div className="bg-green-50 rounded-2xl p-8 text-center">
              <div className="text-3xl">🎉</div>
              <h2 className="mt-2 text-xl font-bold text-green-900">Invite Bhej Diya!</h2>
              <p className="mt-1 text-sm text-green-800">Driver ko notification mil gayi hai.</p>
              <p className="mt-1 text-sm text-green-800">Jab driver accept karega — kaam shuru ho jayega.</p>
              <button
                type="button"
                onClick={() => {
                  setStep(1)
                  setPhone('')
                  setChecking(false)
                  setDriverFound(null)
                  setDriverNotFound(false)
                  setSending(false)
                  setForm({
                    vehicleId: '',
                    vehicleCategory: 'mining',
                    salaryType: 'monthly',
                    salaryPerDay: '',
                    salaryPerMonth: '',
                    salaryPerHour: '',
                    hasBhatta: false,
                    dailyBhatta: '',
                    hasHourlyBonus: false,
                    transportType: 'none',
                    duration: '30',
                    startDate: new Date().toISOString().split('T')[0],
                    terms: '',
                    safetyConditions: '',
                    workLocation: '',
                  })
                }}
                className="mt-6 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white"
              >
                Doosra Driver Add Karo
              </button>
            </div>
          ) : null}

          <div className="mt-10">
            <h2 className="mb-3 text-lg font-semibold text-gray-800">Bheje Hue Invites</h2>
            {sentInvites.length === 0 ? (
              <p className="text-sm text-gray-500">Abhi koi invite nahi bheja</p>
            ) : (
              <div className="space-y-3">
                {sentInvites.map((inv) => (
                  <div key={inv._id} className="bg-white rounded-2xl p-4 border border-gray-100">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {inv.driverId?.name || 'Driver'} · {inv.driverPhone}
                        </div>
                        <div className="text-sm text-gray-600">
                          {inv.vehicleId?.vehicleType || 'Vehicle'} {inv.vehicleId?.vehicleNumber ? `— ${inv.vehicleId.vehicleNumber}` : ''}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {inv.salaryType === 'monthly'
                            ? `₹${inv.salaryPerMonth}/month`
                            : inv.salaryType === 'daily'
                              ? `₹${inv.salaryPerDay}/din`
                              : `₹${inv.salaryPerHour}/ghanta`}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">Sent: {fmtDate(inv.createdAt)}</div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadge(inv.status)}`}>
                        {statusLabel(inv.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </div>
  )
}

export default InviteDriver

