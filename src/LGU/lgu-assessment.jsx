import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import styles from "src/LGU-CSS/lgu-assessment.module.css";
import { useNavigate, useLocation } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiFilter,FiTrash2 , FiRotateCcw, FiSettings, FiLogOut, FiFileText, FiBell} from "react-icons/fi";
import { ref, push, onValue, set, get } from "firebase/database";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function LGU() {
  const navigate = useNavigate();
  const location = useLocation();
  const [adminUid, setAdminUid] = useState(null);
  const [metadata, setMetadata] = useState({});
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [userAnswers, setUserAnswers] = useState({});
  const [profileComplete, setProfileComplete] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const [mlgoRemarks, setMlgoRemarks] = useState({});
  
  // ===== STATE FOR ASSESSMENT SELECTION =====
  const [assessmentList, setAssessmentList] = useState([]);
  const [selectedAssessment, setSelectedAssessment] = useState("");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");
  
  // ===== DYNAMIC TABS STATE =====
  const [tabs, setTabs] = useState([]);
  const [tabData, setTabData] = useState({});
  
  const [lastSavedDraft, setLastSavedDraft] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [savingAnswers, setSavingAnswers] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [selectedYearDisplay, setSelectedYearDisplay] = useState("");

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [search, setSearch] = useState("");
  const user = auth.currentUser;
  const displayName = user?.email || "User";
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [userRole, setUserRole] = useState("user");
  const [attachments, setAttachments] = useState({});
  const [uploadingFile, setUploadingFile] = useState(false);
  
  const municipalities = ["Boac", "Mogpog", "Sta. Cruz", "Torrijos", "Buenavista", "Gasan"];

  // Helper function to sanitize keys
  const sanitizeKey = (key) => {
    return key.replace(/[.#$\[\]/:]/g, '_');
  };

  // ===== HELPER FUNCTIONS =====

  const compressAttachments = (attachments) => {
  if (!attachments || Object.keys(attachments).length === 0) return attachments;
  
  const compressed = {};
  const keyMap = {};
  
  Object.keys(attachments).forEach(longKey => {
    const shortKey = compressKey(longKey);
    keyMap[shortKey] = longKey;
    compressed[shortKey] = attachments[longKey];
  });
  
  // Store the key map for decompression
  compressed.__keyMap = keyMap;
  return compressed;
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

  // Add these helper functions after your sanitizeKey function
const compressKey = (key) => {
  // Simple hash function to create short keys
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return `k${Math.abs(hash).toString(36)}`;
};

const compressAnswers = (answers) => {
  const compressed = {};
  const keyMap = {};
  
  Object.keys(answers).forEach(longKey => {
    const shortKey = compressKey(longKey);
    keyMap[shortKey] = longKey;
    compressed[shortKey] = answers[longKey];
  });
  
  // Store the key map for decompression
  compressed.__keyMap = keyMap;
  return compressed;
};

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

  const getVerificationArray = (verification) => {
    if (!verification) return [];
    if (Array.isArray(verification)) return verification;
    if (typeof verification === 'string') return [verification];
    if (typeof verification === 'object') {
      if (verification.values && Array.isArray(verification.values)) return verification.values;
      if (verification.items && Array.isArray(verification.items)) return verification.items;
      const values = Object.values(verification);
      if (values.length > 0 && values.some(v => typeof v === 'string')) return values;
    }
    return [];
  };

  // Add these functions for viewing and downloading attachments
const [previewAttachment, setPreviewAttachment] = useState(null);

const viewAttachment = (attachment) => {
  console.log('👁️ Viewing attachment:', attachment);
  setPreviewAttachment(attachment);
};

const closePreview = () => {
  setPreviewAttachment(null);
};

const downloadAttachment = (attachment) => {
  console.log('📎 Downloading attachment:', attachment);
  
  try {
    let fileUrl = null;
    let fileName = attachment.fileName || 'download';
    
    // Get the file data from the attachment object
    if (attachment.fileData) {
      fileUrl = attachment.fileData;
    } else if (attachment.url) {
      fileUrl = attachment.url;
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
      alert('No file data available to download.');
    }
  } catch (error) {
    console.error('Download error:', error);
    alert('Failed to download file: ' + error.message);
  }
};



  const getTabNameFromActive = () => {
    const tab = tabs.find(t => t.id === activeTab);
    return tab?.name || "Assessment";
  };

  // Helper function to get category title
  const getCategoryTitle = () => {
    const tab = tabs.find(t => t.id === activeTab);
    return tab?.name || "Assessment";
  };

  // Get current indicators for active tab
  const getCurrentIndicators = () => {
    if (!activeTab) return [];
    return tabData[activeTab] || [];
  };

  const [editProfileData, setEditProfileData] = useState({
    name: "",
    municipality: "",
    email: displayName,
    image: ""
  });

  const [profileData, setProfileData] = useState({
    name: "",
    municipality: "",
    email: displayName,
    image: ""
  });
  
  const [years, setYears] = useState([]);

    // ===== HANDLE NAVIGATION FROM NOTIFICATIONS =====
  useEffect(() => {
    const navigationState = location.state;
    
    if (navigationState && navigationState.fromNotification) {
      console.log("Navigation from notification:", navigationState);
      
      // Set the year if provided
      if (navigationState.year) {
        setSelectedYearDisplay(navigationState.year);
      }
      
      // Set the assessment if provided
      if (navigationState.assessmentId) {
        setSelectedAssessmentId(navigationState.assessmentId);
        // Also find and set the assessment name
        const assessment = assessmentList.find(a => a.id === navigationState.assessmentId);
        if (assessment) {
          setSelectedAssessment(assessment.name);
        }
      }
      
     // No alerts - just log to console if needed
if (navigationState.isReturned && navigationState.mlgoRemarks) {
  console.log("Assessment returned with remarks:", navigationState.mlgoRemarks);
} else if (navigationState.isVerified) {
  console.log("Assessment has been verified!");
} else if (navigationState.isForwarded) {
  console.log("Assessment has been forwarded to PO!");
}
      
      // Clear the state after using it to prevent re-triggering
      window.history.replaceState({}, document.title);
    }
  }, [location.state, assessmentList]);

  // ===== LOAD ASSESSMENTS FROM ADMIN =====
  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchAssessmentsFromAdmin = async () => {
      try {
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);
        
        if (usersSnapshot.exists()) {
          const users = usersSnapshot.val();
          const adminUid = Object.keys(users).find(
            uid => users[uid]?.role === "admin"
          );
          
          if (adminUid) {
            console.log("Found admin UID:", adminUid);
            
            const assessmentsRef = ref(db, `assessments/${adminUid}`);
            
            const unsubscribe = onValue(assessmentsRef, (snapshot) => {
              if (snapshot.exists()) {
                const assessmentsData = snapshot.val();
                const list = [];
                
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
            
            return () => unsubscribe();
          } else {
            console.log("No admin found");
            setAssessmentList([]);
          }
        }
      } catch (error) {
        console.error("Error fetching admin assessments:", error);
      }
    };

    fetchAssessmentsFromAdmin();
  }, [auth.currentUser]);

  // ===== LOAD TABS FOR SELECTED ASSESSMENT =====
  useEffect(() => {
    if (!auth.currentUser || !selectedYearDisplay || !selectedAssessmentId) {
      setTabs([]);
      setActiveTab(null);
      return;
    }

    const fetchTabsFromAdmin = async () => {
      try {
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);
        
        if (usersSnapshot.exists()) {
          const users = usersSnapshot.val();
          const adminUid = Object.keys(users).find(
            uid => users[uid]?.role === "admin"
          );
          
          if (adminUid) {
            console.log("Loading tabs from admin:", adminUid, "for year:", selectedYearDisplay, "assessment:", selectedAssessmentId);

            const tabsRef = ref(
              db,
              `assessment-tabs/${adminUid}/${selectedYearDisplay}/${selectedAssessmentId}`
            );

            const unsubscribe = onValue(tabsRef, (snapshot) => {
              const loadedTabs = [];
              
              if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                  const tab = childSnapshot.val();
                  loadedTabs.push({
                    id: childSnapshot.key,
                    name: tab.name || "Untitled Tab",
                    description: tab.description || "",
                    createdAt: tab.createdAt,
                    order: tab.order || 0,
                    tabPath: childSnapshot.key
                  });
                });
                
                loadedTabs.sort((a, b) => (a.order || 0) - (b.order || 0));
              }

              console.log("Loaded tabs:", loadedTabs);
              setTabs(loadedTabs);

              if (loadedTabs.length > 0) {
                setActiveTab(loadedTabs[0].id);
              }
            });
            
            return () => unsubscribe();
          }
        }
      } catch (error) {
        console.error("Error loading tabs:", error);
      }
    };

    fetchTabsFromAdmin();
  }, [selectedYearDisplay, selectedAssessmentId, auth.currentUser]);

  // ===== LOAD INDICATORS FOR EACH TAB =====
  useEffect(() => {
    if (!auth.currentUser || !selectedYearDisplay || !selectedAssessmentId || !tabs.length) return;

    const loadTabIndicators = async () => {
      try {
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
                  `assessment-data/${adminUid}/${selectedYearDisplay}/${selectedAssessmentId}/${tab.tabPath}/assessment`
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
  }, [tabs, selectedYearDisplay, selectedAssessmentId, auth.currentUser]);

  // Profile useEffect
  useEffect(() => {
    if (!auth.currentUser) return;

    const profileRef = ref(db, `profiles/${auth.currentUser.uid}`);
    const unsubscribe = onValue(profileRef, (snapshot) => {
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
    
    return () => unsubscribe();
  }, []);

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
            if (yearData.LGU && yearData.LGU[userUid]) {
              const yearNotifications = yearData.LGU[userUid];
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

  // Filter assessments based on selected year
  const filteredAssessments = React.useMemo(() => {
    if (!selectedYearDisplay) return [];
    return assessmentList.filter(a => a.year === selectedYearDisplay);
  }, [assessmentList, selectedYearDisplay]);

  // Load user answers
  const loadUserAnswers = async () => {
  if (!auth.currentUser || !selectedYearDisplay || !selectedAssessmentId) return;
  
  try {
    const cleanName = `${auth.currentUser.uid}_${selectedAssessmentId}`;
    
    const usersRef = ref(db, "users");
    const usersSnapshot = await get(usersRef);
    
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      let adminUid = Object.keys(users).find(
        uid => users[uid]?.role === "admin"
      );
      
      if (!adminUid) {
        const financialRootRef = ref(db, "financial");
        const financialRootSnapshot = await get(financialRootRef);
        
        if (financialRootSnapshot.exists()) {
          const financialData = financialRootSnapshot.val();
          adminUid = Object.keys(financialData).find(uid => 
            financialData[uid] && financialData[uid][selectedYearDisplay]
          );
        }
      }
      
      if (adminUid) {
        const answersRef = ref(
          db,
          `answers/${selectedYearDisplay}/LGU/${cleanName}`
        );
        
        const snapshot = await get(answersRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          const { _metadata, ...answers } = data;
          
          console.log("🔍 LGU received metadata:", _metadata);
          
          setMetadata(_metadata || {});
          // Decompress the answers when loading
const decompressedAnswers = decompressAnswers(answers || {});
setUserAnswers(decompressedAnswers);
          
          // CRITICAL: Check if assessment was returned to LGU
          const hasReturnedToLGUFlags = 
            _metadata?.returned === true || 
            _metadata?.returnedToLGU === true;
          
          // Check if assessment is forwarded (locked)
          const hasForwardingFlags = 
            _metadata?.forwardedToPO === true || 
            _metadata?.forwarded === true;
          
          // Check if assessment was returned from PO to MLGO
          const hasReturnedFromPOFlags = 
            _metadata?.returnedToMLGO === true;
          
          console.log("🔍 Flag checks:", {
            submitted: _metadata?.submitted,
            returned: _metadata?.returned,
            returnedToLGU: _metadata?.returnedToLGU,
            hasReturnedToLGUFlags,
            hasForwardingFlags,
            hasReturnedFromPOFlags
          });
          
          if (hasReturnedToLGUFlags) {
            // If returned to LGU, it's NOT submitted and can be edited
            setHasSubmitted(false);
            console.log("📌 Assessment was returned to LGU - CAN EDIT");
          } else if (hasForwardingFlags) {
            // If forwarded, it's submitted and locked
            setHasSubmitted(true);
            console.log("📌 Assessment is forwarded - locked");
          } else if (hasReturnedFromPOFlags) {
            // If returned from PO to MLGO, MLGO needs to review, LGU cannot edit
            setHasSubmitted(true);
            console.log("📌 Assessment returned from PO - locked for LGU");
          } else if (_metadata && _metadata.submitted === true) {
            // Regular submitted flag
            setHasSubmitted(true);
            console.log("📌 Regular submitted - locked");
          } else {
            setHasSubmitted(false);
            console.log("📌 No special flags - draft mode");
          }
          
          // Load MLGO remarks if any
          if (_metadata?.mlgoRemarks) {
            setMlgoRemarks(_metadata.mlgoRemarks);
          } else if (_metadata?.remarks) {
            const singleRemark = _metadata.remarks;
            const remarksObj = {};
            tabs.forEach(tab => {
              remarksObj[tab.id] = singleRemark;
            });
            setMlgoRemarks(remarksObj);
          }
        } else {
          console.log("📌 No answers found, setting hasSubmitted to false");
          setUserAnswers({});
          setMetadata({});
          setHasSubmitted(false);
        }
        
      const attachmentsRef = ref(
  db,
  `attachments/${selectedYearDisplay}/LGU/${cleanName}`
);
const attachmentsSnapshot = await get(attachmentsRef);

if (attachmentsSnapshot.exists()) {
  const decompressedAttachments = decompressAttachments(attachmentsSnapshot.val());
  setAttachments(decompressedAttachments);
} else {
  setAttachments({});
}
      }
    }
  } catch (error) {
    console.error("Error loading answers:", error);
    setHasSubmitted(false);
  }
};

  const getBase64Image = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        resolve(canvas.toDataURL("image/png"));
      };

      img.src = url;
    });
  };

  const exportTabToPDF = async () => {  
    if (!selectedYearDisplay || !selectedAssessmentId || !activeTab) {    
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
      
      const currentTabIndicators = getCurrentIndicators();    
      console.log("Current Tab Indicators:", currentTabIndicators);
      console.log("User Answers:", userAnswers);
      
      const currentTab = tabs.find((t) => t.id === activeTab);    
      const tabName = currentTab?.name || "Assessment";     
      
      const municipality = profileData.municipality || "Not specified";    
      const lguName = profileData.name || auth.currentUser?.email || "LGU";     
      
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
        pageWidth / 2 +52,      
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
      doc.text(`${selectedAssessment || "Local Governance Assessment"} (${selectedYearDisplay})`,
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
  
      doc.setFont("helvetica", "bold");
      doc.text(`${tabName}`, margin.left, infoStartY + 70);     
      
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
          
          // Pattern 4: With value wrapper
          const checkboxKey4 = `${selectedAssessmentId}_${activeTab}_${path}_value_${indicator.title}_${idx}`;
          
          // Check all patterns
          const checkboxAnswer = userAnswers[checkboxKey1] || 
                                userAnswers[checkboxKey2] || 
                                userAnswers[checkboxKey3] || 
                                userAnswers[checkboxKey4];
          
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
            // Check if it's an array of selected indices
            else if (Array.isArray(checkboxAnswer) && checkboxAnswer.includes(idx)) {
              const choiceText = typeof choice === "object"
                ? (choice.label || choice.value || choice.name || "")
                : choice;
              checkedOptions.push(choiceText);
            }
            // Check if it's an object with selected indices
            else if (typeof checkboxAnswer === 'object' && checkboxAnswer.selected && checkboxAnswer.selected.includes(idx)) {
              const choiceText = typeof choice === "object"
                ? (choice.label || choice.value || choice.name || "")
                : choice;
              checkedOptions.push(choiceText);
            }
          }
        });
        
        // Also check for a consolidated answer object
        const consolidatedKey1 = `${selectedAssessmentId}_${activeTab}_${path}_checkbox_${indicator.title}`;
        const consolidatedKey2 = `${selectedAssessmentId}_${activeTab}_${path}_${indicator.title}`;
        
        const consolidatedAnswer = userAnswers[consolidatedKey1] || userAnswers[consolidatedKey2];
        
        if (consolidatedAnswer) {
          console.log(`Found consolidated answer:`, consolidatedAnswer);
          
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
        }
        
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
          const directValue = userAnswers[key];
          if (directValue !== undefined && directValue !== null && typeof directValue !== 'object') {
            console.log(`Found direct value for key: ${key}`, directValue);
            return directValue;
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
      
      const fileName = `${selectedAssessment || "Assessment"}_${tabName}_${municipality}_${selectedYearDisplay}.pdf`      
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
    if (!selectedYearDisplay || !selectedAssessmentId) {
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
      
      const municipality = profileData.municipality || "Not specified";
      const lguName = profileData.name || auth.currentUser?.email || "LGU";
      
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
          
          // Pattern 4: With value wrapper
          const checkboxKey4 = `${selectedAssessmentId}_${tabId}_${path}_value_${indicator.title}_${idx}`;
          
          // Pattern 5: Simplified key
          const checkboxKey5 = `${selectedAssessmentId}_${tabId}_${indicator.title}_${idx}`;
          
          // Check all patterns
          const checkboxAnswer = userAnswers[checkboxKey1] || 
                                userAnswers[checkboxKey2] || 
                                userAnswers[checkboxKey3] || 
                                userAnswers[checkboxKey4] ||
                                userAnswers[checkboxKey5];
          
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
            // Check if it's a string "true"
            else if (checkboxAnswer === "true") {
              const choiceText = typeof choice === "object"
                ? (choice.label || choice.value || choice.name || "")
                : choice;
              checkedOptions.push(choiceText);
            }
            // Check if it's an array of selected indices
            else if (Array.isArray(checkboxAnswer) && checkboxAnswer.includes(idx)) {
              const choiceText = typeof choice === "object"
                ? (choice.label || choice.value || choice.name || "")
                : choice;
              checkedOptions.push(choiceText);
            }
            // Check if it's an object with selected indices
            else if (typeof checkboxAnswer === 'object' && checkboxAnswer.selected && checkboxAnswer.selected.includes(idx)) {
              const choiceText = typeof choice === "object"
                ? (choice.label || choice.value || choice.name || "")
                : choice;
              checkedOptions.push(choiceText);
            }
            // Check if it's an object with values array
            else if (typeof checkboxAnswer === 'object' && checkboxAnswer.values && checkboxAnswer.values.includes(choice)) {
              const choiceText = typeof choice === "object"
                ? (choice.label || choice.value || choice.name || "")
                : choice;
              checkedOptions.push(choiceText);
            }
          }
        });
        
        // Also check for a consolidated answer object
        const consolidatedKey1 = `${selectedAssessmentId}_${tabId}_${path}_checkbox_${indicator.title}`;
        const consolidatedKey2 = `${selectedAssessmentId}_${tabId}_${path}_${indicator.title}`;
        const consolidatedKey3 = `${selectedAssessmentId}_${tabId}_${indicator.title}`;
        
        const consolidatedAnswer = userAnswers[consolidatedKey1] || userAnswers[consolidatedKey2] || userAnswers[consolidatedKey3];
        
        if (consolidatedAnswer) {
          console.log(`Found consolidated answer:`, consolidatedAnswer);
          
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
          // If it's an object with selected indices
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
        }
        
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
          pageWidth / 2 +52,
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
        doc.text(`${selectedAssessment || "Local Governance Assessment"} (${selectedYearDisplay})`,
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
      const fileName = `${selectedAssessment || "Assessment"}_Complete_${municipality}_${selectedYearDisplay}.pdf`
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
      }
    };

    fetchAdminUid();
  }, []);

  // Fetch years
  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchYears = async () => {
      try {
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);
        
        let adminUid = null;
        
        if (usersSnapshot.exists()) {
          const users = usersSnapshot.val();
          adminUid = Object.keys(users).find(
            uid => users[uid]?.role === "admin"
          );
        }
        
        if (adminUid) {
          const yearsRef = ref(db, `years/${adminUid}`);
          
          const unsubscribe = onValue(yearsRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.val();
              let yearsArray = [];
              
              if (Array.isArray(data)) {
                yearsArray = data;
              } else if (typeof data === "object" && data !== null) {
                yearsArray = Object.keys(data);
              }
              
              setYears(yearsArray);
            } else {
              setYears([]);
            }
          });
          
          return () => unsubscribe();
        } else {
          setYears([]);
        }
      } catch (error) {
        console.error("Error fetching years:", error);
        setYears([]);
      }
    };

    fetchYears();
  }, []);

  // Fetch deadline for specific assessment
  useEffect(() => {
    if (!auth.currentUser || !selectedYearDisplay || !selectedAssessmentId) return;

    const fetchDeadline = async () => {
      try {
        const usersRef = ref(db, "users");
        const usersSnapshot = await get(usersRef);
        
        let adminUid = null;
        
        if (usersSnapshot.exists()) {
          const users = usersSnapshot.val();
          adminUid = Object.keys(users).find(
            uid => users[uid]?.role === "admin"
          );
        }
        
        if (adminUid) {
          const deadlineRef = ref(
            db, 
            `financial/${adminUid}/${selectedYearDisplay}/assessments/${selectedAssessmentId}/deadline`
          );
          
          const unsubscribe = onValue(deadlineRef, (snapshot) => {
            if (snapshot.exists()) {
              const deadline = snapshot.val();
              console.log(`Deadline found for assessment ${selectedAssessmentId}:`, deadline);
              setSubmissionDeadline(deadline);
            } else {
              console.log(`No deadline found for assessment ${selectedAssessmentId}`);
              setSubmissionDeadline("");
            }
          });
          
          return () => unsubscribe();
        } else {
          setSubmissionDeadline("");
        }
      } catch (error) {
        console.error("Error fetching deadline:", error);
        setSubmissionDeadline("");
      }
    };

    fetchDeadline();
  }, [selectedYearDisplay, selectedAssessmentId]);

  // Load data when year or assessment changes
  useEffect(() => {
    const loadDataForYearAndAssessment = async () => {
      if (!selectedYearDisplay || !selectedAssessmentId) return;
      
      await loadUserAnswers();
    };
    
    loadDataForYearAndAssessment();
  }, [selectedYearDisplay, selectedAssessmentId]);

  // Clear assessment selection when year changes
  useEffect(() => {
    if (selectedYearDisplay) {
      if (selectedAssessment && selectedAssessmentId) {
        const selectedAssessmentObj = assessmentList.find(
          a => a.id === selectedAssessmentId && a.year === selectedYearDisplay
        );
        if (!selectedAssessmentObj) {
          setSelectedAssessment("");
          setSelectedAssessmentId("");
        }
      }
    } else {
      setSelectedAssessment("");
      setSelectedAssessmentId("");
      setTabs([]);
      setActiveTab(null);
    }
  }, [selectedYearDisplay, assessmentList, selectedAssessment, selectedAssessmentId]);
