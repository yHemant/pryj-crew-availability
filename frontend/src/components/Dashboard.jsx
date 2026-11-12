import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSummary } from '../api';
import Upload from './Upload';

const BUCKETS = ['0-4', '4-8', '8-16', '16-24', 'total'];
const BUCKET_LABELS = { '0-4': '0-4', '4-8': '4-8', '8-16': '8-16', '16-24': '16-24', total: 'TOTAL' };

function formatDateDisplay(dStr) {
  if (!dStr) return '';
  try {
    const [y, m, d] = dStr.split('-');
    if (y && m && d) {
      const dt = new Date(Number(y), Number(m) - 1, Number(d));
      return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    return dStr;
  } catch {
    return dStr;
  }
}

export default function Dashboard({ onLogout }) {
  const [summaryData, setSummaryData] = useState([]);
  const [grandTotal, setGrandTotal] = useState(null);
  const [activeDate, setActiveDate] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const fetchSummary = useCallback(async (selectedDate) => {
    setLoading(true);
    setError('');
    try {
      const res = await getSummary(selectedDate);
      setSummaryData(res.data.summary || []);
      setGrandTotal(res.data.grandTotal || null);
      if (res.data.date) {
        setActiveDate(res.data.date);
      }
      if (res.data.availableDates) {
        setAvailableDates(res.data.availableDates);
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError('Failed to load summary data.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleCellClick = (station, type, bucket) => {
    const params = new URLSearchParams({ station, type, bucket });
    if (activeDate) {
      params.set('date', activeDate);
    }
    navigate(`/details?${params.toString()}`);
  };

  const renderCell = (station, type, bucket, value) => {
    if (value === 0) {
      return <span className="text-gray-400">0</span>;
    }
    return (
      <button
        onClick={() => handleCellClick(station, type, bucket)}
        className="text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 hover:underline-offset-4 transition-all cursor-pointer"
      >
        {value}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">PRYJ Crew Availability Dashboard</h1>
              <p className="text-xs text-gray-500">Loco Pilot & ALP Availability Summary</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-gray-500 hover:text-red-600 font-medium text-sm flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Upload Component */}
        <Upload onUploadSuccess={() => fetchSummary()} />

        {/* Summary Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-800">
                  Station-wise Crew Summary
                </h2>
                {activeDate && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">
                    {formatDateDisplay(activeDate)}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Displaying crew availability buckets for today's hours (00:00 - 24:00) on {formatDateDisplay(activeDate) || 'selected date'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {availableDates.length > 1 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <label htmlFor="summary-date" className="font-medium">Change Date:</label>
                  <select
                    id="summary-date"
                    value={activeDate}
                    onChange={(e) => fetchSummary(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2.5 py-1 text-xs bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {availableDates.map((d) => (
                      <option key={d} value={d}>
                        {formatDateDisplay(d)} ({d})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={() => fetchSummary(activeDate)}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg hover:bg-blue-50 border border-blue-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-gray-500 text-sm">Loading summary data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <svg className="w-12 h-12 text-red-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-red-600 font-medium">{error}</p>
                <button onClick={fetchSummary} className="mt-2 text-blue-600 hover:underline text-sm">Try again</button>
              </div>
            </div>
          ) : summaryData.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-gray-500 font-medium">No data available</p>
                <p className="text-gray-400 text-sm mt-1">Upload a Crew Availability Excel file to get started.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th rowSpan={2} className="px-4 py-3 text-left font-semibold text-gray-700 border-b-2 border-gray-200 sticky left-0 bg-gray-50 z-10 min-w-[120px]">
                      Station
                    </th>
                    <th colSpan={5} className="px-2 py-2 text-center font-semibold text-emerald-700 border-b border-gray-200 bg-emerald-50">
                      HQ (Headquarters)
                    </th>
                    <th colSpan={5} className="px-2 py-2 text-center font-semibold text-orange-700 border-b border-gray-200 bg-orange-50">
                      OS (Outstation)
                    </th>
                  </tr>
                  <tr className="bg-gray-50">
                    {/* HQ buckets */}
                    {BUCKETS.map((b) => (
                      <th key={`hq-${b}`} className="px-3 py-2 text-center font-medium text-gray-600 border-b-2 border-gray-200 bg-emerald-50 whitespace-nowrap">
                        {BUCKET_LABELS[b]}
                      </th>
                    ))}
                    {/* OS buckets */}
                    {BUCKETS.map((b) => (
                      <th key={`os-${b}`} className="px-3 py-2 text-center font-medium text-gray-600 border-b-2 border-gray-200 bg-orange-50 whitespace-nowrap">
                        {BUCKET_LABELS[b]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryData.map((row, idx) => (
                    <tr key={row.station} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/50 transition-colors`}>
                      <td className="px-4 py-3 font-semibold text-gray-800 border-b border-gray-100 sticky left-0 bg-inherit z-10">
                        {row.station}
                      </td>
                      {/* HQ cells */}
                      {BUCKETS.map((b) => (
                        <td key={`hq-${b}`} className={`px-3 py-3 text-center border-b border-gray-100 ${b === 'total' ? 'bg-emerald-50/50 font-bold' : ''}`}>
                          {renderCell(row.station, 'HQ', b === 'total' ? 'TOTAL' : b, row.HQ[b])}
                        </td>
                      ))}
                      {/* OS cells */}
                      {BUCKETS.map((b) => (
                        <td key={`os-${b}`} className={`px-3 py-3 text-center border-b border-gray-100 ${b === 'total' ? 'bg-orange-50/50 font-bold' : ''}`}>
                          {renderCell(row.station, 'OS', b === 'total' ? 'TOTAL' : b, row.OS[b])}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Grand Total Row */}
                  {grandTotal && (
                    <tr className="bg-blue-50 font-bold border-t-2 border-blue-200">
                      <td className="px-4 py-3 text-blue-800 sticky left-0 bg-blue-50 z-10">
                        GRAND TOTAL
                      </td>
                      {BUCKETS.map((b) => (
                        <td key={`gt-hq-${b}`} className={`px-3 py-3 text-center text-blue-800 ${b === 'total' ? 'bg-blue-100/50' : ''}`}>
                          {renderCell('TOTAL', 'HQ', b === 'total' ? 'TOTAL' : b, grandTotal.HQ[b])}
                        </td>
                      ))}
                      {BUCKETS.map((b) => (
                        <td key={`gt-os-${b}`} className={`px-3 py-3 text-center text-blue-800 ${b === 'total' ? 'bg-blue-100/50' : ''}`}>
                          {renderCell('TOTAL', 'OS', b === 'total' ? 'TOTAL' : b, grandTotal.OS[b])}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

