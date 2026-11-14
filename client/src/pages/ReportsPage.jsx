import { useCallback } from 'react';
import { api } from '../api/client.js';
import ReportPanel from '../components/ReportPanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ReportsPage() {
  const { user } = useAuth();
  const firstName = user.name.split(' ')[0];

  const fetchReport = useCallback(({ type, date }) => api.getReport({ type, date }), []);

  return (
    <ReportPanel
      fetchReport={fetchReport}
      heading={`${firstName}’s reports`}
      subtitle="A calm look at the day, the month so far, and the month behind you."
    />
  );
}
