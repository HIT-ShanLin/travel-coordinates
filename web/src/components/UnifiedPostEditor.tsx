import { useState, useCallback } from 'react';
import PhotoGrid from './PhotoGrid';
import LocationPicker, { type LocationValue } from './LocationPicker';
import PostContent from './PostContent';
import type { PhotoDraft } from '../lib/types';
import { createPlace, uploadPhoto, createPost, deletePlace, reverseGeocode } from '../lib/api';

interface Props {
  mode: 'create' | 'append';
  defaultPlaceId?: string;
  defaultLocation?: LocationValue;
  onClose: () => void;
  onSuccess: () => void;
}

type SubmitStep = 'idle' | 'creating_place' | 'uploading_photos' | 'creating_post';

export default function UnifiedPostEditor({
  mode,
  defaultLocation,
  onClose,
  onSuccess,
}: Props) {
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [location, setLocation] = useState<LocationValue>(
    defaultLocation ?? { name: '', country: '', city: '', lat: 30.0, lng: 120.0 },
  );
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [content, setContent] = useState('');
  const [dateLabel, setDateLabel] = useState<string | undefined>();
  const [step, setStep] = useState<SubmitStep>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const handleExif = useCallback(
    async (exif: { lat?: number; lng?: number; date?: string }) => {
      if (exif.lat != null && exif.lng != null) {
        try {
          const rr = await reverseGeocode(exif.lat, exif.lng);
          setLocation({
            name: rr.name,
            country: rr.country,
            city: rr.city,
            lat: rr.lat,
            lng: rr.lng,
          });
        } catch {
          setLocation((prev) => ({ ...prev, lat: exif.lat!, lng: exif.lng! }));
        }
      }
      if (exif.date) {
        setDate(exif.date.slice(0, 10));
        setDateLabel('📥 已根据照片自动填充');
      }
    },
    [],
  );

  const handleSubmit = async () => {
    if (photos.length === 0 && !content.trim()) {
      setError('请至少上传一张照片或填写文字内容');
      return;
    }
    setError(null);

    let createdPlaceId: string | null = null;
    try {
      setStep('creating_place');
      const name = location.name || `${location.city || ''}·记忆`;
      const place = await createPlace({
        name,
        latitude: location.lat,
        longitude: location.lng,
        country: location.country,
        city: location.city,
        travel_date: date,
        note: content,
        place_type: '',
      });
      createdPlaceId = place.id;

      // Upload photos to R2 → DB, collect photo IDs
      let postPhotoId = '';
      if (photos.length > 0) {
        setStep('uploading_photos');
        setProgress({ current: 0, total: photos.length });
        for (let i = 0; i < photos.length; i++) {
          const updated = await uploadPhoto(place.id, photos[i].file);
          const allPhotos = updated.photos ?? [];
          if (allPhotos.length > 0) {
            const lastId = allPhotos[allPhotos.length - 1].id;
            if (i === 0) postPhotoId = lastId; // first photo = cover
          }
          setProgress({ current: i + 1, total: photos.length });
        }
      }

      // Create post referencing the cover photo
      if (content.trim() || photos.length > 0) {
        setStep('creating_post');
        const title = location.name || `${location.city || '旅行记忆'}`;
        await createPost(place.id, { title, content, photo_id: postPhotoId });
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || '发布失败，请重试');
      setStep('idle');
      // Rollback: any step after createPlace fails → delete the orphaned place
      if (createdPlaceId) {
        try { await deletePlace(createdPlaceId); } catch { /* best effort */ }
      }
    }
  };

  const canSubmit = photos.length > 0 || content.trim().length > 0;

  return (
    <div
      className="editor-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {isMobile ? (
        <div className="editor-mobile">
          <div className="editor-mobile-header">
            <button className="ghost-btn" onClick={onClose}>
              ← 返回
            </button>
            <h2>{mode === 'create' ? '记录足迹' : '添加记忆'}</h2>
            <button
              className="primary-btn"
              disabled={!canSubmit || step !== 'idle'}
              onClick={handleSubmit}
            >
              {step !== 'idle' ? '发布中...' : '发布'}
            </button>
          </div>
          <div className="editor-mobile-body">
            <PhotoGrid photos={photos} onChange={setPhotos} onExifExtracted={handleExif} />
            <PostContent
              content={content}
              onChangeContent={setContent}
              date={date}
              onChangeDate={setDate}
              dateAutoLabel={dateLabel}
            />
            <LocationPicker value={location} onChange={setLocation} />
          </div>
          {error && <div className="editor-error">{error}</div>}
          {step === 'uploading_photos' && (
            <div className="editor-progress">
              正在上传照片 ({progress.current}/{progress.total})
            </div>
          )}
        </div>
      ) : (
        <div className="editor-desktop">
          <div className="editor-header">
            <h2>{mode === 'create' ? '✨ 记录足迹' : '📝 添加记忆'}</h2>
            <button className="ghost-btn" onClick={onClose}>
              ✕
            </button>
          </div>
          <div className="editor-body">
            <div className="editor-left">
              <PhotoGrid photos={photos} onChange={setPhotos} onExifExtracted={handleExif} />
            </div>
            <div className="editor-right">
              <LocationPicker value={location} onChange={setLocation} />
              <PostContent
                content={content}
                onChangeContent={setContent}
                date={date}
                onChangeDate={setDate}
                dateAutoLabel={dateLabel}
              />
            </div>
          </div>
          <div className="editor-footer">
            {error && <span className="editor-error">{error}</span>}
            {step === 'uploading_photos' && (
              <span className="editor-progress">
                正在上传照片 ({progress.current}/{progress.total})
              </span>
            )}
            <div className="editor-footer-btns">
              <button className="ghost-btn" onClick={onClose}>
                取消
              </button>
              <button
                className="primary-btn"
                disabled={!canSubmit || step !== 'idle'}
                onClick={handleSubmit}
              >
                {step !== 'idle' ? '发布中...' : '🚀 立即发布'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
