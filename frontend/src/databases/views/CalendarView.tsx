import { useMemo, useState } from 'react';
import { ViewProps } from './viewTypes';

export default function CalendarView({ columns, rows, onRowClick }: ViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // Find first date column
  const dateCol = columns.find(c => c.type === 'date');
  const titleCol = columns[0];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let i = 1; i <= daysInMonth; i++) arr.push(i);
    return arr;
  }, [firstDay, daysInMonth]);

  const rowsByDate = useMemo(() => {
    const map = new Map<string, typeof rows>();
    if (!dateCol) return map;
    for (const row of rows) {
      const val = String(row.cells[dateCol.id] ?? '');
      if (val) {
        if (!map.has(val)) map.set(val, []);
        map.get(val)!.push(row);
      }
    }
    return map;
  }, [rows, dateCol]);

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="db-calendar">
      <div className="db-calendar-nav">
        <button className="db-btn db-btn-sm" onClick={prev}>◀</button>
        <span className="db-calendar-month">{monthName}</span>
        <button className="db-btn db-btn-sm" onClick={next}>▶</button>
      </div>
      {!dateCol && <div className="db-empty-hint">Add a date column to use Calendar view</div>}
      <div className="db-calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="db-calendar-day-header">{d}</div>
        ))}
        {days.map((day, idx) => {
          const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
          const dayRows = dateStr ? (rowsByDate.get(dateStr) ?? []) : [];
          return (
            <div key={idx} className={`db-calendar-cell ${day ? '' : 'empty'}`}>
              {day && <span className="db-calendar-day-num">{day}</span>}
              {dayRows.map(row => (
                <div key={row.id} className="db-calendar-event" onClick={() => onRowClick(row.id)}>
                  {String(row.cells[titleCol?.id] ?? 'Untitled')}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
