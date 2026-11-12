import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getCrewDetails } from '../api';

/** Nice display names for table columns */
const COLUMN_HEADERS = [
  { key: 'sno',              label: 'S.No.'            },
  { key: 'crew_id',          label: 'Crew ID'          },
  { key: 'crew_name',        label: 'Crew Name'        },
  { key: 'crew_designation', label: 'Designation'       },
  { key: 'fortnight_hrs',    label: 'Fortnight Hrs'     },
  { key: 'avail_time',       label: 'Avail Time'        },
  { key: 'avail_sttn',       label: 'Avail Station'     },
  { key: 'status',           label: 'Status'            },
  { key: 'called_time',      label: 'Called Time'       },
  { key: 'ack_time',         label: 'Ack Time'          },
  { key: 'sign_on_time',     label: 'Sign On Time'      },
  { key: 'last_signoff_time',label: 'Last Signoff Time' },
  { key: 'train_no',         label: 'Train No'          },
  { key: 'from_sttn',        label: 'From Station'      },
  { key: 'to_sttn',          label: 'To Station'        },
  { key: 'hq',               label: 'HQ'               },
];

function formatCellValue(key, val) {
  if (val == null || val === '' || val === 'null' || val === 'undefined') {
    return '—';
  }

  // Handle Fortnight Hours (clean Excel time representation if parsed as 1899 date)
  if (key === 'fortnight_hrs') {
    const str = String(val);
    if (str.includes('1899-') || str.includes('1900-')) {
      const match = str.match(/T(\d{2}:\d{2})/);
      if (match) return `${match[1]} hrs`;
    }
    return str;
  }

  // Handle Date/Time fields
  if (['avail_time', 'called_time', 'ack_time', 'sign_on_time', 'last_signoff_time'].includes(key)) {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
      }
    } catch {
      // Fallback
    }
  }

  return String(val);
}

function getStatusBadge(status) {
  if (!status) return null;
  const s = String(status).toUpperCase().trim();
  let color = 'bg-gray-100 text-gray-800 border-gray-300';

  if (s === 'REST') {
    color = 'bg-emerald-100 text-emerald-800 border-emerald-300';
  } else if (s === 'CALLED') {
    color = 'bg-amber-100 text-amber-800 border-amber-300';
  } else if (s === 'BOOKED') {
    color = 'bg-blue-100 text-blue-800 border-blue-300';
  } else if (s === 'LEAVE') {
    color = 'bg-purple-100 text-purple-800 border-purple-300';
  } else if (s === 'ABSEN') {
    color = 'bg-red-100 text-red-800 border-red-300';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
      {s}
    </span>
  );
}

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

export default function DetailView() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const station = searchParams.get('station') || '';
  const type    = searchParams.get('type')    || '';
  const bucket  = searchParams.get('bucket')  || '';
  const date    = searchParams.get('date')    || '';

  const [data, setData] = useState([]);
  const [count, setCount] = useState(0);
  const [activeDate, setActiveDate] = useState(date);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getCrewDetails(station, type, bucket, date);
        setData(res.data.data || []);
        setCount(res.data.count || 0);
        if (res.data.date) {
          setActiveDate(res.data.date);
        }
      } catch (err) {
        console.error('Failed to fetch crew details:', err);
        if (err.response?.status !== 401 && err.response?.status !== 403) {
          setError(err.response?.data?.error || 'Failed to load crew details.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (station && type && bucket) {
      fetchDetails();
    } else {
      setLoading(false);
      setError('Missing required parameters (station, type, or bucket).');
    }
  }, [station, type, bucket, date]);

  // Client-side quick search/filter
  const filteredData = useMemo(() => {
    if (!filterText.trim()) return data;
    const term = filterText.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((val) =>
        val != null && String(val).toLowerCase().includes(term)
      )
    );
  }, [data, filterText]);

  const displayStation = station.toUpperCase() === 'TOTAL' || station.toUpperCase() === 'ALL'
    ? 'All Stations (Grand Total)'
    : station;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold py-2 px-4 rounded-lg transition-colors border border-blue-200 shadow-sm cursor-pointer"
              title="Return to Summary Table"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Summary</span>
            </button>

            <div className="h-6 w-px bg-gray-300 hidden sm:block"></div>

            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>Crew Availability Details</span>
                {!loading && (
                  <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-200">
                    {count} crew {count === 1 ? 'member' : 'members'}
                  </span>
                )}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>Station: <strong className="text-gray-800">{displayStation}</strong></span>
                <span>•</span>
                <span>Type: <strong className={type.toUpperCase() === 'HQ' ? 'text-emerald-700' : 'text-orange-700'}>{type.toUpperCase()}</strong></span>
                <span>•</span>
                <span>Bucket: <strong className="text-blue-700">{bucket}</strong></span>
                {(activeDate || date) && (
                  <>
                    <span>•</span>
                    <span>Date: <strong className="text-gray-800">{formatDateDisplay(activeDate || date)}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Filter Search */}
          {!loading && data.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Quick filter..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="w-56 pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
                />
                <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {filterText && (
                <button
                  onClick={() => setFilterText('')}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 w-full">
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-gray-500 text-sm">Loading crew details...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center px-4">
                <p className="text-red-600 font-medium mb-3">{error}</p>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-gray-500 font-medium">No crew members found for this filter.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-xs text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {COLUMN_HEADERS.map((col, idx) => (
                      <th
                        key={col.key}
                        className={`px-3 py-3 font-semibold text-gray-700 ${
                          idx === 1 ? 'sticky left-0 bg-gray-50 z-10' : ''
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredData.map((row, idx) => (
                    <tr
                      key={row.crew_id || idx}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/40 transition-colors`}
                    >
                      {COLUMN_HEADERS.map((col, colIdx) => {
                        const val = row[col.key];

                        if (col.key === 'status') {
                          return (
                            <td key={col.key} className="px-3 py-2 border-b border-gray-100">
                              {getStatusBadge(val)}
                            </td>
                          );
                        }

                        if (col.key === 'crew_id') {
                          return (
                            <td
                              key={col.key}
                              className={`px-3 py-2 border-b border-gray-100 font-mono font-semibold text-blue-700 ${
                                colIdx === 1 ? 'sticky left-0 bg-inherit z-10' : ''
                              }`}
                            >
                              {val || '—'}
                            </td>
                          );
                        }

                        return (
                          <td key={col.key} className="px-3 py-2 border-b border-gray-100 text-gray-700">
                            {formatCellValue(col.key, val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Status info bar */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <span>
                  Showing {filteredData.length} of {count} crew records
                </span>
                <span className="text-gray-400">
                  All 16 columns displayed
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

