import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import style from "src/MLGO-CSS/mlgo-view.module.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiFilter, FiRotateCcw, FiSettings, FiLogOut, FiFileText, FiClipboard } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, push, onValue, set, get } from "firebase/database";


export default function MLGOView() {
  const location = useLocation(); 
  const [lguRemarks, setLguRemarks] = useState({}); // CHANGED: object per tab
  const [isForwarded, setIsForwarded] = useState(false);
  const [isVerifiedView, setIsVerifiedView] = useState(location.state?.isVerified || false);
  const [municipalityMap, setMunicipalityMap] = useState({});
  const [isReturned, setIsReturned] = useState(false);
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [profileComplete, setProfileComplete] = useState(false);
  const rowsPerPage = 10;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const user = auth.currentUser;
  const displayName = user?.email || "User";
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  
  // State for ALL indicators (10 categories)
  const [indicators, setIndicators] = useState([]); // Financial
  const [disasterIndicators, setDisasterIndicators] = useState([]);
  const [socialIndicators, setSocialIndicators] = useState([]);
  const [healthIndicators, setHealthIndicators] = useState([]);
  const [educationIndicators, setEducationIndicators] = useState([]);
  const [businessIndicators, setBusinessIndicators] = useState([]);
  const [safetyIndicators, setSafetyIndicators] = useState([]);
  const [environmentalIndicators, setEnvironmentalIndicators] = useState([]);
  const [tourismIndicators, setTourismIndicators] = useState([]);
  const [youthIndicators, setYouthIndicators] = useState([]);
  
  const [userRole, setUserRole] = useState(null);
  const [userMunicipality, setUserMunicipality] = useState("");
  const [loading, setLoading] = useState(true);
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [adminUid, setAdminUid] = useState(null);
  const [lguAnswers, setLguAnswers] = useState([]);
  
  const [tabs] = useState([
    { id: 1, name: "Financial Administration and Sustainability", dbPath: "financial-administration-and-sustainability", stateKey: 'indicators' },
    { id: 2, name: "Disaster Preparedness", dbPath: "disaster-preparedness", stateKey: 'disasterIndicators' },
    { id: 3, name: "Social Protection and Sensitivity", dbPath: "social-protection-and-sensitivity", stateKey: 'socialIndicators' },
    { id: 4, name: "Health Compliance and Responsiveness", dbPath: "health-compliance-and-responsiveness", stateKey: 'healthIndicators' },
    { id: 5, name: "Sustainable Education", dbPath: "sustainable-education", stateKey: 'educationIndicators' },
    { id: 6, name: "Business Friendliness and Competitiveness", dbPath: "business-friendliness-and-competitiveness", stateKey: 'businessIndicators' },
    { id: 7, name: "Safety, Peace and Order", dbPath: "safety-peace-and-order", stateKey: 'safetyIndicators' },
    { id: 8, name: "Environmental Management", dbPath: "environmental-management", stateKey: 'environmentalIndicators' },
    { id: 9, name: "Tourism, Heritage Development, Culture and Arts", dbPath: "tourism-heritage-development-culture-and-arts", stateKey: 'tourismIndicators' },
    { id: 10, name: "Youth Development", dbPath: "youth-development", stateKey: 'youthIndicators' }
  ]);

  const [activeTab, setActiveTab] = useState(1);
  const [currentDbPath, setCurrentDbPath] = useState("financial-administration-and-sustainability");
  const [selectedYear, setSelectedYear] = useState("2026"); // Default year or get from navigation
  const [newRecord, setNewRecord] = useState({
    year: "",
    municipality: ""
  });

// Helper function to get tab name
const getTabName = (tabId) => {
  switch(tabId) {
    case 1: return 'Financial';
    case 2: return 'Disaster';
    case 3: return 'Social';
    case 4: return 'Health';
    case 5: return 'Education';
    case 6: return 'Business';
    case 7: return 'Safety';
    case 8: return 'Environmental';
    case 9: return 'Tourism';
    case 10: return 'Youth';
    default: return 'Financial';
  }
};

  // Helper function to get the correct answer key based on tab
// Replace the complex getAnswerKey function with this updated version
const getAnswerKey = (record, mainIndex, field, isSub = false, nestedIndex = null, valueType = "default") => {
  const prefixMap = {
    1: 'financial_',    // Add underscore after each prefix
    2: 'disaster_',
    3: 'social_',
    4: 'health_',
    5: 'education_',
    6: 'business_',
    7: 'safety_',
    8: 'environmental_',
    9: 'tourism_',
    10: 'youth_'
  };
  
  const prefix = prefixMap[activeTab] || '';
  
  if (nestedIndex !== null) {
    if (valueType === "radio") return `${prefix}${record.firebaseKey}_sub_${mainIndex}_nested_${nestedIndex}_radio_${field}`;
    if (valueType === "checkbox") return `${prefix}${record.firebaseKey}_sub_${mainIndex}_nested_${nestedIndex}_checkbox_${field}`;
    return `${prefix}${record.firebaseKey}_sub_${mainIndex}_nested_${nestedIndex}_${field}`;
  } else if (isSub) {
    if (valueType === "radio") return `${prefix}${record.firebaseKey}_sub_${mainIndex}_radio_${field}`;
    if (valueType === "checkbox") return `${prefix}${record.firebaseKey}_sub_${mainIndex}_checkbox_${field}`;
    return `${prefix}${record.firebaseKey}_sub_${mainIndex}_${field}`;
  } else {
    if (valueType === "radio") return `${prefix}${record.firebaseKey}_${mainIndex}_radio_${field}`;
    if (valueType === "checkbox") return `${prefix}${record.firebaseKey}_${mainIndex}_checkbox_${field}`;
    return `${prefix}${record.firebaseKey}_${mainIndex}_${field}`;
  }
};

// Radio answers are saved as index strings ("0","1","2"...). Keep fallback to legacy saved values.
const isRadioSelected = (answerValue, choice, choiceIndex) => {
  const saved = String(answerValue ?? "");
  if (saved === String(choiceIndex)) return true;

  const choiceLabel =
    choice && typeof choice === "object"
      ? (choice.label ?? choice.value ?? choice.name ?? choice.title ?? choice.text ?? "")
      : choice;
  const choiceValueRaw =
    choice && typeof choice === "object"
      ? (choice.value ?? choice.label ?? choice.name ?? choice.title ?? choice.text ?? "")
      : choice;

  if (choiceValueRaw !== "" && choiceValueRaw !== null && choiceValueRaw !== undefined && saved === String(choiceValueRaw)) return true;
  if (choiceLabel !== "" && choiceLabel !== null && choiceLabel !== undefined && saved === String(choiceLabel)) return true;

  return false;
};

  useEffect(() => {
    if (location.state?.year) {
      setSelectedYear(location.state.year);
      console.log("Viewing year:", location.state.year);
    } else {
      console.log("No year in location state, using default:", selectedYear);
    }
  }, [location]);
  
  const [showExportModal, setShowExportModal] = useState(false);
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

  const [remarks, setRemarks] = useState({}); // CHANGED: object per tab
  const [verifiedFlag, setVerifiedFlag] = useState({}); // CHANGED: object per tab

// Add this for debugging
console.log("🔥 MLGOView rendered with location.state:", JSON.stringify(location.state, null, 2));
console.log("🔥 remarks state initial:", remarks);

// Add this after your other useEffects to debug Firebase data
useEffect(() => {
  const debugFirebaseData = async () => {
    if (!auth.currentUser || !location.state?.lguUid || !selectedYear) return;
    
    try {
      const lguName = location.state.lguName || location.state.municipality;
      const cleanLguName = lguName.replace(/[.#$\[\]]/g, '_');
      
      console.log("🔍 Debug: Checking Firebase for:", cleanLguName);
      
      const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanLguName}`);
      const snapshot = await get(answersRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        console.log("🔍 Debug: Raw Firebase data:", JSON.stringify(data, null, 2));
        
        if (data._metadata) {
          console.log("🔍 Debug: _metadata:", JSON.stringify(data._metadata, null, 2));
          console.log("🔍 Debug: poRemarks exists?", !!data._metadata.poRemarks);
          console.log("🔍 Debug: poRemarks type:", typeof data._metadata.poRemarks);
          console.log("🔍 Debug: poRemarks value:", data._metadata.poRemarks);
          
          // If poRemarks exists, set it
          if (data._metadata.poRemarks && typeof data._metadata.poRemarks === 'object') {
            console.log("🔍 Debug: Setting remarks from poRemarks object");
            setRemarks(data._metadata.poRemarks);
          } else if (data._metadata.remarks) {
            console.log("🔍 Debug: Setting remarks from single remarks field");
            // If it's a string, convert to object with all tabs having same remark
            if (typeof data._metadata.remarks === 'string') {
              const singleRemark = data._metadata.remarks;
              const remarksObj = {
                1: singleRemark,
                2: singleRemark,
                3: singleRemark,
                4: singleRemark,
                5: singleRemark,
                6: singleRemark,
                7: singleRemark,
                8: singleRemark,
                9: singleRemark,
                10: singleRemark
              };
              setRemarks(remarksObj);
            }
          }
        }
      } else {
        console.log("🔍 Debug: No data found in Firebase");
      }
    } catch (error) {
      console.error("🔍 Debug: Error fetching Firebase data:", error);
    }
  };
  
  debugFirebaseData();
}, [auth.currentUser, location.state, selectedYear]);

  // Load verified flag from localStorage on component mount
  useEffect(() => {
    const savedFlag = localStorage.getItem('verifiedFlag');
    if (savedFlag) {
      try {
        setVerifiedFlag(JSON.parse(savedFlag));
      } catch (e) {
        console.error("Error parsing saved flags:", e);
      }
    }
  }, []);

  // Add this function to handle downloads
  const downloadAttachment = (attachment) => {
    console.log('📎 Downloading attachment:', attachment);
    
    try {
      // Log all properties to see what's available
      console.log('Available properties:', Object.keys(attachment));
      
      // Try to find the file data - it might be in different places
      let fileUrl = null;
      let fileName = 'download';
      
      // Check each property to see if it contains file data
      for (const key of Object.keys(attachment)) {
        const value = attachment[key];
        console.log(`Property "${key}":`, typeof value, value ? 'has value' : 'empty');
        
        // If it's a string that looks like a data URL or regular URL
        if (typeof value === 'string' && (value.startsWith('data:') || value.startsWith('http'))) {
          fileUrl = value;
          console.log(`Found potential file URL in property: ${key}`);
        }
        
        // Look for filename
        if (key === 'name' || key === 'fileName' || key === 'filename') {
          fileName = value;
        }
      }
      
      if (fileUrl) {
        if (fileUrl.startsWith('data:')) {
          // Handle base64 data URL
          const link = document.createElement('a');
          link.href = fileUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log('✅ Download initiated for base64 data');
        } else {
          // Regular URL - open in new tab
          window.open(fileUrl, '_blank');
          console.log('✅ Opened URL in new tab');
        }
      } else {
        console.error('No file URL found in attachment');
        alert('No file data available. Check console for attachment properties.');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file: ' + error.message);
    }
  };

  {console.log("🔍 LGU Answers Data:", lguAnswers)}
{console.log("🔍 First LGU data:", lguAnswers[0]?.data)}

  // Fetch municipality mapping from profiles
  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchMunicipalityMap = async () => {
      try {
        const profilesRef = ref(db, "profiles");
        const profilesSnapshot = await get(profilesRef);
        
        if (profilesSnapshot.exists()) {
          const profiles = profilesSnapshot.val();
          const map = {};
          
          Object.keys(profiles).forEach(uid => {
            const profile = profiles[uid];
            if (profile.municipality) {
              map[uid] = profile.municipality;
            }
          });
          
          console.log("Municipality map loaded:", map);
          setMunicipalityMap(map);
        }
      } catch (error) {
        console.error("Error fetching municipality map:", error);
      }
    };

    fetchMunicipalityMap();
  }, []);

  const handleForwardToPO = async () => {
    if (!lguAnswers.length) {
      alert("No assessment data to forward");
      return;
    }

    const confirmForward = window.confirm(
      "Are you sure you want to forward this assessment to the Provincial Office?"
    );
    
    if (!confirmForward) return;

    try {
      setLoading(true);
      const lgu = lguAnswers[0];
      
      // Find admin UID (PO)
      const usersRef = ref(db, "users");
      const usersSnapshot = await get(usersRef);
      let poUid = null;
      
      if (usersSnapshot.exists()) {
        const users = usersSnapshot.val();
        poUid = Object.keys(users).find(
          uid => users[uid]?.role === "admin"
        );
      }
      
      if (!poUid) {
        alert("No Provincial Office admin found");
        return;
      }
      
      // Get the current user's UID
      const currentUserUid = auth.currentUser?.uid;
      
      if (!currentUserUid) {
        alert("You must be logged in to forward assessments");
        return;
      }
      
      console.log("Current user UID (sub-admin):", currentUserUid);
      
      const forwardData = {
        lguUid: currentUserUid,
        year: selectedYear,
        status: "Pending",
        submission: new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: '2-digit',
          year: 'numeric'
        }),
        deadline: submissionDeadline ? new Date(submissionDeadline).toLocaleDateString('en-US', {
          month: 'long',
          day: '2-digit',
          year: 'numeric'
        }) : "Not set",
        originalData: lgu.data,
        forwardedAt: Date.now(),
        forwardedBy: auth.currentUser?.email,
        submittedBy: lgu.submittedBy || auth.currentUser?.email,
        lguName: lgu.lguName
      };
      
      console.log("Forwarding data with sub-admin UID:", forwardData.lguUid);
      
      // Save to Firebase under the PO's node
      const forwardedRef = ref(db, `forwarded/${poUid}`);
      const newForwardedRef = push(forwardedRef);
      await set(newForwardedRef, forwardData);
      
      console.log("Forwarded to PO successfully:", forwardData);
      
      // COMPLETELY REPLACE the metadata with ONLY forwarding flags
      const cleanName = lgu.lguName.replace(/[.#$\[\]]/g, '_');
      const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanName}`);
      const snapshot = await get(answersRef);

      if (snapshot.exists()) {
        const currentData = snapshot.val();
        
        // Create NEW metadata with ONLY forwarding flags
        const newMetadata = {
          // Keep essential user info
          uid: currentData._metadata?.uid,
          email: currentData._metadata?.email,
          name: currentData._metadata?.name,
          lastSaved: currentData._metadata?.lastSaved,
          year: currentData._metadata?.year,
          
          // Forwarding flags ONLY
          submitted: true,
          forwarded: true,
          forwardedToPO: true,
          forwardedAt: Date.now(),
          forwardedTo: poUid,
          forwardedBy: auth.currentUser?.email,
          canEdit: false
          
          // NO returned flags here
        };
        
        const updatedData = {
          ...currentData,
          _metadata: newMetadata
        };
        
        await set(answersRef, updatedData);
        console.log("✅ Forwarded - New metadata:", newMetadata);
      }
      
      // Create a notification for the PO
      const notificationRef = ref(db, `notifications/${selectedYear}/PO/${poUid}`);
      const notificationId = Date.now().toString();
      const notificationData = {
        id: notificationId,
        type: "assessment_forwarded",
        title: `Assessment Form (${selectedYear}) was forwarded to MLGOO.`,  // Updated message
        message: `Assessment from ${lgu.lguName} has been forwarded to PO.`,
        from: auth.currentUser?.email,
        fromName: profileData.name || auth.currentUser?.email,
        timestamp: Date.now(),
        read: false,
        year: selectedYear,
        action: "view_assessment"
      };
      await set(ref(db, `notifications/${selectedYear}/PO/${poUid}/${notificationId}`), notificationData);
      
      alert("Assessment forwarded to Provincial Office successfully!");
      
      // Set forwarded state to true to disable the button
      setIsForwarded(true);
      
      // Navigate back to dashboard after successful forward
      navigate("/mlgo-dashboard");
      
    } catch (error) {
      console.error("Error forwarding to PO:", error);
      alert("Failed to forward assessment: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  
  // When loading assessment data
  useEffect(() => {
    if (lguAnswers.length > 0) {
      const lgu = lguAnswers[0];
      
      // Check if this assessment has been returned
      if (lgu.data?._metadata?.returned) {
        setIsReturned(true);
      } else {
        setIsReturned(false);
      }
      
      // Check if this assessment has been forwarded
      if (lgu.data?._metadata?.forwarded) {
        setIsForwarded(true);
      } else {
        setIsForwarded(false);
      }
      
      console.log("Assessment status:", {
        returned: lgu.data?._metadata?.returned,
        forwarded: lgu.data?._metadata?.forwarded
      });
    } else {
      // Reset states if no assessment is loaded
      setIsReturned(false);
      setIsForwarded(false);
    }
  }, [lguAnswers]);
  
  const [data, setData] = useState([]);

// Add this near the top of mlgo-view.jsx, after the useState declarations
useEffect(() => {
  // Check if this is a returned assessment from the PO
  if (location.state?.returned || location.state?.fromReturn || location.state?.lguData?._metadata?.returnedToMLGO) {
    console.log("⚠️ This is a returned assessment from PO");
    
    // Get remarks from various possible locations
    let poRemarks = {};
    
    // Try to get from location.state first
    if (location.state?.poRemarks) {
      poRemarks = location.state.poRemarks;
    } 
    // Then try from lguData metadata
    else if (location.state?.lguData?._metadata?.poRemarks) {
      poRemarks = location.state.lguData._metadata.poRemarks;
    }
    // Fallback to single remark
    else if (location.state?.remarks) {
      // If it's a single remark, apply it to all tabs or current tab?
      const singleRemark = location.state.remarks;
      poRemarks = { 1: singleRemark, 2: singleRemark, 3: singleRemark, 4: singleRemark, 5: singleRemark, 
                    6: singleRemark, 7: singleRemark, 8: singleRemark, 9: singleRemark, 10: singleRemark };
    }
    
    // Set the remarks state with all tab remarks
    setRemarks(poRemarks);
    
    
    // The assessment is now editable for MLGO
    setIsForwarded(false);
    setIsReturned(false); // Not returned to LGU yet, just to MLGO
  }
  
  // Check if this assessment has been forwarded
  if (location.state?.lguData?._metadata?.forwarded) {
    setIsForwarded(true);
  }
}, [location.state]);

const handleReturnToLGU = async () => {
  if (!lguAnswers.length) {
    alert("No assessment data to return");
    return;
  }

  const confirmReturn = window.confirm(
    "Are you sure you want to return this assessment to the LGU? This will make it editable again for them."
  );
  
  if (!confirmReturn) return;

  try {
    setLoading(true);
    const lgu = lguAnswers[0];
    const cleanName = lgu.lguName.replace(/[.#$\[\]]/g, '_');
    
    // Update the answers to return to LGU
    const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanName}`);
    const snapshot = await get(answersRef);
    
    if (snapshot.exists()) {
      const currentData = snapshot.val();
      
      // Get the remark for current tab, ensure it's a string and not undefined
      const currentTabRemark = lguRemarks[activeTab] || "";
      const allRemarks = { ...lguRemarks }; // Save all tab remarks
      
      // Create NEW metadata with MLGO remarks
      const newMetadata = {
        // Keep essential user info
        uid: currentData._metadata?.uid,
        email: currentData._metadata?.email,
        name: currentData._metadata?.name,
        lastSaved: currentData._metadata?.lastSaved,
        year: currentData._metadata?.year,
        
        // Return flags with MLGO remarks
        submitted: false,
        returned: true,
        returnedAt: Date.now(),
        returnedBy: auth.currentUser?.email,
        returnedByName: profileData.name || auth.currentUser?.email,
        mlgoRemarks: allRemarks, // Save ALL tab remarks as an object
        remarks: currentTabRemark || "Assessment returned for revision", // Single remark for backward compatibility
        canEdit: true
        
        // NO forwarding flags here
      };
      
      console.log("📤 Returning - New metadata with MLGO remarks:", newMetadata);
      
      const updatedData = {
        ...currentData,
        _metadata: newMetadata
      };
      
      await set(answersRef, updatedData);
      console.log("✅ Assessment returned to LGU successfully");
      
// In handleReturnToLGU function, replace the notification creation section with:

const lguUid = currentData._metadata?.uid;
const municipality = profileData.municipality || location.state?.municipality; // Get MLGO's municipality

if (lguUid) {
  console.log("Sending notification to LGU with UID:", lguUid, "Municipality:", municipality);
  
  const notificationRef = ref(db, `notifications/${selectedYear}/LGU/${lguUid}`);
  const notificationId = Date.now().toString();
  
  // Ensure all values are defined (not undefined)
  const notificationData = {
    id: notificationId,
    type: "assessment_returned",
    title: `Assessment Form (${selectedYear}) was returned for revision.`,
    message: currentTabRemark || "Please check the remarks and resubmit.",
    from: auth.currentUser?.email || "",
    fromName: profileData.name || auth.currentUser?.email || "",
    fromMunicipality: municipality || "", // ADDED: MLGO's municipality
    timestamp: Date.now(),
    read: false,
    year: selectedYear,
    municipality: municipality || "", // ADDED: Municipality for filtering
    tabName: getTabName(activeTab) || "",
    tabRemarks: currentTabRemark || "",
    allRemarks: allRemarks || {},
    action: "edit_assessment"
  };
  
  await set(ref(db, `notifications/${selectedYear}/LGU/${lguUid}/${notificationId}`), notificationData);
  console.log("✅ Notification saved with municipality:", municipality);
}
      
      alert("Assessment returned to LGU successfully!");
      
      // Navigate back to dashboard
      navigate("/mlgo-dashboard");
    }
  } catch (error) {
    console.error("Error returning to LGU:", error);
    alert("Failed to return assessment: " + error.message);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    if (!auth.currentUser) return;

    const profileRef = ref(db, `profiles/${auth.currentUser.uid}`);
    onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const profile = snapshot.val();
        setProfileData(profile);
        setEditProfileData(profile);

        // Check if profile has required fields
        if (profile.name && profile.municipality) {
          setProfileComplete(true);
          setShowEditProfileModal(false);
        } else {
          setProfileComplete(false);
          setShowEditProfileModal(true); // Force edit modal if incomplete
        }
      } else {
        // No profile exists yet, force edit modal
        setProfileComplete(false);
        setShowEditProfileModal(true);
      }
    });
  }, []);

  // Fetch user role and municipality from users node
  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchUserRole = async () => {
      try {
        // Get user role from users node
        const userRef = ref(db, `users/${auth.currentUser.uid}`);
        const userSnapshot = await get(userRef);
        
        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          setUserRole(userData.role || "user");
          console.log("User role:", userData.role);
        } else {
          console.log("No user data found in users node");
          setUserRole("user");
        }
        
        // Get municipality from profile
        if (profileData.municipality) {
          setUserMunicipality(profileData.municipality);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };

    fetchUserRole();
  }, [profileData]);

  // Fetch LGU answers with role-based filtering
  useEffect(() => {
    if (!auth.currentUser || !adminUid || !selectedYear || !userRole) return;

    const fetchLGUAnswers = async () => {
      try {
        setLoading(true);
        
        // First check if this is a verified assessment from navigation state
// First check if this is a verified assessment from navigation state
if (location.state?.isVerified) {
  console.log("📋 Loading verified assessment from state:", location.state);
  
  // Create a verified assessment object from the navigation state
  const verifiedLgu = {
    id: 1,
    lguName: location.state.lguName || location.state.municipality,
    year: location.state.year,
    status: "Verified",
    submission: location.state.submission || new Date().toLocaleDateString(),
    deadline: submissionDeadline || "Not set",
    data: location.state.lguData || {},
    municipality: location.state.municipality,
    userUid: location.state.lguUid,
    isVerified: true,
    verifiedBy: location.state.verifiedBy,
    verifiedAt: location.state.verifiedAt,
    attachmentsByIndicator: location.state.attachmentsByIndicator || {}
  };
  
  setLguAnswers([verifiedLgu]);
  setIsForwarded(false);
  setIsReturned(false);
  
  // Fetch indicators for verified assessment
  await fetchAllIndicators();
  
  setLoading(false);
  return;
}
        
        // Otherwise, fetch from answers node (existing code)
        const answersRef = ref(db, `answers/${selectedYear}/LGU`);
        
        onValue(answersRef, async (snapshot) => {
          if (snapshot.exists()) {
            const answers = snapshot.val();
            
            // Apply role-based filtering
            const filteredAnswers = filterLGUAnswersByRole(answers, userRole, userMunicipality);
            
            // Fetch attachments for each LGU
            for (let i = 0; i < filteredAnswers.length; i++) {
              const lgu = filteredAnswers[i];
              
              // Clean the LGU name for Firebase path
              const cleanName = lgu.lguName.replace(/[.#$\[\]]/g, '_');
              
              // Reference to attachments in Firebase
              const attachmentsRef = ref(
                db,
                `attachments/${selectedYear}/LGU/${cleanName}`
              );
              
              const attachmentsSnapshot = await get(attachmentsRef);
              
              if (attachmentsSnapshot.exists()) {
                const attachments = attachmentsSnapshot.val();
                
                // Create a map to store attachments by their indicator path
                const attachmentsByIndicator = {};
                
                Object.keys(attachments).forEach(key => {
                  const attachment = attachments[key];
                  
                  const keyParts = key.split('_');
                  
                  // Determine if this is a main or sub indicator
                  if (key.includes('_sub_')) {
                    // This is a sub-indicator attachment
                    const recordKey = keyParts[0];
                    const subIndex = keyParts[2];
                    const title = keyParts.slice(3, -1).join('_');
                    
                    const indicatorId = `${recordKey}_sub_${subIndex}_${title}`;
                    
                    if (!attachmentsByIndicator[indicatorId]) {
                      attachmentsByIndicator[indicatorId] = [];
                    }
                    
                    attachmentsByIndicator[indicatorId].push({
                      key: key,
                      name: attachment.fileName || attachment.name || 'Attachment',
                      url: attachment.url || attachment.fileData,
                      fileData: attachment.fileData || attachment.url,
                      fileSize: attachment.fileSize,
                      uploadedAt: attachment.uploadedAt
                    });
                  } else {
                    // This is a main indicator attachment
                    const recordKey = keyParts[0];
                    const mainIndex = keyParts[1];
                    const title = keyParts.slice(2, -1).join('_');
                    
                    const indicatorId = `${recordKey}_${mainIndex}_${title}`;
                    
                    if (!attachmentsByIndicator[indicatorId]) {
                      attachmentsByIndicator[indicatorId] = [];
                    }
                    
                    attachmentsByIndicator[indicatorId].push({
                      key: key,
                      name: attachment.fileName || attachment.name || 'Attachment',
                      url: attachment.url || attachment.fileData,
                      fileData: attachment.fileData || attachment.url,
                      fileSize: attachment.fileSize,
                      uploadedAt: attachment.uploadedAt
                    });
                  }
                });
                
                lgu.attachmentsByIndicator = attachmentsByIndicator;
              } else {
                lgu.attachmentsByIndicator = {};
              }
            }
            
            setLguAnswers(filteredAnswers);
            setData(filteredAnswers);
            
            // After getting LGU answers, fetch ALL indicators for ALL tabs
            await fetchAllIndicators();
          } else {
            setLguAnswers([]);
            setData([]);
          }
          setLoading(false);
        });
      } catch (error) {
        console.error("Error fetching LGU answers:", error);
        setLoading(false);
      }
    };

    fetchLGUAnswers();
  }, [adminUid, selectedYear, submissionDeadline, userRole, userMunicipality, location.state, municipalityMap]);

  const filterLGUAnswersByRole = (answers, role, municipality) => {
    if (!answers) return [];
    
    const answersList = [];
    let counter = 1;
    
    console.log(`Filtering answers for role: ${role}, municipality: ${municipality}`);
    
    Object.keys(answers).forEach(lguName => {
      const lguData = answers[lguName];
      
      // Skip if already forwarded to PO (but show if verified from state)
      if (lguData._metadata?.forwarded && !location.state?.isVerified) {
        console.log(`Skipping ${lguName} - already forwarded to PO`);
        return; // Skip this LGU
      }
      
      // Get the actual municipality from the municipalityMap using the user's UID
      let actualMunicipality = lguName; // Default to lguName
      
      if (lguData._metadata?.uid && municipalityMap[lguData._metadata.uid]) {
        actualMunicipality = municipalityMap[lguData._metadata.uid];
        console.log(`Found municipality for UID ${lguData._metadata.uid}: ${actualMunicipality}`);
      }
      
      // ROLE-BASED ACCESS CONTROL using users/ for role
      if (role === "admin") {
        // Admin sees ALL LGUs - no filtering
        console.log(`Admin viewing LGU: ${lguName} (${actualMunicipality})`);
      }
      else if (role === "sub-admin") {
        // Sub-admin should ONLY see LGUs from their municipality
        if (actualMunicipality.toLowerCase() !== municipality.toLowerCase()) {
          console.log(`Sub-admin skipping ${lguName} - municipality mismatch (${actualMunicipality} vs ${municipality})`);
          return; // Skip this LGU
        }
        console.log(`Sub-admin viewing LGU: ${lguName} (${actualMunicipality})`);
      }
      else if (role === "user") {
        // Regular user (LGU) - ONLY see their own municipality
        if (actualMunicipality.toLowerCase() !== municipality.toLowerCase()) {
          console.log(`User skipping ${lguName} - not their municipality (${actualMunicipality} vs ${municipality})`);
          return; // Skip this LGU
        }
        console.log(`User viewing their municipality: ${lguName} (${actualMunicipality})`);
      }
      else {
        // Unknown role - no access
        console.log(`Unknown role ${role} - no access`);
        return [];
      }
      
      // Determine status based on submission
      let status = "Pending";
      let submissionDate = "Not submitted";
      let submittedBy = "Unknown";
      
      if (lguData._metadata) {
        submittedBy = lguData._metadata.name || lguData._metadata.email || "Unknown";
        
        if (lguData._metadata.submitted) {
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
        
        // Check if returned
        if (lguData._metadata.returned) {
          status = "Returned";
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
        municipality: actualMunicipality,
        userUid: lguData._metadata?.uid || "Unknown"
      });
    });
    
    return answersList;
  };
  
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
            console.log("Admin UID found:", adminId);
          }
        }
      } catch (error) {
        console.error("Error fetching admin UID:", error);
      }
    };

    fetchAdminUid();
  }, []);

  // Fetch submission deadline
  useEffect(() => {
    if (!auth.currentUser || !adminUid || !selectedYear) return;

    const fetchDeadline = async () => {
      try {
        const deadlineRef = ref(
          db,
          `financial/${adminUid}/${selectedYear}/metadata/deadline`
        );
        
        onValue(deadlineRef, (snapshot) => {
          if (snapshot.exists()) {
            const deadline = snapshot.val();
            console.log("Deadline found:", deadline);
            setSubmissionDeadline(deadline);
          } else {
            console.log("No deadline found");
            setSubmissionDeadline("");
          }
        });
      } catch (error) {
        console.error("Error fetching deadline:", error);
      }
    };

    fetchDeadline();
  }, [adminUid, selectedYear]);

  // Add this near the top of mlgo-view.jsx, after the useState declarations
  useEffect(() => {
    // Check if this is a returned assessment from the PO
    if (location.state?.returnedFromPO || location.state?.lguData?._metadata?.returnedToMLGO) {
      console.log("⚠️ This assessment was returned by PO");
      
      // Set the remarks from location state or metadata - now per tab
      const poRemarks = location.state?.remarks || 
                        location.state?.lguData?._metadata?.remarks || 
                        "Assessment returned by Provincial Office";
      
      setRemarks(poRemarks);
      
      // The assessment is now editable for MLGO
      setIsForwarded(false);
      setIsReturned(false); // Not returned to LGU yet, just to MLGO
    }
    
    // Check if this assessment has been forwarded
    if (location.state?.lguData?._metadata?.forwarded) {
      setIsForwarded(true);
    }
  }, [location.state]);

  // Function to fetch ALL indicators for ALL tabs
  const fetchAllIndicators = async () => {
    if (!auth.currentUser || !selectedYear || !adminUid) return;

    try {
      console.log(`Fetching ALL indicators for year ${selectedYear}...`);
      
      // Define all 10 categories
      const categories = [
        { key: 'financial', path: 'financial-administration-and-sustainability', stateKey: 'indicators' },
        { key: 'disaster', path: 'disaster-preparedness', stateKey: 'disasterIndicators' },
        { key: 'social', path: 'social-protection-and-sensitivity', stateKey: 'socialIndicators' },
        { key: 'health', path: 'health-compliance-and-responsiveness', stateKey: 'healthIndicators' },
        { key: 'education', path: 'sustainable-education', stateKey: 'educationIndicators' },
        { key: 'business', path: 'business-friendliness-and-competitiveness', stateKey: 'businessIndicators' },
        { key: 'safety', path: 'safety-peace-and-order', stateKey: 'safetyIndicators' },
        { key: 'environmental', path: 'environmental-management', stateKey: 'environmentalIndicators' },
        { key: 'tourism', path: 'tourism-heritage-development-culture-and-arts', stateKey: 'tourismIndicators' },
        { key: 'youth', path: 'youth-development', stateKey: 'youthIndicators' }
      ];
      
      // Fetch each category
      for (const category of categories) {
        let indicatorsRef;
        
        if (category.key === 'financial') {
          indicatorsRef = ref(
            db, 
            `financial/${adminUid}/${selectedYear}/${category.path}/assessment`
          );
        } else {
          indicatorsRef = ref(
            db,
            `${category.key}/${adminUid}/${selectedYear}/${category.path}/assessment`
          );
        }
        
        const snapshot = await get(indicatorsRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          const indicatorsArray = Object.keys(data).map(key => ({
            firebaseKey: key,
            ...data[key]
          }));
          
          console.log(`📊 Loaded ${category.key} indicators:`, indicatorsArray.length);
          
          // Set the appropriate state
          switch(category.key) {
            case 'financial':
              setIndicators(indicatorsArray);
              break;
            case 'disaster':
              setDisasterIndicators(indicatorsArray);
              break;
            case 'social':
              setSocialIndicators(indicatorsArray);
              break;
            case 'health':
              setHealthIndicators(indicatorsArray);
              break;
            case 'education':
              setEducationIndicators(indicatorsArray);
              break;
            case 'business':
              setBusinessIndicators(indicatorsArray);
              break;
            case 'safety':
              setSafetyIndicators(indicatorsArray);
              break;
            case 'environmental':
              setEnvironmentalIndicators(indicatorsArray);
              break;
            case 'tourism':
              setTourismIndicators(indicatorsArray);
              break;
            case 'youth':
              setYouthIndicators(indicatorsArray);
              break;
            default:
              break;
          }
        } else {
          // Set empty array
          switch(category.key) {
            case 'financial':
              setIndicators([]);
              break;
            case 'disaster':
              setDisasterIndicators([]);
              break;
            case 'social':
              setSocialIndicators([]);
              break;
            case 'health':
              setHealthIndicators([]);
              break;
            case 'education':
              setEducationIndicators([]);
              break;
            case 'business':
              setBusinessIndicators([]);
              break;
            case 'safety':
              setSafetyIndicators([]);
              break;
            case 'environmental':
              setEnvironmentalIndicators([]);
              break;
            case 'tourism':
              setTourismIndicators([]);
              break;
            case 'youth':
              setYouthIndicators([]);
              break;
            default:
              break;
          }
        }
      }
      
      console.log("✅ All indicators fetched successfully");
    } catch (error) {
      console.error("Error fetching indicators:", error);
    }
  };

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

      setProfileData(editProfileData); // update visible profile
      setProfileComplete(true); // Mark profile as complete

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
  const [years, setYears] = useState(["2021","2022","2023","2024","2025","2026"]);
  
  const statuses = ["Verified", "Draft", "Incomplete"];

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

  // Safely get the data source - ensure we always have an array
  const dataSource = (lguAnswers && lguAnswers.length > 0) ? lguAnswers : (data || []);

  const filteredData = dataSource.filter((item) => {
    // Skip if item is undefined or null
    if (!item) return false;
    
    // Create a search string that combines multiple fields for better matching
    const searchTerm = search.toLowerCase().trim();
    
    // If search is empty, just apply filters
    if (!searchTerm) {
      return (
        (!filters.year || item.year === filters.year) &&
        (!filters.status || (item.status && item.status.toLowerCase() === filters.status.toLowerCase()))
      );
    }
    
    // Safely get values with fallbacks
    const lguName = item.lguName?.toLowerCase() || '';
    const municipality = item.municipality?.toLowerCase() || lguName;
    const year = item.year?.toLowerCase() || '';
    const submittedBy = item.submittedBy?.toLowerCase() || '';
    const status = item.status?.toLowerCase() || '';
    
    // Combine multiple fields for searching
    const searchableFields = [lguName, municipality, year, submittedBy, status].join(' ');
    
    // Check if search term appears in any of the combined fields
    const matchesSearch = searchableFields.includes(searchTerm);
    
    // Apply year and status filters with safe checks
    const matchesYear = !filters.year || item.year === filters.year;
    const matchesStatus = !filters.status || (item.status && item.status.toLowerCase() === filters.status.toLowerCase());
    
    return matchesSearch && matchesYear && matchesStatus;
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

  const handleTabChange = (tabId, dbPath) => {
    setActiveTab(tabId);
    setCurrentDbPath(dbPath);
  };

  // Get current tab indicators
  const getCurrentTabIndicators = () => {
    switch(activeTab) {
      case 1: return indicators;
      case 2: return disasterIndicators;
      case 3: return socialIndicators;
      case 4: return healthIndicators;
      case 5: return educationIndicators;
      case 6: return businessIndicators;
      case 7: return safetyIndicators;
      case 8: return environmentalIndicators;
      case 9: return tourismIndicators;
      case 10: return youthIndicators;
      default: return indicators;
    }
  };

  // Function to toggle flag for current tab
  const toggleFlag = () => {
    const currentTabId = activeTab;
    const isFlagged = !!verifiedFlag[currentTabId];
    
    if (isFlagged) {
      // Remove flag
      setVerifiedFlag(prev => {
        const newFlags = { ...prev };
        delete newFlags[currentTabId];
        
        // Update localStorage
        localStorage.setItem('verifiedFlag', JSON.stringify(newFlags));
        
        return newFlags;
      });
      
      alert(`${getTabName(currentTabId)} tab flag removed`);
    } else {
      // Add flag
      const bookmarkData = {
        lguName: lguAnswers[0]?.lguName || "",
        year: selectedYear,
        tabId: currentTabId,
        tabName: getTabName(currentTabId),
        timestamp: Date.now(),
        remarks: lguRemarks[currentTabId] || "Flagged as verified"
      };
      
      setVerifiedFlag(prev => {
        const newFlags = {
          ...prev,
          [currentTabId]: bookmarkData
        };
        
        // Update localStorage
        localStorage.setItem('verifiedFlag', JSON.stringify(newFlags));
        
        return newFlags;
      });
      
      alert(`${getTabName(currentTabId)} tab flagged locally`);
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
                <h3>ONE <span className="yellow">MAR</span><span className="cyan">IND</span>
                <span className="red">UQUE</span> TRACKING SYSTEM</h3>
                <div className="sidebar-divider"></div>
              </>
            )}
          </div>

          {sidebarOpen && (
            <>
              <button
                className={style.encodebackBtn}
                onClick={() => navigate("/mlgo-dashboard")}
              >
                ⬅ BACK
              </button>
              
              {/* Export Menu Button with functionality */}
              <div className={style.exportDropdownContainer}>
                <button
                  className={style.sidebarMenuItem}
                  onClick={() => setShowExportModal(!showExportModal)}
                  style={{ width: "100%", justifyContent: "flex-start" }}
                >
                  <FiClipboard style={{ marginRight: "8px", fontSize: "18px" }} />
                  Export Menu
                </button>
                
                {/* Export Dropdown - appears next to sidebar button */}
                {showExportModal && (
                  <div style={{
                    position: "fixed",
                    left: sidebarOpen ? '220px' : '60px', // Position to the right of sidebar
                    top: 'auto',
                    marginTop: '-40px',
                    marginLeft: '10px',
                    backgroundColor: "white",
                    borderRadius: "6px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                    minWidth: "280px",
                    zIndex: 1000,
                    overflow: "hidden",
                    border: "1px solid #f0f0f0"
                  }}>
                    <div 
                      className={style.exportDropdownItem}
                      onClick={() => {
                        // Add your export function here
                        console.log("Export as PDF clicked");
                        setShowExportModal(false);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <div className={style.pdfIcon}></div>
                      <h4>Export as PDF</h4>
                    </div>
                  </div>
                )}
              </div>

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
            </div>
          </div>

          {/* Assessment Content */}
          <div className={style.assessmentContainer}>

            {/* Header with year and status */}
            <div className={style.assessmentHeader}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "15px", 
                flexWrap: "wrap",
                width: "100%",
                justifyContent: "space-between"
              }}>
                {/* Left side - Status and Deadline together */}
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "15px", 
                  flexWrap: "wrap" 
                }}>
                  {/* Status Badge */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 12px",
                    backgroundColor: location.state?.isVerified ? "#28a745" : "#ffb775",
                    borderRadius: "20px",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}>
                    <span>{location.state?.isVerified ? "✓" : "ⓘ"}</span>
                    <span>{location.state?.isVerified ? "Assessment Verified" : "Assessment Not Yet Verified"}</span>
                  </div>

                  {/* Submission Deadline Badge */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 15px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "20px",
                    border: "1px solid #ddd"
                  }}>
                    <span style={{ fontWeight: "600", color: "#333", fontSize: "14px" }}>
                      Submission Deadline:
                    </span>
                    <span style={{ color: "#840000", fontWeight: "500", fontSize: "14px" }}>
                      {submissionDeadline 
                        ? new Date(submissionDeadline).toLocaleDateString('en-US', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                          })
                        : "Not set"}
                    </span>
                  </div>
                </div>

                {/* Right side - Action Buttons */}
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "10px"
                }}>
                  {/* Return to LGU Button */}
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <button
                      onClick={handleReturnToLGU}
                      disabled={isReturned || loading || location.state?.isVerified}
                      style={{
                        backgroundColor: (isReturned || location.state?.isVerified) ? "#990202e6" : "#990202",
                        color: "white",
                        border: "none",
                        padding: "8px 20px",
                        borderRadius: "5px",
                        fontSize: "14px",
                        cursor: (isReturned || location.state?.isVerified) ? "not-allowed" : "pointer",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        whiteSpace: "nowrap",
                        opacity: (isReturned || location.state?.isVerified) ? 0.6 : 1
                      }}
                    >
                      <span>↩</span>
                      {location.state?.isVerified ? "Verified (Cannot Return)" : (isReturned ? "Returned to LGU" : "Return to LGU")}
                    </button>
                  </div>

                  {/* Forward to Provincial Office Button with Tooltip */}
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <button
                      onClick={handleForwardToPO}
                      disabled={isForwarded || isReturned || loading || location.state?.isVerified}
                      onMouseEnter={(e) => {
                        if (!isForwarded && !isReturned && !location.state?.isVerified) {
                          const tooltip = e.currentTarget.parentElement.querySelector('.forward-tooltip');
                          if (tooltip) tooltip.style.display = 'block';
                        }
                      }}
                      onMouseLeave={(e) => {
                        const tooltip = e.currentTarget.parentElement.querySelector('.forward-tooltip');
                        if (tooltip) tooltip.style.display = 'none';
                      }}
                      style={{
                        backgroundColor: (isForwarded || isReturned || location.state?.isVerified) ? "#006735e6" : "#006736",
                        color: "white",
                        border: "none",
                        padding: "8px 20px",
                        borderRadius: "5px",
                        fontSize: "14px",
                        cursor: (isForwarded || isReturned || location.state?.isVerified) ? "not-allowed" : "pointer",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        whiteSpace: "nowrap",
                        opacity: (isForwarded || isReturned || location.state?.isVerified) ? 0.6 : 1
                      }}
                    >
                      <span>→</span>
                      {location.state?.isVerified ? "Verified (Cannot Forward)" : (isForwarded ? "Forwarded to PO" : isReturned ? "Cannot Forward (Returned)" : "Forward to Provincial Office")}
                    </button>
                    
                    {/* Tooltip - only show if not forwarded AND not returned */}
                    {!isForwarded && !isReturned && !location.state?.isVerified && (
                      <div 
                        className="forward-tooltip"
                        style={{
                          position: "absolute",
                          bottom: "100%",
                          left: "0",
                          marginBottom: "5px",
                          backgroundColor: "#2d2d2d",
                          color: "#e0e0e0",
                          padding: "8px 12px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          whiteSpace: "normal",
                          display: "none",
                          zIndex: 1000,
                          boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                          pointerEvents: "none",
                          width: "280px",
                          fontFamily: "Arial, sans-serif",
                          border: "1px solid #444"
                        }}
                      >
                        <div style={{ 
                          display: "flex", 
                          flexDirection: "column", 
                          gap: "2px",
                          lineHeight: "1.4"
                        }}>
                          <span style={{ color: "#aaa", fontSize: "11px" }}>Submit assessment to the PO for final verification. Wait for a verification notification or for it to be returned with revision remarks.</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Optional: Show a different tooltip when returned */}
                    {isReturned && (
                      <div 
                        className="forward-tooltip"
                        style={{
                          position: "absolute",
                          bottom: "100%",
                          left: "0",
                          marginBottom: "5px",
                          backgroundColor: "#2d2d2d",
                          color: "#e0e0e0",
                          padding: "8px 12px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          whiteSpace: "normal",
                          display: "none",
                          zIndex: 1000,
                          boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                          pointerEvents: "none",
                          width: "200px",
                          fontFamily: "Arial, sans-serif",
                          border: "1px solid #444"
                        }}
                      >
                        <div style={{ 
                          display: "flex", 
                          flexDirection: "column", 
                          gap: "2px",
                          lineHeight: "1.4"
                        }}>
                          <span style={{ color: "#aaa", fontSize: "11px" }}>This assessment has been returned to LGU. It cannot be forwarded until the LGU resubmits.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className={style.assessmentTabs}>
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  className={activeTab === tab.id ? style.activeTab : ""}
                  onClick={() => handleTabChange(tab.id, tab.dbPath)}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            {/* Scrollable Content */}
            <div className={style.lgutableBox}>
              <div className={style.scrollableContent}
                style={{ 
                  maxHeight: sidebarOpen ? '57vh' : '63vh',
                }}
              >
                {loading ? (
                  <p style={{ textAlign: "center", marginTop: "20px" }}>Loading...</p>
                ) : userRole === "user" || userRole === "sub-admin" ? (
                  <>
{lguAnswers.length > 0 ? (
  lguAnswers
    .filter(lgu => lgu.municipality === userMunicipality) // Only show LGU matching user's municipality
    .map((lgu) => {
      const currentTabIndicators = getCurrentTabIndicators();
      
      return (
        <div key={lgu.id}>
          
          {/* Indicators with Answers */}
          {currentTabIndicators && currentTabIndicators.length > 0 ? (
            currentTabIndicators.map((record) => (
              <div key={record.firebaseKey} className="reference-wrapper">
                
                {/* Main Indicators */}
                {record.mainIndicators?.map((main, index) => {
                  const radioKey = getAnswerKey(record, index, main.title, false, null, "radio");
                  const baseKey = getAnswerKey(record, index, main.title);
                  const answer =
                    main.fieldType === "multiple"
                      ? (lgu.data?.[radioKey] ?? lgu.data?.[baseKey])
                      : lgu.data?.[baseKey];
                  
                  return (
                    <div key={index} className="reference-wrapper">
                      {/* Indicator Row */}
                      <div className="reference-row">
                        <div className="reference-label">
                          {main.title}
                        </div>

                        <div className="mainreference-field">
                          <div className="field-content">
                            
{main.fieldType === "multiple" &&
  main.choices.map((choice, i) => (
    <div key={i}>
      <input 
        type="radio" 
        name={`${record.firebaseKey}_${index}_${main.title}`} // Make name unique
        checked={isRadioSelected(answer?.value, choice, i)}
        disabled 
      /> 
      <span>
        {choice && typeof choice === "object"
          ? (choice.label ?? choice.value ?? choice.name ?? choice.title ?? choice.text ?? "")
          : choice}
      </span>
    </div>
  ))
}
                            
{main.fieldType === "checkbox" &&
  main.choices.map((choice, i) => {
    const checkboxKey = getAnswerKey(record, index, `${main.title}_${i}`, false, null, "checkbox");
    const legacyCheckboxKey = getAnswerKey(record, index, `${main.title}_${i}`);
    const checkboxAnswer = lgu.data?.[checkboxKey] ?? lgu.data?.[legacyCheckboxKey];
    
    return (
      <div key={i}>
        <input 
          type="checkbox" 
          checked={checkboxAnswer?.value === true}
          disabled 
        /> 
        <span>
          {choice && typeof choice === "object"
            ? (choice.label ?? choice.value ?? choice.name ?? choice.title ?? choice.text ?? "")
            : choice}
        </span>
      </div>
    );
  })
}
                            
                            {(main.fieldType === "short" || main.fieldType === "integer" || main.fieldType === "date") && (
                              <div>
                                {answer?.value ? (
                                  <span>
                                    {answer.value}
                                  </span>
                                ) : (
                                  <span style={{ fontStyle: "italic", color: "gray" }}>
                                    No answer provided
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

      {/* Mode of Verification with Attachments */}
      {main.verification && (
        <div className="reference-verification-full" style={{ 
          display: "flex",
          flexDirection: "column",
          width: "100%"
        }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            width: "100%",
            gap: "10px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
              <span className="reference-verification-label">Mode of Verification:</span>
              <span className="reference-verification-value">{main.verification}</span>
            </div>
          </div>
          
          {/* Attachments for this indicator */}
          {(() => {
            const indicatorId = `${record.firebaseKey}_${index}_${main.title}`;
            const indicatorAttachments = lgu.attachmentsByIndicator?.[indicatorId] || [];
            
            return indicatorAttachments.length > 0 && (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginTop: "8px",
                width: "100%"
              }}>
                {indicatorAttachments.map((attachment, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#e8f5e9",
                    padding: "4px 10px",
                    borderRadius: "16px",
                    fontSize: "11px",
                    border: "1px solid #c8e6c9",
                    maxWidth: "200px",
                    cursor: "pointer"
                  }}
                  onClick={() => downloadAttachment(attachment)}>
                    <span style={{ fontSize: "12px" }}>📎</span>
                    <span style={{ 
                      overflow: "hidden", 
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "#0c1a4b",
                      textDecoration: "underline"
                    }}>
                      {attachment.name || 'Attachment'}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
})}

{record.subIndicators?.map((sub, index) => {
  const radioKey = getAnswerKey(record, index, sub.title, true, null, "radio");
  const baseKey = getAnswerKey(record, index, sub.title, true);
  const answer =
    sub.fieldType === "multiple"
      ? (lgu.data?.[radioKey] ?? lgu.data?.[baseKey])
      : lgu.data?.[baseKey];
  
  return (
    <div key={index} className="reference-wrapper">
      {/* Sub Indicator Row */}
      <div className="reference-row sub-row">
        <div className="reference-label">
          {sub.title}
        </div>

        <div className="reference-field">
          
          {/* Multiple Choice - FIXED: Use correct sub-indicator name format */}
          {sub.fieldType === "multiple" &&
            sub.choices.map((choice, i) => (
              <div key={i}>
                <input 
                  type="radio" 
                  name={`${record.firebaseKey}_sub_${index}_${sub.title}`} // Fixed: use _sub_ format
                  checked={isRadioSelected(answer?.value, choice, i)}
                  disabled 
                /> 
                <span>
                  {choice && typeof choice === "object"
                    ? (choice.label ?? choice.value ?? choice.name ?? choice.title ?? choice.text ?? "")
                    : choice}
                </span>
              </div>
            ))
          }
          
          {/* Checkbox */}
          {sub.fieldType === "checkbox" &&
            sub.choices.map((choice, i) => {
              const checkboxKey = getAnswerKey(record, index, `${sub.title}_${i}`, true, null, "checkbox");
              const legacyCheckboxKey = getAnswerKey(record, index, `${sub.title}_${i}`, true);
              const checkboxAnswer = lgu.data?.[checkboxKey] ?? lgu.data?.[legacyCheckboxKey];
              
              return (
                <div key={i}>
                  <input 
                    type="checkbox" 
                    checked={checkboxAnswer?.value === true}
                    disabled 
                  /> 
                  <span>
                    {choice && typeof choice === "object"
                      ? (choice.label ?? choice.value ?? choice.name ?? choice.title ?? choice.text ?? "")
                      : choice}
                  </span>
                </div>
              );
            })
          }
          
          {(sub.fieldType === "short" || sub.fieldType === "integer" || sub.fieldType === "date") && (
            <div>
              {answer?.value ? (
                <span>
                  {answer.value}
                </span>
              ) : (
                <span style={{ fontStyle: "italic", color: "gray" }}>
                  No answer provided
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mode of Verification for Sub Indicators */}
      {sub.verification && (
        <div className="reference-verification-full" style={{ 
          display: "flex",
          flexDirection: "column",
          width: "100%",
          marginTop: "5px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
            <span className="reference-verification-label">Mode of Verification:</span>
            <span className="reference-verification-value">{sub.verification}</span>
          </div>
          
          {/* Attachments for this sub indicator */}
          {(() => {
            const indicatorId = `${record.firebaseKey}_sub_${index}_${sub.title}`;
            const indicatorAttachments = lgu.attachmentsByIndicator?.[indicatorId] || [];
            
            return indicatorAttachments.length > 0 && (
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginTop: "8px",
                width: "100%"
              }}>
                {indicatorAttachments.map((attachment, idx) => (
                  <div key={idx} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#e8f5e9",
                    padding: "4px 10px",
                    borderRadius: "16px",
                    fontSize: "11px",
                    border: "1px solid #c8e6c9",
                    maxWidth: "200px",
                    cursor: "pointer"
                  }}
                  onClick={() => downloadAttachment(attachment)}>
                    <span style={{ fontSize: "12px" }}>📎</span>
                    <span style={{ 
                      overflow: "hidden", 
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "#0c1a4b",
                      textDecoration: "underline"
                    }}>
                      {attachment.name || 'Attachment'}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Nested Sub-Indicators */}
      {sub.nestedSubIndicators && sub.nestedSubIndicators.length > 0 && (
        <div className="nested-reference-wrapper">
          {sub.nestedSubIndicators.map((nested, nestedIndex) => {
            const nestedRadioKey = getAnswerKey(record, index, nested.title, true, nestedIndex, "radio");
            const baseNestedKey = getAnswerKey(record, index, nested.title, true, nestedIndex);
            const nestedAnswer =
              nested.fieldType === "multiple"
                ? (lgu.data?.[nestedRadioKey] ?? lgu.data?.[baseNestedKey])
                : lgu.data?.[baseNestedKey];
            
            // Also check with prefix if needed
            const prefixMap = {
              1: 'financial_',
              2: 'disaster_',
              3: 'social_',
              4: 'health_',
              5: 'education_',
              6: 'business_',
              7: 'safety_',
              8: 'environmental_',
              9: 'tourism_',
              10: 'youth_'
            };
            const prefix = prefixMap[activeTab] || '';
            const prefixedNestedAnswer = lgu.data?.[`${prefix}${baseNestedKey}`];
            
            const finalNestedAnswer = nestedAnswer || prefixedNestedAnswer;
            
            return (
              <div key={nested.id || nestedIndex} className="nested-reference-item">
                <div className="nested-reference-row">
                  <div className="nested-reference-label">
                    {nested.title || 'Untitled'}
                  </div>
                  <div className="nested-reference-field">
                    
                    {/* Multiple Choice - FIXED: Already has correct name format */}
                    {nested.fieldType === "multiple" && nested.choices?.map((choice, i) => (
                      <div key={i}>
                        <input 
                          type="radio" 
                          name={`${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}`} // Already correct
                          checked={isRadioSelected(finalNestedAnswer?.value, choice, i)}
                          disabled 
                        /> 
                        <span>
                          {choice && typeof choice === "object"
                            ? (choice.label ?? choice.value ?? choice.name ?? choice.title ?? choice.text ?? "")
                            : choice}
                        </span>
                      </div>
                    ))}

                    {/* Checkbox */}
                    {nested.fieldType === "checkbox" && nested.choices?.map((choice, i) => {
                      const nestedCheckboxKey = getAnswerKey(record, index, `${nested.title}_${i}`, true, nestedIndex, "checkbox");
                      const legacyNestedCheckboxKey = getAnswerKey(record, index, `${nested.title}_${i}`, true, nestedIndex);
                      const nestedCheckboxAnswer = lgu.data?.[nestedCheckboxKey] ?? lgu.data?.[legacyNestedCheckboxKey];
                      
                      return (
                        <div key={i}>
                          <input 
                            type="checkbox" 
                            checked={nestedCheckboxAnswer?.value === true}
                            disabled 
                          /> 
                          <span>
                            {choice && typeof choice === "object"
                              ? (choice.label ?? choice.value ?? choice.name ?? choice.title ?? choice.text ?? "")
                              : choice}
                          </span>
                        </div>
                      );
                    })}

                    {/* Short Answer, Integer, Date */}
                    {(nested.fieldType === "short" || nested.fieldType === "integer" || nested.fieldType === "date") && (
                      <div>
                        {finalNestedAnswer?.value ? (
                          <span>
                            {nested.fieldType === "date" 
                              ? new Date(finalNestedAnswer.value).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })
                              : finalNestedAnswer.value
                            }
                          </span>
                        ) : (
                          <span style={{ fontStyle: "italic", color: "gray" }}>
                            No answer provided
                          </span>
                        )}
                      </div>
                    )}

                    {/* No field type selected */}
                    {!nested.fieldType && (
                      <span style={{ fontStyle: "italic", color: "gray" }}>
                        No field type selected
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Verification for nested sub-indicator */}
                {nested.verification && (
                  <div className="nested-verification">
                    <span className="verification-label">Mode of Verification:</span>
                    <span className="verification-value">{nested.verification}</span>
                    
                    {/* Attachments for nested sub-indicator */}
                    {(() => {
                      const nestedIndicatorId = `${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}`;
                      const nestedAttachments = lgu.attachmentsByIndicator?.[nestedIndicatorId] || [];
                      
                      return nestedAttachments.length > 0 && (
                        <div style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          marginTop: "8px",
                          width: "100%"
                        }}>
                          {nestedAttachments.map((attachment, idx) => (
                            <div key={idx} style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              backgroundColor: "#e8f5e9",
                              padding: "4px 10px",
                              borderRadius: "16px",
                              fontSize: "11px",
                              border: "1px solid #c8e6c9",
                              maxWidth: "200px",
                              cursor: "pointer"
                            }}
                            onClick={() => downloadAttachment(attachment)}>
                              <span style={{ fontSize: "12px" }}>📎</span>
                              <span style={{ 
                                overflow: "hidden", 
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: "#0c1a4b",
                                textDecoration: "underline"
                              }}>
                                {attachment.name || 'Attachment'}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
})}
                                </div>
                              ))
                            ) : (
                              <p style={{ textAlign: "center", marginTop: "20px" }}>
                                No indicators available for this tab.
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div>
                        <p style={{ textAlign: "center", marginTop: "20px" }}>
                          {userRole === "user" 
                            ? `No assessment submitted yet for ${userMunicipality}.`
                            : "No LGU answers available."}
                        </p>
                      </div>
                    )}

{/* Remarks from PO Section */}
<div style={{
  marginTop: "30px",
  padding: "20px",
  backgroundColor: "#f9f9f9",
  borderRadius: "8px",
  border: "1px solid #e0e0e0"
}}>
  <div style={{ marginBottom: "20px" }}>
    <h4 style={{ 
      margin: "0 0 10px 0", 
      color: "#333", 
      fontSize: "16px",
      fontWeight: "600"
    }}>
      Remarks from PO for {getTabName(activeTab)} Tab:
    </h4>
    
    {/* Display the remark for current tab */}
    <div style={{
      backgroundColor: "#fff3cd",
      border: "1px solid #ffeeba",
      borderRadius: "8px",
      padding: "15px",
      color: "#856404",
      fontSize: "14px",
      minHeight: "60px",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    }}>
      {remarks && typeof remarks === 'object' && remarks[activeTab] ? (
        <div>
          <strong>Remark:</strong> {remarks[activeTab]}
        </div>
      ) : remarks && typeof remarks === 'string' ? (
        <div>
          <strong>Remark:</strong> {remarks}
        </div>
      ) : (
        <div style={{ fontStyle: "italic", color: "#999" }}>
          No remark from PO for this tab
        </div>
      )}
    </div>
  </div>

  {/* Add Remarks for LGU - only show if not verified */}
  {!location.state?.isVerified && (
    <div style={{ marginBottom: "20px" }}>
      <h4 style={{ 
        margin: "0 0 10px 0", 
        color: "#333", 
        fontSize: "16px",
        fontWeight: "600"
      }}>
        Add Remarks for LGU ({getTabName(activeTab)} Tab):
      </h4>
      <textarea
        placeholder="Type your remarks for the LGU here..."
        rows="4"
        value={lguRemarks[activeTab] || ""}
        onChange={(e) => setLguRemarks(prev => ({ 
          ...prev, 
          [activeTab]: e.target.value 
        }))}
        style={{
          width: "100%",
          padding: "12px",
          border: "1px solid #ccc",
          borderRadius: "8px",
          fontSize: "14px",
          resize: "vertical",
          fontFamily: "inherit"
        }}
      />
    </div>
  )}

  {/* Flag as Verified Button with Tooltip */}
  <div style={{
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: "15px"
  }}>
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={toggleFlag}
        style={{
          backgroundColor: verifiedFlag[activeTab] ? "#dc3545" : "#28a745",
          color: "white",
          border: "none",
          padding: "10px 30px",
          borderRadius: "5px",
          fontSize: "14px",
          cursor: "pointer",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}
        onMouseOver={(e) => {
          const tooltip = e.currentTarget.parentElement.querySelector('.flag-tooltip');
          if (tooltip) tooltip.style.display = 'block';
        }}
        onMouseOut={(e) => {
          const tooltip = e.currentTarget.parentElement.querySelector('.flag-tooltip');
          if (tooltip) tooltip.style.display = 'none';
        }}
      >
        <span>⚐</span>
        {verifiedFlag[activeTab] ? `Remove Flag from ${getTabName(activeTab)} Tab` : `Flag ${getTabName(activeTab)} Tab as Verified`}
      </button>
      
      {/* Tooltip */}
      <div 
        className="flag-tooltip"
        style={{
          position: "absolute",
          bottom: "100%",
          left: "0",
          marginBottom: "5px",
          backgroundColor: "#2d2d2d",
          color: "#e0e0e0",
          padding: "8px 12px",
          borderRadius: "4px",
          fontSize: "12px",
          whiteSpace: "normal",
          display: "none",
          zIndex: 1000,
          boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
          pointerEvents: "none",
          width: "200px",
          fontFamily: "Arial, sans-serif",
          border: "1px solid #444"
        }}
      >
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "2px",
          lineHeight: "1.4"
        }}>
          <span style={{ color: "#aaa", fontSize: "11px" }}>Mark as verified to track reviewed sections.</span>
        </div>
      </div>
    </div>
  </div>
</div>

{/* Close the main conditional rendering */}
</>
) : null}
</div>
</div>
</div>

{/* Modals */}
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
            setEditProfileData(profileData);
            setShowEditProfileModal(false);
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
          <label>Municipality:</label>
          <select
            value={editProfileData.municipality}
            onChange={(e) =>
              setEditProfileData({ ...editProfileData, municipality: e.target.value })
            }
            disabled={profileComplete}
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
    </div>
  );
}