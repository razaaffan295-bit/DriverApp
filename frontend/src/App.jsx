import { BrowserRouter, Routes, Route, 
  Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ProtectedRoute from 
  './components/common/ProtectedRoute'
import OwnerLayout from './layouts/OwnerLayout'
import DriverLayout from './layouts/DriverLayout'

// Public Pages
import Landing from './pages/public/Landing'
import Login from './pages/public/Login'
import Signup from './pages/public/Signup'

// Owner Pages
import OwnerDashboard from 
  './pages/owner/Dashboard'
import OwnerProfile from 
  './pages/owner/Profile'
import Vehicles from './pages/owner/Vehicles'
import PostJob from './pages/owner/PostJob'
import OwnerJobs from './pages/owner/Jobs'
import OwnerJobDetail from './pages/owner/JobDetail'
import OwnerApplications from 
  './pages/owner/Applications'
import OwnerMessages from 
  './pages/owner/Messages'
import CreateContract from 
  './pages/owner/CreateContract'
import ViewContract from 
  './pages/owner/ViewContract'
import OwnerAttendance from
  './pages/owner/Attendance'
import OwnerPayments from
  './pages/owner/Payments'
import OwnerTrips from 
  './pages/owner/Trips'
import InviteDriver from
  './pages/owner/InviteDriver'
import VehicleDetail from
  './pages/owner/VehicleDetail'
import DriverDetail from
  './pages/owner/DriverDetail'

// Driver Pages  
import DriverDashboard from 
  './pages/driver/Dashboard'
import DriverProfile from 
  './pages/driver/Profile'
import JobSearch from 
  './pages/driver/JobSearch'
import JobDetail from 
  './pages/driver/JobDetail'
import DriverApplications from
  './pages/driver/MyApplications'
import DriverMessages from
  './pages/driver/Messages'
import ActiveJob from
  './pages/driver/ActiveJob'
import DriverAttendance from
  './pages/driver/Attendance'
import DriverPayments from
  './pages/driver/Payments'
import DriverTrips from 
  './pages/driver/Trips'
import DriverInvites from
  './pages/driver/Invites'

// Admin Pages
import AdminLogin from './pages/admin/Login'
import AdminDashboard from 
  './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminComplaints from './pages/admin/Complaints'
import AdminSubscriptions from './pages/admin/Subscriptions'
import OwnerComplaints from './pages/owner/Complaints'
import DriverComplaints from './pages/driver/Complaints'
import OwnerRatings from './pages/owner/Ratings'
import DriverRatings from './pages/driver/Ratings'
import OwnerMyDrivers from './pages/owner/MyDrivers'
import Subscription from './pages/Subscription'

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
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
              <OwnerLayout />
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
              <DriverLayout />
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

        {/* Catch all */}
        <Route path="*" 
          element={<Navigate to="/" replace />} 
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
