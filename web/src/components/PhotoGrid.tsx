import { useCallback, useRef, useState } from 'react';
import type { PhotoDraft } from '../lib/types';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Cropper from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
// @ts-expect-error exif-js has no TS types
import EXIF from 'exif-js';

interface Props {
  photos: PhotoDraft[];
  onChange: (photos: PhotoDraft[]) => void;
  max?: number;
  onExifExtracted?: (exif: { lat?: number; lng?: number; date?: string }) => void;
}

let idCounter = 0;
function genId() {
  return `photo_${++idCounter}_${Date.now()}`;
}

export default function PhotoGrid({
  photos,
  onChange,
  max = 9,
  onExifExtracted,
}: Props) {
  const [croppingId, setCroppingId] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropImageRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const compressFile = async (file: File): Promise<File> => {
    const isMobile = window.innerWidth < 768;
    const options = {
      maxSizeMB: 0.5,
      maxWidthOrHeight: isMobile ? 1200 : 1920,
      useWebWorker: true,
      initialQuality: isMobile ? 0.85 : 0.9,
    };
    try {
      return await imageCompression(file, options);
    } catch {
      return file;
    }
  };

  const extractExif = (file: File) => {
    EXIF.getData(file, function (this: any) {
      const lat = EXIF.getTag(this, 'GPSLatitude');
      const lng = EXIF.getTag(this, 'GPSLongitude');
      const date = EXIF.getTag(this, 'DateTimeOriginal');
      if (lat != null && lng != null && onExifExtracted) {
        onExifExtracted({
          lat,
          lng,
          date: date ? date.replace(/:/g, '-').replace(' ', 'T') : undefined,
        });
      } else if (date && onExifExtracted) {
        onExifExtracted({
          date: date.replace(/:/g, '-').replace(' ', 'T'),
        });
      }
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - photos.length;
    const selected = Array.from(files).slice(0, remaining);
    if (selected.length === 0) return;

    const compressed = await Promise.all(selected.map(compressFile));

    const newPhotos: PhotoDraft[] = compressed.map((file) => ({
      id: genId(),
      file,
      isCover: photos.length === 0,
    }));

    // Extract EXIF from first photo if this is the first batch
    if (compressed[0] && photos.length === 0) {
      extractExif(compressed[0]);
    }

    onChange([...photos, ...newPhotos]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = (id: string) => {
    const updated = photos.filter((p) => p.id !== id);
    if (updated.length > 0 && photos.find((p) => p.id === id)?.isCover) {
      updated[0].isCover = true;
    }
    onChange(updated);
  };

  const handleSetCover = (id: string) => {
    onChange(photos.map((p) => ({ ...p, isCover: p.id === id })));
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = photos.findIndex((p) => p.id === active.id);
    const newIdx = photos.findIndex((p) => p.id === over.id);
    onChange(arrayMove(photos, oldIdx, newIdx));
  };

  const openCrop = (id: string) => {
    const photo = photos.find((p) => p.id === id);
    if (!photo) return;
    cropImageRef.current = URL.createObjectURL(photo.file);
    setCroppingId(id);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleCropDone = () => {
    if (!croppedAreaPixels || !croppingId) return;
    onChange(
      photos.map((p) =>
        p.id === croppingId
          ? {
              ...p,
              cropData: {
                x: croppedAreaPixels.x,
                y: croppedAreaPixels.y,
                width: croppedAreaPixels.width,
                height: croppedAreaPixels.height,
              },
            }
          : p,
      ),
    );
    if (cropImageRef.current) URL.revokeObjectURL(cropImageRef.current);
    setCroppingId(null);
  };

  return (
    <div className="photo-grid">
      {/* Crop overlay */}
      {croppingId && cropImageRef.current && (
        <div className="crop-overlay">
          <div className="crop-container">
            <Cropper
              image={cropImageRef.current}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, area) => setCroppedAreaPixels(area)}
            />
          </div>
          <div className="crop-actions">
            <button
              onClick={() => {
                setCroppingId(null);
              }}
            >
              取消
            </button>
            <button className="primary-btn" onClick={handleCropDone}>
              确认裁剪
            </button>
          </div>
        </div>
      )}

      {/* Photo list with drag-to-reorder */}
      {photos.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={photos.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
            <div className="pg-list">
              {photos.map((photo) => (
                <SortablePhoto
                  key={photo.id}
                  photo={photo}
                  onRemove={handleRemove}
                  onSetCover={handleSetCover}
                  onCrop={openCrop}
                />
              ))}
              {photos.length < max && (
                <button
                  className="pg-add"
                  onClick={() => fileInputRef.current?.click()}
                >
                  ＋
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        capture="environment"
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: 'none' }}
      />

      {/* Drop zone (shown only when no photos) */}
      {photos.length === 0 && (
        <div
          className="pg-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
        >
          <span className="pg-dropzone-icon">📸</span>
          <p>点击或拖拽照片到这里</p>
          <p className="pg-hint">首张照片将成为地图上的 Pin 图</p>
        </div>
      )}
    </div>
  );
}

// ---- SortablePhoto (extracted for @dnd-kit hook rules) ----

function SortablePhoto({
  photo,
  onRemove,
  onSetCover,
  onCrop,
}: {
  photo: PhotoDraft;
  onRemove: (id: string) => void;
  onSetCover: (id: string) => void;
  onCrop: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: photo.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const previewUrl = URL.createObjectURL(photo.file);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`pg-item ${photo.isCover ? 'pg-cover' : ''}`}
    >
      <img src={previewUrl} alt="" className="pg-thumb" />
      <div className="pg-item-actions">
        <button type="button" className="pg-action" onClick={() => onCrop(photo.id)} title="裁剪">
          ✂️
        </button>
        <button
          type="button"
          className="pg-action"
          onClick={() => onSetCover(photo.id)}
          title={photo.isCover ? '已设为封面' : '设为封面'}
        >
          {photo.isCover ? '⭐' : '☆'}
        </button>
        <button
          type="button"
          className="pg-action pg-delete"
          onClick={() => onRemove(photo.id)}
          title="删除"
        >
          ✕
        </button>
      </div>
      <div className="pg-drag-handle" {...attributes} {...listeners}>
        ⠿
      </div>
    </div>
  );
}
