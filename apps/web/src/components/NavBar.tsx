import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

const NAV_LINKS = [
  { to: '/', label: 'Transactions' },
  { to: '/import', label: 'Import' },
];

export function NavBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // swallow — clear local state regardless
    }
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-0 flex items-center justify-between h-14">
      <div className="flex items-center gap-6">
        <span className="font-semibold text-gray-900 text-sm">
          Finance Dashboard
        </span>
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                location.pathname === link.to
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">{user?.email}</span>
        <button
          onClick={() => {
            void handleLogout();
          }}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
