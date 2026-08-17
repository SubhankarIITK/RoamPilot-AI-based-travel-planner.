import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getChatHistory } from '../api/aiApi.js';
import ChatBox from '../components/ai/ChatBox.jsx';
import Loader from '../components/common/Loader.jsx';

export default function TripChat() {
  const { id } = useParams();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getChatHistory(id).then(res => {
      setHistory(res.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleNewMessage = (msg) => {
    setHistory(prev => [...prev, msg]);
  };

  if (loading) return <Loader />;

  return (
    <div className="flex h-[calc(100dvh-65px)] flex-col lg:h-screen">
      <div className="flex min-h-16 items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80 sm:px-6">
        <Link
          to={`/trips/${id}`}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-blue-700"
        >
          <span aria-hidden="true">←</span> Workspace
        </Link>
        <span className="h-5 w-px bg-slate-200" />
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-50 text-blue-600">✦</span>
          <div>
            <span className="block text-sm font-bold text-slate-900">Trip AI Chat</span>
            <span className="block text-[11px] text-emerald-600">Groq chat with live web research</span>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatBox tripId={id} history={history} onNewMessage={handleNewMessage} />
      </div>
    </div>
  );
}
