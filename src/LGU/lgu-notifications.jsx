import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import styles from "src/LGU-CSS/lgu-notification.module.css";
import { ClipboardCheck } from "lucide-react";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiFilter,FiTrash2 , FiRotateCcw, FiSettings, FiLogOut, FiFileText, FiBell } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, push, onValue, set, get } from "firebase/database";
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function LGUNotification() {
  const navigate = useNavigate();
const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileData, setProfileData] = useState({ name: "", email: "", image: "" });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editProfileData, setEditProfileData] = useState({ name: "", email: "", image: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  
  const user = auth.currentUser;
  const displayName = user?.email || "User";
  const [userMunicipality, setUserMunicipality] = useState("");
  useEffect(() => {
    if (!auth.currentUser) return;
  
    const profileRef = ref(db, `profiles/${auth.currentUser.uid}`);
    const unsubscribe = onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const profile = snapshot.val();
        setProfileData(profile);
        setEditProfileData(profile);
        setUserMunicipality(profile.municipality || ""); // ADDED: Store user's municipality
      }
    });
    
    return () => unsubscribe();
  }, []);

    // Fetch admin UID
  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchAdminUid = async () => {
      try {
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);
        
        if (usersSnapshot.exists()) {
          const users = usersSnapshot.val();
          const adminId = Object.keys(users).find(
            uid => users[uid]?.role === "admin"
          );
          
          if (adminId) {
            setAdminUid(adminId);
          }
        }
      } catch (error) {
        console.error("Error fetching admin UID:", error);
      }
    };

    fetchAdminUid();
  }, []);

    // Handle navigation from notifications
  useEffect(() => {
    const navigationState = location.state;
    
    if (navigationState && navigationState.fromNotification) {
      console.log("Navigation from notification:", navigationState);
      
      // Set the year if provided
      if (navigationState.year) {
        setSelectedYearDisplay(navigationState.year);
      }
      
      // Set the assessment if provided
      if (navigationState.assessmentId) {
        setSelectedAssessmentId(navigationState.assessmentId);
        setSelectedAssessment(navigationState.assessment || "");
      }
      
      // Clear the state after using it to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
  useEffect(() => {
    if (!auth.currentUser || !userMunicipality) return; // Wait for municipality
  
    const loadAllNotifications = async () => {
      setLoading(true);
      try {
        const userUid = auth.currentUser?.uid;
        if (!userUid) return;
  
        console.log("Loading notifications for UID:", userUid, "Municipality:", userMunicipality);
  
        const notificationsRootRef = ref(db, `notifications`);
        const rootSnapshot = await get(notificationsRootRef);
  
        let allNotifications = [];
  
        if (rootSnapshot.exists()) {
          const yearsData = rootSnapshot.val();
          
          Object.keys(yearsData).forEach(year => {
            const yearData = yearsData[year];
            
            // Check if this year has LGU notifications for this user UID
            if (yearData.LGU && yearData.LGU[userUid]) {
              const yearNotifications = yearData.LGU[userUid];
              
              Object.keys(yearNotifications).forEach(key => {
                const notification = yearNotifications[key];
                
                // FILTER BY MUNICIPALITY: Only show notifications for this LGU's municipality
                // Notifications from MLGO will have fromMunicipality or municipality field
                const notificationMunicipality = notification.fromMunicipality || notification.municipality;
                
                // If the notification has a municipality, check if it matches the user's municipality
                if (!notificationMunicipality || notificationMunicipality === userMunicipality) {
                  allNotifications.push({
                    id: key,
                    year: year,
                    ...notification
                  });
                } else {
                  console.log(`Filtering out notification from ${notificationMunicipality} (user is ${userMunicipality})`);
                }
              });
            }
          });
        }
  
        // Sort by timestamp (newest first)
        allNotifications.sort((a, b) => b.timestamp - a.timestamp);
        setNotifications(allNotifications);
        console.log("Loaded filtered notifications:", allNotifications.length);
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading notifications:", error);
        setLoading(false);
      }
    };
  
    if (userMunicipality) {
      loadAllNotifications();
    }
  }, [profileData.name, userMunicipality]);

// Mark notification as read
const markAsRead = async (notificationId, year) => {
  if (!auth.currentUser) return;
  
  try {
    const userUid = auth.currentUser.uid;
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;
    
    const notificationRef = ref(db, `notifications/${year}/LGU/${userUid}/${notificationId}`);
    await set(notificationRef, {
      ...notification,
      read: true
    });
    
    // Update local state
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
};

// Mark all as read
const markAllAsRead = async () => {
  if (!auth.currentUser || notifications.length === 0) return;
  
  try {
    const userUid = auth.currentUser.uid;
    
    // Group unread notifications by year
    const unreadByYear = {};
    notifications.forEach(n => {
      if (!n.read) {
        if (!unreadByYear[n.year]) unreadByYear[n.year] = [];
        unreadByYear[n.year].push(n);
      }
    });
    
    // Update each notification
    for (const [year, yearNotifications] of Object.entries(unreadByYear)) {
      for (const notification of yearNotifications) {
        const notificationRef = ref(db, `notifications/${year}/LGU/${userUid}/${notification.id}`);
        await set(notificationRef, {
          ...notification,
          read: true
        });
      }
    }
    
    // Update local state
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  } catch (error) {
    console.error("Error marking all as read:", error);
  }
};

// Delete notification
const deleteNotification = async (notificationId, year) => {
  if (!auth.currentUser) return;
  
  if (!window.confirm("Delete this notification?")) return;
  
  try {
    const userUid = auth.currentUser.uid;
    
    const notificationRef = ref(db, `notifications/${year}/LGU/${userUid}/${notificationId}`);
    await set(notificationRef, null);
    
    // Update local state
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  } catch (error) {
    console.error("Error deleting notification:", error);
    alert("Failed to delete notification");
  }
};


  // Format date (MM-DD-YYYY)
  const formatDate = (timestamp) => {
    if (!timestamp) return "Unknown";
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}-${day}-${year}`;
  };

  // Format time (HH:MM AM/PM)
const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
};

  // Get indicator title from key (if available)
  const getIndicatorTitle = (indicatorKey) => {
    if (!indicatorKey || indicatorKey === 'general') return 'General Assessment';
    // You can expand this to fetch actual indicator titles from your indicators data
    return `Indicator: ${indicatorKey}`;
  };


  const handleSignOut = () => {
    const confirmLogout = window.confirm("Are you sure you want to sign out?");
    if (confirmLogout) {
      navigate("/login");
    }
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;

    try {
      setSavingProfile(true);
      await set(ref(db, `profiles/${auth.currentUser.uid}`), {
        ...editProfileData,
        email: auth.currentUser.email
      });
      setProfileData(editProfileData);
      alert("Profile updated successfully!");
      setShowEditProfileModal(false);
    } catch (error) {
      console.error(error);
      alert("Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditProfileData({ ...editProfileData, image: reader.result });
    };
    reader.readAsDataURL(file);
  };

const unreadCount = notifications.filter(n => !n.read).length;
const allItems = [...notifications].sort((a, b) => 
  (b.timestamp || 0) - (a.timestamp || 0)
);

  return (
    <div className="dashboard-scale">
      <div className="dashboard">
        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
          <div className="sidebar-header">
            {sidebarOpen && (
              <>
                <img src={dilgSeal} alt="DILG Seal" style={{ height: "50px", width: "auto" }} />
                <img src={dilgLogo} alt="DILG Logo" style={{ height: "50px", width: "auto" }} />
                <h3 style={{textAlign: "center", lineHeight: "1.1", marginLeft: "-20%",}}>STRATEGIC UNIT FOR <br />KEY{" "} <span className="yellow">ASS</span><span className="cyan">ESS</span>
                <span className="red">MENT</span>  <span className="white">AND</span> TRACKING</h3>
                <div className="sidebar-divider"></div>
              </>
            )}
          </div>

          {sidebarOpen && (
            <>
              <div className={styles.sidebarMenu}>
<button
  className={`${styles.sidebarMenuItem}`}
  onClick={() => navigate("/lgu-assessment")}
>
  <ClipboardCheck size={20} />
  Assessment
</button>
                <button
                  className={`${styles.sidebarMenuItem} ${styles.active}`}
                  onClick={() => navigate("/lgu-notification")}
                >
                  <FiBell style={{ marginRight: "1px", fontSize: "18px" }} />
                  Notifications
                  {unreadCount > 0 && (
                    <span style={{
                      backgroundColor: "#dc3545",
                      color: "white",
                      borderRadius: "12px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      marginLeft: "8px"
                    }}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>

              <div className={styles.sidebarBottom}>
                <button 
                  className={`${styles.sidebarBtn} ${styles.signoutBtn}`} 
                  onClick={handleSignOut}
                >
                  <FiLogOut style={{ marginRight: "8px", fontSize: "18px" }} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>

        {/* Main */}
        <div className="main">
          <div className="topbar">
            <button
              className="toggle-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ cursor: "pointer" }}
            >
              {sidebarOpen ? "☰" : "✖"}
            </button>
            <div className="topbarLeft">
              <h2>Provincial Assessment</h2>
            </div>

            <div className="top-right">
              <div className="profile-container">
                <div
                  className="profile"
                  onClick={() => setShowProfileModal(true)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="avatar">
                    {profileData.image ? (
                      <img
                        src={profileData.image}
                        alt="avatar"
                        style={{
                          width: "60px",
                          height: "60px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "7px solid #0c1a4b",
                        }}
                      />
                    ) : (
                      "👤"
                    )}
                  </div>
                  <span>{profileData.name || displayName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notification Content */}
          <div className={styles.assessmentContainer}>
            <div className="lgunottable-box">
              <div className="scrollable-content" style={{ maxHeight: sidebarOpen ? 'calc(100vh - 175px)' : 'calc(100vh - 200px)', overflowY: "auto" }}>
                
                {/* Header with actions */}
               {notifications.length > 0 && (
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                    padding: "5px 0"
                  }}>
               <span style={{ fontSize: "13px", color: "#666" }}>
    {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#0066cc",
                          fontSize: "12px",
                          cursor: "pointer",
                          textDecoration: "underline"
                        }}
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                )}

{/* Table for Notifications */}
<div style={{ 
  backgroundColor: "white", 
  borderRadius: "4px", 
  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  overflow: "hidden",
  border: "1px solid #e0e0e0"
}}>
  <table style={{ 
    width: "100%", 
    borderCollapse: "collapse", 
    fontSize: "13px",
  }}>
    <thead>
      <tr style={{ 
        backgroundColor: "#f5f5f5", 
        color: "#333",
        borderBottom: "1px solid #ddd"
      }}>
        <th style={{ 
          padding: "10px 12px", 
          textAlign: "left", 
          width: "5%",
          fontWeight: "500",
          borderRight: "1px solid #ddd"
        }}>No.</th>
        <th style={{ 
          padding: "10px 12px", 
          textAlign: "left", 
          width: "70%",
          fontWeight: "500",
          borderRight: "1px solid #ddd"
        }}>Message</th>
        <th style={{ 
          padding: "10px 12px", 
          textAlign: "left", 
          width: "15%",
          fontWeight: "500",
          borderRight: "1px solid #ddd"
        }}>Date</th>
        <th style={{ 
          padding: "10px 12px", 
          textAlign: "center", 
          width: "10%",
          fontWeight: "500"
        }}>Action</th>
      </tr>
    </thead>
    
    <tbody>
      {loading ? (
        <tr>
          <td colSpan="4" style={{ padding: "30px", textAlign: "center", color: "#666" }}>
            Loading...
          </td>
        </tr>
      ) : allItems.length > 0 ? (
       allItems.map((item, index) => (
         <tr 
  key={item.id || index}
  style={{
    backgroundColor: item.read !== undefined 
      ? (item.read ? "white" : "#f9f9f9")
      : "white",
    borderBottom: "1px solid #eee",
    cursor: "pointer"
  }}
  onClick={() => {
    // Mark as read when clicked
    if (!item.read) {
      markAsRead(item.id, item.year);
    }
    
    // Navigate to the assessment based on notification type
    if (item.type === "assessment_verified") {
      navigate("/lgu-assessment", {
        state: {
          year: item.year,
          assessmentId: item.assessmentId,
          assessment: item.assessment,
          isVerified: true,
          fromNotification: true
        }
      });
    } else if (item.type === "assessment_returned") {
      navigate("/lgu-assessment", {
        state: {
          year: item.year,
          assessmentId: item.assessmentId,
          assessment: item.assessment,
          isReturned: true,
          mlgoRemarks: item.allRemarks,
          fromNotification: true
        }
      });
    } else if (item.type === "assessment_forwarded_to_po") {
      navigate("/lgu-assessment", {
        state: {
          year: item.year,
          assessmentId: item.assessmentId,
          assessment: item.assessment,
          isForwarded: true,
          fromNotification: true
        }
      });
    } else {
      // Default navigation for other notification types
      navigate("/lgu-assessment", {
        state: {
          year: item.year,
          assessmentId: item.assessmentId,
          assessment: item.assessment,
          fromNotification: true
        }
      });
    }
  }}
>
            <td style={{ 
              padding: "10px 12px", 
              color: "#333",
              borderRight: "1px solid #eee"
            }}>
             {index + 1}
            </td>

            <td style={{ 
              padding: "10px 12px",
              color: "#333",
              borderRight: "1px solid #eee"
            }}>
              <div>
                <span style={{ 
                  fontWeight: item.read === false ? "500" : "normal",
                  color: item.read === false ? "#000000" : "#000000"
                }}>
                  {item.title || item.message || item.text || "No message content"}
                </span>
              </div>
            </td>

        <td style={{ 
  padding: "10px 12px",
  fontSize: "12px",
  color: "#666",
  borderRight: "1px solid #eee"
  
  
}}>
  {formatDate(item.timestamp || item.returnedAt)}
  <br />
  <span style={{ fontSize: "10px", color: "#999" }}>
    {formatTime(item.timestamp || item.returnedAt)}
  </span>
</td>
            
      <td style={{ 
  padding: "10px 12px", 
  textAlign: "center"
}}>
  <div style={{ display: "flex", gap: "5px", justifyContent: "center" }}>
    {/* Mark as Read button - only show for notifications (not remarks) and if not read */}
    {!item.read && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          markAsRead(item.id, item.year);
        }}
        style={{
          background: "none",
          border: "none",
          color: "#28a745",
          cursor: "pointer",
          fontSize: "16px",
          padding: "5px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
        title="Mark as read"
      >
        ✓
      </button>
    )}
    
    {/* Delete button */}
<button
  onClick={(e) => {
    e.stopPropagation();
    deleteNotification(item.id, item.year);
  }}
  style={{
    background: "none",
    border: "none",
    color: "#dc3545",
    cursor: "pointer",
    fontSize: "16px",
    padding: "5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  }}
  title="Delete"
>
  <FiTrash2 />
</button>
  </div>
</td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan="4" style={{ padding: "40px", textAlign: "center", color: "#999" }}>
            <div style={{ fontSize: "40px", marginBottom: "10px", color: "#ccc" }}>📭</div>
            <div style={{ fontSize: "14px" }}>No notifications yet</div>
          </td>
        </tr>
      )}
    </tbody>
  </table>
  
</div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="modal-overlay">
            <div className="profile-view-modal">
              <div className="profile-view-header">
                <span className="back-btn" onClick={() => setShowProfileModal(false)}>←</span>
                <h3>Profile</h3>
              </div>
              <div className="profile-view-body">
                <div className="profile-view-avatar">
                  {profileData.image ? (
                    <img src={profileData.image} alt="Profile" />
                  ) : (
                    <div className="avatar-placeholder">👤</div>
                  )}
                </div>
                <h2>{profileData.name || "No Name"}</h2>
                <p className="profile-email">{profileData.email}</p>
                <p style={{
                  color: "#666",
                  marginBottom: "20px",
                  marginTop: "-15px",
                  fontWeight: "600"
                }}>
                  {profileData.municipality}
                </p>
                <div className="profile-action-buttons">
                  <button
                    className="profile-btn"
                    onClick={() => {
                      setShowProfileModal(false);
                      setShowEditProfileModal(true);
                    }}
                  >
                    Edit Profile
                  </button>
                  <button
                    className="profile-btn signout"
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Profile Modal */}
        {showEditProfileModal && (
          <div className="modal-overlay">
            <div className="add-record-modal profile-modal">
              <div className="modal-header">
                <h3>Edit Profile</h3>
                <span
                  className="close-x"
                  onClick={() => {
                    setEditProfileData(profileData);
                    setShowEditProfileModal(false);
                  }}
                >
                  ✕
                </span>
              </div>
              <div className="modal-body">
                <div className="modal-field">
                  <label>Profile Image:</label>
                  <input type="file" accept="image/*" onChange={handleImageUpload} />
                </div>
                {editProfileData.image && (
                  <div className="profile-preview">
                    <img src={editProfileData.image} alt="Preview" />
                    <button
                      type="button"
                      className="remove-photo-btn"
                      onClick={() =>
                        setEditProfileData({ ...editProfileData, image: "" })
                      }
                    >
                      Remove
                    </button>
                  </div>
                )}
                <div className="modal-field">
                  <label>Name:</label>
                  <input
                    type="text"
                    value={editProfileData.name}
                    onChange={(e) =>
                      setEditProfileData({ ...editProfileData, name: e.target.value })
                    }
                  />
                </div>
                <div className="modal-field">
                  <label>Email:</label>
                  <input
                    type="text"
                    value={auth.currentUser?.email || ""}
                    disabled
                    style={{ background: "#f1f1f1", cursor: "not-allowed" }}
                  />
                </div>
                <div className="modal-footer">
                  <button
                    className="save-profile-btn"
                    onClick={handleSaveProfile}
                    disabled={savingProfile || !editProfileData.name.trim()}
                  >
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}