import { Link } from 'react-router-dom'
import { HiOutlineArrowLeft } from 'react-icons/hi2'
import './NotFound.css'

/**
 * NotFound (404) Component
 * Friendly error page when a route doesn't exist
 */
export default function NotFound() {
  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <div className="not-found-code">404</div>
        <h1>Page Not Found</h1>
        <p>Sorry, the page you're looking for doesn't exist or has been moved.</p>
        
        <Link to="/app/admin/overview" className="not-found-link">
          <HiOutlineArrowLeft />
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
