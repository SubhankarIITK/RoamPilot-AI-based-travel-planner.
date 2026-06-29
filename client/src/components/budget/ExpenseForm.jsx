import { useState } from 'react';
import { addExpense } from '../../api/expenseApi.js';

const categories = ['food', 'transport', 'stay', 'activities', 'shopping', 'emergency', 'other'];

export default function ExpenseForm({ tripId, currency = 'INR', onAdded }) {
  const emptyForm = { title: '', category: 'food', amount: '', paidBy: '', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.amount) return;
    setLoading(true);
    try {
      await addExpense({ ...form, tripId, currency, amount: Number(form.amount) });
      setForm(emptyForm);
      onAdded?.();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="text-base font-bold text-slate-900">Add Expense</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Title</label>
          <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
        </div>
        <div>
          <label className="label">Amount ({currency})</label>
          <input className="input" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Paid By</label>
          <input className="input" value={form.paidBy} onChange={e => setForm({ ...form, paidBy: e.target.value })} />
        </div>
      </div>
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Adding...' : 'Add Expense'}
      </button>
    </form>
  );
}
