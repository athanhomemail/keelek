import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  Keyboard, LogIn, UserPlus, Eye, EyeOff, Shield, Crown, UserCheck, 
  User, CheckCircle2, AlertCircle, Building2, CreditCard, Mail, Phone, Lock
} from 'lucide-react';

const THAI_BANKS = [
  'กสิกรไทย (KBANK)',
  'ไทยพาณิชย์ (SCB)',
  'กรุงเทพ (BBL)',
  'กรุงไทย (KTB)',
  'ทหารไทยธนชาต (TTB)',
  'กรุงศรีอยุธยา (BAY)',
  'ออมสิน (GSB)',
  'ธ.ก.ส. (BAAC)'
];

export default function AuthPage() {
  const { login, register, switchUser, simulatorUsers } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form State
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regBankName, setRegBankName] = useState(THAI_BANKS[0]);
  const [regAccountNo, setRegAccountNo] = useState('');
  const [regPromptpay, setRegPromptpay] = useState('');

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const res = await login(loginUsername.trim(), loginPassword);
    setLoading(false);

    if (!res.success) {
      setError(res.message);
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (regPassword !== regConfirmPassword) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    if (regPassword.length < 4) {
      setError('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    setLoading(true);
    const res = await register({
      username: regUsername.trim(),
      password: regPassword,
      displayName: regDisplayName.trim(),
      email: regEmail.trim() || null,
      phone: regPhone.trim() || null,
      bankName: regBankName,
      accountNo: regAccountNo.trim() || null,
      promptpay: regPromptpay.trim() || null
    });
    setLoading(false);

    if (!res.success) {
      setError(res.message);
    }
  };

  // Quick Demo Login
  const handleQuickLogin = (u) => {
    setLoginUsername(u.username);
    setLoginPassword('123456');
    switchUser(u.id);
  };

  return (
    <div className="min-h-screen bg-obsidian-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden selection:bg-amber-500 selection:text-obsidian-950 font-sans text-slate-100">
      
      {/* Background Decorative Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-400 p-[1px] shadow-xl shadow-amber-500/20 mb-4">
            <div className="w-full h-full bg-obsidian-950 rounded-[23px] flex items-center justify-center">
              <Keyboard className="w-8 h-8 text-amber-400" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            <span className="gold-gradient-text">Kee-Lek</span>{' '}
            <span className="text-slate-100 text-2xl font-bold">(คีย์เลข)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">
            ระบบจัดการและคีย์หวยออนไลน์มาตรฐาน ปลอดภัย รวดเร็ว
          </p>
        </div>

        {/* Auth Card Container */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-amber-500/20">
          
          {/* Tabs: Login / Register */}
          <div className="flex bg-obsidian-900/90 p-1.5 rounded-2xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(null); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
                tab === 'login'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-obsidian-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ</span>
            </button>

            <button
              type="button"
              onClick={() => { setTab('register'); setError(null); }}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center space-x-2 transition-all ${
                tab === 'register'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-obsidian-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>สมัครสมาชิก</span>
            </button>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start space-x-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* ================= TAB 1: LOGIN ================= */}
          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  ชื่อผู้ใช้ (Username)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="กรอกชื่อผู้ใช้ เช่น admin, leader1"
                    className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl pl-10 pr-3.5 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  รหัสผ่าน (Password)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่าน (ค่าเริ่มต้น: 123456)"
                    className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl pl-10 pr-10 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !loginUsername || !loginPassword}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:opacity-95 disabled:opacity-50 text-obsidian-950 font-bold rounded-xl shadow-lg shadow-amber-500/25 text-sm transition-all flex items-center justify-center space-x-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
              </button>

              {/* Quick Demo Logins Section */}
              <div className="pt-5 mt-5 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-semibold text-slate-400">
                    ⚡ เลือกล็อกอินบัญชีทดสอบด่วน:
                  </span>
                  <span className="text-[10px] text-amber-500/80 font-mono">รหัสผ่าน: 123456</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Admin */}
                  <button
                    type="button"
                    onClick={() => handleQuickLogin({ id: 1, username: 'admin' })}
                    className="p-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-purple-300">
                      <Crown className="w-3.5 h-3.5 text-purple-400" />
                      <span>Admin</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">ผู้ดูแลระบบ</p>
                  </button>

                  {/* Leader */}
                  <button
                    type="button"
                    onClick={() => handleQuickLogin({ id: 2, username: 'leader1' })}
                    className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-300">
                      <Shield className="w-3.5 h-3.5 text-amber-400" />
                      <span>หัวหน้า</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">เฮียเก้า (เจ้ามือ)</p>
                  </button>

                  {/* Member 1 */}
                  <button
                    type="button"
                    onClick={() => handleQuickLogin({ id: 3, username: 'member1' })}
                    className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-300">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>สมาชิก 1</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">น้องแนน (ลูกทีม)</p>
                  </button>

                  {/* Member 2 */}
                  <button
                    type="button"
                    onClick={() => handleQuickLogin({ id: 4, username: 'member2' })}
                    className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-left transition-all group"
                  >
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-300">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>สมาชิก 2</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">พี่ท็อป (ลูกทีม)</p>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ================= TAB 2: REGISTER ================= */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ชื่อผู้ใช้ (Username) *
                </label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="เช่น somchai88 (ภาษาอังกฤษหรือตัวเลข)"
                  className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                />
              </div>

              {/* Password & Confirm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    รหัสผ่าน *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="อย่างน้อย 4 ตัวอักษร"
                    className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    ยืนยันรหัสผ่าน *
                  </label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านซ้ำอีกครั้ง"
                    className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ชื่อที่จะเอาไว้แสดง *
                </label>
                <input
                  type="text"
                  required
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="เช่น พี่สมชาย พารวย, เสี่ยบอย"
                  className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                />
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    อีเมล (Email)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    เบอร์โทร (ไม่บังคับ / ไม่ส่ง OTP)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="08X-XXX-XXXX"
                      className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Bank & Account No */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    เลือกธนาคาร
                  </label>
                  <select
                    value={regBankName}
                    onChange={(e) => setRegBankName(e.target.value)}
                    className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none"
                  >
                    {THAI_BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    เลขที่บัญชี
                  </label>
                  <input
                    type="text"
                    value={regAccountNo}
                    onChange={(e) => setRegAccountNo(e.target.value)}
                    placeholder="เช่น 123-4-56789-0"
                    className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              {/* PromptPay */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  พร้อมเพย์ (ถ้ามี)
                </label>
                <input
                  type="text"
                  value={regPromptpay}
                  onChange={(e) => setRegPromptpay(e.target.value)}
                  placeholder="เบอร์โทรหรือเลขบัตรประชาชนสำหรับพร้อมเพย์"
                  className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !regUsername || !regPassword || !regDisplayName}
                className="w-full py-3.5 mt-4 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 hover:opacity-95 disabled:opacity-50 text-obsidian-950 font-bold rounded-xl shadow-lg shadow-amber-500/25 text-sm transition-all flex items-center justify-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{loading ? 'กำลังลงทะเบียน...' : 'ยืนยันการสมัครสมาชิก'}</span>
              </button>
            </form>
          )}

        </div>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          ระบบคีย์เลข Kee-Lek © 2026 • ระบบจัดการหวยออนไลน์มาตรฐาน
        </p>

      </div>
    </div>
  );
}
