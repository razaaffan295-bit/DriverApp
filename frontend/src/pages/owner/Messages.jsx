import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
    setView('chat')
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
        toast.error(t('receiverNotFound'))
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
      toast.error(t('messageSendError'))
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
        toast.error(t('profileLoadError2'))
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
      toast.error(t('profileLoadError2'))
    } finally {
      setProfileLoading(false)
    }
  }

  const fetchJobDetail = async () => {
    try {
      const jobId =
        selectedConv?.jobId?._id || selectedConv?.jobId
      if (!jobId || jobId === 'none') {
        toast.error(t('jobDetailError'))
        return
      }

      const res = await API.get(`/api/jobs/public/${jobId}`)
      setJobDetailData(res.data.job)
      setShowJobDetail(true)
    } catch (err) {
      toast.error(t('jobDetailError'))
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
    <div
      className="min-h-0 w-full overflow-hidden md:h-[calc(100dvh-4rem)]"
      style={{
        height: 'calc(100dvh - 116px)',
        display: 'flex',
        flexDirection: 'column',
        background: '#F0F4FF',
      }}
    >
      <div
        className="flex min-h-0 flex-1 overflow-hidden"
        style={{ display: 'flex', overflow: 'hidden' }}
      >
        <style>{`
          @media (min-width: 768px) {
            .owner-conv-list {
              width: 320px !important;
              max-width: 320px;
              flex-shrink: 0;
            }
          }
        `}</style>

        <div
          className={`owner-conv-list min-h-0 w-full border-r border-[#E5E7EB] bg-white ${
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
            {t('messages')}
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
                {t('loading')}
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
                  'Driver'

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
                      background: isSelected ? '#EFF6FF' : 'white',
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
                        background: '#DBEAFE',
                        color: '#1D4ED8',
                        fontWeight: '700',
                        fontSize: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {(displayName || 'D')
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
                            background: '#1D4ED8',
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
                {t('noMessages')}
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
                    color: '#374151',
                    padding: '4px',
                    flexShrink: 0,
                  }}
                  aria-label={t('backBtn')}
                >
                  {t('backBtn')}
                </button>
                <button
                  type="button"
                  onClick={fetchDriverProfile}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#DBEAFE',
                    color: '#1D4ED8',
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
                  {(chatHeaderName || 'D')
                    .charAt(0)
                    .toUpperCase()}
                </button>
                <div
                  style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}
                >
                  <button
                    type="button"
                    onClick={fetchDriverProfile}
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
                      ? t('loading')
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
                    <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
                  </div>
                ) : messages.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '32px',
                      color: '#9CA3AF',
                    }}
                  >
                    {t('sendFirstMessage')}
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
                            background: isMe ? '#1D4ED8' : 'white',
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
                  placeholder={t('messagePlaceholder')}
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
                        ? '#93C5FD'
                        : '#1D4ED8',
                    border: 'none',
                    cursor: sending ? 'default' : 'pointer',
                    color: 'white',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                  aria-label={t('send')}
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
              <div>{t('startConversation')}</div>
            </div>
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
                {t('driverProfile')}
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
                    ? t('verified')
                    : t('notVerified')}
                </span>
              </div>

              <div className="mb-5">
                <h4 className="mb-2 font-semibold text-gray-700">
                  {t('skillsLabel')}
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
                      {t('noSkillsAdded')}
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    {t('experienceLabel2')}
                  </span>
                  <span className="font-medium">
                    {driverProfileData.profile?.experience ??
                      '—'}{' '}
                    {t('years')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    {t('licenseTypeLabel')}
                  </span>
                  <span className="font-medium">
                    {driverProfileData.profile?.licenseType ||
                      '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    {t('licenseNumberLabel')}
                  </span>
                  <span className="font-medium">
                    {driverProfileData.profile?.licenseNumber ||
                      '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    {t('licenseExpiryLabel')}
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
                  {t('aboutLabel2')}
                </h4>
                <p className="text-sm text-gray-600">
                  {driverProfileData.profile?.about || '—'}
                </p>
              </div>

              <div className="mb-5">
                <h4 className="mb-3 font-semibold text-gray-700">
                  {t('ratingLabel2')}
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
                        {driverProfileData.totalRatings} {t('reviews')}
                      </div>
                    </div>
                  </div>
                </div>
                {(driverProfileData.ratings || []).length ===
                0 ? (
                  <p className="py-2 text-center text-sm text-gray-400">
                    {t('noRatingYet2')}
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
                            {rating.ratedBy?.name ||
                              t('ownerLabel2')}
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
                {t('jobDetail')}
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
                    {t('salaryLabel')}
                  </div>
                  <div className="font-bold text-blue-700">
                    ₹{jobDetailData.salaryPerDay}/{t('perDay')}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="mb-1 text-xs text-gray-500">
                    {t('durationLabel')}
                  </div>
                  <div className="font-bold">
                    {jobDetailData.duration} {t('durationDays')}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <div className="mb-1 text-xs text-gray-500">
                    {t('startDateLabel')}
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
                    {t('totalEarnings')}
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
                  📍 {t('locationLabel')}
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
                    {t('jobDetailsLabel')}
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
