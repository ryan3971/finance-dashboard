import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTransactions } from '../hooks/useTransactions';
import api from '../lib/api';

function formatAmount(amount: string): string {
  const num = parseFloat(amount);
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(Math.abs(num));
}

function AmountCell({ amount }: { amount: string }) {
  const num = parseFloat(amount);
  const color = num > 0 ? 'text-green-600' : 'text-red-600';
  const prefix = num > 0 ? '+' : '-';
  return (
    <span className={`font-mono text-sm font-medium ${color}`}>
      {prefix}{formatAmount(amount)}
    </span>
  );
}

export function TransactionsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useTransactions({ page });

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Swallow — clear local state regardless
    }
    logout();
    navigate('/login', { replace: true });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">Failed to load transactions.</p>
      </div>
    );
  }

  const transactions = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Finance Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          Sign out
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {pagination?.total ?? 0} transactions
          </p>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">No transactions yet.</p>
            <p className="text-sm mt-1">Import a CSV file to get started.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((tx) => (
                    <tr
                      key={tx.id}
                      className={`hover:bg-gray-50 ${tx.flaggedForReview ? 'bg-yellow-50' : ''}`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{tx.date}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-gray-900 truncate max-w-xs">
                          {tx.sourceName ?? tx.description}
                        </p>
                        {tx.flaggedForReview && (
                          <span className="text-xs text-yellow-600">⚠ Needs review</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {tx.categoryName ?? '—'}
                        {tx.needWant && tx.needWant !== 'NA' && (
                          <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                            tx.needWant === 'Need'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                          }`}>
                            {tx.needWant}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{tx.accountName}</td>
                      <td className="px-4 py-3 text-right">
                        <AmountCell amount={tx.amount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span>Page {pagination.page} of {pagination.totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                  className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}