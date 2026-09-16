import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useModal } from '../context/ModalContext.jsx';
import { 
  Users, Copy, Check, UserMinus, LogOut, ShieldAlert, Award, TrendingUp, 
  CheckCircle, XCircle, Trash2, AlertTriangle, Settings, Plus, Save, 
  ShieldCheck, DollarSign, DoorOpen, UserCheck, Clock, FileText, Sparkles
} from 'lucide-react';

export default function RoomPage({ onLeaveRoom }) {
  const { user, role, refreshProfile, fetchSimulatorUsers } = useAuth();
  const { showAlert, showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'settings'

  // Team & Member States
  const [teamData, setTeamData] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [disbandModalOpen, setDisbandModalOpen] = useState(false);
  const [disbanding, setDisbanding] = useState(false);

  // Settings States
  const [settingsList, setSettingsList] = useState([]);
  const [rules, setRules] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New Rule Form Modal
  const [showAddRule, setShowAddRule] = useState(false);
  const [rulePeriodId, setRulePeriodId] = useState('');
  const [ruleNumber, setRuleNumber] = useState('');
  const [ruleBetType, setRuleBetType] = useState('ALL');
  const [ruleType, setRuleType] = useState('BLOCKED'); // 'BLOCKED' | 'HALF_PAY' | 'CUSTOM_LIMIT'
  const [ruleLimit, setRuleLimit] = useState('');
  const [ruleNote, setRuleNote] = useState('');

  // 1. Fetch Team / Room Data
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
      console.error('Failed to load room data:', err);
    } finally {
      setLoadingTeam(false);
    }
  };

  // 2. Fetch Settings Data
  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const [settingRes, periodRes] = await Promise.all([
        axios.get('/api/settings'),
        axios.get('/api/draw-periods?status=OPEN')
      ]);
      if (settingRes.data.success) {
        setSettingsList(settingRes.data.settings);
        setRules(settingRes.data.rules);
      }
      if (periodRes.data.success) {
        setPeriods(periodRes.data.periods);
        if (periodRes.data.periods.length) {
          setRulePeriodId(periodRes.data.periods[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Failed to load room settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    fetchTeam();
    if (role === 'LEADER') {
      fetchSettings();
    }
  }, [role]);

  const copyRoomCode = () => {
    if (teamData?.room?.code) {
      navigator.clipboard.writeText(teamData.room.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Leader: Approve Member
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

  // Leader: Reject Member
  const handleRejectMember = async (memberUserId) => {
    const ok = await showConfirm('ต้องการปฏิเสธคำขอเข้าร่วมห้องนี้ใช่หรือไม่?', {
      type: 'warning',
      confirmText: 'ปฏิเสธคำขอ',
      cancelText: 'ยกเลิก'
    });
    if (!ok) return;

    try {
      const res = await axios.post('/api/rooms/reject-member', { userId: memberUserId });
      if (res.data.success) {
        fetchTeam();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถปฏิเสธได้', { type: 'error' });
    }
  };

  // Leader: Kick Member
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

  // Member: Leave Room
  const handleLeaveRoom = async () => {
    const ok = await showConfirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากห้องนี้?', {
      subtitle: 'หลังจากออกจากห้องแล้ว คุณจะต้องกรอกรหัสเข้าร่วมห้องใหม่อีกครั้ง',
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

  // Leader: Disband Room
  const handleDisbandRoom = async () => {
    setDisbanding(true);
    try {
      const res = await axios.post('/api/rooms/disband');
      if (res.data.success) {
        setDisbandModalOpen(false);
        showAlert(res.data.message || 'ยุบห้องคีย์เรียบร้อยแล้ว', { type: 'success' });
        await refreshProfile();
        if (fetchSimulatorUsers) fetchSimulatorUsers();
        if (onLeaveRoom) onLeaveRoom();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถยุบห้องได้', { type: 'error' });
    } finally {
      setDisbanding(false);
    }
  };

  // Settings Handlers
  const handleSettingChange = (lotteryId, field, value) => {
    setSettingsList(prev => prev.map(s => {
      if (s.lottery_id === lotteryId) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setSaveSuccess(false);
    try {
      const res = await axios.put('/api/settings', { settingsList });
      if (res.data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถบันทึกการตั้งค่าได้', { type: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!ruleNumber || !rulePeriodId) return;

    try {
      const res = await axios.post('/api/settings/number-rule', {
        drawPeriodId: rulePeriodId,
        number: ruleNumber.trim(),
        betType: ruleBetType,
        ruleType,
        customLimit: ruleType === 'CUSTOM_LIMIT' ? Number(ruleLimit) : null,
        note: ruleNote.trim()
      });
      if (res.data.success) {
        setShowAddRule(false);
        setRuleNumber('');
        setRuleLimit('');
        setRuleNote('');
        fetchSettings();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถเพิ่มกฎตัวเลขได้', { type: 'error' });
    }
  };

  const handleDeleteRule = async (ruleId) => {
    const ok = await showConfirm('ต้องการลบกฎของเลขนี้ใช่หรือไม่?', {
      type: 'danger',
      confirmText: 'ลบกฎตัวเลข',
      cancelText: 'ยกเลิก'
    });
    if (!ok) return;
    try {
      const res = await axios.delete(`/api/settings/number-rule/${ruleId}`);
      if (res.data.success) {
        fetchSettings();
      }
    } catch (err) {
      showAlert('ไม่สามารถลบกฎได้', { type: 'error' });
    }
  };

  if (loadingTeam) {
    return <div className="text-center py-16 text-slate-400">กำลังโหลดข้อมูลห้อง...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 pb-24 space-y-6">
      
      {/* 1. ROOM BANNER HEADER */}
      <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-amber-500/20 relative overflow-hidden shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <DoorOpen className="w-3.5 h-3.5" />
              <span>{role === 'LEADER' ? 'คุณเป็นหัวหน้าห้อง (เจ้ามือ)' : 'สมาชิกห้อง'}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              {teamData?.room?.name || 'ห้องคีย์หวย'}
            </h1>
            <p className="text-xs text-slate-400">
              เปิดเมื่อ: {teamData?.room?.created_at ? new Date(teamData.room.created_at).toLocaleDateString('th-TH') : '-'}
            </p>
          </div>

          {/* Room PIN Code Copy Box */}
          <div className="bg-obsidian-950/80 border border-amber-500/30 rounded-2xl p-3 flex flex-col items-center">
            <span className="text-[10px] text-amber-400/80 font-medium">รหัสเข้าร่วมห้อง (PIN 6 หลัก)</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className="font-mono text-xl sm:text-2xl font-bold tracking-widest text-amber-400">
                {teamData?.room?.code}
              </span>
              <button
                onClick={copyRoomCode}
                title="คัดลอกรหัสห้อง"
                className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Room Turnover & Members Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800">
          <div>
            <div className="text-[11px] text-slate-400">สมาชิกทั้งหมด</div>
            <div className="text-lg font-bold text-slate-100">{teamData?.stats?.total_members || 1} คน</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">บิลรวมทั้งหมด</div>
            <div className="text-lg font-bold text-amber-400">{teamData?.stats?.total_bills || 0} บิล</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">ยอดรวมทั้งหมด</div>
            <div className="text-lg font-bold text-emerald-400">
              ฿{Number(teamData?.stats?.total_turnover || 0).toLocaleString()}
            </div>
          </div>
          <div className="flex items-center justify-end">
            {role === 'LEADER' ? (
              <button
                onClick={() => setDisbandModalOpen(true)}
                className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 rounded-xl transition-all"
              >
                ยุบห้องคีย์
              </button>
            ) : (
              <button
                onClick={handleLeaveRoom}
                className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 rounded-xl transition-all flex items-center space-x-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ออกจากห้อง</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. TAB CONTROLS (MERGED: ทีม + ตั้งค่า) */}
      {role === 'LEADER' && (
        <div className="flex bg-obsidian-900/90 p-1.5 rounded-2xl border border-slate-800">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'members'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-obsidian-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>สมาชิก & คำขอ ({pendingRequests.length > 0 ? `${pendingRequests.length} รออนุมัติ` : (teamData?.members?.length || 0)})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-obsidian-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>ตั้งค่าอัตราจ่าย & เลขอั้น</span>
          </button>
        </div>
      )}

      {/* 3. TAB 1: MEMBERS & JOIN REQUESTS */}
      {(activeTab === 'members' || role === 'MEMBER') && (
        <div className="space-y-6">
          {/* Pending Requests Section (Leader Only) */}
          {role === 'LEADER' && pendingRequests.length > 0 && (
            <div className="glass-panel rounded-3xl p-5 border border-purple-500/30 shadow-xl">
              <h3 className="text-sm font-bold text-purple-300 flex items-center space-x-2 mb-3">
                <Clock className="w-4 h-4 text-purple-400" />
                <span>คำขอเข้าร่วมห้องรอการยืนยัน ({pendingRequests.length})</span>
              </h3>
              <div className="space-y-2.5">
                {pendingRequests.map((req) => (
                  <div key={req.user_id} className="p-3 bg-obsidian-950 rounded-2xl flex items-center justify-between border border-slate-800">
                    <div>
                      <div className="text-xs font-bold text-slate-100">{req.display_name}</div>
                      <div className="text-[11px] text-slate-400">@{req.username} • {req.phone || '-'}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleApproveMember(req.user_id)}
                        className="px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-bold rounded-xl text-xs flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>อนุมัติ</span>
                      </button>
                      <button
                        onClick={() => handleRejectMember(req.user_id)}
                        className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs"
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Members List */}
          <div className="glass-panel rounded-3xl p-5 border border-amber-500/20 shadow-xl">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center space-x-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span>รายชื่อสมาชิกในห้อง ({teamData?.members?.length || 0})</span>
            </h3>

            {teamData?.members?.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                ยังไม่มีสมาชิกลูกทีมในห้อง สามารถแชร์รหัส <strong className="text-amber-400 font-mono">{teamData?.room?.code}</strong> ให้เพื่อนเข้าร่วมได้
              </div>
            ) : (
              <div className="space-y-3">
                {teamData?.members?.map((m) => {
                  const isLeader = m.role === 'LEADER';
                  return (
                    <div
                      key={m.id}
                      className="p-3.5 rounded-2xl bg-obsidian-950 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 p-[1px] shrink-0">
                          <div className="w-full h-full bg-obsidian-900 rounded-[11px] flex items-center justify-center font-bold text-xs text-amber-400">
                            {m.display_name?.charAt(0) || 'U'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 flex items-center space-x-1.5">
                            <span>{m.display_name}</span>
                            {isLeader && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[10px]">
                                หัวหน้า
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            @{m.username} • ยอดคีย์: ฿{Number(m.total_amount || 0).toLocaleString()} ({m.bill_count || 0} บิล)
                          </div>
                        </div>
                      </div>

                      {role === 'LEADER' && !isLeader && (
                        <button
                          onClick={() => handleKickMember(m.id, m.display_name)}
                          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                          title="เตะออกจากห้อง"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB 2: SETTINGS & NUMBER RULES (LEADER ONLY) */}
      {role === 'LEADER' && activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Header & Save button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <span>กำหนดอัตราจ่ายและส่วนแบ่ง (บาทละ)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                กำหนดราคาจ่ายให้ลูกค้า และ % ส่วนแบ่งลูกทีมของแต่ละประเภทหวย
              </p>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-obsidian-950 font-bold rounded-2xl shadow-lg shadow-amber-500/20 text-xs flex items-center space-x-1.5 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>{savingSettings ? 'กำลังบันทึก...' : saveSuccess ? 'บันทึกสำเร็จ!' : 'บันทึกราคา'}</span>
            </button>
          </div>

          {/* Lottery Rates Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settingsList.map((setting) => (
              <div key={setting.lottery_id} className="glass-panel rounded-3xl p-5 border border-amber-500/20 shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="font-bold text-sm text-amber-400">{setting.lottery_name}</span>
                  <label className="flex items-center space-x-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={!!setting.is_enabled}
                      onChange={(e) => handleSettingChange(setting.lottery_id, 'is_enabled', e.target.checked)}
                      className="accent-amber-500 rounded"
                    />
                    <span>เปิดรับ</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">3 ตัวบน (บาทละ)</label>
                    <input
                      type="number"
                      value={setting.rate_3top}
                      onChange={(e) => handleSettingChange(setting.lottery_id, 'rate_3top', e.target.value)}
                      className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">3 ตัวโต๊ด (บาทละ)</label>
                    <input
                      type="number"
                      value={setting.rate_3tod}
                      onChange={(e) => handleSettingChange(setting.lottery_id, 'rate_3tod', e.target.value)}
                      className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">2 ตัวบน (บาทละ)</label>
                    <input
                      type="number"
                      value={setting.rate_2top}
                      onChange={(e) => handleSettingChange(setting.lottery_id, 'rate_2top', e.target.value)}
                      className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">2 ตัวล่าง (บาทละ)</label>
                    <input
                      type="number"
                      value={setting.rate_2bottom}
                      onChange={(e) => handleSettingChange(setting.lottery_id, 'rate_2bottom', e.target.value)}
                      className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">วิ่งบน (บาทละ)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={setting.rate_run_top}
                      onChange={(e) => handleSettingChange(setting.lottery_id, 'rate_run_top', e.target.value)}
                      className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">วิ่งล่าง (บาทละ)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={setting.rate_run_bottom}
                      onChange={(e) => handleSettingChange(setting.lottery_id, 'rate_run_bottom', e.target.value)}
                      className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-amber-300 font-mono font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">ส่วนแบ่งลูกทีม (%)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={setting.commission_rate}
                      onChange={(e) => handleSettingChange(setting.lottery_id, 'commission_rate', e.target.value)}
                      className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">เพดานรับต่อเลข (฿)</label>
                    <input
                      type="number"
                      value={setting.default_limit_per_number}
                      onChange={(e) => handleSettingChange(setting.lottery_id, 'default_limit_per_number', e.target.value)}
                      className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-slate-100 font-mono font-bold outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Number Rules Section (เลขอั้น / เลขจ่ายครึ่ง) */}
          <div className="glass-panel rounded-3xl p-5 border border-amber-500/20 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-orange-400" />
                  <span>กฎเลขอั้น / เลขจ่ายครึ่ง / จำกัดยอดรับ</span>
                </h3>
                <p className="text-[11px] text-slate-400">ควบคุมความเสี่ยงของห้องแต่ละงวด</p>
              </div>

              <button
                onClick={() => setShowAddRule(true)}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มเลขอั้น</span>
              </button>
            </div>

            {/* Rules List */}
            {rules.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500">
                ยังไม่มีการตั้งกฎเลขอั้นสำหรับงวดปัจจุบัน
              </div>
            ) : (
              <div className="space-y-2">
                {rules.map((r) => (
                  <div key={r.id} className="p-3 bg-obsidian-950 rounded-2xl border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-base font-bold text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded-lg">
                        {r.number}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">
                          {r.rule_type === 'BLOCKED' ? '⛔ ไม่อนุญาตให้คีย์ (เลขอั้น)' : r.rule_type === 'HALF_PAY' ? '⚡ จ่ายครึ่งราคา' : `จำกัดยอดไม่เกิน ฿${r.custom_limit}`}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          ประเภท: {r.bet_type} • งวด: {r.period_name}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(r.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                      title="ลบกฎ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD NUMBER RULE */}
      {showAddRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-obsidian-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl animate-scale-up text-slate-100">
            <h3 className="text-base font-bold text-slate-100 mb-4">เพิ่มกฎเลขอั้น / เลขจ่ายครึ่ง</h3>
            <form onSubmit={handleAddRule} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">งวดสลาก</label>
                <select
                  value={rulePeriodId}
                  onChange={(e) => setRulePeriodId(e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-100 outline-none"
                >
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.period_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">ตัวเลข *</label>
                <input
                  type="text"
                  required
                  value={ruleNumber}
                  onChange={(e) => setRuleNumber(e.target.value)}
                  placeholder="เช่น 89, 729"
                  className="w-full bg-obsidian-950 border border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-amber-300 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">ประเภทการเล่น</label>
                  <select
                    value={ruleBetType}
                    onChange={(e) => setRuleBetType(e.target.value)}
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-xl px-2 py-2 text-slate-100 outline-none"
                  >
                    <option value="ALL">ทุกประเภท</option>
                    <option value="3TOP">3 ตัวบน</option>
                    <option value="3TOD">3 ตัวโต๊ด</option>
                    <option value="2TOP">2 ตัวบน</option>
                    <option value="2BOTTOM">2 ตัวล่าง</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">ประเภทกฎ</label>
                  <select
                    value={ruleType}
                    onChange={(e) => setRuleType(e.target.value)}
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-xl px-2 py-2 text-slate-100 outline-none"
                  >
                    <option value="BLOCKED">เลขอั้น (ไม่รับ)</option>
                    <option value="HALF_PAY">เลขจ่ายครึ่ง</option>
                    <option value="CUSTOM_LIMIT">จำกัดยอดรับ</option>
                  </select>
                </div>
              </div>

              {ruleType === 'CUSTOM_LIMIT' && (
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">เพดานยอดรับรวม (฿)</label>
                  <input
                    type="number"
                    value={ruleLimit}
                    onChange={(e) => setRuleLimit(e.target.value)}
                    placeholder="เช่น 1000"
                    className="w-full bg-obsidian-950 border border-slate-700 rounded-xl px-3 py-2 font-mono outline-none"
                  />
                </div>
              )}

              <div>
                <label className="text-slate-300 block mb-1 font-medium">หมายเหตุ</label>
                <input
                  type="text"
                  value={ruleNote}
                  onChange={(e) => setRuleNote(e.target.value)}
                  placeholder="เช่น เลขดังแม่น้ำหนึ่ง"
                  className="w-full bg-obsidian-950 border border-slate-700 rounded-xl px-3 py-2 outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddRule(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-obsidian-950 font-bold rounded-xl"
                >
                  บันทึกกฎ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISBAND ROOM CONFIRMATION MODAL */}
      {disbandModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-obsidian-900 border border-rose-500/40 rounded-3xl p-6 shadow-2xl text-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-center text-slate-100">ยืนยันการยุบห้องคีย์?</h3>
            <p className="text-xs text-slate-400 text-center mt-1 leading-relaxed">
              การยุบห้องจะปลดสมาชิกทุกคนออกจากห้อง และห้องนี้จะไม่สามารถใช้งานได้อีก
            </p>
            <div className="flex items-center space-x-2 mt-6">
              <button
                onClick={() => setDisbandModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:bg-obsidian-800"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDisbandRoom}
                disabled={disbanding}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30"
              >
                {disbanding ? 'กำลังยุบห้อง...' : 'ยืนยันยุบห้อง'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
