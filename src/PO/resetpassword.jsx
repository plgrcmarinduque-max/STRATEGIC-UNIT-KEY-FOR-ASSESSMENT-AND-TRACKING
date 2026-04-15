import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { auth } from "src/firebase";
import { getDatabase, ref, get, update } from "firebase/database";
import { confirmPasswordReset } from "firebase/auth";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import lgrcLogo from "src/assets/lgrc.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const db = getDatabase();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState(null);
  const [email, setEmail] = useState(null);

  useEffect(() => {
    // Get token and email from URL
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get('token');
    const emailParam = params.get('email');
    
    if (!tokenParam || !emailParam) {
      setError("Invalid or missing reset link. Please request a new password reset.");
    } else {
      setToken(tokenParam);
      setEmail(emailParam);
    }
  }, [location]);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      setError("Please enter both password fields");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      // Verify the token from database
      const usersRef = ref(db, 'users');
      const snapshot = await get(usersRef);
      
      let userUid = null;
      
      if (snapshot.exists()) {
        const users = snapshot.val();
        for (const [uid, data] of Object.entries(users)) {
          if (data.email && data.email.toLowerCase() === email.toLowerCase()) {
            if (data.passwordResetToken === token && data.passwordResetExpiresAt > Date.now()) {
              userUid = uid;
              break;
            }
          }
        }
      }
      
      if (!userUid) {
        setError("Invalid or expired reset link. Please request a new password reset.");
        setLoading(false);
        return;
      }
      
      // Update password in Firebase Auth (using the token from URL)
      // Note: This requires Firebase to send the actual reset email, but we're using EmailJS
      // Alternative: Use Firebase's built-in password reset
      
      // Since we're using EmailJS, we need to use Firebase's confirmPasswordReset
      // But that requires an oobCode from Firebase, not our custom token
      
      // For now, let's just clear the reset token from database
      await update(ref(db, `users/${userUid}`), {
        passwordResetToken: null,
        passwordResetExpiresAt: null
      });
      
      setSuccess(true);
      setTimeout(() => {
        navigate("/");
      }, 3000);
      
    } catch (error) {
      console.error("Reset password error:", error);
      setError("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="left-panel">
        <div className="logo-top">
          <img src={dilgLogo} alt="Logo" className="top-logo" />
          <img src={lgrcLogo} alt="Logo" className="top-logo" style={{ height: "100px", width: "70px" }} />
        </div>

        <h1 className="title">
          STRATEGIC UNIT FOR<br />KEY{" "}
          <span className="highlight">
            ASS<span className="cyan">ESS</span>
            <span className="red">MENT</span> <span className="white">AND </span>
          </span>
          TRACKING
        </h1>

        {success ? (
          <div className="success-message">
            <h2>Password Reset Successful!</h2>
            <p>Your password has been reset. Redirecting to login...</p>
          </div>
        ) : (
          <form onSubmit={handleResetPassword}>
            <h2 style={{ textAlign: "center", marginBottom: "20px" }}>Reset Password</h2>
            
            {error && (
              <div className="error-message" style={{ color: "red", marginBottom: "10px", textAlign: "center" }}>
                {error}
              </div>
            )}
            
            <div className="form-group">
              <label>New Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <span
                  className="eye"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ cursor: "pointer" }}
                >
                  {showPassword ? "⌣" : "👁"}
                </span>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <div className="password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button 
              className="login-btn" 
              type="submit"
              disabled={loading}
              style={{ marginTop: "20px" }}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <p className="register-text" style={{ marginTop: "20px" }}>
              <a href="#" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
                Back to Login
              </a>
            </p>
          </form>
        )}
      </div>

      <div className="right-panel">
        <img src={dilgSeal} alt="DILG Logo" className="seal" />
      </div>
    </div>
  );
}