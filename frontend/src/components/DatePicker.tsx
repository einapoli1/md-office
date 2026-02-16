import React, { useState } from 'react';

interface DatePickerProps {
  value: string; // ISO date string YYYY-MM-DD
  onChange: (date: string) => void;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange }) => {
  const initial = new Date(value + 'T00:00:00');
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const selectDate = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(iso);
  };

  const selectToday = () => {
    onChange(todayStr);
  };

  const cellDateStr = (day: number) =>
    `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <div className="date-picker">
      <div className="date-picker-header">
        <button className="date-picker-nav" onClick={prevMonth}>‹</button>
        <span className="date-picker-title">{MONTHS[viewMonth]} {viewYear}</span>
        <button className="date-picker-nav" onClick={nextMonth}>›</button>
      </div>
      <div className="date-picker-days-header">
        {DAYS.map((d) => <span key={d} className="date-picker-day-label">{d}</span>)}
      </div>
      <div className="date-picker-grid">
        {cells.map((day, i) => (
          <button
            key={i}
            className={`date-picker-cell${day == null ? ' empty' : ''}${day && cellDateStr(day) === value ? ' selected' : ''}${day && cellDateStr(day) === todayStr ? ' today' : ''}`}
            onClick={() => day && selectDate(day)}
            disabled={day == null}
          >
            {day ?? ''}
          </button>
        ))}
      </div>
      <div className="date-picker-footer">
        <button className="date-picker-today-btn" onClick={selectToday}>Today</button>
      </div>
    </div>
  );
};

export default DatePicker;
