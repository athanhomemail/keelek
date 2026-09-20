import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { 
  Bell, CheckCheck, X, FileText, Sparkles, Building2, UserPlus, 
  CheckCircle2, AlertTriangle, ShieldCheck, Clock, Check, ChevronRight,
  ExternalLink, Hash, User, Phone, Receipt, Info, Copy
} from 'lucide-react';

export default function NotificationDrawer({ isOpen, onClose, onNavigate }) {
  const { user, role } = useAuth();
  const isAdmin = role === 'ADMIN';
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'BILL' | 'APPROVAL' | 'DRAW_RESULT'
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState('');
  const [actionErrorMessage, setActionErrorMessage] = useState('');

  useEffect(() => {
    setActionSuccessMessage('');
    setActionErrorMessage('');
  }, [selectedNotif]);

  // Handle member join request approval directly from drawer
  const handleApproveJoinRequest = async (memberId, roomId) => {
    setActionLoading(true);
    setActionErrorMessage('');
    try {
      const res = await axios.post('/api/rooms/approve-member', { userId: memberId, roomId });
      if (res.data.success) {
        setActionSuccessMessage('🎉 อนุมัติสมาชิกเรียบร้อยแล้ว!');
        setNotifications((prev) =>
          prev.map((n) => {
            const m = parseMeta(n);
            if (m.action === 'MEMBER_JOIN_REQUEST' && String(m.memberId) === String(memberId)) {
              return { ...n, isHandled: 'APPROVED', is_read: true, isRead: true };
            }
            return n;
          })
        );
        if (selectedNotif) {
          setSelectedNotif((prev) => ({
            ...prev,
            isHandled: 'APPROVED',
            is_read: true,
            isRead: true
          }));
        }
      }
    } catch (err) {
      setActionErrorMessage(err.response?.data?.message || 'ไม่สามารถอนุมัติได้');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle member join request rejection directly from drawer
  const handleRejectJoinRequest = async (memberId, roomId) => {
    setActionLoading(true);
    setActionErrorMessage('');
    try {
      const res = await axios.post('/api/rooms/reject-member', { userId: memberId, roomId });
      if (res.data.success) {
        setActionSuccessMessage('🚫 ปฏิเสธคำขอเข้าร่วมห้องแล้ว');
        setNotifications((prev) =>
          prev.map((n) => {
            const m = parseMeta(n);
            if (m.action === 'MEMBER_JOIN_REQUEST' && String(m.memberId) === String(memberId)) {
              return { ...n, isHandled: 'REJECTED', is_read: true, isRead: true };
            }
            return n;
          })
        );
        if (selectedNotif) {
          setSelectedNotif((prev) => ({
            ...prev,
            isHandled: 'REJECTED',
            is_read: true,
            isRead: true
          }));
        }
      }
    } catch (err) {
      setActionErrorMessage(err.response?.data?.message || 'ไม่สามารถปฏิเสธได้');
    } finally {
      setActionLoading(false);
    }
  };

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
    } else {
      setSelectedNotif(null);
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

  const handleSelectNotif = (notif) => {
    const isUnread = !notif.is_read && !notif.isRead;
    if (isUnread) {
      handleMarkSingleRead(notif.id);
      setSelectedNotif({ ...notif, is_read: true, isRead: true });
    } else {
      setSelectedNotif(notif);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const parseMeta = (notif) => {
    if (!notif) return {};
    if (typeof notif.meta_json === 'object' && notif.meta_json !== null) return notif.meta_json;
    if (typeof notif.meta === 'object' && notif.meta !== null) return notif.meta;
    if (typeof notif.meta_json === 'string') {
      try {
        return JSON.parse(notif.meta_json);
      } catch (e) {
        return {};
      }
    }
    return {};
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.is_read && !n.isRead).length;

  const filteredNotifs = notifications.filter((n) => {
    if (filter === 'ALL') return true;
    return n.type === filter;
  });

  const getNotifIcon = (type, size = 'normal') => {
    const iconClass = size === 'large' ? 'w-6 h-6' : 'w-4 h-4';
    switch (type) {
      case 'BILL':
        return <FileText className={`${iconClass} text-amber-400`} />;
      case 'APPROVAL':
        return <Building2 className={`${iconClass} text-purple-400`} />;
      case 'DRAW_RESULT':
        return <Sparkles className={`${iconClass} text-emerald-400`} />;
      default:
        return <Bell className={`${iconClass} text-blue-400`} />;
    }
  };

  const getNotifBadge = (type) => {
    switch (type) {
      case 'BILL':
        return { label: 'บิลหวย', bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'APPROVAL':
        return { label: 'คำขอ / อนุมัติ', bg: 'bg-purple-500/15 text-purple-400 border-purple-500/30' };
      case 'DRAW_RESULT':
        return { label: 'ผลรางวัล', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      default:
        return { label: 'ระบบ', bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
    }
  };

  return (
    <>
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
                const meta = parseMeta(n);

                return (
                  <div
                    key={n.id}
                    onClick={() => handleSelectNotif(n)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer group hover:scale-[1.01] ${
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

                    <p className="text-xs text-slate-300 leading-relaxed pl-8 line-clamp-2">
                      {n.message}
                    </p>

                    {/* Card Footer: Metadata info & Action buttons */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800/60 pl-8 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 text-[10px]">
                        {new Date(n.created_at || n.createdAt).toLocaleDateString('th-TH')}
                      </span>

                      <div className="flex items-center space-x-2.5">
                        {/* Approval Actions: Member Join Request for Leader, Room Request for Admin */}
                        {n.type === 'APPROVAL' && (
                          meta.action === 'MEMBER_JOIN_REQUEST' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectNotif(n);
                              }}
                              className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 text-[11px] bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors shadow-sm"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{n.isHandled === 'APPROVED' ? 'อนุมัติแล้ว' : 'พิจารณาอนุมัติ'}</span>
                            </button>
                          ) : isAdmin && onNavigate ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onClose();
                                onNavigate('admin');
                              }}
                              className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-0.5 text-[11px]"
                            >
                              <span>ไปหน้าจัดการ</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          ) : null
                        )}

                        {/* Bill quick link for users with room access */}
                        {n.type === 'BILL' && onNavigate && (user?.room_id || isAdmin) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                              onNavigate('bills');
                            }}
                            className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-0.5 text-[11px]"
                          >
                            <span>ดูสรุปบิล</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}

                        {/* Detail Modal trigger text */}
                        <span className="text-slate-400 group-hover:text-amber-400 text-[11px] font-medium flex items-center gap-0.5 transition-colors">
                          <span>ดูรายละเอียด</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
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

      {/* Detail Popup Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={() => setSelectedNotif(null)} />

          {/* Modal Card */}
          <div className="relative w-full max-w-lg bg-obsidian-900 border border-amber-500/25 rounded-3xl p-6 shadow-2xl overflow-hidden z-10 text-slate-100 font-sans max-h-[90vh] flex flex-col animate-scale-up">
            
            {/* Background ambient glow */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-2xl bg-obsidian-800 border border-slate-700/80 flex items-center justify-center shrink-0 shadow-inner">
                  {getNotifIcon(selectedNotif.type, 'large')}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getNotifBadge(selectedNotif.type).bg}`}>
                      {getNotifBadge(selectedNotif.type).label}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(selectedNotif.created_at || selectedNotif.createdAt).toLocaleDateString('th-TH', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })} {new Date(selectedNotif.created_at || selectedNotif.createdAt).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })} น.
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-100 mt-1 leading-snug">
                    {selectedNotif.title}
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setSelectedNotif(null)}
                className="p-1.5 rounded-xl hover:bg-obsidian-800 text-slate-400 hover:text-white transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {/* Message text */}
              <div className="p-4 rounded-2xl bg-obsidian-950/70 border border-slate-800/80 text-slate-200 text-sm leading-relaxed whitespace-pre-line shadow-inner">
                {selectedNotif.message}
              </div>

              {/* Structured Metadata Details */}
              {(() => {
                const meta = parseMeta(selectedNotif);
                if (!meta || Object.keys(meta).length === 0) return null;

                // 0. MEMBER_JOIN_REQUEST (Leader / Admin approval view)
                if (meta.action === 'MEMBER_JOIN_REQUEST' || (selectedNotif.type === 'APPROVAL' && meta.memberId)) {
                  return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/30 via-obsidian-950 to-amber-950/20 border border-purple-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <UserPlus className="w-4 h-4 text-purple-400" />
                          <span>คำขอเข้าร่วมเป็นลูกทีมในห้อง</span>
                        </div>
                        {selectedNotif.isHandled === 'APPROVED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                            <Check className="w-3 h-3" /> อนุมัติแล้ว
                          </span>
                        ) : selectedNotif.isHandled === 'REJECTED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                            ปฏิเสธแล้ว
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            รออนุมัติ
                          </span>
                        )}
                      </div>

                      {/* Member Profile info card */}
                      <div className="flex items-center gap-3 p-3 bg-obsidian-900/90 rounded-2xl border border-slate-800">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 p-[2px] shrink-0">
                          {meta.memberProfilePic ? (
                            <img
                              src={meta.memberProfilePic}
                              alt={meta.memberName}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full rounded-full bg-obsidian-950 flex items-center justify-center text-amber-400 font-bold text-base">
                              {meta.memberName ? meta.memberName.charAt(0).toUpperCase() : 'U'}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-100 truncate">
                            {meta.memberName || 'สมาชิก'}
                            {meta.memberNickname ? ` (${meta.memberNickname})` : ''}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            {meta.memberUsername && <span>@{meta.memberUsername}</span>}
                            {meta.memberPhone && (
                              <span className="flex items-center gap-0.5 font-mono">
                                <Phone className="w-3 h-3 text-slate-500" /> {meta.memberPhone}
                              </span>
                            )}
                          </div>
                          {meta.roomName && (
                            <div className="text-[11px] text-amber-400 mt-1 font-medium">
                              ขอเข้าห้อง: {meta.roomName}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action alerts */}
                      {actionSuccessMessage && (
                        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                          <span>{actionSuccessMessage}</span>
                        </div>
                      )}
                      {actionErrorMessage && (
                        <div className="p-3 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                          <span>{actionErrorMessage}</span>
                        </div>
                      )}
                    </div>
                  );
                }

                // 1. DRAW_RESULT (ผลสลากหวย)
                if (selectedNotif.type === 'DRAW_RESULT' || meta.result3top || meta.result2top) {
                  return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/30 to-obsidian-950 border border-emerald-500/30">
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-3">
                        <Sparkles className="w-4 h-4" />
                        <span>ผลการออกรางวัล {meta.periodName ? `งวด ${meta.periodName}` : ''}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2.5 rounded-xl bg-obsidian-900/80 border border-amber-500/30">
                          <div className="text-[11px] text-slate-400 font-medium">3 ตัวบน</div>
                          <div className="text-xl font-black text-amber-400 font-mono tracking-wider mt-0.5">
                            {meta.result3top || '-'}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-700/60">
                          <div className="text-[11px] text-slate-400 font-medium">2 ตัวบน</div>
                          <div className="text-lg font-bold text-slate-100 font-mono tracking-wider mt-0.5">
                            {meta.result2top || '-'}
                          </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-700/60">
                          <div className="text-[11px] text-slate-400 font-medium">2 ตัวล่าง</div>
                          <div className="text-lg font-bold text-slate-100 font-mono tracking-wider mt-0.5">
                            {meta.result2bottom || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // 2. BILL (บิลหวย)
                if (selectedNotif.type === 'BILL' || meta.billNo) {
                  return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/20 to-obsidian-950 border border-amber-500/30 space-y-2.5">
                      <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-2">
                        <Receipt className="w-4 h-4" />
                        <span>ข้อมูลบิลหวย</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {meta.billNo && (
                          <div className="p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-800">
                            <span className="text-slate-400 text-[11px]">เลขที่บิล:</span>
                            <p className="font-mono font-bold text-slate-200 mt-0.5">{meta.billNo}</p>
                          </div>
                        )}
                        {Boolean(meta.customerName && meta.customerName !== '-') && (
                          <div className="p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-800">
                            <span className="text-slate-400 text-[11px]">ลูกค้า:</span>
                            <p className="font-bold text-slate-200 mt-0.5">{meta.customerName}</p>
                          </div>
                        )}
                        {Boolean(meta.note) && (
                          <div className="p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-800">
                            <span className="text-slate-400 text-[11px]">หมายเหตุ:</span>
                            <p className="font-medium text-amber-300 mt-0.5">{meta.note}</p>
                          </div>
                        )}
                        {meta.memberName && (
                          <div className="p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-800">
                            <span className="text-slate-400 text-[11px]">ผู้บันทึก:</span>
                            <p className="font-medium text-slate-200 mt-0.5">{meta.memberName}</p>
                          </div>
                        )}
                        {meta.roomName && (
                          <div className="p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-800">
                            <span className="text-slate-400 text-[11px]">ห้อง:</span>
                            <p className="font-medium text-slate-200 mt-0.5">{meta.roomName}</p>
                          </div>
                        )}
                      </div>
                      {meta.totalAmount !== undefined && (
                        <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-medium">ยอดเงินรวม:</span>
                          <span className="text-base font-extrabold text-amber-400 font-mono">
                            {Number(meta.totalAmount).toLocaleString()} ฿
                          </span>
                        </div>
                      )}
                    </div>
                  );
                }

                // 3. ROOM_APPROVED
                if (meta.action === 'ROOM_APPROVED' || meta.roomCode) {
                  return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/20 to-obsidian-950 border border-emerald-500/30 space-y-2.5">
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ข้อมูลห้องของคุณ</span>
                      </div>
                      <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-800">
                        <div>
                          <span className="text-slate-400 text-[11px]">ชื่อห้อง:</span>
                          <p className="font-bold text-slate-200">{meta.roomName || '-'}</p>
                        </div>
                        {meta.roomCode && (
                          <button
                            onClick={() => handleCopy(meta.roomCode)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors text-xs font-bold"
                          >
                            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedCode ? 'คัดลอกแล้ว' : `รหัส: ${meta.roomCode}`}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                // 4. ROOM_REQUEST (Admin view)
                if (meta.action === 'ROOM_REQUEST') {
                  return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-950/20 to-obsidian-950 border border-purple-500/30 space-y-2">
                      <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5 mb-1">
                        <Building2 className="w-4 h-4" />
                        <span>รายละเอียดคำขอเปิดห้อง</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-800">
                          <span className="text-slate-400 text-[11px]">ผู้ขอสร้าง:</span>
                          <p className="font-semibold text-slate-200 mt-0.5">{meta.applicantName || '-'} ({meta.applicantUsername || ''})</p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-800">
                          <span className="text-slate-400 text-[11px]">ห้องที่ต้องการ:</span>
                          <p className="font-semibold text-slate-200 mt-0.5">{meta.roomName || '-'}</p>
                        </div>
                        {meta.phone && (
                          <div className="p-2.5 rounded-xl bg-obsidian-900/80 border border-slate-800 col-span-2">
                            <span className="text-slate-400 text-[11px]">เบอร์โทรติดต่อ:</span>
                            <p className="font-medium text-slate-200 mt-0.5">{meta.phone}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Fallback: If other custom meta fields exist
                const displayableKeys = Object.keys(meta).filter(k => !['action', 'memberProfilePic'].includes(k));
                if (displayableKeys.length > 0) {
                  return (
                    <div className="p-3.5 rounded-2xl bg-obsidian-950/60 border border-slate-800/80 text-xs space-y-1.5">
                      <div className="text-slate-400 font-semibold mb-1">ข้อมูลเพิ่มเติม:</div>
                      <div className="grid grid-cols-2 gap-2">
                        {displayableKeys.map(k => (
                          <div key={k} className="p-2.5 rounded-xl bg-obsidian-900/60 border border-slate-800">
                            <span className="text-slate-500 text-[10px] capitalize">{k}:</span>
                            <p className="font-medium text-slate-200 truncate">{String(meta[k])}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            {/* Modal Footer / Actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                className="py-2.5 px-4 bg-obsidian-800 hover:bg-obsidian-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700/60 transition-colors"
              >
                ปิด
              </button>

              {/* Actions for Member Join Request (Leader & Admin) */}
              {(() => {
                const meta = parseMeta(selectedNotif);
                if (meta.action === 'MEMBER_JOIN_REQUEST' && meta.memberId) {
                  return (
                    <div className="flex-1 flex items-center justify-end gap-2">
                      {selectedNotif.isHandled !== 'APPROVED' && selectedNotif.isHandled !== 'REJECTED' && (
                        <>
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleRejectJoinRequest(meta.memberId, meta.roomId)}
                            className="py-2.5 px-3.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5 text-rose-400" />
                            <span>ปฏิเสธ</span>
                          </button>

                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleApproveJoinRequest(meta.memberId, meta.roomId)}
                            className="py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-obsidian-950 rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>{actionLoading ? 'กำลังอนุมัติ...' : 'อนุมัติเข้าร่วมห้อง'}</span>
                          </button>
                        </>
                      )}

                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedNotif(null);
                            onClose();
                            onNavigate('room');
                          }}
                          className="py-2.5 px-3.5 bg-obsidian-800 hover:bg-obsidian-700 text-amber-400 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1"
                        >
                          <span>ไปหน้าห้อง</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                }

                // Action for Admin Room Request
                if (isAdmin && meta.action === 'ROOM_REQUEST' && onNavigate) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNotif(null);
                        onClose();
                        onNavigate('admin');
                      }}
                      className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-obsidian-950 rounded-xl text-xs font-bold shadow-lg shadow-amber-500/20 transition-all transform active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <span>ไปหน้าจัดการ (หลังบ้าน)</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  );
                }

                // Bill summary navigation for users with room access
                if (selectedNotif.type === 'BILL' && onNavigate && (user?.room_id || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNotif(null);
                      onClose();
                      onNavigate('bills');
                    }}
                    className="flex-1 py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>ดูสรุปบิล</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )) {
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNotif(null);
                        onClose();
                        onNavigate('bills');
                      }}
                      className="flex-1 py-2.5 px-4 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>ดูสรุปบิล</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  );
                }

                return null;
              })()}
            </div>

          </div>
        </div>
      )}
    </>
  );
}

