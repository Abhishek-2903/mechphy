// pages/synchronization.js
import { useEffect, useState } from "react";
import { useGlobalContext } from "../context/GlobalContext";
import { useRouter } from "next/router";


export default function Synchronization() {
  const router = useRouter();
  const { resourceAllocation, activeStatus, setActiveStatus } = useGlobalContext();
  const [webSocketError] = useState(null);           // no setter
  const [activeForceTeam, setActiveForceTeam] = useState(null);
  const [showRealTimeButton, setShowRealTimeButton] = useState(false);

  // Initialize statuses on load
  useEffect(() => {
    if (resourceAllocation && Object.keys(resourceAllocation).length > 0) {
      const firstForce = Object.keys(resourceAllocation)[0];
      const firstTeam = Object.keys(resourceAllocation[firstForce])[0];
      setActiveForceTeam(`${firstForce}-${firstTeam}`);

      // Mark all as unidentified initially
      const initialStatuses = {};
      for (const forceKey in resourceAllocation) {
        const teamsObj = resourceAllocation[forceKey];
        for (const teamKey in teamsObj) {
          const { soldiers } = teamsObj[teamKey];
          if (Array.isArray(soldiers)) {
            soldiers.forEach(({ soldier_id }) => {
              initialStatuses[soldier_id] = "unidentified";
            });
          }
        }
      }
      setActiveStatus(initialStatuses);

      // After 5s, randomly mark ~50% inactive
      const timer1 = setTimeout(() => {
        setActiveStatus((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((id) => {
            if (Math.random() > 0.5) updated[id] = "inactive";
          });
          return updated;
        });

        // After another 10s, mark all active and show button
        const timer2 = setTimeout(() => {
          setActiveStatus((prev) => {
            const allActive = {};
            Object.keys(prev).forEach((id) => {
              allActive[id] = "active";
            });
            return allActive;
          });
          setShowRealTimeButton(true);
        }, 10000);

        return () => clearTimeout(timer2);
      }, 5000);

      return () => clearTimeout(timer1);
    }
  }, [resourceAllocation, setActiveStatus]);

  const getStatusColor = (status) => {
    if (status === "active") return styles.statusActive;
    if (status === "inactive") return styles.statusInactive;
    return styles.statusUnidentified;
  };

  const calculatePanelHeight = () => {
    if (!activeForceTeam) return 400;
    const [forceKey, teamKey] = activeForceTeam.split("-");
    const entry = resourceAllocation[forceKey]?.[teamKey];
    const count = Array.isArray(entry?.soldiers) ? entry.soldiers.length : 0;
    return Math.max(400, count * 100);
  };

  if (!resourceAllocation || Object.keys(resourceAllocation).length === 0) {
    return (
      <div className={styles.container}>
        <h1>Synchronization</h1>
        <p>No data available. Please complete Resource Allocation first.</p>
      </div>
    );
  }

  const [currentForce, currentTeam] = activeForceTeam
    ? activeForceTeam.split("-")
    : [null, null];

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        <button
          className={styles.button}
          onClick={() => router.push("/map-overlay")}
        >
          MAP OVERLAY
        </button>
        <h2>DATA SYNCHRONIZATION</h2>
        {showRealTimeButton ? (
          <button
            className={styles.button}
            onClick={() => router.push("/real-time-monitoring")}
          >
            REAL TIME MONITORING
          </button>
        ) : (
          <div className={styles.buttonPlaceholder} />
        )}
      </div>

      <div className={styles.tabs}>
        {(() => {
          const tabs = [];
          for (const forceKey in resourceAllocation) {
            const teamsObj = resourceAllocation[forceKey];
            for (const teamKey in teamsObj) {
              tabs.push(
                <button
                  key={`${forceKey}-${teamKey}`}
                  className={`${styles.tab} ${
                    activeForceTeam === `${forceKey}-${teamKey}`
                      ? styles.active
                      : ""
                  }`}
                  onClick={() =>
                    setActiveForceTeam(`${forceKey}-${teamKey}`)
                  }
                >
                  {`${forceKey.toUpperCase()} ${teamKey.toUpperCase()}`}
                </button>
              );
            }
          }
          return tabs;
        })()}
      </div>

      {webSocketError && (
        <div className={styles.errorMessage}>
          <p>{webSocketError}</p>
        </div>
      )}

      {currentForce && currentTeam && (
        <div
          className={styles.panel}
          style={{ height: `${calculatePanelHeight()}px` }}
        >
          <div className={styles.gridContainer}>
            {resourceAllocation[currentForce][currentTeam].soldiers.map(
              (soldier, idx) => (
                <div
                  key={`${soldier.soldier_id}-${idx}`}
                  className={styles.soldierRow}
                >
                  <div className={styles.soldierName}>
                    {`${currentTeam.toUpperCase()} ${idx + 1}`}
                  </div>
                  <div className={styles.dropdown}>
                    <input
                      type="text"
                      placeholder="Call Sign"
                      value={soldier.soldier_id}
                      readOnly
                    />
                  </div>
                  <div className={styles.dropdown}>
                    <select defaultValue={soldier.role}>
                      <option value={soldier.role}>
                        {soldier.role.toUpperCase()}
                      </option>
                    </select>
                  </div>
                  <div className={styles.dropdown}>
                    <select defaultValue={soldier.weapon_id}>
                      <option value={soldier.weapon_id}>
                        {soldier.weapon_id}
                      </option>
                    </select>
                  </div>
                  <div className={styles.dropdown}>
                    <select defaultValue={soldier.vest_id}>
                      <option value={soldier.vest_id}>
                        {soldier.vest_id}
                      </option>
                    </select>
                  </div>
                  <div className={styles.statusIndicator}>
                    <span className={styles.statusLabel}>Status:</span>
                    <div
                      className={`${styles.statusToggle} ${getStatusColor(
                        activeStatus[soldier.soldier_id]
                      )}`}
                    />
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
