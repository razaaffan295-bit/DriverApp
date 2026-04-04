import { useEffect, useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { getUser, setAuth, getToken } from '../../utils/helpers'
import { STATES, VEHICLE_TYPES } from '../../utils/constants'
import API from '../../api/axios'
import {
  getDriverProfile,
  updateDriverProfile,
} from '../../api/driverAPI'

const DriverProfile = () => {
  const [activeTab, setActiveTab] = useState('details')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState(false)
  const [name, setName] = useState('')
  const [stateVal, setStateVal] = useState('')
  const [districtVal, setDistrictVal] = useState('')
  const [skills, setSkills] = useState([])
  const [experience, setExperience] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [licenseType, setLicenseType] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  const [about, setAbout] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [bankIfsc, setBankIfsc] = useState('')
  const [bankUpi, setBankUpi] = useState('')
  const [bankUpiQr, setBankUpiQr] = useState('')
  const [docFiles, setDocFiles] = useState({
    license: null,
    aadhar: null,
    photo: null,
    other: null,
  })
  const [docUploading, setDocUploading] = useState(false)
  const [docUploadProgress, setDocUploadProgress] = useState(0)
  const [documents, setDocuments] = useState({
    license: '',
    aadhar: '',
    photo: '',
    other: '',
  })

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await getDriverProfile()
      const u = data?.user
      const p = data?.profile
      setUser(u)
      setName(u?.name ?? '')
      setStateVal(u?.location?.state ?? '')
      setDistrictVal(u?.location?.district ?? '')
      setSkills(Array.isArray(p?.skills) ? [...p.skills] : [])
      setExperience(p?.experience != null ? String(p.experience) : '')
      setLicenseNumber(p?.licenseNumber ?? '')
      setLicenseType(p?.licenseType ?? '')
      setLicenseExpiry(
        p?.licenseExpiry
          ? new Date(p.licenseExpiry).toISOString().slice(0, 10)
          : ''
      )
      setAbout(p?.about ?? '')
      setBankName(p?.bankDetails?.accountName ?? '')
      setBankAccount(p?.bankDetails?.accountNumber ?? '')
      setBankIfsc(p?.bankDetails?.ifscCode ?? '')
      setBankUpi(p?.bankDetails?.upiId ?? '')
      setBankUpiQr(p?.bankDetails?.upiQrCode ?? '')
      setDocuments({
        license: p?.documents?.license ?? '',
        aadhar: p?.documents?.aadhar ?? '',
        photo: p?.documents?.photo ?? '',
        other: p?.documents?.other ?? '',
      })
      setDocFiles({
        license: null,
        aadhar: null,
        photo: null,
        other: null,
      })
    } catch (e) {
      toast.error(
        e.response?.data?.message || 'Profile load nahi ho paya.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!getUser()) return
    loadProfile()
  }, [loadProfile])

  const initials =
    user?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'D'

  const displayPhoto = user?.profilePhoto

  const toggleSkill = (t) => {
    setSkills((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const formData = new FormData()
      formData.append('photo', file)

      const res = await API.post(
        '/api/driver/profile/photo',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      if (res.data.success) {
        toast.success('Photo upload ho gayi!')
        setUser((prev) =>
          prev ? { ...prev, profilePhoto: res.data.photo } : prev
        )
        const stored = getUser()
        if (stored) {
          setAuth(getToken(), {
            ...stored,
            profilePhoto: res.data.photo,
          })
        }
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Photo upload nahi hui'
      )
    }
  }

  const handleUpiQrChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Sirf image file chuniye')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setBankUpiQr(String(reader.result || ''))
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleDocUpload = async () => {
    try {
      setDocUploading(true)
      setDocUploadProgress(0)

      const formData = new FormData()

      if (docFiles.license) {
        formData.append('license', docFiles.license)
      }
      if (docFiles.aadhar) {
        formData.append('aadhar', docFiles.aadhar)
      }
      if (docFiles.photo) {
        formData.append('photo', docFiles.photo)
      }
      if (docFiles.other) {
        formData.append('other', docFiles.other)
      }

      const hasFiles =
        docFiles.license ||
        docFiles.aadhar ||
        docFiles.photo ||
        docFiles.other

      if (!hasFiles) {
        toast.error('Koi file select nahi ki')
        return
      }

      await API.post('/api/driver/documents', formData, {
        onUploadProgress: (ev) => {
          if (ev.total) {
            setDocUploadProgress(
              Math.round((ev.loaded * 100) / ev.total)
            )
          }
        },
      })

      toast.success('Documents upload ho gaye!')
      setDocFiles({
        license: null,
        aadhar: null,
        photo: null,
        other: null,
      })
      await loadProfile()
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Upload nahi hua'
      )
    } finally {
      setDocUploading(false)
      setDocUploadProgress(0)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!name?.trim()) {
      toast.error('Naam zaroori hai')
      return
    }
    if (skills.length === 0) {
      toast.error('Kam se kam ek skill chuniye')
      return
    }
    setSaveLoading(true)
    try {
      const payload = {
        name: name.trim(),
        skills,
        experience: experience === '' ? undefined : Number(experience),
        licenseNumber: licenseNumber.trim(),
        licenseType: licenseType || undefined,
        licenseExpiry: licenseExpiry || undefined,
        about: about.trim(),
        state: stateVal,
        district: districtVal.trim(),
        bankDetails: {
          accountName: bankName.trim(),
          accountNumber: bankAccount.trim(),
          ifscCode: bankIfsc.trim().toUpperCase(),
          upiId: bankUpi.trim(),
          upiQrCode: bankUpiQr.trim(),
        },
      }

      await updateDriverProfile(payload)
      const fresh = await getDriverProfile()
      const nextUser = {
        ...fresh.data.user,
        isProfileComplete:
          fresh.data.profile?.isProfileComplete ?? true,
      }
      setUser(nextUser)
      setAuth(getToken(), nextUser)
      toast.success('Profile save ho gaya!')
    } catch (err) {
      toast.error(
        err.response?.data?.message || 'Save nahi ho paya.'
      )
    } finally {
      setSaveLoading(false)
    }
  }

  return (
    <div
      style={{ minHeight: '100vh', background: '#F0FDF4' }}
    >
      <div className="p-4 md:p-6 pb-8">
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="flex flex-wrap border-b border-gray-100">
              <button
                type="button"
                onClick={() => setActiveTab('details')}
                className={`cursor-pointer px-4 py-4 text-sm font-medium sm:px-6 ${
                  activeTab === 'details'
                    ? 'border-b-2 border-green-600 text-green-700'
                    : 'text-gray-500'
                }`}
              >
                Meri Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className={`cursor-pointer px-4 py-4 text-sm font-medium sm:px-6 ${
                  activeTab === 'documents'
                    ? 'border-b-2 border-green-600 text-green-700'
                    : 'text-gray-500'
                }`}
              >
                Mere Documents
              </button>
            </div>

            <div className="p-4 sm:p-6">
              {activeTab === 'details' && (
                <form onSubmit={handleSave} className="space-y-6">
                  <div className="flex flex-col items-center sm:items-start">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-green-50">
                      {displayPhoto ? (
                        <img
                          src={displayPhoto}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl font-bold text-green-800">
                          {initials}
                        </span>
                      )}
                    </div>
                    <label className="mt-3 cursor-pointer">
                      <span className="inline-block rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100">
                        Photo Change Karein
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Naam <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-field w-full"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Phone
                      </label>
                      <input
                        type="text"
                        disabled
                        value={user?.phone ?? ''}
                        className="input-field w-full cursor-not-allowed bg-gray-100 text-gray-600"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <p className="mb-2 text-sm font-medium text-gray-700">
                        Skills <span className="text-red-500">*</span>
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {VEHICLE_TYPES.map((t) => {
                          const checked = skills.includes(t)
                          return (
                            <label
                              key={t}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 p-2 text-sm ${
                                checked
                                  ? 'border-green-500 bg-green-100 text-green-700'
                                  : 'border-gray-200 text-gray-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleSkill(t)}
                                className="h-4 w-4 shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500"
                              />
                              {t}
                            </label>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Experience
                      </label>
                      <div className="flex min-h-[44px] items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white">
                        <input
                          type="number"
                          min={0}
                          value={experience}
                          onChange={(e) => setExperience(e.target.value)}
                          placeholder="5"
                          className="min-w-0 flex-1 border-0 px-3 py-2 text-sm focus:ring-0"
                        />
                        <span className="flex items-center border-l border-gray-200 bg-gray-50 px-3 text-sm text-gray-600">
                          saal
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        License Number
                      </label>
                      <input
                        type="text"
                        value={licenseNumber}
                        onChange={(e) =>
                          setLicenseNumber(e.target.value)
                        }
                        placeholder="BR-0420XXXX"
                        className="input-field w-full"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        License Type
                      </label>
                      <select
                        value={licenseType}
                        onChange={(e) =>
                          setLicenseType(e.target.value)
                        }
                        className="input-field w-full"
                      >
                        <option value="">Chuniye</option>
                        <option value="HMV">HMV</option>
                        <option value="LMV">LMV</option>
                        <option value="Both">Both</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        License Expiry
                      </label>
                      <input
                        type="date"
                        value={licenseExpiry}
                        onChange={(e) =>
                          setLicenseExpiry(e.target.value)
                        }
                        className="input-field w-full"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        About
                      </label>
                      <textarea
                        rows={3}
                        value={about}
                        onChange={(e) => setAbout(e.target.value)}
                        className="input-field w-full resize-y"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        State
                      </label>
                      <select
                        required
                        value={stateVal}
                        onChange={(e) => setStateVal(e.target.value)}
                        className="input-field w-full"
                      >
                        <option value="">State chuniye</option>
                        {STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        District
                      </label>
                      <input
                        type="text"
                        required
                        value={districtVal}
                        onChange={(e) =>
                          setDistrictVal(e.target.value)
                        }
                        className="input-field w-full"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="mb-4 text-base font-semibold text-gray-800">
                      Bank Details
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          UPI ID (Payment ke liye)
                        </label>
                        <input
                          type="text"
                          value={bankUpi}
                          onChange={(e) =>
                            setBankUpi(e.target.value)
                          }
                          placeholder="yourname@upi"
                          className="input-field w-full"
                        />
                        <div className="mt-2 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                          ⚠️ UPI ID sahi se bharo — owner isi pe
                          payment karega
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Ya QR Code Upload Karo
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleUpiQrChange}
                          className="w-full text-sm"
                        />
                        {bankUpiQr &&
                          (bankUpiQr.startsWith('data:image') ||
                            bankUpiQr.startsWith('http')) && (
                            <div className="mt-3">
                              <img
                                src={bankUpiQr}
                                alt="UPI QR"
                                className="max-h-40 rounded-lg border border-gray-200 object-contain"
                              />
                              <button
                                type="button"
                                onClick={() => setBankUpiQr('')}
                                className="mt-2 text-xs text-red-600"
                              >
                                QR hatao
                              </button>
                            </div>
                          )}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Account Holder Name
                        </label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) =>
                            setBankName(e.target.value)
                          }
                          className="input-field w-full"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Account Number
                        </label>
                        <input
                          type="text"
                          value={bankAccount}
                          onChange={(e) =>
                            setBankAccount(e.target.value)
                          }
                          className="input-field w-full"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          IFSC Code
                        </label>
                        <input
                          type="text"
                          value={bankIfsc}
                          onChange={(e) =>
                            setBankIfsc(
                              e.target.value.toUpperCase()
                            )
                          }
                          className="input-field w-full uppercase"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="min-h-[44px] rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {saveLoading ? 'Saving...' : 'Profile Save Karein'}
                  </button>
                </form>
              )}

              {activeTab === 'documents' && (
                <div className="space-y-6">
                  {documents.license ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: '#F0FDF4',
                        borderRadius: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <span>✅</span>
                      <span style={{ fontSize: '13px' }}>
                        License uploaded
                      </span>
                      <a
                        href={documents.license}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '12px',
                          color: '#1D4ED8',
                          marginLeft: 'auto',
                        }}
                      >
                        View
                      </a>
                    </div>
                  ) : null}
                  {documents.aadhar ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: '#F0FDF4',
                        borderRadius: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <span>✅</span>
                      <span style={{ fontSize: '13px' }}>
                        Aadhar uploaded
                      </span>
                      <a
                        href={documents.aadhar}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '12px',
                          color: '#1D4ED8',
                          marginLeft: 'auto',
                        }}
                      >
                        View
                      </a>
                    </div>
                  ) : null}
                  {documents.photo ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: '#F0FDF4',
                        borderRadius: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <span>✅</span>
                      <span style={{ fontSize: '13px' }}>
                        Document photo uploaded
                      </span>
                      <a
                        href={documents.photo}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '12px',
                          color: '#1D4ED8',
                          marginLeft: 'auto',
                        }}
                      >
                        View
                      </a>
                    </div>
                  ) : null}
                  {documents.other ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px',
                        background: '#F0FDF4',
                        borderRadius: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <span>✅</span>
                      <span style={{ fontSize: '13px' }}>
                        Other document uploaded
                      </span>
                      <a
                        href={documents.other}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: '12px',
                          color: '#1D4ED8',
                          marginLeft: 'auto',
                        }}
                      >
                        View
                      </a>
                    </div>
                  ) : null}

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Driving License
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="w-full text-sm"
                      onChange={(e) =>
                        setDocFiles((prev) => ({
                          ...prev,
                          license: e.target.files?.[0] || null,
                        }))
                      }
                    />
                    {docFiles.license ? (
                      <p className="mt-1 text-xs text-gray-600">
                        Selected: {docFiles.license.name}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Aadhar Card
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="w-full text-sm"
                      onChange={(e) =>
                        setDocFiles((prev) => ({
                          ...prev,
                          aadhar: e.target.files?.[0] || null,
                        }))
                      }
                    />
                    {docFiles.aadhar ? (
                      <p className="mt-1 text-xs text-gray-600">
                        Selected: {docFiles.aadhar.name}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Photo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full text-sm"
                      onChange={(e) =>
                        setDocFiles((prev) => ({
                          ...prev,
                          photo: e.target.files?.[0] || null,
                        }))
                      }
                    />
                    {docFiles.photo ? (
                      <p className="mt-1 text-xs text-gray-600">
                        Selected: {docFiles.photo.name}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Other document
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="w-full text-sm"
                      onChange={(e) =>
                        setDocFiles((prev) => ({
                          ...prev,
                          other: e.target.files?.[0] || null,
                        }))
                      }
                    />
                    {docFiles.other ? (
                      <p className="mt-1 text-xs text-gray-600">
                        Selected: {docFiles.other.name}
                      </p>
                    ) : null}
                  </div>

                  {docUploading ? (
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-gray-600">
                        <span>Upload ho raha hai...</span>
                        <span>{docUploadProgress}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-green-600 transition-all duration-150"
                          style={{
                            width: `${Math.max(2, docUploadProgress)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleDocUpload}
                    disabled={docUploading}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: docUploading ? '#9CA3AF' : '#16A34A',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: docUploading ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      fontSize: '14px',
                    }}
                  >
                    {docUploading
                      ? 'Upload ho raha hai...'
                      : '📄 Documents Upload Karo'}
                  </button>

                  <p className="text-sm text-gray-500">
                    Documents verify hone ke baad Verified badge milega
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DriverProfile
