import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { getUser } from '../utils/helpers'
import axios from '../api/axios'

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

const Subscription = () => {
  const navigate = useNavigate()
  const user = getUser()
  const [loading, setLoading] = useState(false)
  const isOwner = user?.role === 'owner'

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    if (user.role === 'admin') {
      navigate('/admin/dashboard', { replace: true })
      return
    }
    loadRazorpayScript()
  }, [user, navigate])

  const handlePayment = async () => {
    try {
      setLoading(true)

      await loadRazorpayScript()

      const res = await axios.post('/api/subscription/create-order')

      if (!res.data.success) {
        toast.error(res.data.message)
        return
      }

      const { order, key, user: userData } = res.data

      if (!window.Razorpay) {
        toast.error(
          'Razorpay load nahi hua. Internet check karein.'
        )
        return
      }

      const options = {
        key: key,
        amount: order.amount,
        currency: 'INR',
        name: 'DriverApp',
        description: isOwner
          ? 'Owner Subscription ₹499/month'
          : 'Driver Subscription ₹99/month',
        order_id: order.id,
        handler: async (response) => {
          try {
            const verifyRes = await axios.post(
              '/api/subscription/verify',
              {
                razorpay_order_id:
                  response.razorpay_order_id,
                razorpay_payment_id:
                  response.razorpay_payment_id,
                razorpay_signature:
                  response.razorpay_signature,
              }
            )

            if (verifyRes.data.success) {
              toast.success(
                'Payment successful! Subscription active!'
              )
              if (isOwner) {
                navigate('/owner/post-job')
              } else {
                navigate('/driver/jobs')
              }
            }
          } catch (err) {
            toast.error('Payment verify nahi hua')
          }
        },
        prefill: {
          name: userData?.name || '',
          contact: userData?.contact || '',
          email: userData?.email || '',
        },
        theme: {
          color: isOwner ? '#1D4ED8' : '#16A34A',
        },
        modal: {
          ondismiss: () => {
            setLoading(false)
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      console.error('Payment error:', err)
      toast.error(
        err.response?.data?.message ||
          'Kuch galat hua. Dobara try karein.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (!user || user.role === 'admin') {
    return null
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: isOwner ? '#F0F4FF' : '#F0FDF4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 24px 24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '24px',
          padding: 'clamp(24px, 5vw, 40px) clamp(20px, 4vw, 32px)',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            fontSize: 'clamp(40px, 10vw, 48px)',
            marginBottom: '16px',
          }}
        >
          {isOwner ? '🏢' : '🚗'}
        </div>

        <h1
          style={{
            fontSize: 'clamp(20px, 5vw, 24px)',
            fontWeight: '700',
            color: '#111827',
            marginBottom: '8px',
          }}
        >
          Subscription Chahiye
        </h1>

        <p
          style={{
            color: '#6B7280',
            fontSize: '14px',
            marginBottom: '32px',
            lineHeight: '1.6',
          }}
        >
          {isOwner
            ? 'Job post karne ke liye monthly subscription lo'
            : 'Jobs apply karne ke liye monthly subscription lo'}
        </p>

        <div
          style={{
            background: isOwner ? '#EFF6FF' : '#F0FDF4',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              fontSize: 'clamp(32px, 8vw, 40px)',
              fontWeight: '800',
              color: isOwner ? '#1D4ED8' : '#16A34A',
            }}
          >
            ₹{isOwner ? '499' : '99'}
          </div>
          <div
            style={{
              color: '#6B7280',
              fontSize: '14px',
            }}
          >
            per month
          </div>

          <div
            style={{
              marginTop: '16px',
              textAlign: 'left',
            }}
          >
            {(isOwner
              ? [
                  'Unlimited job posts',
                  'Driver profiles dekho',
                  'Attendance + Payments',
                  'Complaint system',
                  '30 din valid',
                ]
              : [
                  'Unlimited job apply',
                  'Owner se direct contact',
                  'Attendance track karo',
                  'Payment receive karo',
                  '30 din valid',
                ]
            ).map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  fontSize: '13px',
                  color: '#374151',
                }}
              >
                <span
                  style={{
                    color: isOwner ? '#1D4ED8' : '#16A34A',
                    fontSize: '16px',
                  }}
                >
                  ✓
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handlePayment}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: loading
              ? '#9CA3AF'
              : isOwner
                ? '#1D4ED8'
                : '#16A34A',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading
            ? 'Loading...'
            : `Pay ₹${isOwner ? 499 : 99} - Subscribe`}
        </button>

        <p
          style={{
            marginTop: '16px',
            fontSize: '12px',
            color: '#9CA3AF',
          }}
        >
          Secure payment by Razorpay
        </p>
      </div>
    </div>
  )
}

export default Subscription