const handleAnswerChange = (indicatorKey, path, field, value) => {
  if (hasSubmitted || metadata?.forwardedToPO) return;
  
  // Sanitize the field name
  const sanitizedField = sanitizeKey(field);
  
  // CRITICAL FIX: Don't duplicate the indicatorKey
  // The 'path' parameter should already be the full unique path
  // Don't add indicatorKey again if it's already in the path
  let fullPath = path;
  
  // Check if path already contains indicatorKey
  if (!path.startsWith(indicatorKey)) {
    fullPath = `${indicatorKey}_${path}`;
  }
  
  // Build the key using the full path
  const key = `${selectedAssessmentId}_${activeTab}_${fullPath}_${sanitizedField}`;
  
  console.log(`Saving text field - Path: ${fullPath}, Field: ${field}, Value: ${value}, Key: ${key}`);
  
  setUserAnswers(prev => ({
    ...prev,
    [key]: {
      assessmentId: selectedAssessmentId,
      tabId: activeTab,
      indicatorKey,
      path: fullPath,
      field,
      value,
      timestamp: Date.now()
    }
  }));
};
const handleRadioChange = (indicatorKey, path, field, value) => {
  if (hasSubmitted || metadata?.forwardedToPO) return;

  console.log("Radio clicked - Setting value:", { indicatorKey, path, field, value });

  const sanitizedField = sanitizeKey(field);
  
  // Build the full path without duplication
  let fullPath = path;
  if (!path.startsWith(indicatorKey)) {
    fullPath = `${indicatorKey}_${path}`;
  }
  
  const key = `${selectedAssessmentId}_${activeTab}_${fullPath}_radio_${sanitizedField}`;

  setUserAnswers(prev => {
    const newAnswers = {
      ...prev,
      [key]: {
        assessmentId: selectedAssessmentId,
        tabId: activeTab,
        indicatorKey,
        path: fullPath,
        field,
        value,
        timestamp: Date.now()
      }
    };
    console.log("Updated userAnswers:", newAnswers);
    return newAnswers;
  });
};
 
