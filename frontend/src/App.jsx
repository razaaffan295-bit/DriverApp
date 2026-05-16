import { useEffect, lazy, Suspense } from 'react'
import { App as CapApp } from '@capacitor/app'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary'
import NetworkStatus from './components/NetworkStatus'
import ProtectedRoute from './components/common/ProtectedRoute'
import SubscriptionGuard from './components/SubscriptionGuard'
import OwnerLayout from './layouts/OwnerLayout'
import DriverLayout from './layouts/DriverLayout'

// Public Pages - keep Landing eager (first paint)
import Landing from './pages/public/Landing'
import Login from './pages/public/Login'
import Signup from './pages/public/Signup'

// Lazy load all other pages
const OwnerDashboard = lazy(() => import('./pages/owner/Dashboard'))
const OwnerProfile = lazy(() => import('./pages/owner/Profile'))
const Vehicles = lazy(() => import('./pages/owner/Vehicles'))
const PostJob = lazy(() => import('./pages/owner/PostJob'))
const OwnerJobs = lazy(() => import('./pages/owner/Jobs'))
const OwnerJobDetail = lazy(() => import('./pages/owner/JobDetail'))
const OwnerApplications = lazy(() => import('./pages/owner/Applications'))
const OwnerMessages = lazy(() => import('./pages/owner/Messages'))
const CreateContract = lazy(() => import('./pages/owner/CreateContract'))
const ViewContract = lazy(() => import('./pages/owner/ViewContract'))
const OwnerAttendance = lazy(() => import('./pages/owner/Attendance'))
const OwnerPayments = lazy(() => import('./pages/owner/Payments'))
const OwnerTrips = lazy(() => import('./pages/owner/Trips'))
const InviteDriver = lazy(() => import('./pages/owner/InviteDriver'))
const VehicleDetail = lazy(() => import('./pages/owner/VehicleDetail'))
const DriverDetail = lazy(() => import('./pages/owner/DriverDetail'))
const OwnerComplaints = lazy(() => import('./pages/owner/Complaints'))
const OwnerRatings = lazy(() => import('./pages/owner/Ratings'))
const OwnerMyDrivers = lazy(() => import('./pages/owner/MyDrivers'))

const DriverDashboard = lazy(() => import('./pages/driver/Dashboard'))
const DriverProfile = lazy(() => import('./pages/driver/Profile'))
const JobSearch = lazy(() => import('./pages/driver/JobSearch'))
const JobDetail = lazy(() => import('./pages/driver/JobDetail'))
const DriverApplications = lazy(() => import('./pages/driver/MyApplications'))
const DriverMessages = lazy(() => import('./pages/driver/Messages'))
const ActiveJob = lazy(() => import('./pages/driver/ActiveJob'))
const DriverAttendance = lazy(() => import('./pages/driver/Attendance'))
const DriverPayments = lazy(() => import('./pages/driver/Payments'))
const DriverTrips = lazy(() => import('./pages/driver/Trips'))
const DriverInvites = lazy(() => import('./pages/driver/Invites'))
const DriverComplaints = lazy(() => import('./pages/driver/Complaints'))
const DriverRatings = lazy(() => import('./pages/driver/Ratings'))

const AdminLogin = lazy(() => import('./pages/admin/Login'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AdminComplaints = lazy(() => import('./pages/admin/Complaints'))
const AdminSubscriptions = lazy(() => import('./pages/admin/Subscriptions'))
const SubscriptionManager = lazy(() => import('./pages/admin/SubscriptionManager'))
const Subscription = lazy(() => import('./pages/Subscription'))

const LoadingFallback = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#F0F4FF',
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3px solid #E5E7EB',
      borderTopColor: '#1D4ED8',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    }} />
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
)

function App() {
  useEffect(() => {
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back()
      } else {
        CapApp.minimizeApp()
      }
    })
    return () => {
      CapApp.removeAllListeners()
    }
  }, [])

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <NetworkStatus />
        <Toaster position="top-right" />
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" 
          element={<Login />} />
        <Route path="/signup" 
          element={<Signup />} />
        <Route path="/admin/login" 
          element={<AdminLogin />} />

        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <Subscription />
            </ProtectedRoute>
          }
        />
        
        {/* Owner Routes */}
        <Route
          element={
            <ProtectedRoute role="owner">
              <SubscriptionGuard>
                <OwnerLayout />
              </SubscriptionGuard>
            </ProtectedRoute>
          }
        >
          <Route path="/owner/dashboard" element={<OwnerDashboard />} />
          <Route path="/owner/profile" element={<OwnerProfile />} />
          <Route path="/owner/vehicles" element={<Vehicles />} />
          <Route path="/owner/vehicles/:id" element={<VehicleDetail />} />
          <Route path="/owner/post-job" element={<PostJob />} />
          <Route path="/owner/jobs/:id" element={<OwnerJobDetail />} />
          <Route path="/owner/jobs" element={<OwnerJobs />} />
          <Route path="/owner/applications" element={<OwnerApplications />} />
          <Route path="/owner/messages" element={<OwnerMessages />} />
          <Route path="/owner/drivers" element={<OwnerMyDrivers />} />
          <Route path="/owner/driver-detail/:id" element={<DriverDetail />} />
          <Route path="/owner/invite-driver" element={<InviteDriver />} />
          <Route path="/owner/attendance" element={<OwnerAttendance />} />
          <Route path="/owner/trips" element={<OwnerTrips />} />
          <Route path="/owner/payments" element={<OwnerPayments />} />
          <Route path="/owner/complaints" element={<OwnerComplaints />} />
          <Route path="/owner/ratings" element={<OwnerRatings />} />
          <Route path="/owner/contracts/:id" element={<ViewContract />} />
          <Route path="/owner/create-contract" element={<CreateContract />} />
        </Route>
        
        {/* Driver Routes */}
        <Route
          element={
            <ProtectedRoute role="driver">
              <SubscriptionGuard>
                <DriverLayout />
              </SubscriptionGuard>
            </ProtectedRoute>
          }
        >
          <Route path="/driver/dashboard" element={<DriverDashboard />} />
          <Route path="/driver/profile" element={<DriverProfile />} />
          <Route path="/driver/jobs" element={<JobSearch />} />
          <Route path="/driver/jobs/:id" element={<JobDetail />} />
          <Route path="/driver/applications" element={<DriverApplications />} />
          <Route path="/driver/active-job" element={<ActiveJob />} />
          <Route path="/driver/messages" element={<DriverMessages />} />
          <Route path="/driver/attendance" element={<DriverAttendance />} />
          <Route path="/driver/trips" element={<DriverTrips />} />
          <Route path="/driver/payments" element={<DriverPayments />} />
          <Route path="/driver/complaints" element={<DriverComplaints />} />
          <Route path="/driver/ratings" element={<DriverRatings />} />
          <Route path="/driver/invites" element={<DriverInvites />} />
        </Route>
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard"
          element={
            <ProtectedRoute role="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/users"
          element={
            <ProtectedRoute role="admin">
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/complaints"
          element={
            <ProtectedRoute role="admin">
              <AdminComplaints />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/subscriptions"
          element={
            <ProtectedRoute role="admin">
              <AdminSubscriptions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/subscription-manager"
          element={
            <ProtectedRoute role="admin">
              <SubscriptionManager />
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" 
          element={<Navigate to="/" replace />} 
        />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
