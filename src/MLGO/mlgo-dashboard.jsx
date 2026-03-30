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
  const [refreshTrigger, setRefreshTrigger] = useState(0);
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
    assessment: "" // Add assessment filter
  });

  const [municipalityMap, setMunicipalityMap] = useState({});
  const [currentUserMunicipality, setCurrentUserMunicipality] = useState("");
  const [years, setYears] = useState([]);
  const [verifiedSubmissions, setVerifiedSubmissions] = useState([]);
  const [returnedSubmissions, setReturnedSubmissions] = useState([]); // NEW: Store returned assessments
  const [assessmentList, setAssessmentList] = useState([]); // Store assessments

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

  

  useEffect(() => {
    if (location.state?.refreshNeeded) {
      console.log("Refresh needed - incrementing refresh trigger");
      // Increment refresh trigger to force data reload
      setRefreshTrigger(prev => prev + 1);
      
      // Clear the state so we don't keep refreshing
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate]);

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

  // Fetch assessments from admin
  useEffect(() => {
    if (!auth.currentUser || !adminUid) return;

    const assessmentsRef = ref(db, `assessments/${adminUid}`);
    
    onValue(assessmentsRef, (snapshot) => {
      if (snapshot.exists()) {
        const assessmentsData = snapshot.val();
        const list = [];
        
        // Transform the nested object structure into an array
        Object.keys(assessmentsData).forEach(year => {
          const yearData = assessmentsData[year];
          if (yearData) {
            Object.keys(yearData).forEach(assessmentId => {
              const assessment = yearData[assessmentId];
              list.push({
                id: assessmentId,
                name: assessment.name || "Untitled Assessment",
                year: year,
                description: assessment.description || "",
                createdAt: assessment.createdAt,
                status: assessment.status || "active"
              });
            });
          }
        });
        
        setAssessmentList(list);
        console.log("Loaded assessments from admin:", list);
      } else {
        setAssessmentList([]);
      }
    });
  }, [adminUid]);


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
              Object.keys(allVerified[year].LGU).forEach(lguKey => {
                const lguData = allVerified[year].LGU[lguKey];
                
                // Check if this verified submission belongs to current user's municipality
                if (lguData.municipality === currentUserMunicipality) {
                  // Only add if it has a valid assessment name (not placeholder)
                  if (lguData.assessment && lguData.assessment !== "General Assessment") {
                    verifiedList.push({
                      year: year,
                      assessmentId: lguData.assessmentId || "unknown",
                      assessment: lguData.assessment,
                      status: "Verified",
                      submission: lguData.submission || "N/A",
                      deadline: lguData.deadline || "Not set", // <-- USE THE VALUE FROM THE DATA
                      lguName: lguData.lguName || lguData.municipality,
                      data: lguData.originalData || {},
                      municipality: lguData.municipality,
                      userUid: lguData.lguUid,
                      isVerified: true,
                      verifiedBy: lguData.verifiedBy,
                      verifiedAt: lguData.verifiedAt,
                      displayName: `${lguData.municipality} - ${lguData.assessment}`
                    });
                  }
                }
              });
            }
          });
  
          console.log("Fetched verified submissions:", verifiedList);
          setVerifiedSubmissions(verifiedList);
        }
      });
    };
  
    fetchVerifiedSubmissions();
  }, [currentUserMunicipality, refreshTrigger]); // Add refreshTrigger

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
            Object.keys(allAnswers[year].LGU).forEach(lguKey => {
              const lguData = allAnswers[year].LGU[lguKey];
              
              if (lguData._metadata) {
                const userUid = lguData._metadata.uid;
                
                let municipality = "";
                if (lguData._metadata.municipality) {
                  municipality = lguData._metadata.municipality;
                } else if (userUid && municipalityMap[userUid]) {
                  municipality = municipalityMap[userUid];
                }

                if (municipality === currentUserMunicipality) {
                  // Check if forwarded FIRST - this should take precedence
                  const isForwarded = lguData._metadata.forwarded === true || 
                                     lguData._metadata.forwardedToPO === true ||
                                     lguData._metadata.status === "Forwarded";
                  
                  // Skip forwarded items entirely
                  if (isForwarded) {
                    console.log("Skipping forwarded item:", {
                      year,
                      assessment: lguData._metadata.assessment,
                      municipality,
                      status: lguData._metadata.status
                    });
                    return; // Skip this item
                  }
                  
                  let status = "Draft";

                  // First check if there's a status field in metadata
                  if (lguData._metadata.status) {
                    status = lguData._metadata.status;
                  } 
                  // Check if returned from PO (using the flag)
                  else if (lguData._metadata.returnedToMLGO === true) {
                    status = "Returned";
                  } 
                  // Check if submitted but not forwarded
                  else if (lguData._metadata.submitted === true) {
                    status = "Pending";
                  }
                  
                  submissionsList.push({
                    id: counter++,
                    year: year,
                    assessmentId: lguData._metadata.assessmentId || "unknown",
                    assessment: lguData._metadata.assessment || lguData._metadata.assessmentName || "General Assessment",
                    status: status,
                    submission: lguData._metadata.lastSaved 
                      ? new Date(lguData._metadata.lastSaved).toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })
                      : "N/A",
                    deadline: lguData._metadata.deadline 
                      ? new Date(lguData._metadata.deadline).toLocaleDateString('en-US', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric'
                        })
                      : "Not set",
                    lguName: lguData._metadata.name || lguData._metadata.email || "Unknown",
                    data: lguData,
                    municipality: municipality,
                    userUid: userUid,
                    isVerified: false,
                    displayName: lguData._metadata.displayName || `${municipality} - ${lguData._metadata.assessment || "General"}`
                  });
                }
              }
            });
          }
        });

        console.log("Fetched submissions (excluding forwarded):", submissionsList.length);
        setSubmissions(submissionsList);
      } else {
        setSubmissions([]);
      }
      setLoading(false);
    });
  };

  fetchSubmissions();
}, [currentUserMunicipality, municipalityMap, refreshTrigger]);

