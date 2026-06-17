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
    id: "demo-kyoto",
    user_id: "0001",
    name: "京都",
    latitude: 35.0116,
    longitude: 135.7681,
    travel_date: "2024-10-03",
    note: "清晨在鸭川边散步。",
    place_type: "city",
    country: "Japan",
    city: "Kyoto",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    photos: [],
    posts: [],
  },
];

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listPlaces();
      const resolved = data.length > 0 ? data : demoPlaces;
      setPlaces(resolved);
      setSelectedPlaceId((current) => current ?? resolved[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法加载地点");
      setPlaces(demoPlaces);
      setSelectedPlaceId(demoPlaces[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const selectedPlace = useMemo(
    () => places.find((place) => place.id === selectedPlaceId) ?? null,
    [places, selectedPlaceId],
  );

  async function handleCreatePlace(input: PlaceInput) {
    const created = await createPlace(input);
    setPlaces((current) => [created, ...current.filter((place) => place.id !== created.id)]);
    setSelectedPlaceId(created.id);
  }

  async function handleUpdatePlace(input: PlaceInput) {
    if (!selectedPlace) return;
    const updated = await updatePlace(selectedPlace.id, input);
    setPlaces((current) => current.map((place) => (place.id === updated.id ? updated : place)));
  }

  async function handleUploadPhoto(file: File) {
    if (!selectedPlace) return;
    const updated = await uploadPhoto(selectedPlace.id, file);
    setPlaces((current) => current.map((place) => (place.id === updated.id ? updated : place)));
  }

  async function handleDeletePhoto(photoId: string) {
    if (!selectedPlace) return;
    await deletePhoto(selectedPlace.id, photoId);
    setPlaces((current) =>
      current.map((place) =>
        place.id === selectedPlace.id
          ? { ...place, photos: place.photos.filter((photo) => photo.id !== photoId) }
          : place,
      ),
    );
  }

  async function handleCreatePost(input: { title: string; content: string; file?: File | null }) {
    if (!selectedPlace) return;
    const updated = await createPost(selectedPlace.id, input);
    setPlaces((current) => current.map((place) => (place.id === updated.id ? updated : place)));
  }

  async function handleDeletePost(postId: string) {
    if (!selectedPlace) return;
    await deletePost(selectedPlace.id, postId);
    setPlaces((current) =>
      current.map((place) =>
        place.id === selectedPlace.id
          ? { ...place, posts: place.posts.filter((post) => post.id !== postId) }
          : place,
      ),
    );
  }

  async function handleDeleteSelectedPlace() {
    if (!selectedPlace) return;
    await deletePlace(selectedPlace.id);
    setPlaces((current) => {
      const remaining = current.filter((place) => place.id !== selectedPlace.id);
      setSelectedPlaceId(remaining[0]?.id ?? null);
      return remaining;
    });
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Travel Coordinates</p>
          <h1>旅行坐标</h1>
        </div>
        <button className="ghost-btn" type="button" onClick={() => void refresh()}>
          刷新数据
        </button>
      </header>

      <section className="hero-grid">
        <div className="card globe-card">
          <div className="section-title">
            <h2>地球</h2>
            <p>拖拽旋转，滚轮缩放，点击标记查看地点。</p>
          </div>
          {loading ? <div className="loading">正在加载...</div> : null}
          {error ? <div className="error">{error}</div> : null}
          <Globe places={places} selectedPlaceId={selectedPlaceId} onSelectPlace={setSelectedPlaceId} />
        </div>

        <div className="right-column">
          <PlaceForm onSubmit={handleCreatePlace} busy={loading} />
          <PlaceDrawer
            place={selectedPlace}
            onUpdatePlace={handleUpdatePlace}
            onUploadPhoto={handleUploadPhoto}
            onDeletePhoto={handleDeletePhoto}
            onCreatePost={handleCreatePost}
            onDeletePost={handleDeletePost}
            onDeletePlace={handleDeleteSelectedPlace}
          />
        </div>
      </section>

      <section className="card summary-card">
        <h2>地点列表</h2>
        <div className="place-list">
          {places.map((place) => (
            <button
              key={place.id}
              className={`place-chip ${place.id === selectedPlaceId ? "active" : ""}`}
              type="button"
              onClick={() => setSelectedPlaceId(place.id)}
            >
              <strong>{place.name}</strong>
              <span>
                {place.country || "未填国家"}
                {place.city ? ` · ${place.city}` : ""}
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
