import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import "src/PO-CSS/po-indicators.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import lgrcLogo from "src/assets/lgrc.png";
import { FiSave, FiTrash2, FiPlus, FiX } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, push, onValue, set, remove, get } from "firebase/database";

export default function POIndicators() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isEditingAssessment, setIsEditingAssessment] = useState(false);
const [editingAssessmentName, setEditingAssessmentName] = useState("");
  const [hasMainUnsavedChanges, setHasMainUnsavedChanges] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSavingIndicator, setIsSavingIndicator] = useState(false);
  const user = auth.currentUser;
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const displayName = user?.email || "User";
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  // Add this with your other useState declarations (around line 50-60)
const [unsavedTabData, setUnsavedTabData] = useState({});
  // Store data for ALL tabs, not just current tab
  const [allTabsData, setAllTabsData] = useState({});
  
  // Get selected data from location state
  const selectedYear = location.state?.year;
  const selectedAssessment = location.state?.assessment;
  const selectedAssessmentId = location.state?.assessmentId;
  
  const [activeItem, setActiveItem] = useState(""); 
  const [formError, setFormError] = useState("");
  const [showAddTabModal, setShowAddTabModal] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [isAddingTab, setIsAddingTab] = useState(false);
  
  // ===== DYNAMIC TABS STATE =====
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState("");
  
  // ===== INDICATOR STATE =====
  const removeMainIndicator = (id) => {
    setMainIndicators((prev) => prev.filter((main) => main.id !== id));
  };

  const removeSubIndicator = (id) => {
    setSubIndicators((prev) => prev.filter((sub) => sub.id !== id));
  };

  // Helper function to sanitize keys (add this with other helper functions)
const sanitizeKey = (key) => {
  return key.replace(/[.#$\[\]/:]/g, '_');
};


  const removeNestedSubIndicator = (parentId, nestedId) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === parentId) {
          return {
            ...sub,
            nestedSubIndicators: (sub.nestedSubIndicators || []).filter(
              (nested) => nested.id !== nestedId
            ),
          };
        }
        return sub;
      })
    );
  };

  const initialMainIndicators = [
    {
      id: 1,
      title: "",
      fieldType: "",
      choices: [],
      verification: [],
    },
  ];

  const initialSubIndicators = [
    {
      id: 1,
      title: "",
      fieldType: "",
      choices: [],
      verification: [],
      nestedSubIndicators: [],
    },
  ];
  
  const [mainIndicators, setMainIndicators] = useState(initialMainIndicators);
  const [subIndicators, setSubIndicators] = useState(initialSubIndicators);

  const [editProfileData, setEditProfileData] = useState({
    name: "",
    email: displayName,
    image: ""
  });

  const [editingTabId, setEditingTabId] = useState(null);
const [editingTabName, setEditingTabName] = useState("");

  const [profileData, setProfileData] = useState({
    name: "",
    email: displayName,
    image: ""
  });
  const [data, setData] = useState([]);
  const [editRecordKey, setEditRecordKey] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  // Track unsaved changes in the main page
useEffect(() => {
  // Check if any tab has data
  const hasAnyData = Object.keys(allTabsData).some(tabId => 
    allTabsData[tabId] && allTabsData[tabId].length > 0
  );
  setHasMainUnsavedChanges(hasAnyData);
}, [allTabsData]);

  // ===== LOAD ASSESSMENT TABS FROM DATABASE =====
  useEffect(() => {
    if (!auth.currentUser || !selectedYear || !selectedAssessmentId) return;

    console.log("Loading tabs for year:", selectedYear, "assessment:", selectedAssessmentId);

    // Load tabs/sub-indicators for the selected assessment
    const tabsRef = ref(
      db,
      `assessment-tabs/${auth.currentUser.uid}/${selectedYear}/${selectedAssessmentId}`
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
            dbPath: "assessment-tabs",
            assessmentPath: selectedAssessmentId,
            tabPath: childSnapshot.key
          });
        });
        
        // Sort tabs by order
        loadedTabs.sort((a, b) => (a.order || 0) - (b.order || 0));
      }

      console.log("Loaded tabs:", loadedTabs);
      setTabs(loadedTabs);

      // Set first tab as active if available
      if (loadedTabs.length > 0) {
        setActiveTab(loadedTabs[0].id);
        setActiveItem(loadedTabs[0].name);
      }
    });
  }, [selectedYear, selectedAssessmentId, auth.currentUser]);

  // Get current tab object
  const currentTab = tabs.find(t => t.id === activeTab) || null;

  // ===== TAB NAVIGATION =====
  const handleTabChange = (tabId, tabName) => {
    setActiveTab(tabId);
    setActiveItem(tabName);
    console.log(`Switched to tab: ${tabName}`);
  };

  // ===== ADD NEW TAB =====
  const handleAddTab = async () => {
    if (!auth.currentUser || !selectedYear || !selectedAssessmentId) return;
    if (!newTabName.trim()) {
      alert("Please enter an area name");
      return;
    }

    setIsAddingTab(true);
    try {
      const tabsRef = ref(
        db,
        `assessment-tabs/${auth.currentUser.uid}/${selectedYear}/${selectedAssessmentId}`
      );
      const newTabRef = push(tabsRef);
      
      await set(newTabRef, {
        name: newTabName,
        description: "",
        createdAt: new Date().toISOString(),
        order: tabs.length,
        status: "active"
      });

      setNewTabName("");
      setShowAddTabModal(false);
      console.log("Tab added successfully");
    } catch (error) {
      console.error("Error adding tab:", error);
      alert("Failed to add tab");
    } finally {
      setIsAddingTab(false);
    }
  };

// ===== DELETE TAB =====
const handleDeleteTab = async (tabId, tabName) => {
  if (!auth.currentUser || !selectedYear || !selectedAssessmentId) return;
  
  // Remove this check to allow deleting the last tab
  // if (tabs.length <= 1) {
  //   alert("Cannot delete the last tab");
  //   return;
  // }

  const confirmDelete = window.confirm(`Are you sure you want to delete "${tabName}"? This will delete all indicators in this area`);
  if (!confirmDelete) return;

  try {
    const tabRef = ref(
      db,
      `assessment-tabs/${auth.currentUser.uid}/${selectedYear}/${selectedAssessmentId}/${tabId}`
    );
    await remove(tabRef);

    // If the deleted tab was active, switch to another tab if available
    if (activeTab === tabId) {
      const remainingTabs = tabs.filter(t => t.id !== tabId);
      if (remainingTabs.length > 0) {
        setActiveTab(remainingTabs[0].id);
        setActiveItem(remainingTabs[0].name);
      } else {
        // No tabs left - clear active tab
        setActiveTab("");
        setActiveItem("");
      }
    }
  } catch (error) {
    console.error("Error deleting tab:", error);
    alert("Failed to delete tab");
  }
};

// Update tab name
const handleUpdateTabName = async (tabId, newName) => {
  if (!auth.currentUser || !selectedYear || !selectedAssessmentId) return;
  if (!newName.trim()) {
    alert("Area name cannot be empty");
    return;
  }

  try {
    const tabRef = ref(
      db,
      `assessment-tabs/${auth.currentUser.uid}/${selectedYear}/${selectedAssessmentId}/${tabId}/name`
    );
    await set(tabRef, newName);
    
    // Update local state
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, name: newName } : tab
    ));
    
    // If this was the active tab, update activeItem name
    if (activeTab === tabId) {
      setActiveItem(newName);
    }
    
    setEditingTabId(null);
    setEditingTabName("");
  } catch (error) {
    console.error("Error updating tab name:", error);
    alert("Failed to update area name");
  }
};

  // Save submission deadline to database
