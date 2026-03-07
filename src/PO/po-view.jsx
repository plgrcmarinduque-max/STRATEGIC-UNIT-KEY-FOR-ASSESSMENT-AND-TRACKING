import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import style from "src/PO-CSS/po-view.module.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiFilter, FiRotateCcw, FiSettings, FiLogOut, FiFileText, FiClipboard } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, push, onValue, set, get } from "firebase/database";


export default function POView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [forwardedAssessment, setForwardedAssessment] = useState(null);
  const [verifiedFlag, setVerifiedFlag] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const lguName = location.state.lguName || location.state.municipality; 
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
  
  // State for ALL indicators (10 categories) - ADD THESE
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
  
  const [activeTab, setActiveTab] = useState(1); // ADD THIS
  const [userRole, setUserRole] = useState(null);
  const [userMunicipality, setUserMunicipality] = useState("");
  const [loading, setLoading] = useState(true);
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [adminUid, setAdminUid] = useState(null);
  const [lguAnswers, setLguAnswers] = useState([]);
  const [selectedYear, setSelectedYear] = useState(location.state?.year || "2026");
  const [newRecord, setNewRecord] = useState({
    year: "",
    municipality: ""
  });

  const [showExportModal, setShowExportModal] = useState(false);
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

const [remarks, setRemarks] = useState("");

const handleTabChange = (tabId) => { // ADD THIS
  setActiveTab(tabId);
};

