interface Props {
  content: string;
  onChangeContent: (v: string) => void;
  date: string;
  onChangeDate: (v: string) => void;
  dateAutoLabel?: string;
}

export default function PostContent({
  content,
  onChangeContent,
  date,
  onChangeDate,
  dateAutoLabel,
}: Props) {
  return (
    <div className="post-content">
      <div className="pc-date-row">
        <label className="pc-label">📅 旅行时间</label>
        <input
          type="date"
          className="pc-date-input"
          value={date}
          onChange={(e) => onChangeDate(e.target.value)}
        />
        {dateAutoLabel && <span className="pc-auto-hint">{dateAutoLabel}</span>}
      </div>
      <div className="pc-text-row">
        <label className="pc-label">📝 这一刻的风景</label>
        <textarea
          className="pc-textarea"
          placeholder="写下此刻的感受..."
          rows={4}
          maxLength={500}
          value={content}
          onChange={(e) => onChangeContent(e.target.value)}
        />
        <span className="pc-counter">{content.length}/500</span>
      </div>
    </div>
  );
}
