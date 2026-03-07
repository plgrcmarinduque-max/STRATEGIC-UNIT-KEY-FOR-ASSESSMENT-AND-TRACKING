import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import "src/PO-CSS/financial-administration-and-sustainability.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiSave, FiTrash2 } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, push, onValue, set } from "firebase/database";


export default function SPO() {


  const navigate = useNavigate();
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
  const [subFieldType, setSubFieldType] = useState("");
  const [choices, setChoices] = useState([]);
  const location = useLocation();
  const selectedYear = location.state?.year;
  
  const [activeItem, setActiveItem] = useState(""); 
  const [formError, setFormError] = useState("");
  
  // Remove Main Indicator
  const removeMainIndicator = (id) => {
    setMainIndicators((prev) => prev.filter((main) => main.id !== id));
  };

  // Remove Sub Indicator (top level)
  const removeSubIndicator = (id) => {
    setSubIndicators((prev) => prev.filter((sub) => sub.id !== id));
  };

  // Remove Nested Sub Indicator
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
      verification: "",
    },
  ];

  const initialSubIndicators = [
    {
      id: 1,
      title: "",
      fieldType: "",
      choices: [],
      verification: "",
      nestedSubIndicators: [], // Add nested sub-indicators array
    },
  ];
  
  const [mainIndicators, setMainIndicators] = useState(initialMainIndicators);
  const [subIndicators, setSubIndicators] = useState(initialSubIndicators);

  const [editProfileData, setEditProfileData] = useState({
  name: "",
  email: displayName,
  image: ""
});
  const [profileData, setProfileData] = useState({
    name: "",
    email: displayName,
    image: ""
  });
  const [data, setData] = useState([]);

const handleFAS = () => {
  navigate("/financial-administration-and-sustainability", { state: { year: selectedYear } });
};
const handleDP = () => {
  navigate("/disaster-preparedness", { state: { year: selectedYear } });
};
const handleSPS = () => {
  navigate("/social-protection-and-sensitivity", { state: { year: selectedYear } });
};
const handleHCR = () => {
  navigate("/health-compliance-and-responsiveness", { state: { year: selectedYear } });
};
const handleSED = () => {
  navigate("/sustainable-education", { state: { year: selectedYear } });
};
const handleBFC = () => {
  navigate("/business-friendliness-and-competitiveness", { state: { year: selectedYear } });
};
const handleSPO = () => {
  navigate("/safety-peace-and-order", { state: { year: selectedYear } });
};
const handleEM = () => {
  navigate("/environmental-management", { state: { year: selectedYear } });
};
const handleTHDCA = () => {
  navigate("/tourism-heritage-development-culture-and-arts", { state: { year: selectedYear } });
};
const handleYD = () => {
  navigate("/youth-development", { state: { year: selectedYear } });
};


