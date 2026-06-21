import { useEffect, useState, useRef, useCallback } from 'react';
import type { Place, PlaceInput } from '../lib/types';
import MemoryCard, { type MemoryCardData } from './MemoryCard';
import PlaceEditor from './PlaceEditor';

type Props = {
  place: Place | null;
  onUpdatePlace: (input: PlaceInput) => Promise<void>;
  onUploadPhoto: (file: File) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onCreatePost: (input: { title: string; content: string; photo_id?: string }) => Promise<void>;
  onDeletePost: (postId: string) => Promise<void>;
  onDeletePlace: () => Promise<void>;
  onClose: () => void;
  onAppendMemory?: () => void;
  siblingPlaces?: Place[];
  onNavigate?: (placeId: string) => void;
  currentUserId?: string;
};

function buildMemoryCards(place: Place): MemoryCardData[] {
  const cards: MemoryCardData[] = [];
  const photoMap = new Map(place.photos.map((p) => [p.id, p]));
  const linkedPhotoIds = new Set<string>();
  for (const post of place.posts) {
    const photo = post.photo_id ? photoMap.get(post.photo_id) : undefined;
    if (photo) linkedPhotoIds.add(photo.id);
    cards.push({
      id: post.id,
      type: photo ? 'post_with_photo' : 'post_only',
      photoUrls: photo ? [photo.url] : [],
      title: post.title,
      content: post.content,
      date: post.created_at.slice(0, 10),
      placeName: `${place.country} · ${place.city || place.name}`,
    });
  }
  for (const photo of place.photos) {
    if (!linkedPhotoIds.has(photo.id)) {
      cards.push({
        id: photo.id, type: 'photo_only',
        photoUrls: [photo.url], title: '', content: '',
        date: photo.created_at.slice(0, 10),
        placeName: `${place.country} · ${place.city || place.name}`,
      });
    }
  }
  return cards;
}

export function PlaceDrawer({
  place, onUpdatePlace, onDeletePhoto, onDeletePost, onDeletePlace,
  onClose, onAppendMemory, siblingPlaces, onNavigate, currentUserId,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [cards, setCards] = useState<MemoryCardData[]>([]);
  const offsetX = useRef(0);
  const startX = useRef(0);
  const swipingRef = useRef(false);
  const lastTime = useRef(0);
  const lastX = useRef(0);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const siblings = siblingPlaces ?? [];
  const currentIdx = siblings.findIndex((p) => p.id === place?.id);
  const siblingCount = siblings.length;
  const isOwner = place ? place.user_id === (currentUserId ?? '') : false;

  useEffect(() => {
    if (place) { setCards(buildMemoryCards(place)); setEditing(false); setSwipeX(0); }
    else { setCards([]); }
  }, [place]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (siblingCount < 2 || !onNavigate) return;
    startX.current = e.touches[0].clientX;
    offsetX.current = 0;
    swipingRef.current = true;
    setSwiping(true);
  }, [siblingCount, onNavigate]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipingRef.current) return;
    const dx = e.touches[0].clientX - startX.current;
    offsetX.current = dx;
    lastTime.current = Date.now();
    lastX.current = dx;
    const atStart = currentIdx === 0 && dx > 0;
    const atEnd = currentIdx === siblingCount - 1 && dx < 0;
    setSwipeX(atStart || atEnd ? dx * 0.2 : dx);
  }, [currentIdx, siblingCount]);

  const onTouchEnd = useCallback(() => {
    if (!swipingRef.current || !onNavigate) return;
    swipingRef.current = false;
    setSwiping(false);
    const dx = offsetX.current;
    const dt = Date.now() - lastTime.current;
    const vel = dt > 0 ? Math.abs(dx) / dt : 0;
    const shouldNav = Math.abs(dx) > 40 || (Math.abs(dx) > 12 && vel > 0.5);
    if (shouldNav) {
      const dir = dx < 0 ? 1 : -1;
      const newIdx = currentIdx + dir;
      if (newIdx >= 0 && newIdx < siblingCount) {
        setSwipeX(dir > 0 ? -500 : 500);
        setTimeout(() => { onNavigate(siblings[newIdx].id); setSwipeX(0); }, 150);
        return;
      }
    }
    setSwipeX(0);
  }, [currentIdx, siblingCount, siblings, onNavigate]);

  if (!place) return (
    <div className="panel-content"><p className="empty-hint">点击标记查看旅行记忆</p></div>
  );

  if (editing) return (
    <div className="panel-content">
      <PlaceEditor
        initial={{ name: place.name, latitude: place.latitude, longitude: place.longitude,
          travel_date: place.travel_date, note: place.note, place_type: place.place_type,
          country: place.country, city: place.city,
          originalName: place.name, originalCountry: place.country, originalCity: place.city }}
        onSave={async (input) => { await onUpdatePlace(input); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    </div>
  );

  const handleDeleteCard = (cardId: string, cardType: string) => {
    if (cardType === 'photo_only') { if (confirm('删除这张照片？')) onDeletePhoto(cardId); }
    else { if (confirm('删除这条记忆？')) onDeletePost(cardId); }
  };

  return (
    <div className="panel-content swipe-panel"
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* Top bar */}
      <div className="swipe-topbar">
        <div className="swipe-topbar-left">
          <h3>{place.name}</h3>
          <span className="swipe-topbar-sub">{place.country} · {place.city}</span>
        </div>
        <div className="swipe-topbar-right">
          {siblingCount > 1 && <span className="swipe-counter">{currentIdx + 1}/{siblingCount}</span>}
          {isOwner && <button className="mini-btn" onClick={() => setEditing(true)}>编辑</button>}
          <button className="mini-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Dots */}
      {siblingCount > 1 && (
        <div className="swipe-dots">
          {siblings.map((p, i) => (
            <span key={p.id} className={`swipe-dot ${i === currentIdx ? 'active' : ''}`}
              onClick={() => onNavigate?.(p.id)} />
          ))}
        </div>
      )}

      {/* Swipeable card */}
      <div className="swipe-card" style={{
        transform: `translateX(${swipeX}px) rotate(${swipeX * 0.03}deg)`,
        transition: swiping ? 'none' : 'transform 0.15s ease-out',
      }}>
        {cards.length > 0 ? (
          <div className="memory-list">
            {cards.map((card) => (
              <MemoryCard key={card.id} card={card}
                onEdit={isOwner ? onAppendMemory : undefined}
                onDelete={isOwner ? () => handleDeleteCard(card.id, card.type) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="hero-empty">
            <p>暂无记忆</p>
            {isOwner && <p className="pg-hint">点击下方按钮添加旅行记忆</p>}
          </div>
        )}
      </div>

      {/* Bottom (owner only) */}
      {isOwner && (
        <div className="swipe-bottom">
          {onAppendMemory && <button className="primary-btn" onClick={onAppendMemory}>＋ 添加记忆</button>}
          <button className="mini-btn mc-delete-btn" onClick={() => {
            if (confirm('确定删除此地点及其所有记忆？')) onDeletePlace();
          }}>删除此地点</button>
        </div>
      )}
    </div>
  );
}
