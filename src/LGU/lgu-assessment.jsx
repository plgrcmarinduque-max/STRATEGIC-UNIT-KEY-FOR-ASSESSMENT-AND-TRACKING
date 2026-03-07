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
import 'jspdf-autotable';

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
  const [activeTab, setActiveTab] = useState("financial");
  
  // State variables for all 10 categories
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

  // Load user answers
  const loadUserAnswers = async () => {
    if (!auth.currentUser || !selectedYearDisplay) return;
    
    try {
      const userName = profileData.name || auth.currentUser.email || "Anonymous";
      const cleanName = userName.replace(/[.#$\[\]]/g, '_');
      
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
            
            setMetadata(_metadata || {});
            setUserAnswers(answers || {});
            
            const hasForwardingFlags = 
              _metadata?.forwardedToPO === true || 
              _metadata?.forwarded === true ||
              _metadata?.forwardedAt || 
              _metadata?.forwardedBy ||
              _metadata?.forwardedTo;
            
            if (_metadata && _metadata.returned === true) {
              setHasSubmitted(false);
            } else if (hasForwardingFlags) {
              setHasSubmitted(true);
            } else if (_metadata && _metadata.submitted === true) {
              setHasSubmitted(true);
            } else {
              setHasSubmitted(false);
            }
          } else {
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
  useEffect(() => {
    if (!auth.currentUser || !selectedYearDisplay) return;

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
            `financial/${adminUid}/${selectedYearDisplay}/metadata/deadline`
          );
          
          onValue(deadlineRef, (snapshot) => {
            if (snapshot.exists()) {
              const deadline = snapshot.val();
              setSubmissionDeadline(deadline);
            } else {
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
  }, [selectedYearDisplay, db]);

  // Fetch all indicators for all 10 categories
  useEffect(() => {
    if (!auth.currentUser || !selectedYearDisplay) return;

    const fetchAllIndicators = async () => {
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
          // Define all 10 categories
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
                `financial/${adminUid}/${selectedYearDisplay}/${category.path}/assessment`
              );
            } else {
              indicatorsRef = ref(
                db,
                `${category.key}/${adminUid}/${selectedYearDisplay}/${category.path}/assessment`
              );
            }
            
            const snapshot = await get(indicatorsRef);
            
            if (snapshot.exists()) {
              const data = snapshot.val();
              const indicatorsArray = Object.keys(data).map(key => ({
                firebaseKey: key,
                ...data[key]
              }));
              
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
        }
      } catch (error) {
        console.error("Error fetching indicators:", error);
      }
    };

    fetchAllIndicators();
  }, [selectedYearDisplay, db]);

  // Handle answer change
// Handle answer change
const handleAnswerChange = (indicatorKey, mainIndex, field, value) => {
  // Check if assessment is locked
  if (hasSubmitted || metadata?.forwardedToPO) return;
  
  setUserAnswers(prev => ({
    ...prev,
    [`${activeTab}_${indicatorKey}_${mainIndex}_${field}`]: {
      category: activeTab,
      indicatorKey,
      mainIndex,
      field,
      value,
      timestamp: Date.now()
    }
  }));
};

// In lgu-assessment.jsx, update the handleSaveAnswers function
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
  
  if (!auth.currentUser || !selectedYearDisplay) return;
  
  setSavingAnswers(true);

  try {
    const userName = profileData.name || auth.currentUser.email || "Anonymous";
    const cleanName = userName.replace(/[.#$\[\]]/g, '_');
    
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
        
        const answerData = {
          ...userAnswers,
          _metadata: {
            uid: auth.currentUser.uid,
            email: auth.currentUser.email,
            name: profileData.name || auth.currentUser.email,
            municipality: profileData.municipality, // CRITICAL: Add this line
            lastSaved: Date.now(),
            submitted: true,
            year: selectedYearDisplay,
            sections: {
              financial: true,
              disaster: true,
              social: true,
              health: true,
              education: true,
              business: true,
              safety: true,
              environmental: true,
              tourism: true,
              youth: true
            }
          }
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
            title: `Assessment Form (${selectedYearDisplay}) has been submitted by LGU.`,
            message: `Assessment from ${profileData.name || auth.currentUser.email} has been submitted.`,
            from: auth.currentUser?.email,
            fromName: profileData.name || auth.currentUser?.email,
            timestamp: Date.now(),
            read: false,
            year: selectedYearDisplay,
            municipality: userMunicipality,
            action: "view_assessment"
          };
          
          await set(ref(db, `notifications/${selectedYearDisplay}/MLGO/${mlgoUid}/${notificationId}`), notificationData);
        }
        
        setHasSubmitted(true);
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

  // File upload handlers
  const handleFileUpload = async (indicatorKey, mainIndex, field, file) => {
    if (!file) return;
    
    setUploadingFile(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const attachmentData = {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileData: reader.result,
          uploadedAt: Date.now(),
          indicatorKey,
          mainIndex,
          field
        };
        
        const uniqueKey = `${indicatorKey}_${mainIndex}_${field}_${Date.now()}`;
        
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
  const handleSaveDraft = () => {
    if (!auth.currentUser || !selectedYearDisplay) return;
    
    try {
      const draftData = {
        answers: userAnswers,
        attachments: attachments,
        year: selectedYearDisplay,
        userId: auth.currentUser.uid,
        userName: profileData.name || auth.currentUser.email || "Anonymous",
        lastUpdated: Date.now()
      };
      
      localStorage.setItem(
        `draft_${auth.currentUser.uid}_${selectedYearDisplay}`,
        JSON.stringify(draftData)
      );
      
      setIsDraft(true);
      setLastSavedDraft(new Date().toLocaleTimeString());
      alert("Draft saved successfully!"); 
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Failed to save draft");
    }
  };

  const loadDraft = () => {
    if (!auth.currentUser || !selectedYearDisplay) return;
    
    try {
      const savedDraft = localStorage.getItem(
        `draft_${auth.currentUser.uid}_${selectedYearDisplay}`
      );
      
      if (savedDraft) {
        const draftData = JSON.parse(savedDraft);
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

  const clearDraft = () => {
    if (!auth.currentUser || !selectedYearDisplay) return;
    localStorage.removeItem(`draft_${auth.currentUser.uid}_${selectedYearDisplay}`);
    setIsDraft(false);
  };

  // Load data when year changes
  useEffect(() => {
    const loadDataForYear = async () => {
      if (!selectedYearDisplay) return;
      
      await loadUserAnswers();
      
      setTimeout(() => {
        if (!hasSubmitted) {
          loadDraft();
        }
      }, 100);
    };
    
    loadDataForYear();
  }, [selectedYearDisplay]);

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

  // Get current indicators based on active tab
  const getCurrentIndicators = () => {
    switch(activeTab) {
      case 'financial': return indicators;
      case 'disaster': return disasterIndicators;
      case 'social': return socialIndicators;
      case 'health': return healthIndicators;
      case 'education': return educationIndicators;
      case 'business': return businessIndicators;
      case 'safety': return safetyIndicators;
      case 'environmental': return environmentalIndicators;
      case 'tourism': return tourismIndicators;
      case 'youth': return youthIndicators;
      default: return indicators;
    }
  };

  const getCategoryTitle = () => {
    switch(activeTab) {
      case 'financial': return "Financial Administration and Sustainability";
      case 'disaster': return "Disaster Preparedness";
      case 'social': return "Social Protection and Sensitivity";
      case 'health': return "Health Compliance and Responsiveness";
      case 'education': return "Sustainable Education";
      case 'business': return "Business Friendliness and Competitiveness";
      case 'safety': return "Safety, Peace and Order";
      case 'environmental': return "Environmental Management";
      case 'tourism': return "Tourism, Heritage Development, Culture and Arts";
      case 'youth': return "Youth Development";
      default: return "Financial Administration and Sustainability";
    }
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
                <h3>ONE <span className="yellow">MAR</span><span className="cyan">IND</span>
                <span className="red">UQUE</span> TRACKING SYSTEM</h3>
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

        {!profileComplete && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            pointerEvents: "none"
          }}>
            <div style={{
              backgroundColor: "white",
              padding: "30px",
              borderRadius: "10px",
              textAlign: "center",
              maxWidth: "400px",
              pointerEvents: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.2)"
            }}>
              <h2 style={{ color: "#081a4b", marginBottom: "15px" }}>Complete Your Profile First</h2>
              <p style={{ color: "#666", fontSize: "16px" }}>
                Please set up your profile with your name and municipality to access the dashboard.
              </p>
            </div>
          </div>
        )}

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
                <select
                  className={styles.yearSelect}
                  value={newRecord.year}
                  onChange={(e) => {
                    const year = e.target.value;
                    setNewRecord({ ...newRecord, year: year });
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
                      disabled={savingAnswers || currentIndicators.length === 0 || !selectedYearDisplay}
                      style={{
                        backgroundColor: (savingAnswers || currentIndicators.length === 0 || !selectedYearDisplay) 
                          ? "#cccccc" 
                          : "#1b6e3a",
                        color: "white",
                        border: "none",
                        padding: "8px 20px",
                        borderRadius: "5px",
                        fontSize: "14px",
                        cursor: (savingAnswers || currentIndicators.length === 0 || !selectedYearDisplay) 
                          ? "not-allowed" 
                          : "pointer",
                        fontWeight: "600",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        opacity: (savingAnswers || currentIndicators.length === 0 || !selectedYearDisplay) 
                          ? 0.7 
                          : 1,
                        whiteSpace: "nowrap"
                      }}
                    >
                      {savingAnswers ? "Submitting..." : "Submit All Sections"}
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
                          exportFinancialPDF();
                          setShowExportModal(false);
                        }}
                      >
                        <div className={styles.pdfIcon}></div>
                        <h4>Financial, Administrative and Sustainability</h4>
                      </div>
                      
                      <div 
                        className={styles.exportDropdownItem}
                        onClick={() => {
                          exportAllAreasPDF();
                          setShowExportModal(false);
                        }}
                      >
                        <div className={styles.pdfIcon}></div>
                        <h4>Export All Area</h4>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className={styles.assessmentTabs}>
              <button 
                className={activeTab === 'financial' ? styles.activeTab : ''}
                onClick={() => setActiveTab('financial')}
              >
                Financial Administration and Sustainability
              </button>
              <button 
                className={activeTab === 'disaster' ? styles.activeTab : ''}
                onClick={() => setActiveTab('disaster')}
              >
                Disaster Preparedness
              </button>
              <button 
                className={activeTab === 'social' ? styles.activeTab : ''}
                onClick={() => setActiveTab('social')}
              >
                Social Protection and Sensitivity
              </button>
              <button 
                className={activeTab === 'health' ? styles.activeTab : ''}
                onClick={() => setActiveTab('health')}
              >
                Health Compliance and Responsiveness
              </button>
              <button 
                className={activeTab === 'education' ? styles.activeTab : ''}
                onClick={() => setActiveTab('education')}
              >
                Sustainable Education
              </button>
              <button 
                className={activeTab === 'business' ? styles.activeTab : ''}
                onClick={() => setActiveTab('business')}
              >
                Business Friendliness and Competitiveness
              </button>
              <button 
                className={activeTab === 'safety' ? styles.activeTab : ''}
                onClick={() => setActiveTab('safety')}
              >
                Safety, Peace and Order
              </button>
              <button 
                className={activeTab === 'environmental' ? styles.activeTab : ''}
                onClick={() => setActiveTab('environmental')}
              >
                Environmental Management
              </button>
              <button 
                className={activeTab === 'tourism' ? styles.activeTab : ''}
                onClick={() => setActiveTab('tourism')}
              >
                Tourism, Heritage Development, Culture and Arts
              </button>
              <button 
                className={activeTab === 'youth' ? styles.activeTab : ''}
                onClick={() => setActiveTab('youth')}
              >
                Youth Development
              </button>
            </div>

{/* Form Section */}
<div className={styles.lgutableBox}>
  <div className={styles.scrollableContent}
    style={{ 
      maxHeight: sidebarOpen ? '57vh' : '63vh',
    }}
  >
    {/* Return Remarks Display */}
    {hasSubmitted === false && metadata?.returned && (
      <div style={{
        backgroundColor: "#fff3cd",
        border: "1px solid #ffeeba",
        borderRadius: "8px",
        padding: "15px",
        marginBottom: "20px",
        color: "#856404",
        width: "100%"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
          <span style={{ fontSize: "18px" }}>📝</span>
          <strong>Remarks from MLGOO:</strong>
        </div>
        <p style={{ margin: "0 0 0 25px", fontSize: "14px" }}>
          {metadata?.remarks || "Please review and resubmit."}
        </p>
      </div>
    )}

    {currentIndicators.length === 0 ? (
      <p style={{ textAlign: "center", marginTop: "20px" }}>
        No indicators added yet for {categoryTitle} in {selectedYearDisplay || "selected year"}.
      </p>
    ) : (
      <>
        {currentIndicators.map((record) => (
          <div key={record.firebaseKey} className="reference-wrapper">
            
            {/* Main Indicators */}
            {record.mainIndicators?.map((main, index) => {
              const answerKey = `${activeTab}_${record.firebaseKey}_${index}_${main.title}`;
              const answer = userAnswers[answerKey];
              
              return (
                <div key={index} className="reference-wrapper">
                  {/* Indicator Row - Exact style from po-view with blue shade */}
                  <div className="reference-row" style={{
                    display: "flex",
                    border: "1px solid #cfcfcf",
                    marginBottom: "0"
                  }}>
                    <div className="reference-label" style={{
                      width: "45%",
                      background: "#e6f0fa", // Light blue shade as in po-view
                      padding: "12px 12px",
                      fontWeight: 500,
                      borderRight: "1px solid #cfcfcf",
                      color: "#0c1a4b" // Dark blue text
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
                            const isSelected = answer?.value === choice;
                            
                            return (
                              <div key={i} style={{ marginBottom: "4px" }}>
                                <input 
                                  type="radio" 
                                  name={`${record.firebaseKey}_${index}`}
                                  value={choice}
                                  checked={isSelected}
                                  onChange={(e) => handleAnswerChange(
                                    record.firebaseKey,
                                    index,
                                    main.title,
                                    e.target.value
                                  )}
                                  disabled={hasSubmitted || metadata?.forwardedToPO}
                                /> 
                                <span style={{ marginLeft: "4px" }}>
                                  {choice || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
                                </span>
                              </div>
                            );
                          })}

                        {main.fieldType === "checkbox" &&
                          main.choices.map((choice, i) => {
                            const checkboxKey = `${activeTab}_${record.firebaseKey}_${index}_${main.title}_${i}`;
                            const isChecked = userAnswers[checkboxKey]?.value === true;
                            
                            return (
                              <div key={i} style={{ marginBottom: "4px" }}>
                                <input 
                                  type="checkbox" 
                                  checked={isChecked}
                                  onChange={(e) => handleAnswerChange(
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

                  {/* Mode of Verification with Attachments - Exact style from po-view */}
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
                        gap: "10px",
                        padding: "3px 12px",
                        background: "#ffffff",
                        borderTop: "none",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, marginRight: "6px", color: "#081a4b" }}>Mode of Verification:</span>
                          <span style={{ fontStyle: "italic" }}>{main.verification}</span>
                        </div>
                        
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
                      
                      {/* Attachments for this indicator */}
                      {Object.keys(attachments).filter(key => 
                        key.startsWith(`${record.firebaseKey}_${index}_${main.title}`)
                      ).length > 0 && (
                        <div style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          marginTop: "8px",
                          marginBottom: "8px",
                          marginLeft: "12px",
                          width: "100%"
                        }}>
                          {Object.entries(attachments)
                            .filter(([key, value]) => 
                              key.startsWith(`${record.firebaseKey}_${index}_${main.title}`)
                            )
                            .map(([key, attachment]) => (
                              <div key={key} style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                backgroundColor: "#e8f5e9",
                                padding: "4px 10px",
                                borderRadius: "16px",
                                fontSize: "11px",
                                border: "1px solid #c8e6c9",
                                maxWidth: "180px"
                              }}>
                                <span style={{ fontSize: "12px" }}>📎</span>
                                <span style={{ 
                                  overflow: "hidden", 
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap"
                                }}>
                                  {attachment.fileName}
                                </span>
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
                                      padding: "0 2px",
                                      marginLeft: "2px"
                                    }}
                                    title="Remove attachment"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Sub Indicators */}
            {record.subIndicators?.map((sub, index) => {
              const answerKey = `${activeTab}_${record.firebaseKey}_sub_${index}_${sub.title}`;
              const answer = userAnswers[answerKey];
              
              return (
                <div key={index} className="reference-wrapper">
                  {/* Sub Indicator Row - Matching po-view style with lighter background */}
                  <div className="reference-row sub-row" style={{
                    
                    display: "flex",
                    marginTop: "5px",
                    marginLeft: "15px"
                    
                  }}>
                    <div className="reference-label" style={{
                      
                      width: "45%",
                      background: "#fff6f6", // Light pink for sub-indicators
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
                          const isSelected = answer?.value === choice;
                          
                          return (
                            <div key={i} style={{ marginBottom: "4px" }}>
                              <input 
                                type="radio" 
                                name={`${record.firebaseKey}_sub_${index}`}
                                value={choice}
                                checked={isSelected}
                                onChange={(e) => handleAnswerChange(
                                  record.firebaseKey,
                                  `sub_${index}`,
                                  sub.title,
                                  e.target.value
                                )}
                                disabled={hasSubmitted || metadata?.forwardedToPO}
                              /> 
                              <span style={{ marginLeft: "4px" }}>
                                {choice || <span style={{ fontStyle: "italic", color: "gray" }}>Empty Option</span>}
                              </span>
                            </div>
                          );
                        })}

                      {sub.fieldType === "checkbox" &&
                        sub.choices.map((choice, i) => {
                          const checkboxKey = `${activeTab}_${record.firebaseKey}_sub_${index}_${sub.title}_${i}`;
                          const isChecked = userAnswers[checkboxKey]?.value === true;
                          
                          return (
                            <div key={i} style={{ marginBottom: "4px" }}>
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={(e) => handleAnswerChange(
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
                    <div className="reference-verification-full" style={{ 
                      display: "flex",
                      flexDirection: "column",
                      width: "98.5%",
                      marginLeft: "15px"
                    }}>
                      <div style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                        width: "100%",
                        gap: "10px",
                        padding: "6px 12px",
                        background: "#ffffff",
                        borderTop: "none"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, marginRight: "6px", color: "#081a4b" }}>Mode of Verification:</span>
                          <span style={{ fontStyle: "italic" }}>{sub.verification}</span>
                        </div>
                        
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
                      
                      {/* Attachments for sub indicators */}
                      {Object.keys(attachments).filter(key => 
                        key.startsWith(`${record.firebaseKey}_sub_${index}_${sub.title}`)
                      ).length > 0 && (
                        <div style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          marginTop: "8px",
                          marginBottom: "8px",
                          marginLeft: "12px",
                          width: "100%"
                        }}>
                          {Object.entries(attachments)
                            .filter(([key, value]) => 
                              key.startsWith(`${record.firebaseKey}_sub_${index}_${sub.title}`)
                            )
                            .map(([key, attachment]) => (
                              <div key={key} style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                backgroundColor: "#e8f5e9",
                                padding: "4px 10px",
                                borderRadius: "16px",
                                fontSize: "11px",
                                border: "1px solid #c8e6c9",
                                maxWidth: "180px"
                              }}>
                                <span style={{ fontSize: "12px" }}>📎</span>
                                <span style={{ 
                                  overflow: "hidden", 
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap"
                                }}>
                                  {attachment.fileName}
                                </span>
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
                                      padding: "0 2px",
                                      marginLeft: "2px"
                                    }}
                                    title="Remove attachment"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ===== NESTED SUB-INDICATORS SECTION - EXACT STYLE FROM po-view ===== */}
                  {sub.nestedSubIndicators && sub.nestedSubIndicators.length > 0 && (
                    <div className="nested-reference-wrapper" style={{ marginLeft: "30px", marginTop: "10px" }}>
                      {sub.nestedSubIndicators.map((nested, nestedIndex) => {
                        const nestedAnswerKey = `${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}`;
                        const nestedAnswer = userAnswers[nestedAnswerKey];
                        
                        return (
                          <div key={nested.id || nestedIndex} className="nested-reference-item" style={{ marginBottom: "15px" }}>
                            <div className="nested-reference-row" style={{ display: "flex", border: "1px solid #cfcfcf" }}>
                              <div className="nested-reference-label" style={{ 
                                width: "45%", 
                                background: "#f0f0f0", // Light gray for nested indicators
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
                                  const isSelected = nestedAnswer?.value === choice;
                                  
                                  return (
                                    <div key={i} style={{ marginBottom: "4px" }}>
                                      <input 
                                        type="radio" 
                                        name={`${record.firebaseKey}_sub_${index}_nested_${nestedIndex}`}
                                        value={choice}
                                        checked={isSelected}
                                        onChange={(e) => handleAnswerChange(
                                          record.firebaseKey,
                                          `sub_${index}_nested_${nestedIndex}`,
                                          nested.title,
                                          e.target.value
                                        )}
                                        disabled={hasSubmitted || metadata?.forwardedToPO}
                                      /> 
                                      <span style={{ marginLeft: "4px" }}>{choice}</span>
                                    </div>
                                  );
                                })}

                                {/* Nested Checkbox */}
                                {nested.fieldType === "checkbox" && nested.choices?.map((choice, i) => {
                                  const nestedCheckboxKey = `${activeTab}_${record.firebaseKey}_sub_${index}_nested_${nestedIndex}_${nested.title}_${i}`;
                                  const isChecked = userAnswers[nestedCheckboxKey]?.value === true;
                                  
                                  return (
                                    <div key={i} style={{ marginBottom: "4px" }}>
                                      <input 
                                        type="checkbox" 
                                        checked={isChecked}
                                        onChange={(e) => handleAnswerChange(
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

                                {/* Nested Integer */}
                                {nested.fieldType === "integer" && (
                                  <input
                                    type="number"
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
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* ===== END NESTED SUB-INDICATORS SECTION ===== */}
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
                ✓ FINAL SUBMITTED
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