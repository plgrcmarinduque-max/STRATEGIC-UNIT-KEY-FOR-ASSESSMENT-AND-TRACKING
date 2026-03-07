import { StrictMode, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ref, get } from "firebase/database";
import "./index.css";

// Import your Firebase instances from the existing config file
import { auth, db } from "./firebase"; // Adjust the path as needed

// Import your components
import App from "./PO/app.jsx";
import Dashboard from "./PO/dashboard.jsx";
import Loader from "./loader.jsx";
import FAS from "./PO/financial-administration-and-sustainability.jsx";

import LGU from "./LGU/lgu-assessment.jsx";
import LGUNotification from "./LGU/lgu-notifications.jsx";
import MLGO from "./MLGO/mlgo-dashboard.jsx";
import MLGOView from "./MLGO/mlgo-view.jsx";
import POView from "./PO/po-view.jsx";
import MLGONotification from "./MLGO/mlgo-notifications.jsx";
import PONotification from "./PO/po-notifications.jsx";

// REMOVE THIS WHOLE SECTION:
// const firebaseConfig = {...};
// const app = initializeApp(firebaseConfig);
// const auth = getAuth(app);
// const db = getDatabase(app);

function ProtectedRoute({ children, allowedRoles }) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const snapshot = await get(ref(db, `users/${currentUser.uid}/role`));
        if (snapshot.exists()) {
          setRole(snapshot.val());
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to="/login" replace />;

  return children;
}

function Root() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <Loader />;

  return (
    <Routes>
      <Route path="/login" element={<App />} />

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
        path="/financial-administration-and-sustainability"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <FAS />
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
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>
);