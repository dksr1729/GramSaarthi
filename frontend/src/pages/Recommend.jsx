import { useEffect, useState } from 'react'
import api from '../api/axios'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Typography,
} from '@mui/material'

function Recommend() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])

  useEffect(() => {
    fetchRecommendations()
  }, [])

  const fetchRecommendations = async () => {
    try {
      const response = await api.get('/api/recommend', { params: { top_k: 18 } })
      setItems(response.data.recommendations || [])
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load recommendations')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Budget & Action Insights
      </Typography>
      <Typography sx={{ color: '#5f7488', mb: 3 }}>
        Data-driven recommendations based on climate risk, rainfall, and local priority indicators.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!items.length ? (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid #c7dcd7' }}>
          <Typography color="text.secondary">No budget insights are available for your current location scope.</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {items.map((item, idx) => (
            <Grid item xs={12} md={6} key={`${item.title}-${item.gp_name}-${idx}`}>
              <Paper
                sx={{
                  p: 2.5,
                  border: '1px solid #c7dcd7',
                  borderRadius: 2,
                  background: '#fff',
                  boxShadow: '0 10px 24px rgba(27,43,67,0.07)',
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    height: 3,
                    background: 'linear-gradient(90deg, #0f766e 0%, rgba(15,118,110,0.12) 100%)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.2, alignItems: 'flex-start' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1d2b3a' }}>
                    {item.title}
                  </Typography>
                  {item.recommendation_rank && (
                    <Chip size="small" color="primary" label={`#${item.recommendation_rank}`} />
                  )}
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5, mb: 1.5 }}>
                  {item.theme && <Chip size="small" variant="outlined" label={`Theme: ${item.theme}`} />}
                  {item.sector && <Chip size="small" variant="outlined" label={`Sector: ${item.sector}`} />}
                  {item.priority_tier && <Chip size="small" variant="outlined" label={`Tier: ${item.priority_tier}`} />}
                </Box>

                <Typography sx={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#46566c', fontWeight: 700 }}>
                  Recommended Action
                </Typography>
                <Typography sx={{ mt: 0.75, color: '#22334d', lineHeight: 1.7 }}>
                  {item.what_to_do}
                </Typography>

                <Box sx={{ mt: 2, p: 1.5, borderRadius: 1.5, backgroundColor: '#f7fbfa', border: '1px solid #d7e7e3' }}>
                  <Typography sx={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#0f766e', fontWeight: 700, mb: 1 }}>
                    Data Signals
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {typeof item.recommendation_score === 'number' && (
                      <Chip size="small" color="primary" variant="outlined" label={`Score: ${item.recommendation_score}`} />
                    )}
                    {item.predicted_drought_flag && (
                      <Chip size="small" variant="outlined" label={`Risk: ${item.predicted_drought_flag}`} />
                    )}
                    {typeof item.predicted_rainfall_mm === 'number' && (
                      <Chip size="small" variant="outlined" label={`Rainfall: ${item.predicted_rainfall_mm} mm`} />
                    )}
                  </Box>
                </Box>

                <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed #c7dcd7' }}>
                  <Typography sx={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#46566c', fontWeight: 700, mb: 0.25 }}>
                    Location Scope
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#5f7488' }}>
                    {item.district}{item.mandal ? ` • ${item.mandal}` : ''}{item.gp_name ? ` • ${item.gp_name}` : ''}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}

export default Recommend
