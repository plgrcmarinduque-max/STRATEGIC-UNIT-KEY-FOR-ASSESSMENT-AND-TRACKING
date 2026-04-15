
import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import style from "src/PO-CSS/po-view.module.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";  
import { FiFilter, FiRotateCcw, FiSettings, FiLogOut, FiFileText, FiClipboard, FiDownload } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, child, push, onValue, set, get } from "firebase/database";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function POView() {
  const location = useLocation();
  const navigate = useNavigate();
  const [forwardedAssessment, setForwardedAssessment] = useState(null);
  const [verifiedFlag, setVerifiedFlag] = useState({}); // object per tab
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
  const [savingAnswers, setSavingAnswers] = useState(false);
const [isReturned, setIsReturned] = useState(false);
const [previewAttachment, setPreviewAttachment] = useState(null);
  
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

  const [remarks, setRemarks] = useState({}); // object per tab
  const [indicatorRemarks, setIndicatorRemarks] = useState({}); // { [tabId]: { [indicatorPath]: "remark" } }
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
// ===== REMARKS HELPER FUNCTIONS =====
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

// Component for PO to add remarks on indicators

const IndicatorRemarkEditor = ({ tabId, indicatorPath, placeholder, onRemarkChange, currentValue }) => {
  const textareaRef = React.useRef(null);
  
  // Load initial remark when component mounts OR when currentValue changes
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = currentValue || '';
    }
  }, [currentValue, indicatorPath]);
  
  const handleBlur = (e) => {
    const newValue = e.target.value;
    if (onRemarkChange) {
      onRemarkChange(indicatorPath, newValue);
    }
  };
  
  const stopPropagation = (e) => {
    e.stopPropagation();
  };
  
  return (
    <div 
      style={{
        marginTop: "4px",
        padding: "4px",
        backgroundColor: "#fafafa",
        borderRadius: "4px",
        borderLeft: "3px solid #730101"
      }}
    >
      <textarea
        ref={textareaRef}
        placeholder={placeholder || "Add PO remark for this indicator..."}
        rows="1"
        onBlur={handleBlur}
        onMouseDown={stopPropagation}
        onMouseUp={stopPropagation}
        onClick={stopPropagation}
        onKeyDown={stopPropagation}
        style={{
          width: "100%",
          padding: "4px 8px",
          border: "1px solid #ffffff",
          borderRadius: "4px",
          fontSize: "11px",
          resize: "vertical",
          fontFamily: "inherit",
          backgroundColor: "#fffef7",
          pointerEvents: "auto",
          outline: "none",
          lineHeight: "1.3"
        }}
      />
    </div>
  );
};

// Helper function to compress objects with long keys
const compressObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const compressed = {};
  const keyMap = {};
  
  Object.keys(obj).forEach(longKey => {
    // Create a short hash for the key
    let hash = 0;
    for (let i = 0; i < longKey.length; i++) {
      hash = ((hash << 5) - hash) + longKey.charCodeAt(i);
      hash = hash & hash;
    }
    const shortKey = `k${Math.abs(hash).toString(36)}`;
    keyMap[shortKey] = longKey;
    compressed[shortKey] = obj[longKey];
  });
  
  compressed.__keyMap = keyMap;
  return compressed;
};

// Helper function to decompress objects
const decompressObject = (compressed) => {
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
  // Helper function to get tab name
  const getTabName = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    return tab?.name || "Tab";
  };

// Add this function to handle viewing attachments
const viewAttachment = (attachment) => {
  console.log('👁️ Viewing attachment:', attachment);
  setPreviewAttachment(attachment);
};

