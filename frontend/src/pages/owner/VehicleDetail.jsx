import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DriverProfileModal from '../../components/owner/DriverProfileModal'
import { getPublicDriverProfile } from '../../api/ownerAPI'
import { getVehicleDetail } from '../../api/ownerAPI'

const VehicleDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [vehicle, setVehicle] = useState(null)
  const [activeContract, setActiveContract] = useState(null)
  const [contractHistory, setContractHistory] = useState([])
  const [driverRating, setDriverRating] = useState(0)
  const [ratingCount, setRatingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    ;(async () => {
      if (!id) return
      setLoading(true)
      try {
        const res = await getVehicleDetail(id)
        setVehicle(res.data?.vehicle || null)
        setActiveContract(res.data?.activeContract || null)
        setContractHistory(res.data?.contractHistory || [])
        setDriverRating(Number(res.data?.driverRating) || 0)
        setRatingCount(Number(res.data?.ratingCount) || 0)
      } catch (e) {
        toast.error(e.response?.data?.message || 'Load nahi hua')
        setVehicle(null)
        setActiveContract(null)
        setContractHistory([])
        setDriverRating(0)
        setRatingCount(0)
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const formatDate = (date) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const driver = activeContract?.driverId || vehicle?.assignedDriver || null

  const daysLeft = activeContract
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeContract.startDate).getTime() +
            Number(activeContract.duration || 0) * 24 * 60 * 60 * 1000 -
            Date.now()) /
            (24 * 60 * 60 * 1000)
        )
      )
    : 0

  const handleViewProfile = async () => {
    try {
      setModalLoading(true)

      const driverId =
        activeContract?.driverId?._id || vehicle?.assignedDriver?._id

      if (!driverId) {
        toast.error('Driver ID nahi mila')
        return
      }

      const res = await getPublicDriverProfile(driverId)

      setSelectedDriver({
        ...res.data.user,
        profile: res.data.profile,
        ratings: res.data.ratings,
        avgRating: res.data.avgRating,
        totalRatings: res.data.totalRatings,
        completedJobs: res.data.completedJobs,
        _id: driverId,
      })

      setShowModal(true)
    } catch (error) {
      console.error(error)
      toast.error('Profile load nahi hua')
    } finally {
      setModalLoading(false)
    }
  }

  const handleMessage = () => {
    const driverId =
      activeContract?.driverId?._id || vehicle?.assignedDriver?._id

    const jobId = activeContract?.jobId?._id || activeContract?.jobId

    if (!driverId) {
      toast.error('Driver nahi mila')
      return
    }

    if (jobId) {
      navigate(`/owner/messages?jobId=${jobId}&driverId=${driverId}`)
    } else {
      navigate(`/owner/messages?driverId=${driverId}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-gray-500 text-sm mb-4"
          >
            ← Wapas
          </button>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : !vehicle ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-600">
              Gadi nahi mili
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full text-xs">
                      {vehicle.vehicleType}
                    </span>
                    <div className="mt-3 text-2xl font-bold text-gray-800">
                      {vehicle.vehicleNumber || '—'}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      activeContract ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                    }`}
                  >
                    {activeContract ? '✅ Kaam Chal Raha Hai' : '⚠️ Driver Nahi'}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
                  <div>
                    <span className="font-medium text-gray-700">Model:</span> {vehicle.vehicleModel || '—'}
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Location:</span> {vehicle.location?.state || '—'},{' '}
                    {vehicle.location?.district || '—'}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-blue-600 text-sm">
                    {Array.isArray(vehicle.documents) && vehicle.documents.length > 0 ? (
                      <span>📄 {vehicle.documents.length} Documents</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => toast('Abhi edit feature available nahi hai')}
                    className="border border-gray-300 text-gray-600 text-sm px-3 py-2 rounded-lg"
                  >
                    Gadi Edit Karo
                  </button>
                </div>
              </div>

              {activeContract && driver ? (
                <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-100">
                  <h2 className="text-lg font-semibold mb-4 text-gray-800">Driver Ki Info</h2>

                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-700">
                      {(driver?.name || 'D').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xl font-bold text-gray-900 truncate">{driver?.name || 'Driver'}</div>
                      <div className="text-gray-500 text-sm">{driver?.phone || '—'}</div>
                      <div className="text-gray-400 text-sm">
                        {driver?.location?.state || '—'}
                        {driver?.location?.district ? `, ${driver.location.district}` : ''}
                      </div>

                      <div className="mt-2 text-sm">
                        {Number(driverRating) > 0 ? (
                          <div className="text-yellow-600">
                            {'★★★★★'} <span className="text-gray-700">{driverRating} ({ratingCount} reviews)</span>
                          </div>
                        ) : (
                          <div className="text-gray-500">Abhi koi rating nahi</div>
                        )}
                      </div>

                      {driver?.isVerified ? (
                        <span className="mt-2 inline-flex bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full">
                          ✓ Verified
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      type="button"
                      onClick={handleViewProfile}
                      disabled={modalLoading}
                      className="bg-blue-700 text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
                    >
                      {modalLoading ? 'Load ho raha hai...' : 'Profile Dekho'}
                    </button>
                    <button
                      type="button"
                      onClick={handleMessage}
                      className="border border-blue-400 text-blue-600 px-4 py-2 rounded-xl text-sm"
                    >
                      Message Karo
                    </button>
                  </div>
                </div>
              ) : null}

              {activeContract ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
                  <div className="text-green-800 font-bold text-lg mb-4">✅ Kaam Chal Raha Hai</div>

                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <strong>Job Title:</strong> {activeContract.jobId?.title || '—'}
                    </div>
                    <div>
                      <strong>Vehicle Category:</strong> {activeContract.vehicleCategory || '—'}
                    </div>
                    <div>
                      <strong>Salary Type:</strong> {activeContract.salaryType || '—'}
                    </div>
                    <div>
                      <strong>Salary:</strong>{' '}
                      {activeContract.salaryType === 'daily'
                        ? `₹${activeContract.salaryPerDay}/din`
                        : activeContract.salaryType === 'monthly'
                          ? `₹${activeContract.salaryPerMonth}/month`
                          : `₹${activeContract.salaryPerHour}/ghanta`}
                    </div>
                    {activeContract.hasBhatta ? (
                      <div>+ ₹{activeContract.dailyBhatta} bhatta/din</div>
                    ) : null}
                    <div>
                      <strong>Start Date:</strong> {formatDate(activeContract.startDate)}
                    </div>
                    <div>
                      <strong>Duration:</strong> {activeContract.duration} din
                    </div>
                    <div className="font-semibold text-green-800">{daysLeft} din baaki</div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/owner/attendance')}
                      className="bg-white border border-gray-200 rounded-xl p-3 text-center text-sm"
                    >
                      📅 Attendance Dekho
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/owner/payments')}
                      className="bg-white border border-gray-200 rounded-xl p-3 text-center text-sm"
                    >
                      💰 Payment Karo
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/owner/contracts/${activeContract._id}`)}
                      className="bg-white border border-gray-200 rounded-xl p-3 text-center text-sm"
                    >
                      📋 Contract Dekho
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/owner/complaints')}
                      className="bg-white border border-red-100 rounded-xl p-3 text-center text-sm text-red-500"
                    >
                      ⚠️ Complaint Karo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
                  <div className="text-red-700 font-bold text-lg mb-2">⚠️ Is Gadi Mein Driver Nahi Hai</div>
                  <div className="text-gray-600 text-sm mb-4">Naya driver hire karein:</div>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/invite-driver')}
                    className="bg-blue-700 text-white w-full py-3 rounded-xl mb-3 text-sm font-semibold"
                  >
                    👤 Driver Directly Add Karo
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/post-job')}
                    className="border border-blue-400 text-blue-600 w-full py-3 rounded-xl text-sm font-semibold"
                  >
                    📋 Job Post Karo
                  </button>
                </div>
              )}

              {contractHistory.length > 0 ? (
                <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-100">
                  <h2 className="text-lg font-semibold mb-4 text-gray-800">Purane Contracts</h2>
                  {contractHistory.map((c) => (
                    <div key={c._id} className="bg-gray-50 rounded-xl p-4 mb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-gray-900">{c.driverId?.name || 'Driver'}</div>
                          <div className="text-sm text-gray-500">{c.jobId?.title || '—'}</div>
                          <div className="text-xs text-gray-400">Start: {formatDate(c.startDate)}</div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              c.status === 'completed'
                                ? 'bg-green-100 text-green-600'
                                : 'bg-red-100 text-red-500'
                            }`}
                          >
                            {c.status === 'completed' ? 'Complete' : 'Resign'}
                          </span>
                          <div className="mt-2 text-xs text-gray-400">{c.duration} din</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>

      {showModal && selectedDriver && (
        <DriverProfileModal
          driver={selectedDriver}
          driverProfileData={selectedDriver}
          onClose={() => {
            setShowModal(false)
            setSelectedDriver(null)
          }}
          selectedApplication={{
            jobId: activeContract?.jobId?._id || activeContract?.jobId,
            driverId: selectedDriver._id,
            status: 'active',
          }}
        />
      )}
    </div>
  )
}

export default VehicleDetail

