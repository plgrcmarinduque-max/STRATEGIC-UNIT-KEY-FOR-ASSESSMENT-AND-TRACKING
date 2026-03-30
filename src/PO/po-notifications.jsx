import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import style from "src/PO-CSS/po-notifications.module.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiFilter, FiRotateCcw, FiSettings, FiLogOut, FiFileText, FiBell, FiArrowRight, FiEye, FiTrash2 } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { ref, push, onValue, set, get } from "firebase/database";



export default function PONotification() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [lguAnswers, setLguAnswers] = useState([]);
  const [profileComplete, setProfileComplete] = useState(false);
  const rowsPerPage = 10;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [adminUid, setAdminUid] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;
  const displayName = user?.email || "User";
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  
  const [editProfileData, setEditProfileData] = useState({
    name: "",
    email: displayName,
    image: ""
  });
  const [savingProfile, setSavingProfile] = useState(false);
const [profileData, setProfileData] = useState({
  name: "",
  email: displayName,
  image: ""
});
  const [filters, setFilters] = useState({
    year: "",
    status: "",
  });


  const [data, setData] = useState([]);

  // NOTIFICATION TABLE STATES
  const [notifications, setNotifications] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationCurrentPage, setNotificationCurrentPage] = useState(1);
  const [notificationItemsPerPage] = useState(20);

useEffect(() => {
  if (!auth.currentUser) return;

  const profileRef = ref(db, `profiles/${auth.currentUser.uid}`);
  onValue(profileRef, (snapshot) => {
    if (snapshot.exists()) {
      const profile = snapshot.val();
      // Ensure profile has all required fields with defaults - remove municipality
      const safeProfile = {
        name: profile.name || "",
        email: profile.email || auth.currentUser?.email || "",
        image: profile.image || ""
      };
      setProfileData(safeProfile);
      setEditProfileData(safeProfile);

      // PO/Admin users don't need to complete profile - remove forced modal
      setProfileComplete(true); // Always set to true for PO
      setShowEditProfileModal(false); // Don't force modal
    } else {
      // No profile exists yet, but don't force for PO
      setProfileComplete(true); // Still set to true
      setShowEditProfileModal(false); // Don't show modal
    }
  });
}, []);

// Fetch LGU answers from database
useEffect(() => {
  if (!auth.currentUser || !adminUid) return;

  const fetchLGUAnswers = async () => {
    try {
      console.log("Fetching LGU answers...");
      
      // Reference to all LGU answers under the selected year
      // You need to adjust this path based on your database structure
      const answersRef = ref(db, `answers`); // or whatever your base path is
      
      onValue(answersRef, (snapshot) => {
        if (snapshot.exists()) {
          const allAnswers = snapshot.val();
          const answersList = [];
          let counter = 1;
          
          // Iterate through years
          Object.keys(allAnswers).forEach(year => {
            // Iterate through LGUs under each year
            if (allAnswers[year] && allAnswers[year].LGU) {
              Object.keys(allAnswers[year].LGU).forEach(lguName => {
                const lguData = allAnswers[year].LGU[lguName];
                
                // Get submission date from metadata or use current date as fallback
                let submissionDate = "Awaiting Resubmission";
                let status = "Pending";
                
                if (lguData._metadata) {
                  if (lguData._metadata.submitted) {
                    status = "Pending"; // or "Verified" based on your logic
                    submissionDate = lguData._metadata.lastSaved 
                      ? new Date(lguData._metadata.lastSaved).toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })
                      : new Date().toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        });
                  }
                }
                
                answersList.push({
                  id: counter++,
                  year: year,
                  status: status,
                  submission: submissionDate,
                  deadline: "deadline", // You can fetch this from admin settings
                  lguName: lguName,
                  data: lguData
                });
              });
            }
          });
          
          console.log("LGU Answers loaded:", answersList);
          setLguAnswers(answersList);
          setData(answersList); // Set to data for filtering and pagination
        } else {
          console.log("No answers found");
          setLguAnswers([]);
          setData([]);
        }
      });
    } catch (error) {
      console.error("Error fetching LGU answers:", error);
    }
  };

  fetchLGUAnswers();
}, [adminUid]);

