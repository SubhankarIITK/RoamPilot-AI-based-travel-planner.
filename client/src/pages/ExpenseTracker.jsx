import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTripExpenses, getExpenseSummary, deleteExpense } from '../api/expenseApi.js';
import { getTripById } from '../api/tripApi.js';
import ExpenseForm from '../components/budget/ExpenseForm.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import Loader from '../components/common/Loader.jsx';
import { formatCurrency } from '../utils/formatCurrency.js';
import { formatDate } from '../utils/formatDate.js';

export default function ExpenseTracker() {
  const { id } = useParams();
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [expRes, sumRes, tripRes] = await Promise.all([
      getTripExpenses(id),
      getExpenseSummary(id),
      getTripById(id),
    ]);
    setExpenses(expRes.data.data);
    setSummary(sumRes.data.data);
    setTrip(tripRes.data.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleDelete = async (eid) => {
    await deleteExpense(eid);
    fetchData();
  };

  if (loading) return <Loader />;

  return (
    <div className="page-container">
      <Link to={`/trips/${id}`} className="text-sm text-blue-600 hover:underline mb-4 block">← Workspace</Link>
      <PageHeader title="Expense Tracker" subtitle="Track your actual spending vs planned budget" />

      {summary && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">Summary</h3>
            <div className="text-right">
              {Object.entries(summary.totalsByCurrency || {}).map(([currency, total]) => (
                <div key={currency} className="text-lg font-bold text-slate-800">
                  {formatCurrency(total, currency)}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {Object.entries(summary.byCategory || {}).map(([cat, amounts]) => (
              <div key={cat} className="bg-slate-50 rounded-lg p-2 text-center">
                {Object.entries(amounts).map(([currency, amount]) => (
                  <div key={currency} className="text-sm font-bold text-slate-700">
                    {formatCurrency(amount, currency)}
                  </div>
                ))}
                <div className="text-xs text-slate-500 capitalize">{cat}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ExpenseForm tripId={id} currency={trip?.currency} onAdded={fetchData} />

      <div className="mt-6 space-y-2">
        {expenses.map(exp => (
          <div key={exp._id} className="card flex items-center justify-between">
            <div>
              <div className="font-medium text-slate-800 text-sm">{exp.title}</div>
              <div className="text-xs text-slate-500">{exp.category} · {formatDate(exp.date)} {exp.paidBy && `· Paid by ${exp.paidBy}`}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-800">{formatCurrency(exp.amount, exp.currency)}</span>
              <button onClick={() => handleDelete(exp._id)} className="text-xs text-red-500 hover:text-red-700">×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
