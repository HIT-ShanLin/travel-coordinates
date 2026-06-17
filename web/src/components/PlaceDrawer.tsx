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
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlaceDraft | null>(place ? toDraft(place) : null);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postFile, setPostFile] = useState<File | null>(null);

  useEffect(() => {
    setDraft(place ? toDraft(place) : null);
    setEditing(false);
  }, [place?.id]);

  if (!place || !draft) {
    return (
      <aside className="card drawer">
        <div className="section-title">
          <h2>地点详情</h2>
          <p>点击地球上的标记查看内容。</p>
        </div>
      </aside>
    );
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onUpdatePlace(draft);
    setEditing(false);
  }

  return (
    <aside className="card drawer">
      <div className="drawer-top">
        <div className="section-title">
          <h2>{place.name}</h2>
          <p>
            {place.country || "未知国家"} {place.city ? `· ${place.city}` : ""}
          </p>
        </div>
        <div className="drawer-actions">
          <button className="ghost-btn" onClick={() => setEditing((value) => !value)} type="button">
            {editing ? "取消编辑" : "编辑"}
          </button>
          <button className="ghost-btn danger" onClick={() => void onDeletePlace()} type="button">
            删除
          </button>
        </div>
      </div>

      {editing ? (
        <form className="stack" onSubmit={handleUpdate}>
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
            value={draft.travel_date}
            onChange={(e) => setDraft({ ...draft, travel_date: e.target.value })}
            placeholder="旅行日期"
          />
          <input value={draft.place_type} onChange={(e) => setDraft({ ...draft, place_type: e.target.value })} placeholder="类型 / 标签" />
          <textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} placeholder="简短备注" rows={4} />
          <button className="primary-btn" type="submit">
            保存地点
          </button>
        </form>
      ) : (
        <>
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
          <p className="note">{place.note || "暂无备注"}</p>
        </>
      )}

      <section className="stack">
        <div className="section-title">
          <h3>照片</h3>
          <p>上传照片后会保存到该地点下。</p>
        </div>
        <label className="file-upload">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                void onUploadPhoto(file);
                e.currentTarget.value = "";
              }
            }}
          />
          <span>选择照片上传</span>
        </label>
        <div className="media-grid">
          {place.photos.map((photo) => (
            <figure className="media-card" key={photo.id}>
              <img src={photo.url} alt={photo.filename} />
              <button className="mini-btn" onClick={() => void onDeletePhoto(photo.id)} type="button">
                删除
              </button>
            </figure>
          ))}
        </div>
      </section>

      <section className="stack">
        <div className="section-title">
          <h3>帖子</h3>
          <p>可以写文字，也可以附带一张图片。</p>
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
          <input value={postTitle} onChange={(e) => setPostTitle(e.target.value)} placeholder="帖子标题" />
          <textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} placeholder="帖子内容" rows={4} />
          <label className="file-upload">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPostFile(e.target.files?.[0] ?? null)}
            />
            <span>{postFile ? postFile.name : "选择帖子图片（可选）"}</span>
          </label>
          <button className="primary-btn" type="submit">
            发布帖子
          </button>
        </form>
        <div className="stack">
          {place.posts.map((post) => (
            <article className="post-card" key={post.id}>
              <div className="post-head">
                <div>
                  <h4>{post.title || "未命名帖子"}</h4>
                  <p>{new Date(post.created_at).toLocaleString()}</p>
                </div>
                <button className="mini-btn" onClick={() => void onDeletePost(post.id)} type="button">
                  删除
                </button>
              </div>
              <p>{post.content}</p>
              {post.image_url ? <img className="post-image" src={post.image_url} alt={post.title} /> : null}
            </article>
          ))}
        </div>
      </section>
    </aside>
  );
}