// Fetch deadlines from admin for each year
useEffect(() => {
  if (!auth.currentUser || !adminUid) return;

  const fetchDeadlines = async () => {
    try {
      const deadlinesRef = ref(db, `po-indicators/${adminUid}`);
      
      onValue(deadlinesRef, (snapshot) => {
        if (snapshot.exists()) {
          const poIndicatorsData = snapshot.val();
          const deadlinesMap = {};
          
          Object.keys(poIndicatorsData).forEach(year => {
            if (poIndicatorsData[year] && poIndicatorsData[year].metadata && poIndicatorsData[year].metadata.deadline) {
              deadlinesMap[year] = poIndicatorsData[year].metadata.deadline;
            }
          });
          
          // Store deadlines in state or use them when displaying
          console.log("Deadlines loaded:", deadlinesMap);
          
          // You can update the data with deadlines
          setLguAnswers(prev => prev.map(item => ({
            ...item,
            deadline: deadlinesMap[item.year] 
              ? new Date(deadlinesMap[item.year]).toLocaleDateString('en-US', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })
              : "Not set"
          })));
        }
      });
    } catch (error) {
      console.error("Error fetching deadlines:", error);
    }
  };

  fetchDeadlines();
}, [adminUid]);


useEffect(() => {
  if (!auth.currentUser || !adminUid) return;

  const yearsRef = ref(db, `years/${adminUid}`);

  onValue(yearsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log("Years from admin:", data);
      
      // Handle different data structures
      let yearsArray = [];
      if (Array.isArray(data)) {
        yearsArray = data;
      } else if (typeof data === "object" && data !== null) {
        yearsArray = Object.keys(data);
      }
      
      setYears(yearsArray);
    } else {
      console.log("No years data found for admin");
      setYears([]);
    }
  });
}, [adminUid]);


// Load notifications
useEffect(() => {
  if (!auth.currentUser) return;

  const loadNotifications = async () => {
    setNotificationLoading(true);
    try {
      // Use UID instead of name
      const userUid = auth.currentUser.uid;
      
      const notificationsRootRef = ref(db, `notifications`);
      const rootSnapshot = await get(notificationsRootRef);
      
      let allNotifications = [];
      
      if (rootSnapshot.exists()) {
        const yearsData = rootSnapshot.val();
        
        Object.keys(yearsData).forEach(year => {
          const yearData = yearsData[year];
          // Look for notifications under PO with the user's UID (NOT MLGO)
          if (yearData.PO && yearData.PO[userUid]) {
            const yearNotifications = yearData.PO[userUid];
            Object.keys(yearNotifications).forEach(key => {
              allNotifications.push({
                id: key,
                year: year,
                ...yearNotifications[key]
              });
            });
          }
        });
      }

      allNotifications.sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(allNotifications);
      setNotificationLoading(false);
    } catch (error) {
      console.error("Error loading notifications:", error);
      setNotificationLoading(false);
    }
  };

  loadNotifications();
}, [profileData.name]); // Keep dependency on profileData.name to reload when profile changes

// Delete notification
const deleteNotification = async (notificationId, year) => {
  if (!auth.currentUser) return;
  if (!window.confirm("Delete this notification?")) return;
  
  try {
    const userUid = auth.currentUser.uid;
    
    const notificationRef = ref(db, `notifications/${year}/PO/${userUid}/${notificationId}`);
    await set(notificationRef, null);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  } catch (error) {
    console.error("Error deleting notification:", error);
    alert("Failed to delete notification");
  }
};

// Format date
const formatDate = (timestamp) => {
  if (!timestamp) return "Unknown";
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
};

// Notification pagination
const notificationAllItems = notifications;
const notificationTotalPages = Math.ceil(notificationAllItems.length / notificationItemsPerPage);
const notificationIndexOfLastItem = notificationCurrentPage * notificationItemsPerPage;
const notificationIndexOfFirstItem = notificationIndexOfLastItem - notificationItemsPerPage;
const notificationCurrentItems = notificationAllItems.slice(notificationIndexOfFirstItem, notificationIndexOfLastItem);

const notificationNextPage = () => setNotificationCurrentPage(prev => Math.min(prev + 1, notificationTotalPages));
const notificationPrevPage = () => setNotificationCurrentPage(prev => Math.max(prev - 1, 1));

const unreadCount = notifications.filter(n => !n.read).length;

// Mark notification as read
const markAsRead = async (notificationId, year) => {
  if (!auth.currentUser) return;
  
  try {
    const userUid = auth.currentUser.uid;
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;
    
    const notificationRef = ref(db, `notifications/${year}/PO/${userUid}/${notificationId}`);
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
    alert("Failed to mark as read");
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
        const notificationRef = ref(db, `notifications/${year}/PO/${userUid}/${notification.id}`);
        await set(notificationRef, {
          ...notification,
          read: true
        });
      }
    }
    
    // Update local state
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    alert("All notifications marked as read");
  } catch (error) {
    console.error("Error marking all as read:", error);
    alert("Failed to mark all as read");
  }
};

