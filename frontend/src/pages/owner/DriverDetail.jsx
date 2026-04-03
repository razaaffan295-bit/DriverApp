import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getDriverDetail } from '../../api/ownerAPI'

const DriverDetail = () => {
  const { id } = useParams()
  const navigate = useNavigate()

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      if (!id) return
      setLoading(true)
      try {
        const res = await getDriverDetail(id)
        setData(res.data || null)
      } catch (e) {
        toast.error(e.response?.data?.message || 'Load nahi hua')
        setData(null)
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

  const renderStars = (score) => {
    const s = Number(score) || 0
    return [1, 2, 3, 4, 5].map((star) => (
      <span
        key={star}
        style={{
          color: star <= s ? '#EAB308' : '#D1D5DB',
          fontSize: '16px',
        }}
      >
        ★
      </span>
    ))
  }

  const {
    driver,
    profile,
    activeContract,
    contractHistory,
    ratings,
    avgRating,
    totalRatings,
    attendanceSummary,
    paymentSummary,
  } = data || {}

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

  const messageUrl = (() => {
    const driverId = driver?._id || id
    const jobId = activeContract?.jobId?._id || activeContract?.jobId
    if (jobId) return `/owner/messages?jobId=${jobId}&driverId=${driverId}`
    return `/owner/messages?driverId=${driverId}`
  })()

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
        <div className="mx-auto max-w-3xl px-4 py-6">
          <button type="button" onClick={() => navigate(-1)} className="text-gray-500 text-sm mb-4">
            ← Wapas
          </button>

          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
            </div>
          ) : !driver ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center text-gray-600">
              Driver nahi mila
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 text-3xl font-bold flex items-center justify-center">
                    {(driver?.name || 'D').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-2xl font-bold text-gray-900 truncate">{driver?.name}</div>
                    <div className="text-gray-500">{driver?.phone}</div>
                    <div className="text-sm text-gray-500">
                      {driver?.location?.state || '—'}
                      {driver?.location?.district ? `, ${driver.location.district}` : ''}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {driver?.isVerified ? (
                        <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full">
                          ✓ Verified
                        </span>
                      ) : null}
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          activeContract ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {activeContract ? '✅ Active' : 'No Active Job'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      {renderStars(Math.round(Number(avgRating) || 0))}
                      <span className="text-sm text-gray-600">
                        {avgRating} ({totalRatings} reviews)
                      </span>
                    </div>
                  </div>
                </div>

                {(profile?.skills || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {profile.skills.map((s) => (
                      <span key={s} className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 text-sm text-gray-500">
                  {profile?.experience != null ? `${profile.experience} saal experience` : '—'}
                </div>
                <div className="text-sm text-gray-500">
                  {profile?.licenseType || '—'} — {profile?.licenseNumber || '—'}
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => navigate(messageUrl)}
                    className="bg-blue-700 text-white px-4 py-2 rounded-xl text-sm"
                  >
                    Message Karo
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/owner/complaints')}
                    className="border border-red-300 text-red-500 px-4 py-2 rounded-xl text-sm"
                  >
                    Complaint Karo
                  </button>
                </div>
              </div>

              {activeContract ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6">
                  <div className="text-green-800 font-bold text-lg mb-4">
                    ✅ Abhi Kaam Chal Raha Hai
                  </div>

                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <strong>Job:</strong> {activeContract.jobId?.title || '—'}
                    </div>
                    <div>
                      <strong>Gadi:</strong> {activeContract.jobId?.vehicleId?.vehicleType || '—'} —{' '}
                      {activeContract.jobId?.vehicleId?.vehicleNumber || '—'}
                    </div>
                    <div>
                      <strong>Category:</strong> {activeContract.vehicleCategory || '—'}
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

                  {attendanceSummary ? (
                    <div className="bg-white rounded-xl p-4 mt-4">
                      <div className="font-semibold text-gray-800">Is Mahine Ki Attendance:</div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-green-50 p-3">
                          <div className="text-green-700 font-bold">{attendanceSummary.presentDays} din</div>
                          <div className="text-xs text-gray-500">Present</div>
                        </div>
                        <div className="rounded-xl bg-red-50 p-3">
                          <div className="text-red-600 font-bold">{attendanceSummary.absentDays} din</div>
                          <div className="text-xs text-gray-500">Absent</div>
                        </div>
                        <div className="rounded-xl bg-yellow-50 p-3">
                          <div className="text-yellow-700 font-bold">{attendanceSummary.halfDays} din</div>
                          <div className="text-xs text-gray-500">Half Day</div>
                        </div>
                        <div className="rounded-xl bg-blue-50 p-3">
                          <div className="text-blue-700 font-bold">₹{attendanceSummary.grossTotal}</div>
                          <div className="text-xs text-gray-500">Salary</div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {paymentSummary ? (
                    <div className="bg-white rounded-xl p-4 mt-3 text-sm text-gray-700">
                      <div className="font-semibold text-gray-800">Payment Status:</div>
                      <div className="mt-2">
                        Total Paid: <strong>₹{paymentSummary.totalPaid}</strong>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Last Payment: {formatDate(paymentSummary.lastPayment?.ownerPaidAt)}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/owner/attendance')}
                      className="bg-white border rounded-xl p-3 text-center text-sm"
                    >
                      📅 Attendance
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/owner/payments')}
                      className="bg-white border rounded-xl p-3 text-center text-sm"
                    >
                      💰 Payment Karo
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/owner/contracts/${activeContract._id}`)}
                      className="bg-white border rounded-xl p-3 text-center text-sm"
                    >
                      📋 Contract Dekho
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const vid = activeContract.jobId?.vehicleId?._id
                        if (vid) navigate(`/owner/vehicles/${vid}`)
                        else toast.error('Gadi nahi mili')
                      }}
                      className="bg-white border rounded-xl p-3 text-center text-sm"
                    >
                      🚗 Gadi Dekho
                    </button>
                  </div>
                </div>
              ) : null}

              {(ratings || []).length > 0 ? (
                <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-100">
                  <h2 className="text-lg font-semibold mb-4 text-gray-800">Driver Ki Ratings</h2>
                  <div className="text-center mb-4">
                    <div className="text-4xl font-bold text-blue-700">{avgRating}</div>
                    <div className="mt-2">{renderStars(Math.round(Number(avgRating) || 0))}</div>
                    <div className="text-sm text-gray-500 mt-1">{totalRatings} reviews</div>
                  </div>
                  {(ratings || []).map((r) => (
                    <div key={r._id} className="border-b pb-3 mb-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold text-gray-800">
                          {r.ratedBy?.name || 'User'}{' '}
                          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            {r.ratedBy?.role || r.ratedByRole || '—'}
                          </span>
                        </div>
                        <div>{renderStars(Number(r.score) || 0)}</div>
                      </div>
                      {r.review ? <div className="mt-1 text-sm text-gray-700">{r.review}</div> : null}
                      {r.jobId?.title ? <div className="text-xs text-gray-500 mt-1">{r.jobId.title}</div> : null}
                      <div className="text-xs text-gray-400 mt-1">{formatDate(r.createdAt)}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {(contractHistory || []).length > 0 ? (
                <div className="bg-white rounded-2xl p-6 mb-6 border border-gray-100">
                  <h2 className="text-lg font-semibold mb-4 text-gray-800">Purana Kaam History</h2>
                  {contractHistory.map((c) => (
                    <div key={c._id} className="bg-gray-50 rounded-xl p-4 mb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-gray-900">{c.jobId?.title || '—'}</div>
                          <div className="text-sm text-gray-600">
                            {c.jobId?.vehicleType || 'Vehicle'} · {c.jobId?.vehicleId?.vehicleNumber || '—'}
                          </div>
                          <div className="text-xs text-gray-400">Start: {formatDate(c.startDate)}</div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              c.status === 'completed'
                                ? 'bg-green-100 text-green-700'
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
    </div>
  )
}

export default DriverDetail

