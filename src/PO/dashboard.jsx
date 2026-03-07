import { useState, useEffect, useMemo } from "react";
import { db, auth} from "src/firebase";
import "src/PO-CSS/dashboard.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiFilter, FiRotateCcw, FiSettings, FiLogOut, FiFileText, FiBell } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { ref, push, onValue, set, get } from "firebase/database";



export default function Dashboard() {
  const [forwardedData, setForwardedData] = useState([]);
  const [verifiedData, setVerifiedData] = useState([]);
const [loadingVerified, setLoadingVerified] = useState(true);
const [loadingForwarded, setLoadingForwarded] = useState(true);
const [userRoleMap, setUserRoleMap] = useState({}); // Store user roles
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [municipalityMap, setMunicipalityMap] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const user = auth.currentUser;
  const displayName = user?.email || "User";
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [editProfileData, setEditProfileData] = useState({
  name: "",
  municipality: "", // ADD THIS LINE
  email: displayName,
  image: ""
});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    email: displayName,
    image: ""
  });
  const [data, setData] = useState([]);

useEffect(() => {
  if (!auth.currentUser) return;

  const profileRef = ref(db, `profiles/${auth.currentUser.uid}`);
  onValue(profileRef, (snapshot) => {
    if (snapshot.exists()) {
      const profile = snapshot.val();
      setProfileData(profile);

      // If the profile has no name, force edit modal
      if (!profile.name) {
        setShowEditProfileModal(true);
      }
    } else {
      // No profile exists yet, open edit modal
      setShowEditProfileModal(true);
    }
  });
}, []);

useEffect(() => {
  if (!auth.currentUser) return;

  const yearsRef = ref(db, `years/${auth.currentUser.uid}`);

  onValue(yearsRef, (snapshot) => {
    if (snapshot.exists()) {
      setYears(snapshot.val());
    } else {
      // initialize default years once
      set(ref(db, `years/${auth.currentUser.uid}`), years);
    }
  });
}, []);

// Add this with your other useState declarations
const [subAdminMunicipalities, setSubAdminMunicipalities] = useState({});


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
          // Look for notifications under PO with the user's UID
          if (yearData.PO && yearData.PO[userUid]) {
            const yearNotifications = yearData.PO[userUid];
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
  
  // Set up a listener for changes (optional - you could use onValue instead of get)
  const notificationsRef = ref(db, `notifications`);
  const unsubscribe = onValue(notificationsRef, () => {
    fetchUnreadCount();
  });
  
  return () => unsubscribe();
}, [auth.currentUser?.uid]);


