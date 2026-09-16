import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Shield, Crown, UserCheck, User, Sparkles } from 'lucide-react';

export default function RoleSwitcher() {
  const { user, role, switchUser, simulatorUsers } = useAuth();

  const getRoleBadge = (r) => {
    switch (r) {
      case 'ADMIN':
        return { label: 'Admin ผู้ดูแลระบบ', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/40', icon: Crown };
      case 'LEADER':
        return { label: 'หัวหน้า (เจ้ามือหวย)', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40', icon: Shield };
      case 'MEMBER':
        return { label: 'สมาชิก (ลูกทีมคีย์เลข)', bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', icon: UserCheck };
      default:
        return { label: 'ผู้ใช้ใหม่ (ยังไม่เป็นสมาชิก)', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/40', icon: User };
    }
  };

  const currentBadge = getRoleBadge(role);
  const CurrentIcon = currentBadge.icon;

  return (
    <div className="bg-gradient-to-r from-obsidian-900 via-obsidian-850 to-obsidian-900 border-b border-amber-500/20 px-3 py-2 text-xs">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
        
        {/* Current Role Indicator */}
        <div className="flex items-center space-x-2">
          <span className="flex items-center text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 mr-1 animate-pulse" />
            <span className="hidden sm:inline font-medium">Simulator:</span>
          </span>
          <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${currentBadge.bg}`}>
            <CurrentIcon className="w-3.5 h-3.5" />
            <span>{currentBadge.label}</span>
          </div>
          <span className="text-slate-300 font-medium hidden md:inline truncate max-w-[150px]">
            {user?.display_name}
          </span>
        </div>

        {/* Quick Switch Buttons */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5">
          <span className="text-slate-400 hidden lg:inline mr-1">สลับบทบาท:</span>
          {simulatorUsers.map((u) => {
            const isSelected = user?.id === u.id;
            return (
              <button
                key={u.id}
                onClick={() => switchUser(u.id)}
                className={`px-2 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-amber-500 text-obsidian-950 font-bold shadow-sm shadow-amber-500/50 scale-105'
                    : 'bg-obsidian-800 text-slate-300 hover:bg-obsidian-700 hover:text-white border border-slate-700/50'
                }`}
              >
                {u.role === 'ADMIN' && '👑 '}
                {u.role === 'LEADER' && '💼 '}
                {u.role === 'MEMBER' && '👩 '}
                {u.role === 'GUEST' && '👤 '}
                {u.nickname || u.display_name.split(' ')[0]}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
