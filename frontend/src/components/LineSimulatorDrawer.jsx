import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { X, MessageSquare, Send, Bell, Keyboard, FileText, Users, Settings, LogIn } from 'lucide-react';

export default function LineSimulatorDrawer({ isOpen, onClose, onNavigate }) {
  const { role } = useAuth();
  const { lineNotifications, setLineNotifications } = useSocket();

  if (!isOpen) return null;

  const handleMenuClick = (targetPage) => {
    onNavigate(targetPage);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-md bg-[#191919] h-full flex flex-col border-l border-slate-800 shadow-2xl animate-slide-in">
        
        {/* LINE OA Header */}
        <div className="bg-[#202020] px-4 py-3 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#06C755] flex items-center justify-center font-bold text-lg text-white shadow-md">
              KL
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="font-semibold text-sm">Kee-Lek (คีย์เลข)</h3>
                <span className="bg-[#06C755] text-[10px] text-white px-1.5 py-0.2 rounded-full font-bold">
                  ✓ OA
                </span>
              </div>
              <p className="text-xs text-slate-400">ระบบจำลองการรับข้อความและ Rich Menu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* LINE Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#111111]">
          <div className="text-center">
            <span className="text-[11px] bg-slate-800/60 text-slate-400 px-3 py-1 rounded-full">
              ข้อความแจ้งเตือนล่าสุดจากระบบ
            </span>
          </div>

          {lineNotifications.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">ยังไม่มีข้อความแจ้งเตือนใหม่</p>
              <p className="text-xs text-slate-600 mt-1">
                เมื่อมีคนคีย์บิล หวยออก หรือมีการอนุมัติ ข้อความจะปรากฏที่นี่
              </p>
            </div>
          ) : (
            lineNotifications.map((notif, idx) => (
              <div key={idx} className="flex flex-col items-start max-w-[90%] space-y-1">
                <span className="text-[10px] text-slate-500 ml-1">
                  {notif.type === 'BILL' ? '🧾 แจ้งเตือนบิล' : notif.type === 'DRAW_RESULT' ? '🎉 ผลหวย' : '🔔 ระบบ'}
                </span>
                
                {/* Rich Message Card Mockup */}
                <div className="bg-obsidian-850 border border-amber-500/30 rounded-2xl p-3.5 shadow-lg text-slate-200 w-full">
                  <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm mb-1.5">
                    <span>{notif.title}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {notif.message}
                  </p>
                  {notif.meta?.billId && (
                    <button
                      onClick={() => handleMenuClick('bills')}
                      className="mt-2.5 w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-obsidian-950 rounded-lg text-xs font-bold text-center transition-colors shadow-sm"
                    >
                      ดูรายละเอียดบิลนี้ →
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* LINE Rich Menu Simulation (Customized per Role) */}
        <div className="bg-[#1f1f1f] border-t border-slate-800 p-2">
          <div className="text-[10px] uppercase font-bold text-slate-400 text-center mb-1.5 tracking-wider">
            📱 Rich Menu ประจำสิทธิ์: <span className="text-amber-400">{role}</span>
          </div>

          {role === 'GUEST' && (
            <div className="grid grid-cols-1 gap-1">
              <button
                onClick={() => handleMenuClick('rooms')}
                className="py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl flex items-center justify-center space-x-2 shadow-md"
              >
                <LogIn className="w-4 h-4" />
                <span>ห้องคีย์ (สร้างห้อง / เข้าร่วม)</span>
              </button>
            </div>
          )}

          {role === 'MEMBER' && (
            <div className="grid grid-cols-3 gap-1 text-center">
              <button
                onClick={() => handleMenuClick('keying')}
                className="py-2.5 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center space-y-1 border border-slate-700/50"
              >
                <Keyboard className="w-4 h-4 text-amber-400" />
                <span>คีย์เลข</span>
              </button>
              <button
                onClick={() => handleMenuClick('bills')}
                className="py-2.5 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center space-y-1 border border-slate-700/50"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>สรุปบิล</span>
              </button>
              <button
                onClick={() => handleMenuClick('team')}
                className="py-2.5 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center space-y-1 border border-slate-700/50"
              >
                <Users className="w-4 h-4 text-amber-400" />
                <span>ทีม</span>
              </button>
            </div>
          )}

          {(role === 'LEADER' || role === 'ADMIN') && (
            <div className="grid grid-cols-4 gap-1 text-center">
              <button
                onClick={() => handleMenuClick('keying')}
                className="py-2.5 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center space-y-1 border border-slate-700/50"
              >
                <Keyboard className="w-4 h-4 text-amber-400" />
                <span>คีย์เลข</span>
              </button>
              <button
                onClick={() => handleMenuClick('bills')}
                className="py-2.5 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center space-y-1 border border-slate-700/50"
              >
                <FileText className="w-4 h-4 text-amber-400" />
                <span>สรุปบิล</span>
              </button>
              <button
                onClick={() => handleMenuClick('team')}
                className="py-2.5 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center space-y-1 border border-slate-700/50"
              >
                <Users className="w-4 h-4 text-amber-400" />
                <span>ทีม</span>
              </button>
              <button
                onClick={() => handleMenuClick('settings')}
                className="py-2.5 bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-200 rounded-xl text-xs font-semibold flex flex-col items-center justify-center space-y-1 border border-slate-700/50"
              >
                <Settings className="w-4 h-4 text-amber-400" />
                <span>ตั้งค่า</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