// Save submission deadline to database
const saveSubmissionDeadline = async () => {
  if (!auth.currentUser || !selectedYear || !submissionDeadline) return;
  
  try {
    const deadlineRef = ref(
      db,
      `safety/${auth.currentUser.uid}/${selectedYear}/metadata/deadline`
    );
    await set(deadlineRef, submissionDeadline);
    console.log("Deadline saved successfully");
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
      verification: "",
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
              fieldType: "", // This will always be empty (no choose field)
              choices: [],
              verification: "",
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

// Open modal to edit a specific record
const handleEditRecord = (record) => {
  // Make deep copies of the indicators to avoid reference issues
  const mainIndicatorsCopy = record.mainIndicators ? 
    record.mainIndicators.map(main => ({
      ...main,
      choices: main.choices ? [...main.choices] : []
    })) : [];
  
  const subIndicatorsCopy = record.subIndicators ? 
    record.subIndicators.map(sub => ({
      ...sub,
      choices: sub.choices ? [...sub.choices] : [],
      nestedSubIndicators: sub.nestedSubIndicators ? 
        sub.nestedSubIndicators.map(nested => ({
          ...nested,
          choices: nested.choices ? [...nested.choices] : []
        })) : []
    })) : [];

  setMainIndicators(mainIndicatorsCopy);
  setSubIndicators(subIndicatorsCopy);
  setShowModal(true);
  setEditRecordKey(record.firebaseKey);
};

// Delete a record
const handleDeleteRecord = async (firebaseKey) => {
  if (!auth.currentUser) return;
  const confirmDelete = window.confirm("Are you sure you want to delete this indicator?");
  if (!confirmDelete) return;

  try {
    const recordRef = ref(
              db,
              `safety/${auth.currentUser.uid}/${selectedYear}/safety-peace-and-order/assessment/${firebaseKey}`
            );
    await set(recordRef, null); // deletes the record
    setData((prev) => prev.filter((item) => item.firebaseKey !== firebaseKey));
  } catch (error) {
    console.error("Error deleting record:", error);
    alert("Failed to delete record");
  }
};

// Track which record is being edited
const [editRecordKey, setEditRecordKey] = useState(null);


const handleAddIndicator = () => {
  if (!isIndicatorValid()) return;

  // Make sure nestedSubIndicators are included
  const subIndicatorsToSave = subIndicators.map(sub => ({
    ...sub,
    nestedSubIndicators: sub.nestedSubIndicators || []
  }));

  const newRecord = {
    firebaseKey: editRecordKey || Date.now().toString(),
    mainIndicators,
    subIndicators: subIndicatorsToSave,  // Use the mapped version
    createdAt: Date.now(),
  };

  setData((prev) => {
    if (editRecordKey) {
      return prev.map((item) =>
        item.firebaseKey === editRecordKey ? newRecord : item
      );
    } else {
      return [...prev, newRecord];
    }
  });

  // Reset form
  setMainIndicators(initialMainIndicators);
  setSubIndicators(initialSubIndicators);
  setShowModal(false);
  setEditRecordKey(null);
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
        // Create a new array for choices to ensure React detects the change
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

useEffect(() => {
  if (!selectedYear) {
    navigate("/dashboard");
  }
}, [selectedYear]);

useEffect(() => {
  if (!auth.currentUser) return;

  const profileRef = ref(db, `profiles/${auth.currentUser.uid}`);
  onValue(profileRef, (snapshot) => {
    if (snapshot.exists()) {
      const profile = snapshot.val();
      setProfileData(profile);

      // If the profile has no name, force edit modal
      if (!profile.name) {
        setShowEditProfileModal(true);
      }
    } else {
      // No profile exists yet, open edit modal
      setShowEditProfileModal(true);
    }
  });
}, []);

useEffect(() => {
  if (!auth.currentUser || !selectedYear) return;

  const dataRef = ref(
    db,
    `safety/${auth.currentUser.uid}/${selectedYear}/safety-peace-and-order/assessment`
  );

  onValue(dataRef, (snapshot) => {
    const records = [];
    let counter = 1;

    snapshot.forEach((childSnapshot) => {
      const record = childSnapshot.val();
      records.push({
        ...record,
        id: counter++,
        firebaseKey: childSnapshot.key,
      });
    });

    setData(records);
  });
}, [selectedYear]);

// Load submission deadline for the selected year
useEffect(() => {
  if (!auth.currentUser || !selectedYear) return;

  const loadSubmissionDeadline = async () => {
    try {
      const deadlineRef = ref(
        db,
        `safety/${auth.currentUser.uid}/${selectedYear}/metadata/deadline`
      );
      
      onValue(deadlineRef, (snapshot) => {
        if (snapshot.exists()) {
          setSubmissionDeadline(snapshot.val());
        } else {
          setSubmissionDeadline("");
        }
      });
    } catch (error) {
      console.error("Error loading deadline:", error);
    }
  };

  loadSubmissionDeadline();
}, [selectedYear]);

const handleSaveChanges = async () => {
  if (!auth.currentUser || isSavingIndicator || !selectedYear) return;

  try {
    setIsSavingIndicator(true);

    const yearRef = ref(
      db,
      `safety/${auth.currentUser.uid}/${selectedYear}/safety-peace-and-order/assessment`
    );

    const updatedData = {};
    data.forEach((item) => {
      updatedData[item.firebaseKey] = {
        mainIndicators: item.mainIndicators,
        subIndicators: item.subIndicators,
        createdAt: item.createdAt || Date.now(),
      };
    });

    // ✅ validation must be INSIDE the function
    if (Object.keys(updatedData).length === 0) {
      alert("No indicators to save.");
      return;
    }

    await set(yearRef, updatedData);
    
    // Save the submission deadline
    if (submissionDeadline) {
      await saveSubmissionDeadline();
    }

    setShowSaveConfirm(false);
    alert(`Changes saved for year ${selectedYear}`);
  } catch (error) {
    console.error("Error saving changes:", error);
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

setProfileData(editProfileData); // update visible profile

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


  /* Pagination Logic */
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;

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
        verification: "",
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
        // Create a new array for choices to ensure React detects the change
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
    
    // Only validate fieldType if it exists (main indicators and top-level sub-indicators)
    // Nested sub-indicators don't need fieldType validation
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
    // Nested sub-indicators don't need fieldType validation
    return true;
  };

  const mainValid = mainIndicators.every(validateField);
  const subValid = subIndicators.every((sub) => {
    // Validate the main sub-indicator
    if (!validateField(sub)) return false;
    
    // Validate all nested sub-indicators
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
        <div className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
          <div className="encodesidebar-header">
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
      className="encodeback-btn"
      onClick={() => navigate("/dashboard")}
    >
      ⬅ BACK
    </button>

    <div className="sidebar-menu">

      <div
        className={`sidebar-item ${activeItem === "Financial Administration and Sustainability" ? "active" : ""}`}
        onClick={handleFAS}
      >
        Financial Administration and Sustainability
      </div>

      <div
        className={`sidebar-item ${activeItem === "Disaster Preparedness" ? "active" : ""}`}
        onClick={handleDP}
      >
        Disaster Preparedness
      </div>

      <div
        className={`sidebar-item activated  ${activeItem === "Social Protection and Sensitivity" ? "active" : ""}`}
        onClick={handleSPS}
      >
        Social Protection and Sensitivity
      </div>

      <div
        className={`sidebar-item ${activeItem === "Health Compliance and Responsiveness" ? "active" : ""}`}
        onClick={handleHCR}
      >
        Health Compliance and Responsiveness
      </div>

      <div
        className={`sidebar-item ${activeItem === "Sustainable Education" ? "active" : ""}`}
        onClick={handleSED}
      >
        Sustainable Education
      </div>

      <div
        className={`sidebar-item ${activeItem === "Business-Friendliness and Competitiveness" ? "active" : ""}`}
        onClick={handleBFC}
      >
        Business-Friendliness and Competitiveness
      </div>

      <div
        className={`sidebar-item ${activeItem === "Safety, Peace and Order" ? "active" : ""}`}
        onClick={handleSPO}
      >
        Safety, Peace and Order
      </div>

      <div
        className={`sidebar-item ${activeItem === "Environmental Management" ? "active" : ""}`}
        onClick={handleEM}
      >
        Environmental Management
      </div>

      <div
        className={`sidebar-item ${activeItem === "Tourism, Heritage Development, Culture and Arts" ? "active" : ""}`}
        onClick={handleTHDCA}
      >
        Tourism, Heritage Development, Culture and Arts
      </div>

      <div
        className={`sidebar-item ${activeItem === "Youth Development" ? "active" : ""}`}
        onClick={handleYD}
      >
        Youth Development
      </div>

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
                  <h2>
                    Provincial Assessment
                    {selectedYear && (
                      <span style={{ marginLeft: "5px", fontSize: "24px", fontWeight: "bold", color: "#000000" }}>
                        ({selectedYear})
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
              setEditProfileData(profileData); // copy saved data
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
            onClick={() => {
              setEditProfileData(profileData); // reset changes
              setShowEditProfileModal(false);  // close modal
            }}
          >
            ✕
          </span>
      </div>

      <div className="modal-body">

        {/* Profile Image */}
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

        {/* Name */}
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

        {/* Email (Read Only) */}
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
{showModal && (
  <div className="modal-overlay">
    <div className="indicator-modal">

      {/* HEADER */}
      <div className="indicator-header">
        <div className="indicator-title">
          <span className="plus-icon">＋</span>
          <span>NEW INDICATOR</span>
        </div>
          <span
            className="close-x"
            onClick={() => {
              setMainIndicators(initialMainIndicators);
              setSubIndicators(initialSubIndicators);
              setShowModal(false);
            }}
          >
            ✕
          </span>
      </div>
      {/* BODY */}
      <div className="indicator-body">

        {/* INDICATOR SECTION */}
        <div className="indicator-section">
          <h4>INDICATOR</h4>

{mainIndicators.map((main) => (
  <div key={main.id} className="main-card">

    <div className="main-header">

      {/* LEFT COLUMN */}
      <div className="main-left">

        {/* TITLE */}
        <input
          type="text"
          placeholder="Title here . . . ."
          value={main.title}
          onChange={(e) =>
            updateMainIndicator(main.id, "title", e.target.value)
          }
        />


        {/* DATE */}
        {main.fieldType === "date" && (
          <input
            type="date"
            className="date-field"
            onChange={(e) =>
              updateMainIndicator(main.id, "value", e.target.value)
            }
          />
        )}


        {/* MULTIPLE */}
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
              <input type="radio" disabled className="add-radio"/>
              <span>+ Add Option</span>
            </button>

          </div>
        )}


        {/* CHECKBOX */}
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
              <input type="checkbox" disabled className="add-radio"/>
              <span>+ Add Option</span>
            </button>
          </div>
        )}


        {/* SHORT */}
        {main.fieldType === "short" && (
          <div className="short-wrapper">
            <textarea
              className="short-field"
              placeholder="Empty Field"
            />
          </div>
        )}

        {/* INTEGER */}
        {main.fieldType === "integer" && (
          <div className="integer-wrapper">
            <input
              type="number"
              className="integer-field"
              placeholder="Empty Field"
            />
          </div>
        )}

                    <div className="mainverification-row">
              <label className="mainverification-label">
                Mode of Verification:
              </label>

              <input
                type="text"
                className="mainverification-input"
                value={main.verification}
                onChange={(e) =>
                  updateMainIndicator(main.id, "verification", e.target.value)
                }
              />
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
  <option value="" disabled hidden>
    Choose field
  </option>
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

      {/* LEFT COLUMN */}
      <div className="sub-left">

        {/* Title */}
        <input
          type="text"
          placeholder="Title here . . . ."
          value={sub.title}
          onChange={(e) =>
            updateSubIndicator(sub.id, "title", e.target.value)
          }
        />

        {/* Dynamic Field Rendering for main sub-indicator */}
        {sub.fieldType === "date" && (
          <input
            type="date"
            className="date-field"
            onChange={(e) =>
              updateSubIndicator(sub.id, "value", e.target.value)
            }
          />
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

        {sub.fieldType === "short" && (
          <div className="short-wrapper">
            <textarea
              className="short-field"
              placeholder="Empty Field"
            />
          </div>
        )}

        {sub.fieldType === "integer" && (
          <div className="integer-wrapper">
            <input
              type="number"
              className="integer-field"
              placeholder="Empty Field"
            />
          </div>
        )}

        <div className="verification-row">
          <label className="verification-label">
            Mode of Verification:
          </label>
          <input
            type="text"
            className="verification-input"
            value={sub.verification}
            onChange={(e) =>
              updateSubIndicator(sub.id, "verification", e.target.value)
            }
          />
        </div>
        
{/* Nested Sub-Indicators */}
{sub.nestedSubIndicators && sub.nestedSubIndicators.length > 0 && (
  <div className="nested-sub-indicators">
    {sub.nestedSubIndicators.map((nested) => (
      <div key={nested.id} className="nested-sub-card">
        <div className="nested-sub-header">
          {/* LEFT COLUMN - Nested */}
          <div className="nested-sub-left" style={{ 
            flex: 1, 
            maxWidth: "calc(100% - 80px)",
            width: "500px"
          }}>
            {/* Title input - using nested-title-input class */}
            <input
              type="text"
              className="nested-title-input"
              placeholder="Nested sub-indicator title . . . ."
              value={nested.title}
              onChange={(e) =>
                updateNestedSubIndicator(sub.id, nested.id, "title", e.target.value)
              }
              style={{ width: "100%", maxWidth: "650px" }}
            />

            {/* Dynamic Field Rendering for nested sub-indicator */}
            {nested.fieldType === "date" && (
              <input
                type="date"
                className="nested-date-field"
                onChange={(e) =>
                  updateNestedSubIndicator(sub.id, nested.id, "value", e.target.value)
                }
                style={{ width: "100%", maxWidth: "650px" }}
              />
            )}

            {nested.fieldType === "multiple" && (
              <div className="nested-multiple-wrapper" style={{ 
                width: "100%", 
                maxWidth: "650px"
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
                width: "100%", 
                maxWidth: "650px"
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

            {nested.fieldType === "short" && (
              <div className="nested-short-wrapper" style={{ 
                width: "100%", 
                maxWidth: "650px"
              }}>
                <textarea
                  className="nested-short-field"
                  placeholder="Empty Field"
                  style={{ width: "100%" }}
                />
              </div>
            )}

            {nested.fieldType === "integer" && (
              <div className="nested-integer-wrapper" style={{ 
                width: "100%", 
                maxWidth: "650px"
              }}>
                <input
                  type="number"
                  className="nested-integer-field"
                  placeholder="Empty Field"
                  style={{ width: "100%" }}
                />
              </div>
            )}

            {/* MODE OF VERIFICATION REMOVED */}
            
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
  <option value="" disabled hidden>
    Choose field
  </option>
  <option value="no-input">No Input Field</option> {/* ADD THIS LINE */}
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

        {/* Add Nested Sub-Indicator Button */}
        <button
          type="button"
          className="add-nested-sub-btn"
          onClick={() => addNestedSubIndicator(sub.id)}
        >
          <span className="subplus-icon">＋</span>
          New Sub-Indicator
        </button>

      </div>


<select
  value={sub.fieldType}
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
  <option value="" disabled hidden>
    Choose field
  </option>
  <option value="no-input">No Input Field</option>
  <option value="integer">Integer/Value</option>
  <option value="short">Short Answer</option>
  <option value="multiple">Multiple Choice</option>
  <option value="checkbox">Checkboxes</option>
  <option value="date">Date</option>
</select>


      {/* Main sub-indicator delete button */}
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
        {/* FOOTER */}
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
                ADD
              </button>
        </div>
      </div>
    </div>
  </div>
)}

{showSaveConfirm && (
  <div className="modal-overlay">
    <div className="confirm-modal">
      <h3>Save changes?</h3>
      <div className="confirm-buttons">
        <button
          className="discard-btn"
          onClick={() => setShowSaveConfirm(false)}
        >
          Discard
        </button>

          <button
            className="confirm-btn"
            disabled={isSavingIndicator}
            onClick={handleSaveChanges}
          >
            {isSavingIndicator ? "Saving..." : "Yes"}
          </button>
      </div>
    </div>
  </div>
)}
            </div>
          </div>

<div className="action-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
  {/* Left side - Submission Deadline box */}
  <div className="deadline-container" style={{ display: "flex", alignItems: "center", gap: "10px",marginLeft: "10px" }}>
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
    />
  </div>

  {/* Right side - Save Changes button */}
  <button 
    className="savechanges-btn" 
    onClick={() => setShowSaveConfirm(true)}
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
<div className="financialtable-box">
  <div className="financialtable-header">
    <h3 className="table-title">
      Safety, Peace and Order
    </h3>
  </div>

<div className="scrollable-content">

  {data.length === 0 && (
    <p style={{ textAlign: "center", marginTop: "20px" }}>No indicators added yet.</p>
  )}

  {data.map((record) => (
    <div key={record.firebaseKey} className="reference-wrapper">

{record.mainIndicators?.map((main, index) => (
  <div key={index} className="reference-wrapper">
    <div className="reference-row">
      {/* LEFT COLUMN */}
      <div className="reference-label">{main.title}</div>

      {/* RIGHT COLUMN */}
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
            <span style={{ fontStyle: "italic", color: "gray" }}>Empty Field</span>
          )}

          {main.fieldType === "integer" && (
            <span style={{ fontStyle: "italic", color: "gray" }}>Empty Field</span>
          )}

          {main.fieldType === "date" && (
            <span style={{ fontStyle: "italic", color: "gray" }}>
              {main.value
                ? new Date(main.value).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "Empty Field"}
            </span>
          )}
        </div>

        {/* Buttons inside the same right column */}
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

    {main.verification && (
      <div className="reference-verification-full">
        <span className="reference-verification-label">Mode of Verification:</span>
        <span className="reference-verification-value">{main.verification}</span>
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
          <span style={{ fontStyle: "italic", color: "gray" }}>Empty Field</span>
        )}

        {sub.fieldType === "integer" && (
          <span style={{ fontStyle: "italic", color: "gray" }}>Empty Field</span>
        )}

        {sub.fieldType === "date" && (
          <span style={{ fontStyle: "italic", color: "gray" }}>
            {sub.value
              ? new Date(sub.value).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "Empty Field"}
          </span>
        )}
      </div>
    </div>

    {sub.verification && (
      <div className="reference-verification-full">
        <span className="reference-verification-label">Mode of Verification:</span>
        <span className="reference-verification-value">{sub.verification}</span>
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
              <span style={{ fontStyle: "italic", color: "gray" }}>Empty Field</span>
            )}

            {nested.fieldType === "integer" && (
              <span style={{ fontStyle: "italic", color: "gray" }}>Empty Field</span>
            )}

            {nested.fieldType === "date" && (
              <span style={{ fontStyle: "italic", color: "gray" }}>
                {nested.value
                  ? new Date(nested.value).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Empty Field"}
              </span>
            )}

            {!nested.fieldType && (
              <span style={{ fontStyle: "italic", color: "gray" }}>No field type selected</span>
            )}
          </div>
        </div>
        
        {nested.verification && (
          <div className="nested-verification">
            <span className="verification-label">Mode of Verification:</span>
            <span className="verification-value">{nested.verification}</span>
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
  <button className="btn-new" onClick={() => setShowModal(true)}>
    <span style={{ fontSize: "20px", fontWeight: "bold" }}>＋</span>
    New Indicator
  </button>
</div>
        </div>
        </div>
    </div>
  );
}