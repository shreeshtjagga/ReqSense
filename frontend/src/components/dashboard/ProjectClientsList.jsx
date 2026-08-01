import React, { useEffect, useState } from 'react';
import { List, ListItem, ListItemAvatar, Avatar, ListItemText, Typography, Skeleton } from '@mui/material';
import { listProjectClients } from '../../api/projects';

export const ProjectClientsList = ({ projectId, refreshKey }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await listProjectClients(projectId);
        if (active) setClients(data);
      } catch {
        if (active) setClients([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [projectId, refreshKey]);

  if (loading) return <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 2 }} />;

  if (clients.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No clients invited to this project yet.
      </Typography>
    );
  }

  return (
    <List dense disablePadding>
      {clients.map((c) => (
        <ListItem key={c.id} disableGutters>
          <ListItemAvatar>
            <Avatar sx={{ width: 32, height: 32, fontSize: '0.85rem', bgcolor: 'primary.main' }}>
              {c.name?.charAt(0)?.toUpperCase()}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={c.name}
            secondary={c.email}
            primaryTypographyProps={{ fontSize: '0.9rem', fontWeight: 600 }}
            secondaryTypographyProps={{ fontSize: '0.78rem' }}
          />
        </ListItem>
      ))}
    </List>
  );
};

export default ProjectClientsList;