const handleCheckboxChange = (indicatorKey, path, field, checked) => {
  if (hasSubmitted || metadata?.forwardedToPO) return;

  // Sanitize the field name
  const sanitizedField = sanitizeKey(field);
  
  // ALWAYS add indicatorKey prefix to ensure consistent keys
  let fullPath;
  if (path.startsWith(indicatorKey)) {
    fullPath = path;
  } else {
    fullPath = `${indicatorKey}_${path}`;
  }
  
  const key = `${selectedAssessmentId}_${activeTab}_${fullPath}_checkbox_${sanitizedField}`;
  
  console.log("Saving checkbox:", { indicatorKey, path, fullPath, key, checked });

  setUserAnswers(prev => ({
    ...prev,
    [key]: {
      assessmentId: selectedAssessmentId,
      tabId: activeTab,
      indicatorKey,
      path: fullPath,
      field: sanitizedField,
      value: checked === true,
      timestamp: Date.now()
    }
  }));
};

 const handleSaveAnswers = async () => {
  const hasForwardingFlags = 
    metadata?.forwardedToPO === true || 
    metadata?.forwarded === true ||
    metadata?.forwardedAt || 
    metadata?.forwardedBy ||
    metadata?.forwardedTo;
  
  if (hasForwardingFlags) {
    alert("This assessment has been forwarded and cannot be edited or submitted.");
    return;
  }
  
  if (!auth.currentUser || !selectedYearDisplay || !selectedAssessmentId) return;
  
  setSavingAnswers(true);

  try {
    const cleanName = `${auth.currentUser.uid}_${selectedAssessmentId}`;
    
    const usersRef = ref(db, "users");
    const usersSnapshot = await get(usersRef);
    
    if (usersSnapshot.exists()) {
      const users = usersSnapshot.val();
      let adminUid = Object.keys(users).find(
        uid => users[uid]?.role === "admin"
      );
      
      if (!adminUid) {
        const financialRootRef = ref(db, "financial");
        const financialRootSnapshot = await get(financialRootRef);
        
        if (financialRootSnapshot.exists()) {
          const financialData = financialRootSnapshot.val();
          adminUid = Object.keys(financialData).find(uid => 
            financialData[uid] && financialData[uid][selectedYearDisplay]
          );
        }
      }
      
      if (adminUid) {
        const answersRef = ref(
          db,
          `answers/${selectedYearDisplay}/LGU/${cleanName}`
        );

        const existingSnapshot = await get(answersRef);
        const existingData = existingSnapshot.exists() ? existingSnapshot.val() : {};
        const existingMetadata = existingData._metadata || {};

        const newMetadata = {
          ...existingMetadata,
          
          // Override with current user info and assessment data
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          name: profileData.name || auth.currentUser.email,
          municipality: profileData.municipality,
          assessmentId: selectedAssessmentId,
          assessment: selectedAssessment,
          assessmentName: selectedAssessment,
          lastSaved: Date.now(),
          submitted: true,
          year: selectedYearDisplay,
          displayName: `${profileData.name || auth.currentUser.email} - ${selectedAssessment}`,
          deadline: submissionDeadline,
          
          // Clear return flags
          returned: false,
          returnedToLGU: false,
          returnedToMLGO: false,
          returnedAt: null,
          returnedBy: null,
          returnedByName: null,
          
          // PRESERVE remarks (don't delete them)
          mlgoRemarks: existingMetadata?.mlgoRemarks || null,
          poRemarks: existingMetadata?.poRemarks || null,
          remarks: existingMetadata?.remarks || null,
          
          // Clear forwarding flags
          forwarded: false,
          forwardedToPO: false,
          forwardedAt: null,
          forwardedBy: null,
          forwardedTo: null
        };

      // Compress the answers before saving
const compressedAnswers = compressAnswers(userAnswers);

const answerData = {
  ...compressedAnswers, // Use compressed version
  _metadata: newMetadata
};

        await set(answersRef, answerData);
        
     if (Object.keys(attachments).length > 0) {
  const compressedAttachments = compressAttachments(attachments);
  const attachmentsRef = ref(
    db,
    `attachments/${selectedYearDisplay}/LGU/${cleanName}`
  );
  await set(attachmentsRef, compressedAttachments);
}
        
        const userMunicipality = profileData.municipality;
        
        const allUsersRef = ref(db, "users");
        const allUsersSnapshot = await get(allUsersRef);
        let mlgoUid = null;
        
        if (allUsersSnapshot.exists()) {
          const allUsers = allUsersSnapshot.val();
          
          for (const [uid, userData] of Object.entries(allUsers)) {
            if (userData.role === "sub-admin") {
              const profileRef = ref(db, `profiles/${uid}`);
              const profileSnapshot = await get(profileRef);
              
              if (profileSnapshot.exists()) {
                const profile = profileSnapshot.val();
                if (profile.municipality === userMunicipality) {
                  mlgoUid = uid;
                  break;
                }
              }
            }
          }
        }
        
        if (mlgoUid) {
          // Check if this is a first submission or a resubmission
          const isResubmission = existingSnapshot.exists() && 
                                 (existingMetadata?.returned === true || 
                                  existingMetadata?.returnedToLGU === true ||
                                  existingMetadata?.returnedAt !== null);
          
          const notificationTitle = isResubmission
            ? `Assessment "${selectedAssessment}" (${selectedYearDisplay}) has been resubmitted by ${profileData.name || auth.currentUser.email} (${profileData.municipality})`
            : `Assessment "${selectedAssessment}" (${selectedYearDisplay}) has been submitted by ${profileData.name || auth.currentUser.email} (${profileData.municipality})`;
          
          const notificationMessage = isResubmission
            ? `The assessment has been resubmitted after revision. Please review and forward to PO if complete.`
            : `The assessment has been submitted for validation. Please review and forward to PO if complete.`;
          
    const notificationData = {
  id: Date.now().toString(),
  type: isResubmission ? "assessment_resubmitted" : "assessment_submitted",
  title: notificationTitle,
  message: notificationMessage,
  from: auth.currentUser?.email,
  fromName: profileData.name || auth.currentUser?.email,
  fromMunicipality: profileData.municipality || userMunicipality,
  timestamp: Date.now(),
  read: false,
  year: selectedYearDisplay,
  assessmentId: selectedAssessmentId,
  assessment: selectedAssessment,
  municipality: profileData.municipality,
  lguName: profileData.name || auth.currentUser?.email,
  lguUid: auth.currentUser.uid,  // ← ADD THIS LINE - the LGU's UID
  action: "view_assessment"
};
          
          // Save to the correct path
          const notificationRef = ref(db, `notifications/${selectedYearDisplay}/MLGO/${mlgoUid}/${notificationData.id}`);
          await set(notificationRef, notificationData);
          console.log(`✅ Notification sent to MLGO: ${mlgoUid}`);
          console.log(`✅ Notification path: notifications/${selectedYearDisplay}/MLGO/${mlgoUid}/${notificationData.id}`);
          console.log(`✅ Notification data:`, notificationData);
        }
        
        setHasSubmitted(true);
        setMetadata(newMetadata);
        alert("All sections submitted successfully!");
      }
    }
  } catch (error) {
    console.error("Error submitting answers:", error);
    alert("Failed to submit answers: " + error.message);
  } finally {
    setSavingAnswers(false);
  }
};

