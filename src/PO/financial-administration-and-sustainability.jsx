import React, { useState, useEffect } from "react";
import { db, auth} from "src/firebase";
import "src/PO-CSS/financial-administration-and-sustainability.css";
import dilgLogo from "src/assets/dilg-po.png";
import dilgSeal from "src/assets/dilg-ph.png";
import { FiSave, FiTrash2 } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { ref, push, onValue, set } from "firebase/database";


export default function FAS() {


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

  // Remove Sub Indicator
  const removeSubIndicator = (id) => {
    setSubIndicators((prev) => prev.filter((sub) => sub.id !== id));
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
      `financial/${auth.currentUser.uid}/${selectedYear}/metadata/deadline`
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
      choices: sub.choices ? [...sub.choices] : []
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
              `financial/${auth.currentUser.uid}/${selectedYear}/financial-administration-and-sustainability/assessment/${firebaseKey}`
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

  const newRecord = {
    firebaseKey: editRecordKey || Date.now().toString(), // temporary key
    mainIndicators,
    subIndicators,
    createdAt: Date.now(),
  };

  setData((prev) => {
    if (editRecordKey) {
      // Update existing local record
      return prev.map((item) =>
        item.firebaseKey === editRecordKey ? newRecord : item
      );
    } else {
      // Add new local record
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
    `financial/${auth.currentUser.uid}/${selectedYear}/financial-administration-and-sustainability/assessment`
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
        `financial/${auth.currentUser.uid}/${selectedYear}/metadata/deadline`
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
      `financial/${auth.currentUser.uid}/${selectedYear}/financial-administration-and-sustainability/assessment`
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
    if (!indicator.fieldType) return false;

    if (
      indicator.fieldType === "multiple" ||
      indicator.fieldType === "checkbox"
    ) {
      if (!indicator.choices.length) return false;

      const hasEmptyChoice = indicator.choices.some(
        (choice) => !choice.trim()
      );

      if (hasEmptyChoice) return false;
    }

    return true;
  };

  const mainValid = mainIndicators.every(validateField);
  const subValid = subIndicators.every(validateField);

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
        className={`sidebar-item activated ${activeItem === "Financial Administration and Sustainability" ? "active" : ""}`}
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
        className={`sidebar-item ${activeItem === "Social Protection and Sensitivity" ? "active" : ""}`}
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

      {/* RIGHT SELECT */}
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
        <option value="integer">
          Integer/Value
        </option>
        <option value="short">
          Short Answer
        </option>
        <option value="multiple">
          Multiple Choice
        </option>
        <option value="checkbox">
          Checkboxes
        </option>
        <option value="date">
          Date
        </option>
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

        {/* main INDICATOR SECTION */}
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

        {/* Dynamic Field Rendering */}
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
      </div>

      {/* RIGHT SIDE SELECT */}
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
      Financial Administration and Sustainability
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
