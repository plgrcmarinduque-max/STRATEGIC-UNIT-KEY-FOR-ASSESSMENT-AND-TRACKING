import React, { useState, useEffect, useMemo } from "react";
import { db, auth} from "src/firebase";
import style from "src/MLGO-CSS/mlgo-dashboard.module.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiFilter, FiRotateCcw, FiLogOut, FiBell } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, onValue, set, get } from "firebase/database";

export default function MLGO() {
  const [currentPage, setCurrentPage] = useState(1);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileComplete, setProfileComplete] = useState(false);
  const rowsPerPage = 10;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [search, setSearch] = useState("");
  const [adminUid, setAdminUid] = useState(null);
  const user = auth.currentUser;
  const displayName = user?.email || "User";
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  
  const [editProfileData, setEditProfileData] = useState({
    name: "",
    municipality: "",
    email: displayName,
    image: ""
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    municipality: "",
    email: displayName,
    image: ""
  });
  const [filters, setFilters] = useState({
    year: "",
    status: "",
  });

  const [municipalityMap, setMunicipalityMap] = useState({});
  const [currentUserMunicipality, setCurrentUserMunicipality] = useState("");
  const [years, setYears] = useState([]);
  const [verifiedSubmissions, setVerifiedSubmissions] = useState([]);

  // Fetch unread notifications count
  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchUnreadCount = async () => {
      try {
        const userUid = auth.currentUser.uid;
        const notificationsRootRef = ref(db, `notifications`);
        const rootSnapshot = await get(notificationsRootRef);
        
        let count = 0;
        
        if (rootSnapshot.exists()) {
          const yearsData = rootSnapshot.val();
          
          Object.keys(yearsData).forEach(year => {
            const yearData = yearsData[year];
            if (yearData.MLGO && yearData.MLGO[userUid]) {
              const yearNotifications = yearData.MLGO[userUid];
              Object.keys(yearNotifications).forEach(key => {
                if (!yearNotifications[key].read) {
                  count++;
                }
              });
            }
          });
        }
        
        setUnreadCount(count);
      } catch (error) {
        console.error("Error fetching unread count:", error);
      }
    };

    fetchUnreadCount();
    
    const notificationsRef = ref(db, `notifications`);
    const unsubscribe = onValue(notificationsRef, () => {
      fetchUnreadCount();
    });
    
    return () => unsubscribe();
  }, [auth.currentUser?.uid]);

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
      } finally {
        setLoading(false);
      }
    };

    fetchAdminUid();
  }, []);

  // Get current user's profile and municipality
  useEffect(() => {
    if (!auth.currentUser) return;

    const profileRef = ref(db, `profiles/${auth.currentUser.uid}`);
    onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const profile = snapshot.val();
        setProfileData(profile);
        setEditProfileData(profile);
        
        if (profile.municipality) {
          setCurrentUserMunicipality(profile.municipality);
        }

        if (profile.name && profile.municipality) {
          setProfileComplete(true);
          setShowEditProfileModal(false);
        } else {
          setProfileComplete(false);
          setShowEditProfileModal(true);
        }
      } else {
        setProfileComplete(false);
        setShowEditProfileModal(true);
      }
    });
  }, []);

  // Fetch all profiles for municipality mapping
  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchProfiles = async () => {
      try {
        const profilesRef = ref(db, "profiles");
        const profilesSnapshot = await get(profilesRef);
        
        if (profilesSnapshot.exists()) {
          const profiles = profilesSnapshot.val();
          const munMap = {};
          
          Object.keys(profiles).forEach(uid => {
            const profile = profiles[uid];
            if (profile.municipality) {
              munMap[uid] = profile.municipality;
            }
          });
          
          setMunicipalityMap(munMap);
        }
      } catch (error) {
        console.error("Error fetching profiles:", error);
      }
    };

    fetchProfiles();
  }, []);

  // Fetch years from admin
  useEffect(() => {
    if (!auth.currentUser || !adminUid) return;

    const yearsRef = ref(db, `years/${adminUid}`);
    onValue(yearsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        let yearsArray = [];
        if (Array.isArray(data)) {
          yearsArray = data;
        } else if (typeof data === "object" && data !== null) {
          yearsArray = Object.keys(data);
        }
        setYears(yearsArray);
      }
    });
  }, [adminUid]);

  // Fetch verified submissions
  useEffect(() => {
    if (!auth.currentUser || !currentUserMunicipality) return;

    const fetchVerifiedSubmissions = () => {
      const verifiedRef = ref(db, `verified`);
      
      onValue(verifiedRef, (snapshot) => {
        if (snapshot.exists()) {
          const allVerified = snapshot.val();
          const verifiedList = [];

          Object.keys(allVerified).forEach(year => {
            if (allVerified[year]?.LGU) {
              Object.keys(allVerified[year].LGU).forEach(lguName => {
                const lguData = allVerified[year].LGU[lguName];
                
                // Check if this verified submission belongs to current user's municipality
                if (lguData.municipality === currentUserMunicipality) {
                  verifiedList.push({
                    year: year,
                    status: "Verified",
                    submission: lguData.submission || "N/A",
                    deadline: lguData.deadline || "Not set",
                    lguName: lguName,
                    data: lguData.originalData || {},
                    municipality: lguData.municipality,
                    userUid: lguData.lguUid,
                    isVerified: true,
                    verifiedBy: lguData.verifiedBy,
                    verifiedAt: lguData.verifiedAt
                  });
                }
              });
            }
          });

          setVerifiedSubmissions(verifiedList);
        }
      });
    };

    fetchVerifiedSubmissions();
  }, [currentUserMunicipality]);

  // Fetch pending/returned submissions (answers)
  useEffect(() => {
    if (!auth.currentUser || !currentUserMunicipality) return;

    const fetchSubmissions = () => {
      const answersRef = ref(db, `answers`);
      
      onValue(answersRef, (snapshot) => {
        if (snapshot.exists()) {
          const allAnswers = snapshot.val();
          const submissionsList = [];
          let counter = 1;

          Object.keys(allAnswers).forEach(year => {
            if (allAnswers[year]?.LGU) {
              Object.keys(allAnswers[year].LGU).forEach(lguName => {
                const lguData = allAnswers[year].LGU[lguName];
                
                if (lguData._metadata) {
                  const userUid = lguData._metadata.uid;
                  
                  let municipality = "";
                  if (lguData._metadata.municipality) {
                    municipality = lguData._metadata.municipality;
                  } else if (userUid && municipalityMap[userUid]) {
                    municipality = municipalityMap[userUid];
                  }

                  if (municipality === currentUserMunicipality) {
                    submissionsList.push({
                      id: counter++,
                      year: year,
                      status: lguData._metadata.returned ? "Returned" : 
                              lguData._metadata.submitted ? "Pending" : "Draft",
                      submission: lguData._metadata.lastSaved 
                        ? new Date(lguData._metadata.lastSaved).toLocaleDateString('en-US', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })
                        : "N/A",
                      deadline: "Not set",
                      lguName: lguName,
                      data: lguData,
                      municipality: municipality,
                      userUid: userUid,
                      isVerified: false
                    });
                  }
                }
              });
            }
          });

          setSubmissions(submissionsList);
        } else {
          setSubmissions([]);
        }
        setLoading(false);
      });
    };

    fetchSubmissions();
  }, [currentUserMunicipality, municipalityMap]);

  // Fetch deadlines
  useEffect(() => {
    if (!auth.currentUser || !adminUid) return;

    const fetchDeadlines = async () => {
      try {
        const deadlinesRef = ref(db, `financial/${adminUid}`);
        
        onValue(deadlinesRef, (snapshot) => {
          if (snapshot.exists()) {
            const financialData = snapshot.val();
            const deadlinesMap = {};
            
            Object.keys(financialData).forEach(year => {
              if (financialData[year]?.metadata?.deadline) {
                deadlinesMap[year] = financialData[year].metadata.deadline;
              }
            });
            
            // Update pending submissions with deadlines
            setSubmissions(prev => prev.map(item => ({
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

  // Combine all submissions (pending + verified) - REMOVING VERIFIED PENDING ITEMS
  const allSubmissions = useMemo(() => {
    // Create a Set of verified item keys for quick lookup
    const verifiedKeys = new Set(
      verifiedSubmissions.map(v => `${v.year}-${v.lguName}-${v.municipality}`)
    );
    
    // Filter out pending items that have been verified
    const filteredPending = submissions.filter(pending => 
      !verifiedKeys.has(`${pending.year}-${pending.lguName}-${pending.municipality}`)
    );
    
    // Combine filtered pending with verified
    const combined = [...filteredPending, ...verifiedSubmissions];
    
    // Sort by year descending (newest first)
    return combined.sort((a, b) => b.year - a.year);
  }, [submissions, verifiedSubmissions]);

  const handleView = (item) => {
    if (item.isVerified) {
      navigate("/mlgo-view", { 
        state: { 
          year: item.year,
          lguName: item.lguName,
          lguData: item.data,
          municipality: item.municipality,
          lguUid: item.userUid,
          isVerified: true,
          verifiedBy: item.verifiedBy,
          verifiedAt: item.verifiedAt
        } 
      });
    } else {
      navigate("/mlgo-view", { 
        state: { 
          year: item.year,
          lguName: item.lguName,
          lguData: item.data,
          municipality: item.municipality,
          lguUid: item.userUid,
          isVerified: false
        } 
      });
    }
  };

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;

    if (!editProfileData.name.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!editProfileData.municipality.trim()) {
      alert("Please select your municipality");
      return;
    }

    try {
      setSavingProfile(true);

      await set(ref(db, `profiles/${auth.currentUser.uid}`), {
        ...editProfileData,
        email: auth.currentUser.email
      });

      setProfileData(editProfileData);
      setProfileComplete(true);
      
      if (editProfileData.municipality) {
        setCurrentUserMunicipality(editProfileData.municipality);
      }

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

  const municipalities = ["Boac", "Mogpog", "Sta. Cruz", "Torrijos", "Buenavista", "Gasan"];
  const statuses = ["Verified", "Pending", "Returned"];

  const updateFilter = (type, value) => {
    setFilters({ ...filters, [type]: value });
    setOpenDropdown(null);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ municipality: "", year: "", status: "" });
    setCurrentPage(1);
  };

  // Filter submissions
  const filteredData = allSubmissions.filter((item) => {
    const matchesYear = !filters.year || item.year === filters.year;
    const matchesStatus = !filters.status || item.status === filters.status;
    const matchesSearch = search === "" || 
      item.year.toLowerCase().includes(search.toLowerCase()) ||
      item.lguName?.toLowerCase().includes(search.toLowerCase());
    
    return matchesYear && matchesStatus && matchesSearch;
  }).map((item, index) => ({ ...item, id: index + 1 })); // Reassign sequential IDs

  // Pagination
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
                  <h3>ONE <span className="yellow">MAR</span><span className="cyan">IND</span>
                  <span className="red">UQUE</span> TRACKING SYSTEM</h3>
                  <div className="sidebar-divider"></div>
                </>
              )}
            </div>

            {sidebarOpen && (
              <>
                <p className="filter-title">
                  <FiFilter style={{ marginRight: "10px", verticalAlign: "middle" }} />
                  FILTER
                  <button className="clear-icon-btn" onClick={clearFilters} aria-label="Clear Filters">
                    <FiRotateCcw />
                  </button>
                </p>

                {openDropdown && (
                  <div className="dropdown-overlay" onClick={() => setOpenDropdown(null)}></div>
                )}

                <div className="filter-item">
                  <div className="filter-btn" onClick={() => setOpenDropdown(openDropdown === "year" ? null : "year")}>
                    Year {filters.year && `: ${filters.year}`}
                    <span className="arrow" style={{ pointerEvents: "none" }}>
                      {openDropdown === "year" ? "▲" : "▼"}
                    </span>
                  </div>
                  {openDropdown === "year" && renderDropdown("year", years)}
                </div>

                <div className="filter-item">
                  <div className="filter-btn" onClick={() => setOpenDropdown(openDropdown === "status" ? null : "status")}>
                    Status {filters.status && `: ${filters.status}`}
                    <span className="arrow" style={{ pointerEvents: "none" }}>
                      {openDropdown === "status" ? "▲" : "▼"}
                    </span>
                  </div>
                  {openDropdown === "status" && renderDropdown("status", statuses)}
                </div>

                <button className={style.sidebarMenuItem} onClick={() => navigate("/mlgo-notification")}>
                  <FiBell style={{ marginRight: "8px", fontSize: "18px" }} />
                  Notifications
                  {unreadCount > 0 && (
                    <span style={{
                      backgroundColor: "#dc3545",
                      color: "white",
                      borderRadius: "12px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      marginLeft: "8px",
                      fontWeight: "bold"
                    }}>
                      {unreadCount}
                    </span>
                  )}
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
              <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ cursor: "pointer" }}>
                {sidebarOpen ? "☰" : "✖"}
              </button>
              <div className="topbar-left">
                <h2>Provincial Assessment</h2>
              </div>

              <div className="top-right">
                <div className="profile-container">
                  <div className="profile" onClick={() => setShowProfileModal(true)} style={{ cursor: "pointer" }}>
                    <div className="avatar">
                      {profileData.image ? (
                        <img src={profileData.image} alt="avatar" style={{
                          width: "60px",
                          height: "60px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "7px solid #0c1a4b",
                        }} />
                      ) : (
                        "👤"
                      )}
                    </div>
                    <span>{profileData.name || displayName}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className={style.tableBox}>
              <div className={style.tableWrapper}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>YEAR</th>
                      <th>STATUS</th>
                      <th>Submission Date</th>
                      <th>Submission Deadline</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.length > 0 ? (
                      currentRows.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{item.year}</td>
                          <td>
                            <span className={`${style.status} ${item.isVerified ? style.verifieD : style[item.status?.toLowerCase()]}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>{item.submission}</td>
                          <td>{item.deadline}</td>
                          <td className="actions">
                            <button className={style.btnView} onClick={() => handleView(item)}>
                              View 👁
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center", padding: "20px" }}>
                          {currentUserMunicipality 
                            ? `No submissions found for ${currentUserMunicipality} municipality`
                            : "Please complete your profile to view submissions"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className={style.tableFooter}>
                {filteredData.length === 0 ? (
                  "Showing 0–0 of 0 items"
                ) : (
                  <>
                    Showing {indexOfFirstRow + 1}–{Math.min(indexOfLastRow, filteredData.length)} of {filteredData.length} items
                  </>
                )}
                <div className={style.pageButtons}>
                  <button disabled={filteredData.length === 0 || currentPage === 1} onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}>
                    ◀
                  </button>

                  <input
                    max={totalPages || 1}
                    value={filteredData.length === 0 ? 0 : currentPage}
                    disabled={filteredData.length === 0}
                    onChange={(e) => {
                      if (filteredData.length === 0) return;
                      let value = Number(e.target.value);
                      if (value < 1) value = 1;
                      if (value > totalPages) value = totalPages;
                      setCurrentPage(value);
                    }}
                    className={style.pageInput}
                  />

                  <span>of {totalPages}</span>

                  <button disabled={filteredData.length === 0 || currentPage === totalPages} onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}>
                    ▶
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Modals */}
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
                  <button className="profile-btn" onClick={() => {
                    setShowProfileModal(false);
                    setShowEditProfileModal(true);
                  }}>
                    Edit Profile
                  </button>
                  <button className="profile-btn signout" onClick={handleSignOut}>
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
                <span className="close-x" onClick={profileComplete ? () => {
                  setEditProfileData(profileData);
                  setShowEditProfileModal(false);
                } : undefined} style={{
                  cursor: profileComplete ? "pointer" : "not-allowed",
                  opacity: profileComplete ? 1 : 0.5,
                  pointerEvents: profileComplete ? "auto" : "none"
                }} title={!profileComplete ? "Please complete your profile first" : "Close"}>
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
                    <button type="button" className="remove-photo-btn" onClick={() => setEditProfileData({ ...editProfileData, image: "" })}>
                      Remove
                    </button>
                  </div>
                )}
                <div className="modal-field">
                  <label>Name:</label>
                  <input type="text" value={editProfileData.name} onChange={(e) => setEditProfileData({ ...editProfileData, name: e.target.value })} />
                </div>
                <div className="modal-field">
                  <label>Municipality:</label>
                  <select value={editProfileData.municipality} onChange={(e) => setEditProfileData({ ...editProfileData, municipality: e.target.value })} disabled={profileComplete} style={{ 
                    width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc",
                    backgroundColor: profileComplete ? "#f5f5f5" : "white",
                    cursor: profileComplete ? "not-allowed" : "pointer", opacity: profileComplete ? 0.7 : 1
                  }} title={profileComplete ? "Municipality cannot be changed after initial setup" : "Select your municipality"}>
                    <option value="">Select Municipality</option>
                    {municipalities.map((municipality) => (
                      <option key={municipality} value={municipality}>{municipality}</option>
                    ))}
                  </select>
                </div>
                <div className="modal-field">
                  <label>Email:</label>
                  <input type="text" value={auth.currentUser?.email || ""} disabled style={{ background: "#f1f1f1", cursor: "not-allowed" }} />
                </div>
                <div className="modal-footer">
                  <button className="save-profile-btn" onClick={handleSaveProfile} disabled={savingProfile || !editProfileData.name.trim() || !editProfileData.municipality.trim()}>
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )}
    </>
  );
}