// Save submission deadline to database - CORRECT PATH
const saveSubmissionDeadline = async () => {
  if (!auth.currentUser || !selectedYear || !selectedAssessmentId || !submissionDeadline) return;
  
  try {
    // Save to assessment-specific path
    const deadlineRef = ref(
      db,
      `financial/${auth.currentUser.uid}/${selectedYear}/assessments/${selectedAssessmentId}/deadline`
    );
    await set(deadlineRef, submissionDeadline);
    console.log("Deadline saved successfully for assessment:", selectedAssessmentId);
  } catch (error) {
    console.error("Error saving deadline:", error);
  }
};
  
  // Add Main Indicator
  const addMainIndicator = () => {
    setMainIndicators((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        title: "",
        fieldType: "",
        choices: [],
        verification: [],
      },
    ]);
  };

  // Add Nested Sub Indicator
  const addNestedSubIndicator = (parentId) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === parentId) {
          const nestedSubs = sub.nestedSubIndicators || [];
          return {
            ...sub,
            nestedSubIndicators: [
              ...nestedSubs,
              {
                id: nestedSubs.length + 1,
                title: "",
                fieldType: "",
                choices: [],
                verification: [],
              },
            ],
          };
        }
        return sub;
      })
    );
  };

  // Update Nested Sub Indicator
  const updateNestedSubIndicator = (parentId, nestedId, field, value) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === parentId) {
          return {
            ...sub,
            nestedSubIndicators: (sub.nestedSubIndicators || []).map((nested) =>
              nested.id === nestedId ? { ...nested, [field]: value } : nested
            ),
          };
        }
        return sub;
      })
    );
  };

  // Update Nested Sub Indicator choices
  const updateNestedChoice = (parentId, nestedId, index, value) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === parentId) {
          return {
            ...sub,
            nestedSubIndicators: (sub.nestedSubIndicators || []).map((nested) => {
              if (nested.id === nestedId) {
                const updatedChoices = [...(nested.choices || [])];
                updatedChoices[index] = value;
                return { ...nested, choices: updatedChoices };
              }
              return nested;
            }),
          };
        }
        return sub;
      })
    );
  };

  // Add choice to nested sub indicator
  const addNestedChoice = (parentId, nestedId) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === parentId) {
          return {
            ...sub,
            nestedSubIndicators: (sub.nestedSubIndicators || []).map((nested) =>
              nested.id === nestedId
                ? { ...nested, choices: [...(nested.choices || []), ""] }
                : nested
            ),
          };
        }
        return sub;
      })
    );
  };

  // Remove choice from nested sub indicator
  const removeNestedChoice = (parentId, nestedId, index) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === parentId) {
          return {
            ...sub,
            nestedSubIndicators: (sub.nestedSubIndicators || []).map((nested) => {
              if (nested.id === nestedId) {
                const filtered = (nested.choices || []).filter((_, i) => i !== index);
                return { ...nested, choices: filtered };
              }
              return nested;
            }),
          };
        }
        return sub;
      })
    );
  };

  // ===== VERIFICATION OPTIONS FUNCTIONS =====
  
  // Add verification option to main indicator
  const addMainVerification = (mainId) => {
    setMainIndicators((prev) =>
      prev.map((main) => {
        if (main.id === mainId) {
          return {
            ...main,
            verification: [...(main.verification || []), ""]
          };
        }
        return main;
      })
    );
  };

  // Update verification option for main indicator
  const updateMainVerification = (mainId, index, value) => {
    setMainIndicators((prev) =>
      prev.map((main) => {
        if (main.id === mainId) {
          const updatedVerification = [...(main.verification || [])];
          updatedVerification[index] = value;
          return { ...main, verification: updatedVerification };
        }
        return main;
      })
    );
  };

  // Remove verification option from main indicator
  const removeMainVerification = (mainId, index) => {
    setMainIndicators((prev) =>
      prev.map((main) => {
        if (main.id === mainId) {
          const filtered = (main.verification || []).filter((_, i) => i !== index);
          return { ...main, verification: filtered };
        }
        return main;
      })
    );
  };

  // Add verification option to sub indicator
  const addSubVerification = (subId) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === subId) {
          return {
            ...sub,
            verification: [...(sub.verification || []), ""]
          };
        }
        return sub;
      })
    );
  };

  // Update verification option for sub indicator
  const updateSubVerification = (subId, index, value) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === subId) {
          const updatedVerification = [...(sub.verification || [])];
          updatedVerification[index] = value;
          return { ...sub, verification: updatedVerification };
        }
        return sub;
      })
    );
  };

  // Remove verification option from sub indicator
  const removeSubVerification = (subId, index) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === subId) {
          const filtered = (sub.verification || []).filter((_, i) => i !== index);
          return { ...sub, verification: filtered };
        }
        return sub;
      })
    );
  };

  // Add verification option to nested sub indicator
  const addNestedVerification = (parentId, nestedId) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === parentId) {
          return {
            ...sub,
            nestedSubIndicators: (sub.nestedSubIndicators || []).map((nested) =>
              nested.id === nestedId
                ? { ...nested, verification: [...(nested.verification || []), ""] }
                : nested
            ),
          };
        }
        return sub;
      })
    );
  };

  // Update verification option for nested sub indicator
  const updateNestedVerification = (parentId, nestedId, index, value) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === parentId) {
          return {
            ...sub,
            nestedSubIndicators: (sub.nestedSubIndicators || []).map((nested) => {
              if (nested.id === nestedId) {
                const updatedVerification = [...(nested.verification || [])];
                updatedVerification[index] = value;
                return { ...nested, verification: updatedVerification };
              }
              return nested;
            }),
          };
        }
        return sub;
      })
    );
  };

  // Remove verification option from nested sub indicator
  const removeNestedVerification = (parentId, nestedId, index) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === parentId) {
          return {
            ...sub,
            nestedSubIndicators: (sub.nestedSubIndicators || []).map((nested) => {
              if (nested.id === nestedId) {
                const filtered = (nested.verification || []).filter((_, i) => i !== index);
                return { ...nested, verification: filtered };
              }
              return nested;
            }),
          };
        }
        return sub;
      })
    );
  };

// Open modal to edit a specific record
const handleEditRecord = (record) => {
  const mainIndicatorsCopy = record.mainIndicators ? 
    record.mainIndicators.map(main => ({
      ...main,
      choices: main.choices ? [...main.choices] : [],
      // Convert verification to array if it's a string
      verification: main.verification 
        ? (Array.isArray(main.verification) ? [...main.verification] : [main.verification])
        : []
    })) : [];
  
  const subIndicatorsCopy = record.subIndicators ? 
    record.subIndicators.map(sub => ({
      ...sub,
      choices: sub.choices ? [...sub.choices] : [],
      // Convert verification to array if it's a string
      verification: sub.verification 
        ? (Array.isArray(sub.verification) ? [...sub.verification] : [sub.verification])
        : [],
      nestedSubIndicators: sub.nestedSubIndicators ? 
        sub.nestedSubIndicators.map(nested => ({
          ...nested,
          choices: nested.choices ? [...nested.choices] : [],
          // Convert verification to array if it's a string
          verification: nested.verification 
            ? (Array.isArray(nested.verification) ? [...nested.verification] : [nested.verification])
            : []
        })) : []
    })) : [];

  setMainIndicators(mainIndicatorsCopy);
  setSubIndicators(subIndicatorsCopy);
  setShowModal(true);
  setEditRecordKey(record.firebaseKey);
};

