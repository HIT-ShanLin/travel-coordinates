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
    travel_date: "2025-03-15", note: "外滩夜景很美，黄浦江两岸灯火辉煌。",
    place_type: "city", country: "中国", city: "上海市",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    photos: [
      { id: "sh-ph-1", filename: "the-bund.jpg", content_type: "image/jpeg", path: "", url: "https://picsum.photos/seed/shbund/400/400", created_at: new Date().toISOString() },
      { id: "sh-ph-2", filename: "lujiazui.jpg", content_type: "image/jpeg", path: "", url: "https://picsum.photos/seed/shpudong/400/400", created_at: new Date().toISOString() },
      { id: "sh-ph-3", filename: "yu-garden.jpg", content_type: "image/jpeg", path: "", url: "https://picsum.photos/seed/shgarden/400/400", created_at: new Date().toISOString() },
    ],
    posts: [
      { id: "sh-po-1", title: "外滩漫步", content: "晚上沿着外滩走了一圈，江风很舒服，万国建筑群在灯光下特别好看。", image_path: "", image_url: "https://picsum.photos/seed/shpost1/600/400", created_at: new Date().toISOString() },
    ],
  },
  {
    id: "demo-beijing", user_id: "0001", name: "北京",
    latitude: 39.9042, longitude: 116.4074,
    travel_date: "2025-05-01", note: "故宫的红墙金瓦，长城的雄伟壮观。",
    place_type: "city", country: "中国", city: "北京市",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    photos: [
      { id: "bj-ph-1", filename: "forbidden-city.jpg", content_type: "image/jpeg", path: "", url: "https://picsum.photos/seed/bjpalace/400/400", created_at: new Date().toISOString() },
      { id: "bj-ph-2", filename: "great-wall.jpg", content_type: "image/jpeg", path: "", url: "https://picsum.photos/seed/bjwall/400/400", created_at: new Date().toISOString() },
    ],
    posts: [
      { id: "bj-po-1", title: "故宫一日游", content: "五一假期人超多，但故宫真的值得一看，太壮观了！", image_path: "", image_url: "", created_at: new Date().toISOString() },
    ],
  },
  {
    id: "demo-kyoto", user_id: "0001", name: "京都",
    latitude: 35.0116, longitude: 135.7681,
    travel_date: "2024-10-03", note: "清晨在鸭川边散步，红叶和古寺相映成趣。",
    place_type: "city", country: "日本", city: "Kyoto",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    photos: [
      { id: "ky-ph-1", filename: "kamo-river.jpg", content_type: "image/jpeg", path: "", url: "https://picsum.photos/seed/kyriver/400/400", created_at: new Date().toISOString() },
    ],
    posts: [
      { id: "ky-po-1", title: "鸭川晨跑", content: "十月的京都清晨微凉，沿着鸭川跑步太惬意了。", image_path: "", image_url: "https://picsum.photos/seed/kyrun/600/400", created_at: new Date().toISOString() },
      { id: "ky-po-2", title: "清水寺红叶", content: "红叶季刚开始，清水寺的枫叶已经很有层次感了。", image_path: "", image_url: "https://picsum.photos/seed/kymomiji/600/400", created_at: new Date().toISOString() },
    ],
  },
  {
    id: "demo-chengdu", user_id: "0001", name: "成都",
    latitude: 30.5728, longitude: 104.0668,
    travel_date: "2025-09-20", note: "在宽窄巷子喝茶，看熊猫基地的滚滚。",
    place_type: "city", country: "中国", city: "成都市",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    photos: [
      { id: "cd-ph-1", filename: "panda.jpg", content_type: "image/jpeg", path: "", url: "https://picsum.photos/seed/cdpanda/400/400", created_at: new Date().toISOString() },
    ],
    posts: [],
  },
  {
    id: "demo-lijiang", user_id: "0001", name: "丽江",
    latitude: 26.8721, longitude: 100.2299,
    travel_date: "2025-07-12", note: "古城里的石板路，远处玉龙雪山白雪皑皑。",
    place_type: "town", country: "中国", city: "丽江市",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    photos: [
      { id: "lj-ph-1", filename: "old-town.jpg", content_type: "image/jpeg", path: "", url: "https://picsum.photos/seed/ljtown/400/400", created_at: new Date().toISOString() },
      { id: "lj-ph-2", filename: "snow-mountain.jpg", content_type: "image/jpeg", path: "", url: "https://picsum.photos/seed/ljsnow/400/400", created_at: new Date().toISOString() },
    ],
    posts: [],
  },
];

export default function App() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "add" | "memories">(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [demoMode, setDemoMode] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await listPlaces();
      if (data.length > 0) {
        setPlaces(data);
        setDemoMode(false);
        setSelectedPlaceId((c) => c ?? data[0]?.id ?? null);
      } else {
        setPlaces(demoPlaces);
        setDemoMode(true);
        setSelectedPlaceId((c) => c ?? demoPlaces[0]?.id ?? null);
      }
    } catch (err) {
      console.warn("后端不可用，使用演示数据:", err instanceof Error ? err.message : err);
      setPlaces(demoPlaces);
      setDemoMode(true);
      setSelectedPlaceId((c) => c ?? demoPlaces[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  // filter places by search query
  const filteredPlaces = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return places;
    return places.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.country.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.note.toLowerCase().includes(q) ||
      p.place_type.toLowerCase().includes(q)
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
        <div className="topbar-actions">
          {demoMode && (
            <span className="demo-badge" title="后端未连接，显示演示数据">
              演示模式
            </span>
          )}
          <button className="ghost-btn" type="button" onClick={() => void refresh()}>
            刷新数据
          </button>
        </div>
      </header>

      {/* ---- map (full width) ---- */}
      <div className="map-wrap">
        {loading ? <div className="loading-inline">加载中...</div> : null}
        {error ? <div className="error-inline">{error}</div> : null}

        <Globe
          places={filteredPlaces}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={(id) => openMemories(id)}
        />

        {/* ---- search bar (upper-left overlay) ---- */}
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

        {/* ---- locate button ---- */}
        <button
          className="locate-btn-fab"
          type="button"
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                // dispatch custom event so Globe can pick it up
                window.dispatchEvent(
                  new CustomEvent("locate", {
                    detail: {
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude,
                    },
                  })
                );
              },
              () => alert("定位失败，请检查浏览器定位权限"),
              { enableHighAccuracy: true, timeout: 10000 },
            );
          }}
          aria-label="定位当前位置"
          title="定位当前位置"
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

        {/* bottom chip bar */}
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
      </div>

      {/* ---- slide panel ---- */}
      {panel && (
        <>
          <div className="panel-overlay" onClick={() => setPanel(null)} />
          <aside className={`slide-panel ${isMobile ? "sheet" : "drawer"}`}>
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
  );
}