// Add this function to handle verification
const handleVerifyAssessment = async () => {
  if (!lguAnswers.length || !forwardedAssessment) {
    alert("No assessment data to verify");
    return;
  }

  const confirmVerify = window.confirm(
    "Are you sure you want to verify this assessment? This will mark it as verified and cannot be undone."
  );
  
  if (!confirmVerify) return;

  try {
    setLoading(true);
    const lgu = lguAnswers[0];
    
    // Clean the LGU name for Firebase path
    const cleanLguName = lgu.lguName.replace(/[.#$\[\]]/g, '_');
    
    // Get the MLGO's UID from the forwarded assessment
    const mlgoUid = forwardedAssessment.lguUid || lgu.lguUid;
    
    if (!mlgoUid) {
      console.error("No MLGO UID found in:", { forwardedAssessment, lgu });
      alert("MLGO information not found. Cannot verify assessment.");
      return;
    }
    
    console.log("Verifying assessment for MLGO with UID:", mlgoUid);
    
    // 1. Get the current data from answers node first
    const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanLguName}`);
    const snapshot = await get(answersRef);
    
    let lguUidForNotification = null;
    
    if (snapshot.exists()) {
      const currentData = snapshot.val();
      lguUidForNotification = currentData._metadata?.uid;
      
      // Create NEW metadata with verified flags only
      const updatedMetadata = {
        // Keep essential user info
        uid: currentData._metadata?.uid,
        email: currentData._metadata?.email,
        name: currentData._metadata?.name,
        lastSaved: currentData._metadata?.lastSaved,
        year: currentData._metadata?.year,
        
        // Verified flags
        submitted: true,
        verified: true,
        verifiedAt: Date.now(),
        verifiedBy: auth.currentUser?.email,
        verifiedByName: profileData.name || auth.currentUser?.email,
        remarks: remarks || "Assessment verified"
        
        // NO forwarding or return flags here
      };
      
      const updatedData = {
        ...currentData,
        _metadata: updatedMetadata
      };
      
      await set(answersRef, updatedData);
      console.log("✅ Updated answers node with verified metadata");
    }
    
    // 2. Save to verified node
    const verifiedData = {
      lguUid: mlgoUid,
      year: selectedYear,
      lguName: lgu.lguName,
      municipality: lgu.municipality,
      verifiedAt: Date.now(),
      verifiedBy: auth.currentUser?.email,
      verifiedByName: profileData.name || auth.currentUser?.email,
      originalData: lgu.data,
      submission: lgu.submission,
      deadline: lgu.deadline,
      submittedBy: lgu.submittedBy,
      forwardedBy: forwardedAssessment.forwardedBy,
      remarks: remarks || "Assessment verified",
      attachmentsByIndicator: lgu.attachmentsByIndicator || {}
    };
    
    // Save to verified node (organized by year then LGU)
    const verifiedRef = ref(db, `verified/${selectedYear}/LGU/${cleanLguName}`);
    await set(verifiedRef, verifiedData);
    console.log("✅ Saved to verified node");
    
    // 3. Remove from forwarded node (since it's now verified)
    const forwardedRef = ref(db, `forwarded/${auth.currentUser.uid}`);
    const forwardedSnapshot = await get(forwardedRef);
    
    if (forwardedSnapshot.exists()) {
      const forwardedData = forwardedSnapshot.val();
      
      // Find and delete the specific forwarded record
      for (const [key, item] of Object.entries(forwardedData)) {
        if (item.lguUid === mlgoUid && item.year === selectedYear) {
          await set(ref(db, `forwarded/${auth.currentUser.uid}/${key}`), null);
          console.log("✅ Removed from forwarded node");
          break;
        }
      }
    }
    
    // 4. Create a notification for the MLGO
const mlgoNotificationRef = ref(db, `notifications/${selectedYear}/MLGO/${mlgoUid}`);
const mlgoNotificationId = Date.now().toString();
const mlgoNotificationData = {
  id: mlgoNotificationId,
  type: "assessment_verified",
  title: `Assessment Form (${selectedYear}) has been verified by the Provincial Office.`,
  message: `The assessment for ${lgu.lguName} has been verified.`,
  from: auth.currentUser?.email,
  fromName: profileData.name || auth.currentUser?.email,
  timestamp: Date.now(),
  read: false,
  year: selectedYear,
  municipality: lgu.municipality, // Add municipality
  action: "view_verified_assessment"
};
await set(ref(db, `notifications/${selectedYear}/MLGO/${mlgoUid}/${mlgoNotificationId}`), mlgoNotificationData);

// 5. Create a notification for the LGU (using UID from metadata)
if (lguUidForNotification) {
  const lguNotificationRef = ref(db, `notifications/${selectedYear}/LGU/${lguUidForNotification}`);
  const lguNotificationId = Date.now().toString();
  const lguNotificationData = {
    id: lguNotificationId,
    type: "assessment_verified",
    title: `Assessment Form (${selectedYear}) has been verified by the Provincial Office.`,
    message: `Your assessment has been verified.`,
    from: auth.currentUser?.email,
    fromName: profileData.name || auth.currentUser?.email,
    timestamp: Date.now(),
    read: false,
    year: selectedYear,
    municipality: lgu.municipality, // Add municipality
    action: "view_verified_assessment"
  };
  
  await set(ref(db, `notifications/${selectedYear}/LGU/${lguUidForNotification}/${lguNotificationId}`), lguNotificationData);
}
    
    console.log("✅ Notifications created");
    
    alert("Assessment verified successfully!");
    setIsVerified(true);
    setRemarks("");
    
    // Navigate back to dashboard after successful verification
    navigate("/dashboard");
    
  } catch (error) {
    console.error("Error verifying assessment:", error);
    alert("Failed to verify assessment: " + error.message);
  } finally {
    setLoading(false);
  }
};

// Load verified flag from localStorage on component mount
useEffect(() => {
  const savedFlag = localStorage.getItem('verifiedFlag');
  if (savedFlag) {
    setVerifiedFlag(JSON.parse(savedFlag));
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


useEffect(() => {
  const loadAssessmentData = async () => {
    if (!auth.currentUser || !selectedYear || !location.state?.lguUid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Get the municipality from state
      const municipality = location.state.municipality;
      console.log("Looking for municipality in verified:", municipality);
      
      if (municipality) {
        // Reference to the verified node for this year
        const verifiedRef = ref(db, `verified/${selectedYear}/LGU`);
        const verifiedSnapshot = await get(verifiedRef);
        
        if (verifiedSnapshot.exists()) {
          const verifiedLgus = verifiedSnapshot.val();
          let foundVerifiedData = null;
          let foundLguKey = null;
          
          // Search through all LGUs to find one with matching municipality
          Object.keys(verifiedLgus).forEach(lguKey => {
            const item = verifiedLgus[lguKey];
            // Check if the municipality field matches
            if (item.municipality === municipality) {
              foundVerifiedData = item;
              foundLguKey = lguKey;
              console.log("✅ Found verified data by municipality:", item);
            }
          });
          
          if (foundVerifiedData) {
            const lguData = {
              id: 1,
              lguName: foundVerifiedData.lguName || foundLguKey,
              year: selectedYear,
              status: "Verified",
              submission: foundVerifiedData.submission || location.state.submission,
              deadline: foundVerifiedData.deadline || location.state.deadline || "Not set",
              data: foundVerifiedData.originalData || {},
              municipality: foundVerifiedData.municipality || municipality,
              submittedBy: foundVerifiedData.submittedBy || location.state.submittedBy,
              verifiedBy: foundVerifiedData.verifiedBy,
              verifiedAt: foundVerifiedData.verifiedAt,
              lguUid: foundVerifiedData.lguUid || location.state.lguUid,
              attachmentsByIndicator: foundVerifiedData.attachmentsByIndicator || {}
            };
            
            setLguAnswers([lguData]);
            setForwardedAssessment(lguData);
            setIsVerified(true);
            setLoading(false);
            return;
          } else {
            console.log("❌ No verified data found for municipality:", municipality);
          }
        }
      }
      
      // If not found in verified, fetch from forwarded
      const currentUserUid = auth.currentUser.uid;
      const forwardedRef = ref(db, `forwarded/${currentUserUid}`);
      const snapshot = await get(forwardedRef);
      
      if (snapshot.exists()) {
        const forwardedData = snapshot.val();
        
        let foundAssessment = null;
        Object.keys(forwardedData).forEach(key => {
          const item = forwardedData[key];
          if (item.lguUid === location.state.lguUid && item.year === selectedYear) {
            foundAssessment = item;
          }
        });
        
        if (foundAssessment) {
          const municipality = location.state?.municipality || foundAssessment.lguName || "Unknown";
          
          const lguData = {
            id: 1,
            lguName: foundAssessment.lguName || municipality,
            year: foundAssessment.year,
            status: foundAssessment.status || "Pending",
            submission: foundAssessment.submission || new Date().toLocaleDateString(),
            deadline: foundAssessment.deadline || "Not set",
            data: foundAssessment.originalData || {},
            municipality: municipality,
            submittedBy: foundAssessment.submittedBy || "Unknown",
            forwardedBy: foundAssessment.forwardedBy,
            forwardedAt: foundAssessment.forwardedAt,
            lguUid: foundAssessment.lguUid,
            attachmentsByIndicator: {}
          };
          
          setLguAnswers([lguData]);
          setForwardedAssessment(foundAssessment);
          setIsVerified(false);
        } else {
          alert("No assessment data found.");
        }
      } else {
        alert("No assessments found.");
      }
    } catch (error) {
      console.error("Error loading assessment:", error);
      alert("Error loading assessment: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (location.state?.lguUid && selectedYear) {
    loadAssessmentData();
  } else {
    setLoading(false);
  }
}, [auth.currentUser, selectedYear, location.state]);

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
    
    // CRITICAL FIX: Get the current user's UID
    const currentUserUid = auth.currentUser?.uid;
    
    if (!currentUserUid) {
      alert("You must be logged in to forward assessments");
      return;
    }
    
    console.log("Current user UID (sub-admin):", currentUserUid);
    
    const forwardData = {
      lguUid: currentUserUid, // Store the sub-admin's UID (NOT "No UID")
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
    alert("Assessment forwarded to Provincial Office successfully!");
    
  } catch (error) {
    console.error("Error forwarding to PO:", error);
    alert("Failed to forward assessment: " + error.message);
  } finally {
    setLoading(false);
  }
};
// Add this after your fetchLGUAnswers useEffect
useEffect(() => {
  if (lguAnswers.length > 0) {
    console.log('🔍 RAW LGU ANSWERS:', lguAnswers);
    lguAnswers.forEach((lgu, index) => {
      console.log(`LGU ${index}:`, lgu.lguName || lgu.municipality || 'Unknown');
      console.log('AttachmentsByIndicator:', lgu.attachmentsByIndicator);
    });
  }
}, [lguAnswers]);

  const [data, setData] = useState([]);

const handleReturnAssessment = async () => {
  // Check both lguAnswers and forwardedAssessment
  if (!lguAnswers.length || !forwardedAssessment) {
    console.log("Missing data:", { 
      lguAnswersLength: lguAnswers.length, 
      forwardedAssessment: forwardedAssessment 
    });
    alert("No assessment data to return. Please make sure you're viewing a forwarded assessment.");
    return;
  }

  const confirmReturn = window.confirm(
    "Are you sure you want to return this assessment to the MLGO? This will make it editable again for them."
  );
  
  if (!confirmReturn) return;

  try {
    setLoading(true);
    const lgu = lguAnswers[0];
    
    // Clean the LGU name for Firebase path
    const cleanLguName = lgu.lguName.replace(/[.#$\[\]]/g, '_');
    
    // Get the MLGO's UID from the forwarded assessment
    const mlgoUid = forwardedAssessment.lguUid || lgu.lguUid;
    
    if (!mlgoUid) {
      console.error("No MLGO UID found in:", { forwardedAssessment, lgu });
      alert("MLGO information not found. Cannot return assessment.");
      return;
    }
    
    console.log("Returning assessment to MLGO with UID:", mlgoUid);
    
    // 1. Update the original answers in the answers node
    const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanLguName}`);
    const snapshot = await get(answersRef);
    
    if (snapshot.exists()) {
      const currentData = snapshot.val();
      
      const updatedData = {
        ...currentData,
        _metadata: {
          ...currentData._metadata,
          submitted: false,
          forwarded: false,
          returnedToMLGO: true,
          returnedAt: Date.now(),
          returnedBy: auth.currentUser?.email,
          remarks: remarks || "Assessment returned for revision"
        }
      };
      
      await set(answersRef, updatedData);
      console.log("✅ Updated answers node with return metadata");
      
      // 2. Remove from forwarded node
      const forwardedRef = ref(db, `forwarded/${auth.currentUser.uid}`);
      const forwardedSnapshot = await get(forwardedRef);
      
      if (forwardedSnapshot.exists()) {
        const forwardedData = forwardedSnapshot.val();
        
        // Find and delete the specific forwarded record
        for (const [key, item] of Object.entries(forwardedData)) {
          if (item.lguUid === mlgoUid && item.year === selectedYear) {
            await set(ref(db, `forwarded/${auth.currentUser.uid}/${key}`), null);
            console.log("✅ Removed from forwarded node");
            break;
          }
        }
      }
      
      // 3. Create a notification for the MLGO
      const notificationRef = ref(db, `notifications/${selectedYear}/MLGO/${mlgoUid}`);
      const notificationId = Date.now().toString();
      const notificationData = {
        id: notificationId,
        type: "assessment_returned_from_po",
        title: `Assessment (${selectedYear}) was returned by Provincial Office`,
        message: remarks || "Please check the remarks and take appropriate action.",
        from: auth.currentUser?.email,
        fromName: profileData.name || auth.currentUser?.email,
        timestamp: Date.now(),
        read: false,
        year: selectedYear,
        lguName: lgu.lguName,
        action: "view_returned_assessment"
      };
      
      await set(ref(db, `notifications/${selectedYear}/MLGO/${mlgoUid}/${notificationId}`), notificationData);
      console.log("✅ Notification created for MLGO");
      
      alert("Assessment returned to MLGO successfully.");
      setRemarks("");
      
      // Navigate back to dashboard
      navigate("/dashboard");
    } else {
      alert("Could not find the original assessment data.");
    }
  } catch (error) {
    console.error("Error returning assessment:", error);
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

      // For admin, always set profile complete
      setProfileComplete(true);
      setShowEditProfileModal(false);
    } else {
      // No profile exists yet, but admin doesn't need one
      setProfileComplete(true);
      setShowEditProfileModal(false);
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
/*
  const fetchLGUAnswers = async () => {
    try {
      setLoading(true);
      const answersRef = ref(db, `answers/${selectedYear}/LGU`);
      
      onValue(answersRef, async (snapshot) => {
        if (snapshot.exists()) {
          const answers = snapshot.val();
          
          // Apply role-based filtering
          const filteredAnswers = filterLGUAnswersByRole(answers, userRole, userMunicipality);
          
// In fetchLGUAnswers, modify the attachments fetching part
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
  
// In fetchLGUAnswers function, replace the attachments fetching part:

if (attachmentsSnapshot.exists()) {
  const attachments = attachmentsSnapshot.val();
  
  // Create a map to store attachments by their indicator path
  const attachmentsByIndicator = {};
  
  Object.keys(attachments).forEach(key => {
    const attachment = attachments[key];
    
    console.log('Raw attachment from Firebase:', key, attachment); // Debug log
    
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
        // Include both url and fileData to be safe
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
        // Include both url and fileData to be safe
        url: attachment.url || attachment.fileData,
        fileData: attachment.fileData || attachment.url,
        fileSize: attachment.fileSize,
        uploadedAt: attachment.uploadedAt
      });
    }
  });
  
  lgu.attachmentsByIndicator = attachmentsByIndicator;
  console.log("Mapped attachments:", attachmentsByIndicator);
} else {
  lgu.attachmentsByIndicator = {};
}
}
          
          setLguAnswers(filteredAnswers);
          setData(filteredAnswers);
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

  fetchLGUAnswers();*/
}, [adminUid, selectedYear, submissionDeadline, userRole, userMunicipality]);