const handleSaveProfile = async () => {
  if (!auth.currentUser) return;

  // Remove municipality from the saved data
  try {
    setSavingProfile(true);

    await set(ref(db, `profiles/${auth.currentUser.uid}`), {
      name: editProfileData.name,
      email: auth.currentUser.email,
      image: editProfileData.image || ""
    });

    setProfileData(editProfileData); // update visible profile
    setProfileComplete(true); // Keep profile complete

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


const handleView = (item) => {
  console.log("View:", item);
    navigate("/mlgo-view", { 
    state: { 
      year: item.year,
      lguName: item.lguName,
      lguData: item.data 
    } 
  });
};

  const handleCompletion = (item) => {
    console.log("Completion:", item);
  };


  const municipalities = ["Boac", "Mogpog", "Sta. Cruz", "Torrijos", "Buenavista", "Gasan"];
  const [years, setYears] = useState(["2021","2022","2023","2024","2025","2026"]);
  
// Fetch admin UID from users/
useEffect(() => {
  if (!auth.currentUser) return;

  const fetchAdminUid = async () => {
    try {
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      
      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();
        // Find the admin UID
        const adminId = Object.keys(users).find(
          uid => users[uid]?.role === "admin"
        );
        
        if (adminId) {
          setAdminUid(adminId);
          console.log("Admin UID found:", adminId);
        } else {
          console.log("No admin user found");
        }
      }
    } catch (error) {
      console.error("Error fetching admin UID:", error);
    } finally {
      setLoading(false);
    }
  };

  fetchAdminUid();
}, []);
  
  const statuses = ["Verified", "Pending"];

  const updateFilter = (type, value) => {
    setFilters({ ...filters, [type]: value });
    setOpenDropdown(null);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      municipality: "",
      year: "",
      status: "",
    });
    setCurrentPage(1);
  };

const filteredData = (lguAnswers || []).filter((item) => {
  return (
    (!filters.year || item.year === filters.year) &&
    (!filters.status || item.status.toLowerCase() === filters.status.toLowerCase()) &&
    (item.year.toLowerCase().includes(search.toLowerCase()) ||
     item.lguName?.toLowerCase().includes(search.toLowerCase()))
  );
});

  /* Pagination Logic */
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const renderDropdown = (type, list) => (
    <div className="dropdown">
      {list.map((item, i) => (
        <div key={i} className="dropdown-item" onClick={() => updateFilter(type, item)}>
          {item}
        </div>
      ))}
    </div>
  );


