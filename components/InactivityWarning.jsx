import React from 'react';
import { useAuth } from '../src/contexts/AuthContext';  // ✅ Fixed path

export const InactivityWarning = () => {
  const { timeUntilLogout, resetInactivityTimer } = useAuth();

  const handleStayLoggedIn = () => {
    localStorage.setItem('lastActivityTime', Date.now().toString());
    resetInactivityTimer();
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: '#ff4444',
      color: 'white',
      padding: '20px',
      borderRadius: '8px',
      zIndex: 9999,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      maxWidth: '300px',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <h4 style={{ margin: '0 0 10px 0', color: 'white' }}>
        ⚠️ Session Expiring Soon
      </h4>
      <p style={{ margin: '0 0 15px 0', fontSize: '14px' }}>
        You will be logged out in <strong>{timeUntilLogout} seconds</strong> due to inactivity.
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={handleStayLoggedIn}
          style={{
            flex: 1,
            padding: '10px',
            backgroundColor: 'white',
            color: '#ff4444',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'transform 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          Stay Logged In
        </button>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '10px',
            backgroundColor: 'transparent',
            color: 'white',
            border: '1px solid white',
            borderRadius: '4px',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          Refresh
        </button>
      </div>
    </div>
  );
};