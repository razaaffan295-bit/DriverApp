import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getUser } from '../../utils/helpers'
import {
  getConversations,
  getMessages,
  sendMessage,
} from '../../api/messageAPI'
import API from '../../api/axios'

const urlToken = (driverId, jobId) =>
  `${String(driverId)}|${String(jobId ?? '')}`

const lastPreview = (c) =>
  typeof c.lastMessage === 'string'
    ? c.lastMessage
    : c.lastMessage?.message ?? ''

const OwnerMessages = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [convLoading, setConvLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)

  const [showDriverProfile, setShowDriverProfile] = useState(false)
  const [driverProfileData, setDriverProfileData] = useState(null)
  const [showJobDetail, setShowJobDetail] = useState(false)
  const [jobDetailData, setJobDetailData] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const messagesEndRef = useRef(null)
  const pollRef = useRef(null)
  const urlSyncedKey = useRef('')
  const selectedConvRef = useRef(null)

  const currentUser = getUser()
  const myId = currentUser?._id || currentUser?.id

  const fetchConversations = async (isInitial = false) => {
    try {
      if (isInitial) setConvLoading(true)
      const res = await getConversations()
      setConversations(res.data?.conversations || [])
    } catch (err) {
      console.error(err)
    } finally {
      if (isInitial) setConvLoading(false)
    }
  }

  useEffect(() => {
    fetchConversations(true)
  }, [])

  useEffect(() => {
    selectedConvRef.current = selectedConv
  }, [selectedConv])

  const loadMessagesById = async (jobId, driverId) => {
    setMsgLoading(true)
    setMessages([])
    try {
      const jid =
        jobId &&
        jobId !== 'undefined' &&
        jobId !== 'null'
          ? jobId
          : 'none'
      const res = await getMessages(jid, driverId)
      setMessages(res.data?.messages || [])
    } catch (err) {
      console.error(err)
    } finally {
      setMsgLoading(false)
    }
  }

  const silentFetchMessages = async (conv) => {
    if (!conv) return
    try {
      const jobId = conv.jobId?._id || conv.jobId || 'none'
      const otherId =
        conv.otherUser?._id ||
        conv.otherUser ||
        conv.otherUserId
      if (!otherId) return
      const res = await getMessages(jobId, otherId)
      const newMsgs = res.data?.messages || []
      setMessages((prev) => {
        if (prev.length === newMsgs.length) return prev
        return newMsgs
      })
    } catch (err) {
      console.error(err)
    }
  }

  const selectConversation = async (conv) => {
    const driverId = String(
      conv.otherUserId ||
        conv.otherUser?._id ||
        conv.otherUser ||
        ''
    )
    const jidRaw = conv.jobId?._id ?? conv.jobId
    const jobKey =
      jidRaw != null &&
      String(jidRaw) !== 'none' &&
      String(jidRaw) !== 'undefined'
        ? String(jidRaw)
        : ''
    urlSyncedKey.current = urlToken(driverId, jobKey || 'none')

    setConversations((prev) =>
      prev.map((c) => {
        const cId = String(
          c.otherUserId ||
            c.otherUser?._id ||
            c.otherUser ||
            ''
        )
        const cJob = String(c.jobId?._id || c.jobId || '')
        const vJob = String(
          conv.jobId?._id || conv.jobId || ''
        )
        if (cId === driverId && cJob === vJob) {
          return { ...c, unreadCount: 0 }
        }
        return c
      })
    )

    const jobIdParam =
      jidRaw != null &&
      String(jidRaw) !== 'none' &&
      String(jidRaw) !== 'undefined'
        ? String(jidRaw)
        : null
    setSearchParams(
      jobIdParam
        ? { jobId: jobIdParam, driverId }
        : { driverId }
    )

    setSelectedConv(conv)
    setMsgLoading(true)
    setMessages([])

    try {
      const jobId = conv.jobId?._id || conv.jobId || 'none'
      const otherId =
        conv.otherUser?._id ||
        conv.otherUser ||
        conv.otherUserId
      const res = await getMessages(jobId, otherId)
      setMessages(res.data?.messages || [])
    } catch (err) {
      console.error(err)
    } finally {
      setMsgLoading(false)
    }
  }

  useEffect(() => {
    const driverId = searchParams.get('driverId')
    const jobId = searchParams.get('jobId')

    console.log('URL params:', { driverId, jobId })

    if (
      !driverId ||
      driverId === 'undefined' ||
      driverId === 'null'
    ) {
      urlSyncedKey.current = ''
      return
    }

    const targetJob =
      jobId &&
      jobId !== 'undefined' &&
      jobId !== 'null'
        ? String(jobId)
        : ''

    const found =
      conversations.length > 0
        ? conversations.find((c) => {
            const otherId = String(
              c.otherUser?._id ||
                c.otherUserId ||
                c.otherUser ||
                ''
            )
            if (otherId !== String(driverId)) return false
            const cJob = String(c.jobId?._id || c.jobId || '')
            if (!targetJob) return true
            return cJob === targetJob
          })
        : null

    const token = urlToken(driverId, targetJob)

    if (found) {
      const sel = selectedConvRef.current
      const foundOther = String(
        found.otherUser?._id ||
          found.otherUserId ||
          found.otherUser ||
          ''
      )
      const foundJob = String(
        found.jobId?._id || found.jobId || ''
      )
      const selOther = String(
        sel?.otherUser?._id ||
          sel?.otherUserId ||
          sel?.otherUser ||
          ''
      )
      const selJob = String(
        sel?.jobId?._id || sel?.jobId || ''
      )
      const alreadyShowing =
        sel &&
        selOther === foundOther &&
        selJob === foundJob
      if (alreadyShowing && urlSyncedKey.current === token) {
        return
      }
      urlSyncedKey.current = token
      selectConversation(found)
      return
    }

    if (urlSyncedKey.current === token) return
    urlSyncedKey.current = token
    const newConv = {
      jobId: targetJob || null,
      otherUser: driverId,
      otherUserId: driverId,
      otherUserName: 'Driver',
      lastMessage: '',
      unreadCount: 0,
    }
    setSelectedConv(newConv)
    loadMessagesById(jobId || 'none', driverId)
  }, [searchParams, conversations])

  useEffect(() => {
    if (!selectedConv) return

    pollRef.current = setInterval(() => {
      const live = selectedConvRef.current
      if (live) silentFetchMessages(live)
    }, 15000)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [selectedConv])

  useEffect(() => {
    const fetchOtherUserName = async () => {
      const otherId =
        selectedConv?.otherUser?._id ||
        selectedConv?.otherUser

      if (
        !otherId ||
        typeof selectedConv?.otherUser !== 'string'
      ) {
        return
      }

      try {
        const res = await API.get(
          `/api/driver/public/${otherId}`
        )
        setSelectedConv((prev) =>
          prev
            ? {
                ...prev,
                otherUserName:
                  res.data.user?.name || 'Driver',
              }
            : prev
        )
      } catch (err) {
        console.error(err)
      }
    }

    if (selectedConv) {
      fetchOtherUserName()
    }
  }, [selectedConv?.otherUser])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv) return

    const msgText = newMessage.trim()
    setNewMessage('')
    setSending(true)

    try {
      const jobId =
        selectedConv?.jobId?._id ||
        selectedConv?.jobId ||
        searchParams.get('jobId') ||
        null

      const receiverId =
        selectedConv?.otherUser?._id ||
        selectedConv?.otherUser ||
        selectedConv?.otherUserId ||
        searchParams.get('driverId')

      console.log('Sending message:', {
        jobId,
        receiverId,
        message: msgText,
      })

      if (!receiverId || receiverId === 'undefined') {
        toast.error('Receiver nahi mila')
        setNewMessage(msgText)
        setSending(false)
        return
      }

      await sendMessage({
        jobId:
          jobId && jobId !== 'undefined'
            ? jobId
            : undefined,
        receiverId,
        message: msgText,
      })

      const localMsg = {
        _id: Date.now().toString(),
        senderId: {
          _id: myId,
          name: currentUser?.name,
        },
        message: msgText,
        createdAt: new Date().toISOString(),
        isRead: false,
      }
      setMessages((prev) => [...prev, localMsg])
      fetchConversations()
    } catch (error) {
      console.error('Send error:', error)
      toast.error('Message nahi gaya')
      setNewMessage(msgText)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (date) => {
    try {
      return new Date(date).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const formatDate = (date) => {
    try {
      return new Date(date).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name
      .split(/\s+/)
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  const isMyMessage = (msg) => {
    const senderId = msg.senderId?._id || msg.senderId
    return String(senderId) === String(myId)
  }

  const groupedMessages = useMemo(() => {
    return messages.reduce((groups, msg) => {
      const date = new Date(msg.createdAt).toDateString()
      if (!groups[date]) groups[date] = []
      groups[date].push(msg)
      return groups
    }, {})
  }, [messages])

  const fetchDriverProfile = async () => {
    try {
      setProfileLoading(true)
      const driverId =
        selectedConv?.otherUser?._id ||
        selectedConv?.otherUser ||
        selectedConv?.otherUserId
      if (!driverId) return

      const res = await API.get(
        `/api/driver/public/${driverId}`
      )
      if (!res.data?.user) {
        toast.error('Profile load nahi hua')
        return
      }
      setDriverProfileData({
        user: res.data.user,
        profile: res.data.profile || {},
        avgRating: res.data.avgRating ?? 0,
        totalRatings: res.data.totalRatings ?? 0,
        ratings: res.data.ratings ?? [],
      })
      setShowDriverProfile(true)
    } catch (err) {
      toast.error('Profile load nahi hua')
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchJobDetail = async () => {
    try {
      const jobId =
        selectedConv?.jobId?._id || selectedConv?.jobId
      if (!jobId || jobId === 'none') {
        toast.error('Job detail nahi mili')
        return
      }

      const res = await API.get(`/api/jobs/public/${jobId}`)
      setJobDetailData(res.data.job)
      setShowJobDetail(true)
    } catch (err) {
      toast.error('Job detail load nahi hui')
    }
  }

  const chatHeaderName =
    selectedConv?.otherUserName ||
    selectedConv?.otherUser?.name ||
    'Driver'
  const chatHeaderJobTitle =
    selectedConv?.jobId?.title ||
    (typeof selectedConv?.jobId === 'object'
      ? ''
      : selectedConv?.jobId) ||
    ''

  return (
    <div className="flex h-[calc(100dvh-3.5rem-60px)] min-h-0 flex-col overflow-hidden bg-gray-50 md:h-[calc(100dvh)]">
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="flex w-full flex-col border-r border-gray-100 bg-white md:w-80 md:shrink-0">
              <div className="border-b border-gray-100 p-4">
                <h2 className="font-semibold text-gray-700">
                  Conversations
                </h2>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {convLoading ? (
                  <div className="p-4 text-center text-sm text-gray-400">
                    Load ho raha hai...
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-6 text-center text-sm text-gray-400">
                    Koi conversation nahi
                  </div>
                ) : (
                  conversations.map((conv) => {
                    const otherId = String(
                      conv.otherUser?._id ||
                        conv.otherUserId ||
                        conv.otherUser ||
                        ''
                    )
                    const selOther = String(
                      selectedConv?.otherUser?._id ||
                        selectedConv?.otherUserId ||
                        selectedConv?.otherUser ||
                        ''
                    )
                    const convJob = String(
                      conv.jobId?._id || conv.jobId || ''
                    )
                    const selJob = String(
                      selectedConv?.jobId?._id ||
                        selectedConv?.jobId ||
                        ''
                    )
                    const isSelected =
                      otherId === selOther && convJob === selJob

                    return (
                      <button
                        key={`${conv.jobId?._id ?? conv.jobId ?? 'no-job'}_${conv.otherUserId ?? otherId}`}
                        type="button"
                        onClick={() => selectConversation(conv)}
                        className={`flex w-full cursor-pointer items-center gap-3 border-b border-gray-50 p-4 text-left hover:bg-gray-50 ${
                          isSelected ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700">
                          {getInitials(
                            conv.otherUser?.name || 'D'
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-sm font-medium text-gray-800">
                              {conv.otherUser?.name || 'Driver'}
                            </span>
                            {conv.unreadCount > 0 && (
                              <span className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-700 text-xs text-white">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            {conv.jobId?.title ||
                              conv.jobId ||
                              'Job'}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-gray-400">
                            {lastPreview(conv)}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
              {!selectedConv ? (
                <div className="flex flex-1 items-center justify-center text-gray-400">
                  Conversation select karein
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 border-b border-gray-100 bg-white px-6 py-4">
                    <button
                      type="button"
                      onClick={fetchDriverProfile}
                      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-green-100 text-sm font-semibold text-green-700 transition-colors hover:bg-green-200"
                      title="Profile dekho"
                    >
                      {getInitials(
                        selectedConv?.otherUser?.name || 'D'
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={fetchDriverProfile}
                        className="block w-full text-left font-semibold text-gray-800 hover:text-blue-700 hover:underline"
                        title="Profile dekho"
                      >
                        {profileLoading
                          ? 'Load ho raha hai...'
                          : chatHeaderName}
                      </button>
                      <button
                        type="button"
                        onClick={fetchJobDetail}
                        className="mt-0.5 block w-full text-left text-xs text-blue-600 hover:underline"
                        title="Job detail dekho"
                      >
                        {chatHeaderJobTitle || 'Job detail dekho →'}
                      </button>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {msgLoading ? (
                      <div className="flex h-32 items-center justify-center">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="mt-16 text-center text-sm text-gray-400">
                        Pehla message bhejo!
                      </div>
                    ) : (
                      Object.entries(groupedMessages).map(
                        ([date, msgs]) => (
                          <div key={date}>
                            <div className="my-4 text-center text-xs text-gray-400">
                              {formatDate(msgs[0].createdAt)}
                            </div>
                            {msgs.map((msg, i) => (
                              <div
                                key={msg._id || i}
                                className={`mb-3 flex ${
                                  isMyMessage(msg)
                                    ? 'justify-end'
                                    : 'justify-start'
                                }`}
                              >
                                <div
                                  className={`max-w-xs rounded-2xl px-4 py-2 text-sm ${
                                    isMyMessage(msg)
                                      ? 'rounded-br-none bg-blue-700 text-white'
                                      : 'rounded-bl-none border border-gray-100 bg-white text-gray-800'
                                  }`}
                                >
                                  <div>{msg.message}</div>
                                  <div
                                    className={`mt-1 text-xs ${
                                      isMyMessage(msg)
                                        ? 'text-blue-200'
                                        : 'text-gray-400'
                                    }`}
                                  >
                                    {formatTime(msg.createdAt)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      )
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="border-t border-gray-100 bg-white p-4">
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) =>
                          setNewMessage(e.target.value)
                        }
                        onKeyDown={handleKeyDown}
                        placeholder="Message likhein..."
                        className="flex-1 rounded-xl border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={
                          sending || !newMessage.trim()
                        }
                        className="rounded-xl bg-blue-700 px-6 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                      >
                        {sending ? '...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

      {showDriverProfile && driverProfileData && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="driver-profile-title"
        >
          <div className="h-full w-full overflow-y-auto bg-white shadow-2xl md:w-96">
            <div className="flex items-center justify-between border-b p-5">
              <h2
                id="driver-profile-title"
                className="text-lg font-semibold"
              >
                Driver Profile
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowDriverProfile(false)
                  setDriverProfileData(null)
                }}
                className="text-2xl text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-700">
                  {getInitials(
                    driverProfileData.user?.name
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-800">
                  {driverProfileData.user?.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {driverProfileData.user?.location?.state}
                  {driverProfileData.user?.location?.state &&
                  driverProfileData.user?.location?.district
                    ? ', '
                    : ''}
                  {driverProfileData.user?.location?.district}
                </p>
                <span
                  className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${
                    driverProfileData.user?.isVerified
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {driverProfileData.user?.isVerified
                    ? '✓ Verified'
                    : 'Not Verified'}
                </span>
              </div>

              <div className="mb-5">
                <h4 className="mb-2 font-semibold text-gray-700">
                  Skills
                </h4>
                <div className="flex flex-wrap gap-2">
                  {driverProfileData.profile?.skills?.length > 0 ? (
                    driverProfileData.profile.skills.map(
                      (skill) => (
                        <span
                          key={String(skill)}
                          className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700"
                        >
                          {skill}
                        </span>
                      )
                    )
                  ) : (
                    <span className="text-sm text-gray-400">
                      Skills add nahi ki
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Experience
                  </span>
                  <span className="font-medium">
                    {driverProfileData.profile?.experience ??
                      '—'}{' '}
                    saal
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    License Type
                  </span>
                  <span className="font-medium">
                    {driverProfileData.profile?.licenseType ||
                      '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    License Number
                  </span>
                  <span className="font-medium">
                    {driverProfileData.profile?.licenseNumber ||
                      '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    License Expiry
                  </span>
                  <span className="font-medium">
                    {driverProfileData.profile?.licenseExpiry
                      ? new Date(
                          driverProfileData.profile.licenseExpiry
                        ).toLocaleDateString('en-IN')
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="mb-5">
                <h4 className="mb-2 font-semibold text-gray-700">
                  About
                </h4>
                <p className="text-sm text-gray-600">
                  {driverProfileData.profile?.about || '—'}
                </p>
              </div>

              <div className="mb-5">
                <h4 className="mb-3 font-semibold text-gray-700">
                  Rating
                </h4>
                <div className="mb-3 rounded-xl bg-gray-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl font-bold text-yellow-500">
                      {driverProfileData.avgRating}
                    </div>
                    <div>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`text-xl ${
                              star <=
                              Math.round(
                                Number(driverProfileData.avgRating)
                              )
                                ? 'text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                      <div className="mt-0.5 text-sm text-gray-500">
                        {driverProfileData.totalRatings} reviews
                      </div>
                    </div>
                  </div>
                </div>
                {(driverProfileData.ratings || []).length ===
                0 ? (
                  <p className="py-2 text-center text-sm text-gray-400">
                    Abhi koi rating nahi
                  </p>
                ) : (
                  <div className="max-h-48 space-y-3 overflow-y-auto">
                    {(driverProfileData.ratings || [])
                      .slice(0, 5)
                      .map((rating, i) => (
                        <div
                          key={rating._id || i}
                          className="rounded-xl border border-gray-100 bg-white p-3"
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  className={`text-sm ${
                                    star <= rating.score
                                      ? 'text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                >
                                  ★
                                </span>
                              ))}
                            </div>
                            <span className="text-xs text-gray-400">
                              {new Date(
                                rating.createdAt
                              ).toLocaleDateString('en-IN')}
                            </span>
                          </div>
                          {rating.review ? (
                            <p className="text-sm italic text-gray-600">
                              &quot;{rating.review}&quot;
                            </p>
                          ) : null}
                          <p className="mt-1 text-xs text-gray-400">
                            —{' '}
                            {rating.ratedBy?.name || 'Owner'}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showJobDetail && jobDetailData && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
        >
          <div className="h-full w-full overflow-y-auto bg-white shadow-2xl md:w-96">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-semibold">
                Job Detail
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowJobDetail(false)
                  setJobDetailData(null)
                }}
                className="text-2xl text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                {jobDetailData.vehicleType}
              </span>

              <h3 className="mb-4 mt-3 text-xl font-bold text-gray-800">
                {jobDetailData.title}
              </h3>

              <div className="mb-5 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="mb-1 text-xs text-gray-500">
                    Salary
                  </div>
                  <div className="font-bold text-blue-700">
                    ₹{jobDetailData.salaryPerDay}/din
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="mb-1 text-xs text-gray-500">
                    Duration
                  </div>
                  <div className="font-bold">
                    {jobDetailData.duration} din
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="mb-1 text-xs text-gray-500">
                    Start Date
                  </div>
                  <div className="text-sm font-medium">
                    {jobDetailData.startDate
                      ? new Date(
                          jobDetailData.startDate
                        ).toLocaleDateString('en-IN')
                      : '—'}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="mb-1 text-xs text-gray-500">
                    Total Kamayi
                  </div>
                  <div className="font-bold text-green-700">
                    ₹
                    {(Number(jobDetailData.salaryPerDay) ||
                      0) *
                      (Number(jobDetailData.duration) || 0)}
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="mb-1 text-sm text-gray-500">
                  📍 Location
                </div>
                <div className="font-medium">
                  {jobDetailData.location?.state},{' '}
                  {jobDetailData.location?.district},{' '}
                  {jobDetailData.location?.city}
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {jobDetailData.location?.address}
                </div>
              </div>

              {jobDetailData.description && (
                <div>
                  <div className="mb-2 font-semibold text-gray-700">
                    Kaam ki Details
                  </div>
                  <p className="text-sm text-gray-600">
                    {jobDetailData.description}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OwnerMessages
