import { Box, Paper, Typography, Grid } from '@mui/material'
import { useAuthStore } from '../store/authStore'

function Profile() {
  const { user } = useAuthStore()

  const details = [
    { label: 'Name', value: user?.name || '-' },
    { label: 'Email', value: user?.gmail || '-' },
    { label: 'Persona', value: user?.persona || '-' },
    { label: 'State', value: user?.state || '-' },
    { label: 'District', value: user?.district || '-' },
    { label: 'Mandal', value: user?.mandal || '-' },
    { label: 'Village', value: user?.village || '-' },
  ]

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>User Profile</Typography>
      <Paper sx={{ p: { xs: 2, sm: 2.5 }, border: '1px solid #c7dcd7', borderRadius: 2, background: '#fff' }}>
        <Grid container spacing={1.5}>
          {details.map((item) => (
            <Grid item xs={12} sm={6} key={item.label}>
              <Paper sx={{ p: 1.5, border: '1px solid #dde9e3', borderRadius: 1.5, boxShadow: 'none', backgroundColor: '#fcfefe' }}>
                <Typography sx={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5f7488', mb: 0.4 }}>
                  {item.label}
                </Typography>
                <Typography sx={{ fontWeight: 600, color: '#1a2333', wordBreak: 'break-word' }}>
                  {item.value}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  )
}

export default Profile