const handleFileUpload = async (file, recordKey, indicatorIndex, indicatorTitle, isSub = false) => {
  try {
    const user = auth.currentUser;
    const lguName = userMunicipality;
    const year = selectedYear;
    
    // Create a unique key that identifies this specific indicator
    const timestamp = Date.now();
    let attachmentKey;
    
    if (isSub) {
      attachmentKey = `${recordKey}_sub_${indicatorIndex}_${indicatorTitle}_${timestamp}`;
    } else {
      attachmentKey = `${recordKey}_${indicatorIndex}_${indicatorTitle}_${timestamp}`;
    }
    
    // Upload to Firebase Storage or save as base64
    // Then save the reference in Realtime Database
    const attachmentRef = ref(db, `attachments/${year}/LGU/${lguName}/${attachmentKey}`);
    
    await set(attachmentRef, {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      url: fileData, // Your file URL or base64 data
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.email
    });
    
    console.log("Attachment saved with key:", attachmentKey);
  } catch (error) {
    console.error("Upload error:", error);
  }
};

const handleDownload = (attachment) => {
  if (attachment.url.startsWith('data:')) {
    // Handle base64 data URL
    const link = document.createElement('a');
    link.href = attachment.url;
    link.download = attachment.name || attachment.fileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    // Regular URL - open in new tab
    window.open(attachment.url, '_blank');
  }
};

