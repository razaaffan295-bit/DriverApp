import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getUser } from '../../utils/helpers'
import {
  getConversations,
  getMessages,
  sendMessage,
} from '../../api/messageAPI'
import API from '../../api/axios'

const urlToken = (ownerId, jobId) =>
  `${String(ownerId)}|${String(jobId ?? '')}`

const lastPreview = (c) =>
  typeof c.lastMessage === 'string'
    ? c.lastMessage
    : c.lastMessage?.message ?? ''

const DriverMessages = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const [conversations, setConversations] = useState([])
  const [selectedConv, setSelectedConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [convLoading, setConvLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)

  const [showOwnerProfile, setShowOwnerProfile] =
    useState(false)
  const [ownerProfileData, setOwnerProfileData] =
    useState(null)
  const [showJobDetail, setShowJobDetail] = useState(false)
  const [jobDetailData, setJobDetailData] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [view, setView] = useState('list')

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
    const ownerId = String(
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
    urlSyncedKey.current = urlToken(ownerId, jobKey || 'none')

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
        if (cId === ownerId && cJob === vJob) {
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
        ? { jobId: jobIdParam, otherUserId: ownerId }
        : { otherUserId: ownerId }
    )

    setView('chat')
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
    const ownerId =
      searchParams.get('ownerId') ||
      searchParams.get('otherUserId')
    const jobId = searchParams.get('jobId') || ''

    if (!ownerId || ownerId === 'undefined') {
      urlSyncedKey.current = ''
      return
    }
    if (conversations.length === 0) return

    const token = urlToken(ownerId, jobId)
    if (urlSyncedKey.current === token) return

    const targetJob =
      jobId && jobId !== 'undefined' ? String(jobId) : ''

    const found = conversations.find((c) => {
      const otherId = String(
        c.otherUser?._id || c.otherUserId || c.otherUser || ''
      )
      if (otherId !== String(ownerId)) return false
      const cJob = String(c.jobId?._id || c.jobId || '')
      if (!targetJob) return true
      return cJob === targetJob
    })

    if (found) {
      urlSyncedKey.current = token
      selectConversation(found)
      return
    }

    urlSyncedKey.current = token
    const synthetic = {
      jobId:
        targetJob && targetJob !== 'undefined'
          ? targetJob
          : 'none',
      otherUser: ownerId,
      otherUserId: ownerId,
      otherUserName: 'Owner',
      lastMessage: '',
      unreadCount: 0,
    }
    setView('chat')
    setSelectedConv(synthetic)
    setMsgLoading(false)
    silentFetchMessages(synthetic)
  }, [conversations, searchParams])

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
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    })
  }, [messages])

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConv) return

    const msgText = newMessage.trim()
    const jobId =
      selectedConv.jobId?._id || selectedConv.jobId
    const receiverId =
      selectedConv.otherUser?._id ||
      selectedConv.otherUser ||
      selectedConv.otherUserId

    if (!receiverId) {
      toast.error('Receiver nahi mila')
      return
    }

    setNewMessage('')
    setSending(true)

    try {
      await sendMessage({
        jobId: jobId || undefined,
        receiverId,
        message: msgText,
      })

      const localMsg = {
        _id: `local-${Date.now()}`,
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
      console.error(error)
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

  const fetchOwnerProfile = async () => {
    try {
      setProfileLoading(true)

      const ownerId =
        selectedConv?.otherUser?._id ||
        selectedConv?.otherUser ||
        selectedConv?.otherUserId

      console.log('Fetching owner:', ownerId)

      if (!ownerId) {
        toast.error('Owner ID nahi mila')
        return
      }

      const res = await API.get(
        `/api/owner/public/${ownerId}`
      )

      console.log('Owner data:', res.data)

      setOwnerProfileData(res.data)
      setShowOwnerProfile(true)
    } catch (err) {
      console.error('Owner profile error:', err)
      toast.error(
        err.response?.data?.message ||
          'Profile load nahi hua'
      )
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
    'Owner'
  const chatHeaderJobTitle =
    selectedConv?.jobId?.title ||
    (typeof selectedConv?.jobId === 'object'
      ? ''
      : selectedConv?.jobId) ||
    ''

  return (
    <div
      className="min-h-0 w-full overflow-hidden md:h-[calc(100dvh-4rem)]"
      style={{
        height: 'calc(100dvh - 116px)',
        display: 'flex',
        flexDirection: 'column',
        background: '#F0FDF4',
      }}
    >
      <div
        className="flex min-h-0 flex-1 overflow-hidden"
        style={{ display: 'flex', overflow: 'hidden' }}
      >
        <style>{`
          @media (min-width: 768px) {
            .driver-conv-list {
              width: 320px !important;
              max-width: 320px;
              flex-shrink: 0;
            }
          }
        `}</style>

        <div
          className={`driver-conv-list min-h-0 w-full border-r border-[#E5E7EB] bg-white ${
            view === 'list' ? 'flex flex-col' : 'hidden'
          } md:flex md:flex-col`}
          style={{ overflow: 'hidden' }}
        >
          <div
            style={{
              padding: '16px',
              borderBottom: '1px solid #F3F4F6',
              fontWeight: '700',
              fontSize: '18px',
              flexShrink: 0,
            }}
          >
            Messages
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {convLoading ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '24px',
                  color: '#9CA3AF',
                  fontSize: '14px',
                }}
              >
                Load ho raha hai...
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
                const displayName =
                  conv.otherUserName ||
                  conv.otherUser?.name ||
                  'Owner'

                return (
                  <button
                    key={`${conv.jobId?._id ?? conv.jobId ?? 'no-job'}_${conv.otherUserId ?? otherId}`}
                    type="button"
                    onClick={() => selectConversation(conv)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      border: 'none',
                      borderBottom: '1px solid #F9FAFB',
                      background: isSelected ? '#F0FDF4' : 'white',
                      width: '100%',
                      textAlign: 'left',
                    }}
                    className="hover:bg-gray-50"
                  >
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: '#DCFCE7',
                        color: '#16A34A',
                        fontWeight: '700',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {(displayName || 'O')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          fontWeight: '600',
                          fontSize: '14px',
                          color: '#111827',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {displayName}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#9CA3AF',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px',
                        }}
                      >
                        {lastPreview(conv) || '...'}
                      </div>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexShrink: 0,
                      }}
                    >
                      {conv.unreadCount > 0 && (
                        <div
                          style={{
                            background: '#16A34A',
                            color: 'white',
                            borderRadius: '50%',
                            minWidth: '20px',
                            height: '20px',
                            fontSize: '11px',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0 4px',
                          }}
                        >
                          {conv.unreadCount > 9
                            ? '9+'
                            : conv.unreadCount}
                        </div>
                      )}
                      <span
                        style={{
                          color: '#D1D5DB',
                          fontSize: '18px',
                        }}
                      >
                        ›
                      </span>
                    </div>
                  </button>
                )
              })
            )}
            {!convLoading && conversations.length === 0 && (
              <div
                style={{
                  padding: '48px 16px',
                  textAlign: 'center',
                  color: '#9CA3AF',
                }}
              >
                <div
                  style={{ fontSize: '36px', marginBottom: '8px' }}
                >
                  💬
                </div>
                Koi conversation nahi
              </div>
            )}
          </div>
        </div>

        <div
          className={`min-h-0 flex-1 flex-col overflow-hidden bg-[#F9FAFB] ${
            view === 'chat' ? 'flex' : 'hidden'
          } md:flex`}
        >
          {selectedConv ? (
            <>
              <div
                style={{
                  padding: '12px 16px',
                  background: 'white',
                  borderBottom: '1px solid #E5E7EB',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexShrink: 0,
                }}
              >
                <button
                  type="button"
                  className="md:hidden"
                  onClick={() => setView('list')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#16A34A',
                    padding: '4px',
                    flexShrink: 0,
                  }}
                  aria-label="Wapas"
                >
                  ← Wapas
                </button>
                <button
                  type="button"
                  onClick={fetchOwnerProfile}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#DCFCE7',
                    color: '#16A34A',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  title="Profile dekho"
                >
                  {(chatHeaderName || 'O')
                    .charAt(0)
                    .toUpperCase()}
                </button>
                <div
                  style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}
                >
                  <button
                    type="button"
                    onClick={fetchOwnerProfile}
                    style={{
                      fontWeight: '600',
                      fontSize: '15px',
                      color: '#111827',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'block',
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title="Profile dekho"
                  >
                    {profileLoading
                      ? 'Load ho raha hai...'
                      : chatHeaderName}
                  </button>
                  <button
                    type="button"
                    onClick={fetchJobDetail}
                    style={{
                      fontSize: '12px',
                      color: '#9CA3AF',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      marginTop: '2px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'block',
                      width: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title="Job detail dekho"
                  >
                    {chatHeaderJobTitle || '\u00a0'}
                  </button>
                </div>
              </div>

              <div
                className="min-h-0 flex-1 overflow-y-auto"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {msgLoading ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px',
                      color: '#9CA3AF',
                    }}
                  >
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-green-600 border-t-transparent" />
                  </div>
                ) : messages.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px',
                      color: '#9CA3AF',
                    }}
                  >
                    Pehla message bhejo!
                  </div>
                ) : (
                  messages.map((msg, i) => {
                    const isMe = isMyMessage(msg)
                    return (
                      <div
                        key={msg._id || i}
                        style={{
                          display: 'flex',
                          justifyContent: isMe
                            ? 'flex-end'
                            : 'flex-start',
                        }}
                      >
                        <div
                          style={{
                            maxWidth: '70%',
                            padding: '10px 14px',
                            borderRadius: isMe
                              ? '18px 18px 4px 18px'
                              : '18px 18px 18px 4px',
                            background: isMe ? '#16A34A' : 'white',
                            color: isMe ? 'white' : '#111827',
                            fontSize: '14px',
                            boxShadow:
                              '0 1px 2px rgba(0,0,0,0.08)',
                          }}
                        >
                          {msg.message}
                          <div
                            style={{
                              fontSize: '10px',
                              marginTop: '4px',
                              opacity: 0.7,
                              textAlign: 'right',
                            }}
                          >
                            {formatTime(msg.createdAt)}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div
                style={{
                  padding: '12px 16px',
                  background: 'white',
                  borderTop: '1px solid #E5E7EB',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) =>
                    setNewMessage(e.target.value)
                  }
                  onKeyDown={handleKeyDown}
                  placeholder="Message likhein..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '10px 14px',
                    borderRadius: '24px',
                    border: '1px solid #E5E7EB',
                    outline: 'none',
                    fontSize: '14px',
                    background: '#F9FAFB',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background:
                      sending || !newMessage.trim()
                        ? '#86EFAC'
                        : '#16A34A',
                    border: 'none',
                    cursor: sending ? 'default' : 'pointer',
                    color: 'white',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  aria-label="Send"
                >
                  ➤
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9CA3AF',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ fontSize: '48px' }}>💬</div>
              <div>Kisi se baat karein</div>
            </div>
          )}
        </div>
      </div>

      {showOwnerProfile && ownerProfileData && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black bg-opacity-50">
          <div className="h-full w-full overflow-y-auto bg-white md:w-96">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-semibold">
                Owner Profile
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowOwnerProfile(false)
                  setOwnerProfileData(null)
                }}
                className="text-2xl text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-5">
              <div className="mb-5 text-center">
                <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700">
                  {getInitials(
                    ownerProfileData.user?.name
                  )}
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  {ownerProfileData.user?.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {ownerProfileData.user?.location?.state}
                  {ownerProfileData.user?.location?.state &&
                  ownerProfileData.user?.location?.district
                    ? ', '
                    : ''}
                  {ownerProfileData.user?.location?.district}
                </p>
                <span
                  className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${
                    ownerProfileData.user?.isVerified
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {ownerProfileData.user?.isVerified
                    ? '✓ Verified'
                    : 'Not Verified'}
                </span>
                {ownerProfileData.profile?.companyName && (
                  <p className="mt-1 font-medium text-blue-700">
                    {ownerProfileData.profile.companyName}
                  </p>
                )}
              </div>

              {ownerProfileData.profile?.about && (
                <div className="mb-5">
                  <h4 className="mb-2 font-semibold text-gray-800">
                    About
                  </h4>
                  <p className="text-sm text-gray-600">
                    {ownerProfileData.profile.about}
                  </p>
                </div>
              )}

              <div className="mb-5">
                <h4 className="mb-2 font-semibold text-gray-800">
                  Gadiyaan
                </h4>
                {ownerProfileData.vehicles?.length > 0 ? (
                  ownerProfileData.vehicles.map((v, i) => (
                    <div
                      key={String(v._id ?? i)}
                      className="flex items-center justify-between border-b border-gray-50 py-2 text-sm"
                    >
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
                        {v.vehicleType}
                      </span>
                      <span className="font-medium">
                        {v.vehicleNumber || '—'}
                      </span>
                      <span className="text-gray-500">
                        {v.location?.state || ''}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">
                    Koi gadi nahi
                  </p>
                )}
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Rating
                  </span>
                  <span className="font-bold text-yellow-600">
                    ★ {ownerProfileData.avgRating} (
                    {ownerProfileData.totalRatings} reviews)
                  </span>
                </div>
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
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
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
                  <div className="font-bold text-green-700">
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

export default DriverMessages
