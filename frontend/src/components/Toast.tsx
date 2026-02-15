import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type ToastListener = (toast: ToastMessage) => void;

const listeners: Set<ToastListener> = new Set();
let idCounter = 0;

/** Call from anywhere to show a toast */
export function toast(message: string, type: ToastType = 'info', duration?: number) {
  const t: ToastMessage = {
    id: `toast-${++idCounter}-${Date.now()}`,
    type,
    message,
    duration: duration ?? (type === 'error' ? 5000 : 3000),
  };
  listeners.forEach(fn => fn(t));
}

export function useToastListener(cb: ToastListener) {
  useEffect(() => {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, [cb]);
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <AlertCircle size={18} />,
  info: <Info size={18} />,
  warning: <AlertTriangle size={18} />,
};

const Toast: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast: t, onDismiss }) => {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(t.id), 300);
    }, t.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [t, onDismiss]);

  return (
    <div className={`toast-item toast-${t.type} ${exiting ? 'toast-exit' : 'toast-enter'}`}>
      <span className="toast-icon">{iconMap[t.type]}</span>
      <span className="toast-message">{t.message}</span>
      <button className="toast-close" onClick={() => { setExiting(true); setTimeout(() => onDismiss(t.id), 300); }}>
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;