// Add this useEffect to scan users/ for sub-admin roles and get their municipality from profiles/
useEffect(() => {
  if (!auth.currentUser) return;

  const fetchSubAdminMunicipalities = async () => {
    try {
      console.log("🔍 Scanning for sub-admin users...");
      
      // Get all users from users/ node
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      
      // Get all profiles from profiles/ node
      const profilesRef = ref(db, "profiles");
      const profilesSnapshot = await get(profilesRef);
      
      if (usersSnapshot.exists() && profilesSnapshot.exists()) {
        const users = usersSnapshot.val();
        const profiles = profilesSnapshot.val();
        
        const subAdminMap = {};
        
        // Loop through all users to find sub-admin role
        Object.keys(users).forEach(uid => {
          const userData = users[uid];
          
          // Check if user has sub-admin role
          if (userData && userData.role === "sub-admin") {
            console.log(`Found sub-admin with UID: ${uid}`);
            
            // Get their municipality from profiles using the same UID
            if (profiles[uid] && profiles[uid].municipality) {
              const municipality = profiles[uid].municipality;
              subAdminMap[uid] = municipality;
              console.log(`Sub-admin ${uid} has municipality: ${municipality}`);
            } else {
              console.log(`No municipality found for sub-admin UID: ${uid}`);
            }
          }
        });
        
        console.log("Sub-admin municipalities map:", subAdminMap);
        setSubAdminMunicipalities(subAdminMap);
      }
    } catch (error) {
      console.error("Error fetching sub-admin data:", error);
    }
  };

  fetchSubAdminMunicipalities();
}, [auth.currentUser?.uid]);
// Fetch all profiles to get municipality names and user details
useEffect(() => {
  if (!auth.currentUser) return;

  const fetchProfiles = async () => {
    try {
      const profilesRef = ref(db, `profiles`);
      onValue(profilesRef, (snapshot) => {
        if (snapshot.exists()) {
          const profiles = snapshot.val();
          const munMap = {};
          const roleMap = {};
          const emailToUidMap = {}; // Map email to UID for lookup
          const nameToUidMap = {}; // Map name to UID for lookup
          
          // Create maps from profiles
          Object.keys(profiles).forEach(uid => {
            const profile = profiles[uid];
            
            // Municipality map
            if (profile.municipality) {
              munMap[uid] = profile.municipality;
            }
            
            // Role map (default to "user")
            if (profile.role) {
              roleMap[uid] = profile.role;
            } else {
              roleMap[uid] = "user";
            }
            
            // Email to UID map for lookups
            if (profile.email) {
              emailToUidMap[profile.email.toLowerCase()] = uid;
            }
            
            // Name to UID map for lookups
            if (profile.name) {
              nameToUidMap[profile.name.toLowerCase()] = uid;
            }
          });
          
          console.log("Municipality map:", munMap);
          console.log("User role map:", roleMap);
          console.log("Email to UID map:", emailToUidMap);
          
          setMunicipalityMap(munMap);
          setUserRoleMap(roleMap);
          
          // Store these additional maps if needed
          // setEmailToUidMap(emailToUidMap);
          // setNameToUidMap(nameToUidMap);
        }
      });
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  fetchProfiles();
}, []);

// Fetch verified assessments from Firebase
useEffect(() => {
  if (!auth.currentUser) return;

  const fetchVerifiedData = () => {
    try {
      setLoadingVerified(true);
      
      const verifiedRef = ref(db, `verified`);
      
      onValue(verifiedRef, (snapshot) => {
        if (snapshot.exists()) {
          const allVerified = snapshot.val();
          const items = [];
          let counter = 1;
          
          console.log("Raw verified data:", allVerified);
          
// Iterate through years
Object.keys(allVerified).forEach(year => {
  if (allVerified[year] && allVerified[year].LGU) {
    Object.keys(allVerified[year].LGU).forEach(lguName => {
      const item = allVerified[year].LGU[lguName];
      
      let municipality = "Unknown";
      
      // Try to get municipality from the item data first
      if (item.municipality) {
        municipality = item.municipality;
        console.log(`Found municipality in item: ${municipality}`);
      }
      // Then try from subAdminMunicipalities using lguUid
      else if (item.lguUid && subAdminMunicipalities[item.lguUid]) {
        municipality = subAdminMunicipalities[item.lguUid];
        console.log(`Found municipality from subAdminMap: ${municipality}`);
      }
      // Finally fallback to lguName
      else {
        municipality = lguName;
        console.log(`Using lguName as fallback: ${municipality}`);
      }
      
      items.push({
        id: counter++,
        municipality: municipality, // Now this will be the actual municipality name
        year: year,
        status: "Verified",
        submission: item.submission || new Date().toLocaleDateString(),
        deadline: item.deadline || "-",
        lguUid: item.lguUid || "No UID",
        submittedBy: item.submittedBy || "Unknown",
        verifiedBy: item.verifiedBy || "Unknown",
        verifiedAt: item.verifiedAt,
        data: item.originalData || {},
        type: "verified"
      });
    });
  }
});
          
          console.log("Final mapped verified data:", items);
          setVerifiedData(items);
        } else {
          console.log("No verified data found");
          setVerifiedData([]);
        }
        setLoadingVerified(false);
      });
    } catch (error) {
      console.error("Error fetching verified data:", error);
      setLoadingVerified(false);
    }
  };

  fetchVerifiedData();
}, [auth.currentUser?.uid, subAdminMunicipalities]);

useEffect(() => {
  if (!auth.currentUser) return;

  const fetchForwardedData = () => {
    try {
      setLoadingForwarded(true);
      
      const forwardedRef = ref(db, `forwarded/${auth.currentUser.uid}`);
      
      onValue(forwardedRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const items = [];
          let counter = 1;
          
          console.log("Raw forwarded data:", data);
          console.log("Sub-admin municipalities:", subAdminMunicipalities);
          
          Object.keys(data).forEach(key => {
            const item = data[key];
            
let municipality = "Unknown";
let lookupAttempted = false;

// Try to get municipality from UID if it exists
if (item.lguUid && item.lguUid !== "No UID" && item.lguUid !== "Unknown") {
  lookupAttempted = true;
  console.log(`Looking up UID: ${item.lguUid} in subAdminMunicipalities`);
  
  if (subAdminMunicipalities[item.lguUid]) {
    municipality = subAdminMunicipalities[item.lguUid];
    console.log(`Found municipality: ${municipality} for UID: ${item.lguUid}`);
  } else {
    console.log(`UID ${item.lguUid} not found in subAdminMunicipalities map`);
    // Continue to fallbacks - don't return
  }
}

// ALWAYS try fallbacks if municipality is still Unknown
if (municipality === "Unknown") {
  // Fallback: try to get from municipality field directly
  if (item.municipality) {
    municipality = item.municipality;
    console.log(`Using direct municipality field: ${municipality}`);
  }
  // Fallback: try lguName
  else if (item.lguName) {
    municipality = item.lguName;
    console.log(`Using lguName: ${municipality}`);
  }
}
            
            // Fallback: try to get from municipality field directly
            if (municipality === "Unknown" && item.municipality) {
              municipality = item.municipality;
              console.log(`Using direct municipality field: ${municipality}`);
            }
            
            // Fallback: try lguName
            if (municipality === "Unknown" && item.lguName) {
              municipality = item.lguName;
              console.log(`Using lguName: ${municipality}`);
            }
            
            items.push({
              id: counter++,
              municipality: municipality,
              year: item.year || "Unknown",
              status: item.status || "Pending",
              submission: item.submission || new Date().toLocaleDateString(),
              deadline: item.deadline || "-",
              lguUid: item.lguUid || "No UID",
              submittedBy: item.submittedBy || "Unknown",
              userRole: item.userRole || "Unknown",
              originalData: item.originalData || {}
            });
          });
          
          // REMOVED THE FILTER - now showing ALL items
          console.log("Final mapped forwarded data:", items);
          setForwardedData(items); // Show ALL items
          
        } else {
          console.log("No forwarded data found");
          setForwardedData([]);
        }
        setLoadingForwarded(false);
      });
    } catch (error) {
      console.error("Error fetching forwarded data:", error);
      setLoadingForwarded(false);
    }
  };

  fetchForwardedData();
}, [auth.currentUser?.uid, subAdminMunicipalities]);



