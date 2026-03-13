import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import style from "src/MLGO-CSS/mlgo-view.module.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiFilter, FiRotateCcw, FiSettings, FiLogOut, FiFileText, FiClipboard } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, push, onValue, set, get } from "firebase/database";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function MLGOView() {
  const location = useLocation(); 
  const [lguRemarks, setLguRemarks] = useState({}); // object per tab for MLGO's remarks to LGU
  const [isForwarded, setIsForwarded] = useState(false);
  const [isVerifiedView, setIsVerifiedView] = useState(location.state?.isVerified || false);
  const [municipalityMap, setMunicipalityMap] = useState({});
  const [isReturned, setIsReturned] = useState(false);
  const [isReturnedFromPO, setIsReturnedFromPO] = useState(false); // NEW: flag for returned from PO
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
  const [savingAnswers, setSavingAnswers] = useState(false);
  
  // ===== DYNAMIC TABS STATE =====
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [tabData, setTabData] = useState({}); // Store indicators for each tab
  
  const [userRole, setUserRole] = useState(null);
  const [userMunicipality, setUserMunicipality] = useState("");
  const [loading, setLoading] = useState(true);
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [adminUid, setAdminUid] = useState(null);
  const [lguAnswers, setLguAnswers] = useState([]);
  
  const [selectedYear, setSelectedYear] = useState(location.state?.year || "2026");
  const [selectedAssessment, setSelectedAssessment] = useState(location.state?.assessment || "");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(location.state?.assessmentId || "");

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

  const [remarks, setRemarks] = useState({}); // object per tab for PO's remarks
  const [verifiedFlag, setVerifiedFlag] = useState({}); // object per tab

  // Helper function to get tab name (fallback)
  const getTabName = (tab) => {
    return tab?.name || `Tab ${tab?.id}`;
  };

  // ===== LOAD ASSESSMENT TABS FROM ADMIN =====
  useEffect(() => {
    if (!auth.currentUser || !selectedYear || !selectedAssessmentId) return;

    const fetchTabsFromAdmin = async () => {
      try {
        // Find admin UID first
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);
        
        if (usersSnapshot.exists()) {
          const users = usersSnapshot.val();
          const adminUid = Object.keys(users).find(
            uid => users[uid]?.role === "admin"
          );
          
          if (adminUid) {
            console.log("Loading tabs from admin:", adminUid, "for year:", selectedYear, "assessment:", selectedAssessmentId);

            const tabsRef = ref(
              db,
              `assessment-tabs/${adminUid}/${selectedYear}/${selectedAssessmentId}`
            );

            onValue(tabsRef, (snapshot) => {
              const loadedTabs = [];
              const tabsData = {};
              
              if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                  const tab = childSnapshot.val();
                  const tabId = childSnapshot.key;
                  
                  loadedTabs.push({
                    id: tabId,
                    name: tab.name || "Untitled Tab",
                    description: tab.description || "",
                    createdAt: tab.createdAt,
                    order: tab.order || 0,
                    tabPath: tabId
                  });
                  
                  // Initialize empty indicators for this tab
                  tabsData[tabId] = [];
                });
                
                // Sort tabs by order
                loadedTabs.sort((a, b) => (a.order || 0) - (b.order || 0));
              }

              console.log("Loaded tabs:", loadedTabs);
              setTabs(loadedTabs);
              setTabData(tabsData);

              // Set first tab as active if available
              if (loadedTabs.length > 0) {
                setActiveTab(loadedTabs[0].id);
              }
            });
          } else {
            console.log("No admin found");
          }
        }
      } catch (error) {
        console.error("Error loading tabs:", error);
      }
    };

    fetchTabsFromAdmin();
  }, [selectedYear, selectedAssessmentId, auth.currentUser]);

  // ===== LOAD INDICATORS FOR EACH TAB FROM ADMIN =====
  useEffect(() => {
    if (!auth.currentUser || !selectedYear || !selectedAssessmentId || !tabs.length) return;

    const loadTabIndicators = async () => {
      try {
        // Find admin UID first
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);
        
        if (usersSnapshot.exists()) {
          const users = usersSnapshot.val();
          const adminUid = Object.keys(users).find(
            uid => users[uid]?.role === "admin"
          );
          
          if (adminUid) {
            const newTabData = { ...tabData };
            
            for (const tab of tabs) {
              try {
                const indicatorsRef = ref(
                  db,
                  `assessment-data/${adminUid}/${selectedYear}/${selectedAssessmentId}/${tab.tabPath}/assessment`
                );
                
                const snapshot = await get(indicatorsRef);
                
                if (snapshot.exists()) {
                  const data = snapshot.val();
                  const indicatorsArray = Object.keys(data).map(key => ({
                    firebaseKey: key,
                    ...data[key]
                  }));
                  
                  newTabData[tab.id] = indicatorsArray;
                  console.log(`📊 Loaded ${indicatorsArray.length} indicators for tab: ${tab.name}`);
                } else {
                  newTabData[tab.id] = [];
                }
              } catch (error) {
                console.error(`Error loading indicators for tab ${tab.name}:`, error);
                newTabData[tab.id] = [];
              }
            }
            
            setTabData(newTabData);
          }
        }
      } catch (error) {
        console.error("Error finding admin for indicators:", error);
      }
    };

    loadTabIndicators();
  }, [tabs, selectedYear, selectedAssessmentId, auth.currentUser]);

