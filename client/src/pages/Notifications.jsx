import { useEffect, useState } from 'react';
import { getNotifications, markNotificationRead } from '../api/notificationApi.js';
import EmptyState from '../components/common/EmptyState.jsx';
import Loader from '../components/common/Loader.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import { formatDateTime } from '../utils/formatDate.js';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotifications()
      .then(response => setNotifications(response.data.data))
      .finally(() => setLoading(false));
  }, []);

  const markRead = async (id) => {
    await markNotificationRead(id);
    setNotifications(current =>
      current.map(notification =>
        notification._id === id ? { ...notification, isRead: true } : notification,
      ),
    );
  };

  if (loading) return <Loader />;

  return (
    <div className="page-container max-w-3xl">
      <PageHeader title="Notifications" subtitle="Trip and planning updates" />
      {notifications.length === 0 ? (
        <EmptyState title="No notifications" message="New trip and AI-plan updates will appear here." />
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => (
            <button
              key={notification._id}
              type="button"
              onClick={() => !notification.isRead && markRead(notification._id)}
              className={`card w-full text-left ${
                notification.isRead ? 'opacity-70' : 'border-blue-200 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">{notification.title}</div>
                  <div className="mt-1 text-sm text-slate-600">{notification.message}</div>
                </div>
                {!notification.isRead && <span className="mt-1 h-2 w-2 rounded-full bg-blue-600" />}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                {formatDateTime(notification.createdAt)}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
