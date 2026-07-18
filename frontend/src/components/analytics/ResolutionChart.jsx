import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Paper, Typography, Box } from '@mui/material';

export const ResolutionChart = ({ pending = 0, resolved = 0, ignored = 0 }) => {
  const data = [
    { name: 'Resolved', value: resolved, color: '#059669' }, // Success green
    { name: 'Ignored', value: ignored, color: '#2563EB' }, // Info blue
    { name: 'Pending', value: pending, color: '#D97706' }, // Warning amber
  ].filter((item) => item.value > 0);

  return (
    <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Contradiction Status breakdown
      </Typography>
      
      {data.length === 0 ? (
        <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No contradictions detected yet.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
};

export default ResolutionChart;
