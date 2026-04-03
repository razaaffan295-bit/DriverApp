import { Navigate } from 'react-router-dom'
import { getToken, getUser } from 
  '../../utils/helpers'

const ProtectedRoute = ({ children, role }) => {
  const token = getToken()
  const user = getUser()

  if (!token || !user) {
    if (role === 'admin') {
      return <Navigate to="/admin/login" replace />
    }
    return <Navigate to="/login" replace />
  }

  if (role && user.role !== role) {
    if (role === 'admin') {
      return <Navigate to="/admin/login" replace />
    }
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