// ===== LOAD LGU ANSWERS =====
useEffect(() => {
  if (!auth.currentUser || !selectedYear || !location.state?.lguName || !selectedAssessmentId) return;

  const loadLGUAnswers = async () => {
    try {
      setLoading(true);
      
      // Get the LGU name from state
      const lguName = location.state.lguName || location.state.municipality;
      const cleanName = `${lguName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
      
      console.log("Loading LGU answers from:", `answers/${selectedYear}/LGU/${cleanName}`);
      
      const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanName}`);
      const snapshot = await get(answersRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const { _metadata, ...answers } = data;
        
        console.log("Loaded LGU answers metadata:", _metadata);
        
        // Check if this assessment has PO remarks in metadata
        if (_metadata?.poRemarks) {
          setRemarks(_metadata.poRemarks);
        }
        
        // Determine status and flags based on metadata
        const isReturnedFromPO = _metadata?.returnedToMLGO || false;
        const isForwarded = _metadata?.forwarded || _metadata?.forwardedToPO || false;
        const isReturnedToLGU = _metadata?.returnedToLGU || location.state?.isReturnedToLGU || false;
        
        // Create LGU answers object
        const lguData = {
          id: 1,
          lguName: lguName,
          year: selectedYear,
          assessment: selectedAssessment,
          assessmentId: selectedAssessmentId,
          status: isReturnedFromPO ? "Returned from PO" : 
                  isForwarded ? "Forwarded" : 
                  _metadata?.submitted ? "Submitted" : "Draft",
          submission: _metadata?.lastSaved 
            ? new Date(_metadata.lastSaved).toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
              })
            : "N/A",
          deadline: submissionDeadline || "Not set",
          data: answers,
          municipality: _metadata?.municipality || location.state.municipality,
          userUid: _metadata?.uid,
          isVerified: location.state?.isVerified || false,
          isReturnedFromPO: isReturnedFromPO,
          isForwarded: isForwarded,
          attachmentsByIndicator: {}
        };
        
        setLguAnswers([lguData]);
        
        // Set flags based on persisted metadata
        setIsReturnedFromPO(isReturnedFromPO);
        setIsForwarded(isForwarded);
        setIsReturnedToLGU(isReturnedToLGU);
        
        console.log("Assessment status:", {
          isReturnedFromPO,
          isForwarded,
          isReturnedToLGU,
          metadata: _metadata
        });
        
        // Load attachments
// Load attachments
const attachmentsRef = ref(
  db,
  `attachments/${selectedYear}/LGU/${cleanName}`
);
const attachmentsSnapshot = await get(attachmentsRef);

if (attachmentsSnapshot.exists()) {
  const attachments = attachmentsSnapshot.val();
  const attachmentsByIndicator = {};
  
  console.log("📎 All attachments from Firebase:", attachments);
  
  Object.keys(attachments).forEach(key => {
    const attachment = attachments[key];
    
    console.log("📎 Processing attachment key:", key);
    
    // Parse the key to extract indicator information
    // Key format: assessmentId_tabId_recordKey_mainIndex_field_timestamp
    // Example: ASSESS123_tab1_record1_0_Main Indicator Title_1741684800000
    
    const keyParts = key.split('_');
    
    // Check if this is a sub-indicator attachment (contains 'sub')
    if (key.includes('_sub_')) {
      // Format: assessmentId_tabId_recordKey_sub_subIndex_field_timestamp
      // Example: ASSESS123_tab1_record1_sub_0_Sub Indicator Title_1741684800000
      
      // Extract the relevant parts
      const assessmentId = keyParts[0];
      const tabId = keyParts[1];
      const recordKey = keyParts[2];
      
      // Find where 'sub' appears
      const subIndex = keyParts.indexOf('sub') + 1;
      const subNumber = keyParts[subIndex];
      
      // The field title is everything between subNumber and the last part (timestamp)
      // The last part is the timestamp
      const titleParts = keyParts.slice(subIndex + 1, -1);
      const title = titleParts.join('_');
      
      // Create indicator ID that matches what we use in rendering
      const indicatorId = `${recordKey}_sub_${subNumber}_${title}`;
      
      console.log(`📎 Sub-indicator attachment for: ${indicatorId}`);
      
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
      // Main indicator attachment
      // Format: assessmentId_tabId_recordKey_mainIndex_field_timestamp
      // Example: ASSESS123_tab1_record1_0_Main Indicator Title_1741684800000
      
      const assessmentId = keyParts[0];
      const tabId = keyParts[1];
      const recordKey = keyParts[2];
      const mainIndex = keyParts[3];
      
      // The field title is everything between mainIndex and the last part (timestamp)
      // The last part is the timestamp
      const titleParts = keyParts.slice(4, -1);
      const title = titleParts.join('_');
      
      // Create indicator ID that matches what we use in rendering
      const indicatorId = `${recordKey}_${mainIndex}_${title}`;
      
      console.log(`📎 Main indicator attachment for: ${indicatorId}`);
      
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
  
  console.log("📎 Final attachmentsByIndicator:", attachmentsByIndicator);
  lguData.attachmentsByIndicator = attachmentsByIndicator;
}
        
      } else {
        console.log("No answers found for this assessment");
        setLguAnswers([]);
      }
    } catch (error) {
      console.error("Error loading LGU answers:", error);
    } finally {
      setLoading(false);
    }
  };

  loadLGUAnswers();
}, [selectedYear, location.state, selectedAssessmentId, submissionDeadline]);

  // Helper function to get the correct answer key
  const getAnswerKey = (record, mainIndex, field, isSub = false, nestedIndex = null, valueType = "default") => {
    if (nestedIndex !== null) {
      if (valueType === "radio") {
        return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_nested_${nestedIndex}_radio_${field}`;
      }
      if (valueType === "checkbox") {
        return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_nested_${nestedIndex}_checkbox_${field}`;
      }
      return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_nested_${nestedIndex}_${field}`;
    } else if (isSub) {
      if (valueType === "radio") {
        return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_radio_${field}`;
      }
      if (valueType === "checkbox") {
        return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_checkbox_${field}`;
      }
      return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_${field}`;
    } else {
      if (valueType === "radio") {
        return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${mainIndex}_radio_${field}`;
      }
      if (valueType === "checkbox") {
        return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${mainIndex}_checkbox_${field}`;
      }
      return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${mainIndex}_${field}`;
    }
  };

  // Radio answers are saved as index strings
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
      setSelectedAssessment(location.state.assessment || "");
      setSelectedAssessmentId(location.state.assessmentId || "");
      console.log("Viewing year:", location.state.year, "assessment:", location.state.assessment, "ID:", location.state.assessmentId);
    }
  }, [location]);

  // Load verified flag from localStorage
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

  // Download attachment function
  const downloadAttachment = (attachment) => {
    console.log('📎 Downloading attachment:', attachment);
    
    try {
      let fileUrl = null;
      let fileName = 'download';
      
      for (const key of Object.keys(attachment)) {
        const value = attachment[key];
        
        if (typeof value === 'string' && (value.startsWith('data:') || value.startsWith('http'))) {
          fileUrl = value;
          console.log(`Found potential file URL in property: ${key}`);
        }
        
        if (key === 'name' || key === 'fileName' || key === 'filename') {
          fileName = value;
        }
      }
      
      if (fileUrl) {
        if (fileUrl.startsWith('data:')) {
          const link = document.createElement('a');
          link.href = fileUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log('✅ Download initiated for base64 data');
        } else {
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

  // Fetch municipality mapping
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
      
      const currentUserUid = auth.currentUser?.uid;
      
      if (!currentUserUid) {
        alert("You must be logged in to forward assessments");
        return;
      }
      
      console.log("Current user UID (sub-admin):", currentUserUid);
      
      // Get the clean name for the assessment
      const cleanName = `${lgu.lguName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
      const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanName}`);
      const snapshot = await get(answersRef);
      
      if (!snapshot.exists()) {
        alert("Assessment data not found");
        return;
      }
      
      const currentData = snapshot.val();
      const metadata = currentData._metadata || {};
      
      // Get all answers data (without metadata)
      const { _metadata, ...answersData } = currentData;
      
      // Prepare forward data
      const forwardData = {
        lguUid: metadata.uid || currentUserUid,
        year: selectedYear,
        assessment: selectedAssessment,
        assessmentId: selectedAssessmentId,
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
        originalData: currentData,
        forwardedAt: Date.now(),
        forwardedBy: auth.currentUser?.email,
        forwardedByName: profileData.name || auth.currentUser?.email,
        submittedBy: metadata.email || auth.currentUser?.email,
        lguName: lgu.lguName,
        municipality: lgu.municipality || metadata.municipality,
        mlgoUid: currentUserUid,
        cleanName: cleanName
      };
      
      console.log("Forwarding data to PO:", forwardData);
      
      // Save to forwarded node under PO's UID
      const forwardedRef = ref(db, `forwarded/${poUid}`);
      const newForwardedRef = push(forwardedRef);
      await set(newForwardedRef, forwardData);
      
      console.log("✅ Forwarded to PO successfully at path:", `forwarded/${poUid}/${newForwardedRef.key}`);
      
      // Also save to a more organized structure as backup (optional)
      const organizedRef = ref(db, `forwarded-assessments/${poUid}/${selectedYear}/${selectedAssessmentId}/${cleanName}`);
      await set(organizedRef, forwardData);
      
      // ===== FIX: UPDATE the answers node with forwarded flags instead of deleting =====
      const updatedMetadata = {
        ...metadata,
        // Keep existing metadata
        uid: metadata.uid || currentUserUid,
        email: metadata.email || auth.currentUser?.email,
        name: metadata.name || lgu.lguName,
        municipality: metadata.municipality || lgu.municipality,
        
        // Add forwarding flags
        forwarded: true,
        forwardedToPO: true,
        forwardedAt: Date.now(),
        forwardedBy: auth.currentUser?.email,
        forwardedByName: profileData.name || auth.currentUser?.email,
        forwardedTo: poUid,
        
        // Ensure submitted is true
        submitted: true,
        
        // Clear any return flags
        returned: false,
        returnedToMLGO: false,
        returnedAt: null,
        returnedBy: null,
        returnedByName: null,
        
        // Preserve last saved info
        lastSaved: Date.now()
      };
      
      const updatedData = {
        ...answersData,
        _metadata: updatedMetadata
      };
      
      // Update the answers node with forwarded metadata (DO NOT DELETE)
      await set(answersRef, updatedData);
      console.log("✅ Updated answers node with forwarded metadata");
      
      // Also check if there's an entry in returned node and remove it
      const returnedRef = ref(db, `returned/${selectedYear}/MLGO/${currentUserUid}/${selectedAssessmentId}`);
      const returnedSnapshot = await get(returnedRef);
      if (returnedSnapshot.exists()) {
        await set(returnedRef, null);
        console.log("✅ Removed from returned node");
      }
      
      // Create a notification for the PO
      const notificationRef = ref(db, `notifications/${selectedYear}/PO/${poUid}`);
      const notificationId = Date.now().toString();
      const notificationData = {
        id: notificationId,
        type: "assessment_forwarded",
        title: `"${selectedAssessment}" Assessment (${selectedYear}) was forwarded by MLGO (${userMunicipality || profileData.municipality || "Unknown Municipality"})`,
        message: `Assessment from ${lgu.lguName} has been forwarded to PO by MLGO from ${userMunicipality || profileData.municipality || "Unknown Municipality"}.`,
        from: auth.currentUser?.email,
        fromName: profileData.name || auth.currentUser?.email,
        fromMunicipality: userMunicipality || profileData.municipality,
        timestamp: Date.now(),
        read: false,
        year: selectedYear,
        assessment: selectedAssessment,
        assessmentId: selectedAssessmentId,
        municipality: lgu.municipality,
        lguName: lgu.lguName,
        lguUid: metadata.uid || currentUserUid,
        mlgoMunicipality: userMunicipality || profileData.municipality,
        cleanName: cleanName,
        action: "view_assessment"
      };
      await set(ref(db, `notifications/${selectedYear}/PO/${poUid}/${notificationId}`), notificationData);
      
      alert("Assessment forwarded to Provincial Office successfully!");
      
      // Navigate to dashboard with refresh flag
      navigate("/mlgo-dashboard", { 
        state: { 
          forwardedAssessment: true,
          year: selectedYear,
          assessmentId: selectedAssessmentId,
          lguUid: currentUserUid,
          refreshNeeded: true
        } 
      });
      
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
      
      if (lgu.isReturnedFromPO) {
        setIsReturnedFromPO(true);
      }
      
      if (lgu.data?._metadata?.forwarded) {
        setIsForwarded(true);
      } else {
        setIsForwarded(false);
      }
      
      console.log("Assessment status:", {
        isReturnedFromPO: lgu.isReturnedFromPO,
        forwarded: lgu.data?._metadata?.forwarded
      });
    } else {
      setIsReturnedFromPO(false);
      setIsForwarded(false);
    }
  }, [lguAnswers]);
  

  const [data, setData] = useState([]);
  const [isReturnedToLGU, setIsReturnedToLGU] = useState(false);
// In mlgo-view.jsx - Updated handleReturnToLGU function

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
    const cleanName = `${lgu.lguName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
    
    const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanName}`);
    const snapshot = await get(answersRef);
    
    if (snapshot.exists()) {
      const currentData = snapshot.val();
      
      console.log("📤 Current data before return:", currentData._metadata);
      
      const currentTabRemark = lguRemarks[activeTab] || "";
      const allRemarks = { ...lguRemarks };
      
      // CRITICAL FIX: Make sure we preserve ALL existing data but override the flags correctly
      const newMetadata = {
        ...currentData._metadata,  // Preserve ALL existing metadata
        
        // Essential user info
        uid: currentData._metadata?.uid,
        email: currentData._metadata?.email,
        name: currentData._metadata?.name,
        municipality: currentData._metadata?.municipality,
        
        // IMPORTANT: Set submitted to false to allow editing
        submitted: false,           // This is the key flag that LGU checks
        
        // Return flags
        returned: true,
        returnedToLGU: true,
        returnedAt: Date.now(),
        returnedBy: auth.currentUser?.email,
        returnedByName: profileData.name || auth.currentUser?.email,
        mlgoRemarks: allRemarks,
        remarks: currentTabRemark || "Assessment returned for revision",
        
        // Clear any forwarding flags
        forwarded: false,
        forwardedToPO: false,
        forwardedAt: null,
        forwardedBy: null,
        forwardedTo: null,
        
        // Preserve other metadata
        lastSaved: Date.now(),
        year: currentData._metadata?.year || selectedYear,
        assessment: currentData._metadata?.assessment || selectedAssessment,
        assessmentId: currentData._metadata?.assessmentId || selectedAssessmentId,
        
        // Keep PO related info if any
        returnedToMLGO: currentData._metadata?.returnedToMLGO || false,
        poRemarks: currentData._metadata?.poRemarks || null
      };
      
      console.log("📤 New metadata with MLGO remarks:", newMetadata);
      console.log("📤 submitted flag set to:", newMetadata.submitted);
      
      const updatedData = {
        ...currentData,
        _metadata: newMetadata
      };
      
      await set(answersRef, updatedData);
      console.log("✅ Assessment returned to LGU successfully");
      
      const lguUid = currentData._metadata?.uid;
      const municipality = profileData.municipality || location.state?.municipality;

      if (lguUid) {
        console.log("Sending notification to LGU with UID:", lguUid, "Municipality:", municipality);
        
        const notificationRef = ref(db, `notifications/${selectedYear}/LGU/${lguUid}`);
        const notificationId = Date.now().toString();
        
        const notificationData = {
          id: notificationId,
          type: "assessment_returned",
          title: `Assessment "${selectedAssessment}" (${selectedYear}) was returned for revision.`,
          message: currentTabRemark || "Please check the remarks and resubmit.",
          from: auth.currentUser?.email || "",
          fromName: profileData.name || auth.currentUser?.email || "",
          fromMunicipality: municipality || "",
          timestamp: Date.now(),
          read: false,
          year: selectedYear,
          assessment: selectedAssessment,
          assessmentId: selectedAssessmentId,
          municipality: municipality || "",
          tabName: tabs.find(t => t.id === activeTab)?.name || "",
          tabRemarks: currentTabRemark || "",
          allRemarks: allRemarks || {},
          action: "edit_assessment"
        };
        
        await set(ref(db, `notifications/${selectedYear}/LGU/${lguUid}/${notificationId}`), notificationData);
        console.log("✅ Notification saved with municipality:", municipality);
      }
      
      // Set the state FIRST
      setIsReturnedToLGU(true);
      
      // Show success message
      alert("Assessment returned to LGU successfully!");
      
      // THEN navigate after a short delay to allow state to update
      setTimeout(() => {
        navigate("/mlgo-dashboard");
      }, 500);
      
    } else {
      console.log("❌ No assessment data found at:", answersRef.toString());
      alert("Assessment data not found.");
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

  // Fetch user role and municipality
  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchUserRole = async () => {
      try {
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
        
        if (profileData.municipality) {
          setUserMunicipality(profileData.municipality);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };

    fetchUserRole();
  }, [profileData]);

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

// Helper function to convert image to base64
const getBase64Image = (img) => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      // Fallback in case image fails to load
      resolve("");
    };
    image.src = img;
  });
};

const exportTabToPDF = async () => {  
  if (!selectedYear || !selectedAssessmentId || !activeTab) {    
    alert("Please select an assessment and tab first");    
    return;  
  }   
  
  setSavingAnswers(true);   
  
  try {     
    const leftLogo = await getBase64Image(dilgLogo);    
    const rightLogo = await getBase64Image(dilgSeal);     
    
    const doc = new jsPDF({      
      orientation: "portrait",      
      unit: "pt",      
      format: "A4"    
    });     
    
    const pageWidth = doc.internal.pageSize.getWidth();    
    const pageHeight = doc.internal.pageSize.getHeight();     
    
    const margin = {      
      top: 72,      
      bottom: 72,      
      left: 72,      
      right: 72    
    };     
    
    doc.setFont("helvetica");     
    
    // Get current tab indicators from tabData
    const currentTabIndicators = tabData[activeTab] || [];
    console.log("Current Tab Indicators:", currentTabIndicators);
    
    // Get user answers from lguAnswers
    const userAnswers = lguAnswers[0]?.data || {};
    console.log("User Answers:", userAnswers);
    
    const currentTab = tabs.find((t) => t.id === activeTab);    
    const tabName = currentTab?.name || "Assessment";     
    
    const municipality = profileData.municipality || lguAnswers[0]?.municipality || "Not specified";    
    const lguName = lguAnswers[0]?.lguName || profileData.name || auth.currentUser?.email || "LGU";     
    
    const today = new Date();    
    const formattedDate = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;     
    
    // ===== LOGOS =====     
    const logoSize = 55;    
    const logoSize1 = 55;    
    const logoSize2 = 100;    
    doc.addImage(      
      leftLogo,      
      "PNG",      
      margin.right + 30,      
      margin.top - 30,      
      logoSize2,      
      logoSize1    
    );     
    
    doc.addImage(      
      rightLogo,      
      "PNG",      
      margin.right -5,      
      margin.top - 30,      
      logoSize,      
      logoSize    
    );     
    
    // ===== HEADER TEXT =====     
    doc.setFontSize(11);    
    doc.setFont("helvetica", "bold");    
    doc.text(      
      "DEPARTMENT OF THE INTERIOR AND LOCAL GOVERNMENT",      
      pageWidth / 2 + 52,      
      margin.top - 10,      
      { align: "center" }    
    );     
    
    doc.setFont("helvetica", "normal");    
    doc.text(      
      "MIMAROPA REGION - ",      
      pageWidth / 2 - 110,      
      margin.top + 5    
    );         
    
    doc.setFont("helvetica", "bold");    
    doc.text(      
      "MARINDUQUE",      
      pageWidth / 2 + 5,      
      margin.top + 5    
    );     
    
    // ===== ASSESSMENT DETAILS =====     
    doc.setFontSize(11);    
    const infoStartY = margin.top + 60;  
    doc.setFont("helvetica", "bold"); 
    doc.text("ASSESSMENT: ", margin.left, infoStartY - 5);  
    
    doc.setFont("helvetica", "normal"); 
    doc.text(`${selectedAssessment || "Local Governance Assessment"} (${selectedYear})`,
      margin.left + 85,
      infoStartY -5
    );  
    
    doc.setFont("helvetica", "bold"); 
    doc.text("REGION: ", margin.left, infoStartY + 10);  
    
    doc.setFont("helvetica", "normal"); 
    doc.text("MIMAROPA Region", margin.left + 55, infoStartY + 10);  
    
    doc.setFont("helvetica", "bold"); 
    doc.text("PROVINCE: ", margin.left, infoStartY + 25);  
    
    doc.setFont("helvetica", "normal"); 
    doc.text("Marinduque", margin.left + 70, infoStartY + 25);  
    
    doc.setFont("helvetica", "bold"); 
    doc.text("MUNICIPALITY: ", margin.left, infoStartY + 40);  
    
    doc.setFont("helvetica", "normal"); 
    doc.text(`${municipality}`, margin.left + 95, infoStartY + 40);  
    
    doc.setFont("helvetica", "bold"); 
    doc.text("DATE: ", margin.left, infoStartY + 55);  
    
    doc.setFont("helvetica", "normal"); 
    doc.text(`${formattedDate}`, margin.left + 40, infoStartY + 55);

    doc.setFont("helvetica", "bold");
    doc.text(`AREA:`, margin.left, infoStartY + 70);

    doc.setFont("helvetica", "normal");
    doc.text(`${tabName}`, margin.left + 40, infoStartY + 70);     
    
    // ===== TABLE HEADER =====     
    const headers = [      
      ["Required Data", "Mode of Verification", "LGU Condition"]    
    ];     
    
    const tableData = [];     
    
    // Helper function to get checkbox answers
    const getCheckboxAnswers = (indicator, path) => {
      if (!indicator || !indicator.choices || !Array.isArray(indicator.choices)) {
        return "";
      }
      
      console.log(`Getting checkbox answers for ${indicator.title} with path:`, path);
      
      const checkedOptions = [];
      
      // Try different checkbox key patterns for each choice
      indicator.choices.forEach((choice, idx) => {
        // Pattern 1: Standard checkbox key
        const checkboxKey1 = `${selectedAssessmentId}_${activeTab}_${path}_checkbox_${indicator.title}_${idx}`;
        
        // Pattern 2: Alternative checkbox key
        const checkboxKey2 = `${selectedAssessmentId}_${activeTab}_${path}_${indicator.title}_checkbox_${idx}`;
        
        // Pattern 3: Without field type in key
        const checkboxKey3 = `${selectedAssessmentId}_${activeTab}_${path}_${indicator.title}_${idx}`;
        
        // Check all patterns
        const checkboxAnswer = userAnswers[checkboxKey1] || 
                              userAnswers[checkboxKey2] || 
                              userAnswers[checkboxKey3];
        
        console.log(`  Choice ${idx} - Key: ${checkboxKey1}, Answer:`, checkboxAnswer);
        
        // Check if this checkbox is selected
        if (checkboxAnswer) {
          // Check if it's an object with a value property
          if (typeof checkboxAnswer === 'object' && checkboxAnswer.value === true) {
            const choiceText = typeof choice === "object"
              ? (choice.label || choice.value || choice.name || "")
              : choice;
            checkedOptions.push(choiceText);
          } 
          // Check if it's a direct boolean true
          else if (checkboxAnswer === true) {
            const choiceText = typeof choice === "object"
              ? (choice.label || choice.value || choice.name || "")
              : choice;
            checkedOptions.push(choiceText);
          }
        }
      });
      
      const result = checkedOptions.join(", ");
      console.log(`  Final checked options:`, result);
      
      return result;
    };
    
    // Helper function to get answer for other field types
    const getIndicatorAnswer = (indicator, path) => {
      if (!indicator || !path) return "";
      
      // Handle checkbox separately
      if (indicator.fieldType === "checkbox") {
        return getCheckboxAnswers(indicator, path);
      }
      
      console.log(`Looking for answer for ${indicator.title} (${indicator.fieldType}) with path:`, path);
      
      // Try different key patterns for non-checkbox fields
      const possibleKeys = [
        `${selectedAssessmentId}_${activeTab}_${path}_radio_${indicator.title}`,
        `${selectedAssessmentId}_${activeTab}_${path}_${indicator.fieldType}_${indicator.title}`,
        `${selectedAssessmentId}_${activeTab}_${path}_${indicator.title}`,
        `${selectedAssessmentId}_${activeTab}_${path}_value_${indicator.title}`,
        `${selectedAssessmentId}_${activeTab}_${indicator.title}`
      ];
      
      for (const key of possibleKeys) {
        const answer = userAnswers[key];
        
        // Check for object with value property
        if (answer && answer.value !== undefined && answer.value !== null) {
          console.log(`Found answer for key: ${key}`, answer);
          
          if (indicator.fieldType === "multiple") {
            const choiceIndex = parseInt(answer.value);
            if (!isNaN(choiceIndex) && indicator.choices && indicator.choices[choiceIndex]) {
              const choice = indicator.choices[choiceIndex];
              return typeof choice === "object"
                ? (choice.label || choice.value || choice.name || "")
                : choice;
            }
            return answer.value;
          }
          
          return answer.value;
        }
        
        // Also check for direct values
        if (answer !== undefined && answer !== null && typeof answer !== 'object') {
          console.log(`Found direct value for key: ${key}`, answer);
          
          if (indicator.fieldType === "multiple") {
            const choiceIndex = parseInt(answer);
            if (!isNaN(choiceIndex) && indicator.choices && indicator.choices[choiceIndex]) {
              const choice = indicator.choices[choiceIndex];
              return typeof choice === "object"
                ? (choice.label || choice.value || choice.name || "")
                : choice;
            }
            return answer;
          }
          
          return answer;
        }
      }
      
      return "";
    };
    
    // Process each record
    for (const record of currentTabIndicators) {
      console.log("Processing record:", record);
      
      // Process main indicators
      if (record.mainIndicators && Array.isArray(record.mainIndicators)) {
        for (let i = 0; i < record.mainIndicators.length; i++) {
          const main = record.mainIndicators[i];
          
          // Build path for this main indicator
          const mainPath = `${record.firebaseKey}_${i}`;
          const answerText = getIndicatorAnswer(main, mainPath);
          
          console.log(`Main answer for ${main.title} (${main.fieldType}):`, answerText);
          
          // Add main indicator
          tableData.push([
            { 
              content: main.title || "(Main Indicator)",
              styles: { 
                fontStyle: "bold",
                fillColor: [141, 179, 226] // #8DB3E2
              }
            },
            { 
              content: main.verification || ""
            },
            { 
              content: answerText || ""
            }
          ]);
          
          // Process sub indicators within main indicators
          if (main.subIndicators && Array.isArray(main.subIndicators)) {
            for (let j = 0; j < main.subIndicators.length; j++) {
              const sub = main.subIndicators[j];
              
              // Build path for this sub indicator
              const subPath = `${record.firebaseKey}_${i}_sub_${j}`;
              const subAnswerText = getIndicatorAnswer(sub, subPath);
              
              console.log(`Sub answer for ${sub.title} (${sub.fieldType}):`, subAnswerText);
              
              // Add sub indicator
              tableData.push([
                { 
                  content: `   ${sub.title || "(Sub Indicator)"}`,
                  styles: {
                    fillColor: [198, 217, 241] // #C6D9F1
                  }
                },
                { 
                  content: sub.verification || ""
                },
                { 
                  content: subAnswerText || ""
                }
              ]);
              
              // Process nested sub indicators
              if (sub.nestedSubIndicators && Array.isArray(sub.nestedSubIndicators)) {
                for (let k = 0; k < sub.nestedSubIndicators.length; k++) {
                  const nested = sub.nestedSubIndicators[k];
                  
                  // Build path for this nested indicator
                  const nestedPath = `${record.firebaseKey}_${i}_sub_${j}_nested_${k}`;
                  const nestedAnswerText = getIndicatorAnswer(nested, nestedPath);
                  
                  console.log(`Nested answer for ${nested.title} (${nested.fieldType}):`, nestedAnswerText);
                  
                  // Add nested sub indicator
                  tableData.push([
                    { 
                      content: `      ${nested.title || "(Nested Sub Indicator)"}`,
                      styles: {
                        fillColor: [234, 246, 252] // #EAF6FC
                      }
                    },
                    { 
                      content: nested.verification || ""
                    },
                    { 
                      content: nestedAnswerText || ""
                    }
                  ]);
                }
              }
            }
          }
        }
      }
      
      // Process standalone sub indicators
      if (record.subIndicators && Array.isArray(record.subIndicators)) {
        for (let j = 0; j < record.subIndicators.length; j++) {
          const sub = record.subIndicators[j];
          
          // Build path for standalone sub indicator
          const subPath = `${record.firebaseKey}_sub_${j}`;
          const subAnswerText = getIndicatorAnswer(sub, subPath);
          
          console.log(`Standalone sub answer for ${sub.title} (${sub.fieldType}):`, subAnswerText);
          
          // Add sub indicator
          tableData.push([
            { 
              content: `   ${sub.title || "(Sub Indicator)"}`,
              styles: {
                fillColor: [198, 217, 241] // #C6D9F1
              }
            },
            { 
              content: sub.verification || ""
            },
            { 
              content: subAnswerText || ""
            }
          ]);
          
          // Process nested sub indicators within standalone sub indicators
          if (sub.nestedSubIndicators && Array.isArray(sub.nestedSubIndicators)) {
            for (let k = 0; k < sub.nestedSubIndicators.length; k++) {
              const nested = sub.nestedSubIndicators[k];
              
              // Build path for nested indicator within standalone sub
              const nestedPath = `${record.firebaseKey}_sub_${j}_nested_${k}`;
              const nestedAnswerText = getIndicatorAnswer(nested, nestedPath);
              
              console.log(`Standalone nested answer for ${nested.title} (${nested.fieldType}):`, nestedAnswerText);
              
              tableData.push([
                { 
                  content: `      ${nested.title || "(Nested Sub Indicator)"}`,
                  styles: {
                    fillColor: [234, 246, 252] // #EAF6FC
                  }
                },
                { 
                  content: nested.verification || ""
                },
                { 
                  content: nestedAnswerText || ""
                }
              ]);
            }
          }
        }
      }
    }
    
    // Add empty row at the end
    tableData.push(["", "", ""]);     
    
    console.log("Final tableData:", tableData);
    
    const startY = infoStartY + 80;     
    
    // ===== TABLE =====    
    autoTable(doc, {      
      head: headers,      
      body: tableData,      
      startY: startY,      
      margin: {        
        left: margin.left - 30,        
        right: margin.right       
      },      
      theme: "grid",      
      styles: {        
        font: "helvetica",        
        fontSize: 9,        
        cellPadding: 5,        
        lineColor: [0, 0, 0],        
        lineWidth: 0.5,        
        textColor: [0, 0, 0],        
        valign: "middle",        
        halign: "left",        
        lineHeight: 1.15      
      },      
      headStyles: {        
        fillColor: [242, 219, 219],        
        textColor: [0, 0, 0],        
        fontStyle: "bold",        
        halign: "center",        
        fontSize: 11,        
        lineWidth: 0.5,        
        lineColor: [0, 0, 0]      
      },      
      columnStyles: {        
        0: { cellWidth: 190 },        
        1: { cellWidth: 160 },        
        2: { cellWidth: 160 }      
      },       
      
      didDrawPage: function () {         
        doc.setFontSize(10);        
        doc.setFont("helvetica", "bold");         
        
        doc.text(          
          "“Matino, Mahusay at Maaasahan”",          
          pageWidth / 2,          
          pageHeight - margin.bottom + 25,          
          { align: "center" }        
        );         
        
        doc.setFont("helvetica", "normal");        
        doc.text(          
          "Telephone Number (042)754 - 5881",          
          pageWidth / 2,          
          pageHeight - margin.bottom + 40,          
          { align: "center" }        
        );      
      }    
    });     
    
    const fileName = `${selectedAssessment || "Assessment"}_${tabName}_${municipality}_${selectedYear}.pdf`      
      .replace(/\s+/g, "_")      
      .replace(/[^\w\-_.]/g, "")      
      .toLowerCase();     
    
    doc.save(fileName);   
    
  } catch (error) {     
    console.error("Error generating PDF:", error);    
    alert("Failed to generate PDF: " + error.message);   
  } finally {     
    setSavingAnswers(false);    
    setShowExportModal(false);   
  } 
};

const exportAllTabsToPDF = async () => {
  if (!selectedYear || !selectedAssessmentId) {
    alert("Please select an assessment first");
    return;
  }

  if (!tabs.length) {
    alert("No tabs available to export");
    return;
  }

  setSavingAnswers(true);

  try {
    const leftLogo = await getBase64Image(dilgLogo);
    const rightLogo = await getBase64Image(dilgSeal);
    
    // Get user answers from lguAnswers
    const userAnswers = lguAnswers[0]?.data || {};
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'A4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    const margin = {
      top: 72,
      bottom: 72,
      left: 72,
      right: 72
    };
    
    doc.setFont('helvetica');
    
    const municipality = profileData.municipality || lguAnswers[0]?.municipality || "Not specified";
    const lguName = lguAnswers[0]?.lguName || profileData.name || auth.currentUser?.email || "LGU";
    
    const today = new Date();
    const formattedDate = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
    
    // Helper function to get checkbox answers (improved version)
    const getCheckboxAnswers = (indicator, tabId, path) => {
      if (!indicator || !indicator.choices || !Array.isArray(indicator.choices)) {
        return "";
      }
      
      console.log(`Getting checkbox answers for ${indicator.title} with path:`, path);
      
      const checkedOptions = [];
      
      // Try different checkbox key patterns for each choice
      indicator.choices.forEach((choice, idx) => {
        // Pattern 1: Standard checkbox key with field type
        const checkboxKey1 = `${selectedAssessmentId}_${tabId}_${path}_checkbox_${indicator.title}_${idx}`;
        
        // Pattern 2: Alternative checkbox key order
        const checkboxKey2 = `${selectedAssessmentId}_${tabId}_${path}_${indicator.title}_checkbox_${idx}`;
        
        // Pattern 3: Without field type in key
        const checkboxKey3 = `${selectedAssessmentId}_${tabId}_${path}_${indicator.title}_${idx}`;
        
        // Check all patterns
        const checkboxAnswer = userAnswers[checkboxKey1] || 
                              userAnswers[checkboxKey2] || 
                              userAnswers[checkboxKey3];
        
        console.log(`  Choice ${idx} - Key: ${checkboxKey1}, Answer:`, checkboxAnswer);
        
        // Check if this checkbox is selected
        if (checkboxAnswer) {
          // Check if it's an object with a value property
          if (typeof checkboxAnswer === 'object' && checkboxAnswer.value === true) {
            const choiceText = typeof choice === "object"
              ? (choice.label || choice.value || choice.name || "")
              : choice;
            checkedOptions.push(choiceText);
          } 
          // Check if it's a direct boolean true
          else if (checkboxAnswer === true) {
            const choiceText = typeof choice === "object"
              ? (choice.label || choice.value || choice.name || "")
              : choice;
            checkedOptions.push(choiceText);
          }
        }
      });
      
      const result = checkedOptions.join(", ");
      console.log(`  Final checked options:`, result);
      
      return result;
    };
    
    // Helper function to get answer for other field types
    const getIndicatorAnswer = (indicator, tabId, path) => {
      if (!indicator || !path) return "";
      
      // Handle checkbox separately
      if (indicator.fieldType === "checkbox") {
        return getCheckboxAnswers(indicator, tabId, path);
      }
      
      console.log(`Looking for answer for ${indicator.title} (${indicator.fieldType}) with path:`, path);
      
      // Try different key patterns for non-checkbox fields
      const possibleKeys = [
        `${selectedAssessmentId}_${tabId}_${path}_radio_${indicator.title}`,
        `${selectedAssessmentId}_${tabId}_${path}_${indicator.fieldType}_${indicator.title}`,
        `${selectedAssessmentId}_${tabId}_${path}_${indicator.title}`,
        `${selectedAssessmentId}_${tabId}_${path}_value_${indicator.title}`,
        `${selectedAssessmentId}_${tabId}_${indicator.title}`
      ];
      
      for (const key of possibleKeys) {
        const answer = userAnswers[key];
        
        // Check for object with value property
        if (answer && answer.value !== undefined && answer.value !== null) {
          console.log(`Found answer for key: ${key}`, answer);
          
          if (indicator.fieldType === "multiple") {
            const choiceIndex = parseInt(answer.value);
            if (!isNaN(choiceIndex) && indicator.choices && indicator.choices[choiceIndex]) {
              const choice = indicator.choices[choiceIndex];
              return typeof choice === "object"
                ? (choice.label || choice.value || choice.name || "")
                : choice;
            }
            return answer.value;
          }
          
          return answer.value;
        }
        
        // Also check for direct values
        if (answer !== undefined && answer !== null && typeof answer !== 'object') {
          console.log(`Found direct value for key: ${key}`, answer);
          
          if (indicator.fieldType === "multiple") {
            const choiceIndex = parseInt(answer);
            if (!isNaN(choiceIndex) && indicator.choices && indicator.choices[choiceIndex]) {
              const choice = indicator.choices[choiceIndex];
              return typeof choice === "object"
                ? (choice.label || choice.value || choice.name || "")
                : choice;
            }
            return answer;
          }
          
          return answer;
        }
      }
      
      return "";
    };
    
    // ===== PROCESS EACH TAB =====
    for (let t = 0; t < tabs.length; t++) {
      // Add new page for each tab except the first
      if (t > 0) {
        doc.addPage();
      }
      
      const tab = tabs[t];
      const currentTabIndicators = tabData[tab.id] || [];
      const tabName = tab.name || "Untitled Tab";
      const tabId = tab.id;
      
      console.log(`Exporting tab: ${tabName}`, currentTabIndicators);
      
      // ===== LOGOS =====
      const logoSize = 55;
      const logoSize1 = 55;
      const logoSize2 = 100;
      doc.addImage(
        leftLogo,
        "PNG",
        margin.right + 30,
        margin.top - 30,
        logoSize2,
        logoSize1
      );
      
      doc.addImage(
        rightLogo,
        "PNG",
        margin.right -5,
        margin.top - 30,
        logoSize,
        logoSize
      );
      
      // ===== HEADER TEXT =====
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(
        "DEPARTMENT OF THE INTERIOR AND LOCAL GOVERNMENT",
        pageWidth / 2 + 52,
        margin.top - 10,
        { align: "center" }
      );
      
      doc.setFont("helvetica", "normal");
      doc.text(
        "MIMAROPA REGION - ",
        pageWidth / 2 - 110,
        margin.top + 5
      );
      
      doc.setFont("helvetica", "bold");
      doc.text(
        "MARINDUQUE",
        pageWidth / 2 + 5,
        margin.top + 5
      );
      
      // ===== ASSESSMENT DETAILS =====
      doc.setFontSize(11);
      const infoStartY = margin.top + 60;
      
      doc.setFont("helvetica", "bold");
      doc.text("ASSESSMENT: ", margin.left, infoStartY - 5);
      
      doc.setFont("helvetica", "normal");
      doc.text(`${selectedAssessment || "Local Governance Assessment"} (${selectedYear})`,
        margin.left + 85,
        infoStartY -5
      );
      
      doc.setFont("helvetica", "bold");
      doc.text("REGION: ", margin.left, infoStartY + 10);
      
      doc.setFont("helvetica", "normal");
      doc.text("MIMAROPA Region", margin.left + 55, infoStartY + 10);
      
      doc.setFont("helvetica", "bold");
      doc.text("PROVINCE: ", margin.left, infoStartY + 25);
      
      doc.setFont("helvetica", "normal");
      doc.text("Marinduque", margin.left + 70, infoStartY + 25);
      
      doc.setFont("helvetica", "bold");
      doc.text("MUNICIPALITY: ", margin.left, infoStartY + 40);
      
      doc.setFont("helvetica", "normal");
      doc.text(`${municipality}`, margin.left + 95, infoStartY + 40);
      
      doc.setFont("helvetica", "bold");
      doc.text("DATE: ", margin.left, infoStartY + 55);
      
      doc.setFont("helvetica", "normal");
      doc.text(`${formattedDate}`, margin.left + 40, infoStartY + 55);
      
      // Add area name for this tab with styling
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`AREA: ${tabName}`, margin.left, infoStartY + 75);
      
      // ===== TABLE HEADER =====
      const headers = [
        ["Required Data", "Mode of Verification", "LGU Condition"]
      ];
      
      const tableData = [];
      
      // Process each record for this tab
      for (const record of currentTabIndicators) {
        // Process main indicators
        if (record.mainIndicators && Array.isArray(record.mainIndicators)) {
          for (let i = 0; i < record.mainIndicators.length; i++) {
            const main = record.mainIndicators[i];
            
            // Build path for this main indicator
            const mainPath = `${record.firebaseKey}_${i}`;
            const answerText = getIndicatorAnswer(main, tabId, mainPath);
            
            console.log(`Main answer for ${main.title} (${main.fieldType}):`, answerText);
            
            // Add main indicator with background color
            tableData.push([
              {
                content: main.title || "(Main Indicator)",
                styles: {
                  fontStyle: "bold",
                  fillColor: [141, 179, 226] // #8DB3E2
                }
              },
              {
                content: main.verification || ""
              },
              {
                content: answerText || ""
              }
            ]);
            
            // Process sub indicators within main indicators
            if (main.subIndicators && Array.isArray(main.subIndicators)) {
              for (let j = 0; j < main.subIndicators.length; j++) {
                const sub = main.subIndicators[j];
                
                // Build path for this sub indicator
                const subPath = `${record.firebaseKey}_${i}_sub_${j}`;
                const subAnswerText = getIndicatorAnswer(sub, tabId, subPath);
                
                console.log(`Sub answer for ${sub.title} (${sub.fieldType}):`, subAnswerText);
                
                // Add sub indicator with background color
                tableData.push([
                  {
                    content: `   ${sub.title || "(Sub Indicator)"}`,
                    styles: {
                      fillColor: [198, 217, 241] // #C6D9F1
                    }
                  },
                  {
                    content: sub.verification || ""
                  },
                  {
                    content: subAnswerText || ""
                  }
                ]);
                
                // Process nested sub indicators
                if (sub.nestedSubIndicators && Array.isArray(sub.nestedSubIndicators)) {
                  for (let k = 0; k < sub.nestedSubIndicators.length; k++) {
                    const nested = sub.nestedSubIndicators[k];
                    
                    // Build path for this nested indicator
                    const nestedPath = `${record.firebaseKey}_${i}_sub_${j}_nested_${k}`;
                    const nestedAnswerText = getIndicatorAnswer(nested, tabId, nestedPath);
                    
                    console.log(`Nested answer for ${nested.title} (${nested.fieldType}):`, nestedAnswerText);
                    
                    // Add nested sub indicator with background color
                    tableData.push([
                      {
                        content: `      ${nested.title || "(Nested Sub Indicator)"}`,
                        styles: {
                          fillColor: [234, 246, 252] // #EAF6FC
                        }
                      },
                      {
                        content: nested.verification || ""
                      },
                      {
                        content: nestedAnswerText || ""
                      }
                    ]);
                  }
                }
              }
            }
          }
        }
        
        // Process standalone sub indicators
        if (record.subIndicators && Array.isArray(record.subIndicators)) {
          for (let j = 0; j < record.subIndicators.length; j++) {
            const sub = record.subIndicators[j];
            
            // Build path for standalone sub indicator
            const subPath = `${record.firebaseKey}_sub_${j}`;
            const subAnswerText = getIndicatorAnswer(sub, tabId, subPath);
            
            console.log(`Standalone sub answer for ${sub.title} (${sub.fieldType}):`, subAnswerText);
            
            // Add sub indicator with background color
            tableData.push([
              {
                content: `   ${sub.title || "(Sub Indicator)"}`,
                styles: {
                  fillColor: [198, 217, 241] // #C6D9F1
                }
              },
              {
                content: sub.verification || ""
              },
              {
                content: subAnswerText || ""
              }
            ]);
            
            // Process nested sub indicators within standalone sub indicators
            if (sub.nestedSubIndicators && Array.isArray(sub.nestedSubIndicators)) {
              for (let k = 0; k < sub.nestedSubIndicators.length; k++) {
                const nested = sub.nestedSubIndicators[k];
                
                // Build path for nested indicator within standalone sub
                const nestedPath = `${record.firebaseKey}_sub_${j}_nested_${k}`;
                const nestedAnswerText = getIndicatorAnswer(nested, tabId, nestedPath);
                
                console.log(`Standalone nested answer for ${nested.title} (${nested.fieldType}):`, nestedAnswerText);
                
                tableData.push([
                  {
                    content: `      ${nested.title || "(Nested Sub Indicator)"}`,
                    styles: {
                      fillColor: [234, 246, 252] // #EAF6FC
                    }
                  },
                  {
                    content: nested.verification || ""
                  },
                  {
                    content: nestedAnswerText || ""
                  }
                ]);
              }
            }
          }
        }
      }
      
      // Add empty row at the end of each tab's table
      tableData.push(["", "", ""]);
      
      const startY = infoStartY + 90;
      
      // ===== TABLE =====
      autoTable(doc, {
        head: headers,
        body: tableData,
        startY: startY,
        margin: {
          left: margin.left - 30,
          right: margin.right
        },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 5,
          lineColor: [0, 0, 0],
          lineWidth: 0.5,
          textColor: [0, 0, 0],
          valign: "middle",
          halign: "left",
          lineHeight: 1.15
        },
        headStyles: {
          fillColor: [242, 219, 219], // #F2DBDB
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
          fontSize: 11,
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        columnStyles: {
          0: { cellWidth: 190 },
          1: { cellWidth: 160 },
          2: { cellWidth: 160 }
        },
        
        didDrawPage: function (data) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          
          doc.text(
            "“Matino, Mahusay at Maaasahan”",
            pageWidth / 2,
            pageHeight - margin.bottom + 25,
            { align: "center" }
          );
          
          doc.setFont("helvetica", "normal");
          doc.text(
            "Telephone Number (042)754 - 5881",
            pageWidth / 2,
            pageHeight - margin.bottom + 40,
            { align: "center" }
          );
        }
      });
    }
    
    // ===== SAVE PDF =====
    const fileName = `${selectedAssessment || "Assessment"}_Complete_${municipality}_${selectedYear}.pdf`
      .replace(/\s+/g, '_')
      .replace(/[^\w\-_.]/g, '')
      .toLowerCase();
    
    doc.save(fileName);
    
  } catch (error) {
    console.error("Error generating complete PDF:", error);
    alert("Failed to generate complete PDF: " + error.message);
  } finally {
    setSavingAnswers(false);
    setShowExportModal(false);
  }
};
  

useEffect(() => {
  if (!auth.currentUser || !adminUid || !selectedYear || !selectedAssessmentId) return;

  const fetchDeadline = async () => {
    try {
      const deadlineRef = ref(
        db,
        `financial/${adminUid}/${selectedYear}/assessments/${selectedAssessmentId}/deadline`
      );
      
      onValue(deadlineRef, (snapshot) => {
        if (snapshot.exists()) {
          const deadline = snapshot.val();
          console.log("Deadline found for assessment:", deadline);
          setSubmissionDeadline(deadline);
        } else {
          console.log("No deadline found for this assessment");
          setSubmissionDeadline("");
        }
      });
    } catch (error) {
      console.error("Error fetching deadline:", error);
    }
  };

  fetchDeadline();
}, [adminUid, selectedYear, selectedAssessmentId]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const yearsRef = ref(db, `years/${auth.currentUser.uid}`);

    onValue(yearsRef, (snapshot) => {
      if (snapshot.exists()) {
        setYears(snapshot.val());
      } else {
        set(ref(db, `years/${auth.currentUser.uid}`), years);
      }
    });
  }, []);

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

  const dataSource = (lguAnswers && lguAnswers.length > 0) ? lguAnswers : (data || []);

  const filteredData = dataSource.filter((item) => {
    if (!item) return false;
    
    const searchTerm = search.toLowerCase().trim();
    
    if (!searchTerm) {
      return (
        (!filters.year || item.year === filters.year) &&
        (!filters.status || (item.status && item.status.toLowerCase() === filters.status.toLowerCase()))
      );
    }
    
    const lguName = item.lguName?.toLowerCase() || '';
    const municipality = item.municipality?.toLowerCase() || lguName;
    const year = item.year?.toLowerCase() || '';
    const submittedBy = item.submittedBy?.toLowerCase() || '';
    const status = item.status?.toLowerCase() || '';
    
    const searchableFields = [lguName, municipality, year, submittedBy, status].join(' ');
    
    const matchesSearch = searchableFields.includes(searchTerm);
    
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

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  // Function to toggle flag for current tab
  const toggleFlag = () => {
    const currentTabId = activeTab;
    const isFlagged = !!verifiedFlag[currentTabId];
    
    if (isFlagged) {
      setVerifiedFlag(prev => {
        const newFlags = { ...prev };
        delete newFlags[currentTabId];
        localStorage.setItem('verifiedFlag', JSON.stringify(newFlags));
        return newFlags;
      });
      
      alert(`Tab flagged removed`);
    } else {
      const bookmarkData = {
        lguName: lguAnswers[0]?.lguName || "",
        year: selectedYear,
        tabId: currentTabId,
        tabName: tabs.find(t => t.id === currentTabId)?.name || "Tab",
        timestamp: Date.now(),
        remarks: lguRemarks[currentTabId] || "Flagged as verified"
      };
      
      setVerifiedFlag(prev => {
        const newFlags = {
          ...prev,
          [currentTabId]: bookmarkData
        };
        localStorage.setItem('verifiedFlag', JSON.stringify(newFlags));
        return newFlags;
      });
      
      alert(`Tab flagged locally`);
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
    
    {/* Export Dropdown - UPDATED */}
    <div className={style.exportDropdownContainer}>
      <button
        className={style.sidebarMenuItem}
        onClick={() => setShowExportModal(!showExportModal)}
        style={{ width: "100%", justifyContent: "flex-start" }}
      >
        <FiClipboard style={{ marginRight: "8px", fontSize: "18px" }} />
        Export Menu
      </button>
      
      {showExportModal && (
        <div style={{
          position: "fixed",
          left: sidebarOpen ? '220px' : '60px',
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
          {/* Export Current Tab */}
          <div 
            className={style.exportDropdownItem}
            onClick={() => {
              if (!tabs.length) {
                alert("No tabs available to export");
                return;
              }
              if (!activeTab) {
                alert("Please select a tab first");
                return;
              }
              exportTabToPDF();
            }}
            style={{ cursor: "pointer", padding: "12px 16px", borderBottom: "1px solid #f0f0f0" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ 
                width: "32px", 
                height: "32px", 
                backgroundColor: "#f0f0f0", 
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                📄
              </div>
              <div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600" }}>Export Current Tab</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                  Export only the {tabs.find(t => t.id === activeTab)?.name || 'current'} tab as PDF
                </p>
              </div>
            </div>
          </div>

          {/* Export All Tabs */}
          <div 
            className={style.exportDropdownItem}
            onClick={() => {
              if (!tabs.length) {
                alert("No tabs available to export");
                return;
              }
              exportAllTabsToPDF();
            }}
            style={{ cursor: "pointer", padding: "12px 16px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ 
                width: "32px", 
                height: "32px", 
                backgroundColor: "#f0f0f0", 
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                📚
              </div>
              <div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600" }}>Export All Tabs</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                  Export all {tabs.length} tabs as a single PDF
                </p>
              </div>
            </div>
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
              <h2>
                {selectedAssessment || "Provincial Assessment"}
                {selectedYear && (
                  <span style={{ marginLeft: "5px", fontSize: "24px", fontWeight: "bold", color: "#000000" }}>
                    ({selectedYear})
                  </span>
                )}
              </h2>
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
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "15px", 
                  flexWrap: "wrap" 
                }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "4px 12px",
                    backgroundColor: location.state?.isVerified ? "#28a745" : (isReturnedFromPO ? "#ffb775" : "#ffb775"),
                    borderRadius: "20px",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}>
                    <span>{location.state?.isVerified ? "✓" : (isReturnedFromPO ? "↩" : "ⓘ")}</span>
                    <span>
                      {location.state?.isVerified ? "Assessment Verified" : 
                       isReturnedFromPO ? "Returned from PO" : "Assessment Not Yet Verified"}
                    </span>
                  </div>

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
    disabled={loading || location.state?.isVerified || isReturnedToLGU || isForwarded}
    style={{
      backgroundColor: (location.state?.isVerified || isReturnedToLGU || isForwarded) ? "#990202e6" : "#990202",
      color: "white",
      border: "none",
      padding: "8px 20px",
      borderRadius: "5px",
      fontSize: "14px",
      cursor: (location.state?.isVerified || isReturnedToLGU || isForwarded) ? "not-allowed" : "pointer",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      whiteSpace: "nowrap",
      opacity: (location.state?.isVerified || isReturnedToLGU || isForwarded) ? 0.6 : 1
    }}
  >
    <span>↩</span>
    {location.state?.isVerified ? "Verified (Cannot Return)" : 
     isForwarded ? "Forwarded (Cannot Return)" :
     isReturnedToLGU ? "Returned to LGU" : "Return to LGU"}
  </button>
</div>

{/* Forward to Provincial Office Button */}
<div style={{ position: "relative", display: "inline-block" }}>
  <button
    onClick={handleForwardToPO}
    disabled={loading || location.state?.isVerified || isReturnedToLGU || isForwarded}
    onMouseEnter={(e) => {
      if (!location.state?.isVerified && !isReturnedToLGU && !isForwarded) {
        const tooltip = e.currentTarget.parentElement.querySelector('.forward-tooltip');
        if (tooltip) tooltip.style.display = 'block';
      }
    }}
    onMouseLeave={(e) => {
      const tooltip = e.currentTarget.parentElement.querySelector('.forward-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    }}
    style={{
      backgroundColor: (location.state?.isVerified || isReturnedToLGU || isForwarded) ? "#006735e6" : "#006736",
      color: "white",
      border: "none",
      padding: "8px 20px",
      borderRadius: "5px",
      fontSize: "14px",
      cursor: (location.state?.isVerified || isReturnedToLGU || isForwarded) ? "not-allowed" : "pointer",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      whiteSpace: "nowrap",
      opacity: (location.state?.isVerified || isReturnedToLGU || isForwarded) ? 0.6 : 1
    }}
  >
    <span>→</span>
    {location.state?.isVerified ? "Verified (Cannot Forward)" : 
     isForwarded ? "Forwarded to PO" :
     isReturnedToLGU ? "Returned to LGU" : "Forward to Provincial Office"}
  </button>
  
  {!location.state?.isVerified && !isReturnedToLGU && !isForwarded && (
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
</div>


</div>
              </div>
            </div>

            {/* Dynamic Tabs */}
            <div className={style.assessmentTabs}>
              {tabs.length > 0 ? (
                tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={activeTab === tab.id ? style.activeTab : ""}
                    onClick={() => handleTabChange(tab.id)}
                  >
                    {tab.name}
                  </button>
                ))
              ) : (
                <div style={{ padding: "10px", color: "#999", fontStyle: "italic" }}>
                  No tabs available for this assessment
                </div>
              )}
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
                        const currentTabIndicators = activeTab ? tabData[activeTab] || [] : [];
                        
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
                                    const answer = lgu.data?.[radioKey] ?? lgu.data?.[baseKey];
                                    
                                    return (
                                      <div key={index} className="reference-wrapper">
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
                                                      name={`${record.firebaseKey}_${index}_${main.title}`}
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
                                                  const checkboxAnswer = lgu.data?.[checkboxKey];
                                                  
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

                                  {/* Sub Indicators */}
                                  {record.subIndicators?.map((sub, index) => {
                                    const radioKey = getAnswerKey(record, index, sub.title, true, null, "radio");
                                    const baseKey = getAnswerKey(record, index, sub.title, true);
                                    const answer = lgu.data?.[radioKey] ?? lgu.data?.[baseKey];
                                    
                                    return (
                                      <div key={index} className="reference-wrapper">
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
                                                    name={`${record.firebaseKey}_sub_${index}_${sub.title}`}
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
                                            
                                            {sub.fieldType === "checkbox" &&
                                              sub.choices.map((choice, i) => {
                                                const checkboxKey = getAnswerKey(record, index, `${sub.title}_${i}`, true, null, "checkbox");
                                                const checkboxAnswer = lgu.data?.[checkboxKey];
                                                
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
                                              const nestedAnswer = lgu.data?.[nestedRadioKey] ?? lgu.data?.[baseNestedKey];
                                              
                                              return (
                                                <div key={nested.id || nestedIndex} className="nested-reference-item">
                                                  <div className="nested-reference-row">
                                                    <div className="nested-reference-label">
                                                      {nested.title || 'Untitled'}
                                                    </div>
                                                    <div className="nested-reference-field">
                                                      
                                                      {/* Multiple Choice */}
                                                      {nested.fieldType === "multiple" && nested.choices?.map((choice, i) => (
                                                        <div key={i}>
                                                          <input 
                                                            type="radio" 
                                                            name={`${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}`}
                                                            checked={isRadioSelected(nestedAnswer?.value, choice, i)}
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
                                                        const nestedCheckboxAnswer = lgu.data?.[nestedCheckboxKey];
                                                        
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
                                                          {nestedAnswer?.value ? (
                                                            <span>
                                                              {nested.fieldType === "date" 
                                                                ? new Date(nestedAnswer.value).toLocaleDateString("en-US", {
                                                                    year: "numeric",
                                                                    month: "long",
                                                                    day: "numeric",
                                                                  })
                                                                : nestedAnswer.value
                                                              }
                                                            </span>
                                                          ) : (
                                                            <span style={{ fontStyle: "italic", color: "gray" }}>
                                                              No answer provided
                                                            </span>
                                                          )}
                                                        </div>
                                                      )}

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
                          No assessment data found.
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
                          Remarks from PO for {activeTab ? tabs.find(t => t.id === activeTab)?.name || 'Current' : 'Current'}:
                        </h4>
                        
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
                          {remarks && typeof remarks === 'object' && activeTab && remarks[activeTab] ? (
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

                      {/* Add Remarks for LGU - only show if not verified and not returned from PO (can still add remarks) */}
                      {!location.state?.isVerified && (
                        <div style={{ marginBottom: "20px" }}>
                          <h4 style={{ 
                            margin: "0 0 10px 0", 
                            color: "#333", 
                            fontSize: "16px",
                            fontWeight: "600"
                          }}>
                            Add Remarks for LGU ({activeTab ? tabs.find(t => t.id === activeTab)?.name || 'Current' : 'Current'} Tab):
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

                      {/* Flag as Verified Button */}
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
                            {verifiedFlag[activeTab] ? `Remove Flag` : `Flag as Verified`}
                          </button>
                          
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