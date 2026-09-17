import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useModal } from '../context/ModalContext.jsx';
import { 
  FileText, Users, Settings, ShieldCheck, DoorOpen, Copy, Check, 
  Keyboard, Sun, Moon, Bell, LogOut 
} from 'lucide-react';

export default function Navbar({ activePage, setActivePage, onOpenNotifications, unreadCount = 0 }) {
  const { user, role, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { showConfirm } = useModal();
  const [copied, setCopied] = useState(false);

  const handleLogout = async () => {
    const ok = await showConfirm('คุณต้องการออกจากระบบใช่หรือไม่?', {
      subtitle: 'ระบบจะปิดเซสชันการใช้งานและนำคุณกลับสู่หน้าเข้าสู่ระบบ',
      type: 'danger',
      confirmText: 'ออกจากระบบ',
      cancelText: 'ยกเลิก'
    });
    if (ok) {
      logout();
    }
  };

  const copyRoomCode = () => {
    if (user?.room_code) {
      navigator.clipboard.writeText(user.room_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Construct navigation items with 'keying' (คีย์เลข) strictly in the CENTER and hero position
  const navItems = [];

  if (role === 'GUEST') {
    navItems.push({ id: 'rooms', label: 'ห้องคีย์', icon: DoorOpen });
  } else if (role === 'ADMIN') {
    // Admin: หลังบ้าน, สรุปบิล (ตัดเมนูคีย์ออกไป ไม่ต้องมีห้อง/สร้างห้อง)
    navItems.push({ id: 'admin', label: 'หลังบ้าน', icon: ShieldCheck, isHero: true });
    navItems.push({ id: 'bills', label: 'สรุปบิล', icon: FileText });
  } else if (role === 'LEADER') {
    // Leader: สรุปบิล, คีย์เลข, ห้อง (ยุบรวม ทีมเดิม + ตั้งค่าเดิม)
    navItems.push({ id: 'bills', label: 'สรุปบิล', icon: FileText });
    navItems.push({ id: 'keying', label: 'คีย์เลข', icon: Keyboard, isHero: true });
    navItems.push({ id: 'room', label: 'ห้อง', icon: DoorOpen });
  } else {
    // Member: สรุปบิล, คีย์เลข, ห้อง
    navItems.push({ id: 'bills', label: 'สรุปบิล', icon: FileText });
    navItems.push({ id: 'keying', label: 'คีย์เลข', icon: Keyboard, isHero: true });
    navItems.push({ id: 'room', label: 'ห้อง', icon: DoorOpen });
  }

  return (
    <>
      {/* Top Main Navbar */}
      <header className="bg-obsidian-900/90 backdrop-blur-md border-b border-amber-500/20 sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer" onClick={() => setActivePage(user?.room_id ? 'keying' : (role === 'ADMIN' ? 'admin' : 'rooms'))}>
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 p-[1px] shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-obsidian-950 rounded-[11px] flex items-center justify-center">
                <Keyboard className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-base sm:text-lg gold-gradient-text tracking-wide">Kee-Lek</span>
                <span className="hidden sm:inline text-xs bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-semibold border border-amber-500/20">
                  คีย์เลข
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                ระบบจัดการและคีย์หวยออนไลน์
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;

              // Prominent Hero style for "คีย์เลข"
              if (item.isHero) {
                return (
                  <button
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className={`relative mx-2 flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 shadow-md ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-obsidian-950 shadow-amber-500/40 ring-2 ring-amber-400/60 scale-105'
                        : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-500 border border-amber-500/40 hover:scale-102'
                    }`}
                  >
                    <Keyboard className="w-4 h-4 stroke-[2.5]" />
                    <span>{item.label}</span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  </button>
                );
              }

              // Standard nav items
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-obsidian-800 text-amber-500 font-bold shadow-sm'
                      : 'text-slate-300 hover:text-slate-100 hover:bg-obsidian-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Header Actions: Notification Bell, Theme Switcher, Room PIN, User Info & Logout */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">

            {/* Notification Bell Button */}
            <button
              type="button"
              onClick={onOpenNotifications}
              title="การแจ้งเตือน"
              className="relative p-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 text-slate-300 hover:text-amber-400 border border-slate-700/60 transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-sm"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-obsidian-950 text-[10px] font-extrabold flex items-center justify-center animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Dark/Light Mode Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              title={isDark ? 'สลับเป็นโหมดสว่าง (Light Mode)' : 'สลับเป็นโหมดมืด (Dark Mode)'}
              className="p-2 rounded-xl bg-obsidian-800 hover:bg-obsidian-700 text-amber-500 border border-slate-700/60 transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-sm"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-400 hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-4 h-4 text-amber-600 hover:-rotate-12 transition-transform" />
              )}
            </button>

            {/* Room PIN Copy Button */}
            {user?.room_code && (
              <button
                onClick={copyRoomCode}
                title="คลิกเพื่อคัดลอกรหัสห้อง"
                className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-xl text-xs font-mono font-bold transition-all"
              >
                <span>ห้อง: {user.room_code}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}

            {/* User Profile Info & Compact Logout */}
            <div className="flex flex-col items-end pl-2 sm:pl-3 border-l border-slate-700/60 text-right">
              {/* Row 1: User Display Name */}
              <div 
                className="text-xs font-semibold text-slate-200 truncate max-w-[120px] sm:max-w-[160px]"
                title={user?.display_name || 'ผู้ใช้ทั่วไป'}
              >
                {user?.display_name || 'ผู้ใช้ทั่วไป'}
              </div>

              {/* Row 2: Role & Logout Button (Aligned Right, same line) */}
              <div className="flex items-center space-x-1.5 mt-0.5">
                {/* Role Badge */}
                <span 
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border leading-none ${
                    role === 'ADMIN'
                      ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                      : role === 'LEADER'
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      : role === 'MEMBER'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  }`}
                  title={user?.room_name ? `ห้อง: ${user.room_name}` : role}
                >
                  {role}
                </span>

                {/* Small Logout Button (Right-aligned, icon-only on mobile) */}
                <button
                  type="button"
                  onClick={handleLogout}
                  title="ออกจากระบบ"
                  className="inline-flex items-center space-x-1 text-[10px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 p-1 sm:px-1.5 sm:py-0.5 rounded-md transition-all active:scale-95 group font-medium"
                >
                  <LogOut className="w-2.5 h-2.5 transition-transform group-hover:translate-x-0.5" />
                  <span className="hidden sm:inline">ออกจากระบบ</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Centered Hero FAB for "คีย์เลข") */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-obsidian-900/95 backdrop-blur-lg border-t border-slate-700/60 px-2 py-1 transition-colors duration-200">
        <div className="flex items-center justify-around relative">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            // Elevated Center Hero Floating Action Button (FAB) for "คีย์เลข"
            if (item.isHero) {
              return (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className="relative -top-4 flex flex-col items-center group focus:outline-none"
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 border-4 border-obsidian-900 ${
                      isActive
                        ? 'bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-400 text-obsidian-950 ring-4 ring-amber-400/40 shadow-amber-500/50 scale-110 -translate-y-0.5'
                        : 'bg-gradient-to-tr from-amber-600 via-orange-500 to-amber-400 text-obsidian-950 shadow-amber-500/30 hover:scale-105'
                    }`}
                  >
                    <Keyboard className="w-7 h-7 stroke-[2.5]" />
                  </div>
                  <span className={`text-[11px] font-bold mt-0.5 tracking-wide ${isActive ? 'text-amber-500' : 'text-slate-400'}`}>
                    {item.label}
                  </span>
                </button>
              );
            }

            // Normal bottom bar item
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`flex flex-col items-center py-1 px-3 rounded-xl transition-all ${
                  isActive
                    ? 'text-amber-500 font-bold scale-105'
                    : 'text-slate-400 hover:text-slate-200 font-medium'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
                <span className="text-[11px] mt-0.5">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