const handleDeleteRecord = async (firebaseKey) => {
  if (!auth.currentUser || !currentTab) return;
  const confirmDelete = window.confirm("Are you sure you want to delete this indicator?");
  if (!confirmDelete) return;

  const tabId = currentTab.id;
  
  // Update local data
  const newData = data.filter((item) => item.firebaseKey !== firebaseKey);
  setData(newData);
  
  // Update unsavedTabData
  setUnsavedTabData(prev => {
    const currentTabUnsaved = prev[tabId] || (allTabsData[tabId] ? [...allTabsData[tabId]] : []);
    const filteredData = currentTabUnsaved.filter((item) => item.firebaseKey !== firebaseKey);
    return {
      ...prev,
      [tabId]: filteredData
    };
  });
  
  setHasMainUnsavedChanges(true);
};
const handleAddIndicator = () => {
  if (!isIndicatorValid()) return;
  if (!currentTab) {
    alert("No area selected");
    return;
  }
const cleanMainIndicators = mainIndicators.map(main => ({
  id: main.id,
  title: sanitizeKey(main.title || ""),  // ← SANITIZE!
  fieldType: main.fieldType || "",
  choices: (main.choices || []).map(choice => choice || ""),
  verification: (main.verification || []).map(v => v || ""),
  ...(main.value !== undefined && { value: main.value })
}));

const cleanSubIndicators = subIndicators.map(sub => ({
  id: sub.id,
  title: sanitizeKey(sub.title || ""),  // ← SANITIZE!
  fieldType: sub.fieldType || "",
  choices: (sub.choices || []).map(choice => choice || ""),
  verification: (sub.verification || []).map(v => v || ""),
  nestedSubIndicators: (sub.nestedSubIndicators || []).map(nested => ({
    id: nested.id,
    title: sanitizeKey(nested.title || ""),  // ← SANITIZE!
    fieldType: nested.fieldType || "",
    choices: (nested.choices || []).map(choice => choice || ""),
    verification: (nested.verification || []).map(v => v || ""),
    ...(nested.value !== undefined && { value: nested.value })
  })),
  ...(sub.value !== undefined && { value: sub.value })
}));

  const firebaseKey = editRecordKey || Date.now().toString();
  const newRecord = {
    firebaseKey: firebaseKey,
    mainIndicators: cleanMainIndicators,
    subIndicators: cleanSubIndicators,
    createdAt: Date.now(),
  };

  const tabId = currentTab.id;
  
  // Update local data state
  let updatedData;
  setData((prev) => {
    if (editRecordKey) {
      updatedData = prev.map((item) =>
        item.firebaseKey === editRecordKey ? newRecord : item
      );
    } else {
      updatedData = [...prev, newRecord];
    }
    return updatedData;
  });
  
  // Save to unsavedTabData (not allTabsData)
  setUnsavedTabData(prev => {
    const currentTabUnsaved = prev[tabId] || (allTabsData[tabId] ? [...allTabsData[tabId]] : []);
    let newTabData;
    if (editRecordKey) {
      newTabData = currentTabUnsaved.map((item) =>
        item.firebaseKey === editRecordKey ? newRecord : item
      );
    } else {
      newTabData = [...currentTabUnsaved, newRecord];
    }
    return {
      ...prev,
      [tabId]: newTabData
    };
  });

  // Mark that there are unsaved changes
  setHasMainUnsavedChanges(true);

  // Reset modal state
  setMainIndicators(initialMainIndicators);
  setSubIndicators(initialSubIndicators);
  setShowModal(false);
  setEditRecordKey(null);
  setHasUnsavedChanges(false);
};

  // Update Main Indicator
  const updateMainIndicator = (id, field, value) => {
    setMainIndicators((prev) =>
      prev.map((main) =>
        main.id === id ? { ...main, [field]: value } : main
      )
    );
  };

  // Update Main Choices
  const updateMainChoice = (mainId, index, value) => {
    setMainIndicators((prev) =>
      prev.map((main) => {
        if (main.id === mainId) {
          const updatedChoices = [...main.choices];
          updatedChoices[index] = value;
          return { ...main, choices: updatedChoices };
        }
        return main;
      })
    );
  };

  // Add Main Choice
  const addMainChoice = (mainId) => {
    setMainIndicators((prev) =>
      prev.map((main) =>
        main.id === mainId
          ? { ...main, choices: [...main.choices, ""] }
          : main
      )
    );
  };

  // Remove Main Choice
  const removeMainChoice = (mainId, index) => {
    setMainIndicators((prev) =>
      prev.map((main) => {
        if (main.id === mainId) {
          const filtered = main.choices.filter((_, i) => i !== index);
          return { ...main, choices: filtered };
        }
        return main;
      })
    );
  };

 // Back button handler
const handleBackToDashboard = () => {
  if (isNavigating) return;
  
    // Check if there are unsaved changes in unsavedTabData
  const hasUnsaved = Object.keys(unsavedTabData).length > 0;
  if (hasUnsaved) {
    const confirmLeave = window.confirm("You have unsaved changes. Are you sure you want to leave? All unsaved changes will be lost.");
    if (!confirmLeave) return;
  }
  
  setIsNavigating(true);
  navigate("/dashboard");
};

  // Load profile
  useEffect(() => {
    if (!auth.currentUser) return;

    const profileRef = ref(db, `profiles/${auth.currentUser.uid}`);
    onValue(profileRef, (snapshot) => {
      if (snapshot.exists()) {
        const profile = snapshot.val();
        setProfileData(profile);

        if (!profile.name) {
          setShowEditProfileModal(true);
        }
      } else {
        setShowEditProfileModal(true);
      }
    });
  }, []);

// Track unsaved changes
useEffect(() => {
  if (showModal) {
    // Check if any indicator has content
    const hasMainContent = mainIndicators.some(main => 
      main.title.trim() !== "" || 
      main.fieldType !== "" || 
      (main.choices && main.choices.length > 0) ||
      (main.verification && main.verification.length > 0)
    );
    
    const hasSubContent = subIndicators.some(sub => 
      sub.title.trim() !== "" || 
      sub.fieldType !== "" || 
      (sub.choices && sub.choices.length > 0) ||
      (sub.verification && sub.verification.length > 0) ||
      (sub.nestedSubIndicators && sub.nestedSubIndicators.length > 0)
    );
    
    setHasUnsavedChanges(hasMainContent || hasSubContent);
  }
}, [mainIndicators, subIndicators, showModal]);
// Load data for ALL tabs when component mounts and when tabs change
// Load data for ALL tabs when component mounts and when tabs change
useEffect(() => {
  if (!auth.currentUser || !selectedYear || !selectedAssessmentId || tabs.length === 0) return;

  const loadAllTabsData = async () => {
    const newAllTabsData = {};
    
    for (const tab of tabs) {
      const dataRef = ref(
        db,
        `assessment-data/${auth.currentUser.uid}/${selectedYear}/${selectedAssessmentId}/${tab.tabPath}/assessment`
      );
      
      const snapshot = await get(dataRef);
      const records = [];
      let counter = 1;
      
      if (snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const record = childSnapshot.val();
          
          const convertedRecord = {
            ...record,
            mainIndicators: (record.mainIndicators || []).map(main => ({
              ...main,
              verification: main.verification 
                ? (Array.isArray(main.verification) ? main.verification : [main.verification])
                : []
            })),
            subIndicators: (record.subIndicators || []).map(sub => ({
              ...sub,
              verification: sub.verification 
                ? (Array.isArray(sub.verification) ? sub.verification : [sub.verification])
                : [],
              nestedSubIndicators: (sub.nestedSubIndicators || []).map(nested => ({
                ...nested,
                verification: nested.verification 
                  ? (Array.isArray(nested.verification) ? nested.verification : [nested.verification])
                  : []
              }))
            }))
          };
          
          records.push({
            ...convertedRecord,
            id: counter++,
            firebaseKey: childSnapshot.key,
          });
        });
      }
      
      newAllTabsData[tab.id] = records;
      console.log(`📊 Loaded ${records.length} indicators for ${tab.name}`);
    }
    
    // ALWAYS set the data from Firebase - this ensures we have the latest saved data
    setAllTabsData(newAllTabsData);
  };
  
  loadAllTabsData();
}, [tabs, selectedYear, selectedAssessmentId, auth.currentUser]);

// When tab changes, just set data from the global state (no reload)
// Replace your existing useEffect that sets data from allTabsData (around line 780-790)
useEffect(() => {
  if (currentTab && allTabsData[currentTab.id]) {
    // If there are unsaved changes for this tab, use those instead
    if (unsavedTabData[currentTab.id]) {
      setData(unsavedTabData[currentTab.id]);
      console.log(`📋 Using unsaved data for tab ${currentTab.name}: ${unsavedTabData[currentTab.id].length} records`);
    } else {
      setData(allTabsData[currentTab.id]);
      console.log(`📋 Loaded saved data for tab ${currentTab.name}: ${allTabsData[currentTab.id].length} records`);
    }
  } else if (currentTab) {
    setData([]);
  }
}, [currentTab, allTabsData, unsavedTabData]);

  // Load submission deadline for the selected year and assessment

