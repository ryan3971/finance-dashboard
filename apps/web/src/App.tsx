import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api/v1';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  currency: string;
  categoryName: string | null;
  accountName: string;
  flaggedForReview: boolean;
}

interface TransactionsResponse {
  data: Transaction[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const accessToken: string = import.meta.env.VITE_ACCESS_TOKEN ?? '';

function TransactionList() {
  const { data, isLoading, isError } = useQuery<TransactionsResponse>({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await axios.get<TransactionsResponse>(`${API_BASE}/transactions`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      return res.data;
    },
  });

  if (isLoading) return <p className="text-gray-500 text-center mt-8">Loading transactions...</p>;
  if (isError) return <p className="text-red-500 text-center mt-8">Failed to load transactions. Make sure the API is running and you are logged in.</p>;
  if (!data || data.data.length === 0) return <p className="text-gray-400 text-center mt-8">No transactions yet. Import a CSV to get started.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200 rounded-lg text-sm">
        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
          <tr>
            <th className="px-4 py-3 text-left">Date</th>
            <th className="px-4 py-3 text-left">Description</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3 text-left">Category</th>
            <th className="px-4 py-3 text-left">Account</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.data.map(tx => (
            <tr key={tx.id} className={tx.flaggedForReview ? 'bg-yellow-50' : ''}>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{tx.date}</td>
              <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{tx.description}</td>
              <td className={`px-4 py-3 text-right font-mono whitespace-nowrap ${Number(tx.amount) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {Number(tx.amount) < 0 ? '-' : '+'}
                {Math.abs(Number(tx.amount)).toFixed(2)} {tx.currency}
              </td>
              <td className="px-4 py-3 text-gray-500">{tx.categoryName ?? '—'}</td>
              <td className="px-4 py-3 text-gray-500">{tx.accountName}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-400 text-right">
        Showing {data.data.length} of {data.pagination.total} transactions
      </p>
    </div>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-semibold text-gray-900 mb-1">Finance Dashboard</h1>
        <p className="text-gray-500 mb-6">Phase 1B — Import &amp; Transactions</p>
        <TransactionList />
      </div>
    </div>
  );
}

export default App;