useEffect(() => {
  const handleStorageChange = (e) => {
    if (e.key === 'forwardedToPO') {
      try {
        const forwarded = JSON.parse(e.newValue || '[]');
        if (forwarded.length > 0) {
          const mappedData = forwarded.map((item, index) => {
            let municipality = item.municipality || "Unknown";
            
            // Try to get user role
            let userRole = "Unknown";
            if (item.lguUid && userRoleMap[item.lguUid]) {
              userRole = userRoleMap[item.lguUid];
            } else if (item.userRole) {
              userRole = item.userRole;
            }
            
            return {
              id: index + 1,
              municipality: municipality,
              year: item.year,
              status: item.status || "Pending",
              submission: item.submission,
              deadline: item.deadline,
              lgu: item.lgu || "M",
              data: item.data || {},
              lguUid: item.lguUid,
              userRole: userRole,
              submittedBy: item.submittedBy || "Unknown"
            };
          });
          
          setData(mappedData);
        }
      } catch (error) {
        console.error("Error handling storage change:", error);
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, [userRoleMap]);

/*
useEffect(() => {
  const handleStorageChange = (e) => {
    if (e.key === 'forwardedToPO') {
      try {
        const forwarded = JSON.parse(e.newValue || '[]');
        if (forwarded.length > 0) {
          const mappedData = forwarded.map((item, index) => {
            let municipality = item.municipality || "Unknown";
            
            // Try to get user role
            let userRole = "Unknown";
            if (item.lguUid && userRoleMap[item.lguUid]) {
              userRole = userRoleMap[item.lguUid];
            } else if (item.userRole) {
              userRole = item.userRole;
            }
            
            return {
              id: index + 1,
              municipality: municipality,
              year: item.year,
              status: item.status || "Pending",
              submission: item.submission,
              deadline: item.deadline,
              lgu: item.lgu || "M",
              data: item.data || {},
              lguUid: item.lguUid,
              userRole: userRole,
              submittedBy: item.submittedBy || "Unknown"
            };
          });
          
          setData(mappedData);
        }
      } catch (error) {
        console.error("Error handling storage change:", error);
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, [userRoleMap]);

useEffect(() => {
  const dataRef = ref(db, `financial/${auth.currentUser.uid}`);
  onValue(dataRef, (snapshot) => {
    const records = [];
    let counter = 1; // start IDs from 1
    snapshot.forEach((childSnapshot) => {
      const record = childSnapshot.val();
      records.push({ ...record, id: counter++, firebaseKey: childSnapshot.key });
    });
    setData(records);
  });
}, []);
*/


  const [newRecord, setNewRecord] = useState({
    year: "",
    municipality: ""
  });
  const [filters, setFilters] = useState({
    municipality: "",
    year: "",
    status: "",
  });


const handleSaveProfile = async () => {
  if (!auth.currentUser) return;

  // Only validate name for PO
  if (!editProfileData.name?.trim()) {
    alert("Please enter your name");
    return;
  }

  try {
    setSavingProfile(true);

    await set(ref(db, `profiles/${auth.currentUser.uid}`), {
      name: editProfileData.name,
      email: auth.currentUser.email,
      image: editProfileData.image || ""
      // No municipality for PO
    });

    setProfileData(editProfileData); // update visible profile

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



/*
const handleAddRecord = async () => {
  if (!newRecord.year || !newRecord.municipality) return alert("Please complete all fields.");

  const nextId = data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1;
  const today = new Date().toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" });
  const newEntry = { id: nextId, lgu: "M", municipality: newRecord.municipality, year: newRecord.year, status: "Draft", submission: today, deadline: "-" };

  try {
    const newRef = push(ref(db, `financial/${auth.currentUser.uid}`)); // user-specific
    await set(newRef, newEntry); // Realtime Database push
    
    alert("Saved successfully!");
    setShowModal(false);
    setNewRecord({ year: "", municipality: "" });
  } catch (error) {
    console.error(error);
    alert("Write failed: " + error.message);
  }
};
*/  


const handleView = (item) => {
  console.log("View:", item);
  
  // Check if this is a verified assessment
  if (item.type === "verified") {
    navigate("/po-view", { 
      state: { 
        year: item.year,
        municipality: item.municipality,
        lguUid: item.lguUid,
        submittedBy: item.submittedBy,
        data: item.data,
        lguName: item.municipality, // Use municipality as lguName
        submission: item.submission,
        deadline: item.deadline,
        isVerified: true, // Flag to indicate this is verified data
        verifiedBy: item.verifiedBy,
        verifiedAt: item.verifiedAt,
        originalData: item.data // Use data as originalData
      } 
    });
  } else {
    // Forwarded assessment
    navigate("/po-view", { 
      state: { 
        year: item.year,
        municipality: item.municipality,
        lguUid: item.lguUid,
        submittedBy: item.submittedBy,
        data: item.originalData || item.data,
        lguName: item.lguName,
        submission: item.submission,
        deadline: item.deadline,
        isVerified: false
      } 
    });
  }
};



  const municipalities = ["Boac", "Mogpog", "Sta. Cruz", "Torrijos", "Buenavista", "Gasan"];
  const [years, setYears] = useState(["2021","2022","2023","2024","2025","2026"]);
  
const handleAddYear = async () => {
  const newYear = prompt("Enter new year:");
  if (!newYear) return;

  if (years.includes(newYear)) {
    alert("Year already exists.");
    return;
  }

  const updatedYears = [...years, newYear].sort();
  setYears(updatedYears);

  if (auth.currentUser) {
    await set(ref(db, `years/${auth.currentUser.uid}`), updatedYears);
  }
};

const handleDeleteYear = async (yearToDelete) => {
  if (!window.confirm(`Delete year ${yearToDelete}?`)) return;

  const updatedYears = years.filter((y) => y !== yearToDelete);
  setYears(updatedYears);

  // Persist deletion in Firebase
  if (auth.currentUser) {
    await set(ref(db, `years/${auth.currentUser.uid}`), updatedYears);
  }

  // Reset selected value if deleted
  if (newRecord.year === yearToDelete) {
    setNewRecord({ ...newRecord, year: "" });
  }
};
  
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


// ===== ADD THE VERIFIED FILTERING LOGIC HERE (ONLY CHANGE) =====
// Combine forwardedData and verifiedData for display, removing verified items from forwarded
const allData = useMemo(() => {
  // Create a Set of verified item keys for quick lookup
  const verifiedKeys = new Set(
    verifiedData.map(v => `${v.year}-${v.lguUid}`)
  );
  
  // Filter out forwarded items that have been verified
  const filteredForwarded = forwardedData.filter(item => 
    !verifiedKeys.has(`${item.year}-${item.lguUid}`)
  );
  
  // Combine filtered forwarded with verified
  const combined = [...filteredForwarded, ...verifiedData];
  
  // Sort by date (most recent first)
  return combined.sort((a, b) => {
    const dateA = a.submission ? new Date(a.submission) : new Date(0);
    const dateB = b.submission ? new Date(b.submission) : new Date(0);
    return dateB - dateA;
  });
}, [forwardedData, verifiedData]);

// Remove duplicates based on lguUid and year and type
const uniqueData = allData.filter((item, index, self) => 
  index === self.findIndex((t) => 
    t.lguUid === item.lguUid && 
    t.year === item.year && 
    t.type === item.type
  )
);
// **FIX: Reassign sequential IDs starting from 1**
const dataWithSequentialIds = uniqueData.map((item, index) => ({
  ...item,
  id: index + 1  // This will give 1, 2, 3, 4, 5, 6 in order
}));

const filteredData = dataWithSequentialIds.filter((item) => {
  // Check if search term matches municipality
  const matchesSearch = search === "" || 
    item.municipality?.toLowerCase().includes(search.toLowerCase()) ||
    item.year?.toLowerCase().includes(search.toLowerCase()) ||
    item.submittedBy?.toLowerCase().includes(search.toLowerCase());
  
  return (
    (!filters.municipality || item.municipality === filters.municipality) &&
    (!filters.year || item.year === filters.year) &&
    (!filters.status || item.status?.toLowerCase() === filters.status.toLowerCase()) &&
    matchesSearch
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
    <div className="dashboard-scale">
      <div className="dashboard">
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
        onClick={() =>
          setOpenDropdown(openDropdown === "municipality" ? null : "municipality")
        }
      >
        Municipality {filters.municipality && `: ${filters.municipality}`}
        <span className="arrow" style={{ pointerEvents: "none" }}>
          {openDropdown === "municipality" ? "▲" : "▼"}
        </span>
      </div>
      {openDropdown === "municipality" && renderDropdown("municipality", municipalities)}
    </div>

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
    
{/* Fixed Notification Button */}
<button
  className="sidebar-menu-item"
  onClick={() => navigate("/po-notifications")}
  style={{
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "10px",
    background: "none",
    border: "none",
    color: "white",
    cursor: "pointer",
    transition: "background-color 0.2s ease",
    position: "relative"
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.28)";
    e.currentTarget.style.borderRadius = "4px";
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.backgroundColor = "transparent";
  }}
>
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
    // Set editProfileData with current profile data BEFORE opening modal
    setEditProfileData({
      name: profileData.name || "",
      email: profileData.email || displayName,
      image: profileData.image || ""
      // No municipality field for PO
    });
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
          onClick={() => {
            // Reset to current profile data when closing
            setEditProfileData({
              name: profileData.name || "",
              email: profileData.email || displayName,
              image: profileData.image || ""
            });
            setShowEditProfileModal(false);
          }}
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
            placeholder="Enter your name"
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
            disabled={savingProfile || !editProfileData.name?.trim()}
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

<div className="action-bar">
  <button className="financial-btn" onClick={() => setShowModal(true)}>

    {/* Pencil Icon */}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3
      17.25zm18-11.5a1.003 1.003 0 0 0 0-1.42l-2.34-2.34
      a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75
      1.84-1.82z"/>
    </svg>
    Create
  </button>
</div>

{/* Table */}
<div className="table-box">
  <div className="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>MUNICIPALITY</th>
          <th>YEAR</th>
          <th>STATUS</th>
          <th>Submission Date</th>
          <th>Submission Deadline</th>
          <th>Actions</th>
        </tr>
      </thead>
<tbody>
  {loadingForwarded || loadingVerified ? (
    <tr>
      <td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>
        Loading...
      </td>
    </tr>
  ) : filteredData.length > 0 ? (
    currentRows.map((item) => (
      <tr key={item.id}>
        <td>{item.id}</td>
        <td>
          {item.municipality}
        </td>
        <td>{item.year}</td>
        <td>
          <span className={`status ${item.status?.toLowerCase() || 'pending'}`}>
            {item.status}
          </span>
        </td>
        <td>{item.submission}</td>
        <td>{item.deadline}</td>
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
    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#1a2a6c"}
    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#0c1a4b"}
  >
    View 👁
  </button>
</td>
      </tr>
    ))
   ) : (
    <tr>
      <td colSpan="7" style={{ textAlign: "center", padding: "20px" }}>
        No assessments found
      </td>
    </tr>
  )}
</tbody>
    </table>
  </div>
  
{/* Pagination */}
<div className="table-footer">
  {filteredData.length === 0 ? (
    "Showing 0–0 of 0 items"
  ) : (
    <>
      Showing {indexOfFirstRow + 1}–
      {Math.min(indexOfLastRow, filteredData.length)} of {filteredData.length} items
    </>
  )}
  <div className="page-buttons">
    {/* LEFT ARROW */}
    <button
      disabled={filteredData.length === 0 || currentPage === 1}
      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
    >
      ◀
    </button>

    {/* PAGE INPUT */}
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
      className="page-input"
    />

    <span>of {totalPages}</span>

    {/* RIGHT ARROW */}
    <button
      disabled={filteredData.length === 0 || currentPage === totalPages}
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

        {/* Modal */}
        {showModal && (
          <div className="modal-overlay">
            <div className="add-record-modal">
              
              {/* Header */}
              <div className="modal-header">
                <div className="modal-title">
                  <FiFileText className="modal-icon" />
                <h3>ADD NEW RECORD</h3>
                </div>
                <span className="close-x" onClick={() => setShowModal(false)}>✕</span>
              </div>  
              

              {/* Body */}
              <div className="modal-body">
                {/* Year Dropdown */}
<div className="modal-field">
  <label>Year:</label>

  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
    <select
     style={{ width: "70%" }}
      value={newRecord.year}
      onChange={(e) =>
        setNewRecord({ ...newRecord, year: e.target.value })
      }
    >
      <option value="">Select Year</option>
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>

    {/* Add Year */}
    <button
      type="button"
      onClick={handleAddYear}
      style={{
        background: "#081a4b",
        color: "#fff",
        border: "none",
        padding: "10px 10px",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "12px"
      }}
    >
      + Add
    </button>

    {/* Delete Selected Year */}
    <button
      type="button"
      disabled={!newRecord.year}
      onClick={() => handleDeleteYear(newRecord.year)}
      style={{
        background: "transparent",
        color: "red",
        border: "1px solid red",
        padding: "10px 10px",
        borderRadius: "4px",
        cursor: newRecord.year ? "pointer" : "not-allowed",
        fontSize: "12px"
      }}
    >
      Remove
    </button>
  </div>
</div>

                {/* Footer Button */}
                <div className="modal-footer">
                  <button className="proceed-btn"
                    onClick={() => {
                    if (!newRecord.year) {
                      alert("Please select a year first.");
                      return;
                    }

  navigate("/financial-administration-and-sustainability", {
    state: { year: newRecord.year }
  });
}}>
                    Proceed ➜
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