import { useState, type FormEvent } from "react";
import type { PlaceInput } from "../lib/types";

type Props = {
  onSubmit: (input: PlaceInput) => Promise<void>;
  busy?: boolean;
  onClose: () => void;
};

const emptyForm: PlaceInput = {
  name: "",
  latitude: 31.2304,
  longitude: 121.4737,
  travel_date: "",
  note: "",
  place_type: "",
  country: "",
  city: "",
};

export function PlaceForm({ onSubmit, busy, onClose }: Props) {
  const [form, setForm] = useState<PlaceInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await onSubmit(form);
      setForm({ ...emptyForm, latitude: form.latitude, longitude: form.longitude });
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    }
  }

  function handleLocate() {
    if (!navigator.geolocation) {
      setError("浏览器不支持定位");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({
          ...form,
          latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          longitude: parseFloat(pos.coords.longitude.toFixed(6)),
        });
        setError(null);
      },
      () => setError("定位失败，请检查权限"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  const set = (k: keyof PlaceInput) => (e: { target: { value: string } }) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="panel-content">
      <div className="panel-header">
        <h2>新增地点</h2>
        <button className="ghost-btn" type="button" onClick={onClose}>关闭</button>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        <input value={form.name} onChange={set("name")} placeholder="地点名称 *" required />

        <div className="two-col">
          <input type="number" step="any" value={form.latitude}
            onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })}
            placeholder="纬度" />
          <input type="number" step="any" value={form.longitude}
            onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })}
            placeholder="经度" />
        </div>

        <button className="ghost-btn locate-btn" type="button" onClick={handleLocate}>
          📍 使用当前位置
        </button>

        <div className="two-col">
          <input value={form.country} onChange={set("country")} placeholder="国家" />
          <input value={form.city} onChange={set("city")} placeholder="城市" />
        </div>

        <div className="two-col">
          <input type="date" value={form.travel_date} onChange={set("travel_date")} />
          <input value={form.place_type} onChange={set("place_type")} placeholder="类型" />
        </div>

        <textarea value={form.note} onChange={set("note")} placeholder="简短备注" rows={3} />

        {error ? <div className="error">{error}</div> : null}

        <button className="primary-btn" type="submit" disabled={busy}>
          {busy ? "保存中..." : "保存地点"}
        </button>
      </form>
    </div>
  );
}
