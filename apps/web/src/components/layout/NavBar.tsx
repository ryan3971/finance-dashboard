import { Link, useNavigate } from '@tanstack/react-router';
import api from '@/lib/api';
import { useAuth } from '@/features/auth/useAuth';

const NAV_LINKS = [
  { to: '/' as const, label: 'Transactions' },
  { to: '/accounts' as const, label: 'Accounts' },
  { to: '/import' as const, label: 'Import' },
  { to: '/config' as const, label: 'Config' },
];

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // swallow — clear local state regardless
    }
    logout();
    void navigate({ to: '/login', replace: true });
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
              className="px-3 py-1.5 rounded text-sm transition-colors text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              activeProps={{
                className:
                  'px-3 py-1.5 rounded text-sm transition-colors bg-gray-100 text-gray-900 font-medium',
              }}
              activeOptions={link.to === '/' ? { exact: true } : undefined}
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
