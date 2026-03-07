import { useState, useEffect } from 'react'
import api from '../api/axios'
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  TextField,
  InputAdornment,
} from '@mui/material'
import {
  Search as SearchIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material'

function Schemes() {
  const [loading, setLoading] = useState(true)
  const [schemes, setSchemes] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredSchemes, setFilteredSchemes] = useState([])

  useEffect(() => {
    fetchSchemes()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = schemes.filter(
        (scheme) =>
          scheme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          scheme.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          scheme.category?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredSchemes(filtered)
    } else {
      setFilteredSchemes(schemes)
    }
  }, [searchQuery, schemes])

  const fetchSchemes = async () => {
    try {
      const response = await api.get('/api/schemes')
      setSchemes(response.data.schemes || [])
      setFilteredSchemes(response.data.schemes || [])
    } catch (err) {
      console.error('Error fetching schemes:', err)
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
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Government Schemes
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search schemes by name, description, or category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {filteredSchemes.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {searchQuery ? 'No schemes found matching your search.' : 'No schemes available.'}
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredSchemes.map((scheme) => (
            <Grid item xs={12} md={6} key={scheme.scheme_id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                      {scheme.name}
                    </Typography>
                    {scheme.category && (
                      <Chip label={scheme.category} color="primary" size="small" />
                    )}
                  </Box>

                  <Typography variant="body2" color="text.secondary" paragraph>
                    {scheme.description}
                  </Typography>

                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      Eligibility:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {scheme.eligibility}
                    </Typography>
                  </Box>

                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                      Application Process:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {scheme.application_process}
                    </Typography>
                  </Box>

                  {scheme.deadline && (
                    <Box sx={{ mt: 2 }}>
                      <Chip
                        label={`Deadline: ${scheme.deadline}`}
                        color={new Date(scheme.deadline) < new Date() ? 'error' : 'success'}
                        size="small"
                      />
                    </Box>
                  )}

                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Source: {scheme.source}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions>
                  <Button size="small" startIcon={<OpenIcon />}>
                    Learn More
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}

export default Schemes
