import React from 'react';

interface LoadingSpinnerProps {
  /** Optional message below the spinner */
  message?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Inline mode (no centering wrapper) */
  inline?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message, size = 'medium', inline = false }) => {
  const spinner = (
    <div className={`loading-spinner-container ${inline ? 'loading-spinner-inline' : ''}`}>
      <div className={`loading-spinner-circle loading-spinner-${size}`} role="status" aria-label="Loading">
        <svg viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
        </svg>
      </div>
      {message && <p className="loading-spinner-message">{message}</p>}
    </div>
  );

  return spinner;
};

export default LoadingSpinner;
