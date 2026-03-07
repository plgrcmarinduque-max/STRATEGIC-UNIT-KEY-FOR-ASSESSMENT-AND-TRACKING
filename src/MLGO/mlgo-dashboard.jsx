import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import style from "src/MLGO-CSS/mlgo-dashboard.module.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiFilter, FiRotateCcw, FiSettings, FiLogOut, FiFileText, FiBell, FiArrowRight, FiEye } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, push, onValue, set, get } from "firebase/database";



export default function MLGO() {

  const [currentPage, setCurrentPage] = useState(1);
  const [lguAnswers, setLguAnswers] = useState([]);
  const [filteredLguAnswers, setFilteredLguAnswers] = useState([]); // NEW: Store filtered results
  const navigate = useNavigate();
  const location = useLocation();
const [verifiedLguAnswers, setVerifiedLguAnswers] = useState([]);
const [loadingVerified, setLoadingVerified] = useState(true);
const [unreadCount, setUnreadCount] = useState(0);
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

// Fetch unread notifications count for MLGO
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
          // Look for notifications under MLGO with the user's UID
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
      console.log("Unread count for MLGO:", count);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  fetchUnreadCount();
  
  // Set up a listener for changes
  const notificationsRef = ref(db, `notifications`);
  const unsubscribe = onValue(notificationsRef, () => {
    fetchUnreadCount();
  });
  
  return () => unsubscribe();
}, [auth.currentUser?.uid]);
// Fetch verified assessments from database
useEffect(() => {
  if (!auth.currentUser || !adminUid) return;

  const fetchVerifiedAnswers = async () => {
    try {
      console.log("Fetching verified assessments...");
      setLoadingVerified(true);
      
      const verifiedRef = ref(db, `verified`);
      
      onValue(verifiedRef, (snapshot) => {
        if (snapshot.exists()) {
          const allVerified = snapshot.val();
          const verifiedList = [];
          let counter = 1000; // Start with high numbers to avoid ID conflicts
          
          // Iterate through years
          Object.keys(allVerified).forEach(year => {
            // Iterate through LGUs under each year
            if (allVerified[year] && allVerified[year].LGU) {
              Object.keys(allVerified[year].LGU).forEach(lguName => {
                const lguData = allVerified[year].LGU[lguName];
                
                // Get municipality from the data
                let municipality = lguData.municipality || "Unknown";
                let userUid = lguData.lguUid || "No UID";
                
                verifiedList.push({
                  id: counter++,
                  year: year,
                  status: "Verified",
                  submission: lguData.submission || "N/A",
                  deadline: lguData.deadline || "Not set",
                  lguName: lguName,
                  data: lguData.originalData || {},
                  municipality: municipality,
                  userUid: userUid,
                  verifiedBy: lguData.verifiedBy,
                  verifiedAt: lguData.verifiedAt,
                  isVerified: true,
                  type: "verified"
                });
              });
            }
          });
          
          console.log("Verified assessments loaded:", verifiedList);
          setVerifiedLguAnswers(verifiedList);
          
        } else {
          console.log("No verified assessments found");
          setVerifiedLguAnswers([]);
        }
        setLoadingVerified(false);
      });
    } catch (error) {
      console.error("Error fetching verified assessments:", error);
      setLoadingVerified(false);
    }
  };

  fetchVerifiedAnswers();
}, [adminUid]);

const getAllData = () => {
  // Start with filtered LGU answers (pending/returned)
  const baseData = filteredLguAnswers || [];
  
  // Add verified assessments that match the current user's municipality
  const verifiedForUser = verifiedLguAnswers.filter(item => 
    item.municipality === currentUserMunicipality
  );
  
  // Create a map to track which years/municipalities have verified versions
  const verifiedKeys = new Set();
  verifiedForUser.forEach(verified => {
    verifiedKeys.add(`${verified.year}-${verified.municipality}`);
  });
  
  // Filter out pending items that have a verified version
  const filteredBaseData = baseData.filter(item => {
    const key = `${item.year}-${item.municipality}`;
    return !verifiedKeys.has(key);
  });
  
  // Combine both arrays
  const combined = [...verifiedForUser, ...filteredBaseData];
  
  // Assign new sequential IDs starting from 1
  return combined.map((item, index) => ({
    ...item,
    id: index + 1
  }));
};



  const [data, setData] = useState([]);

  // NEW: State to store municipality mappings (from profiles node)
  const [municipalityMap, setMunicipalityMap] = useState({});
  
  // NEW: State to store the current user's municipality (the logged-in MLGO user)
  const [currentUserMunicipality, setCurrentUserMunicipality] = useState("");