const handleSignOut = () => {
  const confirmLogout = window.confirm("Are you sure you want to sign out?");
  if (confirmLogout) {
    navigate("/login");
  }
};

  return (
    <>
    {loading ? (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        Loading...
      </div>
    ) : (
    <div className={style.dashboardScale}>
      <div className={style.dashboard}>
        {/* Sidebar */}
        <div className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
          <div className="sidebar-header">
            {sidebarOpen && (
              <>
              <img src={dilgSeal} alt="DILG Seal" style={{ height: "50px", width: "auto" }} />
              <img src={dilgLogo} alt="DILG Logo" style={{ height: "50px", width: "auto" }} />
              <h3 style={{textAlign: "center", lineHeight: "1.1", marginLeft: "-20%",}}>STRATEGIC UNIT KEY <br />FOR{" "} <span className="yellow">ASS</span><span className="cyan">ESS</span>
              <span className="red">MENT</span>  <span className="white">AND</span> TRACKING</h3>
              <div className="sidebar-divider"></div>
              </>
            )}
          </div>


          {sidebarOpen && (
            <>

 <button
  className={style.sidebarMenuItem}
  onClick={() => navigate("/dashboard")}
  style={{ marginTop: "-10%" }}
>
  <span style={{ marginRight: "8px", fontSize: "18px" }}>🏠︎</span>
  Dashboard
</button>
<button
  className={style.sidebarMenuItem}
  onClick={() => navigate("/po-notifications")}
>
  <FiBell style={{ marginRight: "8px", fontSize: "18px" }} />
  Notifications
</button>

                <div className="sidebar-bottom">
                <button className="sidebar-btn signout-btn" onClick={handleSignOut}>
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
            <div className="topbar-left">
                <h2>Notifications</h2>
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


{showEditProfileModal && (
  <div className="modal-overlay">
    <div className="add-record-modal profile-modal">

      <div className="modal-header">
        <h3>Edit Profile</h3>
<span
  className="close-x"
  onClick={profileComplete ? () => {
    setEditProfileData(profileData); // reset changes
    setShowEditProfileModal(false);  // close modal
  } : undefined}
  style={{
    cursor: profileComplete ? "pointer" : "not-allowed",
    opacity: profileComplete ? 1 : 0.5,
    pointerEvents: profileComplete ? "auto" : "none"
  }}
  title={!profileComplete ? "Please complete your profile first" : "Close"}
>
  ✕
</span>
      </div>

      <div className="modal-body">

        {/* Profile Image */}
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

        {/* Name */}
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

        {/* Email (Read Only) */}
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
  disabled={savingProfile || !editProfileData.name.trim()} // Remove municipality check
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

          {/* NOTIFICATION TABLE - REPLACED WITH NEW TABLE */}
          <div className={style.tableBox}>
            <div className={style.tableWrapper}
            style={{ maxHeight: sidebarOpen ? 'calc(100vh - 175px)' : 'calc(100vh - 200px)', overflowY: "auto" }}>
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
      {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''} • 
      Showing {notificationIndexOfFirstItem + 1}-{Math.min(notificationIndexOfLastItem, notificationAllItems.length)} of {notificationAllItems.length}
    </span>
    
    {/* ADD THIS BUTTON */}
    {unreadCount > 0 && (
      <button
        onClick={markAllAsRead}
        style={{
          background: "none",
          border: "none",
          color: "#0066cc",
          fontSize: "12px",
          cursor: "pointer",
          textDecoration: "underline",
          padding: "4px 8px"
        }}
      >
        Mark all as read
      </button>
    )}
  </div>
)}

              {/* Table */}
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
                    {notificationLoading ? (
                      <tr>
                        <td colSpan="4" style={{ padding: "30px", textAlign: "center", color: "#666" }}>
                          Loading...
                        </td>
                      </tr>
                    ) : notificationAllItems.length > 0 ? (
                      notificationCurrentItems.map((item, index) => (
                        <tr 
                          key={item.id || index}
                          style={{
                            backgroundColor: item.read ? "white" : "#f9f9f9",
                            borderBottom: "1px solid #eee"
                          }}
                        >
                          <td style={{ 
                            padding: "10px 12px", 
                            color: "#333",
                            borderRight: "1px solid #eee"
                          }}>
                            {notificationIndexOfFirstItem + index + 1}
                          </td>

                          <td style={{ 
                            padding: "10px 12px",
                            color: "#000000",
                            borderRight: "1px solid #eee",
                            textAlign: "left"
                          }}>
                            <div>
                              <span style={{ 
                                fontWeight: item.read ? "normal" : "500",
                                color: item.read ? "#666" : "#000000"
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
                            {formatDate(item.timestamp)}
                          </td>
                          
<td style={{ 
  padding: "10px 12px", 
  textAlign: "center"
}}>
  <div style={{ display: "flex", gap: "5px", justifyContent: "center" }}>
    {/* ADD THIS MARK AS READ BUTTON - only show if not read */}
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
                
                {/* Pagination */}
                {notificationTotalPages > 1 && (
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    gap: "10px",
                    marginTop: "20px",
                    padding: "10px"
                  }}>
                    <button
                      onClick={notificationPrevPage}
                      disabled={notificationCurrentPage === 1}
                      style={{
                        padding: "5px 10px",
                        backgroundColor: notificationCurrentPage === 1 ? "#ccc" : "#0c1a4b",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: notificationCurrentPage === 1 ? "not-allowed" : "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Previous
                    </button>
                    
                    <span style={{ fontSize: "13px", color: "#666" }}>
                      Page {notificationCurrentPage} of {notificationTotalPages}
                    </span>
                    
                    <button
                      onClick={notificationNextPage}
                      disabled={notificationCurrentPage === notificationTotalPages}
                      style={{
                        padding: "5px 10px",
                        backgroundColor: notificationCurrentPage === notificationTotalPages ? "#ccc" : "#0c1a4b",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: notificationCurrentPage === notificationTotalPages ? "not-allowed" : "pointer",
                        fontSize: "12px"
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    )
  }
  </>
)};