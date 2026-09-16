import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import SystemModal from '../components/SystemModal.jsx';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'info', // 'info' | 'success' | 'warning' | 'error' | 'danger'
    title: '',
    message: '',
    subtitle: '',
    confirmText: 'ตกลง',
    cancelText: 'ยกเลิก',
    isConfirm: false,
    resolve: null,
  });

  const closeModal = useCallback((result = false) => {
    setModalState((prev) => {
      if (prev.resolve) {
        prev.resolve(result);
      }
      return { ...prev, isOpen: false, resolve: null };
    });
  }, []);

  const showAlert = useCallback((messageOrOptions, extraOptions = {}) => {
    return new Promise((resolve) => {
      let opts = {};
      if (typeof messageOrOptions === 'string') {
        opts = { message: messageOrOptions, ...extraOptions };
      } else if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
        opts = { ...messageOrOptions };
      }

      const type = opts.type || 'info';
      let defaultTitle = 'แจ้งเตือนระบบ';
      if (type === 'success') defaultTitle = 'ทำรายการสำเร็จ';
      if (type === 'error' || type === 'danger') defaultTitle = 'เกิดข้อผิดพลาด';
      if (type === 'warning') defaultTitle = 'ข้อความแจ้งเตือน';

      setModalState({
        isOpen: true,
        type,
        title: opts.title || defaultTitle,
        message: opts.message || '',
        subtitle: opts.subtitle || '',
        confirmText: opts.confirmText || 'ตกลง',
        cancelText: '',
        isConfirm: false,
        resolve,
      });
    });
  }, []);

  const showConfirm = useCallback((messageOrOptions, extraOptions = {}) => {
    return new Promise((resolve) => {
      let opts = {};
      if (typeof messageOrOptions === 'string') {
        opts = { message: messageOrOptions, ...extraOptions };
      } else if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
        opts = { ...messageOrOptions };
      }

      const type = opts.type || 'warning';
      let defaultTitle = 'ยืนยันการทำรายการ';
      if (type === 'danger') defaultTitle = 'คำเตือน / ยืนยันการลบ';

      setModalState({
        isOpen: true,
        type,
        title: opts.title || defaultTitle,
        message: opts.message || '',
        subtitle: opts.subtitle || '',
        confirmText: opts.confirmText || 'ยืนยัน',
        cancelText: opts.cancelText || 'ยกเลิก',
        isConfirm: true,
        resolve,
      });
    });
  }, []);

  // Intercept window.alert and window.confirm to automatically route through system modal
  useEffect(() => {
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    window.alert = (msg) => {
      showAlert(String(msg || ''));
    };

    window.confirm = (msg) => {
      console.warn('⚠️ Native window.confirm() intercepted. Please use useModal().showConfirm() instead.');
      showConfirm(String(msg || ''));
      return false; // prevent synchronous blocking
    };

    window.showAlert = showAlert;
    window.showConfirm = showConfirm;

    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
      delete window.showAlert;
      delete window.showConfirm;
    };
  }, [showAlert, showConfirm]);

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, closeModal }}>
      {children}
      <SystemModal
        isOpen={modalState.isOpen}
        type={modalState.type}
        title={modalState.title}
        message={modalState.message}
        subtitle={modalState.subtitle}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        isConfirm={modalState.isConfirm}
        onConfirm={() => closeModal(true)}
        onCancel={() => closeModal(false)}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
