import { useState, type FormEvent } from "react";
import type { PlaceInput } from "../lib/types";

type Props = {
  onSubmit: (input: PlaceInput) => Promise<void>;
  busy?: boolean;
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

export function PlaceForm({ onSubmit, busy }: Props) {
  const [form, setForm] = useState<PlaceInput>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await onSubmit(form);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    }
  }

  return (
    <form className="card form-grid" onSubmit={handleSubmit}>
      <div className="section-title">
        <h2>新增地点</h2>
        <p>先填最少信息，后续可继续编辑。</p>
      </div>
      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="地点名称" />
      <div className="two-col">
        <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: Number(e.target.value) })} placeholder="纬度" />
        <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: Number(e.target.value) })} placeholder="经度" />
      </div>
      <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="国家" />
      <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="城市" />
      <input value={form.travel_date} onChange={(e) => setForm({ ...form, travel_date: e.target.value })} placeholder="旅行日期，例如 2026-06-17" />
      <input value={form.place_type} onChange={(e) => setForm({ ...form, place_type: e.target.value })} placeholder="类型 / 标签" />
      <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="简短备注" rows={4} />
      {error ? <div className="error">{error}</div> : null}
      <button className="primary-btn" type="submit" disabled={busy}>
        {busy ? "保存中..." : "保存地点"}
      </button>
    </form>
  );
}