// This function is now mostly unused but keep it for compatibility
const filterLGUAnswersByRole = (answers, role, municipality) => {
  if (!answers) return [];
  
  // If we have forwarded assessment, just return it
  if (forwardedAssessment) {
    return [{
      id: 1,
      lguName: forwardedAssessment.lguName || "LGU",
      year: selectedYear,
      status: "Pending",
      submission: forwardedAssessment.submission || new Date().toLocaleDateString(),
      submittedBy: forwardedAssessment.submittedBy || "Unknown",
      deadline: forwardedAssessment.deadline || "Not set",
      data: forwardedAssessment.originalData || {},
      municipality: location.state?.municipality || "Unknown"
    }];
  }
  
  return [];
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

// REPLACE YOUR EXISTING fetchIndicators useEffect WITH THIS:
useEffect(() => {
  if (!auth.currentUser || !selectedYear || !adminUid) return;

  const fetchAllIndicators = async () => {
    try {
      console.log(`Fetching ALL indicators for year ${selectedYear}...`);
      
      // Define all 10 categories with their paths
      const categories = [
        { key: 'financial', path: 'financial-administration-and-sustainability' },
        { key: 'disaster', path: 'disaster-preparedness' },
        { key: 'social', path: 'social-protection-and-sensitivity' },
        { key: 'health', path: 'health-compliance-and-responsiveness' },
        { key: 'education', path: 'sustainable-education' },
        { key: 'business', path: 'business-friendliness-and-competitiveness' },
        { key: 'safety', path: 'safety-peace-and-order' },
        { key: 'environmental', path: 'environmental-management' },
        { key: 'tourism', path: 'tourism-heritage-development-culture-and-arts' },
        { key: 'youth', path: 'youth-development' }
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
          
          // Set the appropriate state based on category
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
          // Set empty array if no data
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

  fetchAllIndicators();
}, [selectedYear, adminUid, db]);



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

  // Check if user is admin
  const userRef = ref(db, `users/${auth.currentUser.uid}`);
  const userSnapshot = await get(userRef);
  const isAdmin = userSnapshot.exists() && userSnapshot.val().role === "admin";

  // Only validate for non-admin users
  if (!isAdmin) {
    if (!editProfileData?.name?.trim()) {
      alert("Please enter your name");
      return;
    }

    if (!editProfileData?.municipality?.trim()) {
      alert("Please select your municipality");
      return;
    }
  }

  try {
    setSavingProfile(true);

    await set(ref(db, `profiles/${auth.currentUser.uid}`), {
      ...editProfileData,
      email: auth.currentUser.email
    });

    setProfileData(editProfileData);
    setProfileComplete(true);

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

// Get current tab indicators - ADD THIS FUNCTION
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
      onClick={() => navigate("/dashboard")}
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
  {/* Return Assessment Button */}
  <div style={{ position: "relative", display: "inline-block" }}>
    <button
      onClick={handleReturnAssessment}
      disabled={isVerified || loading}
      onMouseEnter={(e) => {
        if (!isVerified) {
          const tooltip = e.currentTarget.parentElement.querySelector('.return-tooltip');
          if (tooltip) tooltip.style.display = 'block';
        }
      }}
      onMouseLeave={(e) => {
        const tooltip = e.currentTarget.parentElement.querySelector('.return-tooltip');
        if (tooltip) tooltip.style.display = 'none';
      }}
      style={{
        backgroundColor: isVerified ? "#6c757d" : "#990202",
        color: "white",
        border: "none",
        padding: "8px 20px",
        borderRadius: "5px",
        fontSize: "14px",
        cursor: isVerified ? "not-allowed" : "pointer",
        fontWeight: "600",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        whiteSpace: "nowrap",
        opacity: isVerified ? 0.6 : 1
      }}
      onMouseOver={(e) => {
        if (!isVerified) {
          e.currentTarget.style.backgroundColor = "#990202c7";
        }
      }}
      onMouseOut={(e) => {
        if (!isVerified) {
          e.currentTarget.style.backgroundColor = "#990202";
        }
      }}
    >
      <span>↩</span>
      {isVerified ? "Verified (Cannot Return)" : "Return Assessment"}
    </button>
    
    {/* Tooltip */}
    {!isVerified && (
      <div 
        className="return-tooltip"
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
          width: "250px",
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
          <span style={{ color: "#aaa", fontSize: "11px" }}>Return assessment to the MLGO for revisions. Editing access will be restored, and all remarks will be visible to them.</span>
        </div>
      </div>
    )}
  </div>

  {/* Verify Assessment Button */}
  <div style={{ position: "relative", display: "inline-block" }}>
    <button
      onClick={handleVerifyAssessment}
      disabled={isVerified || loading}
      onMouseEnter={(e) => {
        if (!isVerified) {
          const tooltip = e.currentTarget.parentElement.querySelector('.verify-tooltip');
          if (tooltip) tooltip.style.display = 'block';
        }
      }}
      onMouseLeave={(e) => {
        const tooltip = e.currentTarget.parentElement.querySelector('.verify-tooltip');
        if (tooltip) tooltip.style.display = 'none';
      }}
      style={{
        backgroundColor: isVerified ? "#28a745" : "#006736",
        color: "white",
        border: "none",
        padding: "8px 20px",
        borderRadius: "5px",
        fontSize: "14px",
        cursor: isVerified ? "not-allowed" : "pointer",
        fontWeight: "600",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        whiteSpace: "nowrap",
        opacity: isVerified ? 0.8 : 1
      }}
      onMouseOver={(e) => {
        if (!isVerified) {
          e.currentTarget.style.backgroundColor = "#006735d0";
        }
      }}
      onMouseOut={(e) => {
        if (!isVerified) {
          e.currentTarget.style.backgroundColor = "#006736";
        }
      }}
    >
      <span>✔</span>
      {isVerified ? "Verified" : "Verify Assessment"}
    </button>
    
    {/* Tooltip */}
    {!isVerified && (
      <div 
        className="verify-tooltip"
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
          width: "250px",
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
          <span style={{ color: "#aaa", fontSize: "11px" }}>Verify this assessment. This will mark it as verified and remove it from the forwarded list.</span>
        </div>
      </div>
    )}
  </div>
</div>
  </div>
</div>


          {/* Tabs - Make them clickable */}
          <div className={style.assessmentTabs}>
            <button 
              className={activeTab === 1 ? style.activeTab : ''}
              onClick={() => handleTabChange(1)}
            >
              Financial Administration and Sustainability
            </button>
            <button 
              className={activeTab === 2 ? style.activeTab : ''}
              onClick={() => handleTabChange(2)}
            >
              Disaster Preparedness
            </button>
            <button 
              className={activeTab === 3 ? style.activeTab : ''}
              onClick={() => handleTabChange(3)}
            >
              Social Protection and Sensitivity
            </button>
            <button 
              className={activeTab === 4 ? style.activeTab : ''}
              onClick={() => handleTabChange(4)}
            >
              Health Compliance and Responsiveness
            </button>
            <button 
              className={activeTab === 5 ? style.activeTab : ''}
              onClick={() => handleTabChange(5)}
            >
              Sustainable Education
            </button>
            <button 
              className={activeTab === 6 ? style.activeTab : ''}
              onClick={() => handleTabChange(6)}
            >
              Business Friendliness and Competitiveness
            </button>
            <button 
              className={activeTab === 7 ? style.activeTab : ''}
              onClick={() => handleTabChange(7)}
            >
              Safety, Peace and Order
            </button>
            <button 
              className={activeTab === 8 ? style.activeTab : ''}
              onClick={() => handleTabChange(8)}
            >
              Environmental Management
            </button>
            <button 
              className={activeTab === 9 ? style.activeTab : ''}
              onClick={() => handleTabChange(9)}
            >
              Tourism, Heritage Development, Culture and Arts
            </button>
            <button 
              className={activeTab === 10 ? style.activeTab : ''}
              onClick={() => handleTabChange(10)}
            >
              Youth Development
            </button>
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
    ) : (
      <>
        {lguAnswers.length > 0 ? (
          lguAnswers.map((lgu) => {
            const currentTabIndicators = getCurrentTabIndicators();
            
            return (
              <div key={lgu.id}>
                
                {/* Indicators with Answers */}
                {currentTabIndicators && currentTabIndicators.length > 0 ? (
                  currentTabIndicators.map((record) => (
                    <div key={record.firebaseKey} className="reference-wrapper">
                      
                      {/* Main Indicators */}
                      {record.mainIndicators?.map((main, index) => {
                        const answerKey = `${record.firebaseKey}_${index}_${main.title}`;
                        const answer = lgu.data?.[answerKey];
                        
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
                                          checked={answer?.value === choice}
                                          disabled 
                                        /> 
                                        <span>
                                          {choice}
                                        </span>
                                      </div>
                                    ))}
                                  
                                  {main.fieldType === "checkbox" &&
                                    main.choices.map((choice, i) => {
                                      const checkboxKey = `${record.firebaseKey}_${index}_${main.title}_${i}`;
                                      const checkboxAnswer = lgu.data?.[checkboxKey];
                                      
                                      return (
                                        <div key={i}>
                                          <input 
                                            type="checkbox" 
                                            checked={checkboxAnswer?.value === true}
                                            disabled 
                                          /> 
                                          <span>
                                            {choice}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  
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

{/* Sub Indicators */}
{record.subIndicators?.map((sub, index) => {
  const answerKey = `${record.firebaseKey}_sub_${index}_${sub.title}`;
  const answer = lgu.data?.[answerKey];
  
  return (
    <div key={index} className="reference-wrapper">
      {/* Sub Indicator Row */}
      <div className="reference-row sub-row">
        <div className="reference-label">
          {sub.title}
        </div>

        <div className="reference-field">
          
          {sub.fieldType === "multiple" &&
            sub.choices.map((choice, i) => (
              <div key={i}>
                <input 
                  type="radio" 
                  checked={answer?.value === choice}
                  disabled 
                /> 
                <span>
                  {choice}
                </span>
              </div>
            ))}
          
          {sub.fieldType === "checkbox" &&
            sub.choices.map((choice, i) => {
              const checkboxKey = `${record.firebaseKey}_sub_${index}_${sub.title}_${i}`;
              const checkboxAnswer = lgu.data?.[checkboxKey];
              
              return (
                <div key={i}>
                  <input 
                    type="checkbox" 
                    checked={checkboxAnswer?.value === true}
                    disabled 
                  /> 
                  <span>
                    {choice}
                  </span>
                </div>
              );
            })}
          
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

      {/* ===== NESTED SUB-INDICATORS DISPLAY SECTION - ADD THIS ===== */}
      {sub.nestedSubIndicators && sub.nestedSubIndicators.length > 0 && (
        <div className="nested-reference-wrapper" style={{ marginLeft: "30px", marginTop: "10px" }}>
          {sub.nestedSubIndicators.map((nested, nestedIndex) => {
            const nestedAnswerKey = `${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}`;
            const nestedAnswer = lgu.data?.[nestedAnswerKey];
            
            return (
              <div key={nested.id || nestedIndex} className="nested-reference-item" style={{ marginBottom: "15px" }}>
                <div className="nested-reference-row" style={{ display: "flex", border: "1px solid #cfcfcf" }}>
                  <div className="nested-reference-label" style={{ 
                    width: "45%", 
                    background: "#fff6f6", 
                    padding: "8px 12px",
                    fontWeight: 500,
                    borderRight: "1px solid #cfcfcf"
                  }}>
                    {nested.title || 'Untitled'}
                  </div>
                  <div className="nested-reference-field" style={{ 
                    width: "55%", 
                    padding: "8px 12px",
                    background: "#ffffff"
                  }}>
                    {/* Nested Multiple Choice */}
                    {nested.fieldType === "multiple" && nested.choices?.map((choice, i) => {
                      const nestedChoiceKey = `${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}`;
                      const isSelected = lgu.data?.[nestedChoiceKey]?.value === choice;
                      
                      return (
                        <div key={i} style={{ marginBottom: "4px" }}>
                          <input 
                            type="radio" 
                            checked={isSelected}
                            disabled 
                          /> 
                          <span style={{ marginLeft: "4px" }}>{choice}</span>
                        </div>
                      );
                    })}

                    {/* Nested Checkbox */}
                    {nested.fieldType === "checkbox" && nested.choices?.map((choice, i) => {
                      const nestedCheckboxKey = `${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}_${i}`;
                      const isChecked = lgu.data?.[nestedCheckboxKey]?.value === true;
                      
                      return (
                        <div key={i} style={{ marginBottom: "4px" }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            disabled 
                          /> 
                          <span style={{ marginLeft: "4px" }}>{choice}</span>
                        </div>
                      );
                    })}

                    {/* Nested Short Answer */}
                    {nested.fieldType === "short" && (
                      <div>
                        {nestedAnswer?.value ? (
                          <span>{nestedAnswer.value}</span>
                        ) : (
                          <span style={{ fontStyle: "italic", color: "gray" }}>
                            No answer provided
                          </span>
                        )}
                      </div>
                    )}

                    {/* Nested Integer */}
                    {nested.fieldType === "integer" && (
                      <div>
                        {nestedAnswer?.value ? (
                          <span>{nestedAnswer.value}</span>
                        ) : (
                          <span style={{ fontStyle: "italic", color: "gray" }}>
                            No answer provided
                          </span>
                        )}
                      </div>
                    )}

                    {/* Nested Date */}
                    {nested.fieldType === "date" && (
                      <div>
                        {nestedAnswer?.value ? (
                          <span>
                            {new Date(nestedAnswer.value).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
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
                  <div className="nested-verification" style={{
                    padding: "6px 12px",
                    background: "#ffffff",
                    border: "1px solid #cfcfcf",
                    borderTop: "none",
                    fontSize: "11px"
                  }}>
                    <span style={{ fontWeight: 700, marginRight: "6px", color: "#081a4b" }}>
                      Mode of Verification:
                    </span>
                    <span style={{ fontStyle: "italic" }}>
                      {nested.verification}
                    </span>
                    
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
              No assessment data available.
            </p>
          </div>
        )}

        {/* Remarks and Flag Section */}
        <div style={{
          marginTop: "30px",
          padding: "20px",
          backgroundColor: "#f9f9f9",
          borderRadius: "8px",
          border: "1px solid #e0e0e0"
        }}>
          {/* Add Remarks for LGU */}
          <div style={{ marginBottom: "20px" }}>
            <h4 style={{ 
              margin: "0 0 10px 0", 
              color: "#333", 
              fontSize: "16px",
              fontWeight: "600"
            }}>
              Add Remarks for MLGO:
            </h4>
            <textarea
              placeholder="Type here..."
              rows="4"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
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

          {/* Flag as Verified Button */}
          <div style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "15px"
          }}>
            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                onClick={() => {
                  const bookmarkData = {
                    lguName: lguAnswers[0]?.lguName || "",
                    year: selectedYear,
                    timestamp: Date.now(),
                    remarks: remarks || "Flagged as verified"
                  };
                  localStorage.setItem('verifiedFlag', JSON.stringify(bookmarkData));
                  setVerifiedFlag(bookmarkData);
                  alert("Page bookmarked locally as verified");
                }}
                style={{
                  backgroundColor: "#28a745",
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
              >
                <span>⚐</span>
                Flag as Verified
              </button>
            </div>
          </div>
        </div>
      </>
    )}
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
  disabled={savingProfile || !editProfileData?.name?.trim()}
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