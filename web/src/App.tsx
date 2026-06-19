import { useCallback, useEffect, useMemo, useState } from "react";
import { Globe } from "./components/Globe";
import { PlaceDrawer } from "./components/PlaceDrawer";
import { PlaceForm } from "./components/PlaceForm";
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
import { isLoggedIn, clearAuth } from "./lib/auth";
import type { Place, PlaceInput } from "./lib/types";

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "add" | "memories">(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());

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

  function openMemories(id: string) {
    setSelectedPlaceId(id);
    setPanel("memories");
  }

  async function handleCreatePlace(input: PlaceInput) {
    const created = await createPlace(input);
    setPlaces((c) => [created, ...c.filter((p) => p.id !== created.id)]);
    setSelectedPlaceId(created.id);
    setPanel("memories");
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
    file?: File | null;
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
          />

          {/* search bar */}
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="搜索地点、国家、城市..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-clear"
                type="button"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
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
                () => alert("定位失败"),
                { enableHighAccuracy: true, timeout: 10000 },
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
            onClick={() => setPanel(panel === "add" ? null : "add")}
            aria-label="新增地点"
          >
            {panel === "add" ? "✕" : "+"}
          </button>

          {/* chip bar */}
          {filteredPlaces.length > 0 && (
            <div className="chip-bar">
              {filteredPlaces.map((place) => (
                <button
                  key={place.id}
                  className={`place-chip ${place.id === selectedPlaceId ? "active" : ""}`}
                  type="button"
                  onClick={() => openMemories(place.id)}
                >
                  <strong>{place.name}</strong>
                  <span>
                    {place.country || "..."}
                    {place.city ? ` · ${place.city}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* slide panel */}
        {panel && (
          <>
            <div
              className="panel-overlay"
              onClick={() => setPanel(null)}
            />
            <aside
              className={`slide-panel ${isMobile ? "sheet" : "drawer"}`}
            >
              {isMobile && <div className="sheet-handle" />}
              {panel === "add" ? (
                <PlaceForm
                  onSubmit={handleCreatePlace}
                  busy={loading}
                  onClose={() => setPanel(null)}
                />
              ) : (
                <PlaceDrawer
                  place={selectedPlace}
                  onUpdatePlace={handleUpdatePlace}
                  onUploadPhoto={handleUploadPhoto}
                  onDeletePhoto={handleDeletePhoto}
                  onCreatePost={handleCreatePost}
                  onDeletePost={handleDeletePost}
                  onDeletePlace={handleDeleteSelectedPlace}
                  onClose={() => setPanel(null)}
                />
              )}
            </aside>
          </>
        )}
      </main>
    </AuthGuard>
  );
}
