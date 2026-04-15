import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import style from "src/MLGO-CSS/mlgo-view.module.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiFilter, FiRotateCcw, FiSettings, FiLogOut, FiFileText, FiClipboard, FiDownload  } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, push, onValue, set, get } from "firebase/database";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ===== HELPER FUNCTION =====


  // Helper function to sanitize field names (matching what LGU uses)
  const sanitizeKey = (key) => {
    return key.replace(/[.#$\[\]/]/g, '_');
  };

  
  // ===== DECOMPRESSION FUNCTIONS (to read compressed data from LGU) =====
  const decompressAnswers = (compressed) => {
    if (!compressed || !compressed.__keyMap) return compressed;
    
    const decompressed = {};
    const keyMap = compressed.__keyMap;
    
    Object.keys(compressed).forEach(shortKey => {
      if (shortKey !== '__keyMap') {
        const longKey = keyMap[shortKey];
        if (longKey) {
          decompressed[longKey] = compressed[shortKey];
        }
      }
    });
    
    return decompressed;
  };

  // Add this function for decompressing attachments

  const decompressRemarks = (compressed) => {
  if (!compressed || !compressed.__keyMap) return compressed;
  
  const decompressed = {};
  const keyMap = compressed.__keyMap;
  
  Object.keys(compressed).forEach(shortKey => {
    if (shortKey !== '__keyMap') {
      const longKey = keyMap[shortKey];
      if (longKey) {
        decompressed[longKey] = compressed[shortKey];
      }
    }
  });
  
  return decompressed;
};

const decompressAttachments = (compressed) => {
  if (!compressed || !compressed.__keyMap) return compressed;
  
  const decompressed = {};
  const keyMap = compressed.__keyMap;
  
  Object.keys(compressed).forEach(shortKey => {
    if (shortKey !== '__keyMap') {
      const longKey = keyMap[shortKey];
      if (longKey) {
        decompressed[longKey] = compressed[shortKey];
      }
    }
  });
  
  return decompressed;
};
// ===== PO REMARKS DISPLAY COMPONENT =====
const PORemarkDisplay = ({ indicatorPath, poRemarks }) => {
  // poRemarks is already an object with indicatorPath as keys
  const remark = poRemarks?.[indicatorPath] || "";
  
  if (!remark || remark.trim() === "") {
    return null;
  }
  
  return (
    <div 
      style={{
        marginTop: "8px",
        marginBottom: "8px",
        padding: "6px 10px",
        backgroundColor: "#e8f5e9",
        borderRadius: "4px",
        borderLeft: "3px solid #006736",
        fontSize: "11px"
      }}
    >
      <div 
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "4px",
          fontWeight: "bold",
          color: "#006736",
          fontSize: "11px"
        }}
      >
        <span>📝</span>
        <span>Remarks from PO:</span>
      </div>
      <div
        style={{
          fontStyle: "italic",
          color: "#333",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: "11px",
          lineHeight: "1.4"
        }}
      >
        {remark}
      </div>
    </div>
  );
};

const getVerificationArray = (verification) => {
  if (!verification) return [];
  if (Array.isArray(verification)) return verification;
  if (typeof verification === 'string') return [verification];
  if (typeof verification === 'object') {
    // Handle object with values
    if (verification.values && Array.isArray(verification.values)) return verification.values;
    if (verification.items && Array.isArray(verification.items)) return verification.items;
    // Handle object with numeric keys
    const values = Object.values(verification);
    if (values.length > 0 && values.some(v => typeof v === 'string')) return values;
  }
  return [];
};

