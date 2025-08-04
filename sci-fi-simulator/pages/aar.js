import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import styles from "../styles/aar.module.css";
import Sidebar from "../components/ASidebar";
import KillFeed from "../components/AKillFeed";
import StatsTable from "../components/AStatsTable";
import TimelineControls from "../components/ATimelineControls";
import Link from "next/link";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { WS_CONFIG } from "../config";
// Dynamically import Leaflet-based MapSection to avoid SSR issues
const MapSection = dynamic(() => import("../components/MapSection"), {
  ssr: false,
});

function AfterActionReview() {
  const [soldiers, setSoldiers] = useState([]);
  const [selectedSoldierId, setSelectedSoldierId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [sessionData, setSessionData] = useState([]);
  const [killFeedData, setKillFeedData] = useState([]);
  const [statsData, setStatsData] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [isSessionInitializing, setIsSessionInitializing] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState(null);

  const lastUpdateTimeRef = useRef(0);
  const updateQueueRef = useRef([]);
  const isProcessingUpdatesRef = useRef(false);
  const batchTimeoutRef = useRef(null);

  // Optimized batch processing for soldier updates
  const processSoldierUpdates = useCallback(async () => {
    if (isProcessingUpdatesRef.current || updateQueueRef.current.length === 0) {
      return;
    }

    isProcessingUpdatesRef.current = true;
    const updates = [...updateQueueRef.current];
    updateQueueRef.current = [];

    // Process updates in smaller batches to prevent UI blocking
    const batchSize = 2; // Reduced batch size for smoother updates
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      // Execute batch updates
      batch.forEach((update) => update());

      // Use requestAnimationFrame for smooth rendering
      if (i + batchSize < updates.length) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    }

    isProcessingUpdatesRef.current = false;
  }, []);

  // Debounced batch update scheduler
  const scheduleBatchUpdate = useCallback(() => {
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
    }

    batchTimeoutRef.current = setTimeout(() => {
      processSoldierUpdates();
    }, 50); // 50ms debounce for smooth updates
  }, [processSoldierUpdates]);

  const initializeReplaySession = useCallback(async () => {
    const newSessionId = "24";
    setSessionId(newSessionId);
    setIsSessionInitializing(true);
    setInitializationError(null);

    const requestFormats = [
      {
        endpoint: `http://localhost:8000/api/replay/select_session/${newSessionId}`,
        body: JSON.stringify({ session_id: newSessionId }),
      },
      {
        endpoint: `http://localhost:8000/api/replay/select_session/${newSessionId}`,
        body: JSON.stringify({ sessionId: newSessionId }),
      },
      {
        endpoint: `http://localhost:8000/api/replay/select_session/${newSessionId}`,
        body: "",
      },
      {
        endpoint: `http://192.168.1.17:8000/api/replay/select_session/${newSessionId}`,
        body: JSON.stringify({ session_id: newSessionId }),
      },
    ];

    for (const format of requestFormats) {
      try {
        console.log(`Trying endpoint: ${format.endpoint} with body:`, format.body);
        const response = await fetch(format.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
          },
          body: format.body,
        });

        if (response.ok) {
          const result = await response.json();
          console.log("Session initialized successfully:", result);
          setSessionInitialized(true);
          setIsSessionInitializing(false);
          return;
        } else {
          const errorData = await response.text();
          console.log(
            `Failed with ${format.endpoint}: ${response.status} ${response.statusText}`,
            errorData
          );
        }
      } catch (error) {
        console.log(`Error with ${format.endpoint}:`, error.message);
      }
    }

    setInitializationError("Failed to initialize session with all request formats.");
    setIsSessionInitializing(false);
  }, []);

  useEffect(() => {
    initializeReplaySession();
  }, [initializeReplaySession]);

  const normalizeGPSData = useCallback((soldierData) => {
    let latitude = null;
    let longitude = null;

    if (soldierData.gps) {
      latitude = soldierData.gps.latitude || soldierData.gps.lat;
      longitude = soldierData.gps.longitude || soldierData.gps.lng;
    } else if (soldierData.position) {
      latitude = soldierData.position.latitude || soldierData.position.lat;
      longitude = soldierData.position.longitude || soldierData.position.lng;
    } else if (
      soldierData.latitude !== undefined &&
      soldierData.longitude !== undefined
    ) {
      latitude = soldierData.latitude;
      longitude = soldierData.longitude;
    }

    if (
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      return { latitude, longitude };
    }

    console.warn(`Invalid GPS coordinates for soldier ${soldierData.soldier_id}:`, {
      latitude,
      longitude,
    });
    return { latitude: null, longitude: null };
  }, []);

  // Optimized single soldier update with batching
  const updateSoldierData = useCallback(
    (soldierData) => {
      const gps = normalizeGPSData(soldierData);
      if (gps.latitude === null || gps.longitude === null) {
        return;
      }

      const updateFn = () => {
        setSoldiers((prev) => {
          const filtered = prev.filter((s) => s.soldier_id !== soldierData.soldier_id);
          const newSoldier = {
            soldier_id: soldierData.soldier_id,
            team: soldierData.team,
            call_sign: soldierData.call_sign,
            gps: gps,
            ...soldierData,
            lastUpdate: new Date().toISOString(),
          };
          return [...filtered, newSoldier];
        });
      };

      updateQueueRef.current.push(updateFn);
      scheduleBatchUpdate();
    },
    [normalizeGPSData, scheduleBatchUpdate]
  );

  // Optimized multiple soldiers update with better batching
  const updateMultipleSoldiers = useCallback(
    (soldiersData) => {
      if (!Array.isArray(soldiersData) || soldiersData.length === 0) return;

      const validSoldiers = [];
      soldiersData.forEach((soldierData) => {
        const gps = normalizeGPSData(soldierData);
        if (gps.latitude !== null && gps.longitude !== null) {
          const newSoldier = {
            soldier_id: soldierData.soldier_id,
            team: soldierData.team,
            call_sign: soldierData.call_sign,
            gps: gps,
            ...soldierData,
            lastUpdate: new Date().toISOString(),
          };
          validSoldiers.push(newSoldier);
        }
      });

      if (validSoldiers.length > 0) {
        const updateFn = () => {
          setSoldiers(validSoldiers);
        };
        updateQueueRef.current.push(updateFn);
        scheduleBatchUpdate();
      }
    },
    [normalizeGPSData, scheduleBatchUpdate]
  );

  useEffect(() => {
    if (!sessionInitialized || !sessionId) return;

    const connectionDelay = setTimeout(() => {
      const soldierWs = new WebSocket("ws://192.168.1.17:8765/ws");
      const killFeedWs = new WebSocket("ws://192.168.1.17:8766/ws");
      const statsWs = new WebSocket("ws://192.168.1.17:8767/ws");

      soldierWs.onopen = () => {
        console.log("Soldier WebSocket connected to 192.168.1.17:8765/ws");
        soldierWs.send(JSON.stringify({ type: "init", sessionId: sessionId }));
      };

      soldierWs.onmessage = (message) => {
        try {
          const now = Date.now();
          if (now - lastUpdateTimeRef.current < 100) return; // Increased throttle to 100ms for better performance
          lastUpdateTimeRef.current = now;

          const data = JSON.parse(message.data);

          if (data.type === "session_data") {
            console.log("Received session data");
            setSessionData(data.soldiers || []);
            setTotalDuration(data.duration || 0);

            if (data.soldiers && Array.isArray(data.soldiers)) {
              // Use batch update for initial session data
              updateMultipleSoldiers(data.soldiers);
            }
          } else if (data.type === "frame_data") {
            console.log("Received frame data");
            if (data.soldiers && Array.isArray(data.soldiers)) {
              // Use batch update for frame data
              updateMultipleSoldiers(data.soldiers);
            }
          } else if (data.type === "soldier_movement") {
            console.log(`Received movement for soldier: ${data.soldier_id}`);
            // Use individual update for single soldier movement
            updateSoldierData(data);
          }
        } catch (error) {
          console.error("Error parsing soldier data:", error);
        }
      };

      soldierWs.onerror = (error) => console.error("Soldier WebSocket error:", error);

      killFeedWs.onopen = () => {
        console.log("Kill Feed WebSocket connected to 192.168.1.17:8766/ws");
        killFeedWs.send(JSON.stringify({ type: "init", sessionId: sessionId }));
      };

      killFeedWs.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.type === "kill_feed_history") {
            setKillFeedData(data.events || []);
          }
        } catch (error) {
          console.error("Error parsing kill feed data:", error);
        }
      };

      killFeedWs.onerror = (error) => console.error("Kill Feed WebSocket error:", error);

      statsWs.onopen = () => {
        console.log("Stats WebSocket connected to 192.168.1.17:8767/ws");
        statsWs.send(JSON.stringify({ type: "init", sessionId: sessionId }));
      };

      statsWs.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data.type === "stats_history") {
            setStatsData(data.stats || []);
          }
        } catch (error) {
          console.error("Error parsing stats data:", error);
        }
      };

      statsWs.onerror = (error) => console.error("Stats WebSocket error:", error);

      return () => {
        soldierWs.close();
        killFeedWs.close();
        statsWs.close();
      };
    }, 1000);

    return () => clearTimeout(connectionDelay);
  }, [sessionInitialized, sessionId, updateSoldierData, updateMultipleSoldiers]);

  useEffect(() => {
    let interval;
    if (isPlaying && currentTime < totalDuration) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const newTime = prev + 50 * playbackSpeed;
          if (newTime >= totalDuration) {
            setIsPlaying(false);
            return totalDuration;
          }
          return newTime;
        });
      }, 50);
    }

    return () => clearInterval(interval);
  }, [isPlaying, currentTime, totalDuration, playbackSpeed]);

  // Optimized data update at specific time with better batching
  const updateDataAtTime = useCallback(
    (time) => {
      if (!sessionData.length) return;

      const currentFrame = sessionData.filter((data) => data.timestamp <= time);
      if (currentFrame.length > 0) {
        const latestSoldiers = new Map();

        currentFrame.forEach((frame) => {
          if (frame.soldiers && Array.isArray(frame.soldiers)) {
            frame.soldiers.forEach((soldier) => {
              if (
                !latestSoldiers.has(soldier.soldier_id) ||
                latestSoldiers.get(soldier.soldier_id).timestamp <
                  soldier.timestamp
              ) {
                latestSoldiers.set(soldier.soldier_id, soldier);
              }
            });
          }
        });

        const soldiersToUpdate = Array.from(latestSoldiers.values());
        if (soldiersToUpdate.length > 0) {
          // Use batch update for timeline scrubbing
          updateMultipleSoldiers(soldiersToUpdate);
        }
      }
    },
    [sessionData, updateMultipleSoldiers]
  );

  useEffect(() => {
    updateDataAtTime(currentTime);
  }, [currentTime, updateDataAtTime]);

  const handleSelectSoldier = useCallback((soldierId) => {
    setSelectedSoldierId((prevId) => (prevId === soldierId ? null : soldierId));
  }, []);

  const handleTimelineChange = useCallback((newTime) => {
    setCurrentTime(newTime);
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleRewind = useCallback(() => {
    const newTime = Math.max(0, currentTime - 10000);
    setCurrentTime(newTime);
  }, [currentTime]);

  const handleFastForward = useCallback(() => {
    const newTime = Math.min(totalDuration, currentTime + 10000);
    setCurrentTime(newTime);
  }, [totalDuration, currentTime]);

  const handleSpeedChange = useCallback((speed) => {
    setPlaybackSpeed(speed);
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const handleSkipToEnd = useCallback(() => {
    setCurrentTime(totalDuration);
    setIsPlaying(false);
  }, [totalDuration]);

  const handleRetryInitialization = useCallback(() => {
    setSessionInitialized(false);
    setInitializationError(null);
    initializeReplaySession();
  }, [initializeReplaySession]);

  // Memoize soldiers array to prevent unnecessary re-renders
  const memoizedSoldiers = useMemo(() => soldiers, [soldiers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      updateQueueRef.current = [];
      isProcessingUpdatesRef.current = false;
    };
  }, []);

  if (isSessionInitializing) {
    return (
      <div className={styles.aarPage}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Initializing replay session...</p>
          <p>Session ID: {sessionId}</p>
        </div>
      </div>
    );
  }

  if (initializationError) {
    return (
      <div className={styles.aarPage}>
        <div className={styles.errorContainer}>
          <h2>Failed to Initialize Replay Session</h2>
          <p>Error: {initializationError}</p>
          <p>Session ID: {sessionId}</p>
          <p style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
            Please check your backend configuration and ensure the replay API endpoint is running.
          </p>
          <button
            onClick={handleRetryInitialization}
            className={styles.retryButton}
          >
            Retry Initialization
          </button>
          <Link href="/" className={styles.backButton}>
            Back to Menu
          </Link>
        </div>
      </div>
    );
  }

  if (!sessionInitialized) {
    return (
      <div className={styles.aarPage}>
        <div className={styles.loadingContainer}>
          <p>Waiting for session initialization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.aarPage}>
      <Link href="/" className={styles.endSessionButton}>
        Back to Menu
      </Link>
      <div className={styles.sessionInfo}>
        <span>Session: {sessionId}</span>
        <span style={{ marginLeft: "20px", fontSize: "12px", color: "#666" }}>
          Updates: {updateQueueRef.current.length} queued
        </span>
      </div>
      <div className={styles.container}>
        <div className={styles.leftContainer}>
          <Sidebar
            soldiers={memoizedSoldiers}
            selectedSoldierId={selectedSoldierId}
            onSelectSoldier={handleSelectSoldier}
          />
        </div>
        <div className={styles.rightContainer}>
          <div className={styles.mapContainer}>
            <MapSection
              soldiers={memoizedSoldiers}
              selectedSoldierId={selectedSoldierId}
              isReplayMode={true}
            />
          </div>
          <div className={styles.timelineSection}>
            <TimelineControls
              currentTime={currentTime}
              totalDuration={totalDuration}
              isPlaying={isPlaying}
              playbackSpeed={playbackSpeed}
              onTimelineChange={handleTimelineChange}
              onPlayPause={handlePlayPause}
              onRewind={handleRewind}
              onFastForward={handleFastForward}
              onSpeedChange={handleSpeedChange}
              onRestart={handleRestart}
              onSkipToEnd={handleSkipToEnd}
            />
          </div>
          <div className={styles.bottomSection}>
            <div className={styles.killFeed}>
              <KillFeed
                killFeedData={killFeedData}
                currentTime={currentTime}
                isReplayMode={true}
              />
            </div>
            <div className={styles.statsTable}>
              <StatsTable
                statsData={statsData}
                currentTime={currentTime}
                isReplayMode={true}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AfterActionReview;
