import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { 
  Keyboard, LogIn, PlusCircle, CheckCircle2, AlertCircle, 
  Building2, Shield, Phone, CreditCard, Sparkles, X, Clock
} from 'lucide-react';

export default function GuestRoomPage({ onJoined }) {
  const { user, refreshProfile } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingRoom, setPendingRoom] = useState(null);

  // Form state for Join Room (6-digit PIN)
  const [pinDigits, setPinDigits] = useState(['', '', '', '', '', '']);
  const pinRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  // Form states for Create Room
  const [roomName, setRoomName] = useState('');

  // Check if user has an existing pending room
  const checkPendingRoom = async () => {
    try {
      const res = await axios.get('/api/auth/profile');
      if (res.data.success && res.data.user) {
        if (res.data.user.role === 'LEADER' && res.data.user.room_id) {
          onJoined?.();
        } else if (res.data.user.room_status === 'PENDING') {
          setPendingRoom({
            name: res.data.user.room_name || 'ห้องของคุณ',
            code: res.data.user.room_code
          });
        }
      }
    } catch (err) {
      console.error('Failed to check room status:', err);
    }
  };

  useEffect(() => {
    checkPendingRoom();
  }, []);

  // Realtime room approval listener
  useEffect(() => {
    if (!socket) return;

    const handleRoomApproved = (data) => {
      setMessage({
        type: 'success',
        text: `🎉 ยินดีด้วย! ห้อง "${data.roomName || ''}" ของคุณได้รับการอนุมัติเรียบร้อยแล้ว!`
      });
      refreshProfile();
      setTimeout(() => {
        onJoined?.();
      }, 1500);
    };

    socket.on('room_approved', handleRoomApproved);
    return () => {
      socket.off('room_approved', handleRoomApproved);
    };
  }, [socket]);

  // Handle PIN Box typing
  const handlePinChange = (idx, val) => {
    const cleaned = val.toUpperCase().slice(-1);
    const newDigits = [...pinDigits];
    newDigits[idx] = cleaned;
    setPinDigits(newDigits);

    // Auto-focus next input
    if (cleaned && idx < 5) {
      pinRefs[idx + 1].current?.focus();
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !pinDigits[idx] && idx > 0) {
      pinRefs[idx - 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().toUpperCase().slice(0, 6);
    if (pastedData) {
      const newDigits = [...pinDigits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pastedData[i] || '';
      }
      setPinDigits(newDigits);
      pinRefs[Math.min(pastedData.length, 5)].current?.focus();
    }
  };

  // Submit Join Room Request
  const handleJoinRoom = async (e) => {
    e.preventDefault();
    const code = pinDigits.join('');
    if (code.length !== 6) {
      setMessage({ type: 'error', text: 'กรุณากรอกรหัสห้องให้ครบ 6 หลัก' });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.post('/api/rooms/join', { code });
      if (res.data.success) {
        setMessage({
          type: 'success',
          text: res.data.message + ' (ระบบได้ส่งการแจ้งเตือนไปยังหัวหน้าห้องแล้ว กรุณารอการกดยืนยัน)'
        });
        refreshProfile();
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'เกิดข้อผิดพลาดในการขอเข้าร่วมห้อง'
      });
    } finally {
      setLoading(false);
    }
  };

  // Submit Create Room Request
  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim()) {
      setMessage({ type: 'error', text: 'กรุณากรอกชื่อห้องคีย์หวย' });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await axios.post('/api/rooms/create', {
        roomName: roomName.trim()
      });
      if (res.data.success) {
        setPendingRoom({
          name: roomName.trim(),
          code: res.data.code
        });
        setShowCreateModal(false);
        setMessage({
          type: 'success',
          text: 'ส่งคำขอสร้างห้องสำเร็จ! ระบบได้แจ้งเตือนไปยัง Admin แล้ว เมื่อ Admin อนุมัติคุณจะได้รับสิทธิ์เป็นหัวหน้าห้องทันที'
        });
        refreshProfile();
      }
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'เกิดข้อผิดพลาดในการส่งคำขอสร้างห้อง'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 text-slate-100 font-sans">
      
      {/* Welcome Banner */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-400 p-[1px] shadow-xl shadow-amber-500/20 mb-3">
          <div className="w-full h-full bg-obsidian-950 rounded-[23px] flex items-center justify-center">
            <Keyboard className="w-8 h-8 text-amber-400" />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          ยินดีต้อนรับ, <span className="gold-gradient-text">{user?.display_name || 'สมาชิก'}</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          คุณยังไม่มีห้องคีย์ประจำ กรุณากรอกรหัสเข้าร่วมห้อง หรือกดขอสร้างห้องใหม่
        </p>
      </div>

      {/* Pending Room Approval Status Banner */}
      {pendingRoom && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-200 shadow-lg shadow-amber-500/10 flex items-start space-x-3 animate-pulse">
          <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-amber-300">
              ⏳ มีคำขอสร้างห้อง "{pendingRoom.name}" อยู่ระหว่างรอ Admin อนุมัติ
            </h4>
            <p className="text-xs text-slate-300 mt-1">
              ระบบได้ส่งข้อความแจ้งเตือนไปที่ Admin แล้ว เมื่อ Admin กดอนุมัติ ระบบจะปรับสิทธิ์เป็นหัวหน้าห้องให้คุณโดยอัตโนมัติทันที
            </p>
          </div>
        </div>
      )}

      {/* Feedback Message */}
      {message && (
        <div
          className={`p-4 rounded-2xl mb-6 text-sm flex items-start space-x-3 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border border-red-500/30 text-red-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          )}
          <p className="leading-relaxed">{message.text}</p>
        </div>
      )}

      {/* MAIN CARD: 6-DIGIT PIN JOIN ROOM */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-amber-500/20 mb-6">
        
        <div className="text-center mb-6">
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <LogIn className="w-3.5 h-3.5" />
            <span>เข้าร่วมห้องคีย์</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">กรอกรหัส 6 หลักเพื่อเข้าร่วมห้อง</h2>
          <p className="text-xs text-slate-400 mt-1">
            ขอรับรหัส 6 หลักได้จากหัวหน้าห้อง (เจ้ามือ) ของคุณ
          </p>
        </div>

        <form onSubmit={handleJoinRoom} className="space-y-6">
          {/* 6 Textbox boxes */}
          <div className="flex items-center justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
            {pinDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={pinRefs[idx]}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePinChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-11 h-14 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-mono font-bold bg-obsidian-950 border-2 border-slate-700 focus:border-amber-400 rounded-2xl text-amber-300 outline-none shadow-inner transition-all focus:scale-105"
                placeholder="-"
              />
            ))}
          </div>

          <div className="text-center text-xs text-slate-400">
            💡 ตัวอย่างรหัสห้องที่เปิดใช้งานอยู่: <strong className="text-amber-400 font-mono">KL8899</strong>
          </div>

          {/* Action Buttons: Join Room & Request Create Room */}
          <div className="space-y-3">
            <button
              type="submit"
              disabled={loading || pinDigits.join('').length !== 6}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:opacity-95 disabled:opacity-50 text-obsidian-950 font-bold rounded-2xl shadow-lg shadow-amber-500/25 text-sm transition-all flex items-center justify-center space-x-2"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'กำลังส่งคำขอ...' : 'เข้าร่วมห้องคีย์'}</span>
            </button>

            {/* Separator */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-[11px] text-slate-500 uppercase tracking-wider">
                หรือ
              </span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* CREATE ROOM BUTTON */}
            <button
              type="button"
              onClick={() => {
                setMessage(null);
                setShowCreateModal(true);
              }}
              className="w-full py-3.5 bg-obsidian-900 hover:bg-obsidian-850 text-amber-400 hover:text-amber-300 border border-amber-500/40 hover:border-amber-500/60 font-bold rounded-2xl text-sm transition-all flex items-center justify-center space-x-2 shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              <span>สร้างห้อง (สำหรับเจ้ามือหวย)</span>
            </button>
          </div>
        </form>

      </div>

      {/* ================= MODAL: CREATE ROOM REQUEST ================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-obsidian-900 border border-amber-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl animate-scale-up text-slate-100">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">ขอเปิดห้องคีย์หวยใหม่</h3>
                  <p className="text-[11px] text-slate-400">ส่งคำขอให้ Admin อนุมัติสิทธิ์หัวหน้า (เจ้ามือ)</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1 font-semibold">
                  ชื่อห้องคีย์หวย *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="เช่น ห้องเศรษฐี 888, ห้องรวยปลดหนี้"
                  className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none"
                />
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-start space-x-2.5">
                <span className="text-base shrink-0">ℹ️</span>
                <span className="leading-relaxed">
                  ระบบจะใช้ข้อมูลบัญชีและการติดต่อของคุณ (<strong>{user?.display_name || user?.username}</strong>) ที่กรอกไว้ตอนสมัครสมาชิกผูกเป็นหัวหน้าห้อง และส่งคำขอไปยัง <strong>Admin</strong> เพื่อทำการอนุมัติทันที
                </span>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={loading || !roomName.trim()}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-95 disabled:opacity-50 text-obsidian-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20"
                >
                  {loading ? 'กำลังส่งคำขอ...' : 'ยืนยันขอเปิดห้อง'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
