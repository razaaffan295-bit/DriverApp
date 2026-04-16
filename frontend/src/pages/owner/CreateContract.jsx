import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'react-hot-toast'
import { getUser } from '../../utils/helpers'
import {
  getJobById,
  getPublicDriverProfile,
} from '../../api/ownerAPI'
import { createContract } from '../../api/contractAPI'

const fmtDate = (d) => {
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

const CreateContract = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const jobId = searchParams.get('jobId')
  const driverId = searchParams.get('driverId')

  const [user, setUser] = useState(null)
  const [job, setJob] = useState(null)
  const [driver, setDriver] = useState(null)
  const [form, setForm] = useState({
    terms: '',
    safetyConditions: '',
  })
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)

  useEffect(() => {
    setUser(getUser())
  }, [])

  const loadPage = useCallback(async () => {
    if (!jobId || !driverId) {
      setPageLoading(false)
      return
    }
    setPageLoading(true)
    try {
      const [jobRes, drvRes] = await Promise.all([
        getJobById(jobId),
        getPublicDriverProfile(driverId),
      ])
      setJob(jobRes.data?.job || null)
      const u = drvRes.data?.user
      const p = drvRes.data?.profile || {}
      setDriver(
        u
          ? {
              name: u.name,
              location: u.location,
              skills: p.skills || [],
              experience: p.experience,
              licenseType: p.licenseType,
            }
          : null
      )
    } catch (e) {
      console.error(e)
      toast.error(
        e.response?.data?.message || t('dataLoadError3')
      )
    } finally {
      setPageLoading(false)
    }
  }, [jobId, driverId, t])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  const initials =
    user?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'O'

  const ownerName = user?.name || 'Owner'
  const driverName = driver?.name || 'Driver'
  const workLoc =
    job?.location?.address && job?.location?.city
      ? `${job.location.address}, ${job.location.city}`
      : [job?.location?.address, job?.location?.city]
          .filter(Boolean)
          .join(', ') || '—'
  const todayStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const salaryType = job?.salaryType || 'daily'
  const vehicleCategory = job?.vehicleCategory || 'construction'
  const salaryPerDay = Number(job?.salaryPerDay) || 0
  const salaryPerMonth = Number(job?.salaryPerMonth) || 0
  const salaryPerHour = Number(job?.salaryPerHour) || 0
  const dailyBhatta = Number(job?.dailyBhatta) || 0

  const salaryTypeLabel = (() => {
    if (vehicleCategory === 'transport') return t('monthlyExpenses')
    if (salaryType === 'daily') return t('perDayLabel')
    if (salaryType === 'monthly') return t('perMonthLabel')
    if (salaryType === 'hourly') return t('perHourLabel')
    return t('perDayLabel')
  })()

  const rateLine = (() => {
    if (vehicleCategory === 'transport') return `${t('monthlySalary')}: ₹${salaryPerMonth}`
    if (salaryType === 'daily') return `${t('dailyRate')}: ₹${salaryPerDay}`
    if (salaryType === 'monthly') return `${t('monthlySalary')}: ₹${salaryPerMonth}`
    if (salaryType === 'hourly') return `${t('hourlyRate')}: ₹${salaryPerHour}`
    return `${t('dailyRate')}: ₹${salaryPerDay}`
  })()

  const duration = Number(job?.duration) || 0
  const totalK = (() => {
    if (vehicleCategory === 'transport') {
      return salaryPerMonth * Math.ceil(duration / 30)
    }
    if (salaryType === 'monthly') {
      return salaryPerMonth * Math.ceil(duration / 30)
    }
    if (salaryType === 'hourly') {
      return t('hourlyBasis')
    }
    return salaryPerDay * duration
  })()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.terms.trim() || !form.safetyConditions.trim()) {
      toast.error(t('bothFieldsRequired'))
      return
    }
    setLoading(true)
    try {
      await createContract({
        jobId,
        driverId,
        terms: form.terms.trim(),
        safetyConditions: form.safetyConditions.trim(),
      })
      toast.success(
        t('contractSent')
      )
      navigate('/owner/applications')
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          t('contractSendError')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0F4FF' }}
    >
        <div className="mx-auto max-w-4xl px-4 py-6">
          {!jobId || !driverId ? (
            <p className="text-center text-gray-500">
              {t('jobOrDriverMissing')}
            </p>
          ) : pageLoading ? (
            <p className="text-center text-gray-500">{t('loading')}</p>
          ) : !job || !driver ? (
            <p className="text-center text-gray-500">
              {t('jobOrDriverLoadError')}
            </p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-blue-700">
                    {t('jobInfoLabel')}
                  </h2>
                  <p className="font-semibold text-gray-900">
                    {job.title}
                  </p>
                  <p className="text-sm text-gray-600">
                    {job.vehicleType}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    {job.location?.state}, {job.location?.district},{' '}
                    {job.location?.city}
                  </p>
                  <p className="mt-2 text-sm font-medium text-blue-700">
                    {vehicleCategory === 'transport'
                      ? `₹${salaryPerMonth}/${t('perMonth')}`
                      : salaryType === 'hourly'
                        ? `₹${salaryPerHour}/${t('perHour')}`
                        : salaryType === 'monthly'
                          ? `₹${salaryPerMonth}/${t('perMonth')}`
                          : `₹${salaryPerDay}/${t('perDay')}`}{' '}
                    · {job.duration} {t('days')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {t('startLabel3')}: {fmtDate(job.startDate)}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold text-blue-700">
                    {t('driverInfoLabel')}
                  </h2>
                  <p className="font-semibold text-gray-900">
                    {driver.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {driver.location?.state},{' '}
                    {driver.location?.district}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(driver.skills || []).map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    {t('experienceLabel3')}: {driver.experience ?? '—'}{' '}
                    {t('yearsLabel')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {t('licenseLabel')}: {driver.licenseType || '—'}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-600">
                <p>
                  <span className="text-gray-500">
                    {t('salaryTypeLabel3')}:
                  </span>{' '}
                  {salaryTypeLabel}
                </p>
                <p>
                  <span className="text-gray-500">{rateLine.split(':')[0]}:</span>{' '}
                  {rateLine.split(':').slice(1).join(':').trim()}
                </p>
                {dailyBhatta > 0 && vehicleCategory !== 'transport' && (
                  <p>
                    <span className="text-gray-500">{t('bhatta')}:</span> ₹
                    {dailyBhatta}
                  </p>
                )}
                <p>
                  <span className="text-gray-500">{t('duration')}:</span>{' '}
                  {job.duration} {t('days')}
                </p>
                <p>
                  <span className="text-gray-500">{t('startDate')}:</span>{' '}
                  {fmtDate(job.startDate)}
                </p>
                <p>
                  <span className="text-gray-500">
                    {t('workLocationLabel')}:
                  </span>{' '}
                  {workLoc}
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="mt-6 rounded-2xl border border-gray-100 bg-white p-6"
              >
                <h2 className="mb-4 text-lg font-semibold text-gray-800">
                  {t('createContract')}
                </h2>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">
                    {t('termsAndConditions')}
                  </span>
                  <textarea
                    required
                    rows={6}
                    value={form.terms}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        terms: e.target.value,
                      }))
                    }
                    placeholder={`1. Driver ko daily 8 ghante kaam karna hoga
2. Machine ka dhyan rakhna hoga
3. Site pe time pe aana hoga
4. Koi bhi nuksan hone par driver zimmedar hoga
5. Salary month end pe milegi`}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
                <label className="mt-4 block">
                  <span className="text-sm font-medium text-gray-700">
                    {t('safetyConditionsLabel2')}
                  </span>
                  <textarea
                    required
                    rows={4}
                    value={form.safetyConditions}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        safetyConditions: e.target.value,
                      }))
                    }
                    placeholder={`1. Helmet pehenna zaroori hai
2. Safety belt use karna hoga
3. Alcohol peeke kaam nahi karna
4. Machine chalate waqt phone use nahi karna`}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>

                <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-6">
                  <h3 className="mb-3 font-semibold text-blue-900">
                    {t('previewLabel')}
                  </h3>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-gray-800 md:text-sm">
                    {`JOINING LETTER

Date: ${todayStr}

Yeh joining letter confirm karta hai ki:

Owner: ${ownerName}
Driver: ${driverName}

Kaam: ${job.title} — ${job.vehicleType}
Location: ${workLoc}
Start Date: ${fmtDate(job.startDate)}
Duration: ${job.duration} din
Salary Type: ${salaryTypeLabel}
${rateLine}
${dailyBhatta > 0 && vehicleCategory !== 'transport' ? `Daily Bhatta: ₹${dailyBhatta}\n` : ''}Total Kamayi: ${typeof totalK === 'string' ? totalK : `₹${totalK}`}

Shartein:
${form.terms || t('writingProgress')}

Safety Conditions:
${form.safetyConditions || t('writingProgress')}

Dono parties is contract se agree hain.

Owner Signature: ____________
Driver Signature: ____________`}
                  </pre>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-6 w-full rounded-xl bg-blue-700 py-3 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 md:w-auto md:px-8"
                >
                  {loading ? t('loading') : t('submit')}
                </button>
              </form>
            </>
          )}
        </div>
    </div>
  )
}

export default CreateContract