export default function MLGOView() {
  const location = useLocation(); 
  const [lguRemarks, setLguRemarks] = useState({}); // Structure: { [tabId]: { [indicatorPath]: "remark" } }
const [activeRemarks, setActiveRemarks] = useState({}); // For UI tracking which indicator is being edited
  const [isForwarded, setIsForwarded] = useState(false);
  const [isVerifiedView, setIsVerifiedView] = useState(location.state?.isVerified || false);
  const [municipalityMap, setMunicipalityMap] = useState({});
  const [isReturned, setIsReturned] = useState(false);
  const [isReturnedFromPO, setIsReturnedFromPO] = useState(false); // NEW: flag for returned from PO
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [previewAttachment, setPreviewAttachment] = useState(null);
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
  const [actionTaken, setActionTaken] = useState(false);

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
const [poRemarks, setPoRemarks] = useState({}); // per-indicator remarks from PO
  const [verifiedFlag, setVerifiedFlag] = useState({}); // object per tab

  // Helper function to get tab name (fallback)
  const getTabName = (tab) => {
    return tab?.name || `Tab ${tab?.id}`;
  };

 // ===== UPDATED: Helper function to get the correct answer key =====
// ===== UPDATED: Helper function to get the correct answer key =====
const getAnswerKey = (record, mainIndex, field, isSub = false, nestedIndex = null, valueType = "default") => {
  // Generate a consistent key format that matches how attachments are stored
  const parts = [selectedAssessmentId, activeTab, record.firebaseKey];
  
  if (isSub) {
    if (nestedIndex !== null) {
      parts.push(`sub_${mainIndex}_nested_${nestedIndex}`);
    } else {
      parts.push(`sub_${mainIndex}`);
    }
  } else {
    parts.push(mainIndex.toString());
  }
  
  // Handle field type prefix - IMPORTANT: Add underscore for checkbox
  if (valueType === "radio") {
    parts.push("radio");
  } else if (valueType === "checkbox") {
    parts.push("checkbox");  // This will become "checkbox_" when joined
  }
  
  // Add the field name at the end - use the original field name, not sanitized
  parts.push(field);
  
  // Join with underscores
  return parts.join('_');
};

const sanitizeFieldName = (fieldName) => {
  if (!fieldName) return '';
  // DO NOT convert to lowercase - match LGU's sanitization exactly
  let sanitized = fieldName
    .replace(/[:;,\-()]/g, '_')  // Replace : ; , - ( ) with underscore
    .replace(/\s+/g, '_')        // Replace spaces with underscore
    .replace(/[^a-zA-Z0-9_]/g, '_')  // Replace any other special chars
    .replace(/_+/g, '_')         // Replace multiple underscores with single
    .replace(/[.#$\[\]/]/g, '_'); // Remove special Firebase characters
  
  return sanitized;
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

  // Add this function to handle viewing attachments
  const viewAttachment = (attachment) => {
    console.log('👁️ Viewing attachment:', attachment);
    setPreviewAttachment(attachment);
  };

  // Add this function to close the preview modal
  const closePreview = () => {
    setPreviewAttachment(null);
  };

  // ===== LOAD LGU ANSWERS =====
useEffect(() => {
  if (!auth.currentUser || !selectedYear || !selectedAssessmentId) return;
  
  // Check if we have either lguName OR lguUid
  if (!location.state?.lguName && !location.state?.lguUid) return;

  const loadLGUAnswers = async () => {
    try {
      setLoading(true);
      
      console.log("=== LOADING ASSESSMENT ===");
      console.log("location.state:", location.state);
      
       // ===== CHECK FOR VERIFIED ASSESSMENT FIRST =====
      if (location.state?.isVerified === true) {
        console.log("✅ Loading VERIFIED assessment");
        
        let lguUid = location.state?.lguUid;
        let cleanName = null;
        
        if (lguUid) {
          cleanName = `${lguUid}_${selectedAssessmentId}`;
          console.log("Looking for verified assessment at path:", cleanName);
          
          let decompressedData = {};
          let attachmentsByIndicator = {};
          let metadata = {};
          
          // FIRST: Try to load directly from answers node (most reliable)
          const answersDirectRef = ref(db, `answers/${selectedYear}/LGU/${cleanName}`);
          const answersDirectSnapshot = await get(answersDirectRef);
          
          if (answersDirectSnapshot.exists()) {
            console.log("✅ Found answers directly at answers node");
            const data = answersDirectSnapshot.val();
            metadata = data._metadata || {};
            const { _metadata, ...answers } = data;
            
            if (answers.__keyMap) {
              decompressedData = decompressAnswers(answers);
            } else {
              decompressedData = answers;
            }
            console.log("Answers loaded:", Object.keys(decompressedData).length);
            
            // Load attachments from attachments node
            const attachmentsRef = ref(db, `attachments/${selectedYear}/LGU/${cleanName}`);
            const attachmentsSnapshot = await get(attachmentsRef);
            
            if (attachmentsSnapshot.exists()) {
              const compressedAttachments = attachmentsSnapshot.val();
              const decompressedAttachments = decompressAttachments(compressedAttachments);
              
              Object.keys(decompressedAttachments).forEach(key => {
                const attachment = decompressedAttachments[key];
                let keyWithoutTimestamp = key;
                const lastUnderscoreIndex = key.lastIndexOf('_');
                if (lastUnderscoreIndex > -1) {
                  const possibleTimestamp = key.substring(lastUnderscoreIndex + 1);
                  if (/^\d+$/.test(possibleTimestamp) && possibleTimestamp.length >= 10) {
                    keyWithoutTimestamp = key.substring(0, lastUnderscoreIndex);
                  }
                }
                
                if (!attachmentsByIndicator[keyWithoutTimestamp]) {
                  attachmentsByIndicator[keyWithoutTimestamp] = [];
                }
                attachmentsByIndicator[keyWithoutTimestamp].push({
                  key: key,
                  name: attachment.fileName || attachment.name || 'Attachment',
                  url: attachment.url || attachment.fileData,
                  fileData: attachment.fileData || attachment.url,
                  fileSize: attachment.fileSize,
                  uploadedAt: attachment.uploadedAt,
                  fileType: attachment.fileType
                });
              });
              console.log("Attachments loaded:", Object.keys(attachmentsByIndicator).length);
            }
            
            const lguData = {
              id: 1,
              lguName: location.state.lguName || location.state.municipality,
              year: selectedYear,
              assessment: selectedAssessment,
              assessmentId: selectedAssessmentId,
              status: "Verified",
              submission: metadata.lastSaved ? new Date(metadata.lastSaved).toLocaleDateString() : "N/A",
              deadline: submissionDeadline || "Not set",
              data: decompressedData,
              municipality: metadata.municipality || location.state.municipality,
              userUid: lguUid,
              isVerified: true,
              isReturnedFromPO: false,
              isForwarded: false,
              attachmentsByIndicator: attachmentsByIndicator,
              savedRemarks: {},
              previousRemark: null
            };
            
            setLguAnswers([lguData]);
            setIsReturnedFromPO(false);
            setIsForwarded(false);
            setIsReturnedToLGU(false);
            setActionTaken(false);
            setLoading(false);
            return;
          }
          
          // SECOND: Try to load from verified node if direct answers not found
          const verifiedRef = ref(db, `verified/${selectedYear}/LGU/${cleanName}`);
          const verifiedSnapshot = await get(verifiedRef);
          
          if (verifiedSnapshot.exists()) {
            const verifiedData = verifiedSnapshot.val();
            console.log("Found verified data at verified node:", verifiedData);
            
            // Load answers from path
            if (verifiedData.answersPath) {
              const answersRef = ref(db, verifiedData.answersPath);
              const answersSnapshot = await get(answersRef);
              
              if (answersSnapshot.exists()) {
                const data = answersSnapshot.val();
                const { _metadata, ...answers } = data;
                if (answers.__keyMap) {
                  decompressedData = decompressAnswers(answers);
                } else {
                  decompressedData = answers;
                }
              }
            }
            
            // Load attachments from path
            if (verifiedData.attachmentsPath) {
              const attachmentsRef = ref(db, verifiedData.attachmentsPath);
              const attachmentsSnapshot = await get(attachmentsRef);
              
              if (attachmentsSnapshot.exists()) {
                const compressedAttachments = attachmentsSnapshot.val();
                const decompressedAttachments = decompressAttachments(compressedAttachments);
                
                Object.keys(decompressedAttachments).forEach(key => {
                  const attachment = decompressedAttachments[key];
                  let keyWithoutTimestamp = key;
                  const lastUnderscoreIndex = key.lastIndexOf('_');
                  if (lastUnderscoreIndex > -1) {
                    const possibleTimestamp = key.substring(lastUnderscoreIndex + 1);
                    if (/^\d+$/.test(possibleTimestamp) && possibleTimestamp.length >= 10) {
                      keyWithoutTimestamp = key.substring(0, lastUnderscoreIndex);
                    }
                  }
                  
                  if (!attachmentsByIndicator[keyWithoutTimestamp]) {
                    attachmentsByIndicator[keyWithoutTimestamp] = [];
                  }
                  attachmentsByIndicator[keyWithoutTimestamp].push({
                    key: key,
                    name: attachment.fileName || attachment.name || 'Attachment',
                    url: attachment.url || attachment.fileData,
                    fileData: attachment.fileData || attachment.url,
                    fileSize: attachment.fileSize,
                    uploadedAt: attachment.uploadedAt,
                    fileType: attachment.fileType
                  });
                });
              }
            }
            
       // Load PO remarks
if (verifiedData.poRemarks) {
  let poRemarksData = verifiedData.poRemarks;
  if (poRemarksData && poRemarksData.__keyMap) {
    poRemarksData = decompressRemarks(poRemarksData);
  }
  setPoRemarks(poRemarksData);
  console.log("📝 Loaded PO remarks from verified data:", poRemarksData);
}

// Load general remarks if any
if (verifiedData.remarks) {
  setRemarks({ [activeTab]: verifiedData.remarks });
}
            
            const lguData = {
              id: 1,
              lguName: location.state.lguName || location.state.municipality,
              year: selectedYear,
              assessment: selectedAssessment,
              assessmentId: selectedAssessmentId,
              status: "Verified",
              submission: verifiedData.verifiedAt ? new Date(verifiedData.verifiedAt).toLocaleDateString() : "N/A",
              deadline: submissionDeadline || "Not set",
              data: decompressedData,
              municipality: verifiedData.municipality || location.state.municipality,
              userUid: lguUid,
              isVerified: true,
              isReturnedFromPO: false,
              isForwarded: false,
              attachmentsByIndicator: attachmentsByIndicator,
              savedRemarks: {},
              previousRemark: null
            };
            
            setLguAnswers([lguData]);
            setIsReturnedFromPO(false);
            setIsForwarded(false);
            setIsReturnedToLGU(false);
            setActionTaken(false);
            setLoading(false);
            return;
          }
          
          console.log("No verified data found at any path for:", cleanName);
        }
      }
      
      // ===== END OF VERIFIED CHECK - CONTINUE WITH EXISTING CODE =====
      
        // Try to get LGU UID from location.state first
      let lguUid = location.state?.lguUid;
      let cleanName = null;
      
      // IMPORTANT: For returned from PO, ALWAYS use UID from state
      if (location.state?.isReturnedFromPO) {
        if (lguUid) {
          cleanName = `${lguUid}_${selectedAssessmentId}`;
          console.log("✅ RETURNED FROM PO - Using UID path:", cleanName);
        } else {
          console.error("❌ Missing lguUid for returned from PO notification");
          // Fallback to trying to find by name
          const lguName = location.state.lguName || location.state.municipality;
          cleanName = `${lguName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
          console.log("⚠️ FALLBACK - Using name path:", cleanName);
        }
      } 
      // For other cases, try UID first then fallback to old path
      else if (lguUid) {
        cleanName = `${lguUid}_${selectedAssessmentId}`;
        console.log("Using UID from state:", cleanName);
      }
      
      // If still no cleanName, try old path
      if (!cleanName) {
        // Try to find UID from the old path first
        const lguName = location.state.lguName || location.state.municipality;
        const oldCleanName = `${lguName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
        const oldAnswersRef = ref(db, `answers/${selectedYear}/LGU/${oldCleanName}`);
        const oldSnapshot = await get(oldAnswersRef);
        
        if (oldSnapshot.exists()) {
          const metadata = oldSnapshot.val()._metadata;
          lguUid = metadata?.uid;
          if (lguUid) {
            cleanName = `${lguUid}_${selectedAssessmentId}`;
            console.log("Found LGU UID from metadata:", lguUid);
            
            // Migrate data to new path
            const newAnswersRef = ref(db, `answers/${selectedYear}/LGU/${cleanName}`);
            const newSnapshot = await get(newAnswersRef);
            if (!newSnapshot.exists()) {
              console.log("Migrating data to new path...");
              await set(newAnswersRef, oldSnapshot.val());
              // Optionally delete old data
              // await set(oldAnswersRef, null);
            }
          } else {
            cleanName = oldCleanName;
            console.log("No UID found, using old path:", cleanName);
          }
        } else {
          cleanName = oldCleanName;
          console.log("No data found, using old path:", cleanName);
        }
      }
      
      const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanName}`);
      let snapshot = await get(answersRef);
      
      // If still not found and we have UID, try to find by scanning
      if (!snapshot.exists() && lguUid) {
        console.log("Data not found at expected path, scanning...");
        const yearRef = ref(db, `answers/${selectedYear}/LGU`);
        const yearSnapshot = await get(yearRef);
        
        if (yearSnapshot.exists()) {
          const lgus = yearSnapshot.val();
          for (const [key, value] of Object.entries(lgus)) {
            if (key.includes(lguUid) && key.includes(selectedAssessmentId)) {
              console.log("Found matching data at path:", key);
              cleanName = key;
              snapshot = await get(ref(db, `answers/${selectedYear}/LGU/${key}`));
              break;
            }
          }
        }
      }
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        const { _metadata, ...answers } = data;
        
        // DECOMPRESS the answers if they were compressed by LGU
        const decompressedAnswers = decompressAnswers(answers);
        
        console.log("Loaded LGU answers metadata:", _metadata);
        console.log("Answers were compressed?", !!answers.__keyMap);
        
     // Check if this assessment has PO remarks in metadata
// Check for PO remarks from navigation state (returned from PO)
if (location.state?.poRemarks) {
  let poRemarksData = location.state.poRemarks;
  // Check if compressed
  if (poRemarksData && poRemarksData.__keyMap) {
    poRemarksData = decompressRemarks(poRemarksData);
  }
  setPoRemarks(poRemarksData);
  console.log("📝 Loaded PO remarks from navigation state:", poRemarksData);
} else if (_metadata?.poRemarks) {
  let poRemarksData = _metadata.poRemarks;
  // Check if compressed
  if (poRemarksData && poRemarksData.__keyMap) {
    poRemarksData = decompressRemarks(poRemarksData);
  }
  setPoRemarks(poRemarksData);
  console.log("📝 Loaded PO remarks from metadata:", poRemarksData);
}

// Also load general remarks (per tab) if needed
if (location.state?.remarks) {
  setRemarks(location.state.remarks);
} else if (_metadata?.remarks) {
  setRemarks({ [activeTab]: _metadata.remarks });
}
        
       // Determine status and flags based on metadata OR navigation state
const isReturnedFromPO = location.state?.isReturnedFromPO || _metadata?.returnedToMLGO || false;
const isForwarded = _metadata?.forwarded || _metadata?.forwardedToPO || false;
const isReturnedToLGU = _metadata?.returnedToLGU || location.state?.isReturnedToLGU || false;

console.log("Status flags - isReturnedFromPO:", isReturnedFromPO, "isForwarded:", isForwarded);
        
        // Load saved MLGO remarks from metadata
        if (_metadata?.mlgoRemarks) {
          setLguRemarks(_metadata.mlgoRemarks);
          console.log("📝 Loaded saved MLGO remarks:", _metadata.mlgoRemarks);
        }

     // Load PO remarks from metadata
if (_metadata?.poRemarks) {
  let poRemarksData = _metadata.poRemarks;
  // Check if compressed
  if (poRemarksData && poRemarksData.__keyMap) {
    poRemarksData = decompressRemarks(poRemarksData);
  }
  setPoRemarks(poRemarksData);  // This should be the object with indicatorPath keys
  console.log("📝 Loaded PO remarks from metadata:", poRemarksData);
}
        
        const lguName = location.state.lguName || location.state.municipality;
        
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
          data: decompressedAnswers,
          municipality: _metadata?.municipality || location.state.municipality,
          userUid: _metadata?.uid || lguUid,
          isVerified: location.state?.isVerified || false,
          isReturnedFromPO: isReturnedFromPO,
          isForwarded: isForwarded,
          attachmentsByIndicator: {},
          savedRemarks: _metadata?.mlgoRemarks || {},
          previousRemark: _metadata?.remarks || null
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
        
      // ===== LOAD ATTACHMENTS =====
try {
  const attachmentsRef = ref(db, `attachments/${selectedYear}/LGU/${cleanName}`);
  const attachmentsSnapshot = await get(attachmentsRef);
  
  if (attachmentsSnapshot.exists()) {
    // Decompress attachments first
    const compressedAttachments = attachmentsSnapshot.val();
    const decompressedAttachments = decompressAttachments(compressedAttachments);
    const attachmentsByIndicator = {};
    
    console.log("📎 Attachments found:", Object.keys(decompressedAttachments).length);
    console.log("Attachments were compressed?", !!compressedAttachments.__keyMap);
    
    Object.keys(decompressedAttachments).forEach(key => {
      const attachment = decompressedAttachments[key];
      
      // Remove timestamp from the end of the key
      let keyWithoutTimestamp = key;
      const lastUnderscoreIndex = key.lastIndexOf('_');
      if (lastUnderscoreIndex > -1) {
        const possibleTimestamp = key.substring(lastUnderscoreIndex + 1);
        if (/^\d+$/.test(possibleTimestamp) && possibleTimestamp.length >= 10) {
          keyWithoutTimestamp = key.substring(0, lastUnderscoreIndex);
        }
      }
      
      const indicatorId = keyWithoutTimestamp;
      
      if (!attachmentsByIndicator[indicatorId]) {
        attachmentsByIndicator[indicatorId] = [];
      }
      
      attachmentsByIndicator[indicatorId].push({
        key: key,
        name: attachment.fileName || attachment.name || 'Attachment',
        url: attachment.url || attachment.fileData,
        fileData: attachment.fileData || attachment.url,
        fileSize: attachment.fileSize,
        uploadedAt: attachment.uploadedAt,
        fileType: attachment.fileType
      });
    });
    
    lguData.attachmentsByIndicator = attachmentsByIndicator;
    console.log("📎 Attachments mapped to indicators:", Object.keys(attachmentsByIndicator).length);
  } else {
    console.log("📎 No attachments found for this assessment");
    lguData.attachmentsByIndicator = {};
  }
} catch (error) {
  console.error("Error loading attachments:", error);
  lguData.attachmentsByIndicator = {};
}
      } else {
        console.log("No answers found for this assessment at path:", cleanName);
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

useEffect(() => {
  if (location.state?.year) {
    setSelectedYear(location.state.year);
    setSelectedAssessment(location.state.assessment || "");
    setSelectedAssessmentId(location.state.assessmentId || "");
    console.log("Viewing year:", location.state.year, "assessment:", location.state.assessment, "ID:", location.state.assessmentId, "LGU UID:", location.state.lguUid);
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

  setActionTaken(true);

  const confirmForward = window.confirm(
    "Are you sure you want to forward this assessment to the Provincial Office?"
  );
  
  if (!confirmForward) {
    setActionTaken(false);
    return;
  }

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
      setActionTaken(false);
      return;
    }
    
    const currentUserUid = auth.currentUser?.uid;
    
    if (!currentUserUid) {
      alert("You must be logged in to forward assessments");
      setActionTaken(false);
      return;
    }
    
    console.log("=== FORWARDING TO PO ===");
    console.log("PO UID:", poUid);
    console.log("MLGO UID:", currentUserUid);
    console.log("Selected Year:", selectedYear);
    console.log("Selected Assessment:", selectedAssessment);
    console.log("Selected Assessment ID:", selectedAssessmentId);
    
    // ===== FIX: Use UID-based path =====
    let lguUid = lgu.userUid || lgu.data?._metadata?.uid;
    let cleanName;
    
    // Try to use UID-based path first
    if (lguUid) {
      cleanName = `${lguUid}_${selectedAssessmentId}`;
      console.log("Using UID-based path for forward:", cleanName);
    } else {
      // Fallback to name-based path
      const lguName = lgu.lguName || location.state?.lguName;
      cleanName = `${lguName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
      console.log("Using name-based path for forward (fallback):", cleanName);
    }
    
    const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanName}`);
    let snapshot = await get(answersRef);
    
    // If not found with UID path, try to find by scanning
    if (!snapshot.exists() && lguUid) {
      console.log("Data not found at UID path, scanning for forward...");
      const yearRef = ref(db, `answers/${selectedYear}/LGU`);
      const yearSnapshot = await get(yearRef);
      
      if (yearSnapshot.exists()) {
        const lgus = yearSnapshot.val();
        for (const [key, value] of Object.entries(lgus)) {
          if (key.includes(lguUid) && key.includes(selectedAssessmentId)) {
            console.log("Found matching data at path for forward:", key);
            cleanName = key;
            snapshot = await get(ref(db, `answers/${selectedYear}/LGU/${key}`));
            break;
          }
        }
      }
    }
    
    if (!snapshot.exists()) {
      alert("Assessment data not found at path: " + cleanName);
      setActionTaken(false);
      return;
    }
    
    const currentData = snapshot.val();
    const metadata = currentData._metadata || {};
    
    // Get all answers data (without metadata)
    const { _metadata, ...answersData } = currentData;
    
    // Prepare forward data with ALL required fields

    const forwardData = {
      lguUid: metadata.uid || lguUid || currentUserUid,
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
      cleanName: cleanName,
      type: "forwarded",
      isNewForward: true,
      // CRITICAL: Preserve PO remarks from metadata
      poRemarks: currentData._metadata?.poRemarks || null,
      indicatorRemarksRaw: currentData._metadata?.indicatorRemarksRaw || null
    };
    
    console.log("Forward data to save:", forwardData);
    
    // CRITICAL: Save to forwarded node under PO's UID with a unique key
    const forwardedRef = ref(db, `forwarded/${poUid}`);
    const newForwardedRef = push(forwardedRef);
    await set(newForwardedRef, forwardData);
    
    console.log("✅ Forwarded to PO successfully at path:", `forwarded/${poUid}/${newForwardedRef.key}`);
    
    // VERIFY the data was saved
    const verifySnapshot = await get(forwardedRef);
    console.log("Verification - Forwarded node now has:", verifySnapshot.val());
    
    // ===== DELETE FROM RETURNED NODE IF IT EXISTS =====
    const returnedRef = ref(db, `returned/${selectedYear}/MLGO/${currentUserUid}/${selectedAssessmentId}`);
    const returnedSnapshot = await get(returnedRef);
    if (returnedSnapshot.exists()) {
      await set(returnedRef, null);
      console.log("✅ Removed from returned node");
    }
    
    // UPDATE answers node with forwarded flags
    const updatedMetadata = {
      ...metadata,
      uid: metadata.uid || lguUid || currentUserUid,
      email: metadata.email || auth.currentUser?.email,
      name: metadata.name || lgu.lguName,
      municipality: metadata.municipality || lgu.municipality,
      status: "Forwarded",
      forwarded: true,
      forwardedToPO: true,
      forwardedAt: Date.now(),
      forwardedBy: auth.currentUser?.email,
      forwardedByName: profileData.name || auth.currentUser?.email,
      forwardedTo: poUid,
      submitted: true,
      returned: false,
      returnedToMLGO: false,
      returnedAt: null,
      returnedBy: null,
      returnedByName: null,
      lastSaved: Date.now()
    };
    
    const updatedData = {
      ...answersData,
      _metadata: updatedMetadata
    };
    
    await set(answersRef, updatedData);
    console.log("✅ Updated answers node with forwarded metadata");
    
    // Create notification for PO
    const notificationRef = ref(db, `notifications/${selectedYear}/PO/${poUid}`);
    const notificationId = Date.now().toString();
    const notificationData = {
      id: notificationId,
      type: "assessment_forwarded",
      title: `"${selectedAssessment}" Assessment (${selectedYear}) was forwarded by MLGO (${userMunicipality || profileData.municipality || "Unknown Municipality"})`,
      message: `Assessment from ${lgu.lguName} has been forwarded to PO.`,
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
      lguUid: metadata.uid || lguUid || currentUserUid,
      mlgoMunicipality: userMunicipality || profileData.municipality,
      cleanName: cleanName,
      action: "view_assessment"
    };
    
    await set(ref(db, `notifications/${selectedYear}/PO/${poUid}/${notificationId}`), notificationData);
    console.log("✅ Notification created for PO");
    
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
    setActionTaken(false);
  } finally {
    setLoading(false);
  }
};
  

useEffect(() => {
  if (lguAnswers.length > 0) {
    const lgu = lguAnswers[0];
    
    // Check if this is a returned assessment (from PO or MLGO)
    const isReturnedFromPOFlag = lgu.isReturnedFromPO || lgu.data?._metadata?.returnedToMLGO === true;
    const isReturnedToLGUFlag = lgu.isReturnedToLGU || lgu.data?._metadata?.returnedToLGU === true;
    const isForwardedFlag = lgu.isForwarded || lgu.data?._metadata?.forwarded === true || lgu.data?._metadata?.forwardedToPO === true;
    
    // CRITICAL: For returned assessments, actionTaken should be FALSE
    // so that buttons become clickable again
    if (isReturnedFromPOFlag) {
      setIsReturnedFromPO(true);
      setActionTaken(false);  // Reset actionTaken so buttons work
      console.log("📌 Assessment returned from PO - buttons should be enabled");
    } else if (isReturnedToLGUFlag) {
      setIsReturnedToLGU(true);
      setActionTaken(false);  // Reset actionTaken so buttons work
      console.log("📌 Assessment returned to LGU - buttons should be enabled");
    } else if (isForwardedFlag) {
      setIsForwarded(true);
      setActionTaken(true);
      console.log("📌 Assessment forwarded - buttons disabled");
    } else {
      // Regular submitted/draft state
      setIsForwarded(false);
      setActionTaken(false);
    }
    
    console.log("Assessment status:", {
      isReturnedFromPO: isReturnedFromPOFlag,
      isReturnedToLGU: isReturnedToLGUFlag,
      isForwarded: isForwardedFlag,
      actionTaken: isReturnedFromPOFlag || isReturnedToLGUFlag ? false : isForwardedFlag
    });
  } else {
    setIsReturnedFromPO(false);
    setIsForwarded(false);
    setActionTaken(false);
  }
}, [lguAnswers]);
  

  const [data, setData] = useState([]);
  const [isReturnedToLGU, setIsReturnedToLGU] = useState(false);

  const handleReturnToLGU = async () => {
  if (!lguAnswers.length) {
    alert("No assessment data to return");
    return;
  }

  // Disable buttons immediately
  setActionTaken(true);

  const confirmReturn = window.confirm(
    "Are you sure you want to return this assessment to the LGU? This will make it editable again for them."
  );
  
  if (!confirmReturn) {
    setActionTaken(false);
    return;
  }

  try {
    setLoading(true);
    const lgu = lguAnswers[0];
    
    // Get the LGU UID - first from lgu object, then from metadata
    let lguUid = lgu.userUid || lgu.data?._metadata?.uid;
    let cleanName;
    
    // Try to use UID-based path first
    if (lguUid) {
      cleanName = `${lguUid}_${selectedAssessmentId}`;
      console.log("Using UID-based path for return:", cleanName);
    } else {
      // Fallback to name-based path
      const lguName = lgu.lguName || location.state?.lguName;
      cleanName = `${lguName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
      console.log("Using name-based path for return (fallback):", cleanName);
    }
    
    const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanName}`);
    let snapshot = await get(answersRef);
    
    // If not found with UID path, try to find by scanning
    if (!snapshot.exists() && lguUid) {
      console.log("Data not found at UID path, scanning for return...");
      const yearRef = ref(db, `answers/${selectedYear}/LGU`);
      const yearSnapshot = await get(yearRef);
      
      if (yearSnapshot.exists()) {
        const lgus = yearSnapshot.val();
        for (const [key, value] of Object.entries(lgus)) {
          if (key.includes(lguUid) && key.includes(selectedAssessmentId)) {
            console.log("Found matching data at path for return:", key);
            cleanName = key;
            snapshot = await get(ref(db, `answers/${selectedYear}/LGU/${key}`));
            break;
          }
        }
      }
    }
    
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
        
        // IMPORTANT: Set status to "Draft" for dashboard display
        status: "Draft",
        
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
      console.log("📤 status set to:", newMetadata.status);
      console.log("📤 submitted flag set to:", newMetadata.submitted);
      
      const updatedData = {
        ...currentData,
        _metadata: newMetadata
      };
      
      await set(answersRef, updatedData);
      console.log("✅ Assessment returned to LGU successfully with status: Draft");
      
      const lguUidFromData = currentData._metadata?.uid;
      const municipality = profileData.municipality || location.state?.municipality;

      if (lguUidFromData) {
        console.log("Sending notification to LGU with UID:", lguUidFromData, "Municipality:", municipality);
        
        const notificationRef = ref(db, `notifications/${selectedYear}/LGU/${lguUidFromData}`);
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
        
        await set(ref(db, `notifications/${selectedYear}/LGU/${lguUidFromData}/${notificationId}`), notificationData);
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
      console.log("❌ No assessment data found at path:", answersRef.toString());
      console.log("❌ Tried path:", cleanName);
      alert("Assessment data not found. Please check if the data exists.");
      setActionTaken(false);
    }
  } catch (error) {
    console.error("Error returning to LGU:", error);
    alert("Failed to return assessment: " + error.message);
    setActionTaken(false);
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

  
      // Generate unique path for each indicator (for storing remarks)
const getIndicatorPath = (record, mainIndex, subIndex = null, nestedIndex = null) => {
  let path = `${record.firebaseKey}`;
  if (mainIndex !== undefined && mainIndex !== null) {
    path += `_main_${mainIndex}`;
  }
  if (subIndex !== undefined && subIndex !== null) {
    path += `_sub_${subIndex}`;
  }
  if (nestedIndex !== undefined && nestedIndex !== null) {
    path += `_nested_${nestedIndex}`;
  }
  return path;
};
      // Get remark for specific indicator - memoized
const getIndicatorRemark = React.useCallback((tabId, indicatorPath) => {
  return lguRemarks[tabId]?.[indicatorPath] || "";
}, [lguRemarks]);

// Save remark for specific indicator - memoized
const setIndicatorRemark = React.useCallback((tabId, indicatorPath, remark) => {
  setLguRemarks(prev => ({
    ...prev,
    [tabId]: {
      ...prev[tabId],
      [indicatorPath]: remark
    }
  }));
}, []);

// Helper component for indicator remark textarea
const IndicatorRemark = React.memo(({ tabId, indicatorPath, placeholder }) => {
  // Use a ref to store the textarea DOM element
  const textareaRef = React.useRef(null);
  
  // Load initial remark when component mounts
  useEffect(() => {
    const initialRemark = lguRemarks[tabId]?.[indicatorPath] || '';
    if (textareaRef.current) {
      textareaRef.current.value = initialRemark;
    }
  }, [tabId, indicatorPath]); // Only run when path changes, not on lguRemarks
  
  // Save to parent when textarea loses focus
  const handleBlur = (e) => {
    const newValue = e.target.value;
    const currentValue = lguRemarks[tabId]?.[indicatorPath] || '';
    if (newValue !== currentValue) {
      setIndicatorRemark(tabId, indicatorPath, newValue);
    }
  };
  
  // Stop event propagation to prevent parent handlers from interfering
  const stopPropagation = (e) => {
    e.stopPropagation();
  };
  
  return (
    <div 
      style={{
        marginTop: "4px",        // REDUCED from 8px
        padding: "4px",          // REDUCED from 6px
        backgroundColor: "#fafafa",
        borderRadius: "4px",
        borderLeft: "3px solid #730101"
      }}
    >
      <textarea
        ref={textareaRef}
        placeholder={placeholder || "Add specific remark for this indicator..."}
        rows="1"                   // CHANGED from 2 to 1
        defaultValue={lguRemarks[tabId]?.[indicatorPath] || ''}
        onBlur={handleBlur}
        onMouseDown={stopPropagation}
        onMouseUp={stopPropagation}
        onClick={stopPropagation}
        onKeyDown={stopPropagation}
        style={{
          width: "100%",
          padding: "4px 8px",      // REDUCED from 8px 10px
          border: "1px solid #ffffff",
          borderRadius: "4px",
          fontSize: "11px",        // REDUCED from 12px
          resize: "vertical",
          fontFamily: "inherit",
          backgroundColor: "#fffef7",
          pointerEvents: "auto",
          outline: "none",
          lineHeight: "1.3"        // Added for better readability with smaller height
        }}
      />
    </div>
  );
});

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
      doc.text(`${tabName}`, margin.left, infoStartY + 75);     
      
      // ===== TABLE HEADER =====     
      const headers = [      
        ["Required Data", "Mode of Verification", "LGU Condition"]    
      ];     
      
      const tableData = [];     

// Helper function to get checkbox answers (UPDATED)
const getCheckboxAnswers = (indicator, path) => {
  if (!indicator || !indicator.choices || !Array.isArray(indicator.choices)) {
    return "";
  }
  
  console.log(`Getting checkbox answers for ${indicator.title} with path:`, path);
  
  const checkedOptions = [];
  
  // Try different checkbox key patterns for each choice
  indicator.choices.forEach((choice, idx) => {
    const possibleKeys = [
      // Pattern 1: With checkbox prefix and sanitized field
      `${selectedAssessmentId}_${activeTab}_${path}_checkbox_${sanitizeFieldName(indicator.title)}_${idx}`,
      // Pattern 2: With checkbox prefix and original field
      `${selectedAssessmentId}_${activeTab}_${path}_checkbox_${indicator.title}_${idx}`,
      // Pattern 3: Alternative order, sanitized
      `${selectedAssessmentId}_${activeTab}_${path}_${sanitizeFieldName(indicator.title)}_checkbox_${idx}`,
      // Pattern 4: Alternative order, original
      `${selectedAssessmentId}_${activeTab}_${path}_${indicator.title}_checkbox_${idx}`,
      // Pattern 5: Without field type, sanitized
      `${selectedAssessmentId}_${activeTab}_${path}_${sanitizeFieldName(indicator.title)}_${idx}`,
      // Pattern 6: Without field type, original
      `${selectedAssessmentId}_${activeTab}_${path}_${indicator.title}_${idx}`,
      // Pattern 7: With value wrapper, sanitized
      `${selectedAssessmentId}_${activeTab}_${path}_value_${sanitizeFieldName(indicator.title)}_${idx}`,
      // Pattern 8: With value wrapper, original
      `${selectedAssessmentId}_${activeTab}_${path}_value_${indicator.title}_${idx}`
    ];
    
    let checkboxAnswer = null;
    for (const key of possibleKeys) {
      const answer = userAnswers[key];
      if (answer !== undefined && answer !== null) {
        checkboxAnswer = answer;
        console.log(`Found checkbox answer for key: ${key}`, answer);
        break;
      }
    }
    
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
      // Check if it's a string "true"
      else if (checkboxAnswer === "true") {
        const choiceText = typeof choice === "object"
          ? (choice.label || choice.value || choice.name || "")
          : choice;
        checkedOptions.push(choiceText);
      }
    }
  });
  
  // Also check for consolidated checkbox answer objects
  const consolidatedKeys = [
    `${selectedAssessmentId}_${activeTab}_${path}_checkbox_${sanitizeFieldName(indicator.title)}`,
    `${selectedAssessmentId}_${activeTab}_${path}_checkbox_${indicator.title}`,
    `${selectedAssessmentId}_${activeTab}_${path}_${sanitizeFieldName(indicator.title)}`,
    `${selectedAssessmentId}_${activeTab}_${path}_${indicator.title}`,
    `${selectedAssessmentId}_${activeTab}_${sanitizeFieldName(indicator.title)}`,
    `${selectedAssessmentId}_${activeTab}_${indicator.title}`
  ];
  
  for (const consolidatedKey of consolidatedKeys) {
    const consolidatedAnswer = userAnswers[consolidatedKey];
    if (consolidatedAnswer) {
      console.log(`Found consolidated checkbox answer:`, consolidatedAnswer);
      
      // If it's an array of selected values
      if (Array.isArray(consolidatedAnswer)) {
        consolidatedAnswer.forEach((value) => {
          if (value && !checkedOptions.includes(value)) {
            checkedOptions.push(value);
          }
        });
      }
      // If it's an object with a values array
      else if (typeof consolidatedAnswer === 'object' && consolidatedAnswer.values) {
        consolidatedAnswer.values.forEach((value) => {
          if (value && !checkedOptions.includes(value)) {
            checkedOptions.push(value);
          }
        });
      }
      // If it's an object with selected array
      else if (typeof consolidatedAnswer === 'object' && consolidatedAnswer.selected) {
        consolidatedAnswer.selected.forEach((idx) => {
          if (indicator.choices && indicator.choices[idx]) {
            const choice = indicator.choices[idx];
            const choiceText = typeof choice === "object"
              ? (choice.label || choice.value || choice.name || "")
              : choice;
            if (!checkedOptions.includes(choiceText)) {
              checkedOptions.push(choiceText);
            }
          }
        });
      }
      break;
    }
  }
  
  const result = checkedOptions.join(", ");
  console.log(`  Final checked options:`, result);
  
  return result;
};
      
   // Helper function to get answer for other field types (UPDATED)
const getIndicatorAnswer = (indicator, path) => {
  if (!indicator || !path) return "";
  
  // Handle checkbox separately
  if (indicator.fieldType === "checkbox") {
    return getCheckboxAnswers(indicator, path);
  }
  
  console.log(`Looking for answer for ${indicator.title} (${indicator.fieldType}) with path:`, path);
  
  // Try different key patterns for non-checkbox fields
  const possibleKeys = [
    // Pattern 1: With radio prefix and sanitized field
    `${selectedAssessmentId}_${activeTab}_${path}_radio_${sanitizeFieldName(indicator.title)}`,
    // Pattern 2: With radio prefix and original field
    `${selectedAssessmentId}_${activeTab}_${path}_radio_${indicator.title}`,
    // Pattern 3: With field type prefix and sanitized field
    `${selectedAssessmentId}_${activeTab}_${path}_${indicator.fieldType}_${sanitizeFieldName(indicator.title)}`,
    // Pattern 4: With field type prefix and original field
    `${selectedAssessmentId}_${activeTab}_${path}_${indicator.fieldType}_${indicator.title}`,
    // Pattern 5: Without prefix, sanitized
    `${selectedAssessmentId}_${activeTab}_${path}_${sanitizeFieldName(indicator.title)}`,
    // Pattern 6: Without prefix, original
    `${selectedAssessmentId}_${activeTab}_${path}_${indicator.title}`,
    // Pattern 7: With value wrapper, sanitized
    `${selectedAssessmentId}_${activeTab}_${path}_value_${sanitizeFieldName(indicator.title)}`,
    // Pattern 8: With value wrapper, original
    `${selectedAssessmentId}_${activeTab}_${path}_value_${indicator.title}`,
    // Pattern 9: Just tab and indicator, sanitized
    `${selectedAssessmentId}_${activeTab}_${sanitizeFieldName(indicator.title)}`,
    // Pattern 10: Just tab and indicator, original
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
    
    // Also check for direct values (non-object)
    const directAnswer = userAnswers[key];
    if (directAnswer !== undefined && directAnswer !== null && typeof directAnswer !== 'object') {
      console.log(`Found direct value for key: ${key}`, directAnswer);
      
      if (indicator.fieldType === "multiple") {
        const choiceIndex = parseInt(directAnswer);
        if (!isNaN(choiceIndex) && indicator.choices && indicator.choices[choiceIndex]) {
          const choice = indicator.choices[choiceIndex];
          return typeof choice === "object"
            ? (choice.label || choice.value || choice.name || "")
            : choice;
        }
        return directAnswer;
      }
      
      return directAnswer;
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
    top: 20,
    bottom: 60,
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
    lineHeight: 1.15,
    overflow: 'linebreak'
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
  pageBreak: 'auto',
  showHead: 'everyPage',
  
  didDrawPage: function (data) {
    const remainingSpace = pageHeight - data.cursor.y;
    if (remainingSpace > 60) {
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
      alert("No areas available to export");
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
        doc.text(`${tabName}`, margin.left, infoStartY + 75);
        
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
    top: 20,
    bottom: 60,
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
    lineHeight: 1.15,
    overflow: 'linebreak'
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
  pageBreak: 'auto',
  showHead: 'everyPage',
  
  didDrawPage: function (data) {
    const remainingSpace = pageHeight - data.cursor.y;
    if (remainingSpace > 60) {
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
                <h3 style={{textAlign: "center", lineHeight: "1.1", marginLeft: "-20%",}}>STRATEGIC UNIT FOR <br />KEY{" "} <span className="yellow">ASS</span><span className="cyan">ESS</span>
                <span className="red">MENT</span>  <span className="white">AND</span> TRACKING</h3>
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
                  alert("No area available to export");
                  return;
                }
                if (!activeTab) {
                  alert("Please select a area first");
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
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600" }}>Export Current Area</h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                    Export only the {tabs.find(t => t.id === activeTab)?.name || 'current'} area
                  </p>
                </div>
              </div>
            </div>
  
            {/* Export All Tabs */}
            <div 
              className={style.exportDropdownItem}
              onClick={() => {
                if (!tabs.length) {
                  alert("No areas available to export");
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
                  <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600" }}>Export All Areas</h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                    Export all {tabs.length} areas
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
  fontWeight: "600",
  color: location.state?.isVerified ? "white" : "black"
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
{/* Only show buttons if NOT verified */}
{!location.state?.isVerified && (
  <>
   {/* Return to LGU Button */}
<div style={{ position: "relative", display: "inline-block" }}>
  <button
    onClick={handleReturnToLGU}
    disabled={loading || isReturnedToLGU || isForwarded || actionTaken}
    style={{
      backgroundColor: (isReturnedToLGU || isForwarded || actionTaken) ? "#8b5a5a" : "#990202",
      color: "white",
      border: "none",
      padding: "8px 20px",
      borderRadius: "5px",
      fontSize: "14px",
      cursor: (isReturnedToLGU || isForwarded || actionTaken) ? "not-allowed" : "pointer",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      whiteSpace: "nowrap",
      opacity: (isReturnedToLGU || isForwarded || actionTaken) ? 0.7 : 1
    }}
  >
    <span>↩</span>
    {isForwarded ? "Forwarded (Cannot Return)" :
     isReturnedToLGU ? "Returned to LGU" : 
     actionTaken ? "Processing..." : "Return to LGU"}
  </button>
</div>
      
  {/* Forward to Provincial Office Button */}
<div style={{ position: "relative", display: "inline-block" }}>
  <button
    onClick={handleForwardToPO}
    disabled={loading || isReturnedToLGU || isForwarded || actionTaken}
    onMouseEnter={(e) => {
      if (!isReturnedToLGU && !isForwarded && !actionTaken) {
        const tooltip = e.currentTarget.parentElement.querySelector('.forward-tooltip');
        if (tooltip) tooltip.style.display = 'block';
      }
    }}
    onMouseLeave={(e) => {
      const tooltip = e.currentTarget.parentElement.querySelector('.forward-tooltip');
      if (tooltip) tooltip.style.display = 'none';
    }}
    style={{
      backgroundColor: (isReturnedToLGU || isForwarded || actionTaken) ? "#5a7a5a" : "#006736",
      color: "white",
      border: "none",
      padding: "8px 20px",
      borderRadius: "5px",
      fontSize: "14px",
      cursor: (isReturnedToLGU || isForwarded || actionTaken) ? "not-allowed" : "pointer",
      fontWeight: "600",
      display: "flex",
      alignItems: "center",
      gap: "8px",
      whiteSpace: "nowrap",
      opacity: (isReturnedToLGU || isForwarded || actionTaken) ? 0.7 : 1
    }}
  >
    <span>→</span>
    {isForwarded ? "Forwarded to PO" :
     isReturnedToLGU ? "Returned to LGU" : 
     actionTaken ? "Processing..." : "Forward to Provincial Office"}
  </button>
      
      {!isReturnedToLGU && !isForwarded && (
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
  </>
)}
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
                    maxHeight: sidebarOpen ? 'calc(100vh - 210px)' : 'calc(100vh - 200px)',
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
   // Try both sanitized and original keys
   const radioKeySanitized = getAnswerKey(record, index, main.title, false, null, "radio");
   const radioKeyOriginal = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_radio_${main.title}`;
   const baseKeySanitized = getAnswerKey(record, index, main.title);
   const baseKeyOriginal = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_${main.title}`;
   const answer = lgu.data?.[radioKeySanitized] ?? lgu.data?.[radioKeyOriginal] ?? lgu.data?.[baseKeySanitized] ?? lgu.data?.[baseKeyOriginal];
    
   // Try multiple patterns to find attachments (matching PO View)
   const attachmentsByIndicator = lgu.attachmentsByIndicator || {};

   // Pattern 1: Original format (without assessment ID)
   const pattern1 = `${record.firebaseKey}_${index}_${main.title}`;
   // Pattern 2: With underscores instead of spaces
   const pattern2 = `${record.firebaseKey}_${index}_${main.title.replace(/\s+/g, '_')}`;
   // Pattern 3: With assessment ID and tab ID
   const pattern3 = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_${main.title}`;
   // Pattern 4: With assessment ID, tab ID, and underscores
   const pattern4 = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_${main.title.replace(/\s+/g, '_')}`;

   let indicatorAttachments = attachmentsByIndicator[pattern1] || 
                             attachmentsByIndicator[pattern2] || 
                             attachmentsByIndicator[pattern3] || 
                             attachmentsByIndicator[pattern4] || [];

   // If still not found, search through all keys
   if (indicatorAttachments.length === 0) {
     Object.keys(attachmentsByIndicator).forEach(key => {
       if (key.includes(`${record.firebaseKey}_${index}_`)) {
         indicatorAttachments = [...indicatorAttachments, ...attachmentsByIndicator[key]];
       }
     });
   }

   console.log(`Main indicator "${main.title}" - Found ${indicatorAttachments.length} attachments`);
    
   return (
     <div key={index} className="reference-wrapper">
        <div className="reference-row" style={{ border: "1px solid #cfcfcf" }}>
           <div className="reference-label" style={{
             width: "45%",
             background: "#e6f0fa",
             padding: "6px 10px",
             fontWeight: 500,
             borderRight: "1px solid #cfcfcf",
             color: "#0c1a4b",
             fontSize: "13px"
           }}>
             {main.title}
           </div>

           <div className="mainreference-field" style={{
             width: "55%",
             padding: "4px 10px",
             background: "#ffffff"
           }}>
             <div className="field-content">
               {main.fieldType === "multiple" && main.choices.map((choice, i) => {
                 // Try both sanitized and original keys
                 const radioKeySanitized = getAnswerKey(record, index, main.title, false, null, "radio");
                 const radioKeyOriginal = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_radio_${main.title}`;
                 const answerValue = lgu.data?.[radioKeySanitized]?.value ?? lgu.data?.[radioKeyOriginal]?.value;
                 
                 return (
                   <div key={i}>
                     <input 
                       type="radio" 
                       name={`${record.firebaseKey}_${index}_${main.title}`}
                       checked={isRadioSelected(answerValue, choice, i)}
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
               
               {main.fieldType === "checkbox" && main.choices.map((choice, i) => {
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
               })}
               
               {(main.fieldType === "short" || main.fieldType === "integer" || main.fieldType === "date") && (
                 <div>
                   {(() => {
                     // Try both sanitized and original keys to find the answer
                     const sanitizedKey = getAnswerKey(record, index, main.title);
                     const originalKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_${main.title}`;
                     const answerValue = lgu.data?.[sanitizedKey]?.value ?? lgu.data?.[originalKey]?.value;
                     
                     if (answerValue) {
                       return (
                         <span>
                           {main.fieldType === "integer" 
                             ? new Intl.NumberFormat('en-US').format(parseFloat(answerValue))
                             : main.fieldType === "date" 
                               ? new Date(answerValue).toLocaleDateString("en-US", {
                                   year: "numeric",
                                   month: "long",
                                   day: "numeric",
                                 })
                               : answerValue
                           }
                         </span>
                       );
                     } else {
                       return (
                         <span style={{ fontStyle: "italic", color: "gray" }}>
                           No answer provided
                         </span>
                       );
                     }
                   })()}
                 </div>
               )}
             </div>
           </div>
         </div>

         {/* Mode of Verification for main indicators */}
         {main.verification && getVerificationArray(main.verification).length > 0 && (
           <div className="reference-verification-full" style={{ width: "100%" }}>
             <div className="reference-row" style={{ display: "flex", border: "none" }}>
               <div className="reference-label" style={{
                 width: "45%",
                 background: "transparent",
                 borderRight: "1px solid #cfcfcf",
                 padding: "6px 12px",
                 border: "none",
                 display: "flex",
                 flexDirection: "column",
                 gap: "4px",
                 textAlign: "left",
               }}>
                 <span style={{ display: "inline-block", flexShrink: 0, fontWeight: 700, color: "#081a4b" }}>Mode of Verification</span>
                 <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                   {getVerificationArray(main.verification).map((v, idx) => (
                     <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                       <span style={{
                         width: "6px",
                         height: "6px",
                         backgroundColor: "black",
                         borderRadius: "50%",
                         display: "inline-block",
                         flexShrink: 0,
                         marginLeft: "50px"
                       }}></span>
                       <span style={{ fontStyle: "italic", fontSize: "12px" }}>{v}</span>
                     </div>
                   ))}
                 </div>
               </div>
               
               <div className="reference-field" style={{
                 borderLeft: "1px solid #cfcfcf",
                 width: "55%",
                 padding: "6px 12px",
                 background: "#ffffff",
                 display: "flex",
                 flexDirection: "column",
                 alignItems: "flex-end",
                 border: "none",
                 gap: "8px"
               }}>
                 <div style={{
                   display: "flex",
                   flexDirection: "column",
                   gap: "6px",
                   width: "100%"
                 }}>
                   {indicatorAttachments.length > 0 && (
                     <div style={{
                       display: "flex",
                       flexWrap: "wrap",
                       gap: "8px",
                       width: "100%",
                       marginTop: "8px"
                     }}>
                       {indicatorAttachments.map((attachment, idx) => (
                         <div key={idx} style={{
                           display: "flex",
                           alignItems: "center",
                           gap: "4px",
                           backgroundColor: "#e8f5e9",
                           padding: "4px 8px",
                           borderRadius: "16px",
                           fontSize: "11px",
                           border: "1px solid #c8e6c9",
                           maxWidth: "900px"
                         }}>
                           <span style={{ fontSize: "14px" }}>📎</span>
                           <span style={{ 
                             overflow: "hidden", 
                             textOverflow: "ellipsis",
                             whiteSpace: "nowrap",
                             color: "#0c1a4b",
                             flex: 1,
                             maxWidth: "200px"
                           }}>
                             {attachment.name || 'Attachment'}
                           </span>
                           
                           <button
                             onClick={() => viewAttachment(attachment)}
                             style={{
                               background: "none",
                               border: "none",
                               cursor: "pointer",
                               padding: "4px 8px",
                               fontSize: "14px",
                               color: "#0c1a4b",
                               display: "flex",
                               alignItems: "center",
                               borderRadius: "4px",
                               transition: "all 0.2s"
                             }}
                             onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#c8e6c9"}
                             onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                             title="View attachment"
                           >
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                               <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                               <circle cx="12" cy="12" r="3"/>
                             </svg>
                           </button>
                           
                           <button
                             onClick={() => downloadAttachment(attachment)}
                             style={{
                               background: "none",
                               border: "none",
                               cursor: "pointer",
                               padding: "4px 8px",
                               fontSize: "16px",
                               color: "#0c1a4b",
                               display: "flex",
                               alignItems: "center",
                               borderRadius: "4px",
                               transition: "all 0.2s"
                             }}
                             onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#c8e6c9"}
                             onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                             title="Download attachment"
                           >
                             <FiDownload />
                           </button>
                         </div>
                       ))}
                     </div>
                   )}
                 </div>
               </div>
             </div>
           </div>
         )}
         
    {/* ===== DISPLAY PO REMARKS IF EXISTS ===== */}
<PORemarkDisplay
  indicatorPath={getIndicatorPath(record, index)}
  poRemarks={poRemarks}
/>
      {/* ===== INDICATOR REMARKS TEXTAREA (EDITABLE ONLY IF NOT VERIFIED) ===== */}
{!location.state?.isVerified ? (
  <IndicatorRemark
    tabId={activeTab}
    indicatorPath={getIndicatorPath(record, index)}
    placeholder="📝 Add remarks for LGU...."
  />
) : (
  (() => {
    const remarkValue = lguRemarks[activeTab]?.[getIndicatorPath(record, index)] || "";
    if (!remarkValue) return null;
    return (
      <div 
        style={{
          marginTop: "4px",
          padding: "6px 10px",
          backgroundColor: "#e8f5e9",
          borderRadius: "4px",
          borderLeft: "3px solid #006736",
          fontSize: "11px"
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "4px",
          fontWeight: "bold",
          color: "#006736",
          fontSize: "11px"
        }}>
          <span>📝</span>
          <span>MLGO Remark:</span>
        </div>
        <div style={{
          fontStyle: "italic",
          color: "#333",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: "11px",
          lineHeight: "1.4"
        }}>
          {remarkValue}
        </div>
      </div>
    );
  })()
)}
       </div>
     );
   })}
  
  {/* Sub Indicators */}
{record.subIndicators?.map((sub, index) => {
   const radioKey = getAnswerKey(record, index, sub.title, true, null, "radio");
   const baseKey = getAnswerKey(record, index, sub.title, true);
   const answer = lgu.data?.[radioKey] ?? lgu.data?.[baseKey];
   
   // Try multiple patterns to find attachments for sub indicators
   const attachmentsByIndicator = lgu.attachmentsByIndicator || {};
   
   // Pattern 1: Original format
   const subPattern1 = `${record.firebaseKey}_sub_${index}_${sub.title}`;
   // Pattern 2: With underscores
   const subPattern2 = `${record.firebaseKey}_sub_${index}_${sub.title.replace(/\s+/g, '_')}`;
   // Pattern 3: With assessment ID and tab ID
   const subPattern3 = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_${sub.title}`;
   // Pattern 4: With assessment ID, tab ID, and underscores
   const subPattern4 = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_${sub.title.replace(/\s+/g, '_')}`;
   
   let subIndicatorAttachments = attachmentsByIndicator[subPattern1] || 
                                attachmentsByIndicator[subPattern2] || 
                                attachmentsByIndicator[subPattern3] || 
                                attachmentsByIndicator[subPattern4] || [];
   
   // If not found, search through keys containing the sub pattern
   if (subIndicatorAttachments.length === 0) {
     Object.keys(attachmentsByIndicator).forEach(key => {
       if (key.includes(`${record.firebaseKey}_sub_${index}_`) && !key.includes('_nested_')) {
         subIndicatorAttachments = [...subIndicatorAttachments, ...attachmentsByIndicator[key]];
       }
     });
   }
   
   console.log(`Sub indicator "${sub.title}" - Found ${subIndicatorAttachments.length} attachments`);
    
   return (
     <div key={index} className="reference-wrapper">
        <div className="reference-row sub-row" style={{
          display: "flex",
          marginTop: "3px",
          border: "1px solid #cfcfcf"
        }}>
          <div className="reference-label" style={{
            width: "45%",
            background: "#fff6f6",
            padding: "6px 10px",
            fontWeight: 500,
            borderRight: "1px solid #cfcfcf",
            fontSize: "12px"
          }}>
            {sub.title}
          </div>

          <div className="reference-field" style={{
            width: "55%",
            padding: "4px 10px",
            background: "#ffffff"
          }}>
            {sub.fieldType === "multiple" && sub.choices.map((choice, i) => (
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
            
            {sub.fieldType === "checkbox" && sub.choices.map((choice, i) => {
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
                     {sub.fieldType === "integer" 
                       ? new Intl.NumberFormat('en-US').format(parseFloat(answer.value))
                       : sub.fieldType === "date" 
                         ? new Date(answer.value).toLocaleDateString("en-US", {
                             year: "numeric",
                             month: "long",
                             day: "numeric",
                           })
                         : answer.value
                     }
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

        {/* Mode of Verification for sub indicators */}
        {sub.verification && getVerificationArray(sub.verification).length > 0 && (
          <div className="reference-verification-full" style={{ width: "100%" }}>
            <div className="reference-row" style={{ display: "flex", border: "none" }}>
              <div className="reference-label" style={{
                width: "45%",
                background: "transparent",
                borderRight: "1px solid #cfcfcf",
                padding: "6px 12px",
                border: "none",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                textAlign: "left",
              }}>
                <span style={{ display: "inline-block", flexShrink: 0, fontWeight: 700, color: "#081a4b" }}>Mode of Verification</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                  {getVerificationArray(sub.verification).map((v, idx) => (
                    <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                      <span style={{
                        width: "6px",
                        height: "6px",
                        backgroundColor: "black",
                        borderRadius: "50%",
                        display: "inline-block",
                        flexShrink: 0,
                        marginLeft: "50px"
                      }}></span>
                      <span style={{ fontStyle: "italic", fontSize: "12px" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="reference-field" style={{
                borderLeft: "1px solid #cfcfcf",
                width: "55%",
                padding: "6px 12px",
                background: "#ffffff",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                border: "none",
                gap: "8px"
              }}>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  width: "100%"
                }}>
                  {subIndicatorAttachments.length > 0 && (
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                      width: "100%",
                      marginTop: "8px"
                    }}>
                      {subIndicatorAttachments.map((attachment, idx) => (
                        <div key={idx} style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          backgroundColor: "#e8f5e9",
                          padding: "6px 12px",
                          borderRadius: "20px",
                          fontSize: "12px",
                          border: "1px solid #c8e6c9",
                          maxWidth: "100%",
                          flexWrap: "wrap"
                        }}>
                          <span style={{ fontSize: "14px" }}>📎</span>
                          <span style={{ 
                            overflow: "hidden", 
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: "#0c1a4b",
                            flex: 1,
                            maxWidth: "200px"
                          }}>
                            {attachment.name || 'Attachment'}
                          </span>
                          
                          <button
                            onClick={() => viewAttachment(attachment)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 8px",
                              fontSize: "14px",
                              color: "#0c1a4b",
                              display: "flex",
                              alignItems: "center",
                              borderRadius: "4px",
                              transition: "all 0.2s"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#c8e6c9"}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                            title="View attachment"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                          </button>
                          
                          <button
                            onClick={() => downloadAttachment(attachment)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px 8px",
                              fontSize: "16px",
                              color: "#0c1a4b",
                              display: "flex",
                              alignItems: "center",
                              borderRadius: "4px",
                              transition: "all 0.2s"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#c8e6c9"}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                            title="Download attachment"
                          >
                            <FiDownload />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        

     {/* ===== DISPLAY PO REMARKS IF EXISTS ===== */}
<PORemarkDisplay
  indicatorPath={getIndicatorPath(record, null, index)}
  poRemarks={poRemarks}
/>
     {/* ===== INDICATOR REMARKS TEXTAREA FOR SUB INDICATOR (EDITABLE ONLY IF NOT VERIFIED) ===== */}
{!location.state?.isVerified ? (
  <IndicatorRemark
    tabId={activeTab}
    indicatorPath={getIndicatorPath(record, null, index)}
    placeholder="📝 Add remarks"
  />
) : (
  (() => {
    const remarkValue = lguRemarks[activeTab]?.[getIndicatorPath(record, null, index)] || "";
    if (!remarkValue) return null;
    return (
      <div 
        style={{
          marginTop: "4px",
          padding: "6px 10px",
          backgroundColor: "#e8f5e9",
          borderRadius: "4px",
          borderLeft: "3px solid #006736",
          fontSize: "11px"
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "4px",
          fontWeight: "bold",
          color: "#006736",
          fontSize: "11px"
        }}>
          <span>📝</span>
          <span>MLGO Remark:</span>
        </div>
        <div style={{
          fontStyle: "italic",
          color: "#333",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: "11px",
          lineHeight: "1.4"
        }}>
          {remarkValue}
        </div>
      </div>
    );
  })()
)}
        
        {/* Nested Sub Indicators */}
        {sub.nestedSubIndicators && sub.nestedSubIndicators.length > 0 && (
          <div className="nested-reference-wrapper">
            {sub.nestedSubIndicators.map((nested, nestedIndex) => {
              const nestedRadioKey = getAnswerKey(record, index, nested.title, true, nestedIndex, "radio");
              const baseNestedKey = getAnswerKey(record, index, nested.title, true, nestedIndex);
              const nestedAnswer = lgu.data?.[nestedRadioKey] ?? lgu.data?.[baseNestedKey];
              
              // Try multiple patterns to find attachments for nested indicators
              const attachmentsByIndicator = lgu.attachmentsByIndicator || {};
              
              // Pattern 1: Original format
              const nestedPattern1 = `${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}`;
              // Pattern 2: With underscores
              const nestedPattern2 = `${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title.replace(/\s+/g, '_')}`;
              // Pattern 3: With assessment ID and tab ID
              const nestedPattern3 = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}`;
              // Pattern 4: With assessment ID, tab ID, and underscores
              const nestedPattern4 = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title.replace(/\s+/g, '_')}`;
              
              let nestedAttachments = attachmentsByIndicator[nestedPattern1] || 
                                     attachmentsByIndicator[nestedPattern2] || 
                                     attachmentsByIndicator[nestedPattern3] || 
                                     attachmentsByIndicator[nestedPattern4] || [];
              
              // If not found, search through keys containing the nested pattern
              if (nestedAttachments.length === 0) {
                const searchPattern = `${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_`;
                Object.keys(attachmentsByIndicator).forEach(key => {
                  if (key.includes(searchPattern)) {
                    nestedAttachments = [...nestedAttachments, ...attachmentsByIndicator[key]];
                  }
                });
              }
              
              console.log(`Nested indicator "${nested.title}" - Found ${nestedAttachments.length} attachments`);
              
              return (
                <div key={nested.id || nestedIndex} className="nested-reference-item">
                  <div className="nested-reference-row" style={{ display: "flex", border: "1px solid #cfcfcf" }}>
                    <div className="nested-reference-label" style={{ 
                      width: "45%", 
                      background: "#fff9c4",
                      padding: "5px 10px",
                      fontWeight: 500,
                      borderRight: "1px solid #cfcfcf",
                      fontSize: "12px"
                    }}>
                      {nested.title || 'Untitled'}
                    </div>
                    <div className="nested-reference-field" style={{ 
                      width: "55%", 
                      padding: "4px 10px",
                      background: "#ffffff"
                    }}>
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
                      
                      {(nested.fieldType === "short" || nested.fieldType === "integer" || nested.fieldType === "date") && (
                        <div>
                          {nestedAnswer?.value ? (
                            <span>
                              {nested.fieldType === "integer" 
                                ? new Intl.NumberFormat('en-US').format(parseFloat(nestedAnswer.value))
                                : nested.fieldType === "date" 
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
                  
                  {nested.verification && getVerificationArray(nested.verification).length > 0 && (
                    <div className="reference-verification-full" style={{ width: "100%" }}>
                      <div className="reference-row" style={{ display: "flex", border: "none" }}>
                        <div className="reference-label" style={{
                          width: "45%",
                          background: "transparent",
                          padding: "4px 10px",
                          border: "none",
                          borderRight: "1px solid rgba(8, 26, 75, 0.25)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                          textAlign: "left",
                        }}>
                          <span style={{ display: "inline-block", flexShrink: 0, fontWeight: 700, color: "#081a4b"}}>Mode of Verification</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                            {getVerificationArray(nested.verification).map((v, idx) => (
                              <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                                <span style={{
                                  width: "6px",
                                  height: "6px",
                                  backgroundColor: "black",
                                  borderRadius: "50%",
                                  display: "inline-block",
                                  flexShrink: 0,
                                  marginLeft: "50px"
                                }}></span>
                                <span style={{ fontStyle: "italic", fontSize: "12px" }}>{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div className="reference-field" style={{
                          borderLeft: "1px solid #cfcfcf",
                          width: "55%",
                          padding: "6px 12px",
                          background: "#ffffff",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-end",
                          border: "none",
                          gap: "8px"
                        }}>
                          <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "6px",
                            width: "100%"
                          }}>
                            {nestedAttachments.length > 0 && (
                              <div style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "8px",
                                width: "100%",
                                marginTop: "8px"
                              }}>
                                {nestedAttachments.map((attachment, idx) => (
                                  <div key={idx} style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    backgroundColor: "#e8f5e9",
                                    padding: "4px 8px",
                                    borderRadius: "16px",
                                    fontSize: "11px",
                                    border: "1px solid #c8e6c9",
                                    maxWidth: "900px"
                                  }}>
                                    <span style={{ fontSize: "14px" }}>📎</span>
                                    <span style={{ 
                                      overflow: "hidden", 
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      color: "#0c1a4b",
                                      flex: 1,
                                      maxWidth: "200px"
                                    }}>
                                      {attachment.name || 'Attachment'}
                                    </span>
                                    
                                    <button
                                      onClick={() => viewAttachment(attachment)}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: "4px 8px",
                                        fontSize: "14px",
                                        color: "#0c1a4b",
                                        display: "flex",
                                        alignItems: "center",
                                        borderRadius: "4px",
                                        transition: "all 0.2s"
                                      }}
                                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#c8e6c9"}
                                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                      title="View attachment"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                      </svg>
                                    </button>
                                    
                                    <button
                                      onClick={() => downloadAttachment(attachment)}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: "4px 8px",
                                        fontSize: "16px",
                                        color: "#0c1a4b",
                                        display: "flex",
                                        alignItems: "center",
                                        borderRadius: "4px",
                                        transition: "all 0.2s"
                                      }}
                                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#c8e6c9"}
                                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                                      title="Download attachment"
                                    >
                                      <FiDownload />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  

                {/* ===== DISPLAY PO REMARKS IF EXISTS ===== */}
<PORemarkDisplay
  indicatorPath={getIndicatorPath(record, null, index, nestedIndex)}
  poRemarks={poRemarks}
/>
                            {/* ===== INDICATOR REMARKS TEXTAREA FOR NESTED INDICATOR (EDITABLE ONLY IF NOT VERIFIED) ===== */}
{!location.state?.isVerified ? (
  <IndicatorRemark
    tabId={activeTab}
    indicatorPath={getIndicatorPath(record, null, index, nestedIndex)}
    placeholder="📝 Add remarks"
  />
) : (
  (() => {
    const remarkValue = lguRemarks[activeTab]?.[getIndicatorPath(record, null, index, nestedIndex)] || "";
    if (!remarkValue) return null;
    return (
      <div 
        style={{
          marginTop: "4px",
          padding: "6px 10px",
          backgroundColor: "#e8f5e9",
          borderRadius: "4px",
          borderLeft: "3px solid #006736",
          fontSize: "11px"
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "4px",
          fontWeight: "bold",
          color: "#006736",
          fontSize: "11px"
        }}>
          <span>📝</span>
          <span>MLGO Remark:</span>
        </div>
        <div style={{
          fontStyle: "italic",
          color: "#333",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontSize: "11px",
          lineHeight: "1.4"
        }}>
          {remarkValue}
        </div>
      </div>
    );
  })()
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
                                  No indicators available for this area.
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
  
 

                  {/* Flag as Verified Button - Outside the box */}
<div style={{
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  marginTop: "15px"
}}>
  <div style={{ position: "relative", display: "inline-block" }}>
    <button
      onClick={toggleFlag}
      disabled={location.state?.isVerified === true || isReturnedToLGU === true || isForwarded === true}
      style={{
        backgroundColor: (location.state?.isVerified === true || isReturnedToLGU === true || isForwarded === true) 
          ? (verifiedFlag[activeTab] ? "#8b5a5a" : "#5a7a5a")
          : (verifiedFlag[activeTab] ? "#dc3545" : "#28a745"),
        color: "white",
        border: "none",
        padding: "10px 30px",
        borderRadius: "5px",
        fontSize: "14px",
        cursor: (location.state?.isVerified === true || isReturnedToLGU === true || isForwarded === true) ? "not-allowed" : "pointer",
        fontWeight: "600",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        opacity: (location.state?.isVerified === true || isReturnedToLGU === true || isForwarded === true) ? 0.7 : 1
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
                    <p style={{
                    color: "#666",
                    marginBottom: "20px",
                    marginTop: "-15px",
                    fontWeight: "600"
                  }}>
                    {profileData.municipality}
                  </p>
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
            {/* Attachment Preview Modal */}
  {previewAttachment && (
    <div className="modal-overlay" onClick={closePreview} style={{ 
      zIndex: 2000,
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div 
        className="preview-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: "white",
          padding: "14px",
          borderRadius: "8px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          maxWidth: "90vw",
          maxHeight: "95vh",
          overflow: "hidden",
          minWidth: "1200px",
          display: "flex",
          flexDirection: "column"
        }}
      >
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "15px",
          borderBottom: "1px solid #eee",
          paddingBottom: "5px"
        }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>
            {previewAttachment.name || 'Attachment Preview'}
          </h3>
          <button 
            onClick={closePreview}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              padding: "0 5px"
            }}
          >
            ✕
          </button>
        </div>
        
        <div style={{ 
          marginBottom: "15px",
          flex: 1,
          overflow: "auto",
          minHeight: "300px"
        }}>
          {(() => {
            // Check if it's an image
            let fileUrl = null;
            let fileType = null;
            
            for (const key of Object.keys(previewAttachment)) {
              const value = previewAttachment[key];
              if (typeof value === 'string' && (value.startsWith('data:') || value.startsWith('http'))) {
                fileUrl = value;
                
                // Determine file type from data URL or extension
                if (value.startsWith('data:')) {
                  fileType = value.split(';')[0].split(':')[1];
                } else {
                  const extension = value.split('.').pop()?.toLowerCase();
                  if (extension === 'pdf') fileType = 'application/pdf';
                  else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension)) {
                    fileType = 'image/' + extension;
                  }
                }
                break;
              }
            }
            
            if (fileUrl) {
              // Handle PDF files
              if (fileType === 'application/pdf' || fileUrl.includes('.pdf') || fileUrl.includes('application/pdf')) {
                return (
                  <iframe
                    src={fileUrl}
                    style={{
                      width: "100%",
                      height: "70vh",
                      border: "none"
                    }}
                    title="PDF Preview"
                  />
                );
              }
              // Handle images
              else if (fileType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileUrl)) {
                return (
                  <img 
                    src={fileUrl} 
                    alt={previewAttachment.name || 'Preview'}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "70vh",
                      objectFit: "contain",
                      display: "block",
                      margin: "0 auto"
                    }}
                  />
                );
              }
              // Handle text files
              else if (fileType === 'text/plain' || fileUrl.includes('text/plain')) {
                fetch(fileUrl)
                  .then(response => response.text())
                  .then(text => {
                    document.getElementById('text-preview').innerText = text;
                  })
                  .catch(err => console.error('Error loading text file:', err));
                
                return (
                  <pre 
                    id="text-preview"
                    style={{
                      width: "100%",
                      height: "70vh",
                      overflow: "auto",
                      backgroundColor: "#f5f5f5",
                      padding: "10px",
                      borderRadius: "4px",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      whiteSpace: "pre-wrap",
                      wordWrap: "break-word"
                    }}
                  >
                    Loading...
                  </pre>
                );
              }
              // For other file types, show info and provide download button
              else {
                return (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <div style={{ fontSize: "64px", marginBottom: "20px" }}>📄</div>
                    <p style={{ fontSize: "16px", color: "#666", marginBottom: "10px" }}>
                      This file type cannot be previewed directly.
                    </p>
                    <p style={{ fontSize: "14px", color: "#999", wordBreak: "break-all" }}>
                      {previewAttachment.name || 'Unknown file'}
                    </p>
                    <p style={{ fontSize: "12px", color: "#999", wordBreak: "break-all", marginTop: "10px" }}>
                      Type: {fileType || 'Unknown'}
                    </p>
                  </div>
                );
              }
            }
            
            return (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p>No preview available</p>
              </div>
            );
          })()}
        </div>
        
        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "10px",
          borderTop: "1px solid #eee",
          paddingTop: "15px"
        }}>
          <button
            onClick={closePreview}
            style={{
              padding: "8px 16px",
              backgroundColor: "#990202",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#780101"}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#990202"}
          >
            Close
          </button>
          <button
            onClick={() => {
              downloadAttachment(previewAttachment);
              closePreview();
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#0c1a4b",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 16.5a4.5 4.5 0 0 0-1.3-8.8 6 6 0 0 0-11.6 1.5A4 4 0 0 0 4 16.5" />
              <path d="M12 12v7" />
              <path d="M8.5 15.5 12 19l3.5-3.5" />
            </svg>
            Download
          </button>
        </div>
      </div>
    </div>
  )}
          </div>
        </div>
      </div>
    );
  }