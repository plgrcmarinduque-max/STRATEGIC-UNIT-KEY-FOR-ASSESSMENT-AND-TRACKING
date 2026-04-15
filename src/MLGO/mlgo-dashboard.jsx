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
 // const [loading, setLoading] = useState(true); // REMOVED - no loading screen
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
      const currentUserUid = auth.currentUser.uid;
      
      // Get current MLGO's municipality
      const profileRef = ref(db, `profiles/${currentUserUid}`);
      const profileSnapshot = await get(profileRef);
      let currentMunicipality = "";
      
      if (profileSnapshot.exists()) {
        currentMunicipality = profileSnapshot.val().municipality || "";
      }
      
      const notificationsRootRef = ref(db, `notifications`);
      const rootSnapshot = await get(notificationsRootRef);
      
      let count = 0;
      
      if (rootSnapshot.exists()) {
        const yearsData = rootSnapshot.val();
        
        for (const year of Object.keys(yearsData)) {
          const yearData = yearsData[year];
          
          if (yearData.MLGO) {
            // Loop through ALL MLGO UIDs
            for (const mlgoUid of Object.keys(yearData.MLGO)) {
              // Check if this MLGO has the same municipality as current user
              const mlgoProfileRef = ref(db, `profiles/${mlgoUid}`);
              const mlgoProfileSnapshot = await get(mlgoProfileRef);
              
              if (mlgoProfileSnapshot.exists()) {
                const mlgoMunicipality = mlgoProfileSnapshot.val().municipality || "";
                
                if (mlgoMunicipality === currentMunicipality) {
                  const mlgoNotifications = yearData.MLGO[mlgoUid];
                  Object.keys(mlgoNotifications).forEach(key => {
                    if (!mlgoNotifications[key].read) {
                      count++;
                    }
                  });
                }
              }
            }
          }
        }
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
        // setLoading(false); // REMOVED - no loading screen
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
                      submission: (() => {
  if (lguData.submission && lguData.submission !== "N/A") {
    try {
      const date = new Date(lguData.submission);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (e) {}
    return lguData.submission;
  }
  if (lguData.verifiedAt) {
    try {
      const date = new Date(lguData.verifiedAt);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (e) {}
  }
  return "N/A";
})(),
                      deadline: lguData.deadline 
  ? (lguData.deadline.includes('/') 
      ? lguData.deadline
      : new Date(lguData.deadline).toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }))
  : "Not set",
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
// Handle verified assessments - keep them, just mark status as Verified
if (lguData._metadata.verified === true || lguData._metadata.status === "Verified") {
  submissionsList.push({
    id: counter++,
    year: year,
    assessmentId: lguData._metadata.assessmentId || "unknown",
    assessment: lguData._metadata.assessment || lguData._metadata.assessmentName || "General Assessment",
    status: "Verified",
   submission: (() => {
  let submissionDate = null;
  if (lguData._metadata.lastSaved) {
    submissionDate = lguData._metadata.lastSaved;
  } else if (lguData._metadata.submittedAt) {
    submissionDate = lguData._metadata.submittedAt;
  } else if (lguData._metadata.createdAt) {
    submissionDate = lguData._metadata.createdAt;
  }
  if (submissionDate) {
    try {
      const date = new Date(submissionDate);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (e) {}
    return submissionDate;
  }
  return "N/A";
})(),
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
    isVerified: true,
    displayName: lguData._metadata.displayName || `${municipality} - ${lguData._metadata.assessment || "General"}`
  });
  return; // Skip the rest of the status logic for verified items
}
  
  // DECLARE status FIRST
  let status = "Pending";  // Default for submitted assessments
  
  // Check if forwarded
  const isForwarded = lguData._metadata.forwarded === true || 
                     lguData._metadata.forwardedToPO === true ||
                     lguData._metadata.status === "Forwarded";
  
  if (isForwarded) {
    status = "Forwarded";
  } 
  else if (lguData._metadata.returnedToMLGO === true) {
    status = "Returned";
  }
  else if (lguData._metadata.returnedToLGU === true) {
    status = "Returned";
  }
  
  // ALWAYS add to list - don't filter out any status
  submissionsList.push({
                    id: counter++,
                    year: year,
                    assessmentId: lguData._metadata.assessmentId || "unknown",
                    assessment: lguData._metadata.assessment || lguData._metadata.assessmentName || "General Assessment",
                    status: status,
                  submission: (() => {
  let submissionDate = null;
  if (lguData._metadata.lastSaved) {
    submissionDate = lguData._metadata.lastSaved;
  } else if (lguData._metadata.submittedAt) {
    submissionDate = lguData._metadata.submittedAt;
  } else if (lguData._metadata.createdAt) {
    submissionDate = lguData._metadata.createdAt;
  }
  if (submissionDate) {
    try {
      const date = new Date(submissionDate);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (e) {}
    return submissionDate;
  }
  return "N/A";
})(),
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

        console.log("Fetched submissions:", submissionsList.length);
        console.log("Forwarded count:", submissionsList.filter(s => s.status === "Forwarded").length);
        console.log("Returned count:", submissionsList.filter(s => s.status === "Returned").length);
        console.log("Pending count:", submissionsList.filter(s => s.status === "Pending").length);
        
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
        const returnedMap = new Map(); // Use Map to deduplicate by unique key
        
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
                    // Create unique key for this assessment
                    const uniqueKey = `${year}_${returnData.assessmentId}_${returnData.municipality}`;
                    
                    // Only add if not forwarded AND not already in map
                    if (returnData.status !== "Forwarded") {
                      // Check if we already have a newer version of this assessment
                      const existing = returnedMap.get(uniqueKey);
                      if (!existing || (returnData.returnedAt && existing.returnedAt && returnData.returnedAt > existing.returnedAt)) {
                        returnedMap.set(uniqueKey, {
                          year: year,
                          assessmentId: returnData.assessmentId,
                          assessment: returnData.assessment || "General Assessment",
                          status: "Returned",
                          submission: (() => {
  if (returnData.submission && returnData.submission !== "N/A") {
    try {
      const date = new Date(returnData.submission);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (e) {}
    return returnData.submission;
  }
  if (returnData.returnedAt) {
    try {
      const date = new Date(returnData.returnedAt);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        });
      }
    } catch (e) {}
  }
  return "N/A";
})(),
                         deadline: returnData.deadline 
  ? (typeof returnData.deadline === 'string' && returnData.deadline.includes('/')
      ? returnData.deadline
      : new Date(returnData.deadline).toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'long',
          year: 'numeric'
        }))
  : "Not set",
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
                  }
                });
              }
            });
          }
        });

        // Convert Map to array and add sequential IDs
        const returnedList = Array.from(returnedMap.values()).map((item, index) => ({
          ...item,
          id: index + 1
        }));

        console.log("Fetched returned submissions (deduplicated):", returnedList.length);
        setReturnedSubmissions(returnedList);
      } else {
        setReturnedSubmissions([]);
      }
    });
  };

  fetchReturnedSubmissions();
}, [auth.currentUser?.uid, currentUserMunicipality, refreshTrigger]);