useEffect(() => {
  if (!auth.currentUser || !currentUserMunicipality) return;

  const fetchReturnedSubmissions = () => {
    const returnedRef = ref(db, `returned`);
    
    onValue(returnedRef, (snapshot) => {
      if (snapshot.exists()) {
        const allReturned = snapshot.val();
        const returnedList = [];
        let counter = 1;

        Object.keys(allReturned).forEach(year => {
          if (allReturned[year]?.MLGO) {
            // Look for the current user's UID in the MLGO node
            Object.keys(allReturned[year].MLGO).forEach(mlgoUid => {
              if (mlgoUid === auth.currentUser?.uid) {
                const mlgoReturns = allReturned[year].MLGO[mlgoUid];
                
                Object.keys(mlgoReturns).forEach(assessmentId => {
                  const returnData = mlgoReturns[assessmentId];
                  
                  // Check if this returned assessment belongs to current user's municipality
                  if (returnData.municipality === currentUserMunicipality) {
                    // Only add if not forwarded
                    if (returnData.status !== "Forwarded") {
// In the fetchReturnedSubmissions function, when pushing to returnedList:

returnedList.push({
  id: counter++,
  year: year,
  assessmentId: returnData.assessmentId,
  assessment: returnData.assessment || "General Assessment",
  status: "Returned", // Make sure status is set to Returned
  submission: returnData.submission || "N/A",
  deadline: returnData.deadline || "Not set",
  lguName: returnData.originalLguName || returnData.lguName,
  data: returnData.originalData || {},
  municipality: returnData.municipality,
  userUid: returnData.lguUid,
  isVerified: false,
  isReturned: true,
  returnedBy: returnData.returnedBy,
  returnedAt: returnData.returnedAt,
  poRemarks: returnData.poRemarks,
  displayName: `${returnData.municipality} - ${returnData.assessment || "General"}`
});
                    }
                  }
                });
              }
            });
          }
        });

        console.log("Fetched returned submissions:", returnedList.length);
        setReturnedSubmissions(returnedList);
      } else {
        setReturnedSubmissions([]);
      }
    });
  };

  fetchReturnedSubmissions();
}, [auth.currentUser?.uid, currentUserMunicipality, refreshTrigger]);



