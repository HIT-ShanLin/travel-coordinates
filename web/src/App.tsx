import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe } from "./components/Globe";
import { PlaceDrawer } from "./components/PlaceDrawer";
import UnifiedPostEditor from "./components/UnifiedPostEditor";
import type { LocationValue } from "./components/LocationPicker";
import { AuthGuard } from "./components/AuthGuard";
import {
  createPlace,
  createPost,
  deletePhoto,
  deletePlace,
  deletePost,
  listPlaces,
  updatePlace,
  uploadPhoto,
} from "./lib/api";
import { isLoggedIn, clearAuth, getUser } from "./lib/auth";
import type { Place, PlaceInput } from "./lib/types";

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "memories">(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());

  // Unified editor state
  const [editorMode, setEditorMode] = useState<"create" | "append" | null>(null);
  const [defaultEditorLocation, setDefaultEditorLocation] = useState<LocationValue | undefined>();

  const refresh = useCallback(async () => {
    if (!isLoggedIn()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listPlaces();
      setPlaces(data);
      setSelectedPlaceId((c) => c ?? data[0]?.id ?? null);
    } catch (err) {
      console.warn("加载地点失败:", err);
      setError(err instanceof Error ? err.message : "无法加载地点");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loggedIn) {
      void refresh();
    } else {
      setLoading(false);
    }
  }, [loggedIn, refresh]);

  const filteredPlaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return places;
    return places.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.note.toLowerCase().includes(q) ||
        p.place_type.toLowerCase().includes(q),
    );
  }, [places, searchQuery]);

  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  // All places for carousel swipe navigation (randomized, current place first)
  const siblingPlaces = useMemo(() => {
    if (!selectedPlace || places.length <= 1) return places;
    // Put current place first, then shuffle the rest with a stable pseudo-random order
    const rest = places.filter((p) => p.id !== selectedPlace.id);
    // Stable deterministic shuffle based on place IDs
    const sorted = [...rest].sort((a, b) => {
      const ha = a.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      const hb = b.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
      return ha - hb;
    });
    return [selectedPlace, ...sorted];
  }, [places, selectedPlace]);

  function openMemories(id: string) {
    setSelectedPlaceId(id);
    setPanel("memories");
    // Trigger map fly-to for any navigation (chip, search, marker click)
    const target = places.find((p) => p.id === id);
    if (target) {
      window.dispatchEvent(
        new CustomEvent("swipe-to-place", {
          detail: { longitude: target.longitude, latitude: target.latitude },
        }),
      );
    }
  }

  async function handleUpdatePlace(input: PlaceInput) {
    if (!selectedPlace) return;
    const updated = await updatePlace(selectedPlace.id, input);
    setPlaces((c) => c.map((p) => (p.id === updated.id ? updated : p)));
  }

  async function handleUploadPhoto(file: File) {
    if (!selectedPlace) return;
    const updated = await uploadPhoto(selectedPlace.id, file);
    setPlaces((c) => c.map((p) => (p.id === updated.id ? updated : p)));
  }

  async function handleDeletePhoto(photoId: string) {
    if (!selectedPlace) return;
    await deletePhoto(selectedPlace.id, photoId);
    setPlaces((c) =>
      c.map((p) =>
        p.id === selectedPlace.id
          ? { ...p, photos: p.photos.filter((ph) => ph.id !== photoId) }
          : p,
      ),
    );
  }

  async function handleCreatePost(input: {
    title: string;
    content: string;
    photo_id?: string;
  }) {
    if (!selectedPlace) return;
    const updated = await createPost(selectedPlace.id, input);
    setPlaces((c) => c.map((p) => (p.id === updated.id ? updated : p)));
  }

  async function handleDeletePost(postId: string) {
    if (!selectedPlace) return;
    await deletePost(selectedPlace.id, postId);
    setPlaces((c) =>
      c.map((p) =>
        p.id === selectedPlace.id
          ? { ...p, posts: p.posts.filter((pt) => pt.id !== postId) }
          : p,
      ),
    );
  }

  async function handleDeleteSelectedPlace() {
    if (!selectedPlace) return;
    await deletePlace(selectedPlace.id);
    setPlaces((c) => {
      const r = c.filter((p) => p.id !== selectedPlace.id);
      setSelectedPlaceId(r[0]?.id ?? null);
      return r;
    });
    setPanel(null);
  }

  // Map click → open editor with coordinates
  function handleMapClick(pos: { lat: number; lng: number }) {
    setDefaultEditorLocation({
      name: `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`,
      country: "",
      city: "",
      lat: pos.lat,
      lng: pos.lng,
    });
    setEditorMode("create");
  }

  // FAB → open editor in create mode
  function handleOpenCreate() {
    setDefaultEditorLocation(undefined);
    setEditorMode("create");
  }

  // PlaceDrawer append → open editor in append mode
  function handleAppendMemory() {
    if (!selectedPlace) return;
    setDefaultEditorLocation({
      name: selectedPlace.name,
      country: selectedPlace.country,
      city: selectedPlace.city,
      lat: selectedPlace.latitude,
      lng: selectedPlace.longitude,
    });
    setEditorMode("append");
  }

  // Editor success callback
  function handleEditorSuccess() {
    setEditorMode(null);
    refresh();
  }

  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <AuthGuard
      loggedIn={loggedIn}
      onLogin={() => setLoggedIn(true)}
    >
      <main className="app-shell">
        {/* ---- top bar ---- */}
        <header className="topbar">
          <div>
            <p className="eyebrow">Travel Coordinates</p>
            <h1>旅行坐标</h1>
          </div>
          <div className="topbar-actions">
            <button className="ghost-btn" type="button" onClick={refresh}>
              刷新数据
            </button>
            <button
              className="ghost-btn"
              type="button"
              onClick={() => {
                clearAuth();
                setLoggedIn(false);
                setPlaces([]);
                setSelectedPlaceId(null);
                setPanel(null);
              }}
            >
              退出
            </button>
          </div>
        </header>

        {/* ---- map ---- */}
        <div className="map-wrap">
          {loading && <div className="loading-inline">加载中...</div>}
          {error && <div className="error-inline">{error}</div>}

          <Globe
            places={filteredPlaces}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={(id) => openMemories(id)}
            onMapClick={handleMapClick}
          />

          {/* search bar */}
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="搜索足迹、地点..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredPlaces.length > 0) {
                  openMemories(filteredPlaces[0].id);
                }
              }}
            />
            {searchQuery && (
              <>
                <span className="search-count" style={{ fontSize: '0.75rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {filteredPlaces.length} 个结果
                </span>
                <button
                  className="search-clear"
                  type="button"
                  onClick={() => setSearchQuery("")}
                >
                  ✕
                </button>
              </>
            )}
          </div>

          {/* locate */}
          <button
            className="locate-btn-fab"
            type="button"
            onClick={() => {
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  window.dispatchEvent(
                    new CustomEvent("locate", {
                      detail: {
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                      },
                    }),
                  );
                },
                (err) => console.warn("定位失败:", err.message),
                { enableHighAccuracy: true, timeout: 15000 },
              );
            }}
            aria-label="定位"
          >
            🧭
          </button>

          {/* FAB */}
          <button
            className="fab"
            type="button"
            onClick={handleOpenCreate}
            aria-label="记录足迹"
          >
            ＋
          </button>

          {/* chip bar — grouped by city */}
          {filteredPlaces.length > 0 && (
            <div className="chip-bar">
              {(() => {
                // Group places by city (fallback: by name)
                const groups = new Map<string, { city: string; country: string; firstId: string; count: number }>();
                for (const p of filteredPlaces) {
                  const key = p.city || p.name;
                  const existing = groups.get(key);
                  if (existing) {
                    existing.count++;
                  } else {
                    groups.set(key, {
                      city: p.city || p.name,
                      country: p.country,
                      firstId: p.id,
                      count: 1,
                    });
                  }
                }
                return Array.from(groups.values()).map((g) => (
                  <button
                    key={g.firstId}
                    className={`place-chip ${filteredPlaces.some((p) => p.id === selectedPlaceId && (p.city || p.name) === g.city) ? "active" : ""}`}
                    type="button"
                    onClick={() => openMemories(g.firstId)}
                  >
                    <strong>
                      {g.city}
                      {g.count > 1 && <span className="chip-count"> ({g.count})</span>}
                    </strong>
                    <span>{g.country || "..."}</span>
                  </button>
                ));
              })()}
            </div>
          )}
        </div>

        {/* slide panel */}
        {panel === "memories" && (
          <>
            <div
              className="panel-overlay"
              onClick={() => setPanel(null)}
            />
            <aside
              className={`slide-panel ${isMobile ? "sheet" : "drawer"}`}
            >
              {isMobile && <div className="sheet-handle" />}
              <PlaceDrawer
                place={selectedPlace}
                onUpdatePlace={handleUpdatePlace}
                onUploadPhoto={handleUploadPhoto}
                onDeletePhoto={handleDeletePhoto}
                onCreatePost={handleCreatePost}
                onDeletePost={handleDeletePost}
                onDeletePlace={handleDeleteSelectedPlace}
                onClose={() => setPanel(null)}
                onAppendMemory={handleAppendMemory}
                siblingPlaces={siblingPlaces}
                onNavigate={(id) => {
                  setSelectedPlaceId(id);
                  // trigger map fly-to when swiping between places
                  const target = places.find((p) => p.id === id);
                  if (target) {
                    window.dispatchEvent(
                      new CustomEvent("swipe-to-place", {
                        detail: {
                          longitude: target.longitude,
                          latitude: target.latitude,
                        },
                      }),
                    );
                  }
                }}
                currentUserId={getUser()?.id}
              />
            </aside>
          </>
        )}

        {/* Unified editor (modal, replaces PlaceForm) */}
        {editorMode && (
          <UnifiedPostEditor
            mode={editorMode}
            defaultLocation={defaultEditorLocation}
            onClose={() => setEditorMode(null)}
            onSuccess={handleEditorSuccess}
          />
        )}
      </main>
    </AuthGuard>
  );
}