// Combine all submissions (pending + verified + returned + forwarded)
const allSubmissions = useMemo(() => {
  console.log("Building allSubmissions with:", {
    submissionsCount: submissions.length,
    verifiedCount: verifiedSubmissions.length,
    returnedCount: returnedSubmissions.length
  });
  
  // Helper function to check if an item is forwarded - just for logging
  const isForwarded = (item) => {
    return item.status === "Forwarded" ||
           item.data?._metadata?.forwarded === true ||
           item.data?._metadata?.forwardedToPO === true ||
           item.data?._metadata?.status === "Forwarded";
  };
  
  // DON'T filter out forwarded items - keep them all
  // Just log them for debugging
  const forwardedItems = submissions.filter(s => isForwarded(s));
  console.log("Forwarded items kept in table:", forwardedItems.length);
  // Don't include verifiedSubmissions since verified items are now in submissions
const allSubmissionsData = [...submissions, ...returnedSubmissions];
  

  
  // Create a Set of verified item keys to avoid duplicates
const verifiedKeys = new Set(
  verifiedSubmissions
    .filter(v => v.assessment && v.assessment !== "General Assessment")
    .map(v => `${v.year}-${v.assessmentId}-${v.municipality}`)
);

// Create a Set of returned item keys - INCLUDING returned from PO
const returnedKeys = new Set(
  returnedSubmissions
    .filter(r => r.assessment && r.assessment !== "General Assessment")
    .map(r => `${r.year}-${r.assessmentId}-${r.municipality}`)
);

// Create a Set of forwarded item keys (from PO)
const forwardedKeys = new Set(
  submissions
    .filter(s => s.status === "Forwarded")
    .map(s => `${s.year}-${s.assessmentId}-${s.municipality}`)
);
  
// Keep ALL items - don't filter out returned ones
// Just deduplicate by keeping the most recent version of each assessment
const latestMap = new Map();

[...submissions, ...verifiedSubmissions, ...returnedSubmissions].forEach(item => {
  const key = `${item.year}-${item.assessmentId}-${item.municipality}`;
  const existing = latestMap.get(key);
  
  // Keep the item with the most recent timestamp
  if (!existing || (item.returnedAt > existing.returnedAt) || (item.submission > existing.submission)) {
    latestMap.set(key, item);
  }
});

const uniqueSubmissions = Array.from(latestMap.values());
  
  // Filter out any items with "General Assessment"
  const validSubmissions = uniqueSubmissions.filter(s => 
    s.assessment && s.assessment !== "General Assessment"
  );
  
  const validVerified = verifiedSubmissions.filter(v => 
    v.assessment && v.assessment !== "General Assessment"
  );
  
  const validReturned = returnedSubmissions.filter(r => 
    r.assessment && r.assessment !== "General Assessment"
  );
  
 // Don't include validVerified since verified items are already in validSubmissions
const combined = [...validSubmissions, ...validReturned];
  
  // Remove the final filter that was removing forwarded items
  // Just log for debugging
  console.log("Total submissions to display:", combined.length);
  console.log("Includes forwarded:", combined.filter(s => s.status === "Forwarded").length);
  console.log("Includes returned:", combined.filter(s => s.status === "Returned").length);
  console.log("Includes pending:", combined.filter(s => s.status === "Pending").length);
  console.log("Includes verified:", combined.filter(s => s.status === "Verified").length);
  
  // Sort by year descending, then by status priority (Pending first, then Forwarded, then Returned, then Verified)
  return combined.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    
    // Status priority order
    const statusOrder = { "Pending": 1, "Forwarded": 2, "Returned": 3, "Verified": 4 };
    const orderA = statusOrder[a.status] || 5;
    const orderB = statusOrder[b.status] || 5;
    
    if (orderA !== orderB) return orderA - orderB;
    
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
    <div className={style.dashboardScale}>
      <div className={style.dashboard}>
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
              <button
                className={`${style.sidebarMenuItem} ${location.pathname === "/mlgo-dashboard" ? style.active : ""}`}
                onClick={() => navigate("/mlgo-dashboard")}
                style={{ marginTop: "-10%" }}
              >
                <span style={{ marginRight: "8px", fontSize: "18px" }}>🏠︎</span>
                Dashboard
              </button>

              <button
                className={`${style.sidebarMenuItem} ${location.pathname === "/mlgo-notification" ? style.active : ""}`}
                onClick={() => navigate("/mlgo-notification")}
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
                <button className={`sidebar-btn signout-btn`} onClick={handleSignOut}>
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
          <div className={style.tableBox} style={{ marginTop:"-.1%"}}>
            <div className={style.tableWrapper} style={{ maxHeight: sidebarOpen ? 'calc(100vh - 160px)' : 'calc(100vh - 200px)', overflowY: "auto" }}>
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
                      <td>
  {item.submission && item.submission !== "N/A" && item.submission !== "Not set"
    ? (() => {
        try {
          const date = new Date(item.submission);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            });
          }
          return item.submission;
        } catch (e) {
          return item.submission;
        }
      })()
    : item.submission || "N/A"}
</td>
<td>
  {item.deadline && item.deadline !== "Not set" && item.deadline !== "N/A"
    ? (() => {
        try {
          const date = new Date(item.deadline);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            });
          }
          return item.deadline;
        } catch (e) {
          return item.deadline;
        }
      })()
    : "Not set"}
</td>
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
  )
}