useEffect(() => {
  if (!auth.currentUser) return;

  const profileRef = ref(db, `profiles/${auth.currentUser.uid}`);
  onValue(profileRef, (snapshot) => {
    if (snapshot.exists()) {
      const profile = snapshot.val();
      setProfileData(profile);
      setEditProfileData(profile);
      
      // NEW: Store the current user's municipality
      if (profile.municipality) {
        setCurrentUserMunicipality(profile.municipality);
        console.log("Current user municipality:", profile.municipality);
      }

      // Check if profile has required fields
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

// NEW: Fetch all profiles to get municipality names
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
        
        console.log("Municipality map:", munMap);
        setMunicipalityMap(munMap);
      }
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  fetchProfiles();
}, []);

// Fetch LGU answers from database
useEffect(() => {
  if (!auth.currentUser || !adminUid) return;

  const fetchLGUAnswers = async () => {
    try {
      console.log("Fetching LGU answers...");
      
      const answersRef = ref(db, `answers`);
      
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
                let userUid = "No UID";
                let municipality = "Unknown";
                
                if (lguData._metadata) {
                  userUid = lguData._metadata.uid || "No UID";
                  
                  // NEW: Get municipality from municipalityMap using the UID
                  if (userUid !== "No UID" && municipalityMap[userUid]) {
                    municipality = municipalityMap[userUid];
                  }
                  
                  if (lguData._metadata.submitted) {
                    status = "Pending";
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
                  
                  // Check if returned
                  if (lguData._metadata.returned) {
                    status = "Returned";
                  }
                }
                
                answersList.push({
                  id: counter++,
                  year: year,
                  status: status,
                  submission: submissionDate,
                  deadline: "deadline",
                  lguName: lguName,
                  data: lguData,
                  municipality: municipality, // Store the municipality
                  userUid: userUid
                });
              });
            }
          });
          
          console.log("LGU Answers loaded:", answersList);
          setLguAnswers(answersList);
          
          // NEW: Apply filtering based on municipality match
          filterByMunicipalityMatch(answersList, currentUserMunicipality);
        } else {
          console.log("No answers found");
          setLguAnswers([]);
          setFilteredLguAnswers([]);
        }
      });
    } catch (error) {
      console.error("Error fetching LGU answers:", error);
    }
  };

  fetchLGUAnswers();
}, [adminUid, municipalityMap]); // Add municipalityMap as dependency

// NEW: Function to filter LGUs where user municipality matches current user's municipality
const filterByMunicipalityMatch = (answers, currentUserMun) => {
  if (!answers || answers.length === 0 || !currentUserMun) {
    setFilteredLguAnswers([]);
    return;
  }
  
  console.log(`Filtering for municipality match: ${currentUserMun}`);
  
  const filtered = answers.filter(item => {
    // Only show items where the municipality matches the current user's municipality
    const matchesMunicipality = item.municipality === currentUserMun;
    
    if (matchesMunicipality) {
      console.log(`✅ Match found: ${item.lguName} - Municipality: ${item.municipality} = Current: ${currentUserMun}`);
    }
    
    return matchesMunicipality;
  });
  
  console.log(`Filtered from ${answers.length} to ${filtered.length} items`);
  setFilteredLguAnswers(filtered);
};

// NEW: Re-filter when current user municipality changes
useEffect(() => {
  if (lguAnswers.length > 0 && currentUserMunicipality) {
    filterByMunicipalityMatch(lguAnswers, currentUserMunicipality);
  }
}, [currentUserMunicipality, lguAnswers]);

