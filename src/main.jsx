import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";

// Import your Firebase instances
import { auth, db } from "./firebase";

// Import Auth Context
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { InactivityWarning } from "../components/InactivityWarning";

// Import your components
import App from "./PO/app.jsx";
import Dashboard from "./PO/dashboard.jsx";
import Loader from "./loader.jsx";
import POIndicators from "./PO/po-indicators.jsx";
import LGU from "./LGU/lgu-assessment.jsx";
import LGUNotification from "./LGU/lgu-notifications.jsx";
import MLGO from "./MLGO/mlgo-dashboard.jsx";
import MLGOView from "./MLGO/mlgo-view.jsx";
import POView from "./PO/po-view.jsx";
import MLGONotification from "./MLGO/mlgo-notifications.jsx";
import PONotification from "./PO/po-notifications.jsx";
import ResetPassword from "./PO/resetpassword";

// Protected Route Component (using Auth Context)
function ProtectedRoute({ children, allowedRoles }) {
  const { user, userRole, loading } = useAuth();

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(userRole)) return <Navigate to="/login" replace />;

  return children;
}

// Layout component to show inactivity warning
function AppLayout({ children }) {
  const { showInactivityWarning } = useAuth();
  
  return (
    <>
      {showInactivityWarning && <InactivityWarning />}
      {children}
    </>
  );
}

function Root() {
  return (
    <AuthProvider>
      <AppLayout>
        <Routes>
          <Route path="/login" element={<App />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* PO/Admin Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/po-indicators"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <POIndicators />
              </ProtectedRoute>
            }
          />
          <Route
            path="/po-view"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <POView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/po-notifications"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <PONotification />
              </ProtectedRoute>
            }
          />

          {/* MLGO Routes */}
          <Route
            path="/mlgo-dashboard"
            element={
              <ProtectedRoute allowedRoles={["sub-admin"]}>
                <MLGO />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mlgo-view"
            element={
              <ProtectedRoute allowedRoles={["sub-admin"]}>
                <MLGOView />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mlgo-notification"
            element={
              <ProtectedRoute allowedRoles={["sub-admin"]}>
                <MLGONotification />
              </ProtectedRoute>
            }
          />

          {/* LGU Routes */}
          <Route
            path="/lgu-assessment"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <LGU />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lgu-notification"
            element={
              <ProtectedRoute allowedRoles={["user"]}>
                <LGUNotification />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppLayout>
    </AuthProvider>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>
);