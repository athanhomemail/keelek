import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './context/AuthContext.jsx';
import { useSocket } from './context/SocketContext.jsx';
import { Keyboard } from 'lucide-react';
import RoleSwitcher from './components/RoleSwitcher.jsx';
import Navbar from './components/Navbar.jsx';
import NotificationDrawer from './components/NotificationDrawer.jsx';

// Pages
import AuthPage from './pages/AuthPage.jsx';
import GuestRoomPage from './pages/GuestRoomPage.jsx';
import KeyingPage from './pages/KeyingPage.jsx';
import BillSummaryPage from './pages/BillSummaryPage.jsx';
import RoomPage from './pages/RoomPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

export default function App() {
  const { user, role, loading } = useAuth();
  const { socket } = useSocket();
  const [activePage, setActivePage] = useState('keying');
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [editingBill, setEditingBill] = useState(null);

  // Fetch unread notifications count
  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const res = await axios.get('/api/notifications');
      if (res.data.success && res.data.notifications) {
        const unread = res.data.notifications.filter((n) => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      // Ignore background error
    }
  };

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user]);

  // Socket notification listener to increment badge
  useEffect(() => {
    if (!socket) return;

    const handleNewNotif = () => {
      setUnreadCount((prev) => prev + 1);
    };

    socket.on('notification_received', handleNewNotif);
    return () => {
      socket.off('notification_received', handleNewNotif);
    };
  }, [socket]);

  // Sync active page when role changes or user enters/leaves room
  useEffect(() => {
    if (!user) return;

    if (role === 'GUEST' || !user.room_id) {
      if (role !== 'ADMIN') {
        setActivePage('rooms');
      } else {
        setActivePage('admin');
      }
    } else if (role === 'ADMIN') {
      setActivePage('admin');
    } else {
      setActivePage('keying');
    }
  }, [role, user?.room_id]);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian-950 flex flex-col items-center justify-center text-amber-400 font-sans">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-xl shadow-amber-500/20 animate-pulse mb-4">
          <Keyboard className="w-8 h-8 text-obsidian-950" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Kee-Lek (คีย์เลข)</h2>
        <p className="text-xs text-slate-500 mt-1">กำลังเชื่อมต่อฐานข้อมูล...</p>
      </div>
    );
  }

  // PROTECTED ROUTE: If not logged in, redirect to AuthPage
  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-obsidian-950 text-slate-100 font-sans flex flex-col selection:bg-amber-500 selection:text-obsidian-950">
      
      {/* 1. Simulator Quick Role Bar (Optional for testing) */}
      <RoleSwitcher />

      {/* 2. Main Navbar */}
      <Navbar 
        activePage={activePage} 
        setActivePage={setActivePage}
        onOpenNotifications={() => {
          setNotifDrawerOpen(true);
          fetchUnreadCount();
        }}
        unreadCount={unreadCount}
      />

      {/* 3. Main Page Content */}
      <main className="flex-1 w-full pb-20 md:pb-8">
        {(activePage === 'rooms' || (role === 'GUEST' && activePage !== 'admin')) && (
          <GuestRoomPage onJoined={() => setActivePage('keying')} />
        )}
        {activePage === 'keying' && role !== 'GUEST' && (
          <KeyingPage
            editingBill={editingBill}
            onCancelEdit={() => setEditingBill(null)}
            onEditSuccess={() => {
              setEditingBill(null);
              setActivePage('bills');
            }}
          />
        )}
        {activePage === 'bills' && role !== 'GUEST' && (
          <BillSummaryPage
            onEditBill={(bill) => {
              setEditingBill(bill);
              setActivePage('keying');
            }}
          />
        )}
        {(activePage === 'room' || activePage === 'team' || activePage === 'settings') && role !== 'GUEST' && (
          <RoomPage onLeaveRoom={() => setActivePage('rooms')} />
        )}
        {activePage === 'admin' && (
          <AdminPage />
        )}
      </main>

      {/* 4. In-App Notification Center Drawer */}
      <NotificationDrawer
        isOpen={notifDrawerOpen}
        onClose={() => {
          setNotifDrawerOpen(false);
          fetchUnreadCount();
        }}
        onNavigate={(page) => setActivePage(page)}
      />

    </div>
  );
}