useEffect(() => {
  if (!auth.currentUser || !selectedYear || !selectedAssessmentId) return;

  const loadSubmissionDeadline = async () => {
    try {
      const deadlineRef = ref(
        db,
        `financial/${auth.currentUser.uid}/${selectedYear}/assessments/${selectedAssessmentId}/deadline`
      );
      
      onValue(deadlineRef, (snapshot) => {
        if (snapshot.exists()) {
          setSubmissionDeadline(snapshot.val());
          console.log("Deadline loaded for assessment:", selectedAssessmentId, snapshot.val());
        } else {
          setSubmissionDeadline("");
        }
      });
    } catch (error) {
      console.error("Error loading deadline:", error);
    }
  };

  loadSubmissionDeadline();
}, [selectedYear, selectedAssessmentId, auth.currentUser?.uid]);
const handleSaveChanges = async () => {
  if (!auth.currentUser || isSavingIndicator || !selectedYear || !selectedAssessmentId) return;

  try {
    setIsSavingIndicator(true);

    // Save data for ALL tabs - USE unsavedTabData if available
    for (const tab of tabs) {
      // Use unsaved data if exists, otherwise use saved data
      const tabData = unsavedTabData[tab.id] || allTabsData[tab.id] || [];
      
      const tabRef = ref(
        db,
        `assessment-data/${auth.currentUser.uid}/${selectedYear}/${selectedAssessmentId}/${tab.tabPath}/assessment`
      );

      const updatedData = {};
      tabData.forEach((item) => {
        const recordKey = item.firebaseKey;
        
      const cleanMainIndicators = (item.mainIndicators || []).map(main => ({
  id: main.id || 0,
  title: sanitizeKey(main.title || ""),  // ← SANITIZE!
  fieldType: main.fieldType || "",
  choices: (main.choices || []).filter(choice => choice !== undefined && choice !== null).map(choice => choice || ""),
  verification: (main.verification || []).filter(v => v !== undefined && v !== null).map(v => v || ""),
  ...(main.value !== undefined && { value: main.value })
}));

const cleanSubIndicators = (item.subIndicators || []).map(sub => ({
  id: sub.id || 0,
  title: sanitizeKey(sub.title || ""),  // ← SANITIZE!
  fieldType: sub.fieldType || "",
  choices: (sub.choices || []).filter(choice => choice !== undefined && choice !== null).map(choice => choice || ""),
  verification: (sub.verification || []).filter(v => v !== undefined && v !== null).map(v => v || ""),
  nestedSubIndicators: (sub.nestedSubIndicators || []).map(nested => ({
    id: nested.id || 0,
    title: sanitizeKey(nested.title || ""),  // ← SANITIZE!
    fieldType: nested.fieldType || "",
    choices: (nested.choices || []).filter(choice => choice !== undefined && choice !== null).map(choice => choice || ""),
    verification: (nested.verification || []).filter(v => v !== undefined && v !== null).map(v => v || ""),
    ...(nested.value !== undefined && { value: nested.value })
  })),
  ...(sub.value !== undefined && { value: sub.value })
}));

        updatedData[recordKey] = {
          mainIndicators: cleanMainIndicators,
          subIndicators: cleanSubIndicators,
          createdAt: item.createdAt || Date.now(),
        };
      });

      const removeUndefined = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) {
          return obj.map(item => removeUndefined(item)).filter(item => item !== undefined && item !== null);
        }
        return Object.fromEntries(
          Object.entries(obj)
            .filter(([_, value]) => value !== undefined && value !== null)
            .map(([key, value]) => [key, removeUndefined(value)])
        );
      };

      const cleanData = removeUndefined(updatedData);
      await set(tabRef, cleanData);
      console.log(`✅ Saved ${Object.keys(cleanData).length} records for tab: ${tab.name}`);
    }
    
    if (submissionDeadline) {
      await saveSubmissionDeadline();
    }

    // ===== RELOAD THE DATA FROM FIREBASE AFTER SAVING =====
    const newAllTabsData = {};
    for (const tab of tabs) {
      const dataRef = ref(
        db,
        `assessment-data/${auth.currentUser.uid}/${selectedYear}/${selectedAssessmentId}/${tab.tabPath}/assessment`
      );
      
      const snapshot = await get(dataRef);
      const records = [];
      let counter = 1;
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        Object.keys(data).forEach((firebaseKey) => {
          const record = data[firebaseKey];
          const convertedRecord = {
            ...record,
            firebaseKey: firebaseKey,
            mainIndicators: (record.mainIndicators || []).map(main => ({
              ...main,
              verification: main.verification 
                ? (Array.isArray(main.verification) ? main.verification : [main.verification])
                : []
            })),
            subIndicators: (record.subIndicators || []).map(sub => ({
              ...sub,
              verification: sub.verification 
                ? (Array.isArray(sub.verification) ? sub.verification : [sub.verification])
                : [],
              nestedSubIndicators: (sub.nestedSubIndicators || []).map(nested => ({
                ...nested,
                verification: nested.verification 
                  ? (Array.isArray(nested.verification) ? nested.verification : [nested.verification])
                  : []
              }))
            }))
          };
          records.push({
            ...convertedRecord,
            id: counter++,
            firebaseKey: firebaseKey,
          });
        });
      }
      newAllTabsData[tab.id] = records;
    }
    
    setAllTabsData(newAllTabsData);
    setUnsavedTabData({}); // Clear unsaved changes after successful save
    
    // Update current tab data
    if (currentTab && newAllTabsData[currentTab.id]) {
      setData(newAllTabsData[currentTab.id]);
    }

        setShowSaveConfirm(false);
    // Reset all unsaved states
    setHasMainUnsavedChanges(false);
    setUnsavedTabData({});
    alert(`Changes saved for all ${tabs.length} area(s) (${selectedYear})`);
  } catch (error) {
    console.error("Error saving changes:", error);
    alert("Failed to save changes: " + error.message);
  } finally {
    setIsSavingIndicator(false);
  }
};

  const handleSaveProfile = async () => {
    if (!auth.currentUser) return;

    try {
      setSavingProfile(true);

      await set(ref(db, `profiles/${auth.currentUser.uid}`), {
        ...editProfileData,
        email: auth.currentUser.email
      });

      setProfileData(editProfileData);

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

  const handleSignOut = () => {
    const confirmLogout = window.confirm("Are you sure you want to sign out?");
    if (confirmLogout) {
      navigate("/login");
    }
  };

  // Handler to add a new blank sub-indicator
  const addSubIndicator = () => {
    setSubIndicators((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        title: "",
        fieldType: "",
        choices: [],
        verification: [],
        nestedSubIndicators: [],
      },
    ]);
  };

  // Handler to update a sub-indicator property by id
  const updateSubIndicator = (id, field, value) => {
    setSubIndicators((prev) =>
      prev.map((sub) =>
        sub.id === id ? { ...sub, [field]: value } : sub
      )
    );
  };

  // Handler to update choices for multiple or checkbox types
  const updateChoice = (subId, index, value) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === subId) {
          const updatedChoices = [...sub.choices];
          updatedChoices[index] = value;
          return { ...sub, choices: updatedChoices };
        }
        return sub;
      })
    );
  };

  // Add new choice for multiple or checkbox
  const addChoice = (subId) => {
    setSubIndicators((prev) =>
      prev.map((sub) =>
        sub.id === subId
          ? { ...sub, choices: [...sub.choices, ""] }
          : sub
      )
    );
  };

  // Remove a choice
  const removeChoice = (subId, index) => {
    setSubIndicators((prev) =>
      prev.map((sub) => {
        if (sub.id === subId) {
          const filteredChoices = sub.choices.filter(
            (_, i) => i !== index
          );
          return { ...sub, choices: filteredChoices };
        }
        return sub;
      })
    );
  };

  const isIndicatorValid = () => {
    const validateField = (indicator) => {
      if (!indicator.title.trim()) return false;
      
      if (indicator.fieldType !== undefined && !indicator.fieldType) return false;

      if (
        indicator.fieldType === "multiple" ||
        indicator.fieldType === "checkbox"
      ) {
        if (!indicator.choices || !indicator.choices.length) return false;

        const hasEmptyChoice = indicator.choices.some(
          (choice) => !choice.trim()
        );

        if (hasEmptyChoice) return false;
      }

      return true;
    };

    const validateNested = (nested) => {
      if (!nested.title.trim()) return false;
      return true;
    };

    const mainValid = mainIndicators.every(validateField);
    const subValid = subIndicators.every((sub) => {
      if (!validateField(sub)) return false;
      
      if (sub.nestedSubIndicators && sub.nestedSubIndicators.length > 0) {
        return sub.nestedSubIndicators.every(validateNested);
      }
      
      return true;
    });

    return mainValid && subValid;
  };

  return (
    <div className="dashboard-scale">
      <div className="dashboard">
        {/* Sidebar */}
{/* Sidebar */}
<div className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
  <div className="encodesidebar-header">
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
        className="encodeback-btn"
        onClick={handleBackToDashboard}
        disabled={isNavigating}
      >
        {isNavigating ? "Loading..." : "⬅ BACK"}
      </button>

      <div className="sidebar-menu" style={{ 
        maxHeight: "calc(100vh - 200px)", 
        overflowY: "auto",
        paddingRight: "5px"
      }}>
{tabs.length > 0 ? (
  tabs.map((tab) => (
    <div
      key={tab.id}
      className={`sidebar-item ${activeItem === tab.name ? "active" : ""}`}
      style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between",
        padding: "10px",
        position: "relative"
      }}
    >
                             {editingTabId === tab.id ? (
                        <input
                          type="text"
                          value={editingTabName}
                          onChange={(e) => setEditingTabName(e.target.value)}
                          onBlur={() => handleUpdateTabName(tab.id, editingTabName)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateTabName(tab.id, editingTabName);
                            }
                          }}
                          autoFocus
                          style={{
                            flex: 1,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            backgroundColor: "rgba(255, 255, 255, 0.15)",
                            color: "white",
                            fontSize: "14px",
                            marginRight: "5px",
                            outline: "none"
                          }}
                        />
      ) : (
        <span 
          style={{ 
            flex: 1, 
            cursor: "pointer",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            paddingRight: "25px"
          }}
          onClick={() => handleTabChange(tab.id, tab.name)}
          onDoubleClick={() => {
            setEditingTabId(tab.id);
            setEditingTabName(tab.name);
          }}
          title="Double-click to edit area name"
        >
          {tab.name}
        </span>
      )}
      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTab(tab.id, tab.name);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ffffff",
                          cursor: "pointer",
                          fontSize: "18px",
                          fontWeight: "bold",
                          padding: "0 5px",
                          position: "absolute",
                          right: "5px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          borderRadius: "50%",
                          width: "24px",
                          height: "24px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.2s ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                        title="Delete tab"
                      >
                        ×
                      </button>
    </div>
  ))
) : (
          <div className="sidebar-item disabled" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
            No areas created yet.
          </div>
        )}
        
        {/* Add Tab Button */}
        <button
          onClick={() => setShowAddTabModal(true)}
          style={{
            width: "100%",
            padding: "10px",
            marginTop: "10px",
            background: "#2c3e50",
            border: "1px dashed #fff",
            color: "white",
            borderRadius: "4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            transition: "background-color 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#34495e";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#2c3e50";
          }}
        >
          <FiPlus /> Add Area
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
              <div className="topbar-left">
        {isEditingAssessment ? (
  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
   <input
  type="text"
  value={editingAssessmentName}
  onChange={(e) => setEditingAssessmentName(e.target.value)}
  onBlur={handleRenameAssessment}
  onKeyPress={(e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameAssessment();
    }
  }}
  autoFocus
style={{
  fontSize: "24px",
  fontWeight: "bold",
  padding: "5px 10px",
  border: "1px solid black",
  borderRadius: "4px",
  outline: "none",
  background: "transparent"
}}
/>
    <button
      onClick={() => {
        setIsEditingAssessment(false);
        setEditingAssessmentName("");
      }}
      style={{
        background: "none",
        border: "none",
        fontSize: "20px",
        cursor: "pointer",
        color: "#990202"
      }}
    >
      ✕
    </button>
  </div>
) : (
<h2 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
  {selectedAssessment || "Provincial Assessment"}
  {selectedYear && (
    <span style={{ marginLeft: "5px", fontSize: "24px", fontWeight: "bold", color: "#000000" }}>
      ({selectedYear})
    </span>
  )}
</h2>
)}
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

          <div className="action-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* Left side - Submission Deadline box */}
            <div className="deadline-container" style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "10px" }}>
              <label htmlFor="submission-deadline" style={{ fontWeight: "700", color: "#000000" }}>
                Submission Deadline:
              </label>
              <input
                type="date"
                id="submission-deadline"
                className="deadline-input"
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  fontSize: "14px",
                  backgroundColor: "#fff",
                  cursor: "pointer",
                }}
                disabled={!currentTab}
              />
            </div>

            {/* Right side - Save Changes button */}
            <button 
              className="savechanges-btn" 
              onClick={() => setShowSaveConfirm(true)}
              disabled={!currentTab}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2
                2 0 0 0 2-2V7l-4-4zM12 19a3 3 0 1 1 0-6 3 3 0 0 1
                0 6zM6 8V5h9v3H6z"/>
              </svg>
              Save Changes
            </button>
          </div>

          {/* Table */}
          <div className="po-indicators-table-box">
            <div className="po-indicators-table-header">
              <h3 className="table-title">
                {currentTab ? currentTab.name : "Select area"}
              </h3>
            </div>

            <div className="scrollable-content">
              {!currentTab && (
                <p style={{ textAlign: "center", marginTop: "20px" }}>
                  No area selected. Please select or create area.
                </p>
              )}

              {data.length === 0 && currentTab && (
                <p style={{ textAlign: "center", marginTop: "20px" }}>
                  No indicators added yet.
                </p>
              )}

              {data.map((record) => (
                <div key={record.firebaseKey} className="reference-wrapper">
                  {record.mainIndicators?.map((main, index) => (
                    <div key={index} className="reference-wrapper">
                      <div className="reference-row">
                        <div className="reference-label">{main.title}</div>

                        <div className="mainreference-field with-buttons">
                          <div className="field-content">
                            {main.fieldType === "multiple" &&
                              main.choices.map((choice, i) => (
                                <div key={i}>
                                  <input type="radio" disabled /> {choice || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
                                </div>
                              ))}

                            {main.fieldType === "checkbox" &&
                              main.choices.map((choice, i) => (
                                <div key={i}>
                                  <input type="checkbox" disabled /> {choice || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
                                </div>
                              ))}

     {main.fieldType === "short" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>Short Answer</span>
)}

{main.fieldType === "integer" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>Integer/Value</span>
)}
{main.fieldType === "date" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>
    {main.value
      ? new Date(main.value).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Date"}
  </span>
)}

{main.fieldType === "no-input" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>No Input Field</span>
)}
                          </div>

                          <div className="record-actions inside-field">
                            <button
                              className="edit-btn"
                              onClick={() => handleEditRecord(record)}
                              aria-label="Edit"
                              title="Edit"
                            >
                              ✎ Edit
                            </button>
                            <button
                              className="delete-btn"
                              onClick={() => handleDeleteRecord(record.firebaseKey)}
                              aria-label="Delete"
                              title="Delete"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        </div>
                      </div>

                      {main.verification && main.verification.length > 0 && (
  <div className="reference-verification-full">
    <span className="reference-verification-label">Mode of Verification:</span>
    <div className="verification-options" style={{ 
      marginLeft: "20px",
      marginTop: "5px"
    }}>
      {main.verification.map((v, idx) => (
        <div key={idx} style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "10px",
          marginBottom: "4px"
        }}>
          <span style={{
            width: "8px",
            height: "8px",
            backgroundColor: "black",
            borderRadius: "50%",
            display: "inline-block"
          }}></span>
          <span className="reference-verification-value">{v}</span>
        </div>
      ))}
    </div>
  </div>
)}
                    </div>
                  ))}

                  {record.subIndicators?.map((sub, index) => (
                    <div key={index} className="reference-wrapper">
                      <div className="reference-row sub-row">
                        <div className="reference-label">{sub.title}</div>

                        <div className="reference-field">
                          {sub.fieldType === "multiple" &&
                            sub.choices.map((choice, i) => (
                              <div key={i}>
                                <input type="radio" disabled /> {choice || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
                              </div>
                            ))}

                          {sub.fieldType === "checkbox" &&
                            sub.choices.map((choice, i) => (
                              <div key={i}>
                                <input type="checkbox" disabled /> {choice || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
                              </div>
                            ))}

       {sub.fieldType === "short" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>Short Answer</span>
)}

{sub.fieldType === "integer" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>Integer/Value</span>
)}

{sub.fieldType === "date" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>
    {sub.value
      ? new Date(sub.value).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Date"}
  </span>
)}

{sub.fieldType === "no-input" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>No Input Field</span>
)}
                        </div>
                      </div>

                      {sub.verification && sub.verification.length > 0 && (
  <div className="reference-verification-full">
    <span className="reference-verification-label">Mode of Verification:</span>
    <div className="verification-options" style={{ 
      marginLeft: "20px",
      marginTop: "5px"
    }}>
      {sub.verification.map((v, idx) => (
        <div key={idx} style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "10px",
          marginBottom: "4px"
        }}>
          <span style={{
            width: "8px",
            height: "8px",
            backgroundColor: "black",
            borderRadius: "50%",
            display: "inline-block"
          }}></span>
          <span className="reference-verification-value">{v}</span>
        </div>
      ))}
    </div>
  </div>
)}

                      {/* Display nested sub-indicators */}
                      {sub.nestedSubIndicators && sub.nestedSubIndicators.length > 0 && (
                        <div className="nested-reference-wrapper">
                          {sub.nestedSubIndicators.map((nested, nestedIndex) => (
                            <div key={nested.id || nestedIndex} className="nested-reference-item">
                              <div className="nested-reference-row">
                                <div className="nested-reference-label">
                                  {nested.title || 'Untitled'}
                                </div>
                                <div className="nested-reference-field">
                                  {nested.fieldType === "multiple" && nested.choices?.map((choice, i) => (
                                    <div key={i}>
                                      <input type="radio" disabled /> {choice || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
                                    </div>
                                  ))}

                                  {nested.fieldType === "checkbox" && nested.choices?.map((choice, i) => (
                                    <div key={i}>
                                      <input type="checkbox" disabled /> {choice || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
                                    </div>
                                  ))}

       {nested.fieldType === "short" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>Short Answer</span>
)}

{nested.fieldType === "integer" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>Integer/Value</span>
)}

{nested.fieldType === "date" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>
    {nested.value
      ? new Date(nested.value).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Date"}
  </span>
)}

{nested.fieldType === "no-input" && (
  <span style={{ fontStyle: "italic", color: "gray" }}>No Input Field</span>
)}

                                  {!nested.fieldType && (
                                    <span style={{ fontStyle: "italic", color: "gray" }}>No field type selected</span>
                                  )}
                                </div>
                              </div>
                              
                              {nested.verification && nested.verification.length > 0 && (
  <div className="nested-verification">
    <span className="verification-label" style={{textAlign: "left", display: "block" }}>Mode of Verification:</span>
    <div className="verification-options" style={{ 
      marginLeft: "20px",
      marginTop: "5px"
    }}>
      {nested.verification.map((v, idx) => (
        <div key={idx} style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "10px",
          marginBottom: "4px"
        }}>
          <span style={{
            width: "8px",
            height: "8px",
            backgroundColor: "black",
            borderRadius: "50%",
            display: "inline-block"
          }}></span>
          <span className="verification-value">{v}</span>
        </div>
      ))}
    </div>
  </div>
)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <button 
              className="btn-new" 
              onClick={() => setShowModal(true)}
              disabled={!currentTab}
              style={{ opacity: !currentTab ? 0.5 : 1, cursor: !currentTab ? 'not-allowed' : 'pointer' }}
            >
              <span style={{ fontSize: "20px", fontWeight: "bold" }}>＋</span>
              New Indicator
            </button>
          </div>
        </div>

        {/* Profile Modal */}
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
                      setEditProfileData(profileData);
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

        {/* Edit Profile Modal */}
        {showEditProfileModal && (
          <div className="modal-overlay">
            <div className="add-record-modal profile-modal">
              <div className="modal-header">
                <h3>Edit Profile</h3>
      <span
  className="close-x"
  onClick={() => {
    setEditProfileData(profileData);
    setShowEditProfileModal(false);
  }}
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
                    disabled={savingProfile || !editProfileData.name.trim()}
                  >
                    {savingProfile ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Tab Modal */}
        {showAddTabModal && (
          <div className="modal-overlay">
            <div className="add-record-modal" style={{ maxWidth: "400px" }}>
              <div className="modal-header">
                <h3>Add New Area</h3>
                <span className="close-x" onClick={() => setShowAddTabModal(false)}>✕</span>
              </div>
              <div className="modal-body">
                <div className="modal-field">
                  <label>Area Name:</label>
                  <input
                    type="text"
                    value={newTabName}
                    onChange={(e) => setNewTabName(e.target.value)}
                    placeholder="Enter area name"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newTabName.trim() && !isAddingTab) {
                        handleAddTab();
                      }
                    }}
                  />
                </div>
                <div className="modal-footer">
                  <button
                    className="save-profile-btn"
                    onClick={handleAddTab}
                    disabled={isAddingTab || !newTabName.trim()}
                  >
                    {isAddingTab ? "Adding..." : "ADD"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* New Indicator Modal */}
        {showModal && currentTab && (
          <div className="modal-overlay">
            <div className="indicator-modal">
  <div className={`indicator-header ${editRecordKey ? "edit-mode" : "new-mode"}`}>
  <div className="indicator-title">
    <span className="plus-icon">＋</span>
   <span>{editRecordKey ? "EDIT INDICATOR" : "NEW INDICATOR"} - {currentTab.name}</span>
  </div>
<span
  className="close-x"
  onClick={() => {
    if (hasUnsavedChanges) {
      setShowCancelConfirm(true);
    } else {
      setMainIndicators(initialMainIndicators);
      setSubIndicators(initialSubIndicators);
      setEditRecordKey(null);
      setShowModal(false);
    }
  }}
>
  ✕
</span>
</div>
              
              <div className="indicator-body">
                {/* INDICATOR SECTION */}
                <div className="indicator-section">
                  <h4>INDICATOR</h4>
                  {mainIndicators.map((main) => (
                    <div key={main.id} className="main-card">
                      <div className="main-header">
                        <div className="main-left">
                          <input
                            type="text"
                            placeholder="Title here . . . ."
                            value={main.title}
                            onChange={(e) =>
                              updateMainIndicator(main.id, "title", e.target.value)
                            }
                          />

                                                            {/* For field types that LGU will fill - show nothing */}
                                        {(main.fieldType === "no-input" || main.fieldType === "date" || main.fieldType === "short" || main.fieldType === "integer") && (
                                          <div style={{ display: "none" }}></div>
                                        )}

                                        {main.fieldType === "multiple" && (
                                          <div className="multiple-wrapper">
                                            {main.choices.map((choice, index) => (
                                              <div key={index} className="choice-row">
                                                <input type="radio" disabled />
                                                <input
                                                  type="text"
                                                  placeholder="Enter choice"
                                                  value={choice}
                                                  onChange={(e) =>
                                                    updateMainChoice(main.id, index, e.target.value)
                                                  }
                                                />
                                                <button
                                                  type="button"
                                                  className="remove-choice-btn"
                                                  onClick={() => removeMainChoice(main.id, index)}
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            ))}
                                            <button
                                              type="button"
                                              className="add-choice-btn"
                                              onClick={() => addMainChoice(main.id)}
                                            >
                                              <input type="radio" disabled className="add-radio" />
                                              <span>+ Add Option</span>
                                            </button>
                                          </div>
                                        )}

                                        {main.fieldType === "checkbox" && (
                                          <div className="multiple-wrapper">
                                            {main.choices.map((choice, index) => (
                                              <div key={index} className="choice-row">
                                                <input type="checkbox" disabled />
                                                <input
                                                  type="text"
                                                  placeholder="Enter choice"
                                                  value={choice}
                                                  onChange={(e) =>
                                                    updateMainChoice(main.id, index, e.target.value)
                                                  }
                                                />
                                                <button
                                                  type="button"
                                                  className="remove-choice-btn"
                                                  onClick={() => removeMainChoice(main.id, index)}
                                                >
                                                  ✕
                                                </button>
                                              </div>
                                            ))}
                                            <button
                                              type="button"
                                              className="add-choice-btn"
                                              onClick={() => addMainChoice(main.id)}
                                            >
                                              <input type="checkbox" disabled className="add-radio" />
                                              <span>+ Add Option</span>
                                            </button>
                                          </div>
                                        )}

                          {/* Mode of Verification with styling copied from checkbox/multiple choice */}
                          <div className="mainverification-row">
                            <label className="mainverification-label">
                              Mode of Verification:
                            </label>
                            <div className="multiple-wrapper"
                              style={{
                                marginTop:"-1%",
                                outline:"none"
                              }}>
                              {(main.verification || []).map((v, index) => (
                                <div key={index} className="choice-row"
                                style={{
                                marginBottom:"-2%"
                                }}>
                                  <span
                                      style={{
                                        width: "9px",
                                        height: "9px",
                                        backgroundColor: "black",
                                        borderRadius: "50%",
                                        display: "inline-block",
                                      }}
                                    ></span>
                                  <input
                                    type="text"
                                    placeholder="Enter item"
                                    value={v}
                                    onChange={(e) =>
                                      updateMainVerification(main.id, index, e.target.value)
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="remove-choice-btn"
                                    onClick={() => removeMainVerification(main.id, index)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                className="add-choice-btn"
                                onClick={() => addMainVerification(main.id)}
                                style={{
                                marginBottom:"2%",
                                border:"none"
                                }}
                              >
                                <span className="verification-bullet" 
                                  style={{
                                    width: "9px",
                                    height: "9px",
                                    backgroundColor: "black",
                                    borderRadius: "50%",
                                    display: "inline-block",
                                    marginTop:"15px"
                                  }}
                                ></span>
                                <span
                                style={{
                                marginTop:"9px"
                                }}
                                >+ Add Item</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <select
                          value={main.fieldType}
                          onChange={(e) => {
                            const newType = e.target.value;
                            updateMainIndicator(main.id, "fieldType", newType);
                            if (newType !== "multiple" && newType !== "checkbox") {
                              updateMainIndicator(main.id, "choices", []);
                            }
                            if (newType !== "date") {
                              updateMainIndicator(main.id, "value", "");
                            }
                          }}
                        >
                          <option value="" disabled hidden>Choose field</option>
                          <option value="no-input">No Input Field</option>
                          <option value="integer">Integer/Value</option>
                          <option value="short">Short Answer</option>
                          <option value="multiple">Multiple Choice</option>
                          <option value="checkbox">Checkboxes</option>
                          <option value="date">Date</option>
                        </select>

                        <button
                          type="button"
                          className="mainindicator-delete-btn"
                          onClick={() => removeMainIndicator(main.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* SUB-INDICATOR SECTION */}
                <div className="sub-section">
                  <h4>SUB-INDICATOR/S</h4>
                  {subIndicators.map((sub) => (
                    <div key={sub.id} className="sub-card">
                      <div className="sub-header">
                        <div className="sub-left">
                          <input
                            type="text"
                            placeholder="Title here . . . ."
                            value={sub.title}
                            onChange={(e) =>
                              updateSubIndicator(sub.id, "title", e.target.value)
                            }
                            style={{
                              height:"39.5px"
                            }}
                          />

                                                                      {/* For field types that LGU will fill - show nothing */}
                                          {(sub.fieldType === "no-input" || sub.fieldType === "date" || sub.fieldType === "short" || sub.fieldType === "integer") && (
                                            <div style={{ display: "none" }}></div>
                                          )}

                                          {sub.fieldType === "multiple" && (
                                            <div className="multiple-wrapper">
                                              {sub.choices.map((choice, index) => (
                                                <div key={index} className="choice-row">
                                                  <input type="radio" disabled />
                                                  <input
                                                    type="text"
                                                    placeholder="Enter choice"
                                                    value={choice}
                                                    onChange={(e) =>
                                                      updateChoice(sub.id, index, e.target.value)
                                                    }
                                                  />
                                                  <button
                                                    type="button"
                                                    className="remove-choice-btn"
                                                    onClick={() => removeChoice(sub.id, index)}
                                                  >
                                                    ✕
                                                  </button>
                                                </div>
                                              ))}
                                              <button
                                                type="button"
                                                className="add-choice-btn"
                                                onClick={() => addChoice(sub.id)}
                                              >
                                                <input type="radio" disabled className="add-radio" />
                                                <span>+ Add Option</span>
                                              </button>
                                            </div>
                                          )}

                                          {sub.fieldType === "checkbox" && (
                                            <div className="multiple-wrapper">
                                              {sub.choices.map((choice, index) => (
                                                <div key={index} className="choice-row">
                                                  <input type="checkbox" disabled />
                                                  <input
                                                    type="text"
                                                    placeholder="Enter choice"
                                                    value={choice}
                                                    onChange={(e) =>
                                                      updateChoice(sub.id, index, e.target.value)
                                                    }
                                                  />
                                                  <button
                                                    type="button"
                                                    className="remove-choice-btn"
                                                    onClick={() => removeChoice(sub.id, index)}
                                                  >
                                                    ✕
                                                  </button>
                                                </div>
                                              ))}
                                              <button
                                                type="button"
                                                className="add-choice-btn"
                                                onClick={() => addChoice(sub.id)}
                                              >
                                                <input type="checkbox" disabled className="add-radio" />
                                                <span>+ Add Option</span>
                                              </button>
                                            </div>
                                          )}
          {/* Mode of Verification for sub-indicator - matching main indicator style */}
          <div className="verification-row">
            <label className="verification-label">
              Mode of Verification:
            </label>
            <div className="multiple-wrapper"
              style={{
                marginTop:"-1%",
                outline:"none"
              }}>
              {(sub.verification || []).map((v, index) => (
                <div key={index} className="choice-row"
                  style={{
                    marginBottom:"-1.5%"
                  }}>
                  <span
                    style={{
                      width: "9px",
                      height: "9px",
                      backgroundColor: "black",
                      borderRadius: "50%",
                      display: "inline-block",
                    }}
                  ></span>
                  <input
                    type="text"
                    placeholder="Enter item"
                    value={v}
                    onChange={(e) =>
                      updateSubVerification(sub.id, index, e.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="remove-choice-btn"
                    onClick={() => removeSubVerification(sub.id, index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="add-choice-btn"
                onClick={() => addSubVerification(sub.id)}
                style={{
                  marginBottom:"1%",
                  border:"none"
                }}
              >
                <span 
                  style={{
                    width: "9px",
                    height: "9px",
                    backgroundColor: "black",
                    borderRadius: "50%",
                    display: "inline-block",
                    marginTop:"8px"
                  }}
                ></span>
                <span
                  style={{
                    marginTop:"5px"
                  }}
                >+ Add Item</span>
              </button>
            </div>
          </div>
                          
{/* Nested Sub-Indicators */}
{sub.nestedSubIndicators && sub.nestedSubIndicators.length > 0 && (
  <div className="nested-sub-indicators">
    {sub.nestedSubIndicators.map((nested) => (
      <div key={nested.id} className="nested-sub-card">
        <div className="nested-sub-header"
          style={{
            background:"white"
          }}>
          <div className="nested-sub-left" style={{ 
            flex: 1, 
            maxWidth: "calc(100% - 80px)",
            width: "500px",
          }}>
   <input
  type="text"
  className="nested-title-input"
  placeholder="Third-Level indicator title . . . ."
  value={nested.title}
  onChange={(e) =>
    updateNestedSubIndicator(sub.id, nested.id, "title", e.target.value)
  }
  style={{ 
    width: "104%", 
    maxWidth: "650px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    background: "#fff9c4"  /* Light yellow */
  }}
/>

                            {/* For field types that LGU will fill - show nothing */}
                 {(nested.fieldType === "no-input" || nested.fieldType === "date" || nested.fieldType === "short" || nested.fieldType === "integer") && (
                   <div style={{ display: "none" }}></div>
                 )}

                 {nested.fieldType === "multiple" && (
                   <div className="nested-multiple-wrapper" style={{ 
                     width: "154%", 
                     maxWidth: "650px",
                     marginTop:"-13px"
                   }}>
                     {(nested.choices || []).map((choice, idx) => (
                       <div key={idx} className="nested-choice-row">
                         <input type="radio" disabled />
                         <input
                           type="text"
                           placeholder="Enter choice"
                           value={choice}
                           onChange={(e) =>
                             updateNestedChoice(sub.id, nested.id, idx, e.target.value)
                           }
                           style={{
                             width: "100%",
                             whiteSpace: "nowrap",
                             overflow: "hidden",
                             textOverflow: "ellipsis",
                             background: "white",
                             border: "none"
                           }}
                         />
                         <button
                           type="button"
                           className="nested-remove-choice-btn"
                           onClick={() => removeNestedChoice(sub.id, nested.id, idx)}
                         >
                           ✕
                         </button>
                       </div>
                     ))}

                     <button
                       type="button"
                       className="nested-add-choice-btn"
                       onClick={() => addNestedChoice(sub.id, nested.id)}
                     >
                       <input type="radio" disabled className="nested-add-radio" />
                       <span>+ Add Option</span>
                     </button>
                   </div>
                 )}

                 {nested.fieldType === "checkbox" && (
                   <div className="nested-multiple-wrapper" style={{ 
                     width: "154%", 
                     maxWidth: "650px",
                     marginTop:"-13px"
                   }}>
                     {(nested.choices || []).map((choice, idx) => (
                       <div key={idx} className="nested-choice-row">
                         <input type="checkbox" disabled />
                         <input
                           type="text"
                           placeholder="Enter choice"
                           value={choice}
                           onChange={(e) =>
                             updateNestedChoice(sub.id, nested.id, idx, e.target.value)
                           }
                           style={{
                             width: "100%",
                             whiteSpace: "nowrap",
                             overflow: "hidden",
                             textOverflow: "ellipsis",
                             background: "white",
                             border: "none"
                           }}
                         />
                         <button
                           type="button"
                           className="nested-remove-choice-btn"
                           onClick={() => removeNestedChoice(sub.id, nested.id, idx)}
                         >
                           ✕
                         </button>
                       </div>
                     ))}

                     <button
                       type="button"
                       className="nested-add-choice-btn"
                       onClick={() => addNestedChoice(sub.id, nested.id)}
                     >
                       <input type="checkbox" disabled className="nested-add-radio" />
                       <span>+ Add Option</span>
                     </button>
                   </div>
                 )}

                      {/* Mode of Verification for nested sub-indicator - matching main indicator style */}
                      <div style={{ 
                        width: "105.7%", 
                        maxWidth: "650px",
                        marginTop: "-2.5px",
                        outline:"none"
                      }}>
                        <div className="verification-row">
                          <label className="verification-label">
                            Mode of Verification:
                          </label>
                          <div className="multiple-wrapper"
                            style={{
                              marginTop:"-1%",
                              outline:"none"
                            }}>
                            {(nested.verification || []).map((v, idx) => (
                              <div key={idx} className="choice-row"
                                style={{
                                  marginBottom:"-.7%"
                                }}>
                                <span
                                  style={{
                                    width: "9px",
                                    height: "9px",
                                    backgroundColor: "black",
                                    borderRadius: "50%",
                                    display: "inline-block",
                                  }}
                                ></span>
                                <input
                                  type="text"
                                  placeholder="Enter item"
                                  value={v}
                                  onChange={(e) =>
                                    updateNestedVerification(sub.id, nested.id, idx, e.target.value)
                                  }
                                  style={{
                                    background: "white",
                                    border: "none",
                                    width: "100%"
                                  }}
                                />
                                <button
                                  type="button"
                                  className="remove-choice-btn"
                                  onClick={() => removeNestedVerification(sub.id, nested.id, idx)}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className="add-choice-btn"
                              onClick={() => addNestedVerification(sub.id, nested.id)}
                              style={{
                                marginBottom:"1%",
                                border:"none"
                              }}
                            >
                              <span 
                                style={{
                                  width: "9px",
                                  height: "9px",
                                  backgroundColor: "black",
                                  borderRadius: "50%",
                                  display: "inline-block",
                                  marginTop:"4px"
                                }}
                              ></span>
                              <span
                                style={{
                                  marginTop:"4px"
                                }}
                              >+ Add Item</span>
                            </button>
                          </div>
                        </div>
                      </div>
          </div>

          <select
            className="nested-select-field"
            value={nested.fieldType}
            onChange={(e) => {
              const newType = e.target.value;
              updateNestedSubIndicator(sub.id, nested.id, "fieldType", newType);
              if (newType !== "multiple" && newType !== "checkbox") {
                updateNestedSubIndicator(sub.id, nested.id, "choices", []);
              }
              if (newType !== "date") {
                updateNestedSubIndicator(sub.id, nested.id, "value", "");
              }
            }}
          >
            <option value="" disabled hidden>Choose field</option>
            <option value="no-input">No Input Field</option>
            <option value="integer">Integer/Value</option>
            <option value="short">Short Answer</option>
            <option value="multiple">Multiple Choice</option>
            <option value="checkbox">Checkboxes</option>
            <option value="date">Date</option>
          </select>
          
          <button
            type="button"
            className="nested-delete-btn"
            onClick={() => removeNestedSubIndicator(sub.id, nested.id)}
          >
            ✕
          </button>
        </div>
      </div>
    ))}
  </div>
)}

                          <button
                            type="button"
                            className="add-nested-sub-btn"
                            onClick={() => addNestedSubIndicator(sub.id)}
                          >
                            <span className="subplus-icon">＋</span>
                            New Third-Level Indicator
                          </button>
                        </div>

                        <select
                          value={sub.fieldType}
                          style={{
                            height:"39.5px"
                          }}
                          onChange={(e) => {
                            const newType = e.target.value;
                            updateSubIndicator(sub.id, "fieldType", newType);
                            if (newType !== "multiple" && newType !== "checkbox") {
                              updateSubIndicator(sub.id, "choices", []);
                            }
                            if (newType !== "date") {
                              updateSubIndicator(sub.id, "value", "");
                            }
                          }}
                        >
                          <option value="" disabled hidden>Choose field</option>
                          <option value="no-input">No Input Field</option>
                          <option value="integer">Integer/Value</option>
                          <option value="short">Short Answer</option>
                          <option value="multiple">Multiple Choice</option>
                          <option value="checkbox">Checkboxes</option>
                          <option value="date">Date</option>
                        </select>

                        <button
                          type="button"
                          className="subindicator-delete-btn"
                          onClick={() => removeSubIndicator(sub.id)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {formError && (
                  <div style={{ color: "red", marginBottom: "10px" }}>
                    {formError}
                  </div>
                )}

                <div className="indicator-footer">
                  <button className="new-sub-btn" onClick={addSubIndicator}>
                    <span className="subplus-icon">＋</span>
                    New Sub-Indicator
                  </button>
           <button 
  className="add-indicator-btn"
  onClick={handleAddIndicator}
  disabled={!isIndicatorValid()}
  style={{
    opacity: !isIndicatorValid() ? 0.5 : 1,
    cursor: !isIndicatorValid() ? "not-allowed" : "pointer"
  }}
>
  {editRecordKey ? "SAVE" : "ADD"}
</button>
                </div>
              </div>
            </div>
          </div>
        )}

             {/* Save Confirm Modal */}
        {showSaveConfirm && (
          <div className="modal-overlay">
            <div className="confirm-modal">
              <h3>Save changes?</h3>
              <div className="confirm-buttons">
                <button
                  className="discard-btn"
                  onClick={() => setShowSaveConfirm(false)}
                  style={{ minWidth: "80px" }}
                >
                  Discard
                </button>
                <button
                  className="confirm-btn"
                  disabled={isSavingIndicator}
                  onClick={handleSaveChanges}
                  style={{ minWidth: "80px" }}
                >
                  {isSavingIndicator ? "Saving..." : "Yes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {showCancelConfirm && (
          <div className="modal-overlay">
            <div className="confirm-modal">
              <h3>Discard changes?</h3>
              <p style={{ marginBottom: "20px", fontSize: "14px" }}>
                You have unsaved changes. Are you sure you want to discard them?
              </p>
              <div className="confirm-buttons">
                <button
                  className="discard-btn"
                  onClick={() => {
                    setShowCancelConfirm(false);
                  }}
                  style={{ minWidth: "80px" }}
                >
                  Cancel
                </button>
                <button
                  className="confirm-btn"
                  onClick={() => {
                    setMainIndicators(initialMainIndicators);
                    setSubIndicators(initialSubIndicators);
                    setEditRecordKey(null);
                    setShowModal(false);
                    setShowCancelConfirm(false);
                    setHasUnsavedChanges(false);
                  }}
                  style={{ minWidth: "80px", background: "#990202", color: "white" }}
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}