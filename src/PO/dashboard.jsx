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
    municipality: "",
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

  // Add state for assessments
  const [assessmentList, setAssessmentList] = useState([]);
  
  const [newRecord, setNewRecord] = useState({
    year: "",
    municipality: "",
    assessment: "" // Add assessment to newRecord state
  });
  
  // Use useMemo to filter assessments based on selected year
  const filteredAssessments = useMemo(() => {
    if (!newRecord.year) return [];
    return assessmentList.filter(a => a.year === newRecord.year);
  }, [assessmentList, newRecord.year]);

// Update the verified data fetching useEffect to include attachments:



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

useEffect(() => {
  if (!auth.currentUser) return;

  const assessmentsRef = ref(db, `assessments/${auth.currentUser.uid}`);

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
      console.log("Loaded assessments:", list);
    } else {
      setAssessmentList([]);
    }
  });
}, [auth.currentUser]);

// Clear assessment selection when year changes
useEffect(() => {
  if (newRecord.year) {
    // Clear assessment selection if it doesn't belong to the selected year
    if (newRecord.assessment) {
      const selectedAssessment = assessmentList.find(
        a => a.name === newRecord.assessment && a.year === newRecord.year
      );
      if (!selectedAssessment) {
        setNewRecord(prev => ({ ...prev, assessment: "" }));
      }
    }
  } else {
    setNewRecord(prev => ({ ...prev, assessment: "" }));
  }
}, [newRecord.year, assessmentList]);

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
                let assessment = item.assessment || "General Assessment";
                let assessmentId = item.assessmentId || "unknown";
                
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
                  municipality = lguName.replace(`_${assessmentId}`, '').replace(/_/g, ' ');
                  console.log(`Using lguName as fallback: ${municipality}`);
                }
                
                items.push({
                  id: counter++,
                  municipality: municipality,
                  year: year,
                  assessment: assessment,
                  assessmentId: assessmentId,
                  status: "Verified",
                  submission: item.submission || new Date().toLocaleDateString(),
                  deadline: item.deadline || "-",
                  lguUid: item.lguUid || "No UID",
                  submittedBy: item.submittedBy || "Unknown",
                  verifiedBy: item.verifiedBy || "Unknown",
                  verifiedAt: item.verifiedAt,
                  data: item.originalData || {},
                  // Include attachments in the verified data
                  attachmentsByIndicator: item.attachmentsByIndicator || {},
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
let assessment = item.assessment || "General Assessment"; // Get assessment from data
let assessmentId = item.assessmentId || "unknown";
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
              assessment: item.assessment || "General Assessment", // Use item.assessment directly
              assessmentId: item.assessmentId || "unknown",
              status: item.status || "Pending",
              submission: item.submission || new Date().toLocaleDateString(),
              deadline: item.deadline || "-",
              lguUid: item.lguUid || "No UID",
              submittedBy: item.submittedBy || "Unknown",
              userRole: item.userRole || "Unknown",
              originalData: item.originalData || {},
              // Add data field for view component
              data: item.originalData || {},
              // Type field
              type: "forwarded",
              lguName: item.lguName || municipality
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
              assessment: item.assessment || "General Assessment",
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

  const [filters, setFilters] = useState({
    municipality: "",
    year: "",
    status: "",
    assessment: "" // Add assessment filter
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


const handleView = (item) => {
  console.log("View:", item);
  
  // Check if this is a verified assessment
  if (item.type === "verified") {
    navigate("/po-view", { 
      state: { 
        year: item.year,
        municipality: item.municipality,
        assessment: item.assessment,
        assessmentId: item.assessmentId,
        lguUid: item.lguUid,
        submittedBy: item.submittedBy,
        data: item.data || item.originalData,
        lguName: item.municipality || item.lguName,
        submission: item.submission,
        deadline: item.deadline,
        isVerified: true,
        verifiedBy: item.verifiedBy,
        verifiedAt: item.verifiedAt,
        originalData: item.data || item.originalData,
        // Include attachments from the verified data
        attachmentsByIndicator: item.attachmentsByIndicator || {}
      } 
    });
  } else {
    // For forwarded assessments
    navigate("/po-view", { 
      state: { 
        year: item.year,
        municipality: item.municipality,
        assessment: item.assessment,
        assessmentId: item.assessmentId,
        lguUid: item.lguUid,
        submittedBy: item.submittedBy,
        data: item.originalData || item.data,
        lguName: item.lguName || item.municipality,
        submission: item.submission,
        deadline: item.deadline,
        isVerified: false,
        wasReturned: item.wasReturned || false,
        // Include attachments if they exist in the forwarded data
        attachmentsByIndicator: item.attachmentsByIndicator || {}
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

// Update the handleAddAssessment function:
const handleAddAssessment = async () => {
  const newAssessmentName = prompt("Enter new assessment:");
  if (!newAssessmentName) return;

  // Check if assessment already exists for the selected year
  if (!newRecord.year) {
    alert("Please pick a year.");
    return;
  }

  // Check if assessment name already exists for this year
  const existingAssessment = filteredAssessments.find(
    a => a.name.toLowerCase() === newAssessmentName.toLowerCase()
  );
  
  if (existingAssessment) {
    alert(`Assessment "${newAssessmentName}" already exists for year ${newRecord.year}`);
    return;
  }

  try {
    // Create a new assessment entry under the selected year
    const assessmentsRef = ref(db, `assessments/${auth.currentUser.uid}/${newRecord.year}`);
    const newAssessmentRef = push(assessmentsRef);
    
    await set(newAssessmentRef, {
      name: newAssessmentName,
      description: "",
      createdAt: new Date().toISOString(),
      status: "active"
    });

    // Update local state
    setNewRecord({ ...newRecord, assessment: newAssessmentName });
    
    console.log("Assessment added successfully");
  } catch (error) {
    console.error("Error adding assessment:", error);
    alert("Failed to add assessment");
  }
};

// Update handleDeleteAssessment:
const handleDeleteAssessment = async (assessmentName) => {
  if (!newRecord.year) {
    alert("No year selected");
    return;
  }

  // Find the assessment ID from the list (only in the selected year)
  const assessmentToDelete = filteredAssessments.find(a => a.name === assessmentName);
  
  if (!assessmentToDelete) {
    alert("Assessment not found");
    return;
  }

  if (!window.confirm(`Delete assessment "${assessmentName}" for year ${newRecord.year}?`)) return;

  try {
    const assessmentRef = ref(
      db, 
      `assessments/${auth.currentUser.uid}/${newRecord.year}/${assessmentToDelete.id}`
    );
    await set(assessmentRef, null);

    // Reset selected value if deleted
    if (newRecord.assessment === assessmentName) {
      setNewRecord({ ...newRecord, assessment: "" });
    }
  } catch (error) {
    console.error("Error deleting assessment:", error);
    alert("Failed to delete assessment");
  }
};
  
  const statuses = ["Verified", "Pending"];

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
    setFilters({
      municipality: "",
      year: "",
      status: "",
      assessment: "", // Clear assessment filter
    });
    setCurrentPage(1);
  };


// ===== ADD THE VERIFIED FILTERING LOGIC HERE (ONLY CHANGE) =====
// Combine forwardedData and verifiedData for display, removing verified items from forwarded
// Combine forwardedData and verifiedData for display
const allData = useMemo(() => {
  console.log("Forwarded data:", forwardedData);
  console.log("Verified data:", verifiedData);
  
  // Create a Set of verified item keys
  const verifiedKeys = new Set(
    verifiedData.map(v => {
      const key = `${v.year || ''}-${v.municipality || v.lguName || ''}-${v.assessmentId || v.assessment || ''}`;
      console.log("Verified key:", key);
      return key;
    })
  );
  
  // Map forwarded items - DON'T filter them out, just mark them
  const mappedForwarded = forwardedData.map(item => ({
    ...item,
    type: 'forwarded',
    // Ensure we have all required fields
    municipality: item.municipality || item.lguName || "Unknown",
    assessment: item.assessment || "General Assessment",
    assessmentId: item.assessmentId || "unknown",
    year: item.year || "Unknown",
    status: item.status || "Pending"
  }));
  
  // Map verified items
  const mappedVerified = verifiedData.map(item => ({
    ...item,
    type: 'verified',
    municipality: item.municipality || item.lguName || "Unknown",
    assessment: item.assessment || "General Assessment",
    assessmentId: item.assessmentId || "unknown",
    year: item.year || "Unknown"
  }));
  
  // Combine both arrays - show ALL items
  const combined = [...mappedForwarded, ...mappedVerified];
  
  console.log("Combined data:", combined);
  
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
    (t.municipality || t.lguName) === (item.municipality || item.lguName) &&
    t.year === item.year &&
    t.assessment === item.assessment && // Include assessment in uniqueness check
    t.assessmentId === item.assessmentId &&
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
    item.assessment?.toLowerCase().includes(search.toLowerCase()) || // Add assessment to search
    item.status?.toLowerCase().includes(search.toLowerCase()) ||
    item.submittedBy?.toLowerCase().includes(search.toLowerCase());
  
  return (
    (!filters.municipality || item.municipality === filters.municipality) &&
    (!filters.year || item.year === filters.year) &&
    (!filters.status || item.status?.toLowerCase() === filters.status.toLowerCase()) &&
    (!filters.assessment || item.assessment === filters.assessment) && // Add assessment filter
    matchesSearch
  );
});

/* Pagination Logic */
const indexOfLastRow = currentPage * rowsPerPage;
const indexOfFirstRow = indexOfLastRow - rowsPerPage;
const currentRows = filteredData.slice(indexOfFirstRow, indexOfLastRow);
const totalPages = Math.ceil(filteredData.length / rowsPerPage);

// Get unique assessment names based on selected year
const assessmentFilterOptions = useMemo(() => {
  // Start with raw data
  let dataToUse = [...forwardedData, ...verifiedData];
  
  // If a year is selected in filters, filter by that year first
  if (filters.year) {
    dataToUse = dataToUse.filter(item => item.year === filters.year);
  }
  
  // Get unique assessment names
  const allAssessments = dataToUse
    .map(item => item.assessment)
    .filter(assessment => assessment && assessment !== "General Assessment" && assessment !== "N/A");
  
  return [...new Set(allAssessments)].sort();
}, [forwardedData, verifiedData, filters.year]);

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

// Improved version with real-time updates
useEffect(() => {
  if (!auth.currentUser) return;

  const profileRef = ref(db, `profiles/${auth.currentUser.uid}`);
  
  const unsubscribe = onValue(profileRef, (snapshot) => {
    if (snapshot.exists()) {
      const profile = snapshot.val();
      setProfileData({
        name: profile.name || "",
        email: profile.email || auth.currentUser.email,
        image: profile.image || ""
      });
      
      // Also update editProfileData for consistency
      setEditProfileData(prev => ({
        ...prev,
        name: profile.name || "",
        email: profile.email || auth.currentUser.email,
        image: profile.image || ""
      }));
    } else {
      // No profile exists yet, use default values
      setProfileData({
        name: "",
        email: auth.currentUser.email,
        image: ""
      });
    }
  });
  
  return () => unsubscribe();
}, [auth.currentUser?.uid]);

// Add this useEffect to fetch the current user's profile data
useEffect(() => {
  if (!auth.currentUser) return;

  const fetchUserProfile = async () => {
    try {
      const profileRef = ref(db, `profiles/${auth.currentUser.uid}`);
      const profileSnapshot = await get(profileRef);
      
      if (profileSnapshot.exists()) {
        const profile = profileSnapshot.val();
        setProfileData({
          name: profile.name || "",
          email: profile.email || auth.currentUser.email,
          image: profile.image || ""
        });
        
        // Also update editProfileData for consistency
        setEditProfileData({
          name: profile.name || "",
          email: profile.email || auth.currentUser.email,
          image: profile.image || ""
        });
      } else {
        // No profile exists yet, use default values
        setProfileData({
          name: "",
          email: auth.currentUser.email,
          image: ""
        });
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  fetchUserProfile();
}, [auth.currentUser?.uid]);

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
              <h3 style={{textAlign: "center", lineHeight: "1.1", marginLeft: "-20%",}}>STRATEGIC UNIT KEY <br />FOR{" "} <span className="yellow">ASS</span><span className="cyan">ESS</span>
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

    {/* Assessment Filter - depends on selected year */}
    <div className="filter-item">
      <div
        className="filter-btn"
        onClick={() => setOpenDropdown(openDropdown === "assessment" ? null : "assessment")}
      >
        Assessment {filters.assessment && `: ${filters.assessment}`}
        <span className="arrow" style={{ pointerEvents: "none" }}>
          {openDropdown === "assessment" ? "▲" : "▼"}
        </span>
      </div>
      {openDropdown === "assessment" && (
        <>
          {!filters.year ? (
            <div className="dropdown-item" style={{ color: '#999', cursor: 'default' }}>
              Please pick a year.
            </div>
          ) : (
            renderDropdown("assessment", assessmentFilterOptions)
          )}
        </>
      )}
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
  <button className="po-indicators-btn" onClick={() => setShowModal(true)}>
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

{/* Modal - ADD NEW RECORD */}
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
              onChange={(e) => setNewRecord({ ...newRecord, year: e.target.value })}
            >
              <option value="">Select Year</option>
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
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
                color: newRecord.year ? "red" : "#ccc",
                border: newRecord.year ? "1px solid red" : "1px solid #ccc",
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

        {/* Assessment Dropdown */}
        <div className="modal-field">
          <label>Assessment:</label>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <select
              style={{ width: "70%" }}
              value={newRecord.assessment}
              onChange={(e) => setNewRecord({ ...newRecord, assessment: e.target.value })}
            >
              <option value="">Select Assessment</option>
              {filteredAssessments.map((assessment) => (
                <option key={assessment.id} value={assessment.name}>
                  {assessment.name}
                </option>
              ))}
            </select>

            {/* Add Assessment button - disabled if no year selected */}
            <button
              type="button"
              onClick={handleAddAssessment}
              disabled={!newRecord.year}
              style={{
                background: newRecord.year ? "#081a4b" : "#ccc",
                color: "#fff",
                border: "none",
                padding: "10px 10px",
                borderRadius: "4px",
                cursor: newRecord.year ? "pointer" : "not-allowed",
                fontSize: "12px"
              }}
            >
              + Add
            </button>

            {/* Delete Selected Assessment - disabled if no assessment selected */}
            <button
              type="button"
              disabled={!newRecord.assessment}
              onClick={() => handleDeleteAssessment(newRecord.assessment)}
              style={{
                background: "transparent",
                color: newRecord.assessment ? "red" : "#ccc",
                border: newRecord.assessment ? "1px solid red" : "1px solid #ccc",
                padding: "10px 10px",
                borderRadius: "4px",
                cursor: newRecord.assessment ? "pointer" : "not-allowed",
                fontSize: "12px"
              }}
            >
              Remove
            </button>
          </div>
          {!newRecord.year && (
            <small style={{ color: "#666", display: "block", marginTop: "5px" }}>
             Please pick a year.
            </small>
          )}
        </div>

        {/* Footer Button - PROCEED */}
        <div className="modal-footer">
          <button 
            className="proceed-btn"
            onClick={async () => {
              if (!newRecord.year) {
                alert("Please pick a year.");
                return;
              }
              if (!newRecord.assessment) {
                alert("Please select an assessment first.");
                return;
              }

              try {
                // Find the selected assessment from the filtered list
                const selectedAssessmentObj = filteredAssessments.find(
                  a => a.name === newRecord.assessment
                );

                if (!selectedAssessmentObj) {
                  alert("Selected assessment not found");
                  return;
                }

                // Save to created records
                const recordsRef = ref(db, `createdRecords/${auth.currentUser.uid}`);
                const newRecordRef = push(recordsRef);
                
                await set(newRecordRef, {
                  year: newRecord.year,
                  assessment: newRecord.assessment,
                  assessmentId: selectedAssessmentObj.id,
                  createdAt: new Date().toISOString(),
                  status: "Draft",
                  createdBy: auth.currentUser.uid,
                  createdByEmail: auth.currentUser.email
                });

                console.log("Record saved successfully");
                
                // Close the modal first
                setShowModal(false);
                
                // Navigate to PO Indicators with all required data
                navigate("/po-indicators", { 
                  state: { 
                    year: newRecord.year,
                    assessment: newRecord.assessment,
                    assessmentId: selectedAssessmentObj.id
                  }   
                });
              } catch (error) {
                console.error("Error saving record:", error);
                alert("Failed to create assessment. Please try again.");
              }
            }}
          >
            Proceed ➜
          </button>
        </div>
      </div>
    </div>
  </div>
)}


{/* Table */}
<div className="table-box">
  <div className="table-wrapper"
  style={{ maxHeight: sidebarOpen ? 'calc(100vh - 160px)' : 'calc(100vh - 200px)', overflowY: "auto" }}>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>MUNICIPALITY</th>
          <th>YEAR</th>
          <th>ASSESSMENT</th>
          <th>STATUS</th>
          <th>Submission Date</th>
          <th>Submission Deadline</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {loadingForwarded || loadingVerified ? (
          <tr>
            <td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>
              Loading...
            </td>
          </tr>
        ) : filteredData.length > 0 ? (
          currentRows.map((item) => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.municipality}</td>
              <td>{item.year}</td>
              <td>{item.assessment || "General Assessment"}</td>
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
            <td colSpan="8" style={{ textAlign: "center", padding: "20px" }}>
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
        Showing {indexOfFirstRow + 1}–{Math.min(indexOfLastRow, filteredData.length)} of {filteredData.length} items
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

                {/* Assessment Dropdown */}
                <div className="modal-field">
  <label>Assessment:</label>

  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
    <select
      style={{ width: "70%" }}
      value={newRecord.assessment}
      onChange={(e) =>
        setNewRecord({ ...newRecord, assessment: e.target.value })
      }
    >
      <option value="">Select Assessment</option>
      {filteredAssessments.map((assessment) => (
        <option key={assessment.id} value={assessment.name}>
          {assessment.name}
        </option>
      ))}
    </select>

    {/* Add Assessment button - disabled if no year selected */}
    <button
      type="button"
      onClick={handleAddAssessment}
      disabled={!newRecord.year}
      style={{
        background: newRecord.year ? "#081a4b" : "#ccc",
        color: "#fff",
        border: "none",
        padding: "10px 10px",
        borderRadius: "4px",
        cursor: newRecord.year ? "pointer" : "not-allowed",
        fontSize: "12px"
      }}
    >
      + Add
    </button>

    {/* Delete Selected Assessment - disabled if no assessment selected */}
    <button
      type="button"
      disabled={!newRecord.assessment}
      onClick={() => handleDeleteAssessment(newRecord.assessment)}
      style={{
        background: "transparent",
        color: newRecord.assessment ? "red" : "#ccc",
        border: newRecord.assessment ? "1px solid red" : "1px solid #ccc",
        padding: "10px 10px",
        borderRadius: "4px",
        cursor: newRecord.assessment ? "pointer" : "not-allowed",
        fontSize: "12px"
      }}
    >
      Remove
    </button>
  </div>
  {!newRecord.year && (
    <small style={{ color: "#666", display: "block", marginTop: "5px" }}>
      Please pick a year.
    </small>
  )}
</div>

                {/* Footer Button */}
                <div className="modal-footer">
                <button 
  className="proceed-btn"
  onClick={async () => {
    if (!newRecord.year) {
      alert("Please pick a year.");
      return;
    }
    if (!newRecord.assessment) {
      alert("Please select an assessment first.");
      return;
    }

    try {
      // Find the selected assessment from the filtered list
      const selectedAssessmentObj = filteredAssessments.find(
        a => a.name === newRecord.assessment
      );

      if (!selectedAssessmentObj) {
        alert("Selected assessment not found");
        return;
      }

      // Save to created records
      const recordsRef = ref(db, `createdRecords/${auth.currentUser.uid}`);
      const newRecordRef = push(recordsRef);
      
      await set(newRecordRef, {
        year: newRecord.year,
        assessment: newRecord.assessment,
        assessmentId: selectedAssessmentObj.id,
        createdAt: new Date().toISOString(),
        status: "Draft",
        createdBy: auth.currentUser.uid,
        createdByEmail: auth.currentUser.email
      });

      console.log("Record saved successfully");
      
      // Navigate to FAS with all required data
      navigate("/po-indicators", { 
        state: { 
          year: newRecord.year,
          assessment: newRecord.assessment,
          assessmentId: selectedAssessmentObj.id
        }   
      });
    } catch (error) {
      console.error("Error saving record:", error);
      alert("Failed to create assessment. Please try again.");
    }
  }}
>
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