// Add this function to close the preview modal
const closePreview = () => {
  setPreviewAttachment(null);
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

          // Use onValue to listen for changes
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
              
              console.log("Loaded tabs:", loadedTabs);
              setTabs(loadedTabs);
              setTabData(tabsData);

              // Set first tab as active if available
              if (loadedTabs.length > 0) {
                setActiveTab(loadedTabs[0].id);
              }
            } else {
              console.log("No tabs found for this assessment");
              setTabs([]);
              setActiveTab(null);
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

// Add this near the top of your component to debug
useEffect(() => {
  console.log("Location state:", location.state);
  console.log("Selected Year:", selectedYear);
  console.log("Selected Assessment:", selectedAssessment);
  console.log("Selected Assessment ID:", selectedAssessmentId);
}, [location.state, selectedYear, selectedAssessment, selectedAssessmentId]);
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

  // Helper function to get the correct answer key with tab prefix and assessment ID
  const getAnswerKey = (record, mainIndex, field, isSub = false, nestedIndex = null, valueType = "default") => {
    if (nestedIndex !== null) {
      if (valueType === "radio") return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_nested_${nestedIndex}_radio_${field}`;
      if (valueType === "checkbox") return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_nested_${nestedIndex}_checkbox_${field}`;
      return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_nested_${nestedIndex}_${field}`;
    } else if (isSub) {
      if (valueType === "radio") return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_radio_${field}`;
      if (valueType === "checkbox") return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_checkbox_${field}`;
      return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_sub_${mainIndex}_${field}`;
    } else {
      if (valueType === "radio") return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${mainIndex}_radio_${field}`;
      if (valueType === "checkbox") return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${mainIndex}_checkbox_${field}`;
      return `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${mainIndex}_${field}`;
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

const handleTabChange = (tabId) => {
  setActiveTab(tabId);
  // Force reload of remarks for this tab
  const lgu = lguAnswers[0];
  if (lgu && lgu.poRemarks) {
    let remarksToLoad = lgu.poRemarks;
    if (remarksToLoad && remarksToLoad.__keyMap) {
      remarksToLoad = decompressObject(remarksToLoad);
    }
    setIndicatorRemarks(prev => ({
      ...prev,
      [tabId]: remarksToLoad
    }));
    console.log("📝 Reloaded PO remarks for tab:", tabId, remarksToLoad);
  }
  
  // Also check forwardedAssessment
  if (forwardedAssessment && forwardedAssessment.poRemarks) {
    let remarksToLoad = forwardedAssessment.poRemarks;
    if (remarksToLoad && remarksToLoad.__keyMap) {
      remarksToLoad = decompressObject(remarksToLoad);
    }
    setIndicatorRemarks(prev => ({
      ...prev,
      [tabId]: remarksToLoad
    }));
    console.log("📝 Reloaded PO remarks from forwardedAssessment for tab:", tabId);
  }
};

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

// Export current tab as PDF
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
    
    const municipality = lguAnswers[0]?.municipality || "Not specified";    
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

// Export all tabs as PDF
const exportAllTabsToPDF = async () => {
  if (!selectedYear || !selectedAssessmentId) {
    alert("Please select an assessment first");
    return;
  }

  if (!tabs.length) {
    alert("No area available to export");
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
    
    const municipality = lguAnswers[0]?.municipality || "Not specified";
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
    
    // Use UID-based path for verification
    let cleanLguName;
    if (lgu.lguUid) {
      cleanLguName = `${lgu.lguUid}_${selectedAssessmentId}`;
      console.log("Using UID-based path for verification:", cleanLguName);
    } else {
      // Fallback to name-based path
      cleanLguName = `${lgu.lguName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
      console.log("Using name-based path for verification (fallback):", cleanLguName);
    }
    
    // Get the MLGO's UID from the forwarded assessment
    const mlgoUid = forwardedAssessment.lguUid || lgu.lguUid;
    
    if (!mlgoUid) {
      console.error("No MLGO UID found in:", { forwardedAssessment, lgu });
      alert("MLGO information not found. Cannot verify assessment.");
      return;
    }
    
    console.log("Verifying assessment for MLGO with UID:", mlgoUid);
    
    // Get the current tab's remark
    const currentTabRemark = remarks[activeTab] || "";
    const allTabRemarks = { ...remarks };
    
    // 1. Get the current data from answers node first
    const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanLguName}`);
    const snapshot = await get(answersRef);
    
    let lguUidForNotification = null;
    
    if (snapshot.exists()) {
      const currentData = snapshot.val();
      lguUidForNotification = currentData._metadata?.uid;
      
   const compressedIndicatorRemarks = compressObject(indicatorRemarks[activeTab] || {});

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
        remarks: currentTabRemark || "Assessment verified",
        poRemarks: compressedIndicatorRemarks
      };
      
      const updatedData = {
        ...currentData,
        _metadata: updatedMetadata
      };
      
      await set(answersRef, updatedData);
      console.log("✅ Updated answers node with verified metadata");
    }
    
    // 2. Save to verified node - FIXED: Store only references, not the actual data
    const verifiedData = {
      lguUid: mlgoUid,
      year: selectedYear,
      assessmentId: selectedAssessmentId,
      assessment: selectedAssessment,
      lguName: lgu.lguName,
      municipality: lgu.municipality,
      verifiedAt: Date.now(),
      verifiedBy: auth.currentUser?.email,
      verifiedByName: profileData.name || auth.currentUser?.email,
      deadline: lgu.deadline,
      submittedBy: lgu.submittedBy,
      forwardedBy: forwardedAssessment.forwardedBy,
      remarks: currentTabRemark || "Assessment verified",
      // Store ONLY references, not the actual data to avoid byte limit
      answersPath: `answers/${selectedYear}/LGU/${cleanLguName}`,
      attachmentsPath: `attachments/${selectedYear}/LGU/${cleanLguName}`
    };
    
    // Save to verified node (organized by year then LGU)
    const verifiedRef = ref(db, `verified/${selectedYear}/LGU/${cleanLguName}`);
    await set(verifiedRef, verifiedData);
    console.log("✅ Saved to verified node with references only");
    
    // 3. Remove from forwarded node (since it's now verified)
    const forwardedRef = ref(db, `forwarded/${auth.currentUser.uid}`);
    const forwardedSnapshot = await get(forwardedRef);
    
    if (forwardedSnapshot.exists()) {
      const forwardedData = forwardedSnapshot.val();
      
      // Find and delete the specific forwarded record
      for (const [key, item] of Object.entries(forwardedData)) {
        if (item.lguUid === mlgoUid && item.year === selectedYear && item.assessmentId === selectedAssessmentId) {
          await set(ref(db, `forwarded/${auth.currentUser.uid}/${key}`), null);
          console.log("✅ Removed from forwarded node");
          break;
        }
      }
    }
    
    // 3.5 ALSO REMOVE FROM RETURNED NODE (if it exists there)
    const returnedRef = ref(db, `returned/${selectedYear}/MLGO/${mlgoUid}/${selectedAssessmentId}`);
    const returnedSnapshot = await get(returnedRef);
    if (returnedSnapshot.exists()) {
      await set(returnedRef, null);
      console.log("✅ Removed from returned node");
    }
    
    // 4. Create a notification for the MLGO
    const notificationRef = ref(db, `notifications/${selectedYear}/MLGO/${mlgoUid}`);
    const notificationId = Date.now().toString();
    const notificationData = {
  id: notificationId,
  type: "assessment_verified",
  title: `"${selectedAssessment}" Assessment (${selectedYear}) has been verified by the Provincial Office.`,
  message: currentTabRemark || "Assessment has been verified by the Provincial Office.",
  from: auth.currentUser?.email || "",
  fromName: profileData.name || auth.currentUser?.email || "",
  fromMunicipality: "",
  timestamp: Date.now(),
  read: false,
  year: selectedYear,
  assessment: selectedAssessment,
  assessmentId: selectedAssessmentId,
  municipality: lgu.municipality,
  lguName: lgu.lguName,
  lguUid: mlgoUid,  // ← MAKE SURE THIS IS INCLUDED
  tabName: activeTab ? tabs.find(t => t.id === activeTab)?.name || "" : "",
  tabRemarks: currentTabRemark,
  action: "view_verified_assessment"
};
    console.log("Saving notification for MLGO:", notificationData);
    await set(ref(db, `notifications/${selectedYear}/MLGO/${mlgoUid}/${notificationId}`), notificationData);
    console.log("✅ Notification created for MLGO");

    // 5. Create a notification for the LGU (using UID from metadata)
    if (lguUidForNotification) {
      const lguNotificationRef = ref(db, `notifications/${selectedYear}/LGU/${lguUidForNotification}`);
      const lguNotificationId = Date.now().toString();
      const lguNotificationData = {
        id: lguNotificationId,
        type: "assessment_verified",
        title: `Assessment "${selectedAssessment}" (${selectedYear}) has been verified by the Provincial Office.`,
        message: `Your assessment has been verified.`,
        from: auth.currentUser?.email,
        fromName: profileData.name || auth.currentUser?.email,
        timestamp: Date.now(),
        read: false,
        year: selectedYear,
        assessmentId: selectedAssessmentId,
        assessment: selectedAssessment,
        municipality: lgu.municipality || "",
        tabName: activeTab ? tabs.find(t => t.id === activeTab)?.name || "" : "",
        tabRemarks: currentTabRemark || "",
        action: "view_verified_assessment"
      };
      
      await set(ref(db, `notifications/${selectedYear}/LGU/${lguUidForNotification}/${lguNotificationId}`), lguNotificationData);
    }
    
    console.log("✅ Notifications created");
    
    alert("Assessment verified successfully!");
    setIsVerified(true);
    // DO NOT clear remarks - keep them for when assessment is re-forwarded
    console.log("📝 Keeping remarks for future reference:", remarks[activeTab]);
    
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

// In po-view.jsx, replace the attachments loading section in the useEffect that loads LGU answers:
// ===== LOAD LGU ANSWERS =====
useEffect(() => {
  if (!auth.currentUser || !selectedYear || !location.state?.lguUid || !selectedAssessmentId) {
    setLoading(false);
    return;
  }

  const loadLGUAnswers = async () => {
    try {
      setLoading(true);
      
      const municipality = location.state.municipality;
      const lguName = location.state.lguName || municipality;
      const cleanName = `${lguName.replace(/[.#$\[\]]/g, '_')}_${selectedAssessmentId}`;
      
      console.log("Loading assessment for:", lguName);
      
      // ===== STEP 1: ALWAYS LOAD ATTACHMENTS FROM FIREBASE FIRST =====
      let attachmentsByIndicator = {};
      try {
        let attachmentPath = cleanName;
        if (location.state?.lguUid) {
          attachmentPath = `${location.state.lguUid}_${selectedAssessmentId}`;
          console.log("Using UID-based path for attachments:", attachmentPath);
        }
        
        const attachmentsRef = ref(db, `attachments/${selectedYear}/LGU/${attachmentPath}`);
        const attachmentsSnapshot = await get(attachmentsRef);
        
        if (attachmentsSnapshot.exists()) {
          const compressedAttachments = attachmentsSnapshot.val();
          const decompressedAttachments = decompressAttachments(compressedAttachments);
          console.log("📎 Attachments found:", Object.keys(decompressedAttachments).length);
          
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
          
          console.log("📎 Attachments mapped to indicators:", Object.keys(attachmentsByIndicator).length);
        } else {
          console.log("📎 No attachments found for this assessment");
        }
      } catch (error) {
        console.error("Error loading attachments:", error);
      }
      
      // ===== STEP 2: LOAD THE ASSESSMENT DATA =====
      let lguData = null;
      
      // Check if this is a verified assessment
      if (location.state?.isVerified) {
        console.log("Loading VERIFIED assessment from state");
        
        const verifiedAttachments = location.state.attachmentsByIndicator || attachmentsByIndicator;
        
        let originalData = location.state.data || {};
        let decompressedData = originalData;
        
        if (originalData && originalData.__keyMap) {
          decompressedData = decompressAnswers(originalData);
          console.log("Decompressed answers from verified data");
        }
        
        // Load PO remarks from verified state
        if (location.state.poRemarks) {
          let verifiedRemarks = location.state.poRemarks;
          if (verifiedRemarks && verifiedRemarks.__keyMap) {
            verifiedRemarks = decompressObject(verifiedRemarks);
          }
          setIndicatorRemarks(prev => ({
            ...prev,
            [activeTab]: verifiedRemarks
          }));
          console.log("📝 Loaded PO remarks from verified state:", verifiedRemarks);
        }
        
        lguData = {
          id: 1,
          lguName: lguName,
          year: selectedYear,
          assessmentId: selectedAssessmentId,
          assessment: selectedAssessment,
          status: "Verified",
          submission: location.state.submission || new Date().toLocaleDateString(),
          deadline: location.state.deadline || "Not set",
          data: decompressedData,
          municipality: municipality,
          lguUid: location.state.lguUid,
          isVerified: true,
          verifiedBy: location.state.verifiedBy,
          verifiedAt: location.state.verifiedAt,
          attachmentsByIndicator: verifiedAttachments
        };
        
        console.log("Verified attachments loaded:", Object.keys(verifiedAttachments).length);
        setLguAnswers([lguData]);
        setForwardedAssessment(lguData);
        setIsVerified(true);
        setIsReturned(false);
        setLoading(false);
        return;
      }
      
      // Check if this is a returned assessment
      if (location.state?.isReturned || location.state?.wasReturned) {
        console.log("Loading RETURNED assessment from state");
        
        // Load the saved PO remarks back into state
        if (location.state.poRemarks) {
          let loadedRemarks = location.state.poRemarks;
          if (loadedRemarks && loadedRemarks.__keyMap) {
            loadedRemarks = decompressObject(loadedRemarks);
          }
          setIndicatorRemarks(prev => ({
            ...prev,
            [activeTab]: loadedRemarks
          }));
          console.log("📝 Loaded PO remarks from returned assessment state:", loadedRemarks);
        }
        
        lguData = {
          id: 1,
          lguName: lguName,
          year: selectedYear,
          assessmentId: selectedAssessmentId,
          assessment: selectedAssessment,
          status: "Returned",
          submission: location.state.submission || new Date().toLocaleDateString(),
          deadline: location.state.deadline || "Not set",
          data: location.state.data || {},
          municipality: municipality,
          lguUid: location.state.lguUid,
          isReturned: true,
          returnedBy: location.state.returnedBy,
          returnedAt: location.state.returnedAt,
          poRemarks: location.state.poRemarks,
          attachmentsByIndicator: attachmentsByIndicator
        };
        
        setLguAnswers([lguData]);
        setForwardedAssessment(lguData);
        setIsVerified(false);
        setIsReturned(true);
        setLoading(false);
        return;
      }
      
      // Load from forwarded node
      console.log("Loading FORWARDED assessment from Firebase");
      const currentUserUid = auth.currentUser.uid;
      const forwardedRef = ref(db, `forwarded/${currentUserUid}`);
      const snapshot = await get(forwardedRef);

      let foundAssessment = null;

      if (snapshot.exists()) {
        const forwardedData = snapshot.val();
        
        Object.keys(forwardedData).forEach(key => {
          const item = forwardedData[key];
          if (item.lguUid === location.state.lguUid && 
              item.year === selectedYear && 
              item.assessmentId === selectedAssessmentId) {
            foundAssessment = item;
          }
        });
      }

      // If not found in forwarded, check if it's already verified
      if (!foundAssessment) {
        console.log("Not found in forwarded, checking verified node...");
        const cleanName = `${location.state.lguUid}_${selectedAssessmentId}`;
        const verifiedRef = ref(db, `verified/${selectedYear}/LGU/${cleanName}`);
        const verifiedSnapshot = await get(verifiedRef);
        
        if (verifiedSnapshot.exists()) {
          console.log("Assessment found in verified node! Loading as verified...");
          const verifiedData = verifiedSnapshot.val();
          
          let decompressedData = {};
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
          
          // Load PO remarks from verified data
          if (verifiedData.poRemarks) {
            let verifiedRemarks = verifiedData.poRemarks;
            if (verifiedRemarks && verifiedRemarks.__keyMap) {
              verifiedRemarks = decompressObject(verifiedRemarks);
            }
            setIndicatorRemarks(prev => ({
              ...prev,
              [activeTab]: verifiedRemarks
            }));
            console.log("📝 Loaded PO remarks from verified node:", verifiedRemarks);
          }
          
          const lguData = {
            id: 1,
            lguName: location.state.lguName || location.state.municipality,
            year: selectedYear,
            assessmentId: selectedAssessmentId,
            assessment: verifiedData.assessment || selectedAssessment,
            status: "Verified",
            submission: verifiedData.submission || new Date().toLocaleDateString(),
            deadline: verifiedData.deadline || "Not set",
            data: decompressedData,
            municipality: verifiedData.municipality || location.state.municipality,
            lguUid: location.state.lguUid,
            isVerified: true,
            verifiedBy: verifiedData.verifiedBy,
            verifiedAt: verifiedData.verifiedAt,
            attachmentsByIndicator: attachmentsByIndicator
          };
          
          setLguAnswers([lguData]);
          setForwardedAssessment(lguData);
          setIsVerified(true);
          setIsReturned(false);
          setLoading(false);
          return;
        }
      }

      if (foundAssessment) {
        // CRITICAL FIX: Load PO remarks from multiple possible locations
        let loadedRemarks = {};
        
        // Check foundAssessment.poRemarks
        if (foundAssessment.poRemarks) {
          let remarksData = foundAssessment.poRemarks;
          if (remarksData && remarksData.__keyMap) {
            remarksData = decompressObject(remarksData);
          }
          loadedRemarks = { ...loadedRemarks, ...remarksData };
          console.log("📝 Loaded from foundAssessment.poRemarks");
        }
        
        // Check foundAssessment.indicatorRemarksRaw
        if (foundAssessment.indicatorRemarksRaw) {
          loadedRemarks = { ...loadedRemarks, ...foundAssessment.indicatorRemarksRaw };
          console.log("📝 Loaded from foundAssessment.indicatorRemarksRaw");
        }
        
        // Check originalData metadata
        if (foundAssessment.originalData?._metadata?.poRemarks) {
          let metaRemarks = foundAssessment.originalData._metadata.poRemarks;
          if (metaRemarks && metaRemarks.__keyMap) {
            metaRemarks = decompressObject(metaRemarks);
          }
          loadedRemarks = { ...loadedRemarks, ...metaRemarks };
          console.log("📝 Loaded from originalData._metadata.poRemarks");
        }
        
        // Check originalData metadata indicatorRemarksRaw
        if (foundAssessment.originalData?._metadata?.indicatorRemarksRaw) {
          loadedRemarks = { ...loadedRemarks, ...foundAssessment.originalData._metadata.indicatorRemarksRaw };
          console.log("📝 Loaded from originalData._metadata.indicatorRemarksRaw");
        }
        
        // Load from location.state if available
        if (location.state?.poRemarks) {
          loadedRemarks = { ...loadedRemarks, ...location.state.poRemarks };
          console.log("📝 Loaded from location.state.poRemarks");
        }
        
        // Set the loaded remarks to state
        if (Object.keys(loadedRemarks).length > 0) {
          setIndicatorRemarks(prev => ({
            ...prev,
            [activeTab]: loadedRemarks
          }));
          console.log("📝 FINAL loaded PO remarks:", loadedRemarks);
        }
        
        // Decompress answers if they were compressed
        const originalData = foundAssessment.originalData || {};
        let decompressedData = originalData;
        
        if (originalData && originalData.__keyMap) {
          decompressedData = decompressAnswers(originalData);
          console.log("Decompressed answers from forwarded data");
        }
        
        const lguData = {
          id: 1,
          lguName: foundAssessment.lguName || municipality,
          year: foundAssessment.year,
          assessmentId: foundAssessment.assessmentId,
          assessment: foundAssessment.assessment,
          status: foundAssessment.status || "Pending",
          submission: foundAssessment.submission || new Date().toLocaleDateString(),
          deadline: location.state?.deadline || foundAssessment.deadline || "Not set",
          data: decompressedData,
          municipality: municipality,
          submittedBy: foundAssessment.submittedBy || "Unknown",
          forwardedBy: foundAssessment.forwardedBy,
          forwardedAt: foundAssessment.forwardedAt,
          lguUid: foundAssessment.lguUid,
          attachmentsByIndicator: attachmentsByIndicator,
          poRemarks: loadedRemarks
        };
        
        console.log("Forwarded assessment attachments loaded:", Object.keys(attachmentsByIndicator).length);
        setLguAnswers([lguData]);
        setForwardedAssessment(foundAssessment);
        setIsVerified(false);
      } else {
        alert("No assessment data found.");
      }
      
    } catch (error) {
      console.error("Error loading assessment:", error);
      alert("Error loading assessment: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (location.state?.lguUid && selectedYear && selectedAssessmentId) {
    loadLGUAnswers();
  } else {
    setLoading(false);
  }
}, [auth.currentUser, selectedYear, selectedAssessmentId, location.state]);

const handleReturnAssessment = async () => {
  if (!lguAnswers.length || !forwardedAssessment) {
    console.log("Missing data:", { 
      lguAnswersLength: lguAnswers.length, 
      forwardedAssessment: forwardedAssessment 
    });
    alert("No assessment data to return. Please make sure you're viewing a forwarded assessment.");
    return;
  }

  const confirmReturn = window.confirm(
    "Are you sure you want to return this assessment to the MLGO?"
  );
  
  if (!confirmReturn) return;

  try {
    setLoading(true);
    const lgu = lguAnswers[0];
    
    // Get the LGU UID - use the UID from forwarded assessment or lgu object
    const mlgoUid = forwardedAssessment.lguUid || lgu.lguUid;
    
    if (!mlgoUid) {
      console.error("No MLGO UID found in:", { forwardedAssessment, lgu });
      alert("MLGO information not found. Cannot return assessment.");
      return;
    }
    
    console.log("Returning assessment to MLGO with UID:", mlgoUid);
    
    // Use UID-based path for the answers
    let cleanLguName;
    if (lgu.lguUid) {
      cleanLguName = `${lgu.lguUid}_${selectedAssessmentId}`;
    } else {
      const originalLguName = lgu.lguName.replace(/[.#$\[\]]/g, '_');
      cleanLguName = `${originalLguName}_${selectedAssessmentId}`;
    }
    
    console.log("Using answers path:", cleanLguName);
    
    const currentTabRemark = remarks[activeTab] || "";
    const allTabRemarks = { ...remarks };
    
    let originalAnswers = {};
    let originalMetadata = {};
    
    if (forwardedAssessment.originalData) {
      if (forwardedAssessment.originalData._metadata) {
        originalMetadata = forwardedAssessment.originalData._metadata;
        const { _metadata, ...answers } = forwardedAssessment.originalData;
        originalAnswers = answers;
      } else {
        originalAnswers = forwardedAssessment.originalData;
      }
    } else if (lgu.data) {
      originalAnswers = lgu.data;
    }
    
    // CRITICAL FIX: Get all indicator remarks for the current tab and preserve them
    const currentIndicatorRemarks = indicatorRemarks[activeTab] || {};
    const compressedRemarks = compressObject(currentIndicatorRemarks);
    
    const returnedData = {
      originalLguName: lgu.lguName,
      lguUid: mlgoUid,
      year: selectedYear,
      assessmentId: selectedAssessmentId,
      assessment: selectedAssessment,
      municipality: lgu.municipality,
      returnedAt: Date.now(),
      returnedBy: auth.currentUser?.email,
      returnedByName: profileData.name || auth.currentUser?.email,
      answersPath: `answers/${selectedYear}/LGU/${cleanLguName}`,
      attachmentsPath: `attachments/${selectedYear}/LGU/${cleanLguName}`,
      submission: lgu.submission,
      deadline: lgu.deadline,
      submittedBy: lgu.submittedBy || forwardedAssessment.submittedBy,
      poRemarks: compressedRemarks,
      indicatorRemarksRaw: currentIndicatorRemarks,
      currentTabRemark: currentTabRemark,
      status: "returned",
      forwardedBy: forwardedAssessment.forwardedBy,
      forwardedAt: forwardedAssessment.forwardedAt
    };

    const returnedRef = ref(db, `returned/${selectedYear}/MLGO/${mlgoUid}/${selectedAssessmentId}`);
    await set(returnedRef, returnedData);
    console.log("✅ Saved to returned node with PO remarks preserved:", currentIndicatorRemarks);

    // UPDATE answers node
    const answersRef = ref(db, `answers/${selectedYear}/LGU/${cleanLguName}`);
    const answersSnapshot = await get(answersRef);
    let existingMetadata = {};
    let existingAnswers = {};

    if (answersSnapshot.exists()) {
      const data = answersSnapshot.val();
      existingMetadata = data._metadata || {};
      const { _metadata, ...answers } = data;
      existingAnswers = answers;
    }

    const finalAnswers = Object.keys(originalAnswers).length > 0 ? originalAnswers : existingAnswers;

    const updatedMetadata = {
      ...originalMetadata,
      ...existingMetadata,
      uid: originalMetadata.uid || existingMetadata.uid || mlgoUid,
      email: originalMetadata.email || existingMetadata.email || forwardedAssessment.submittedBy || "",
      name: originalMetadata.name || existingMetadata.name || lgu.lguName,
      municipality: originalMetadata.municipality || existingMetadata.municipality || lgu.municipality,
      status: "Returned",
      returnedToMLGO: true,
      returnedAt: Date.now(),
      returnedBy: auth.currentUser?.email,
      returnedByName: profileData.name || auth.currentUser?.email,
      poRemarks: compressedRemarks,
      indicatorRemarksRaw: currentIndicatorRemarks,
      remarks: currentTabRemark || "Assessment returned for revision",
      submitted: false,
      forwarded: false,
      forwardedToPO: false,
      lastSaved: Date.now(),
      year: originalMetadata.year || selectedYear,
      assessment: originalMetadata.assessment || selectedAssessment,
      assessmentId: originalMetadata.assessmentId || selectedAssessmentId,
      deadline: originalMetadata.deadline || lgu.deadline
    };

    const answersData = {
      ...finalAnswers,
      _metadata: updatedMetadata
    };

    await set(answersRef, answersData);
    console.log("✅ Updated answers node with PO remarks in metadata");

    // DELETE FROM FORWARDED NODE
    const forwardedRef = ref(db, `forwarded/${auth.currentUser.uid}`);
    const forwardedSnapshot = await get(forwardedRef);

    if (forwardedSnapshot.exists()) {
      const forwardedData = forwardedSnapshot.val();
      let foundKey = null;
      
      for (const [key, item] of Object.entries(forwardedData)) {
        if (item.lguUid === mlgoUid && 
            item.year === selectedYear && 
            item.assessmentId === selectedAssessmentId) {
          foundKey = key;
          break;
        }
      }
      
      if (foundKey) {
        await set(ref(db, `forwarded/${auth.currentUser.uid}/${foundKey}`), null);
        console.log("✅ DELETED from forwarded node");
      }
    }
    
    // Create notification for MLGO
    const notificationReturnId = Date.now().toString();
    const notificationReturnData = {
      id: notificationReturnId,
      type: "assessment_returned_from_po",
      title: `"${selectedAssessment}" Assessment (${selectedYear}) was returned by PO.`,
      message: currentTabRemark || "Assessment returned by PO. Please review the remarks.",
      from: auth.currentUser?.email,
      fromName: profileData.name || auth.currentUser?.email,
      timestamp: Date.now(),
      read: false,
      year: selectedYear,
      assessmentId: selectedAssessmentId,
      assessment: selectedAssessment,
      lguName: lgu.lguName,
      lguUid: mlgoUid,
      municipality: lgu.municipality,
      poRemarks: compressedRemarks,
      indicatorRemarksRaw: currentIndicatorRemarks,
      currentTabRemark: currentTabRemark,
      action: "view_returned_assessment"
    };
    
    await set(ref(db, `notifications/${selectedYear}/MLGO/${mlgoUid}/${notificationReturnId}`), notificationReturnData);
    console.log("✅ Notification created for MLGO with PO remarks");
    
    setIsReturned(true);
    alert("Assessment returned to MLGO successfully.");
    
    navigate("/dashboard", { 
      state: { 
        returnedAssessment: true,
        year: selectedYear,
        assessmentId: selectedAssessmentId,
        lguUid: mlgoUid,
        poRemarks: currentIndicatorRemarks,
        refreshNeeded: true
      } 
    });
    
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

 // Fetch submission deadline for this specific assessment
useEffect(() => {
  if (!auth.currentUser || !adminUid || !selectedYear || !selectedAssessmentId) return;

  const fetchDeadline = async () => {
    try {
      const deadlineRef = ref(
        db,
        `financial/${adminUid}/${selectedYear}/assessments/${selectedAssessmentId}/deadline`  // <-- CORRECT PATH
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
}, [adminUid, selectedYear, selectedAssessmentId]); // Added selectedAssessmentId dependency

// Watch for forwardedAssessment changes and reload PO remarks
useEffect(() => {
  if (forwardedAssessment && forwardedAssessment.poRemarks && activeTab) {
    let remarksToLoad = forwardedAssessment.poRemarks;
    if (remarksToLoad && remarksToLoad.__keyMap) {
      remarksToLoad = decompressObject(remarksToLoad);
    }
    setIndicatorRemarks(prev => ({
      ...prev,
      [activeTab]: remarksToLoad
    }));
    console.log("📝 Loaded PO remarks from forwardedAssessment:", remarksToLoad);
  }
  
  // Also check for poRemarks in lguAnswers
  if (lguAnswers[0] && lguAnswers[0].poRemarks && activeTab) {
    let remarksToLoad = lguAnswers[0].poRemarks;
    if (remarksToLoad && remarksToLoad.__keyMap) {
      remarksToLoad = decompressObject(remarksToLoad);
    }
    setIndicatorRemarks(prev => ({
      ...prev,
      [activeTab]: remarksToLoad
    }));
    console.log("📝 Loaded PO remarks from lguAnswers:", remarksToLoad);
  }
}, [forwardedAssessment, lguAnswers, activeTab]);

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

  // Get current tab indicators
  const getCurrentTabIndicators = () => {
    if (!activeTab) return [];
    return tabData[activeTab] || [];
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
      
      alert(`Tab flag removed`);
    } else {
      // Add flag
      const bookmarkData = {
        lguName: lguAnswers[0]?.lguName || "",
        year: selectedYear,
        tabId: currentTabId,
        tabName: tabs.find(t => t.id === currentTabId)?.name || "Tab",
        timestamp: Date.now(),
        remarks: remarks[currentTabId] || "Flagged as verified"
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
      
      alert(`Tab flagged locally`);
    }
  };

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
      className={style.encodebackBtn}
      onClick={() => navigate("/dashboard")}
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
                alert("No areas available to export");
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
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600" }}>Export Current Area</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                  Export only the {tabs.find(t => t.id === activeTab)?.name || 'current'} area/s
                </p>
              </div>
            </div>
          </div>

          {/* Export All Tabs */}
          <div 
            className={style.exportDropdownItem}
            onClick={() => {
              if (!tabs.length) {
                alert("No area available to export");
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
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "600" }}>Export All Area</h4>
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
         {/* Status Badge */}
<div style={{
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "4px 12px",
  backgroundColor: isVerified ? "#28a745" : (isReturned ? "#ffb775" : "#ffb775"),
  borderRadius: "20px",
  fontSize: "14px",
  fontWeight: "600",
  color: isVerified ? "white" : "black"
}}>
  <span>{isVerified ? "✓" : (isReturned ? "↩" : "ⓘ")}</span>
  <span>
    {isVerified ? "Assessment Verified" : 
     isReturned ? "Returned to MLGO" : "Assessment Not Yet Verified"}
  </span>
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
{/* Only show buttons if NOT verified */}
{!isVerified && (
  <>
    {/* Return Assessment Button */}
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={handleReturnAssessment}
        disabled={loading || isReturned}
        style={{
          backgroundColor: isReturned ? "#8b5a5a" : "#990202",
          color: "white",
          border: "none",
          padding: "8px 20px",
          borderRadius: "5px",
          fontSize: "14px",
          cursor: isReturned ? "not-allowed" : "pointer",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          whiteSpace: "nowrap",
          opacity: isReturned ? 0.6 : 1
        }}
      >
        <span>↩</span>
        {isReturned ? "Returned to MLGOO" : "Return to MLGOO"}
      </button>
    </div>

    {/* Verify Assessment Button */}
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={handleVerifyAssessment}
        disabled={loading || isReturned}
        style={{
          backgroundColor: isReturned ? "#5a7a5a" : "#006736",
          color: "white",
          border: "none",
          padding: "8px 20px",
          borderRadius: "5px",
          fontSize: "14px",
          cursor: isReturned ? "not-allowed" : "pointer",
          fontWeight: "600",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          whiteSpace: "nowrap",
          opacity: isReturned ? 0.6 : 1
        }}
      >
        <span>✔</span>
        {isReturned ? "Returned (Cannot Verify)" : "Verify Assessment"}
      </button>
    </div>
  </>
)}
</div>
              </div>
            </div>

            {/* Dynamic Tabs - from PO Indicators */}
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
                  No area available for this assessment
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
                                  
                  {record.mainIndicators?.map((main, index) => {
  const radioKey = getAnswerKey(record, index, main.title, false, null, "radio");
  const baseKey = getAnswerKey(record, index, main.title);
  const answer = lgu.data?.[radioKey] ?? lgu.data?.[baseKey];
  
// Try multiple patterns to find attachments (matching MLGO View)
const attachmentsByIndicator = lgu.attachmentsByIndicator || {};

// Pattern 1: Original format (without assessment ID)
const pattern1 = `${record.firebaseKey}_${index}_${main.title}`;
// Pattern 2: With underscores instead of spaces
const pattern2 = `${record.firebaseKey}_${index}_${main.title.replace(/\s+/g, '_')}`;
// Pattern 3: With assessment ID and tab ID (matches MLGO)
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
        {main.fieldType === "integer" 
          ? new Intl.NumberFormat('en-US').format(parseFloat(answer.value))
          : main.fieldType === "date" 
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
                                        </div>

{/* Mode of Verification for main indicators */}
{main.verification && (
  <div className="reference-verification-full"
  style={{
    width:"98.57%"
  }}>
  
    <div className="reference-row" style={{
      display: "flex",
      border: "none",
    }}>

      <div className="reference-label" style={{
        width: "46%",
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
        
        {/* Attachments section - View Only */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          width: "100%"
        }}>
{(() => {
  const attachmentsByIndicator = lgu.attachmentsByIndicator || {};
  
  // Try multiple patterns to find attachments (same as in the lookup)
  const pattern1 = `${record.firebaseKey}_${index}_${main.title}`;
  const pattern2 = `${record.firebaseKey}_${index}_${main.title.replace(/\s+/g, '_')}`;
  const pattern3 = `${selectedAssessmentId}_${activeTab}_${record.firebaseKey}_${index}_${main.title}`;
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
  
  return indicatorAttachments.length > 0 && (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "8px",
      width: "100%"
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
          <span style={{ fontSize: "12px" }}>📎</span>
          <span style={{ 
            overflow: "hidden", 
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "#0c1a4b",
            flex: 1
          }}>
            {attachment.name || 'Attachment'}
          </span>
          
          <button
            onClick={() => viewAttachment(attachment)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              fontSize: "14px",
              color: "#0c1a4b",
              display: "flex",
              alignItems: "center",
              borderRadius: "4px",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#8ebd98"}
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
              padding: "2px 4px",
              fontSize: "16px",
              color: "#0c1a4b",
              display: "flex",
              alignItems: "center",
              borderRadius: "4px",
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#8ebd98"}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            title="Download attachment"
          >
            <FiDownload/>
          </button>
        </div>
      ))}
    </div>
  );
})()}
        </div>
      </div>
    </div>
  </div>
)}
                                      
                                                                           {/* ===== PO REMARK DISPLAY (READ ONLY FOR VERIFIED) ===== */}
                                      {isVerified ? (
                                        (() => {
                                          const remarkValue = indicatorRemarks[activeTab]?.[getIndicatorPath(record, index)] || "";
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
                                                <span>PO Remark:</span>
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
                                      ) : (
                                        <IndicatorRemarkEditor
                                          tabId={activeTab}
                                          indicatorPath={getIndicatorPath(record, index)}
                                          placeholder="📝 Add PO remark for this indicator..."
                                          onRemarkChange={(path, remark) => {
                                            setIndicatorRemarks(prev => ({
                                              ...prev,
                                              [activeTab]: {
                                                ...prev[activeTab],
                                                [path]: remark
                                              }
                                            }));
                                          }}
                                          currentValue={indicatorRemarks[activeTab]?.[getIndicatorPath(record, index)] || ""}
                                        />
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
      {sub.verification && (
        <div className="reference-verification-full" style={{ width: "100%" }}>
          <div className="reference-row" style={{ display: "flex", border: "none" }}>
            <div className="reference-label" style={{
              width: "46%",
              background: "transparent",
              borderRight: "1px solid rgba(8, 26, 75, 0.25)",
              padding: "6px 12px",
              border: "none",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              textAlign: "left",
            }}>
              <span style={{ display: "inline-block", flexShrink: 0, fontWeight: 700, color: "#081a4b" }}>Mode of Verification</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                {Array.isArray(sub.verification) ? (
                  sub.verification.map((v, idx) => (
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
                  ))
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                    <span style={{
                      width: "6px",
                      height: "6px",
                      backgroundColor: "black",
                      borderRadius: "50%",
                      display: "inline-block",
                      flexShrink: 0,
                      marginLeft: "50px"
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
                    width: "100%"
                  }}>
                    {subIndicatorAttachments.map((attachment, idx) => (
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
                        <span style={{ fontSize: "12px" }}>📎</span>
                        <span style={{ 
                          overflow: "hidden", 
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "#0c1a4b",
                          flex: 1
                        }}>
                          {attachment.name || 'Attachment'}
                        </span>
                        
                        <button
                          onClick={() => viewAttachment(attachment)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "2px 4px",
                            fontSize: "14px",
                            color: "#0c1a4b",
                            display: "flex",
                            alignItems: "center",
                            borderRadius: "4px",
                            transition: "all 0.2s"
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#8ebd98"}
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
                            padding: "2px 4px",
                            fontSize: "16px",
                            color: "#0c1a4b",
                            display: "flex",
                            alignItems: "center",
                            borderRadius: "4px",
                            transition: "all 0.2s"
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#8ebd98"}
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
      
          {/* ===== PO REMARK DISPLAY (READ ONLY FOR VERIFIED) ===== */}
      {isVerified ? (
        (() => {
          const remarkValue = indicatorRemarks[activeTab]?.[getIndicatorPath(record, null, index)] || "";
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
                <span>PO Remark:</span>
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
      ) : (
        <IndicatorRemarkEditor
          tabId={activeTab}
          indicatorPath={getIndicatorPath(record, null, index)}
          placeholder="📝 Add PO remark for this indicator..."
          onRemarkChange={(path, remark) => {
            setIndicatorRemarks(prev => ({
              ...prev,
              [activeTab]: {
                ...prev[activeTab],
                [path]: remark
              }
            }));
          }}
          currentValue={indicatorRemarks[activeTab]?.[getIndicatorPath(record, null, index)] || ""}
        />
      )}
      
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
      
      return (
              <div key={nested.id || nestedIndex} className="nested-reference-item">
                <div className="nested-reference-row">
                  <div className="nested-reference-label">
                    {nested.title || 'Untitled'}
                  </div>
                  <div className="nested-reference-field">
                    
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
                
                {nested.verification && (
                  <div className="reference-verification-full" style={{ width: "100%" }}>
                    <div className="reference-row" style={{ display: "flex", border: "none" }}>
                      <div className="reference-label" style={{
                        width: "46%",
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
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                          {Array.isArray(nested.verification) ? (
                            nested.verification.map((v, idx) => (
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
                            ))
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                              <span style={{
                                width: "6px",
                                height: "6px",
                                backgroundColor: "black",
                                borderRadius: "50%",
                                display: "inline-block",
                                flexShrink: 0,
                                marginLeft: "50px"
                              }}></span>
                              <span style={{ fontStyle: "italic", fontSize: "12px" }}>{nested.verification}</span>
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
                              width: "100%"
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
                                  <span style={{ fontSize: "12px" }}>📎</span>
                                  <span style={{ 
                                    overflow: "hidden", 
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    color: "#0c1a4b",
                                    flex: 1
                                  }}>
                                    {attachment.name || 'Attachment'}
                                  </span>
                                  
                                  <button
                                    onClick={() => viewAttachment(attachment)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: "2px 4px",
                                      fontSize: "14px",
                                      color: "#0c1a4b",
                                      display: "flex",
                                      alignItems: "center",
                                      borderRadius: "4px",
                                      transition: "all 0.2s"
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#8ebd98"}
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
                                      padding: "2px 4px",
                                      fontSize: "16px",
                                      color: "#0c1a4b",
                                      display: "flex",
                                      alignItems: "center",
                                      borderRadius: "4px",
                                      transition: "all 0.2s"
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#8ebd98"}
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
                
                             {/* ===== PO REMARK DISPLAY (READ ONLY FOR VERIFIED) ===== */}
                {isVerified ? (
                  (() => {
                    const remarkValue = indicatorRemarks[activeTab]?.[getIndicatorPath(record, null, index, nestedIndex)] || "";
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
                          <span>PO Remark:</span>
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
                ) : (
                  <IndicatorRemarkEditor
                    tabId={activeTab}
                    indicatorPath={getIndicatorPath(record, null, index, nestedIndex)}
                    placeholder="📝 Add PO remark for this indicator..."
                    onRemarkChange={(path, remark) => {
                      setIndicatorRemarks(prev => ({
                        ...prev,
                        [activeTab]: {
                          ...prev[activeTab],
                          [path]: remark
                        }
                      }));
                    }}
                    currentValue={indicatorRemarks[activeTab]?.[getIndicatorPath(record, null, index, nestedIndex)] || ""}
                  />
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
                          No assessment data available.
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
      disabled={isVerified || isReturned}
      style={{
        backgroundColor: (isVerified || isReturned) 
          ? (verifiedFlag[activeTab] ? "#8b5a5a" : "#5a7a5a")
          : (verifiedFlag[activeTab] ? "#dc3545" : "#28a745"),
        color: "white",
        border: "none",
        padding: "10px 30px",
        borderRadius: "5px",
        fontSize: "14px",
        cursor: (isVerified || isReturned) ? "not-allowed" : "pointer",
        fontWeight: "600",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        opacity: (isVerified || isReturned) ? 0.7 : 1
      }}
    >
      <span>⚐</span>
      {verifiedFlag[activeTab] ? `Remove Flag` : `Flag as Verified`}
    </button>
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