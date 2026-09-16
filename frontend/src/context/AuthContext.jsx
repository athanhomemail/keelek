import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('keelek_token') || '');
  const [simulatorUsers, setSimulatorUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Set default axios headers
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }

  // Load simulator users
  const fetchSimulatorUsers = async () => {
    try {
      const res = await axios.get('/api/auth/simulator-users');
      if (res.data.success) {
        setSimulatorUsers(res.data.users);
      }
    } catch (err) {
      console.error('Failed to fetch simulator users:', err);
    }
  };

  // Load user profile
  const fetchProfile = async () => {
    try {
      const res = await axios.get('/api/auth/profile');
      if (res.data.success) {
        setUser(res.data.user);
      }
    } catch (err) {
      console.warn('Session expired or not logged in');
      setUser(null);
      setToken('');
      localStorage.removeItem('keelek_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSimulatorUsers();
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  // Standard Login with username & password
  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('keelek_token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        return { success: true, user: res.data.user };
      }
      return { success: false, message: res.data.message || 'เข้าสู่ระบบไม่สำเร็จ' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ'
      };
    } finally {
      setLoading(false);
    }
  };

  // Standard Register
  const register = async (userData) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/register', userData);
      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('keelek_token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        fetchSimulatorUsers();
        return { success: true, user: res.data.user };
      }
      return { success: false, message: res.data.message || 'สมัครสมาชิกไม่สำเร็จ' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || 'เกิดข้อผิดพลาดในการลงทะเบียน'
      };
    } finally {
      setLoading(false);
    }
  };

  // Quick switch user for demo/simulator
  const switchUser = async (userId) => {
    setLoading(true);
    try {
      const res = await axios.post('/api/auth/login', { userId });
      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('keelek_token', res.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
      }
    } catch (err) {
      console.error('Failed to switch user:', err);
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = () => {
    setUser(null);
    setToken('');
    localStorage.removeItem('keelek_token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'GUEST',
        token,
        loading,
        simulatorUsers,
        login,
        register,
        switchUser,
        refreshProfile: fetchProfile,
        fetchSimulatorUsers,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