// Fetch deadlines from admin for each year
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
            if (financialData[year] && financialData[year].metadata && financialData[year].metadata.deadline) {
              deadlinesMap[year] = financialData[year].metadata.deadline;
            }
          });
          
          console.log("Deadlines loaded:", deadlinesMap);
          
          // Update both lguAnswers and filteredLguAnswers with deadlines
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
          
          setFilteredLguAnswers(prev => prev.map(item => ({
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


// Receive forwarded data from mlgo-view
useEffect(() => {
  if (location.state?.forwardedData && location.state?.fromView) {
    // Add the forwarded data to the table
    setLguAnswers(prev => {
      // Check if it already exists to avoid duplicates
      const exists = prev.some(item => 
        item.lguName === location.state.forwardedData.lguName && 
        item.year === location.state.forwardedData.year
      );
      
      if (!exists) {
        const updated = [location.state.forwardedData, ...prev];
        
        // Re-filter with new data
        if (currentUserMunicipality) {
          filterByMunicipalityMatch(updated, currentUserMunicipality);
        }
        
        return updated;
      }
      return prev;
    });
    
    // Clear the state so it doesn't get added again on refresh
    navigate("/mlgo-dashboard", { replace: true, state: {} });
  }
}, [location, currentUserMunicipality]);


const handleSaveProfile = async () => {
  if (!auth.currentUser) return;

  // ADD VALIDATION
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
    
    // NEW: Update current user municipality when profile is saved
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



const handleView = (item) => {
  console.log("View:", item);
  
  // Check if this is a verified assessment
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
        verifiedAt: item.verifiedAt,
        remarks: ""
      } 
    });
  } else {
    // Handle pending/returned assessments (existing logic)
    const isReturnedFromPO = item.data?._metadata?.returnedToMLGO === true;
    const returnRemarks = item.data?._metadata?.remarks || "";
    const lguUid = item.userUid || item.data?._metadata?.uid || "No UID";
    
    navigate("/mlgo-view", { 
      state: { 
        year: item.year,
        lguName: item.lguName,
        lguData: item.data,
        municipality: item.municipality,
        lguUid: lguUid,
        returnedFromPO: isReturnedFromPO,
        remarks: returnRemarks
      } 
    });
  }
};





const filterLGUAnswersByRole = (answers, role, municipality) => {
  if (!answers) return [];
  
  const answersList = [];
  let counter = 1;
  
  console.log(`Filtering answers for role: ${role}, municipality: ${municipality}`);
  
  Object.keys(answers).forEach(lguName => {
    const lguData = answers[lguName];
    
    // For MLGO (sub-admin), show ALL assessments including returned ones
    // Don't skip if forwarded - we want to see all
    if (role === "sub-admin") {
      // Sub-admin sees ALL LGUs including returned ones
      console.log(`Sub-admin viewing LGU: ${lguName}`);
    } else if (role === "user") {
      // Regular user (LGU) - ONLY see their own municipality
      if (lguName.toLowerCase() !== municipality.toLowerCase()) {
        console.log(`User skipping ${lguName} - not their municipality (${municipality})`);
        return; // Skip this LGU
      }
    }
    
    // Determine status based on metadata
    let status = "Pending";
    let submissionDate = "Not submitted";
    let submittedBy = "Unknown";
    
    if (lguData._metadata) {
      submittedBy = lguData._metadata.name || lguData._metadata.email || "Unknown";
      
      // Check if returned from PO
      if (lguData._metadata.returnedFromPO) {
        status = "Returned by PO"; // Show this status for MLGO
        submissionDate = lguData._metadata.returnedAt 
          ? new Date(lguData._metadata.returnedAt).toLocaleDateString('en-US', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })
          : "Recently";
      }
      // Check if returned to MLGO
      else if (lguData._metadata.returnedToMLGO) {
        status = "Returned to MLGO";
        submissionDate = lguData._metadata.returnedAt 
          ? new Date(lguData._metadata.returnedAt).toLocaleDateString('en-US', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            })
          : "Recently";
      }
      // Check if submitted
      else if (lguData._metadata.submitted) {
        status = "Pending Verification";
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
      lguName: lguName,
      year: selectedYear,
      status: status,
      submission: submissionDate,
      submittedBy: submittedBy,
      deadline: submissionDeadline ? new Date(submissionDeadline).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      }) : "Not set",
      data: lguData,
      municipality: lguName,
      lguUid: lguData._metadata?.uid || "Unknown"
    });
  });
  
  return answersList;
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
  
  const statuses = ["Verified", "Pending", "Returned"]; // Added Returned status

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