// Combine all submissions (pending + verified + returned)
const allSubmissions = useMemo(() => {
  console.log("Building allSubmissions with:", {
    submissionsCount: submissions.length,
    verifiedCount: verifiedSubmissions.length,
    returnedCount: returnedSubmissions.length
  });
  
  // Helper function to check if an item is forwarded
  const isForwarded = (item) => {
    return item.status === "Forwarded" ||
           item.data?._metadata?.forwarded === true ||
           item.data?._metadata?.forwardedToPO === true ||
           item.data?._metadata?.status === "Forwarded";
  };
  
  // Filter out forwarded items from all sources
  const filteredSubmissions = submissions.filter(s => !isForwarded(s));
  const filteredVerified = verifiedSubmissions.filter(v => !isForwarded(v));
  const filteredReturned = returnedSubmissions.filter(r => !isForwarded(r));
  
  // Create a Set of verified item keys
  const verifiedKeys = new Set(
    filteredVerified
      .filter(v => v.assessment && v.assessment !== "General Assessment")
      .map(v => `${v.year}-${v.assessmentId}-${v.municipality}`)
  );
  
  // Create a Set of returned item keys
  const returnedKeys = new Set(
    filteredReturned
      .filter(r => r.assessment && r.assessment !== "General Assessment")
      .map(r => `${r.year}-${r.assessmentId}-${r.municipality}`)
  );
  
  // Filter out pending items that have been verified or returned
  const filteredPending = filteredSubmissions.filter(pending => 
    !verifiedKeys.has(`${pending.year}-${pending.assessmentId}-${pending.municipality}`) &&
    !returnedKeys.has(`${pending.year}-${pending.assessmentId}-${pending.municipality}`)
  );
  
  // Filter out any items with "General Assessment"
  const validPending = filteredPending.filter(p => 
    p.assessment && p.assessment !== "General Assessment"
  );
  
  const validVerified = filteredVerified.filter(v => 
    v.assessment && v.assessment !== "General Assessment"
  );
  
  const validReturned = filteredReturned.filter(r => 
    r.assessment && r.assessment !== "General Assessment"
  );
  
  // Combine all
  const combined = [...validPending, ...validVerified, ...validReturned];
  
  // Final filter to ensure no forwarded items
  const finalFiltered = combined.filter(item => !isForwarded(item));
  
  console.log("Final filtered submissions:", finalFiltered.length);
  
  // Sort by year descending
  return finalFiltered.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    const timeA = a.returnedAt || a.verifiedAt || 0;
    const timeB = b.returnedAt || b.verifiedAt || 0;
    return timeB - timeA;
  });
}, [submissions, verifiedSubmissions, returnedSubmissions]);

  // Get unique assessment names based on selected year
  const assessmentFilterOptions = useMemo(() => {
    // Start with all submissions
    let dataToUse = [...submissions, ...verifiedSubmissions, ...returnedSubmissions];
    
    // If a year is selected, filter by that year first
    if (filters.year) {
      dataToUse = dataToUse.filter(item => item.year === filters.year);
    }
    
    // Get unique assessment names
    const allAssessments = dataToUse
      .map(item => item.assessment)
      .filter(assessment => assessment && assessment !== "General Assessment" && assessment !== "N/A");
    
    return [...new Set(allAssessments)].sort();
  }, [submissions, verifiedSubmissions, returnedSubmissions, filters.year]);

  const handleView = (item) => {
    if (item.isVerified) {
      navigate("/mlgo-view", { 
        state: { 
          year: item.year,
          assessment: item.assessment,
          assessmentId: item.assessmentId,
          lguName: item.lguName,
          lguData: item.data,
          municipality: item.municipality,
          lguUid: item.userUid,
          isVerified: true,
          verifiedBy: item.verifiedBy,
          verifiedAt: item.verifiedAt
        } 
      });
    } else if (item.isReturned) {
      navigate("/mlgo-view", { 
        state: { 
          year: item.year,
          assessment: item.assessment,
          assessmentId: item.assessmentId,
          lguName: item.lguName,
          lguData: item.data,
          municipality: item.municipality,
          lguUid: item.userUid,
          isVerified: false,
          isReturned: true,
          returnedBy: item.returnedBy,
          returnedAt: item.returnedAt,
          poRemarks: item.poRemarks
        } 
      });
    } else {
      // Check if this item was returned to LGU or forwarded
      const isReturnedToLGU = item.data?._metadata?.returnedToLGU || false;
      const isForwarded = item.data?._metadata?.forwarded || item.data?._metadata?.forwardedToPO || false;
      
      // Only navigate if not forwarded (though forwarded items shouldn't be in the list)
      navigate("/mlgo-view", { 
        state: { 
          year: item.year,
          assessment: item.assessment,
          assessmentId: item.assessmentId,
          lguName: item.lguName,
          lguData: item.data,
          municipality: item.municipality,
          lguUid: item.userUid,
          isVerified: false,
          isReturnedToLGU: isReturnedToLGU,
          isForwarded: isForwarded
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
  const statuses = ["Verified", "Pending", "Returned", "Forwarded"];

  const updateFilter = (type, value) => {
    // If changing the year, clear the assessment filter
    if (type === "year") {
      setFilters({ ...filters, [type]: value, assessment: "" });
    } else {
      setFilters({ ...filters, [type]: value });
    }
    setOpenDropdown(null);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ year: "", status: "", assessment: "" });
    setCurrentPage(1);
  };

  // Filter submissions
  const filteredData = allSubmissions.filter((item) => {
    const matchesYear = !filters.year || item.year === filters.year;
    const matchesStatus = !filters.status || item.status === filters.status;
    const matchesAssessment = !filters.assessment || item.assessment === filters.assessment;
    const matchesSearch = search === "" || 
      item.year.toLowerCase().includes(search.toLowerCase()) ||
      item.assessment?.toLowerCase().includes(search.toLowerCase()) ||
      item.status?.toLowerCase().includes(search.toLowerCase());
    
    return matchesYear && matchesStatus && matchesAssessment && matchesSearch;
  }).map((item, index) => ({ ...item, id: index + 1 })); // Reassign sequential IDs

  // Pagination
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const renderDropdown = (type, list) => (
    <div className="dropdown">
      {list.length > 0 ? (
        list.map((item, i) => (
          <div key={i} className="dropdown-item" onClick={() => updateFilter(type, item)}>
            {item}
          </div>
        ))
      ) : (
        <div className="dropdown-item" style={{ color: '#999', cursor: 'default' }}>
          No options available
        </div>
      )}
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
                  <h3 style={{textAlign: "center", lineHeight: "1.1", marginLeft: "-20%",}}>STRATEGIC UNIT KEY FOR <span className="yellow">ASS</span><span className="cyan">ESS</span>
                  <span className="red">MENT</span>  <span className="white">AND</span> TRACKING</h3>
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

                {/* Assessment Filter - depends on selected year */}
                <div className="filter-item">
                  <div className="filter-btn" onClick={() => setOpenDropdown(openDropdown === "assessment" ? null : "assessment")}>
                    Assessment {filters.assessment && `: ${filters.assessment}`}
                    <span className="arrow" style={{ pointerEvents: "none" }}>
                      {openDropdown === "assessment" ? "▲" : "▼"}
                    </span>
                  </div>
                  {openDropdown === "assessment" && (
                    <>
                      {!filters.year ? (
                        <div className="dropdown-item" style={{ color: '#999', cursor: 'default' }}>
                          Please select a year first
                        </div>
                      ) : (
                        renderDropdown("assessment", assessmentFilterOptions)
                      )}
                    </>
                  )}
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

            {/* Search Bar */}
            <div style={{ padding: "10px 20px" }}>
              <input
                type="text"
                placeholder="Search by year, assessment, or status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                }}
              />
            </div>

            {/* Table */}
            <div className={style.tableBox}
             style={{ marginTop:"-.1%"}}>
              <div className={style.tableWrapper}
              style={{ maxHeight: sidebarOpen ? 'calc(100vh - 160px)' : 'calc(100vh - 200px)', overflowY: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>YEAR</th>
                      <th>ASSESSMENT</th>
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
                          <td>{item.assessment || "General Assessment"}</td>
                          <td>
                            <span className={`${style.status} ${item.isVerified ? style.verifieD : style[item.status?.toLowerCase()]}`}>
                              {item.status}
                            </span>
                          </td>
                          <td>{item.submission}</td>
                          <td>{item.deadline || "Not set"}</td>
                          <td className="actions">
                            <button
                            onClick={() => handleView(item)}
                            style={{
                                backgroundColor: "#0c1a4b",
                                color: "white",
                                border: "none",
                                padding: "6px 15px",
                                borderRadius: "4px",
                                fontSize: "13px",
                                cursor: "pointer",
                                fontWeight: "500",
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                                transition: "background-color 0.2s"
                              }}
                              >
                              View 👁
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>
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
                <p style={{
                  color: "#666",
                  marginBottom: "20px",
                  marginTop: "-15px",
                  fontWeight: "600"
                }}>
                  {profileData.municipality}
                </p>
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