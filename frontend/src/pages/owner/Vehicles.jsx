import { Navigate } from 'react-router-dom'

/**
 * Dedicated route for sidebar "Meri Gadiyaan".
 * Vehicles UI lives on Profile with ?tab=vehicles.
 */
export default function Vehicles() {
  return <Navigate to="/owner/profile?tab=vehicles" replace />
}
