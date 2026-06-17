import { useEffect, useMemo, useState } from "react";
import { Globe } from "./components/Globe";
import { PlaceDrawer } from "./components/PlaceDrawer";
import { PlaceForm } from "./components/PlaceForm";
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
import type { Place, PlaceInput } from "./lib/types";

const demoPlaces: Place[] = [
  {
    id: "demo-shanghai", user_id: "0001", name: "上海",
    latitude: 31.2304, longitude: 121.4737,
    travel_date: "2025-03-15", note: "外滩夜景很美。",
    place_type: "city", country: "China", city: "上海市",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    photos: [], posts: [],
  },
  {
    id: "demo-beijing", user_id: "0001", name: "北京",
    latitude: 39.9042, longitude: 116.4074,
    travel_date: "2025-05-01", note: "故宫和长城。",
    place_type: "city", country: "China", city: "北京市",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    photos: [], posts: [],
  },
  {
    id: "demo-kyoto", user_id: "0001", name: "京都",
    latitude: 35.0116, longitude: 135.7681,
    travel_date: "2024-10-03", note: "清晨在鸭川边散步。",
    place_type: "city", country: "Japan", city: "Kyoto",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    photos: [], posts: [],
  },
];

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "add" | "memories">(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listPlaces();
      const resolved = data.length > 0 ? data : demoPlaces;
      setPlaces(resolved);
      setSelectedPlaceId((c) => c ?? resolved[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载地点");
      setPlaces(demoPlaces);
      setSelectedPlaceId(demoPlaces[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

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

  async function handleCreatePost(input: { title: string; content: string; file?: File | null }) {
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

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <main className="app-shell">
      {/* ---- top bar ---- */}
      <header className="topbar">
        <div>
          <p className="eyebrow">Travel Coordinates</p>
          <h1>旅行坐标</h1>
        </div>
        <button className="ghost-btn" type="button" onClick={() => void refresh()}>
          刷新数据
        </button>
      </header>

      {/* ---- map (full width) ---- */}
      <div className="map-wrap">
        {loading ? <div className="loading-inline">加载中...</div> : null}
        {error ? <div className="error-inline">{error}</div> : null}
        <Globe
          places={places}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={(id) => openMemories(id)}
        />

        {/* FAB */}
        <button
          className="fab"
          type="button"
          onClick={() => setPanel(panel === "add" ? null : "add")}
          aria-label="新增地点"
        >
          {panel === "add" ? "✕" : "+"}
        </button>

        {/* bottom chip bar */}
        <div className="chip-bar">
          {places.map((place) => (
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
      </div>

      {/* ---- slide panel ---- */}
      {panel && (
        <>
          <div className="panel-overlay" onClick={() => setPanel(null)} />
          <aside className={`slide-panel ${isMobile ? "sheet" : "drawer"}`}>
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
  );
}
