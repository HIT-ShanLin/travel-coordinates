import { useEffect, useState, type FormEvent } from "react";
import type { Place } from "../lib/types";

type PlaceDraft = {
  name: string;
  latitude: number;
  longitude: number;
  travel_date: string;
  note: string;
  place_type: string;
  country: string;
  city: string;
};

type Props = {
  place: Place | null;
  onUpdatePlace: (input: PlaceDraft) => Promise<void>;
  onUploadPhoto: (file: File) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onCreatePost: (input: { title: string; content: string; file?: File | null }) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onDeletePlace: () => Promise<void>;
  onClose: () => void;
};

function toDraft(place: Place): PlaceDraft {
  return {
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    travel_date: place.travel_date,
    note: place.note,
    place_type: place.place_type,
    country: place.country,
    city: place.city,
  };
}

export function PlaceDrawer({
  place,
  onUpdatePlace,
  onUploadPhoto,
  onDeletePhoto,
  onCreatePost,
  onDeletePost,
  onDeletePlace,
  onClose,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlaceDraft | null>(place ? toDraft(place) : null);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postFile, setPostFile] = useState<File | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    setDraft(place ? toDraft(place) : null);
    setEditing(false);
    setActivePhotoIndex(0);
  }, [place?.id]);

  if (!place || !draft) {
    return (
      <div className="panel-content">
        <div className="panel-header">
          <h2>旅行记忆</h2>
          <button className="ghost-btn" type="button" onClick={onClose}>关闭</button>
        </div>
        <p className="helper">点击标记查看旅行记忆。</p>
      </div>
    );
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    await onUpdatePlace(draft);
    setEditing(false);
  }

  const photos = place.photos ?? [];
  const hasPhotos = photos.length > 0;
  const currentPhoto = hasPhotos ? photos[activePhotoIndex] : null;

  function goToPhoto(delta: number) {
    if (!hasPhotos) return;
    const next = (activePhotoIndex + delta + photos.length) % photos.length;
    setActivePhotoIndex(next);
  }

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div className="panel-content">
      {/* ---- header ---- */}
      <div className="panel-header">
        <div>
          <h2>{place.name}</h2>
          <p className="panel-sub">
            📍 {[place.country, place.city].filter(Boolean).join(" · ") || "未知地点"}
            {" · "}{place.travel_date || "未填日期"}
          </p>
        </div>
        <div className="drawer-actions">
          <button className="ghost-btn" onClick={() => setEditing((v) => !v)} type="button">
            {editing ? "取消编辑" : "编辑"}
          </button>
          <button className="ghost-btn" onClick={onClose} type="button">
            {isMobile ? "▼ 收起" : "✕ 关闭"}
          </button>
        </div>
      </div>

      {/* ---- hero photo gallery ---- */}
      <div className="hero-gallery">
        {hasPhotos ? (
          <>
            <div
              className="hero-image"
              style={{ backgroundImage: `url(${currentPhoto!.url})` }}
            >
              {/* nav arrows */}
              {photos.length > 1 && (
                <>
                  <button
                    className="hero-nav hero-nav-left"
                    type="button"
                    onClick={() => goToPhoto(-1)}
                    aria-label="上一张"
                  >
                    ‹
                  </button>
                  <button
                    className="hero-nav hero-nav-right"
                    type="button"
                    onClick={() => goToPhoto(1)}
                    aria-label="下一张"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {/* dot indicators */}
            {photos.length > 1 && (
              <div className="hero-dots">
                {photos.map((_, i) => (
                  <button
                    key={i}
                    className={`hero-dot ${i === activePhotoIndex ? "active" : ""}`}
                    type="button"
                    onClick={() => setActivePhotoIndex(i)}
                    aria-label={`第 ${i + 1} 张照片`}
                  />
                ))}
              </div>
            )}

            {/* thumbnail strip */}
            {photos.length > 1 && (
              <div className="hero-thumbs">
                {photos.map((photo, i) => (
                  <button
                    key={photo.id}
                    className={`hero-thumb ${i === activePhotoIndex ? "active" : ""}`}
                    type="button"
                    onClick={() => setActivePhotoIndex(i)}
                  >
                    <img src={photo.url} alt="" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="hero-empty">
            <span className="hero-empty-icon">🖼️</span>
            <p>暂无照片，上传第一张照片吧</p>
          </div>
        )}
      </div>

      {/* ---- edit form ---- */}
      {editing && (
        <form className="stack edit-form" onSubmit={handleUpdate}>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="地点名称" />
          <div className="two-col">
            <input
              type="number"
              step="any"
              value={draft.latitude}
              onChange={(e) => setDraft({ ...draft, latitude: Number(e.target.value) })}
              placeholder="纬度"
            />
            <input
              type="number"
              step="any"
              value={draft.longitude}
              onChange={(e) => setDraft({ ...draft, longitude: Number(e.target.value) })}
              placeholder="经度"
            />
          </div>
          <input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} placeholder="国家" />
          <input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="城市" />
          <input
            type="date"
            value={draft.travel_date}
            onChange={(e) => setDraft({ ...draft, travel_date: e.target.value })}
          />
          <input value={draft.place_type} onChange={(e) => setDraft({ ...draft, place_type: e.target.value })} placeholder="类型 / 标签" />
          <textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="简短备注" rows={4} />
          <button className="primary-btn" type="submit">
            保存地点
          </button>
        </form>
      )}

      {/* ---- view mode: info ---- */}
      {!editing && (
        <>
          {/* note */}
          <div className="info-block">
            <div className="meta-grid">
              <div>
                <span className="meta-label">旅行日期</span>
                <strong>{place.travel_date || "未填写"}</strong>
              </div>
              <div>
                <span className="meta-label">类型</span>
                <strong>{place.place_type || "未填写"}</strong>
              </div>
            </div>
            {place.note && <p className="note">{place.note}</p>}
          </div>

          {/* upload photo */}
          <section className="stack section-block">
            <div className="section-title">
              <h3>📷 照片 ({photos.length})</h3>
            </div>
            <label className="file-upload">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void onUploadPhoto(file);
                    e.currentTarget.value = "";
                  }
                }}
              />
              <span>+ 上传照片</span>
            </label>
            {hasPhotos && (
              <div className="media-grid">
                {photos.map((photo, i) => (
                  <figure className={`media-card ${i === activePhotoIndex ? "active" : ""}`} key={photo.id}>
                    <img
                      src={photo.url}
                      alt={photo.filename}
                      onClick={() => setActivePhotoIndex(i)}
                    />
                    <button
                      className="mini-btn"
                      onClick={() => {
                        if (i === activePhotoIndex && photos.length > 1) {
                          setActivePhotoIndex(Math.max(0, i - 1));
                        }
                        void onDeletePhoto(photo.id);
                      }}
                      type="button"
                    >
                      删除
                    </button>
                  </figure>
                ))}
              </div>
            )}
          </section>

          {/* posts */}
          <section className="stack section-block">
            <div className="section-title">
              <h3>💬 旅行记录 ({place.posts?.length ?? 0})</h3>
            </div>
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                void onCreatePost({ title: postTitle, content: postContent, file: postFile });
                setPostTitle("");
                setPostContent("");
                setPostFile(null);
              }}
            >
              <input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="标题" />
              <textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} placeholder="分享你的旅行故事..." rows={3} />
              <div className="post-form-actions">
                <label className="file-upload inline">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setPostFile(e.target.files?.[0] ?? null)}
                  />
                  <span>{postFile ? `📎 ${postFile.name}` : "🖼️ 添加图片"}</span>
                </label>
                <button className="primary-btn" type="submit">
                  发布
                </button>
              </div>
            </form>
            <div className="stack">
              {place.posts?.map((post) => (
                <article className="post-card" key={post.id}>
                  <div className="post-head">
                    <div>
                      <h4>{post.title || "未命名"}</h4>
                      <p>{new Date(post.created_at).toLocaleString("zh-CN")}</p>
                    </div>
                    <button className="mini-btn" onClick={() => void onDeletePost(post.id)} type="button">
                      删除
                    </button>
                  </div>
                  {post.content && <p>{post.content}</p>}
                  {post.photo_id ? (
                    <img
                      className="post-image"
                      src={place.photos.find((ph) => ph.id === post.photo_id)?.url ?? ""}
                      alt={post.title}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {/* delete (at bottom, out of the way) */}
      {!editing && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
          <button
            className="ghost-btn danger"
            style={{ width: "100%" }}
            onClick={() => {
              if (confirm(`确定删除「${place.name}」及其所有照片和帖子吗？`)) {
                void onDeletePlace();
              }
            }}
            type="button"
          >
            🗑 删除此地点
          </button>
        </div>
      )}
    </div>
  );
}
