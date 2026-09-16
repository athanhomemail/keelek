import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import confetti from 'canvas-confetti';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [lineNotifications, setLineNotifications] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);
  const [quotaUpdates, setQuotaUpdates] = useState(null);
  const [rulesUpdates, setRulesUpdates] = useState(null);

  useEffect(() => {
    // In local dev, connect to port 3000
    const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '/';
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('🔌 Connected to Socket.io server:', newSocket.id);
    });

    // Listen for in-app notification events
    const handleNotification = (event) => {
      console.log('📢 Received In-App Notification:', event);
      setLineNotifications((prev) => [event, ...prev].slice(0, 50));
      
      // Show floating toast
      setToastMessage({
        title: event.title || 'ข้อความแจ้งเตือนใหม่',
        message: event.message || '',
        type: event.type || 'SYSTEM'
      });
      setTimeout(() => setToastMessage(null), 6000);
    };

    newSocket.on('notification_received', handleNotification);
    newSocket.on('simulated_line_event', handleNotification);

    // Listen for Realtime Quota Updates
    newSocket.on('quota_updated', (data) => {
      console.log('📊 Realtime Quota Updated:', data);
      setQuotaUpdates(data);
    });

    // Listen for Number Rules Updates (เลขอั้น / เลขจ่ายครึ่ง)
    newSocket.on('rules_updated', (data) => {
      console.log('📋 Number Rules Updated:', data);
      setRulesUpdates(data);
    });

    // Listen for Draw Result & Confetti
    newSocket.on('draw_settled', (data) => {
      console.log('🎉 Draw Settled:', data);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
      setToastMessage({
        title: '🎉 หวยออกแล้ว!',
        message: `3 บน: ${data.result3top} | 2 บน: ${data.result2top} | 2 ล่าง: ${data.result2bottom}`,
        type: 'DRAW_RESULT'
      });
    });

    // Listen for Room Disbanded
    newSocket.on('room_disbanded', (data) => {
      console.log('🚪 Room Disbanded:', data);
      setToastMessage({
        title: '📢 ห้องคีย์ถูกยุบแล้ว',
        message: data?.roomName ? `ห้องคีย์ "${data.roomName}" ถูกหัวหน้าทำการยุบห้องแล้ว` : 'ห้องคีย์นี้ถูกหัวหน้าทำการยุบห้องแล้ว',
        type: 'SYSTEM'
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Join room and user channel when user changes
  useEffect(() => {
    if (socket && user) {
      if (user.room_id) {
        socket.emit('join_room', user.room_id);
      }
      socket.emit('join_user', user.id);
    }
  }, [socket, user]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        lineNotifications,
        setLineNotifications,
        toastMessage,
        setToastMessage,
        quotaUpdates,
        rulesUpdates
      }}
    >
      {children}
      
      {/* Realtime Floating Toast for LINE alerts */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 max-w-sm w-full animate-bounce-short">
          <div className="bg-obsidian-850 border border-amber-500/40 shadow-2xl shadow-amber-500/20 rounded-2xl p-4 flex items-start space-x-3 text-slate-100">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center shrink-0 text-xl">
              {toastMessage.type === 'BILL' ? '🧾' : toastMessage.type === 'DRAW_RESULT' ? '🎉' : '🔔'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                  🔔 การแจ้งเตือนในระบบ
                </span>
                <button
                  onClick={() => setToastMessage(null)}
                  className="text-slate-400 hover:text-slate-200 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
              <h4 className="text-sm font-medium text-amber-200 mt-0.5 truncate">{toastMessage.title}</h4>
              <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed whitespace-pre-line">
                {toastMessage.message}
              </p>
            </div>
          </div>
        </div>
      )}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
