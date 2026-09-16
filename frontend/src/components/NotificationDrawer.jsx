import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext.jsx';
import { 
  Bell, CheckCheck, X, FileText, Sparkles, Building2, UserPlus, 
  CheckCircle2, AlertTriangle, ShieldCheck, Clock, Check
} from 'lucide-react';

export default function NotificationDrawer({ isOpen, onClose, onNavigate }) {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'BILL' | 'APPROVAL' | 'DRAW_RESULT'

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/notifications');
      if (res.data.success) {
        setNotifications(res.data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Listen to new socket notifications
  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notif) => {
      setNotifications((prev) => [notif, ...prev]);
    };

    socket.on('notification_received', handleNotification);

    return () => {
      socket.off('notification_received', handleNotification);
    };
  }, [socket]);

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await axios.patch('/api/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true, isRead: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  // Mark single as read
  const handleMarkSingleRead = async (id) => {
    try {
      await axios.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, isRead: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.is_read && !n.isRead).length;

  const filteredNotifs = notifications.filter((n) => {
    if (filter === 'ALL') return true;
    return n.type === filter;
  });

  const getNotifIcon = (type) => {
    switch (type) {
      case 'BILL':
        return <FileText className="w-4 h-4 text-amber-400" />;
      case 'APPROVAL':
        return <Building2 className="w-4 h-4 text-purple-400" />;
      case 'DRAW_RESULT':
        return <Sparkles className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Backdrop Click */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-out Panel */}
      <div className="relative w-full max-w-md bg-obsidian-900 border-l border-amber-500/20 shadow-2xl flex flex-col h-full z-10 animate-slide-left text-slate-100 font-sans">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-obsidian-950/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-100">ศูนย์แจ้งเตือน</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-obsidian-950">
                    {unreadCount} ใหม่
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">ข้อความและการแจ้งเตือนในระบบ</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-obsidian-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs & Mark Read Action */}
        <div className="px-4 py-2.5 bg-obsidian-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs gap-2">
          <div className="flex items-center space-x-1 overflow-x-auto py-0.5">
            {[
              { id: 'ALL', label: 'ทั้งหมด' },
              { id: 'BILL', label: 'บิลหวย' },
              { id: 'APPROVAL', label: 'อนุมัติ' },
              { id: 'DRAW_RESULT', label: 'ผลหวย' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  filter === t.id
                    ? 'bg-amber-500 text-obsidian-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center space-x-1 text-[11px] text-amber-400 hover:text-amber-300 shrink-0 font-medium ml-auto"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>อ่านหมดแล้ว</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              กำลังโหลดการแจ้งเตือน...
            </div>
          ) : filteredNotifs.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 rounded-2xl bg-obsidian-800 mx-auto flex items-center justify-center text-slate-600 mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-300">ไม่มีการแจ้งเตือน</p>
              <p className="text-xs text-slate-500 mt-1">
                เมื่อมีบิลใหม่ ผลสลาก หรือคำขออนุมัติ จะแจ้งเตือนที่นี่ทันที
              </p>
            </div>
          ) : (
            filteredNotifs.map((n) => {
              const isUnread = !n.is_read && !n.isRead;
              return (
                <div
                  key={n.id}
                  onClick={() => isUnread && handleMarkSingleRead(n.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isUnread
                      ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50 shadow-sm'
                      : 'bg-obsidian-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-lg bg-obsidian-800 flex items-center justify-center shrink-0">
                        {getNotifIcon(n.type)}
                      </div>
                      <h4 className="text-xs font-bold text-slate-200 truncate max-w-[220px]">
                        {n.title}
                      </h4>
                    </div>

                    <div className="flex items-center space-x-1.5 shrink-0">
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(n.created_at || n.createdAt).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pl-8 whitespace-pre-line">
                    {n.message}
                  </p>

                  {/* Metadata link / action buttons if any */}
                  {n.meta_json && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 pl-8 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 text-[10px]">
                        {new Date(n.created_at || n.createdAt).toLocaleDateString('th-TH')}
                      </span>
                      {n.type === 'BILL' && onNavigate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            onNavigate('bills');
                          }}
                          className="text-amber-400 hover:underline font-semibold"
                        >
                          ดูสรุปบิล →
                        </button>
                      )}
                      {n.type === 'APPROVAL' && onNavigate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            const meta = typeof n.meta_json === 'string' ? JSON.parse(n.meta_json) : (n.meta_json || n.meta || {});
                            if (meta.action === 'MEMBER_JOIN_REQUEST') {
                              onNavigate('room');
                            } else {
                              onNavigate('admin');
                            }
                          }}
                          className="text-amber-400 hover:underline font-semibold"
                        >
                          ไปหน้าจัดการ →
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-obsidian-950/80 border-t border-slate-800 text-center text-[11px] text-slate-500">
          ระบบแจ้งเตือนแบบเรียลไทม์ Kee-Lek In-App Notification
        </div>

      </div>
    </div>
  );
}
