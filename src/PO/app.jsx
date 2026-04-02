import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "src/PO-CSS/app.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import lgrcLogo from "src/assets/lgrc.png";
import { auth } from "src/firebase";
import { getDatabase, ref, get, set, update } from "firebase/database";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import emailjs from '@emailjs/browser';
import { useAuth } from "../contexts/AuthContext";

export default function App() {
  const db = getDatabase();
  const navigate = useNavigate();
  const { setUser, setUserRole } = useAuth();

  // Login form state
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Registration modal state
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Verification modal state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingUser, setPendingUser] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [isGoogleEnabled, setIsGoogleEnabled] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  // Password prompt modal state
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);

  // Initialize EmailJS
  useEffect(() => {
    emailjs.init(import.meta.env.VITE_EMAILJS_PUBLIC_KEY || "-cqtWESQUREXRPXNe");
  }, []);

  // Check if email exists in database
  useEffect(() => {
    const checkEmailInDatabase = async () => {
      if (!userId || userId.trim() === "") {
        setIsGoogleEnabled(false);
        return;
      }

      setIsCheckingEmail(true);
      
      try {
        const usersRef = ref(db, 'users');
        const snapshot = await get(usersRef);
        
        if (snapshot.exists()) {
          const users = snapshot.val();
          const emailExists = Object.values(users).some(user => 
            user.email && user.email.toLowerCase() === userId.toLowerCase()
          );
          setIsGoogleEnabled(emailExists);
        } else {
          setIsGoogleEnabled(false);
        }
      } catch (error) {
        console.error("Error checking email:", error);
        setIsGoogleEnabled(false);
      } finally {
        setIsCheckingEmail(false);
      }
    };

    const timeoutId = setTimeout(checkEmailInDatabase, 500);
    return () => clearTimeout(timeoutId);
  }, [userId, db]);

  // Cooldown timer for resending verification
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Generate a random 6-digit verification code
  const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

 const sendVerificationEmail = async (email, code) => {
  try {
    console.log("Sending verification code:", code, "to:", email);
    
    if (!email) {
      console.error("Email is empty!");
      return false;
    }
    
    // IMPORTANT: Only include variables that exist in your template
    const templateParams = {
      to_email: email,
      to_name: email.split('@')[0],
      passcode: code
    };

    const response = await emailjs.send(
      import.meta.env.VITE_EMAILJS_SERVICE_ID,
      import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
      templateParams
    );
  
    console.log("EmailJS response:", response);
    
    if (response.status === 200) {
      console.log(`✅ Verification code sent to ${email}`);
      return true;
    } else {
      console.error("EmailJS error:", response);
      return false;
    }
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    console.error("Error details:", error);
    return false;
  }
};

  const handleRegister = async (email, password) => {
    if (!email || !password) {
      alert("Please enter all registration fields");
      return;
    }

    try {
      console.log("Attempting to register:", email);
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("User created in Auth:", user.uid);

      const code = generateVerificationCode();
      const expiresAt = Date.now() + 15 * 60 * 1000;

      await set(ref(db, `users/${user.uid}`), {
        email: email,
        role: "user",
        createdAt: new Date().toISOString(),
        verified: false,
        verificationCode: code,
        codeExpiresAt: expiresAt,
        lastVerificationSent: Date.now()
      });
      console.log("User data saved to database");

      const emailSent = await sendVerificationEmail(email, code);
      
      if (!emailSent) {
        alert("Registration successful but email sending failed. Please contact support.");
        return;
      }

      setPendingUser({ uid: user.uid, email });
      setShowRegisterModal(false);
      setShowVerifyModal(true);
      setCooldown(30);

      alert("Registration successful! Please check your email for the verification code.");

    } catch (error) {
      console.error("Registration error:", error);

      if (error.code === "auth/email-already-in-use") {
        alert("Registration Failed: Email already registered.");
      } else if (error.code === "auth/invalid-email") {
        alert("Invalid Email");
      } else if (error.code === "auth/weak-password") {
        alert("Weak Password - Password should be at least 6 characters");
      } else {
        alert("Registration Failed: " + error.message);
      }
    }
  };

  const handleVerifyCode = async () => {
    if (!pendingUser) return;

    try {
      const userRef = ref(db, `users/${pendingUser.uid}`);
      const snapshot = await get(userRef);
      
      if (!snapshot.exists()) {
        alert("User data not found.");
        return;
      }

      const userData = snapshot.val();
      
      if (Date.now() > userData.codeExpiresAt) {
        alert("Verification code has expired. Please request a new one.");
        return;
      }

      if (verificationCode === userData.verificationCode) {
        await update(userRef, {
          verified: true,
          verifiedAt: Date.now(),
          verificationCode: null,
          codeExpiresAt: null
        });

        alert("Email verified successfully! Please enter your password to complete login.");
        
        // Show custom password prompt instead of browser prompt
        setShowPasswordPrompt(true);
        
        // Store userData role for later use
        setPendingUser({ ...pendingUser, role: userData.role });
        
      } else {
        alert("Invalid verification code. Please try again.");
      }
    } catch (error) {
      console.error("Verification error:", error);
      alert("Verification failed. Please try again.");
    }
  };

  // Handle password submission from custom modal
  const handlePasswordSubmit = async () => {
    if (!tempPassword) {
      alert("Please enter your password");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, pendingUser.email, tempPassword);
      
      // Update AuthContext
      setUser(userCredential.user);
      setUserRole(pendingUser.role);
      
      // Clear the password prompt
      setShowPasswordPrompt(false);
      setTempPassword("");
      
      const role = pendingUser.role;
      if (role === 'admin') {
        navigate('/dashboard', { replace: true });
      } else if (role === 'sub-admin') {
        navigate('/mlgo-dashboard', { replace: true });
      } else if (role === 'user') {
        navigate('/lgu-assessment', { replace: true });
      } else {
        alert('No access assigned');
      }
    } catch (loginError) {
      console.error("Auto-login failed:", loginError);
      alert("Login failed. Please try again.");
      setTempPassword("");
    }
  };

  const handleResendCode = async () => {
    if (!pendingUser || cooldown > 0) return;

    try {
      const newCode = generateVerificationCode();
      const expiresAt = Date.now() + 1 * 60 * 1000;

      await update(ref(db, `users/${pendingUser.uid}`), {
        verificationCode: newCode,
        codeExpiresAt: expiresAt,
        lastVerificationSent: Date.now()
      });

      await sendVerificationEmail(pendingUser.email, newCode);
      setCooldown(30);
      
    } catch (error) {
      console.error("Error resending code:", error);
      alert("Failed to resend code. Please try again.");
    }
  };

  async function handleLogin(email, password) {
    // Prevent multiple login attempts
    if (isLoggingIn) {
      console.log("Login already in progress, skipping...");
      return;
    }
    
    // Clear any previous errors
    setLoginError("");
    
    // Basic validation
    if (!email || !password) {
      setLoginError("Please enter both email and password");
      alert("Please enter both email and password");
      return;
    }

    console.log("=== LOGIN ATTEMPT START ===");
    console.log("Email:", email);
    console.log("Timestamp:", new Date().toISOString());
    
    setIsLoggingIn(true);
    
    try {
      // Step 1: Check if user exists in database
      console.log("Step 1: Checking database for user...");
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      
      if (!snapshot.exists()) {
        console.log("No users found in database");
        setLoginError("No users found in the system.");
        alert("No users found in the system.");
        setIsLoggingIn(false);
        return;
      }

      console.log("Database snapshot received");
      
      let userUid = null;
      let userData = null;
      
      const users = snapshot.val();
      console.log("Total users in database:", Object.keys(users).length);
      
      for (const [uid, data] of Object.entries(users)) {
        if (data.email && data.email.toLowerCase() === email.toLowerCase()) {
          userUid = uid;
          userData = data;
          console.log("Found user in database:", uid);
          console.log("User data:", { 
            email: data.email, 
            role: data.role, 
            verified: data.verified 
          });
          break;
        }
      }
  
      if (!userData) {
        console.log("No user found with email:", email);
        setLoginError("No account found with this email.");
        alert("No account found with this email.");
        setIsLoggingIn(false);
        return;
      }
  
// Step 2: Check verification status
console.log("Step 2: Checking verification status");
if (!userData.verified) {
  console.log("User not verified");
  setLoginError("Please verify your email first.");
  alert("Please verify your email first.");
  
  const shouldResend = window.confirm("Would you like us to send the verification code?");
  if (shouldResend) {
    console.log("Resending verification code...");
    const newCode = generateVerificationCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // Fixed: 15 minutes for verification code
    
    await update(ref(db, `users/${userUid}`), {
      verificationCode: newCode,
      codeExpiresAt: expiresAt,
      lastVerificationSent: Date.now()
    });
    
    await sendVerificationEmail(email, newCode);
    
    setPendingUser({ uid: userUid, email });
    setShowVerifyModal(true);
    
    alert("A new verification code has been sent to your email.");
  }
  setIsLoggingIn(false);
  return;
}

// Step 2.5: Check if verification is still valid (within 1 minute)
console.log("Step 2.5: Checking verification timestamp");
const oneMinuteAgo = Date.now() - 15 * 60 * 1000;  // 15 minute in milliseconds

if (!userData.verifiedAt || userData.verifiedAt < oneMinuteAgo) {
  console.log("Verification expired - needs OTP again");
  setLoginError("Your verification has expired. Please verify again.");
  
  // Set them as unverified in the database
  await update(ref(db, `users/${userUid}`), {
    verified: false,
    verifiedAt: null
  });
  
  // Generate and send new OTP
  const newCode = generateVerificationCode();
  const expiresAt = Date.now() + 15 * 60 * 1000;
  
  await update(ref(db, `users/${userUid}`), {
    verificationCode: newCode,
    codeExpiresAt: expiresAt,
    lastVerificationSent: Date.now()
  });
  
  await sendVerificationEmail(email, newCode);
  
  setPendingUser({ uid: userUid, email });
  setShowVerifyModal(true);
  
  alert("Your verification has expired. A new verification code has been sent to your email.");
  setIsLoggingIn(false);
  return;
}
  
      // Step 3: Attempt Firebase sign-in
      console.log("Step 3: Attempting Firebase authentication...");
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log("Firebase authentication successful");
      console.log("User UID from Firebase:", userCredential.user.uid);
  
      // Step 4: Update AuthContext with user data
      console.log("Step 4: Updating AuthContext...");
      setUser(userCredential.user);
      setUserRole(userData.role);
      
      // Step 5: Navigate based on role
      console.log("Step 5: Navigating based on role:", userData.role);
      const role = userData.role;
      
      console.log("=== LOGIN SUCCESSFUL ===");
      
      // Use a small timeout to ensure context updates are processed
      setTimeout(() => {
        switch(role) {
          case 'admin':
            navigate('/dashboard', { replace: true });
            break;
          case 'sub-admin':
            navigate('/mlgo-dashboard', { replace: true });
            break;
          case 'user':
            navigate('/lgu-assessment', { replace: true });
            break;
          default:
            console.error("Unknown role:", role);
            setLoginError("No access assigned");
            alert('No access assigned');
            setIsLoggingIn(false);
        }
      }, 100);
      
    } catch (error) {
      console.error("=== LOGIN ERROR ===");
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Full error:", error);
      
      let errorMessage = "";
      
      // Check for specific Firebase Auth errors
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
        console.log("Incorrect password provided");
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address in Firebase.';
        console.log("User not found in Firebase Auth");
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
        console.log("Invalid email format");
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later.';
        console.log("Too many failed attempts");
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection.';
        console.log("Network error");
      } else {
        errorMessage = 'Login failed: ' + error.message;
      }
      
      setLoginError(errorMessage);
      alert(errorMessage);
      setIsLoggingIn(false);
    }
  }

  const handleForgotPassword = async () => {
    if (!userId) {
      alert('Please enter your email address');
      return;
    }

    try {
      await sendPasswordResetEmail(auth, userId);
      alert('Password reset email sent! Check your inbox.');
    } catch (error) {
      console.error('Forgot password error:', error);
      if (error.code === 'auth/user-not-found') {
        alert('No account found with this email.');
      } else if (error.code === 'auth/invalid-email') {
        alert('Invalid email address.');
      } else {
        alert('Error sending reset email: ' + error.message);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const snapshot = await get(ref(db, `users/${user.uid}`));
      const now = Date.now();
      
      let userRole = "user";
      
      if (!snapshot.exists()) {
        await set(ref(db, `users/${user.uid}`), {
          email: user.email,
          role: "user",
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString(),
          verified: true,
          verifiedAt: now
        });
      } else {
        const userData = snapshot.val();
        userRole = userData.role || "user";
      }

      // Update AuthContext
      setUser(user);
      setUserRole(userRole);

      if (userRole === 'admin') {
        navigate('/dashboard', { replace: true });
      } else if (userRole === 'sub-admin') {
        navigate('/mlgo-dashboard', { replace: true });
      } else if (userRole === 'user') {
        navigate('/lgu-assessment', { replace: true });
      } else {
        alert('No access assigned');
      }

    } catch (error) {
      console.error('Google Sign-In error:', error.message);
      alert('Failed to sign in with Google: ' + error.message);
    }
  };

  return (
    <div className="app-container">
      <div className="left-panel">
        <div className="logo-top">
          <img src={dilgLogo} alt="Logo" className="top-logo" />
          <img src={lgrcLogo} alt="Logo" className="top-logo" 
          style={{height:"100px",width:"70px"}}/>
        </div>

        <h1 className="title">
        STRATEGIC UNIT FOR<br />KEY {" "}
          <span className="highlight">
            ASS<span className="cyan">ESS</span>
            <span className="red">MENT</span> <span className="white">AND </span>
          </span>
          TRACKING
        </h1>
        
        {loginError && (
          <div className="error-message" style={{ color: 'red', marginBottom: '10px' }}>
            {loginError}
          </div>
        )}
        
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin(userId, password);
          }}
        >
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="Email"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={isLoggingIn}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoggingIn}
                autoComplete="current-password"
              />
              <span
                className="eye"
                onClick={() => setShowPassword(!showPassword)}
                style={{ cursor: "pointer", marginTop:"-.5%" }}
              >
                {showPassword ? "⌣" : "👁"}
              </span>
            </div>
          </div>
          <div className="forgot-password">
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault();
                handleForgotPassword();
              }}
            >
              Forgot Password?
            </a>
          </div>
          <button 
            className="login-btn" 
            type="submit"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? "Logging in..." : "Log In"}
          </button>
        </form>

        <button
          className={`email-btn ${!isGoogleEnabled ? 'disabled-btn' : ''}`}
          onClick={handleGoogleSignIn}
          disabled={!isGoogleEnabled || isCheckingEmail || isLoggingIn}
          title={!isGoogleEnabled ? 'Email not registered in system' : 'Sign in with Google'}
        >
          {isCheckingEmail ? 'Checking...' : 'Continue with Google'}
        </button>

        {/* Registration Modal */}
        {showRegisterModal && (
          <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Register</h2>
              <p className="security-note"  style={{marginBottom:"3%"}}>
                Note: A 6-digit verification code will be sent to your email.
              </p>
              
              <div className="register-form">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>

              <div className="register-form">
                <label>Password</label>
                <div className="password-wrapper">
                  <input
                    type={showRegPassword ? "text" : "password"}
                    placeholder="Enter password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                  <span
                    className="eye"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                  >
                    {showRegPassword ? "⌣" : "👁"}
                  </span>
                </div>
              </div>

              <button
                className="register-btn"
                onClick={() => handleRegister(regEmail, regPassword)}
              >
                Register
              </button>

              <button
                className="close-btn"
                onClick={() => setShowRegisterModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Verification Modal */}
        {showVerifyModal && pendingUser && (
          <div className="modal-overlay" onClick={() => {}}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Verify Your Email</h2>
              <p className="security-note">
                A 6-digit verification code has been sent to:<br />
                <strong>{pendingUser.email}</strong>
              </p>
              
              <div className="verify-form">
                <label>Verification Code</label>
                <input
                  type="text"
                  maxLength="6"
                  placeholder="Enter 6-digit code"
                  value={verificationCode}
                  
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>

              <button
                className="verify-btn"
                onClick={handleVerifyCode}
                disabled={verificationCode.length !== 6}
              >
                Verify Email
              </button>

              <div className="resend-section">
                <button
                  className="resend-btn"
                  onClick={handleResendCode}
                  disabled={cooldown > 0}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                className="close-btn"
                onClick={() => {
                  setShowVerifyModal(false);
                  setPendingUser(null);
                  setVerificationCode("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Custom Password Prompt Modal */}
        {showPasswordPrompt && pendingUser && (
          <div className="modal-overlay" onClick={() => {
            setShowPasswordPrompt(false);
            setTempPassword("");
            setShowTempPassword(false);
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Enter Password</h2>
              <p className="security-note">
                Please enter your password to complete login for:<br />
                <strong>{pendingUser.email}</strong>
              </p>
              
              <div className="password-prompt-form">
                <label>Password</label>
                <div className="password-wrapper">
                  <input
                    type={showTempPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handlePasswordSubmit();
                      }
                    }}
                    autoFocus
                  />
                  <span
                    className="eye"
                    onClick={() => setShowTempPassword(!showTempPassword)}
                    style={{ cursor: "pointer" }}
                  >
                    {showTempPassword ? "⌣" : "👁"}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  className="verify-btn"
                  onClick={handlePasswordSubmit}
                  style={{ flex: 1, marginTop:"10px" }}
                >
                  Login
                </button>
                <button
                  className="close-btn"
                  onClick={() => {
                    setShowPasswordPrompt(false);
                    setTempPassword("");
                    setShowTempPassword(false);
                  }}
                  style={{ flex: 1, height:"43px"}}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <p className="register-text">
          Don't have an account yet?{" "}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setShowRegisterModal(true);
            }}
          >
            Register Here
          </a>
        </p>
      </div>

      <div className="right-panel">
        <img src={dilgSeal} alt="DILG Logo" className="seal" />
      </div>
    </div>
  );
}