import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/features/auth/useAuth';

const NAV_LINKS = [
  { to: '/' as const, label: 'Transactions' },
  { to: '/accounts' as const, label: 'Accounts' },
  { to: '/import' as const, label: 'Import' },
  { to: '/anticipated-budget' as const, label: 'Budget' },
  { to: '/dashboard/snapshot' as const, label: 'Snapshot' },
  { to: '/dashboard/income' as const, label: 'Income' },
  { to: '/dashboard/expenses' as const, label: 'Expenses' },
  { to: '/dashboard/ytd' as const, label: 'YTD' },
  { to: '/config' as const, label: 'Config' },
];

const LINK_BASE =
  'px-3 py-1.5 rounded text-sm transition-colors text-gray-500 hover:text-gray-900 hover:bg-gray-50';
const LINK_ACTIVE =
  'px-3 py-1.5 rounded text-sm transition-colors bg-gray-100 text-gray-900 font-medium';

export function NavBar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Navigate after render so RouterWrapper has synced the cleared auth state into
  // the router context. Calling navigate() synchronously after logout() would race
  // against that update and leave the user on the current (now-protected) route.
  useEffect(() => {
    if (!isAuthenticated) {
      void navigate({ to: '/login', replace: true });
    }
  }, [isAuthenticated, navigate]);

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // swallow — clear local state regardless
    }
    logout();
  }

  return (
    <>
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-0 flex items-center justify-between h-14">
        <div className="flex items-center gap-4 sm:gap-6">
          <span className="font-semibold text-gray-900 text-sm">
            Finance Dashboard
          </span>
          {/* Desktop nav — hidden below sm */}
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={LINK_BASE}
                activeProps={{ className: LINK_ACTIVE }}
                activeOptions={link.to === '/' ? { exact: true } : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile hamburger — hidden at sm+ */}
          <button
            className="sm:hidden p-1.5 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Desktop user info — hidden below sm */}
          <span className="hidden sm:block text-sm text-gray-400">
            {user?.email}
          </span>
          <button
            onClick={() => {
              void handleLogout();
            }}
            className="hidden sm:block text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Mobile drawer — only rendered below sm */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 flex-shrink-0">
              <span className="font-semibold text-gray-900 text-sm">
                Finance Dashboard
              </span>
              <button
                className="p-1.5 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block px-3 py-2.5 rounded text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  activeProps={{
                    className:
                      'block px-3 py-2.5 rounded text-sm bg-gray-100 text-gray-900 font-medium',
                  }}
                  activeOptions={link.to === '/' ? { exact: true } : undefined}
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex-shrink-0 px-4 py-4 border-t border-gray-200 space-y-2">
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              <button
                onClick={() => {
                  void handleLogout();
                }}
                className="w-full text-left text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