const getFilteredData = () => {
  const combinedData = getAllData();
  
  return combinedData.filter((item) => {
    // Apply filters
    const matchesYear = !filters.year || item.year === filters.year;
    const matchesStatus = !filters.status || item.status.toLowerCase() === filters.status.toLowerCase();
    const matchesSearch = search === "" || 
      item.year.toLowerCase().includes(search.toLowerCase()) ||
      item.lguName?.toLowerCase().includes(search.toLowerCase()) ||
      item.municipality?.toLowerCase().includes(search.toLowerCase());
    
    return matchesYear && matchesStatus && matchesSearch;
  });
};

const displayData = getFilteredData();



/* Pagination Logic */
const indexOfLastRow = currentPage * rowsPerPage;
const indexOfFirstRow = indexOfLastRow - rowsPerPage;
const currentRows = displayData.slice(indexOfFirstRow, indexOfLastRow);
const totalPages = Math.ceil(displayData.length / rowsPerPage);

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
    {loading || loadingVerified ? (
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
  
              {/* Dropdown Overlay */}
              {openDropdown && (
                <div
                  className="dropdown-overlay"
                  onClick={() => setOpenDropdown(null)}
                ></div>
              )}

              <div className="filter-item">
                <div
                  className="filter-btn"
                  onClick={() => setOpenDropdown(openDropdown === "year" ? null : "year")}
                >
                  Year {filters.year && `: ${filters.year}`}
                  <span className="arrow" style={{ pointerEvents: "none" }}>
                    {openDropdown === "year" ? "▲" : "▼"}
                  </span>
                </div>
                {openDropdown === "year" && renderDropdown("year", years)}
              </div>

              <div className="filter-item">
                <div
                  className="filter-btn"
                  onClick={() => setOpenDropdown(openDropdown === "status" ? null : "status")}
                >
                  Status {filters.status && `: ${filters.status}`}
                  <span className="arrow" style={{ pointerEvents: "none" }}>
                    {openDropdown === "status" ? "▲" : "▼"}
                  </span>
                </div>
                {openDropdown === "status" && renderDropdown("status", statuses)}
              </div>

                            <button
                              className={style.sidebarMenuItem}
                              onClick={() => navigate("/mlgo-notification")}
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

<div className="modal-field">
  <label>Municipality:</label>
  <select
    value={editProfileData.municipality}
    onChange={(e) =>
      setEditProfileData({ ...editProfileData, municipality: e.target.value })
    }
    disabled={profileComplete} // Disabled when profile is complete (editing mode)
    style={{ 
      width: "100%", 
      padding: "8px", 
      borderRadius: "4px", 
      border: "1px solid #ccc",
      backgroundColor: profileComplete ? "#f5f5f5" : "white",
      cursor: profileComplete ? "not-allowed" : "pointer",
      opacity: profileComplete ? 0.7 : 1
    }}
    title={profileComplete ? "Municipality cannot be changed after initial setup" : "Select your municipality"}
  >
    <option value="">Select Municipality</option>
    {municipalities.map((municipality) => (
      <option key={municipality} value={municipality}>
        {municipality}
      </option>
    ))}
  </select>
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
  disabled={savingProfile || !editProfileData.name.trim() || !editProfileData.municipality.trim()}
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

{/* Table - EXACTLY THE SAME STRUCTURE, NO ADDED COLUMNS */}
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
        currentRows.map((item) =>  (
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
  {displayData.length === 0 ? (
    "Showing 0–0 of 0 items"
  ) : (
    <>
      Showing {indexOfFirstRow + 1}–
      {Math.min(indexOfLastRow, displayData.length)} of {displayData.length} items
    </>
  )}
  <div className={style.pageButtons}>
    <button
      disabled={displayData.length === 0 || currentPage === 1}
      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
    >
      ◀
    </button>

    <input
      max={totalPages || 1}
      value={displayData.length === 0 ? 0 : currentPage}
      disabled={displayData.length === 0}
      onChange={(e) => {
        if (displayData.length === 0) return;
        let value = Number(e.target.value);
        if (value < 1) value = 1;
        if (value > totalPages) value = totalPages;
        setCurrentPage(value);
      }}
      className={style.pageInput}
    />

    <span>of {totalPages}</span>

    <button
      disabled={displayData.length === 0 || currentPage === totalPages}
      onClick={() =>
        setCurrentPage((prev) => Math.min(prev + 1, totalPages))
      }
    >
      ▶
    </button>
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