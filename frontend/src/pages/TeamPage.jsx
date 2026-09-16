import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useModal } from '../context/ModalContext.jsx';
import { Users, Copy, Check, UserMinus, LogOut, ShieldAlert, Award, TrendingUp, CheckCircle, XCircle, Trash2, AlertTriangle } from 'lucide-react';

export default function TeamPage({ onLeaveRoom }) {
  const { user, role, refreshProfile, fetchSimulatorUsers } = useAuth();
  const { showAlert, showConfirm } = useModal();
  const [teamData, setTeamData] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [disbandModalOpen, setDisbandModalOpen] = useState(false);
  const [disbanding, setDisbanding] = useState(false);

  const fetchTeam = async () => {
    try {
      const res = await axios.get('/api/team/stats');
      if (res.data.success) {
        setTeamData(res.data);
      }
      if (role === 'LEADER') {
        const reqRes = await axios.get('/api/rooms/pending-requests');
        if (reqRes.data.success) {
          setPendingRequests(reqRes.data.requests);
        }
      }
    } catch (err) {
      console.error('Failed to load team data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [role]);

  const copyRoomCode = () => {
    if (teamData?.room?.code) {
      navigator.clipboard.writeText(teamData.room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApproveMember = async (memberUserId) => {
    try {
      const res = await axios.post('/api/rooms/approve-member', { userId: memberUserId });
      if (res.data.success) {
        fetchTeam();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถอนุมัติได้', { type: 'error' });
    }
  };

  const handleRejectMember = async (memberUserId) => {
    try {
      const res = await axios.post('/api/rooms/reject-member', { userId: memberUserId });
      if (res.data.success) {
        fetchTeam();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถปฏิเสธได้', { type: 'error' });
    }
  };

  const handleKickMember = async (memberUserId, name) => {
    const ok = await showConfirm(`คุณแน่ใจหรือไม่ว่าต้องการเตะ "${name}" ออกจากห้อง?`, {
      type: 'danger',
      confirmText: 'เตะออกจากห้อง',
      cancelText: 'ยกเลิก'
    });
    if (!ok) return;
    try {
      const res = await axios.post('/api/rooms/kick-member', { memberId: memberUserId });
      if (res.data.success) {
        fetchTeam();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถเตะสมาชิกได้', { type: 'error' });
    }
  };

  const handleLeaveRoom = async () => {
    const ok = await showConfirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากห้องนี้?', {
      type: 'warning',
      confirmText: 'ออกจากห้อง',
      cancelText: 'ยกเลิก'
    });
    if (!ok) return;
    try {
      const res = await axios.post('/api/rooms/leave');
      if (res.data.success) {
        refreshProfile();
        if (onLeaveRoom) onLeaveRoom();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถออกจากห้องได้', { type: 'error' });
    }
  };

  const handleDisbandRoom = async () => {
    setDisbanding(true);
    try {
      const res = await axios.post('/api/rooms/disband');
      if (res.data.success) {
        setDisbandModalOpen(false);
        if (fetchSimulatorUsers) fetchSimulatorUsers();
        await refreshProfile();
        if (onLeaveRoom) onLeaveRoom();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถยุบห้องได้', { type: 'error' });
    } finally {
      setDisbanding(false);
    }
  };

  if (loading) {
    return <div className="text-center py-16 text-slate-400">กำลังโหลดข้อมูลทีม...</div>;
  }

  const room = teamData?.room;
  const members = teamData?.members || [];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 pb-24 space-y-6">
      
      {/* 1. Giant 6-digit Room PIN Box on Top Center */}
      <div className="glass-panel rounded-3xl p-6 text-center shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <span className="text-xs text-amber-400 font-semibold tracking-widest uppercase block mb-1">
          รหัสห้องสำหรับชวนลูกทีม
        </span>
        <h2 className="text-lg font-bold text-slate-200 mb-3">{room?.name}</h2>

        {/* 6-digit PIN */}
        <div className="inline-flex items-center space-x-3 bg-obsidian-950 border-2 border-amber-500/50 rounded-2xl px-6 py-3 shadow-inner">
          <span className="text-3xl sm:text-4xl font-mono font-extrabold tracking-widest gold-gradient-text">
            {room?.code || '------'}
          </span>
          <button
            onClick={copyRoomCode}
            className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors"
            title="คลิกเพื่อคัดลอกรหัส"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        <p className="text-xs text-slate-400 mt-3">
          {copied ? 'คัดลอกรหัสแล้ว! ส่งให้ลูกทีมกรอกในหน้าห้องคีย์ได้ทันที' : 'ให้ลูกทีมนำรหัส 6 หลักนี้ไปกรอกเพื่อขอเข้าร่วมห้อง'}
        </p>

        {/* Member Action: Leave Room */}
        {role === 'MEMBER' && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <button
              onClick={handleLeaveRoom}
              className="py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1.5 mx-auto transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>ออกจากห้องนี้</span>
            </button>
          </div>
        )}

        {/* Leader Action: Disband Room */}
        {role === 'LEADER' && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <button
              onClick={() => setDisbandModalOpen(true)}
              className="py-2 px-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded-xl text-xs font-semibold flex items-center space-x-1.5 mx-auto transition-all shadow-sm shadow-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
              <span>ยุบห้อง</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Pending Join Requests (Leader Only) */}
      {role === 'LEADER' && pendingRequests.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 shadow-xl">
          <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>มีผู้ขอเข้าร่วมห้อง ({pendingRequests.length} คน)</span>
          </div>

          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.request_id}
                className="bg-obsidian-900 rounded-2xl p-3.5 flex items-center justify-between border border-slate-800"
              >
                <div>
                  <div className="font-bold text-sm text-slate-100">{req.display_name}</div>
                  <div className="text-xs text-slate-400">
                    โทร: {req.phone || 'ไม่ระบุ'} | ส่งคำขอเมื่อ {new Date(req.joined_at).toLocaleTimeString('th-TH')}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleApproveMember(req.user_id)}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-bold rounded-xl text-xs flex items-center space-x-1"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>อนุมัติ</span>
                  </button>
                  <button
                    onClick={() => handleRejectMember(req.user_id)}
                    className="px-3 py-1.5 bg-obsidian-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 rounded-xl text-xs"
                  >
                    ปฏิเสธ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Team Leaderboard & Members List */}
      <div className="bg-obsidian-900 border border-slate-800 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm sm:text-base text-slate-100">
              สมาชิกภายในทีม ({members.length} คน)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            หัวหน้าห้อง: <strong className="text-amber-300">{room?.leader_name}</strong>
          </span>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            ยังไม่มีสมาชิกในห้อง แชร์รหัส 6 หลักให้ลูกทีมได้เลย
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">อันดับ</th>
                  <th className="py-2.5 px-3">ชื่อสมาชิก</th>
                  <th className="py-2.5 px-3 text-right">จำนวนบิล</th>
                  <th className="py-2.5 px-3 text-right">ยอดขายรวม (บ.)</th>
                  <th className="py-2.5 px-3 text-right">คอมมิชชั่น (บ.)</th>
                  {role === 'LEADER' && <th className="py-2.5 px-3 text-center">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {members.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-obsidian-850/50 transition-colors">
                    <td className="py-3 px-3">
                      {idx === 0 ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-obsidian-950 font-bold text-xs">
                          1
                        </span>
                      ) : (
                        <span className="text-slate-500 font-bold">{idx + 1}</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <div className="font-semibold text-slate-100">{m.display_name}</div>
                      <div className="text-[11px] text-slate-500">{m.phone || m.username}</div>
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300">
                      {m.total_bills} บิล
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-amber-400">
                      {Number(m.total_sales).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 font-bold">
                      {Number(m.total_commission).toLocaleString()}
                    </td>
                    {role === 'LEADER' && (
                      <td className="py-3 px-3 text-center font-sans">
                        <button
                          onClick={() => handleKickMember(m.id, m.display_name)}
                          className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-[11px] font-semibold transition-colors"
                        >
                          เตะออก
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disband Room Confirmation Modal */}
      {disbandModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-obsidian-900 border border-red-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl shadow-red-500/10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-100">ยืนยันการยุบห้องคีย์?</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                คุณกำลังจะยุบห้อง <strong className="text-amber-300">"{room?.name}"</strong> (รหัส {room?.code})<br />
                เมื่อยุบห้องแล้ว ลูกทีมทุกคนจะถูกปลดออกจากห้อง รหัสห้องจะถูกยกเลิก และห้องจะถูกปิดใช้งานทันที
              </p>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-[11px] text-red-300 font-medium">
              ⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                disabled={disbanding}
                onClick={() => setDisbandModalOpen(false)}
                className="flex-1 py-2.5 px-4 bg-obsidian-800 hover:bg-obsidian-750 text-slate-300 font-semibold rounded-xl text-xs transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={disbanding}
                onClick={handleDisbandRoom}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-red-600/30 disabled:opacity-50"
              >
                {disbanding ? (
                  <span>กำลังยุบห้อง...</span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>ยืนยันยุบห้อง</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
