import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useModal } from '../context/ModalContext.jsx';
import { 
  Keyboard, LogIn, UserPlus, Eye, EyeOff,
  User, CheckCircle2, AlertCircle, Building2, CreditCard, Mail, Phone, Lock
} from 'lucide-react';

const ACCOUNT_OPTIONS = [
  'พร้อมเพย์',
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
  const { login, register } = useAuth();
  const { showAlert } = useModal();
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
  const [regRealName, setRegRealName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAccountType, setRegAccountType] = useState(ACCOUNT_OPTIONS[0]); // default 'พร้อมเพย์'
  const [regAccountNumber, setRegAccountNumber] = useState('');

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!loginUsername.trim()) {
      const msg = 'กรุณากรอกชื่อผู้ใช้ (Username)';
      setError(msg);
      showAlert({
        type: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        message: msg,
        confirmText: 'ตกลง'
      });
      return;
    }

    if (!loginPassword) {
      const msg = 'กรุณากรอกรหัสผ่าน (Password)';
      setError(msg);
      showAlert({
        type: 'warning',
        title: 'ข้อมูลไม่ครบถ้วน',
        message: msg,
        confirmText: 'ตกลง'
      });
      return;
    }

    setLoading(true);
    const res = await login(loginUsername.trim(), loginPassword);
    setLoading(false);

    if (!res.success) {
      const errorMsg = res.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง';
      setError(errorMsg);
      setLoginPassword(''); // เคลียร์รหัสผ่านให้กรอกใหม่
      showAlert({
        type: 'error',
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        message: errorMsg,
        subtitle: 'กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน แล้วลองใหม่อีกครั้ง',
        confirmText: 'ลองใหม่อีกครั้ง'
      });
    }
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!regUsername.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้ (Username)');
      return;
    }

    if (!regPassword) {
      setError('กรุณากรอกรหัสผ่าน');
      return;
    }

    if (regPassword.length < 4) {
      setError('รหัสผ่านต้องมีความยาวอย่างน้อย 4 ตัวอักษร');
      return;
    }

    if (!regConfirmPassword) {
      setError('กรุณายืนยันรหัสผ่าน');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    if (!regDisplayName.trim()) {
      setError('กรุณากรอกชื่อที่จะเอาไว้แสดง');
      return;
    }

    if (!regAccountNumber.trim()) {
      setError(`กรุณากรอก${regAccountType === 'พร้อมเพย์' ? 'พร้อมเพย์' : 'เลขที่บัญชี'}`);
      return;
    }

    if (!regRealName.trim()) {
      setError(`กรุณากรอกชื่อ-นามสกุล${regAccountType === 'พร้อมเพย์' ? ' (ผู้รับพร้อมเพย์)' : ' (เจ้าของบัญชี)'}`);
      return;
    }

    setLoading(true);
    const isPromptPay = regAccountType === 'พร้อมเพย์';
    const res = await register({
      username: regUsername.trim(),
      password: regPassword,
      displayName: regDisplayName.trim(),
      realName: regRealName.trim(),
      email: regEmail.trim() || null,
      phone: regPhone.trim() || null,
      bankName: isPromptPay ? 'พร้อมเพย์' : regAccountType,
      accountNo: regAccountNumber.trim(),
      promptpay: isPromptPay ? regAccountNumber.trim() : null
    });
    setLoading(false);

    if (!res.success) {
      setError(res.message);
    }
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
            <div className="mb-5 p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-red-200 text-sm flex items-start space-x-3 animate-shake shadow-lg shadow-red-500/10">
              <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-red-300 text-xs">เข้าสู่ระบบไม่สำเร็จ</div>
                <div className="text-xs text-red-200/90 mt-0.5 leading-relaxed">{error}</div>
              </div>
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
                    onChange={(e) => {
                      setLoginUsername(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="กรอกชื่อผู้ใช้"
                    className={`w-full bg-obsidian-950 border ${
                      error ? 'border-red-500/70 focus:border-red-400' : 'border-slate-700/80 focus:border-amber-400'
                    } rounded-xl pl-10 pr-3.5 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors`}
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
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder="กรอกรหัสผ่าน"
                    className={`w-full bg-obsidian-950 border ${
                      error ? 'border-red-500/70 focus:border-red-400' : 'border-slate-700/80 focus:border-amber-400'
                    } rounded-xl pl-10 pr-10 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition-colors`}
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
            </form>
          )}

          {/* ================= TAB 2: REGISTER ================= */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Username */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ชื่อผู้ใช้ (Username) <span className="text-red-500 font-bold ml-0.5">*</span>
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
                    รหัสผ่าน <span className="text-red-500 font-bold ml-0.5">*</span>
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
                    ยืนยันรหัสผ่าน <span className="text-red-500 font-bold ml-0.5">*</span>
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
                  ชื่อที่จะเอาไว้แสดง <span className="text-red-500 font-bold ml-0.5">*</span>
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

              {/* Email & Phone (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    อีเมล (ถ้ามี)
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
                    เบอร์โทร (ถ้ามี)
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

              {/* Account Selection & Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    เลือกบัญชี <span className="text-red-500 font-bold ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <select
                      value={regAccountType}
                      onChange={(e) => setRegAccountType(e.target.value)}
                      className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 outline-none"
                    >
                      {ACCOUNT_OPTIONS.map((item) => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {regAccountType === 'พร้อมเพย์' ? 'พร้อมเพย์' : 'เลขที่บัญชี'}{' '}
                    <span className="text-red-500 font-bold ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      required
                      value={regAccountNumber}
                      onChange={(e) => setRegAccountNumber(e.target.value)}
                      placeholder={
                        regAccountType === 'พร้อมเพย์'
                          ? 'เบอร์โทร หรือ เลขบัตรประชาชน'
                          : 'เช่น 123-4-56789-0'
                      }
                      className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Account Owner Real Name (ชื่อ-นามสกุลเจ้าของบัญชี / พร้อมเพย์) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {regAccountType === 'พร้อมเพย์' ? 'ชื่อ-นามสกุล (ผู้รับพร้อมเพย์)' : 'ชื่อ-นามสกุล (เจ้าของบัญชี)'}{' '}
                  <span className="text-red-500 font-bold ml-0.5">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    required
                    value={regRealName}
                    onChange={(e) => setRegRealName(e.target.value)}
                    placeholder={
                      regAccountType === 'พร้อมเพย์'
                        ? 'เช่น นายสมชาย ใจดี (ชื่อที่ผูกกับพร้อมเพย์)'
                        : 'เช่น นายสมชาย ใจดี (ชื่อตามสมุดบัญชี)'
                    }
                    className="w-full bg-obsidian-950 border border-slate-700/80 focus:border-amber-400 rounded-xl pl-9 pr-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 outline-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  * จะแสดงในสลิปแคปส่งลูกค้า เพื่อให้ลูกค้าตรวจสอบชื่อก่อนโอนเงิน
                </p>
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  !regUsername.trim() ||
                  !regPassword ||
                  !regConfirmPassword ||
                  !regDisplayName.trim() ||
                  !regAccountNumber.trim() ||
                  !regRealName.trim()
                }
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
