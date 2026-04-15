// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { auth, db } from '../firebase';
import { ref, get } from 'firebase/database';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

const INACTIVITY_LIMIT = 60 * 60 * 1000; // 1 hour
const WARNING_BEFORE = 60 * 1000; // 1 minute

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [timeUntilLogout, setTimeUntilLogout] = useState(60);
  
  const inactivityTimeoutRef = useRef(null);

  const handleLogout = useCallback(async () => {
    try {
      // Clear all timers
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current.timeout);
        clearInterval(inactivityTimeoutRef.current.interval);
        clearTimeout(inactivityTimeoutRef.current.logoutTimeout);
      }
      
      await auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      
      // Update state
      setUser(null);
      setUserRole(null);
      
      // Don't show alert if already on login page
      if (!window.location.pathname.includes('/login')) {
        alert('You have been logged out due to inactivity.');
      }
      
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  }, [navigate]);

  const resetInactivityTimer = useCallback(() => {
    if (!user) return;

    if (showInactivityWarning) {
      setShowInactivityWarning(false);
    }
    
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current.timeout);
      clearInterval(inactivityTimeoutRef.current.interval);
      clearTimeout(inactivityTimeoutRef.current.logoutTimeout);
    }
    
    const timeUntilWarning = INACTIVITY_LIMIT - WARNING_BEFORE;
    
    const warningTimeout = setTimeout(() => {
      setShowInactivityWarning(true);
      
      let countdown = 60;
      setTimeUntilLogout(countdown);
      
      const countdownInterval = setInterval(() => {
        countdown -= 1;
        setTimeUntilLogout(countdown);
        
        if (countdown <= 0) {
          clearInterval(countdownInterval);
          handleLogout();
        }
      }, 1000);
      
      const logoutTimeout = setTimeout(() => {
        handleLogout();
      }, 60000);
      
      inactivityTimeoutRef.current = {
        timeout: warningTimeout,
        interval: countdownInterval,
        logoutTimeout: logoutTimeout
      };
      
    }, timeUntilWarning);
    
    inactivityTimeoutRef.current = { timeout: warningTimeout };
  }, [user, handleLogout, showInactivityWarning]);

  const handleUserActivity = useCallback(() => {
    if (user) {
      resetInactivityTimer();
      localStorage.setItem('lastActivityTime', Date.now().toString());
    }
  }, [user, resetInactivityTimer]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const snapshot = await get(ref(db, `users/${currentUser.uid}/role`));
          if (snapshot.exists()) {
            setUserRole(snapshot.val());
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
        }
      } else {
        setUserRole(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Activity listeners
  useEffect(() => {
    if (!user) return;

    const activityEvents = [
      'mousedown', 'mousemove', 'keydown', 'scroll', 
      'touchstart', 'click', 'wheel'
    ];

    activityEvents.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    resetInactivityTimer();

    // Check for inactivity on mount
    const lastActivity = localStorage.getItem('lastActivityTime');
    if (lastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
      if (timeSinceLastActivity > INACTIVITY_LIMIT) {
        handleLogout();
      }
    }

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      
      if (inactivityTimeoutRef.current) {
        clearTimeout(inactivityTimeoutRef.current.timeout);
        clearInterval(inactivityTimeoutRef.current.interval);
        clearTimeout(inactivityTimeoutRef.current.logoutTimeout);
      }
    };
  }, [user, handleUserActivity, resetInactivityTimer, handleLogout]);

  const value = {
    user,
    userRole,
    loading,
    logout: handleLogout,
    showInactivityWarning,
    timeUntilLogout,
    resetInactivityTimer,
    // Add these setter functions
    setUser,
    setUserRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};