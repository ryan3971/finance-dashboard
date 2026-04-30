import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import axios from 'axios';
import api from '@/lib/api';
import { useAuth } from '@/features/auth/useAuth';
import { useAccounts } from '@/hooks/useAccounts';
import { useSeedLoad } from '@/features/seed/hooks/useSeedLoad';
import { toast } from 'sonner';
import { TOAST } from '@/lib/toastMessages';

const DASHBOARD_LINKS = [
  { to: '/dashboard/snapshot' as const, label: 'Snapshot' },
  { to: '/dashboard/income' as const, label: 'Income' },
  { to: '/dashboard/expenses' as const, label: 'Expenses' },
  { to: '/dashboard/ytd' as const, label: 'YTD' },
];

const MAIN_LINKS = [
  { to: '/' as const, label: 'Transactions' },
  { to: '/accounts' as const, label: 'Accounts' },
  { to: '/anticipated-budget' as const, label: 'Budget' },
  { to: '/import' as const, label: 'Import' },
  { to: '/config' as const, label: 'Config' },
];

const LINK_BASE =
  'inline-flex items-center px-3 text-sm transition-colors text-content-secondary hover:text-content-primary hover:bg-surface-subtle';
const LINK_ACTIVE =
  'inline-flex items-center px-3 text-sm font-medium text-content-primary border-b-2 border-content-primary';

export function NavBar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: accounts } = useAccounts();
  const seedLoad = useSeedLoad();

  const hasNoAccounts = accounts !== undefined && accounts.length === 0;

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

  function handleSeedLoad() {
    seedLoad.mutate(undefined, {
      onSuccess: () => {
        toast.success(TOAST.SAMPLE_DATA_LOADED);
        void navigate({ to: '/dashboard/snapshot' });
      },
      onError: (err) => {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          toast.error(TOAST.SAMPLE_DATA_CONFLICT);
        } else {
          toast.error(TOAST.SAMPLE_DATA_FAILED);
        }
      },
    });
  }

  return (
    <>
      <nav className="bg-surface border-b border-border-base px-4 sm:px-6 flex items-stretch justify-between h-14">
        <div className="flex items-stretch">
          {/* Brand */}
          <span className="flex items-center pr-4 sm:pr-6 mr-4 sm:mr-2 border-r border-border-base text-base font-semibold text-content-primary whitespace-nowrap">
            Finance Dashboard
          </span>

          {/* Desktop nav — hidden below sm */}
          <div className="hidden sm:flex items-stretch">
            {DASHBOARD_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={LINK_BASE}
                activeProps={{ className: LINK_ACTIVE }}
              >
                {link.label}
              </Link>
            ))}

            {/* Group separator */}
            <div className="flex items-center px-2">
              <div className="w-px h-5 bg-border-base" />
            </div>

            {MAIN_LINKS.map((link) => (
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
            className="sm:hidden p-1.5 rounded text-content-secondary hover:text-content-primary hover:bg-surface-subtle transition-colors"
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

          {/* Load sample data — shown only when user has no accounts */}
          {hasNoAccounts && (
            <button
              onClick={handleSeedLoad}
              disabled={seedLoad.isPending}
              className="hidden sm:block text-sm text-content-secondary hover:text-content-primary transition-colors disabled:opacity-50"
            >
              {seedLoad.isPending ? 'Loading…' : 'Load sample data'}
            </button>
          )}

          {/* Desktop user info — hidden below sm */}
          <span className="hidden sm:block text-sm text-content-muted">
            {user?.email}
          </span>
          <div className="hidden sm:block w-px h-4 bg-border-base" />
          <button
            onClick={() => {
              void handleLogout();
            }}
            className="hidden sm:block text-sm text-content-secondary hover:text-content-primary transition-colors"
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
          <div className="fixed right-0 top-0 bottom-0 w-64 bg-surface shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-border-base flex-shrink-0">
              <span className="font-semibold text-content-primary text-base">
                Finance Dashboard
              </span>
              <button
                className="p-1.5 rounded text-content-secondary hover:text-content-primary hover:bg-surface-subtle transition-colors"
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
              <p className="px-3 pt-1 pb-1.5 text-xs font-semibold text-content-muted uppercase tracking-wider">
                Dashboard
              </p>
              {DASHBOARD_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block px-3 py-2.5 rounded text-sm text-content-secondary hover:text-content-primary hover:bg-surface-subtle transition-colors"
                  activeProps={{
                    className:
                      'block px-3 py-2.5 rounded text-sm bg-surface-muted text-content-primary font-medium',
                  }}
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

              <div className="my-2 border-t border-border-base" />

              {MAIN_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block px-3 py-2.5 rounded text-sm text-content-secondary hover:text-content-primary hover:bg-surface-subtle transition-colors"
                  activeProps={{
                    className:
                      'block px-3 py-2.5 rounded text-sm bg-surface-muted text-content-primary font-medium',
                  }}
                  activeOptions={link.to === '/' ? { exact: true } : undefined}
                  onClick={() => setDrawerOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="flex-shrink-0 px-4 py-4 border-t border-border-base space-y-2">
              {hasNoAccounts && (
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    handleSeedLoad();
                  }}
                  disabled={seedLoad.isPending}
                  className="w-full text-left text-sm text-content-secondary hover:text-content-primary transition-colors disabled:opacity-50"
                >
                  {seedLoad.isPending ? 'Loading…' : 'Load sample data'}
                </button>
              )}
              <p className="text-xs text-content-muted truncate">{user?.email}</p>
              <button
                onClick={() => {
                  void handleLogout();
                }}
                className="w-full text-left text-sm text-content-secondary hover:text-content-primary transition-colors"
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
