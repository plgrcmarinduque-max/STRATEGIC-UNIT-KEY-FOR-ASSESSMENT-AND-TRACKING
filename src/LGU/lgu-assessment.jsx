import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import styles from "src/LGU-CSS/lgu-assessment.module.css";
import { ClipboardCheck } from "lucide-react";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiFilter,FiTrash2 , FiRotateCcw, FiSettings, FiLogOut, FiFileText, FiBell} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { ref, push, onValue, set, get } from "firebase/database";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function LGU() {
  const [remarks, setRemarks] = useState(null);
  const navigate = useNavigate();
  const [adminUid, setAdminUid] = useState(null);
  const [metadata, setMetadata] = useState({});
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [userAnswers, setUserAnswers] = useState({});
  const [profileComplete, setProfileComplete] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
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
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const user = auth.currentUser;
  const displayName = user?.email || "User";
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [userRole, setUserRole] = useState("user");
  const [attachments, setAttachments] = useState({});
  const [uploadingFile, setUploadingFile] = useState(false);
  const municipalities = ["Boac", "Mogpog", "Sta. Cruz", "Torrijos", "Buenavista", "Gasan"];

  // Helper function to get tab name from active tab ID
  const getTabNameFromActive = () => {
    const tab = tabs.find(t => t.id === activeTab);
    return tab?.name || "Assessment";
  };

  // Map active tab ID to display name for backward compatibility
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
  const [data, setData] = useState([]);
  const [years, setYears] = useState([]);
  const [newRecord, setNewRecord] = useState({
    year: "",
    municipality: ""
  });

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
            
            onValue(assessmentsRef, (snapshot) => {
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

            onValue(tabsRef, (snapshot) => {
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


  
  // Load remarks from Firebase
  const loadRemarks = async () => {
    if (!auth.currentUser || !selectedYearDisplay) return;
    
    try {
      const userName = profileData.name || auth.currentUser.email || "Anonymous";
      const cleanName = userName.replace(/[.#$\[\]]/g, '_');
      
      const remarksRef = ref(db, `remarks/${selectedYearDisplay}/LGU/${cleanName}`);
      const snapshot = await get(remarksRef);
      
      if (snapshot.exists()) {
        setRemarks(snapshot.val());
      } else {
        setRemarks(null);
      }
    } catch (error) {
      console.error("Error loading remarks:", error);
    }
  };

  const sanitizeKey = (key) => {
    return key.replace(/[.#$\[\]/:]/g, '_');
  };

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


// In lgu-assessment.jsx - Update the loadUserAnswers function with better debugging

const loadUserAnswers = async () => {
  if (!auth.currentUser || !selectedYearDisplay || !selectedAssessmentId) return;
  
  try {
    const userName = profileData.name || auth.currentUser.email || "Anonymous";
    const cleanName = `${userName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
    
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
        
// In lgu-assessment.jsx - Make sure this logic is correct

if (snapshot.exists()) {
  const data = snapshot.val();
  const { _metadata, ...answers } = data;
  
  console.log("🔍 LGU received metadata:", _metadata);
  
  setMetadata(_metadata || {});
  setUserAnswers(answers || {});
  
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
}else {
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
          setAttachments(attachmentsSnapshot.val());
        } else {
          setAttachments({});
        }
        
        await loadRemarks();
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

    doc.setFont("helvetica", "normal");
    doc.text(`${tabName}`, margin.left+40, infoStartY + 70);     
    
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
        left: margin.left -30,        
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
          left: margin.left -30,
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
            } else {
              setYears([]);
            }
          });
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

  // Fetch deadline
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
        // Update to assessment-specific path
        const deadlineRef = ref(
          db, 
          `financial/${adminUid}/${selectedYearDisplay}/assessments/${selectedAssessmentId}/deadline`
        );
        
        onValue(deadlineRef, (snapshot) => {
          if (snapshot.exists()) {
            const deadline = snapshot.val();
            console.log(`Deadline found for assessment ${selectedAssessmentId}:`, deadline);
            setSubmissionDeadline(deadline);
          } else {
            console.log(`No deadline found for assessment ${selectedAssessmentId}`);
            setSubmissionDeadline("");
          }
        });
      } else {
        setSubmissionDeadline("");
      }
    } catch (error) {
      console.error("Error fetching deadline:", error);
      setSubmissionDeadline("");
    }
  };

  fetchDeadline();
}, [selectedYearDisplay, selectedAssessmentId, db]); // Added selectedAssessmentId as dependency

  // Load data when year or assessment changes
  useEffect(() => {
    const loadDataForYearAndAssessment = async () => {
      if (!selectedYearDisplay || !selectedAssessmentId) return;
      
      await loadUserAnswers();
      
      setTimeout(() => {
        if (!hasSubmitted) {
          loadDraft();
        }
      }, 100);
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
  }, [selectedYearDisplay, assessmentList]);

  const handleAnswerChange = (indicatorKey, mainIndex, field, value) => {
    if (hasSubmitted || metadata?.forwardedToPO) return;
    
    // Sanitize the field name
    const sanitizedField = sanitizeKey(field);
    
    setUserAnswers(prev => ({
      ...prev,
      [`${selectedAssessmentId}_${activeTab}_${indicatorKey}_${mainIndex}_${sanitizedField}`]: {
        assessmentId: selectedAssessmentId,
        tabId: activeTab,
        indicatorKey,
        mainIndex,
        field,
        value,
        timestamp: Date.now()
      }
    }));
  };

  const handleRadioChange = (indicatorKey, mainIndex, field, value) => {
    if (hasSubmitted || metadata?.forwardedToPO) return;
  
    // Sanitize the field name
    const sanitizedField = sanitizeKey(field);
  
    setUserAnswers(prev => ({
      ...prev,
      [`${selectedAssessmentId}_${activeTab}_${indicatorKey}_${mainIndex}_radio_${sanitizedField}`]: {
        assessmentId: selectedAssessmentId,
        tabId: activeTab,
        indicatorKey,
        mainIndex,
        field,
        value,
        timestamp: Date.now()
      }
    }));
  };
  
  const handleCheckboxChange = (indicatorKey, mainIndex, field, checked) => {
    if (hasSubmitted || metadata?.forwardedToPO) return;
  
    // Sanitize the field name
    const sanitizedField = sanitizeKey(field);
  
    setUserAnswers(prev => ({
      ...prev,
      [`${selectedAssessmentId}_${activeTab}_${indicatorKey}_${mainIndex}_checkbox_${sanitizedField}`]: {
        assessmentId: selectedAssessmentId,
        tabId: activeTab,
        indicatorKey,
        mainIndex,
        field,
        value: checked === true,
        timestamp: Date.now()
      }
    }));
  };

// In lgu-assessment.jsx - Update handleSaveAnswers function

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
    const userName = profileData.name || auth.currentUser.email || "Anonymous";
    const cleanName = `${userName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
    
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

        // FIXED: No duplicate keys - spread existing then override only what's needed
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
          
          // CRITICAL: Clear ALL return flags when resubmitting
          returned: false,
          returnedToLGU: false,
          returnedToMLGO: false,
          returnedAt: null,
          returnedBy: null,
          returnedByName: null,
          mlgoRemarks: null,
          poRemarks: null,
          remarks: null,
          
          // Keep forwarding flags as false
          forwarded: false,
          forwardedToPO: false,
          forwardedAt: null,
          forwardedBy: null,
          forwardedTo: null
        };

        const answerData = {
          ...userAnswers,
          _metadata: newMetadata
        };

        await set(answersRef, answerData);
        
        if (Object.keys(attachments).length > 0) {
          const attachmentsRef = ref(
            db,
            `attachments/${selectedYearDisplay}/LGU/${cleanName}`
          );
          await set(attachmentsRef, attachments);
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
          const notificationRef = ref(db, `notifications/${selectedYearDisplay}/MLGO/${mlgoUid}`);
          const notificationId = Date.now().toString();
          const notificationData = {
            id: notificationId,
            type: "assessment_submitted",
            title: `Assessment "${selectedAssessment}" (${selectedYearDisplay}) has been resubmitted by LGU.`,
            message: `Assessment from ${profileData.name || auth.currentUser.email} has been resubmitted.`,
            from: auth.currentUser?.email,
            fromName: profileData.name || auth.currentUser?.email,
            fromMunicipality: userMunicipality,
            timestamp: Date.now(),
            read: false,
            year: selectedYearDisplay,
            assessmentId: selectedAssessmentId,
            assessment: selectedAssessment,
            municipality: userMunicipality,
            action: "view_assessment"
          };
          
          await set(ref(db, `notifications/${selectedYearDisplay}/MLGO/${mlgoUid}/${notificationId}`), notificationData);
        }
        
        setHasSubmitted(true);
        setMetadata(newMetadata);
        clearDraft();
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

  // Export PDF functions (keep your existing ones)
  const exportFinancialPDF = async () => {
    // ... keep your existing export function
  };

  const exportAllAreasPDF = async () => {
    // ... keep your existing export function
  };

  const handleFileUpload = async (indicatorKey, mainIndex, field, file) => {
    if (!file) return;
    
    setUploadingFile(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const sanitizedField = sanitizeKey(field);
        const sanitizedIndicatorKey = sanitizeKey(indicatorKey);
        const sanitizedMainIndex = sanitizeKey(String(mainIndex));
        
        // Use activeTab directly - this should be the tab ID
        const tabId = activeTab;
        
        console.log("=== UPLOADING ATTACHMENT ===");
        console.log("activeTab (tab ID):", activeTab);
        console.log("indicatorKey (record key):", indicatorKey);
        console.log("mainIndex:", mainIndex);
        console.log("field:", field);
        
        const uniqueKey = `${selectedAssessmentId}_${tabId}_${sanitizedIndicatorKey}_${sanitizedMainIndex}_${sanitizedField}_${Date.now()}`;
        
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

  const [tabDrafts, setTabDrafts] = useState({}); 
  const [lastSavedTabDraft, setLastSavedTabDraft] = useState({});
  const [activeTabDraft, setActiveTabDraft] = useState(null); 
  // Draft functions
  const handleSaveDraft = async () => {
    if (!auth.currentUser || !selectedYearDisplay || !selectedAssessmentId) return;
    
    setSavingAnswers(true);
    
    try {
      const userName = profileData.name || auth.currentUser.email || "Anonymous";
      const cleanName = `${userName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
      
      const draftRef = ref(
        db,
        `drafts/${selectedYearDisplay}/LGU/${cleanName}`
      );
      
      const draftData = {
        answers: userAnswers,
        attachments: attachments,
        year: selectedYearDisplay,
        assessmentId: selectedAssessmentId,
        assessment: selectedAssessment,
        userId: auth.currentUser.uid,
        userName: userName,
        lastUpdated: Date.now(),
        isDraft: true
      };
      
      await set(draftRef, draftData);
      
      setIsDraft(true);
      setLastSavedDraft(new Date().toLocaleTimeString());
      alert("Draft saved to database successfully!");
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
      const userName = profileData.name || auth.currentUser.email || "Anonymous";
      const cleanName = `${userName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
      
      const draftRef = ref(
        db,
        `drafts/${selectedYearDisplay}/LGU/${cleanName}`
      );
      const snapshot = await get(draftRef);
      
      if (snapshot.exists()) {
        const draftData = snapshot.val();
        setUserAnswers(draftData.answers || {});
        if (draftData.attachments) {
          setAttachments(draftData.attachments);
        }
        setIsDraft(true);
        setLastSavedDraft(new Date(draftData.lastUpdated).toLocaleTimeString());
      } else {
        setIsDraft(false);
      }
    } catch (error) {
      console.error("Error loading draft:", error);
    }
  };
  
  const clearDraft = async () => {
    if (!auth.currentUser || !selectedYearDisplay || !selectedAssessmentId) return;
    
    try {
      const userName = profileData.name || auth.currentUser.email || "Anonymous";
      const cleanName = `${userName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
      
      const draftRef = ref(
        db,
        `drafts/${selectedYearDisplay}/LGU/${cleanName}`
      );
      await set(draftRef, null);
      setIsDraft(false);
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
                <h3 style={{textAlign: "center", lineHeight: "1.1", marginLeft: "-20%",}}>TRATEGIC UNIT KEY <br />FOR{" "} <span className="yellow">ASS</span><span className="cyan">ESS</span>
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
                      backgroundColor: metadata?.forwardedToPO ? "#6c757d" : "#4CAF50",
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
                      ✓ {metadata?.forwardedToPO ? "Forwarded to PO (Locked)" : "All Sections Submitted"}
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
                
                {/* MLGO Remarks Section */}
                {hasSubmitted === false && (metadata?.returned || Object.keys(mlgoRemarks).length > 0) && (
                  <div style={{
                    backgroundColor: "#fff3cd",
                    border: "1px solid #ffeeba",
                    borderRadius: "8px",
                    padding: "20px",
                    marginBottom: "25px",
                    color: "#856404",
                    width: "100%"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "15px" }}>
                      <span style={{ fontSize: "20px" }}>📝</span>
                      <strong style={{ fontSize: "16px" }}>Remarks from MLGO:</strong>
                    </div>
                    
                    <div style={{
                      backgroundColor: "white",
                      border: "1px solid #ffeeba",
                      borderRadius: "8px",
                      padding: "15px",
                      marginBottom: "15px"
                    }}>
                      <div style={{ fontWeight: "600", marginBottom: "8px", color: "#856404" }}>
                        For {getTabNameFromActive()}:
                      </div>
                      <div style={{ 
                        fontSize: "14px",
                        lineHeight: "1.5",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word"
                      }}>
                        {mlgoRemarks && typeof mlgoRemarks === 'object' && activeTab ? (
                          mlgoRemarks[activeTab] ? (
                            mlgoRemarks[activeTab]
                          ) : (
                            <span style={{ fontStyle: "italic", color: "#999" }}>
                              No specific remark for this tab
                            </span>
                          )
                        ) : mlgoRemarks && typeof mlgoRemarks === 'string' ? (
                          mlgoRemarks
                        ) : (
                          <span style={{ fontStyle: "italic", color: "#999" }}>
                            No specific remark for this tab
                          </span>
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
                    {currentIndicators.map((record) => (
                      <div key={record.firebaseKey} className="reference-wrapper">
                        
                        {/* Main Indicators */}
                        {record.mainIndicators?.map((main, index) => {
                          const legacyAnswerKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_${main.title}`;
                          const radioAnswerKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_radio_${main.title}`;
                          const answer = userAnswers[radioAnswerKey] ?? userAnswers[legacyAnswerKey];
                          
                          return (
                            <div key={index} className="reference-wrapper"
                            style={{
                              marginBottom: "-10px"
                            }}>
                              {/* Indicator Row */}
                              <div className="reference-row" style={{
                                display: "flex",
                                border: "1px solid #cfcfcf",
                              }}>
                                <div className="reference-label" style={{
                                  width: "45%",
                                  background: "#e6f0fa",
                                  padding: "12px 12px",
                                  fontWeight: 500,
                                  borderRight: "1px solid #cfcfcf",
                                  color: "#0c1a4b"
                                }}>
                                  {main.title}
                                </div>

                                <div className="mainreference-field" style={{
                                  width: "55%",
                                  padding: "8px 12px",
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
                                        const savedValue = String(answer?.value ?? "");
                                        const isSelected =
                                          savedValue === choiceIndexValue ||
                                          (choiceValueRaw !== "" && choiceValueRaw !== null && choiceValueRaw !== undefined && savedValue === String(choiceValueRaw)) ||
                                          (choiceLabel !== "" && choiceLabel !== null && choiceLabel !== undefined && savedValue === String(choiceLabel));
                                        
                                        return (
                                          <div key={i} style={{ marginBottom: "4px" }}>
                                            <input 
                                              type="radio" 
                                              name={`${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_main_${index}`}
                                              value={choiceIndexValue}
                                              checked={isSelected}
                                              onChange={(e) => handleRadioChange(
                                                record.firebaseKey,
                                                index,
                                                main.title,
                                                e.target.value
                                              )}
                                              disabled={hasSubmitted || metadata?.forwardedToPO}
                                            /> 
                                            <span style={{ marginLeft: "4px" }}>
                                              {choiceLabel || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
                                            </span>
                                          </div>
                                        );
                                      })}

                                    {main.fieldType === "checkbox" &&
                                      main.choices.map((choice, i) => {
                                        const legacyCheckboxKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_${main.title}_${i}`;
                                        const checkboxKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_checkbox_${main.title}_${i}`;
                                        const isChecked =
                                          (userAnswers[checkboxKey]?.value ?? userAnswers[legacyCheckboxKey]?.value) === true;
                                        
                                        return (
                                          <div key={i} style={{ marginBottom: "4px" }}>
                                            <input 
                                              type="checkbox" 
                                              checked={isChecked}
                                              onChange={(e) => handleCheckboxChange(
                                                record.firebaseKey,
                                                index,
                                                `${main.title}_${i}`,
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

                                    {main.fieldType === "short" && (
                                      <input
                                        type="text"
                                        style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                                        placeholder="Enter your answer..."
                                        value={answer?.value || ""}
                                        onChange={(e) => handleAnswerChange(
                                          record.firebaseKey,
                                          index,
                                          main.title,
                                          e.target.value
                                        )}
                                        disabled={hasSubmitted || metadata?.forwardedToPO}
                                      />
                                    )}

{main.fieldType === "integer" && (
  <input
    type="number"
    step="any"
    style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
    placeholder="Enter a number..."
    value={answer?.value || ""}
    onChange={(e) => handleAnswerChange(
      record.firebaseKey,
      index,
      main.title,
      e.target.value
    )}
    disabled={hasSubmitted || metadata?.forwardedToPO}
  />
)}

                                    {main.fieldType === "date" && (
                                      <input
                                        type="date"
                                        style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                                        value={answer?.value || ""}
                                        onChange={(e) => handleAnswerChange(
                                          record.firebaseKey,
                                          index,
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
{main.verification && (
  <div className="reference-verification-full"
  style={{
    width:"100%",
  }}>
  
    <div className="reference-row" style={{
      display: "flex",
      border: "none",
    }}>

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
        <span style={{ display: "inline-block", flexShrink: 0, fontWeight: 700, color: "#081a4b"}}>Mode of Verification</span>
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "4px",
          width: "100%"
        }}>
          {Array.isArray(main.verification) ? (
            main.verification.map((v, idx) => (
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
                  marginLeft:"50px"
                }}></span>
                <span style={{ fontStyle: "italic", fontSize: "12px" }}>{v}</span>
              </div>
            ))
          ) : (
            <div style={{ 
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
                marginLeft:"50px"
              }}></span>
              <span style={{ fontStyle: "italic", fontSize: "12px" }}>{main.verification}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="reference-field" style={{
        width: "55%",
        padding: "6px 12px",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        border:"none",
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
    return key.includes(`${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_${sanitizedField}`);
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
                {!hasSubmitted && (
                  <button
                    onClick={() => removeAttachment(key)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#d32f2f",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "bold",
                      padding: "0 4px",
                      marginLeft: "4px",
                      flexShrink: 0
                    }}
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                )}
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
                          const legacyAnswerKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_${sub.title}`;
                          const radioAnswerKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_radio_${sub.title}`;
                          const answer = userAnswers[radioAnswerKey] ?? userAnswers[legacyAnswerKey];
                          
                          return (
                            <div key={index} className="reference-wrapper"
                            style={{
                              marginBottom: "-10px"
                            }}>
                            
                              {/* Sub Indicator Row */}
                              <div className="reference-row sub-row" style={{
                                display: "flex",
                                marginTop: "5px",

                              }}>
                                <div className="reference-label" style={{
                                  width: "45%",
                                  background: "#fff6f6",
                                  padding: "12px 11px",
                                  fontWeight: 500,
                                  borderRight: "1px solid #cfcfcf",
                                }}>
                                  {sub.title}
                                </div>

                                <div className="reference-field" style={{
                                  width: "55%",
                                  padding: "8px 12px",
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
                                      const savedValue = String(answer?.value ?? "");
                                      const isSelected =
                                        savedValue === choiceIndexValue ||
                                        (choiceValueRaw !== "" && choiceValueRaw !== null && choiceValueRaw !== undefined && savedValue === String(choiceValueRaw)) ||
                                        (choiceLabel !== "" && choiceLabel !== null && choiceLabel !== undefined && savedValue === String(choiceLabel));
                                      
                                      return (
                                        <div key={i} style={{ marginBottom: "4px" }}>
                                          <input 
                                            type="radio" 
                                            name={`${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}`}
                                            value={choiceIndexValue}
                                            checked={isSelected}
                                            onChange={(e) => handleRadioChange(
                                              record.firebaseKey,
                                              `sub_${index}`,
                                              sub.title,
                                              e.target.value
                                            )}
                                            disabled={hasSubmitted || metadata?.forwardedToPO}
                                          /> 
                                          <span style={{ marginLeft: "4px" }}>
                                            {choiceLabel || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
                                          </span>
                                        </div>
                                      );
                                    })}

                                  {sub.fieldType === "checkbox" &&
                                    sub.choices.map((choice, i) => {
                                      const legacyCheckboxKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_${sub.title}_${i}`;
                                      const checkboxKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_checkbox_${sub.title}_${i}`;
                                      const isChecked =
                                        (userAnswers[checkboxKey]?.value ?? userAnswers[legacyCheckboxKey]?.value) === true;
                                      
                                      return (
                                        <div key={i} style={{ marginBottom: "4px" }}>
                                          <input 
                                            type="checkbox" 
                                            checked={isChecked}
                                            onChange={(e) => handleCheckboxChange(
                                              record.firebaseKey,
                                              `sub_${index}`,
                                              `${sub.title}_${i}`,
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

                                  {sub.fieldType === "short" && (
                                    <input
                                      type="text"
                                      style={{ width: "100%", padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
                                      placeholder="Enter your answer..."
                                      value={answer?.value || ""}
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
    value={answer?.value || ""}
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
                                      value={answer?.value || ""}
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
{sub.verification && (
  <div className="reference-verification-full"
  style={{
    width:"100%",
  }}>
  
    <div className="reference-row" style={{
      display: "flex",
      border: "none",
    }}>

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
        <span style={{ display: "inline-block", flexShrink: 0, fontWeight: 700, color: "#081a4b"}}>Mode of Verification</span>
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "4px",
          width: "100%"
        }}>
          {Array.isArray(sub.verification) ? (
            sub.verification.map((v, idx) => (
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
                  marginLeft:"50px"
                }}></span>
                <span style={{ fontStyle: "italic", fontSize: "12px" }}>{v}</span>
              </div>
            ))
          ) : (
            <div style={{ 
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
                marginLeft:"50px"
              }}></span>
              <span style={{ fontStyle: "italic", fontSize: "12px" }}>{sub.verification}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="reference-field" style={{
        width: "55%",
        padding: "6px 12px",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        border:"none",
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
    return key.includes(`${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_${sanitizedField}`);
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
                {!hasSubmitted && (
                  <button
                    onClick={() => removeAttachment(key)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#d32f2f",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "bold",
                      padding: "0 4px",
                      marginLeft: "4px",
                      flexShrink: 0
                    }}
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  </div>
)}


                              {/* Nested Sub-Indicators */}
                              {sub.nestedSubIndicators && sub.nestedSubIndicators.length > 0 && (
                                <div className="nested-reference-wrapper" style={{ marginLeft: "30px", marginTop: "10px",marginBottom: "20px"}}>
                                  {sub.nestedSubIndicators.map((nested, nestedIndex) => {
                                    const legacyNestedAnswerKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}`;
                                    const nestedRadioAnswerKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_radio_${nested.title}`;
                                    const nestedAnswer = userAnswers[nestedRadioAnswerKey] ?? userAnswers[legacyNestedAnswerKey];
                                    
                                    return (
                                      <div key={nested.id || nestedIndex} className="nested-reference-item" style={{ marginBottom: "5px" }}>
                                        <div className="nested-reference-row" style={{ display: "flex", border: "1px solid #cfcfcf" }}>
                                          <div className="nested-reference-label" style={{ 
                                            width: "45%", 
                                            background: "#f0f0f0",
                                            padding: "8px 12px",
                                            fontWeight: 500,
                                            borderRight: "1px solid #cfcfcf",
                                            
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
                                              const choiceLabel =
                                                choice && typeof choice === "object"
                                                  ? (choice.label ?? choice.value ?? choice.name ?? choice.title ?? choice.text ?? "")
                                                  : choice;
                                              const choiceValueRaw =
                                                choice && typeof choice === "object"
                                                  ? (choice.value ?? choice.label ?? choice.name ?? choice.title ?? choice.text ?? "")
                                                  : choice;
                                              const choiceIndexValue = String(i);
                                              const savedValue = String(nestedAnswer?.value ?? "");
                                              const isSelected =
                                                savedValue === choiceIndexValue ||
                                                (choiceValueRaw !== "" && choiceValueRaw !== null && choiceValueRaw !== undefined && savedValue === String(choiceValueRaw)) ||
                                                (choiceLabel !== "" && choiceLabel !== null && choiceLabel !== undefined && savedValue === String(choiceLabel));
                                              
                                              return (
                                                <div key={i} style={{ marginBottom: "4px" }}>
                                                  <input 
                                                    type="radio" 
                                                    name={`${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}`}
                                                    value={choiceIndexValue}
                                                    checked={isSelected}
                                                    onChange={(e) => handleRadioChange(
                                                      record.firebaseKey,
                                                      `sub_${index}_nested_${nestedIndex}`,
                                                      nested.title,
                                                      e.target.value
                                                    )}
                                                    disabled={hasSubmitted || metadata?.forwardedToPO}
                                                  /> 
                                                  <span style={{ marginLeft: "4px" }}>{choiceLabel}</span>
                                                </div>
                                              );
                                            })}

                                            {/* Nested Checkbox */}
                                            {nested.fieldType === "checkbox" && nested.choices?.map((choice, i) => {
                                              const legacyNestedCheckboxKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}_${i}`;
                                              const nestedCheckboxKey = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_checkbox_${nested.title}_${i}`;
                                              const isChecked =
                                                (userAnswers[nestedCheckboxKey]?.value ?? userAnswers[legacyNestedCheckboxKey]?.value) === true;
                                              
                                              return (
                                                <div key={i} style={{ marginBottom: "4px" }}>
                                                  <input 
                                                    type="checkbox" 
                                                    checked={isChecked}
                                                    onChange={(e) => handleCheckboxChange(
                                                      record.firebaseKey,
                                                      `sub_${index}_nested_${nestedIndex}`,
                                                      `${nested.title}_${i}`,
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
                                                value={nestedAnswer?.value || ""}
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
    value={nestedAnswer?.value || ""}
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
                                                value={nestedAnswer?.value || ""}
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
{nested.verification && nested.verification.length > 0 && (
  <div className="reference-verification-full"
  style={{
    width:"98.57%"
  }}>
  
    <div className="reference-row" style={{
      display: "flex",
      border: "none",
    }}>

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
        <span style={{ display: "inline-block", flexShrink: 0, fontWeight: 700, color: "#081a4b"}}>Mode of Verification</span>
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: "4px",
          width: "100%"
        }}>
          {nested.verification.map((v, idx) => (
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
                marginLeft:"50px"
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
        border:"none",
        gap: "8px"
      }}>
        
        <div style={{ display: "flex", gap: "8px" }}>
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
    return key.includes(`${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${sanitizedField}`);
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
                {!hasSubmitted && (
                  <button
                    onClick={() => removeAttachment(key)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#d32f2f",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "bold",
                      padding: "0 4px",
                      marginLeft: "4px",
                      flexShrink: 0
                    }}
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                )}
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
                            
                            {isDraft && (
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
                            
                            {lastSavedDraft && isDraft && (
                              <span style={{ fontSize: "12px", color: "#666" }}>
                                Last saved: {lastSavedDraft}
                              </span>
                            )}
                          </>
                        )}
                        
                        {hasSubmitted && (
                          <span style={{ 
                            backgroundColor: "#d4edda", 
                            color: "#155724",
                            padding: "4px 12px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "600",
                            border: "1px solid #c3e6cb"
                          }}>
                            ✓ ASSESSMENT SUBMITTED
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
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