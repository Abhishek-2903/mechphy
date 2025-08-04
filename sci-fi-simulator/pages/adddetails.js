import { useState } from "react";
import axios from "axios";

import Link from "next/link";

const BASE_URL = "http://localhost:8000";

export default function AddDetails() {
  const [activeSection, setActiveSection] = useState(null);
  const [activeOperation, setActiveOperation] = useState({});
  const [popupMessage, setPopupMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({});

  const [formData, setFormData] = useState({
    soldier: {
      soldier_id: "",
      call_sign: "",
      search_id: "",
      update_id: "",
      delete_id: ""
    },
    weapon: {
      name: "",
      weapon_type: "assault",
      bullet_type: "5.56 mm",
      fire_rate: 0,
      range: 0,
      search_id: "",
      update_id: "",
      delete_id: ""
    },
    vest: {
      vest_id: "",
      protection_level: 0,
      search_id: "",
      update_id: "",
      delete_id: ""
    }
  });

  const operations = {
    create: { title: "Create", icon: "➕", description: "Add new resource" },
    list:   { title: "List All", icon: "📋", description: "View all resources with IDs" },
    get:    { title: "Find",     icon: "🔍", description: "Search existing resource" },
    update: { title: "Update",   icon: "✏️", description: "Modify resource details" },
    delete: { title: "Delete",   icon: "🗑️", description: "Remove resource" }
  };

  const showSection = (section) => {
    setActiveSection(activeSection === section ? null : section);
    setActiveOperation({});
    setSearchResults({});
  };

  const showOperation = (section, operation) => {
    setActiveOperation(prev => ({
      ...prev,
      [section]: prev[section] === operation ? null : operation
    }));
    setSearchResults({});
  };

  const handleInputChange = (type, field, value) => {
    setFormData(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value }
    }));
  };

  const showPopup = (message) => {
    setPopupMessage(message);
    setTimeout(() => setPopupMessage(""), 4000);
  };

  // Validation helpers
  const validateWeaponData = (operation) => {
    if (operation === "create" && !formData.weapon.name.trim()) {
      showPopup("Please enter Weapon Name");
      return false;
    }
    if (operation === "update") {
      if (!formData.weapon.update_id.trim()) {
        showPopup("Please enter Weapon ID to update");
        return false;
      }
      if (!formData.weapon.name.trim()) {
        showPopup("Please enter Weapon Name for update");
        return false;
      }
    }
    if (operation === "get" && !formData.weapon.search_id.trim()) {
      showPopup("Please enter Weapon ID to search");
      return false;
    }
    if (operation === "delete" && !formData.weapon.delete_id.trim()) {
      showPopup("Please enter Weapon ID to delete");
      return false;
    }
    return true;
  };

  const validateVestData = (operation) => {
    if (operation === "create" && !formData.vest.vest_id.trim()) {
      showPopup("Please enter Vest ID");
      return false;
    }
    if (operation === "update" && !formData.vest.update_id.trim()) {
      showPopup("Please enter Vest ID to update");
      return false;
    }
    if (operation === "get" && !formData.vest.search_id.trim()) {
      showPopup("Please enter Vest ID to search");
      return false;
    }
    if (operation === "delete" && !formData.vest.delete_id.trim()) {
      showPopup("Please enter Vest ID to delete");
      return false;
    }
    return true;
  };

  // SOLDIER OPERATIONS
  const createSoldier = async () => {
    if (!formData.soldier.soldier_id || !formData.soldier.call_sign) {
      showPopup("Please enter both Soldier ID and Call Sign");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        soldier_id: formData.soldier.soldier_id.trim(),
        call_sign:  formData.soldier.call_sign.trim()
      };
      await axios.post(`${BASE_URL}/api/soldiers/`, payload);
      showPopup("Soldier created successfully!");
      setFormData(prev => ({
        ...prev,
        soldier: { ...prev.soldier, soldier_id: "", call_sign: "" }
      }));
    } catch (error) {
      const errorMsg = error.response?.data?.detail ||
                       error.response?.data?.message ||
                       "Failed to create soldier";
      showPopup(`Error: ${errorMsg}`);
      console.error("Error creating soldier:", error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const getSoldier = async () => {
    if (!formData.soldier.search_id) {
      showPopup("Please enter Soldier ID to search");
      return;
    }
    setLoading(true);
    try {
      const response = await axios.get(
        `${BASE_URL}/api/soldiers/${formData.soldier.search_id}`
      );
      setSearchResults(prev => ({ ...prev, soldier: response.data }));
      showPopup("Soldier found successfully!");
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Soldier not found";
      showPopup(`Error: ${errorMsg}`);
      setSearchResults(prev => ({ ...prev, soldier: null }));
    } finally {
      setLoading(false);
    }
  };

  const updateSoldier = async () => {
    if (!formData.soldier.update_id || !formData.soldier.call_sign) {
      showPopup("Please enter Soldier ID and new Call Sign");
      return;
    }
    setLoading(true);
    try {
      const payload = { call_sign: formData.soldier.call_sign.trim() };
      await axios.put(
        `${BASE_URL}/api/soldiers/${formData.soldier.update_id}`,
        payload
      );
      showPopup("Soldier updated successfully!");
      setFormData(prev => ({
        ...prev,
        soldier: { ...prev.soldier, update_id: "", call_sign: "" }
      }));
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Failed to update soldier";
      showPopup(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteSoldier = async () => {
    if (!formData.soldier.delete_id) {
      showPopup("Please enter Soldier ID to delete");
      return;
    }
    if (!window.confirm(
      `Are you sure you want to delete soldier ${formData.soldier.delete_id}?`
    )) return;
    setLoading(true);
    try {
      await axios.delete(
        `${BASE_URL}/api/soldiers/${formData.soldier.delete_id}`
      );
      showPopup("Soldier deleted successfully!");
      setFormData(prev => ({
        ...prev,
        soldier: { ...prev.soldier, delete_id: "" }
      }));
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Failed to delete soldier";
      showPopup(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // WEAPON OPERATIONS
  const createWeapon = async () => {
    if (!validateWeaponData("create")) return;
    setLoading(true);
    try {
      const payload = {
        weapon_type: formData.weapon.weapon_type,
        bullet_type:  formData.weapon.bullet_type,
        fire_rate:    parseInt(formData.weapon.fire_rate) || 0,
        range:        parseInt(formData.weapon.range) || 0,
        name:         formData.weapon.name.trim()
      };
      const response = await axios.post(
        `${BASE_URL}/api/weapons/create`,
        payload
      );
      showPopup(
        `Weapon created successfully! Weapon ID: ${
          response.data.weapon_id || "Generated"
        }`
      );
      setFormData(prev => ({
        ...prev,
        weapon: {
          ...prev.weapon,
          name: "",
          fire_rate: 0,
          range: 0,
          weapon_type: "assault",
          bullet_type: "5.56 mm"
        }
      }));
    } catch (error) {
      const errorMsg = error.response?.data?.detail ||
                       error.response?.data?.message ||
                       "Failed to create weapon";
      showPopup(`Error: ${errorMsg}`);
      console.error("Weapon creation error:", error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const listAllWeapons = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${BASE_URL}/api/weapons/`);
      setSearchResults(prev => ({ ...prev, weaponsList: response.data }));
      showPopup("Weapons list loaded successfully!");
    } catch {
      // first attempt failed, try without trailing slash
      try {
        const response2 = await axios.get(`${BASE_URL}/api/weapons`);
        setSearchResults(prev => ({ ...prev, weaponsList: response2.data }));
        showPopup("Weapons list loaded successfully!");
      } catch {
        showPopup("Error: Cannot access weapons endpoint. Check backend logs.");
        setSearchResults(prev => ({ ...prev, weaponsList: null }));
      }
    } finally {
      setLoading(false);
    }
  };

  const getWeapon = async () => {
    if (!validateWeaponData("get")) return;
    setLoading(true);
    try {
      const weaponId    = formData.weapon.search_id.trim();
      const response    = await axios.get(`${BASE_URL}/api/weapons/`);
      const weaponsList = response.data;
      const found = weaponsList.find(w =>
        w.weapon_id == weaponId || w.id == weaponId
      );
      if (found) {
        setSearchResults(prev => ({ ...prev, weapon: found }));
        showPopup("Weapon found successfully!");
      } else {
        const ids = weaponsList.map(w => w.weapon_id || w.id).join(", ");
        showPopup(`Weapon ID "${weaponId}" not found. Available: ${ids}`);
        setSearchResults(prev => ({ ...prev, weapon: null }));
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Failed to search weapons";
      showPopup(`Error: ${errorMsg}`);
      setSearchResults(prev => ({ ...prev, weapon: null }));
    } finally {
      setLoading(false);
    }
  };

  const updateWeapon = async () => {
    if (!validateWeaponData("update")) return;
    setLoading(true);
    try {
      const weaponId = formData.weapon.update_id.trim();
      const payload  = {
        weapon_type: formData.weapon.weapon_type,
        bullet_type:  formData.weapon.bullet_type,
        burst_mode:   0,
        fire_rate:    parseInt(formData.weapon.fire_rate) || 0,
        range:        parseInt(formData.weapon.range) || 0
      };
      await axios.put(
        `${BASE_URL}/api/weapons/${weaponId}`,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );
      showPopup("Weapon updated successfully!");
      setFormData(prev => ({
        ...prev,
        weapon: { ...prev.weapon, update_id: "", name: "" }
      }));
    } catch (error) {
      const errorMsg = error.response?.data?.detail || "Failed to update weapon";
      showPopup(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteWeapon = async () => {
    if (!validateWeaponData("delete")) return;
    if (!window.confirm(
      `Are you sure you want to delete weapon ${formData.weapon.delete_id}?`
    )) return;
    setLoading(true);
    try {
      const weaponId = formData.weapon.delete_id.trim();
      const endpoints = [
        `${BASE_URL}/api/weapons/${weaponId}`,
        `${BASE_URL}/api/weapons/delete/${weaponId}`,
        `${BASE_URL}/api/weapons/${weaponId}/delete`,
        `${BASE_URL}/api/weapon/${weaponId}`
      ];
      let success = false;
      for (const ep of endpoints) {
        try {
          await axios.delete(ep);
          success = true;
          break;
        } catch {
          // ignore and try next
        }
      }
      if (success) {
        showPopup("Weapon deleted successfully!");
        setFormData(prev => ({
          ...prev,
          weapon: { ...prev.weapon, delete_id: "" }
        }));
      } else {
        showPopup("Error: No working delete endpoint found.");
      }
    } catch {
      showPopup("Error: Delete failed");
    } finally {
      setLoading(false);
    }
  };

  // VEST OPERATIONS
  const createVest = async () => {
    if (!validateVestData("create")) return;
    setLoading(true);
    try {
      const payload = {
        protection_level: parseInt(formData.vest.protection_level) || 0
      };
      const response = await axios.post(
        `${BASE_URL}/api/vests/create`,
        payload
      );
      showPopup(
        `Vest created successfully! Vest ID: ${
          response.data.vest?.vest_id || "Generated"
        }`
      );
      setFormData(prev => ({
        ...prev,
        vest: { ...prev.vest, vest_id: "", protection_level: 0 }
      }));
    } catch (error) {
      const errorMsg = error.response?.data?.detail ||
                       error.response?.data?.message ||
                       "Failed to create vest";
      showPopup(`Error: ${errorMsg}`);
      console.error("Error creating vest:", error.response?.data || error);
    } finally {
      setLoading(false);
    }
  };

  const listAllVests = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${BASE_URL}/api/vests/`);
      setSearchResults(prev => ({ ...prev, vestsList: response.data }));
      showPopup("Vests list loaded successfully!");
    } catch {
      showPopup("Error: Failed to load vests list");
      setSearchResults(prev => ({ ...prev, vestsList: null }));
    } finally {
      setLoading(false);
    }
  };

  const getVest = async () => {
    if (!validateVestData("get")) return;
    setLoading(true);
    try {
      const response = await axios.get(
        `${BASE_URL}/api/vests/${formData.vest.search_id}`
      );
      setSearchResults(prev => ({ ...prev, vest: response.data }));
      showPopup("Vest found successfully!");
    } catch {
      showPopup("Error: Vest not found");
      setSearchResults(prev => ({ ...prev, vest: null }));
    } finally {
      setLoading(false);
    }
  };

  const updateVest = async () => {
    if (!validateVestData("update")) return;
    setLoading(true);
    try {
      const payload = {
        protection_level: parseInt(formData.vest.protection_level) || 0
      };
      await axios.put(
        `${BASE_URL}/api/vests/${formData.vest.update_id}`,
        payload
      );
      showPopup("Vest updated successfully!");
      setFormData(prev => ({
        ...prev,
        vest: { ...prev.vest, update_id: "" }
      }));
    } catch {
      showPopup("Error: Failed to update vest");
    } finally {
      setLoading(false);
    }
  };

  const deleteVest = async () => {
    if (!validateVestData("delete")) return;
    if (!window.confirm(
      `Are you sure you want to delete vest ${formData.vest.delete_id}?`
    )) return;
    setLoading(true);
    try {
      await axios.delete(
        `${BASE_URL}/api/vests/${formData.vest.delete_id}`
      );
      showPopup("Vest deleted successfully!");
      setFormData(prev => ({
        ...prev,
        vest: { ...prev.vest, delete_id: "" }
      }));
    } catch {
      showPopup("Error: Failed to delete vest");
    } finally {
      setLoading(false);
    }
  };

  // Render helpers
  const renderOperationCards = (section) => (
    <div className="operation-cards">
      {Object.entries(operations).map(([key, op]) => {
        if (section === "soldier" && key === "list") return null;
        return (
          <div
            key={key}
            className={`operation-card ${
              activeOperation[section] === key ? "active" : ""
            }`}
            onClick={() => showOperation(section, key)}
          >
            <h4>{op.icon} {op.title}</h4>
            <p>{op.description}</p>
          </div>
        );
      })}
    </div>
  );

  const renderSoldierForm = () => {
    const operation = activeOperation.soldier;
    if (!operation) return null;
    return (
      <div className="input-section active">
        <h3>{operations[operation].title} Soldier</h3>
        {operation === "create" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Soldier ID *</label>
              <input
                type="text"
                placeholder="Enter Soldier ID (e.g., S001)"
                value={formData.soldier.soldier_id}
                onChange={(e) =>
                  handleInputChange("soldier", "soldier_id", e.target.value)
                }
                required
              />
            </div>
            <div className="input-wrapper">
              <label>Call Sign *</label>
              <input
                type="text"
                placeholder="Enter Call Sign (e.g., Alpha)"
                value={formData.soldier.call_sign}
                onChange={(e) =>
                  handleInputChange("soldier", "call_sign", e.target.value)
                }
                required
              />
            </div>
          </div>
        )}
        {operation === "get" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Search ID *</label>
              <input
                type="text"
                placeholder="Enter Soldier ID to search"
                value={formData.soldier.search_id}
                onChange={(e) =>
                  handleInputChange("soldier", "search_id", e.target.value)
                }
                required
              />
            </div>
          </div>
        )}
        {operation === "update" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Soldier ID *</label>
              <input
                type="text"
                placeholder="Enter Soldier ID to update"
                value={formData.soldier.update_id}
                onChange={(e) =>
                  handleInputChange("soldier", "update_id", e.target.value)
                }
                required
              />
            </div>
            <div className="input-wrapper">
              <label>New Call Sign *</label>
              <input
                type="text"
                placeholder="Enter new Call Sign"
                value={formData.soldier.call_sign}
                onChange={(e) =>
                  handleInputChange("soldier", "call_sign", e.target.value)
                }
                required
              />
            </div>
          </div>
        )}
        {operation === "delete" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Soldier ID *</label>
              <input
                type="text"
                placeholder="Enter Soldier ID to delete"
                value={formData.soldier.delete_id}
                onChange={(e) =>
                  handleInputChange("soldier", "delete_id", e.target.value)
                }
                required
              />
            </div>
          </div>
        )}
        <div className="btn-group">
          <button
            className={`update-btn ${
              operation === "delete" ? "danger" : ""
            }`}
            onClick={() => {
              switch (operation) {
                case "create": createSoldier(); break;
                case "get":    getSoldier();    break;
                case "update": updateSoldier(); break;
                case "delete": deleteSoldier(); break;
              }
            }}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : `${operations[operation].title} Soldier`}
          </button>
        </div>
        {searchResults.soldier && (
          <div className="result-display">
            <h5>Soldier Found:</h5>
            <p><strong>ID:</strong> {searchResults.soldier.soldier_id}</p>
            <p><strong>Call Sign:</strong> {searchResults.soldier.call_sign}</p>
            <p><strong>Kill Count:</strong> {searchResults.soldier.stats?.kill_count || 0}</p>
          </div>
        )}
      </div>
    );
  };

  const renderWeaponForm = () => {
    const operation = activeOperation.weapon;
    if (!operation) return null;
    return (
      <div className="input-section active">
        <h3>{operations[operation].title} Weapon</h3>
        {operation === "create" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Weapon Name *</label>
              <input
                type="text"
                placeholder="Enter weapon name (e.g., AK-47, M416)"
                value={formData.weapon.name}
                onChange={(e) =>
                  handleInputChange("weapon", "name", e.target.value)
                }
                required
              />
            </div>
            <div className="input-wrapper">
              <label>Weapon Type *</label>
              <select
                value={formData.weapon.weapon_type}
                onChange={(e) =>
                  handleInputChange("weapon", "weapon_type", e.target.value)
                }
                required
              >
                <option value="assault">Assault Rifle</option>
                <option value="lmg">Light Machine Gun</option>
                <option value="sniper">Sniper Rifle</option>
                <option value="pistol">Pistol</option>
                <option value="shotgun">Shotgun</option>
                <option value="smg">Sub Machine Gun</option>
              </select>
            </div>
            <div className="input-wrapper">
              <label>Bullet Type *</label>
              <select
                value={formData.weapon.bullet_type}
                onChange={(e) =>
                  handleInputChange("weapon", "bullet_type", e.target.value)
                }
                required
              >
                <option value="5.56 mm">5.56 mm</option>
                <option value="7.62 mm">7.62 mm</option>
                <option value="9 mm">9 mm</option>
                <option value=".45 ACP">.45 ACP</option>
                <option value="12 gauge">12 gauge</option>
              </select>
            </div>
            <div className="input-wrapper">
              <label>Fire Rate (rounds/min)</label>
              <input
                type="number"
                placeholder="Enter fire rate (e.g., 600)"
                value={formData.weapon.fire_rate}
                onChange={(e) =>
                  handleInputChange("weapon", "fire_rate", e.target.value)
                }
                min="0"
                max="1200"
              />
            </div>
            <div className="input-wrapper">
              <label>Range (meters)</label>
              <input
                type="number"
                placeholder="Enter effective range (e.g., 400)"
                value={formData.weapon.range}
                onChange={(e) =>
                  handleInputChange("weapon", "range", e.target.value)
                }
                min="0"
                max="1000"
              />
            </div>
          </div>
        )}
        {operation === "update" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Weapon ID *</label>
              <input
                type="text"
                placeholder="Enter Weapon ID to update"
                value={formData.weapon.update_id}
                onChange={(e) =>
                  handleInputChange("weapon", "update_id", e.target.value)
                }
                required
              />
            </div>
            <div className="input-wrapper">
              <label>Weapon Type *</label>
              <select
                value={formData.weapon.weapon_type}
                onChange={(e) =>
                  handleInputChange("weapon", "weapon_type", e.target.value)
                }
                required
              >
                <option value="assault">Assault Rifle</option>
                <option value="lmg">Light Machine Gun</option>
                <option value="sniper">Sniper Rifle</option>
                <option value="pistol">Pistol</option>
                <option value="shotgun">Shotgun</option>
                <option value="smg">Sub Machine Gun</option>
              </select>
            </div>
            <div className="input-wrapper">
              <label>Bullet Type *</label>
              <select
                value={formData.weapon.bullet_type}
                onChange={(e) =>
                  handleInputChange("weapon", "bullet_type", e.target.value)
                }
                required
              >
                <option value="5.56 mm">5.56 mm</option>
                <option value="7.62 mm">7.62 mm</option>
                <option value="9 mm">9 mm</option>
                <option value=".45 ACP">.45 ACP</option>
                <option value="12 gauge">12 gauge</option>
              </select>
            </div>
            <div className="input-wrapper">
              <label>Fire Rate (rounds/min)</label>
              <input
                type="number"
                placeholder="Enter fire rate (e.g., 600)"
                value={formData.weapon.fire_rate}
                onChange={(e) =>
                  handleInputChange("weapon", "fire_rate", e.target.value)
                }
                min="0"
                max="1200"
              />
            </div>
            <div className="input-wrapper">
              <label>Range (meters)</label>
              <input
                type="number"
                placeholder="Enter effective range (e.g., 400)"
                value={formData.weapon.range}
                onChange={(e) =>
                  handleInputChange("weapon", "range", e.target.value)
                }
                min="0"
                max="1000"
              />
            </div>
          </div>
        )}
        {operation === "get" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Search ID *</label>
              <input
                type="text"
                placeholder="Enter Weapon ID to search"
                value={formData.weapon.search_id}
                onChange={(e) =>
                  handleInputChange("weapon", "search_id", e.target.value)
                }
                required
              />
            </div>
          </div>
        )}
        {operation === "delete" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Weapon ID *</label>
              <input
                type="text"
                placeholder="Enter Weapon ID to delete"
                value={formData.weapon.delete_id}
                onChange={(e) =>
                  handleInputChange("weapon", "delete_id", e.target.value)
                }
                required
              />
            </div>
          </div>
        )}
        <div className="btn-group">
          <button
            className={`update-btn ${
              operation === "delete" ? "danger" : ""
            }`}
            onClick={() => {
              switch (operation) {
                case "create": createWeapon(); break;
                case "list":   listAllWeapons(); break;
                case "get":    getWeapon();       break;
                case "update": updateWeapon();    break;
                case "delete": deleteWeapon();    break;
              }
            }}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : `${operations[operation].title} Weapon`}
          </button>
        </div>
        {searchResults.weaponsList && (
          <div className="result-display">
            <h5>All Weapons:</h5>
            <div className="weapons-list">
              {Array.isArray(searchResults.weaponsList) ? (
                searchResults.weaponsList.map((weapon, idx) => (
                  <div key={idx} className="weapon-item">
                    <p>
                      <strong>🆔 ID:</strong>{" "}
                      <span
                        className="copy-text"
                        onClick={() =>
                          navigator.clipboard.writeText(weapon.weapon_id)
                        }
                      >
                        {weapon.weapon_id}
                      </span>
                    </p>
                    <p><strong>📛 Name:</strong> {weapon.name}</p>
                    <p><strong>🔫 Type:</strong> {weapon.weapon_type}</p>
                    <p><strong>🔸 Bullet:</strong> {weapon.bullet_type}</p>
                    <p><strong>🔥 Fire Rate:</strong> {weapon.fire_rate}</p>
                    <p><strong>📏 Range:</strong> {weapon.range}</p>
                    <p><strong>📊 Count:</strong> {weapon.count}</p>
                    <hr />
                  </div>
                ))
              ) : (
                <p>No weapons found</p>
              )}
            </div>
          </div>
        )}
        {searchResults.weapon && (
          <div className="result-display">
            <h5>Weapon Found:</h5>
            <p><strong>ID:</strong> {searchResults.weapon.weapon_id}</p>
            <p><strong>Name:</strong> {searchResults.weapon.name}</p>
            <p><strong>Type:</strong> {searchResults.weapon.weapon_type}</p>
            <p><strong>Bullet Type:</strong> {searchResults.weapon.bullet_type}</p>
            <p><strong>Fire Rate:</strong> {searchResults.weapon.fire_rate}</p>
            <p><strong>Range:</strong> {searchResults.weapon.range}</p>
            <p><strong>Count:</strong> {searchResults.weapon.count}</p>
          </div>
        )}
      </div>
    );
  };

  const renderVestForm = () => {
    const operation = activeOperation.vest;
    if (!operation) return null;
    return (
      <div className="input-section active">
        <h3>{operations[operation].title} Vest</h3>
        {operation === "create" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Vest ID *</label>
              <input
                type="text"
                placeholder="Enter Vest ID"
                value={formData.vest.vest_id}
                onChange={(e) =>
                  handleInputChange("vest", "vest_id", e.target.value)
                }
                required
              />
            </div>
            <div className="input-wrapper">
              <label>Protection Level *</label>
              <select
                value={formData.vest.protection_level}
                onChange={(e) =>
                  handleInputChange("vest", "protection_level", e.target.value)
                }
                required
              >
                <option value={0}>Level 0 - Basic Protection</option>
                <option value={1}>Level 1 - Standard Protection</option>
                <option value={2}>Level 2 - Enhanced Protection</option>
                <option value={3}>Level 3 - Maximum Protection</option>
                <option value={4}>Level 4 - Military Grade</option>
              </select>
            </div>
          </div>
        )}
        {operation === "update" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Vest ID *</label>
              <input
                type="text"
                placeholder="Enter Vest ID to update"
                value={formData.vest.update_id}
                onChange={(e) =>
                  handleInputChange("vest", "update_id", e.target.value)
                }
                required
              />
            </div>
            <div className="input-wrapper">
              <label>Protection Level *</label>
              <select
                value={formData.vest.protection_level}
                onChange={(e) =>
                  handleInputChange("vest", "protection_level", e.target.value)
                }
                required
              >
                <option value={0}>Level 0 - Basic Protection</option>
                <option value={1}>Level 1 - Standard Protection</option>
                <option value={2}>Level 2 - Enhanced Protection</option>
                <option value={3}>Level 3 - Maximum Protection</option>
                <option value={4}>Level 4 - Military Grade</option>
              </select>
            </div>
          </div>
        )}
        {operation === "get" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Search ID *</label>
              <input
                type="text"
                placeholder="Enter Vest ID to search"
                value={formData.vest.search_id}
                onChange={(e) =>
                  handleInputChange("vest", "search_id", e.target.value)
                }
                required
              />
            </div>
          </div>
        )}
        {operation === "delete" && (
          <div className="input-group">
            <div className="input-wrapper">
              <label>Vest ID *</label>
              <input
                type="text"
                placeholder="Enter Vest ID to delete"
                value={formData.vest.delete_id}
                onChange={(e) =>
                  handleInputChange("vest", "delete_id", e.target.value)
                }
                required
              />
            </div>
          </div>
        )}
        <div className="btn-group">
          <button
            className={`update-btn ${
              operation === "delete" ? "danger" : ""
            }`}
            onClick={() => {
              switch (operation) {
                case "create": createVest();    break;
                case "list":   listAllVests();  break;
                case "get":    getVest();       break;
                case "update": updateVest();    break;
                case "delete": deleteVest();    break;
              }
            }}
            disabled={loading}
          >
            {loading
              ? "Processing..."
              : `${operations[operation].title} Vest`}
          </button>
        </div>
        {searchResults.vestsList && (
          <div className="result-display">
            <h5>All Vests:</h5>
            <div className="vests-list">
              {Array.isArray(searchResults.vestsList) ? (
                searchResults.vestsList.map((vest, idx) => (
                  <div key={idx} className="vest-item">
                    <p>
                      <strong>🆔 ID:</strong>{" "}
                      <span
                        className="copy-text"
                        onClick={() =>
                          navigator.clipboard.writeText(vest.vest_id)
                        }
                      >
                        {vest.vest_id}
                      </span>
                    </p>
                    <p><strong>🛡️ Protection Level:</strong> Level {vest.protection_level}</p>
                    <p><strong>📊 Count:</strong> {vest.count}</p>
                    <hr />
                  </div>
                ))
              ) : (
                <p>No vests found</p>
              )}
            </div>
          </div>
        )}
        {searchResults.vest && (
          <div className="result-display">
            <h5>Vest Found:</h5>
            <p><strong>ID:</strong> {searchResults.vest.vest_id}</p>
            <p><strong>Protection Level:</strong> Level {searchResults.vest.protection_level}</p>
            <p><strong>Count:</strong> {searchResults.vest.count || 0}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-wrapper">
      <div className="navbar">
        <ul>
          <li><Link href="/">Home</Link></li>
          <li><Link href="/add-details">Add Details</Link></li>
          <li><Link href="/resource-allocation">Resource Allocation</Link></li>
          <li><Link href="/map-overlay">Map Overlay</Link></li>
          <li><Link href="/real-time-monitoring">Real Time Monitoring</Link></li>
          <li><Link href="/previous-exercise">View Previous Exercise</Link></li>
          <li><Link href="/settings">Settings</Link></li>
        </ul>
      </div>

      <div className="main-container">
        <div className="add-details-section">
          <h2>⚔️ Resource Management System</h2>
          
          <div className="dropdown-container">
            <div className="dropdown">
              <button
                className="dropdown-btn"
                onClick={() => showSection("soldier")}
              >
                <span>👤 Soldier Management</span>
                <span>{activeSection === "soldier" ? "▼" : "▲"}</span>
              </button>
            </div>
            <div className="dropdown">
              <button
                className="dropdown-btn"
                onClick={() => showSection("weapon")}
              >
                <span>🔫 Weapon Management</span>
                <span>{activeSection === "weapon" ? "▼" : "▲"}</span>
              </button>
            </div>
            <div className="dropdown">
              <button
                className="dropdown-btn"
                onClick={() => showSection("vest")}
              >
                <span>🛡️ Vest Management</span>
                <span>{activeSection === "vest" ? "▼" : "▲"}</span>
              </button>
            </div>
          </div>

          <div className="scrollable-content">
            {activeSection === "soldier" && (
              <div>
                {renderOperationCards("soldier")}
                {renderSoldierForm()}
              </div>
            )}
            {activeSection === "weapon" && (
              <div>
                {renderOperationCards("weapon")}
                {renderWeaponForm()}
              </div>
            )}
            {activeSection === "vest" && (
              <div>
                {renderOperationCards("vest")}
                {renderVestForm()}
              </div>
            )}
          </div>
        </div>
      </div>

      {popupMessage && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          background: popupMessage.includes("Error")
            ? "linear-gradient(135deg, #ff4757, #ff3742)"
            : "linear-gradient(135deg, #00ffcc, #00d4aa)",
          color: popupMessage.includes("Error") ? "#ffffff" : "#0a0a1f",
          padding: "15px 25px",
          borderRadius: "12px",
          border: `2px solid ${
            popupMessage.includes("Error") ? "#ff4757" : "#00ffcc"
          }`,
          boxShadow: `0 8px 32px ${
            popupMessage.includes("Error")
              ? "rgba(255, 71, 87, 0.4)"
              : "rgba(0, 255, 195, 0.4)"
          }`,
          zIndex: 1000,
          maxWidth: "400px",
          wordWrap: "break-word",
          fontWeight: "bold",
          fontSize: "14px",
          animation: "slideIn 0.3s ease-out"
        }}>
          {popupMessage}
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);      opacity: 1; }
        }
        .copy-text {
          cursor: pointer;
          color: #00ffcc;
          text-decoration: underline;
          font-weight: bold;
        }
        .copy-text:hover { color: #00d4aa; }
        .weapon-item, .vest-item {
          background: rgba(0, 255, 195, 0.05);
          padding: 10px;
          margin: 8px 0;
          border-radius: 8px;
          border: 1px solid rgba(0, 255, 195, 0.2);
        }
        .weapons-list, .vests-list {
          max-height: 400px;
          overflow-y: auto;
        }
        .info-text {
          text-align: center;
          padding: 15px;
          background: rgba(0, 255, 195, 0.1);
          border-radius: 8px;
          margin: 10px 0;
        }
      `}</style>
    </div>
  );
}