const handleFileUpload = async (indicatorKey, mainIndex, field, file) => {
  if (!file) return;
  
  setUploadingFile(true);
  
  try {
    const reader = new FileReader();
    reader.onloadend = () => {
      // Change this line - use sanitizeKey instead of sanitizeFieldNameForAttachment
      const sanitizedField = sanitizeKey(field);
      const sanitizedIndicatorKey = sanitizeKey(indicatorKey);
      const sanitizedMainIndex = sanitizeKey(String(mainIndex));
      
      const tabId = activeTab;
      
      console.log("=== UPLOADING ATTACHMENT ===");
      console.log("activeTab (tab ID):", activeTab);
      console.log("indicatorKey (record key):", indicatorKey);
      console.log("mainIndex:", mainIndex);
      console.log("field (original):", field);
      console.log("field (sanitized):", sanitizedField);
      
      // Generate unique key for attachment - THIS MUST MATCH MLGO'S EXPECTED FORMAT
      let uniqueKey = `${selectedAssessmentId}_${tabId}_${sanitizedIndicatorKey}_${sanitizedMainIndex}_${sanitizedField}_${Date.now()}`;
      
      console.log("Generated uniqueKey:", uniqueKey);
      
      const attachmentData = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: reader.result,
        uploadedAt: Date.now(),
        indicatorKey: sanitizedIndicatorKey,
        mainIndex: sanitizedMainIndex,
        field: sanitizedField,
        tabId: tabId,
        assessmentId: selectedAssessmentId
      };
      
      setAttachments(prev => ({
        ...prev,
        [uniqueKey]: attachmentData
      }));
      
      alert(`File "${file.name}" attached successfully!`);
      setUploadingFile(false);
    };
    
    reader.readAsDataURL(file);
  } catch (error) {
    console.error("Error uploading file:", error);
    alert("Failed to upload file");
    setUploadingFile(false);
  }
};

  const triggerFileUpload = (indicatorKey, mainIndex, field) => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png';
    fileInput.onchange = (e) => {
      if (e.target.files[0]) {
        handleFileUpload(indicatorKey, mainIndex, field, e.target.files[0]);
      }
    };
    fileInput.click();
  };

  const removeAttachment = (attachmentKey) => {
    if (window.confirm("Remove this attachment?")) {
      setAttachments(prev => {
        const newAttachments = { ...prev };
        delete newAttachments[attachmentKey];
        return newAttachments;
      });
    }
  };

  // Draft functions
 const handleSaveDraft = async () => {
  if (!auth.currentUser || !selectedYearDisplay || !selectedAssessmentId) return;
  
  setSavingAnswers(true);
  
  try {
    const cleanName = `${auth.currentUser.uid}_${selectedAssessmentId}`;
    
    const draftRef = ref(
      db,
      `drafts/${selectedYearDisplay}/LGU/${cleanName}`
    );
    
    // Compress the answers before saving
    const compressedAnswers = compressAnswers(userAnswers);
    
 const compressedAttachments = compressAttachments(attachments);

const draftData = {
  answers: compressedAnswers, // Save compressed version
  attachments: compressedAttachments, // Save compressed attachments
  year: selectedYearDisplay,
  assessmentId: selectedAssessmentId,
  assessment: selectedAssessment,
  userId: auth.currentUser.uid,
  userName: profileData.name || auth.currentUser.email,
  lastUpdated: Date.now(),
  isDraft: true
};
    
    await set(draftRef, draftData);
    
    const now = new Date();
    const formattedDateTime = now.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    setLastSavedDraft(formattedDateTime);
    alert("Draft saved successfully!");
  } catch (error) {
    console.error("Error saving draft:", error);
    alert("Failed to save draft: " + error.message);
  } finally {
    setSavingAnswers(false);
  }
};

 const loadDraft = async () => {
  if (!auth.currentUser || !selectedYearDisplay || !selectedAssessmentId) return;
  
  try {
    const cleanName = `${auth.currentUser.uid}_${selectedAssessmentId}`;
    
    const draftRef = ref(
      db,
      `drafts/${selectedYearDisplay}/LGU/${cleanName}`
    );
    const snapshot = await get(draftRef);
    
   if (snapshot.exists()) {
  const draftData = snapshot.val();
  // Decompress the answers when loading
  const decompressedAnswers = decompressAnswers(draftData.answers || {});
  setUserAnswers(decompressedAnswers);
  if (draftData.attachments) {
    const decompressedAttachments = decompressAttachments(draftData.attachments);
    setAttachments(decompressedAttachments);
  }
      const formattedDateTime = new Date(draftData.lastUpdated).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      setLastSavedDraft(formattedDateTime);
    }
  } catch (error) {
    console.error("Error loading draft:", error);
  }
};
  
 const clearDraft = async () => {
  if (!auth.currentUser || !selectedYearDisplay || !selectedAssessmentId) return;
  
  try {
    const cleanName = `${auth.currentUser.uid}_${selectedAssessmentId}`;
    
    const draftRef = ref(
      db,
      `drafts/${selectedYearDisplay}/LGU/${cleanName}`
    );
    await set(draftRef, null);
  } catch (error) {
    console.error("Error clearing draft:", error);
  }
};

  const handleSignOut = () => {
    const confirmLogout = window.confirm("Are you sure you want to sign out?");
    if (confirmLogout) {
      navigate("/login");
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

  const currentIndicators = getCurrentIndicators();
  const categoryTitle = getCategoryTitle();

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
                <h3 style={{textAlign: "center", lineHeight: "1.1", marginLeft: "-20%",}}>STRATEGIC UNIT FOR <br />KEY{" "} <span className="yellow">ASS</span><span className="cyan">ESS</span>
                <span className="red">MENT</span>  <span className="white">AND</span> TRACKING</h3>
                <div className="sidebar-divider"></div>
              </>
            )}
          </div>

          {sidebarOpen && (
            <>
              {openDropdown && (
                <div
                  className="dropdown-overlay"
                  onClick={() => setOpenDropdown(null)}
                ></div>
              )}
              <div className={styles.sidebarMenu}>
                <button
                  className={`${styles.sidebarMenuItem} ${styles.active}`}
                  onClick={() => navigate("/lgu-assessment")}
                >
                  <ClipboardCheck size={20} />
                  Assessment
                </button>

                <button
                  className={styles.sidebarMenuItem}
                  onClick={() => navigate("/lgu-notification")}
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
                  <FiBell style={{ marginRight: "1px", fontSize: "18px", marginLeft: "5px", }} />
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
              </div>

              <div className={styles.sidebarBottom}>
                <button 
                  className={`${styles.sidebarBtn} ${styles.signoutBtn}`} 
                  onClick={handleSignOut}
                >
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
            <div className="topbarLeft">
              <div className="topbarLeft">
                <h2>Provincial Assessment {selectedYearDisplay && (
                  <span style={{ fontSize: "24px", fontWeight: "bold", color: "#000000" }}>
                    {selectedYearDisplay}
                  </span>
                )}
                </h2>
              </div>
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
          <div className={styles.assessmentContainer}>
            <div className={styles.assessmentHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
                {/* Year Selector */}
                <select
                  className={styles.yearSelect}
                  value={selectedYearDisplay}
                  onChange={(e) => {
                    const year = e.target.value;
                    setSelectedYearDisplay(year);
                  }}
                >
                  <option value="">Select Year</option>
                  {years.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>

                {/* Assessment Selector */}
                <select
                  className={styles.yearSelect}
                  value={selectedAssessmentId}
                  onChange={(e) => {
                    const assessmentId = e.target.value;
                    const assessment = filteredAssessments.find(a => a.id === assessmentId);
                    setSelectedAssessmentId(assessmentId);
                    setSelectedAssessment(assessment?.name || "");
                  }}
                  disabled={!selectedYearDisplay}
                  style={{
                    opacity: !selectedYearDisplay ? 0.5 : 1,
                    cursor: !selectedYearDisplay ? "not-allowed" : "pointer"
                  }}
                >
                  <option value="">Select Assessment</option>
                  {filteredAssessments.map((assessment) => (
                    <option key={assessment.id} value={assessment.id}>
                      {assessment.name}
                    </option>
                  ))}
                </select>

                <div className={styles.deadlineDisplay} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 15px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                  border: "1px solid #ddd"
                }}>
                  <span style={{ fontWeight: "600", color: "#333", fontSize: "14px" }}>
                    Submission Deadline:
                  </span>
                  <span style={{ color: "#840000", fontWeight: "500", fontSize: "14px" }}>
                    {submissionDeadline ? new Date(submissionDeadline).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : "Not set"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div>
{hasSubmitted ? (
  <div style={{
    backgroundColor: metadata?.forwardedToPO ? "#00470c" : (metadata?.verified ? "#28a745" : "#4CAF50"),
    color: "white",
    padding: "8px 20px",
    borderRadius: "5px",
    fontSize: "14px",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    whiteSpace: "nowrap"
  }}>
    ✓ {metadata?.forwardedToPO ? "Forwarded to PO" : (metadata?.verified ? "Assessment Verified" : "All Sections Submitted")}
  </div>
) : (
                    <button
                      onClick={handleSaveAnswers}
                      disabled={savingAnswers || !selectedYearDisplay || !selectedAssessmentId}
                      style={{
                        backgroundColor: (savingAnswers || !selectedYearDisplay || !selectedAssessmentId) 
                          ? "#cccccc" 
                          : "#1b6e3a",
                        color: "white",
                        border: "none",
                        padding: "8px 20px",
                        borderRadius: "5px",
                        fontSize: "14px",
                        cursor: (savingAnswers  || !selectedYearDisplay || !selectedAssessmentId) 
                          ? "not-allowed" 
                          : "pointer",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        opacity: (savingAnswers  || !selectedYearDisplay || !selectedAssessmentId) 
                          ? 0.7 
                          : 1,
                        whiteSpace: "nowrap"
                      }}
                    >
                      {savingAnswers ? "Submitting..." : "Submit Assessment"}
                    </button>
                  )}
                </div>

                <div className={styles.exportDropdownContainer}>
                  <button 
                    className={styles.exportBtn} 
                    onClick={() => setShowExportModal(!showExportModal)}
                  >
                    ☰ EXPORT MENU
                  </button>
                  
                  {showExportModal && (
                    <div className={styles.exportDropdown}>
                      <div 
                        className={styles.exportDropdownItem}
                        onClick={() => {
                          exportTabToPDF(); // Export current tab/area only
                          setShowExportModal(false);
                        }}
                      >
                        <div className={styles.pdfIcon}></div>
                        <h4>Export {activeTab ? tabs.find(t => t.id === activeTab)?.name : "Current"}</h4>
                      </div>
                      
                      <div 
                        className={styles.exportDropdownItem}
                        onClick={() => {
                          exportAllTabsToPDF(); // Export all tabs/areas
                          setShowExportModal(false);
                        }}
                      >
                        <div className={styles.pdfIcon}></div>
                        <h4>Export All</h4>
                        <p style={{ fontSize: "11px", color: "#666", margin: "2px 0 0 0" }}>
                          All {tabs.length} areas
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Dynamic Tabs - based on what PO created */}
            <div className={styles.assessmentTabs}>
              {tabs.length > 0 ? (
                tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={activeTab === tab.id ? styles.activeTab : ''}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.name}
                  </button>
                ))
              ) : (
                selectedYearDisplay && selectedAssessmentId ? (
                  <div style={{ padding: "10px", color: "#999", fontStyle: "italic" }}>
                    No tabs available for this assessment. Please wait for the PO to create tabs.
                  </div>
                ) : null
              )}
            </div>

            {/* Form Section */}
            <div className={styles.lgutableBox}>
              <div className={styles.scrollableContent}
                style={{ 
                  maxHeight: sidebarOpen ? 'calc(100vh - 210px)' : 'calc(100vh - 200px)',
                }}
              >
                
       {/* MLGO Remarks Section - Compact */}
{hasSubmitted === false && (metadata?.returned || Object.keys(mlgoRemarks).length > 0) && (
  <div style={{
    backgroundColor: "#e9e9e9",
    borderRadius: "6px",
    padding: "8px 12px",
    marginBottom: "15px",
    color: "#000000",
    width: "100%",
    display: "flex",
    alignItems: "flex-start",
    gap: "10px"
  }}>
    <span style={{ fontSize: "16px", flexShrink: 0 }}>📝</span>
    <div style={{ flex: 1 }}>
      <strong style={{ fontSize: "13px" }}>Remarks from MLGOO:</strong>
      <div style={{ 
        fontSize: "12px",
        marginTop: "2px",
        wordBreak: "break-word"
      }}>
        {mlgoRemarks && typeof mlgoRemarks === 'object' && activeTab ? (
          mlgoRemarks[activeTab] ? (
            mlgoRemarks[activeTab]
          ) : (
            <span style={{ fontStyle: "italic", color: "#999" }}>No specific remark for this tab</span>
          )
        ) : mlgoRemarks && typeof mlgoRemarks === 'string' ? (
          mlgoRemarks
        ) : (
          <span style={{ fontStyle: "italic", color: "#999" }}>No specific remark for this tab</span>
        )}
      </div>
    </div>
  </div>
)}

                {currentIndicators.length === 0 ? (
                  <p style={{ textAlign: "center", marginTop: "20px" }}>
                    {selectedYearDisplay && selectedAssessmentId 
                      ? `No indicators added yet for ${getCategoryTitle()} in ${selectedYearDisplay}.`
                      : "Please select a year and assessment to view indicators."}
                  </p>
                ) : (
                  <>
                               {currentIndicators.map((record, recordIndex) => (
                      <div 
                        key={record.firebaseKey} 
                        className="reference-wrapper"
                        style={{ 
                          marginBottom: recordIndex !== currentIndicators.length - 1 ? "40px" : "0",
                          borderBottom: recordIndex !== currentIndicators.length - 1 ? "2px solid #ccc" : "none",
                          paddingBottom: recordIndex !== currentIndicators.length - 1 ? "20px" : "0"
                        }}
                      >
                        
                        {/* Main Indicators */}
                        {record.mainIndicators?.map((main, index) => {
                      // Get the appropriate answer based on field type - USING FULL PATH
let answer = null;
const fullPath = `${record.firebaseKey}_${index}`;

if (main.fieldType === "multiple") {
  // For radio buttons, look for radio_ prefixed key with full path
  const radioAnswerKey = `${selectedAssessmentId}_${activeTab}_${fullPath}_radio_${main.title}`;
  answer = userAnswers[radioAnswerKey];
} else {
  // For text, number, date, checkbox - look for direct key with full path
  const answerKey = `${selectedAssessmentId}_${activeTab}_${fullPath}_${main.title}`;
  answer = userAnswers[answerKey];
}
                          
                          return (
                                                  <div key={index} className="reference-wrapper"
                            style={{
                              marginBottom: "15px"
                            }}>
                              {/* Indicator Row */}
                        <div className="reference-row" style={{
  display: "flex",
  border: "1px solid #cfcfcf",
}}>
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
                                  {main.fieldType === "multiple" &&
  main.choices.map((choice, i) => {
    const choiceLabel =
      choice && typeof choice === "object"
        ? (choice.label ?? choice.value ?? choice.name ?? choice.title ?? choice.text ?? "")
        : choice;
    const choiceValueRaw =
      choice && typeof choice === "object"
        ? (choice.value ?? choice.label ?? choice.name ?? choice.title ?? choice.text ?? "")
        : choice;
    const choiceIndexValue = String(i);
    
    // Get the saved answer value
  const sanitizedTitle = sanitizeKey(main.title);
const savedAnswer = userAnswers[`${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_radio_${sanitizedTitle}`];
    const savedValue = savedAnswer?.value ?? "";
    
    // Check if this option is selected
    const isSelected = savedValue === choiceIndexValue;
    
    // Create a consistent radio group name
    const radioGroupName = `radio_${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_main_${index}`;
    const radioId = `${radioGroupName}_${i}`;
    
    return (
      <div 
        key={i} 
        style={{ 
          marginBottom: "8px",
          display: "flex",
          alignItems: "center"
        }}
      >
        <input 
          type="radio" 
          id={radioId}
          name={radioGroupName}
          value={choiceIndexValue}
          checked={isSelected}
        onChange={(e) => {
  e.stopPropagation();
  handleRadioChange(
    record.firebaseKey,
    `${index}`,  // ✅ Convert to string
    sanitizeKey(main.title),  // ✅ Sanitize
    e.target.value
  );
}}
          onClick={(e) => e.stopPropagation()}
          disabled={hasSubmitted || metadata?.forwardedToPO}
          style={{
            margin: "0 8px 0 0",
            cursor: "pointer",
            width: "auto",
            height: "auto"
          }}
        /> 
        <label 
          htmlFor={radioId}
          style={{ 
            marginLeft: "0px", 
            cursor: "pointer",
            userSelect: "none"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {choiceLabel || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
        </label>
      </div>
    );
  })}

                                    {main.fieldType === "checkbox" &&
                                      main.choices.map((choice, i) => {
                                       // Build the full path for main indicator checkbox
const sanitizedTitle = sanitizeKey(main.title);
const checkboxKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_checkbox_${sanitizedTitle}_${i}`;
const isChecked = userAnswers[checkboxKey]?.value === true;
                                        return (
                                          <div key={i} style={{ marginBottom: "4px" }}>
                                            <input 
                                              type="checkbox" 
                                              checked={isChecked}
                                            onChange={(e) => handleCheckboxChange(
  record.firebaseKey,
  `${index}`,  // ← FIXED: string
  `${sanitizeKey(main.title)}_${i}`,
  e.target.checked
)}
                                              disabled={hasSubmitted || metadata?.forwardedToPO}
                                            /> 
                                            <span style={{ marginLeft: "4px" }}>
                                              {choice || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
                                            </span>
                                          </div>
                                        );
                                      })}

       {main.fieldType === "short" && (() => {
  const sanitizedTitle = sanitizeKey(main.title);
  const answerKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_${sanitizedTitle}`;
  return (
    <input
      type="text"
      style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
      placeholder="Enter your answer..."
      value={userAnswers[answerKey]?.value || ""}
      onChange={(e) => handleAnswerChange(
        record.firebaseKey,
        `${index}`,
        sanitizedTitle,
        e.target.value
      )}
      disabled={hasSubmitted || metadata?.forwardedToPO}
    />
  );
})()}

                            {main.fieldType === "integer" && (() => {
  const sanitizedTitle = sanitizeKey(main.title);
  const answerKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_${sanitizedTitle}`;
  return (
    <input
      type="number"
      step="any"
      style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
      placeholder="Enter a number..."
      value={userAnswers[answerKey]?.value || ""}
      onChange={(e) => handleAnswerChange(
        record.firebaseKey,
        `${index}`,
        sanitizedTitle,
        e.target.value
      )}
      disabled={hasSubmitted || metadata?.forwardedToPO}
    />
  );
})()}

                             {main.fieldType === "date" && (
  <input
    type="date"
    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
    value={(() => {
      const fullPath = `${record.firebaseKey}_${index}`;
      const answerKey = `${selectedAssessmentId}_${activeTab}_${fullPath}_${main.title}`;
      const answer = userAnswers[answerKey];
      return answer?.value || "";
    })()}
    onChange={(e) => handleAnswerChange(
      record.firebaseKey,
      `${index}`,
      main.title,
      e.target.value
    )}
    disabled={hasSubmitted || metadata?.forwardedToPO}
  />
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
                                      padding: "6px 12px",
                                      border: "none",
                                      borderRight: "1px solid rgba(8, 26, 75, 0.25)",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "4px",
                                      textAlign: "left",
                                    }}>
                                      <span style={{ display: "inline-block", flexShrink: 0, fontWeight: 700, color: "#081a4b" }}>
                                        Mode of Verification
                                      </span>
                                      <div style={{ 
                                        display: "flex", 
                                        flexDirection: "column", 
                                        gap: "4px",
                                        width: "100%"
                                      }}>
                                        {getVerificationArray(main.verification).map((v, idx) => (
                                          <div key={idx} style={{ 
                                            display: "flex", 
                                            alignItems: "center", 
                                            gap: "8px",
                                            width: "100%"
                                          }}>
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
                                      width: "55%",
                                      padding: "6px 12px",
                                      background: "#ffffff",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "flex-end",
                                      border: "none",
                                      gap: "8px"
                                    }}>
                                      <div style={{ display: "flex", gap: "8px" }}>
                                        {!hasSubmitted && (
                                          <button
                                            onClick={() => triggerFileUpload(record.firebaseKey, index, main.title)}
                                            disabled={uploadingFile}
                                            style={{
                                              backgroundColor: "#840000",
                                              color: "white",
                                              border: "none",
                                              padding: "4px 10px",
                                              borderRadius: "4px",
                                              fontSize: "11px",
                                              cursor: uploadingFile ? "not-allowed" : "pointer",
                                              fontWeight: "600",
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "4px",
                                              opacity: uploadingFile ? 0.6 : 1,
                                              whiteSpace: "nowrap"
                                            }}
                                          >
                                            {uploadingFile ? "⏳" : "+"} {uploadingFile ? "Uploading..." : "Add Attachment"}
                                          </button>
                                        )}
                                        
                                        {hasSubmitted && (
                                          <span style={{
                                            backgroundColor: "#4CAF50",
                                            color: "white",
                                            padding: "4px 10px",
                                            borderRadius: "4px",
                                            fontSize: "11px",
                                            fontWeight: "600",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            whiteSpace: "nowrap"
                                          }}>
                                            ✓ Submitted
                                          </span>
                                        )}
                                      </div>

<div style={{
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  width: "100%"
}}>
  {Object.entries(attachments)
    .filter(([key, value]) => {
      const sanitizedField = sanitizeKey(main.title);
      const expectedPrefix = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_${sanitizedField}`;
      return key.startsWith(expectedPrefix);
    })
    .map(([key, attachment]) => (
      <div key={key} style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "6px",
        backgroundColor: "#e8f5e9",
        padding: "6px 12px",
        borderRadius: "4px",
        fontSize: "11px",
        border: "1px solid #c8e6c9",
        width: "100%"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
          <span style={{ fontSize: "12px", flexShrink: 0 }}>📎</span>
          <span style={{ 
            overflow: "hidden", 
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
            {attachment.fileName}
          </span>
        </div>
        
        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
          {/* View Button */}
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
          
          {/* Download Button */}
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          
          {/* Remove Button (only if not submitted) */}
          {!hasSubmitted && (
            <button
              onClick={() => removeAttachment(key)}
              style={{
                background: "none",
                border: "none",
                color: "#000000",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
                padding: "0 4px",
                flexShrink: 0
              }}
              title="Remove attachment"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    ))}
</div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Sub Indicators */}
                        {record.subIndicators?.map((sub, index) => {
              // Get the appropriate answer based on field type - USING FULL PATH
let answer = null;
const fullPath = `${record.firebaseKey}_sub_${index}`;

if (sub.fieldType === "multiple") {
  // For radio buttons, look for radio_ prefixed key with full path
  const radioAnswerKey = `${selectedAssessmentId}_${activeTab}_${fullPath}_radio_${sub.title}`;
  answer = userAnswers[radioAnswerKey];
} else {
  // For text, number, date, checkbox - look for direct key with full path
  const answerKey = `${selectedAssessmentId}_${activeTab}_${fullPath}_${sub.title}`;
  answer = userAnswers[answerKey];
}
                          
                          return (
                                                   <div key={index} className="reference-wrapper"
                            style={{
                              marginBottom: "20px"
                            }}>
                            
                              {/* Sub Indicator Row */}
                         <div className="reference-row sub-row" style={{
  display: "flex",
  marginTop: "3px",

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
                             {sub.fieldType === "multiple" &&
  sub.choices.map((choice, i) => {
    const choiceLabel =
      choice && typeof choice === "object"
        ? (choice.label ?? choice.value ?? choice.name ?? choice.title ?? choice.text ?? "")
        : choice;
    const choiceValueRaw =
      choice && typeof choice === "object"
        ? (choice.value ?? choice.label ?? choice.name ?? choice.title ?? choice.text ?? "")
        : choice;
    const choiceIndexValue = String(i);
    
 // Get the saved answer value using full path for sub indicator
const fullPath = `${record.firebaseKey}_sub_${index}`;
const savedAnswer = userAnswers[`${selectedAssessmentId}_${activeTab}_${fullPath}_radio_${sub.title}`];
const savedValue = savedAnswer?.value ?? "";
    
    // Check if this option is selected
    const isSelected = savedValue === choiceIndexValue;
    
    // Create a consistent radio group name
    const radioGroupName = `radio_${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}`;
    const radioId = `${radioGroupName}_${i}`;
    
    return (
      <div 
        key={i} 
        style={{ 
          marginBottom: "8px",
          display: "flex",
          alignItems: "center"
        }}
      >
        <input 
          type="radio" 
          id={radioId}
          name={radioGroupName}
          value={choiceIndexValue}
          checked={isSelected}
onChange={(e) => {
  e.stopPropagation();
  handleRadioChange(
    record.firebaseKey,
    `sub_${index}`,
    sanitizeKey(sub.title),  // ✅ FIXED: use sub.title
    e.target.value
  );
}}
          onClick={(e) => e.stopPropagation()}
          disabled={hasSubmitted || metadata?.forwardedToPO}
          style={{
            margin: "0 8px 0 0",
            cursor: "pointer",
            width: "auto",
            height: "auto"
          }}
        /> 
        <label 
          htmlFor={radioId}
          style={{ 
            marginLeft: "0px", 
            cursor: "pointer",
            userSelect: "none"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {choiceLabel || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
        </label>
      </div>
    );
  })}

               {sub.fieldType === "checkbox" &&
  sub.choices.map((choice, i) => {
    const sanitizedTitle = sanitizeKey(sub.title);
    const checkboxKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_checkbox_${sanitizedTitle}_${i}`;
    const isChecked = userAnswers[checkboxKey]?.value === true;
    return (
      <div key={i} style={{ marginBottom: "4px" }}>
        <input 
          type="checkbox" 
          checked={isChecked}
          onChange={(e) => handleCheckboxChange(
            record.firebaseKey,
            `sub_${index}`,  // ← Following Main pattern: use the path as string
            `${sanitizeKey(sub.title)}_${i}`,
            e.target.checked
          )}
          disabled={hasSubmitted || metadata?.forwardedToPO}
        /> 
        <span style={{ marginLeft: "4px" }}>
          {choice || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
        </span>
      </div>
    );
  })
}
                              {sub.fieldType === "short" && (
  <input
    type="text"
    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
    placeholder="Enter your answer..."
    value={(() => {
      const fullPath = `${record.firebaseKey}_sub_${index}`;
      const answerKey = `${selectedAssessmentId}_${activeTab}_${fullPath}_${sub.title}`;
      const answer = userAnswers[answerKey];
      return answer?.value || "";
    })()}
    onChange={(e) => handleAnswerChange(
      record.firebaseKey,
      `sub_${index}`,
      sub.title,
      e.target.value
    )}
    disabled={hasSubmitted || metadata?.forwardedToPO}
  />
)}

                           {sub.fieldType === "integer" && (
  <input
    type="number"
    step="any"
    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
    placeholder="Enter a number..."
    value={(() => {
      const fullPath = `${record.firebaseKey}_sub_${index}`;
      const answerKey = `${selectedAssessmentId}_${activeTab}_${fullPath}_${sub.title}`;
      const answer = userAnswers[answerKey];
      return answer?.value || "";
    })()}
    onChange={(e) => handleAnswerChange(
      record.firebaseKey,
      `sub_${index}`,
      sub.title,
      e.target.value
    )}
    disabled={hasSubmitted || metadata?.forwardedToPO}
  />
)}

                                 {sub.fieldType === "date" && (
  <input
    type="date"
    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
    value={(() => {
      const fullPath = `${record.firebaseKey}_sub_${index}`;
      const answerKey = `${selectedAssessmentId}_${activeTab}_${fullPath}_${sub.title}`;
      const answer = userAnswers[answerKey];
      return answer?.value || "";
    })()}
    onChange={(e) => handleAnswerChange(
      record.firebaseKey,
      `sub_${index}`,
      sub.title,
      e.target.value
    )}
    disabled={hasSubmitted || metadata?.forwardedToPO}
  />
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
                                      borderRight: "1px solid rgba(8, 26, 75, 0.25)",
                                      padding: "6px 12px",
                                      border: "none",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "4px",
                                      textAlign: "left",
                                    }}>
                                      <span style={{ display: "inline-block", flexShrink: 0, fontWeight: 700, color: "#081a4b" }}>
                                        Mode of Verification
                                      </span>
                                      <div style={{ 
                                        display: "flex", 
                                        flexDirection: "column", 
                                        gap: "4px",
                                        width: "100%"
                                      }}>
                                        {getVerificationArray(sub.verification).map((v, idx) => (
                                          <div key={idx} style={{ 
                                            display: "flex", 
                                            alignItems: "center", 
                                            gap: "8px",
                                            width: "100%"
                                          }}>
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
                                      width: "55%",
                                      padding: "6px 12px",
                                      background: "#ffffff",
                                      display: "flex",
                                      flexDirection: "column",
                                      alignItems: "flex-end",
                                      border: "none",
                                      gap: "8px"
                                    }}>
                                      <div style={{ display: "flex", gap: "8px" }}>
                                        {!hasSubmitted && (
                                          <button
                                            onClick={() => triggerFileUpload(record.firebaseKey, `sub_${index}`, sub.title)}
                                            disabled={uploadingFile}
                                            style={{
                                              backgroundColor: "#840000",
                                              color: "white",
                                              border: "none",
                                              padding: "4px 10px",
                                              borderRadius: "4px",
                                              fontSize: "11px",
                                              cursor: uploadingFile ? "not-allowed" : "pointer",
                                              fontWeight: "600",
                                              display: "flex",
                                              alignItems: "center",
                                              gap: "4px",
                                              opacity: uploadingFile ? 0.6 : 1,
                                              whiteSpace: "nowrap"
                                            }}
                                          >
                                            {uploadingFile ? "⏳" : "+"} {uploadingFile ? "Uploading..." : "Add Attachment"}
                                          </button>
                                        )}
                                        
                                        {hasSubmitted && (
                                          <span style={{
                                            backgroundColor: "#4CAF50",
                                            color: "white",
                                            padding: "4px 10px",
                                            borderRadius: "4px",
                                            fontSize: "11px",
                                            fontWeight: "600",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            whiteSpace: "nowrap"
                                          }}>
                                            ✓ Submitted
                                          </span>
                                        )}
                                      </div>

                                  <div style={{
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  width: "100%"
}}>
  {Object.entries(attachments)
    .filter(([key, value]) => {
      const sanitizedField = sanitizeKey(sub.title);
      const expectedPrefix = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_${sanitizedField}`;
      return key.startsWith(expectedPrefix);
    })
    .map(([key, attachment]) => (
      <div key={key} style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "6px",
        backgroundColor: "#e8f5e9",
        padding: "6px 12px",
        borderRadius: "4px",
        fontSize: "11px",
        border: "1px solid #c8e6c9",
        width: "100%"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
          <span style={{ fontSize: "12px", flexShrink: 0 }}>📎</span>
          <span style={{ 
            overflow: "hidden", 
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
            {attachment.fileName}
          </span>
        </div>
        
        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
          {/* View Button */}
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
          
          {/* Download Button */}
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          
          {/* Remove Button (only if not submitted) */}
          {!hasSubmitted && (
            <button
              onClick={() => removeAttachment(key)}
              style={{
                background: "none",
                border: "none",
                color: "#000000",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
                padding: "0 4px",
                flexShrink: 0
              }}
              title="Remove attachment"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    ))}
</div>
                                    </div>
                                  </div>
                                </div>
                              )}


                              {/* Nested Sub-Indicators */}
                              {sub.nestedSubIndicators && sub.nestedSubIndicators.length > 0 && (
                                <div className="nested-reference-wrapper" style={{ marginLeft: "30px", marginTop: "10px", marginBottom: "25px"}}>
                                  {sub.nestedSubIndicators.map((nested, nestedIndex) => {
                              // Get the appropriate answer based on field type
let nestedAnswer = null;
if (nested.fieldType === "multiple") {
  // For radio buttons, look for radio_ prefixed key
  const nestedRadioAnswerKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_radio_${nested.title}`;
  nestedAnswer = userAnswers[nestedRadioAnswerKey];
} else {
  // For text, number, date, checkbox - look for direct key
  const nestedAnswerKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}`;
  nestedAnswer = userAnswers[nestedAnswerKey];
}
                                    
                                    return (
                                      <div key={nested.id || nestedIndex} className="nested-reference-item" style={{ marginBottom: "5px" }}>
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
                                            {/* Nested Multiple Choice */}
                                            {nested.fieldType === "multiple" && nested.choices?.map((choice, i) => {
  const choiceLabel =
    choice && typeof choice === "object"
      ? (choice.label ?? choice.value ?? choice.name ?? choice.title ?? choice.text ?? "")
      : choice;
  const choiceValueRaw =
    choice && typeof choice === "object"
      ? (choice.value ?? choice.label ?? choice.name ?? choice.title ?? choice.text ?? "")
      : choice;
  const choiceIndexValue = String(i);
  
  // Get the saved answer value
  const savedAnswer = userAnswers[`${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_radio_${nested.title}`];
  const savedValue = savedAnswer?.value ?? "";
  
  // Check if this option is selected
  const isSelected = savedValue === choiceIndexValue;
  
  // Create a consistent radio group name
  const radioGroupName = `radio_${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_nested_${index}_${nestedIndex}`;
  const radioId = `${radioGroupName}_${i}`;
  
  return (
    <div 
      key={i} 
      style={{ 
        marginBottom: "8px",
        display: "flex",
        alignItems: "center"
      }}
    >
      <input 
        type="radio" 
        id={radioId}
        name={radioGroupName}
        value={choiceIndexValue}
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          handleRadioChange(
            record.firebaseKey,
            `sub_${index}_nested_${nestedIndex}`,
            nested.title,
            e.target.value
          );
        }}
        onClick={(e) => e.stopPropagation()}
        disabled={hasSubmitted || metadata?.forwardedToPO}
        style={{
          margin: "0 8px 0 0",
          cursor: "pointer",
          width: "auto",
          height: "auto"
        }}
      /> 
      <label 
        htmlFor={radioId}
        style={{ 
          marginLeft: "0px", 
          cursor: "pointer",
          userSelect: "none"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {choiceLabel}
      </label>
    </div>
  );
})}

                                            {/* Nested Checkbox */}
                                      {nested.fieldType === "checkbox" && nested.choices?.map((choice, i) => {
  const sanitizedTitle = sanitizeKey(nested.title);
  const checkboxKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_checkbox_${sanitizedTitle}_${i}`;
  const isChecked = userAnswers[checkboxKey]?.value === true;
  return (
    <div key={i} style={{ marginBottom: "4px" }}>
      <input 
        type="checkbox" 
        checked={isChecked}
        onChange={(e) => handleCheckboxChange(
          record.firebaseKey,
          `sub_${index}_nested_${nestedIndex}`,  // ← Following Main pattern: use the path as string
          `${sanitizeKey(nested.title)}_${i}`,
          e.target.checked
        )}
        disabled={hasSubmitted || metadata?.forwardedToPO}
      /> 
      <span style={{ marginLeft: "4px" }}>{choice}</span>
    </div>
  );
})}

                                            {/* Nested Short Answer */}
                                           {nested.fieldType === "short" && (
  <input
    type="text"
    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
    placeholder="Enter your answer..."
    value={(() => {
      const fullPath = `${record.firebaseKey}_sub_${index}_nested_${nestedIndex}`;
      const answerKey = `${selectedAssessmentId}_${activeTab}_${fullPath}_${nested.title}`;
      const answer = userAnswers[answerKey];
      return answer?.value || "";
    })()}
    onChange={(e) => handleAnswerChange(
      record.firebaseKey,
      `sub_${index}_nested_${nestedIndex}`,
      nested.title,
      e.target.value
    )}
    disabled={hasSubmitted || metadata?.forwardedToPO}
  />
)}

                                       {nested.fieldType === "integer" && (
  <input
    type="number"
    step="any"
    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
    placeholder="Enter a number..."
    value={(() => {
      const fullPath = `${record.firebaseKey}_sub_${index}_nested_${nestedIndex}`;
      const answerKey = `${selectedAssessmentId}_${activeTab}_${fullPath}_${nested.title}`;
      const answer = userAnswers[answerKey];
      return answer?.value || "";
    })()}
    onChange={(e) => handleAnswerChange(
      record.firebaseKey,
      `sub_${index}_nested_${nestedIndex}`,
      nested.title,
      e.target.value
    )}
    disabled={hasSubmitted || metadata?.forwardedToPO}
  />
)}

                                            {/* Nested Date */}
                                     {nested.fieldType === "date" && (
  <input
    type="date"
    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
    value={(() => {
      const fullPath = `${record.firebaseKey}_sub_${index}_nested_${nestedIndex}`;
      const answerKey = `${selectedAssessmentId}_${activeTab}_${fullPath}_${nested.title}`;
      const answer = userAnswers[answerKey];
      return answer?.value || "";
    })()}
    onChange={(e) => handleAnswerChange(
      record.firebaseKey,
      `sub_${index}_nested_${nestedIndex}`,
      nested.title,
      e.target.value
    )}
    disabled={hasSubmitted || metadata?.forwardedToPO}
  />
)}

                                            {/* No field type selected */}
                                            {!nested.fieldType && (
                                              <span style={{ fontStyle: "italic", color: "gray" }}>
                                                No field type selected
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        {/* Mode of Verification for nested indicators */}
                                        {nested.verification && getVerificationArray(nested.verification).length > 0 && (
                                      <div className="reference-verification-full" style={{ width: "100%", marginLeft: "0" }}>
  <div className="reference-row" style={{ display: "flex", border: "none", width: "100%" }}>
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
      <span style={{ display: "inline-block", flexShrink: 0, fontWeight: 700, color: "#081a4b" }}>
        Mode of Verification
      </span>
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        gap: "4px",
        width: "100%"
      }}>
        {getVerificationArray(nested.verification).map((v, idx) => (
          <div key={idx} style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            width: "100%"
          }}>
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
  width: "55%",
  padding: "6px 12px",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  border: "none",
  gap: "8px"
}}>
  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
    {!hasSubmitted && (
      <button
        onClick={() => triggerFileUpload(record.firebaseKey, `sub_${index}_nested_${nestedIndex}`, nested.title)}
        disabled={uploadingFile}
        style={{
          backgroundColor: "#840000",
          color: "white",
          border: "none",
          padding: "4px 10px",
          borderRadius: "4px",
          fontSize: "11px",
          cursor: uploadingFile ? "not-allowed" : "pointer",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          opacity: uploadingFile ? 0.6 : 1,
          whiteSpace: "nowrap"
        }}
      >
        {uploadingFile ? "⏳" : "+"} {uploadingFile ? "Uploading..." : "Add Attachment"}
      </button>
    )}
    
    {hasSubmitted && (
      <span style={{
        backgroundColor: "#4CAF50",
        color: "white",
        padding: "4px 10px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: "600",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        whiteSpace: "nowrap"
      }}>
        ✓ Submitted
      </span>
    )}
  </div>
<div style={{
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  width: "100%"
}}>
  {Object.entries(attachments)
    .filter(([key, value]) => {
      const sanitizedField = sanitizeKey(nested.title);
      const expectedPrefix = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${sanitizedField}`;
      return key.startsWith(expectedPrefix);
    })
    .map(([key, attachment]) => (
      <div key={key} style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "6px",
        backgroundColor: "#e8f5e9",
        padding: "6px 12px",
        borderRadius: "4px",
        fontSize: "11px",
        border: "1px solid #c8e6c9",
        width: "100%"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
          <span style={{ fontSize: "12px", flexShrink: 0 }}>📎</span>
          <span style={{ 
            overflow: "hidden", 
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}>
            {attachment.fileName}
          </span>
        </div>
        
        <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          
          {!hasSubmitted && (
            <button
              onClick={() => removeAttachment(key)}
              style={{
                background: "none",
                border: "none",
                color: "#000000",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "bold",
                padding: "0 4px",
                flexShrink: 0
              }}
              title="Remove attachment"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    ))}
</div>
    </div>
  </div>
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
                    ))}

                    {/* Draft and Submit Buttons */}
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      marginTop: "20px",
                      padding: "8px 20px",
                      backgroundColor: "#ffffff",
                      borderRadius: "8px",
                      marginBottom: "-0.8%"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                        {!hasSubmitted && (
                          <>
                            <button
                              onClick={handleSaveDraft}
                              disabled={currentIndicators.length === 0}
                              style={{
                                backgroundColor: "#ffc107",
                                color: "#020202",
                                border: "none",
                                padding: "8px 30px",
                                borderRadius: "5px",
                                fontSize: "14px",
                                cursor: currentIndicators.length === 0 ? "not-allowed" : "pointer",
                                fontWeight: "700",
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                                opacity: currentIndicators.length === 0 ? 0.5 : 1
                              }}
                            >
                              Draft
                            </button>
                            
                            {lastSavedDraft && (
                              <span style={{ 
                                backgroundColor: "#fff3cd", 
                                color: "#ac8510",
                                padding: "4px 12px",
                                borderRadius: "20px",
                                fontSize: "12px",
                                fontWeight: "600",
                                border: "1px solid #ffeeba"
                              }}>
                                DRAFT SAVED
                              </span>
                            )}
                            
                            {lastSavedDraft && (
                              <span style={{ fontSize: "12px", color: "#666" }}>
                                Last saved: {lastSavedDraft}
                              </span>
                            )}
                          </>
                        )}
{/* Removed - status is now shown in the button above */}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modals */}
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
        minWidth: "600px",
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
          {previewAttachment.fileName || 'Attachment Preview'}
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
          let fileUrl = previewAttachment.fileData || previewAttachment.url;
          let fileType = previewAttachment.fileType || '';
          
          if (fileUrl) {
            // Handle PDF files
            if (fileType === 'application/pdf' || (fileUrl.includes('application/pdf') || fileUrl.includes('.pdf'))) {
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
                  alt={previewAttachment.fileName || 'Preview'}
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
            // For other file types
            else {
              return (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: "64px", marginBottom: "20px" }}>📄</div>
                  <p style={{ fontSize: "16px", color: "#666", marginBottom: "10px" }}>
                    This file type cannot be previewed directly.
                  </p>
                  <p style={{ fontSize: "14px", color: "#999", wordBreak: "break-all" }}>
                    {previewAttachment.fileName || 'Unknown file'}
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
            cursor: "pointer"
          }}
        >
          Close
        </button>
        <button
          onClick={() => {
            downloadAttachment(previewAttachment);
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
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </button>
      </div>
    </div>
  </div>
)}
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
                <p className={styles.profileMunicipality}>{profileData.municipality}</p>
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
  );
}
