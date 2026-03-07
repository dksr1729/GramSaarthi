import { useState, useEffect } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import { getStates, getDistricts, getMandals, getVillages } from '../data/locationData'
import {
  Container,
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Link,
  Alert,
  CircularProgress,
  MenuItem,
  Grid,
} from '@mui/material'

function Register() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [formData, setFormData] = useState({
    gmail: '',
    password: '',
    name: '',
    persona: '',
    state: 'telangana',
    district: '',
    mandal: '',
    village: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [states, setStates] = useState([])
  const [districts, setDistricts] = useState([])
  const [mandals, setMandals] = useState([])
  const [villages, setVillages] = useState([])

  const personas = ['District Admin', 'Panchayat Officer', 'Rural User']

  useEffect(() => {
    setStates(getStates())
  }, [])

  useEffect(() => {
    if (formData.state) {
      setDistricts(getDistricts(formData.state))
      return
    }
    setDistricts([])
  }, [formData.state])

  useEffect(() => {
    if (formData.state && formData.district) {
      setMandals(getMandals(formData.state, formData.district))
      return
    }
    setMandals([])
  }, [formData.district])

  useEffect(() => {
    if (formData.state && formData.district && formData.mandal) {
      setVillages(getVillages(formData.state, formData.district, formData.mandal))
      return
    }
    setVillages([])
  }, [formData.mandal])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => {
      const next = { ...prev, [name]: value }

      if (name === 'state') {
        next.district = ''
        next.mandal = ''
        next.village = ''
      }

      if (name === 'district') {
        next.mandal = ''
        next.village = ''
      }

      if (name === 'mandal') {
        next.village = ''
      }

      if (name === 'persona' && value === 'District Admin') {
        next.mandal = ''
        next.village = ''
      }

      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/api/auth/register', formData)
      const { access_token, user } = response.data
      
      setAuth(user, access_token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isDistrictAdmin = formData.persona === 'District Admin'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        py: 4,
        background: 'linear-gradient(135deg, #FF9933 0%, #FFFFFF 50%, #138808 100%)',
      }}
    >
      <Container maxWidth="md">
        <Paper elevation={6} sx={{ p: 4, borderRadius: 3 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>
              Register for GramSaarthi
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Vision AI for Bharat
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="gmail"
                  type="email"
                  value={formData.gmail}
                  onChange={handleChange}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  inputProps={{ minLength: 6 }}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  select
                  label="Persona"
                  name="persona"
                  value={formData.persona}
                  onChange={handleChange}
                  required
                >
                  {personas.map((persona) => (
                    <MenuItem key={persona} value={persona}>
                      {persona}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="State"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  required
                >
                  {states.map((state) => (
                    <MenuItem key={state} value={state}>
                      {state.charAt(0).toUpperCase() + state.slice(1)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="District"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  required
                  disabled={!formData.state}
                >
                  {districts.map((district) => (
                    <MenuItem key={district} value={district}>
                      {district}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              {!isDistrictAdmin && (
                <>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label="Mandal"
                      name="mandal"
                      value={formData.mandal}
                      onChange={handleChange}
                      required
                      disabled={!formData.district}
                    >
                      {mandals.map((mandal) => (
                        <MenuItem key={mandal} value={mandal}>
                          {mandal}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      select
                      label="Village"
                      name="village"
                      value={formData.village}
                      onChange={handleChange}
                      required
                      disabled={!formData.mandal}
                    >
                      {villages.map((village) => (
                        <MenuItem key={village} value={village}>
                          {village}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                </>
              )}
            </Grid>

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 3, mb: 2, py: 1.5 }}
            >
              {loading ? <CircularProgress size={24} /> : 'Register'}
            </Button>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2">
                Already have an account?{' '}
                <Link component={RouterLink} to="/login" underline="hover">
                  Login here
                </Link>
              </Typography>
            </Box>
          </form>
        </Paper>
      </Container>
    </Box>
  )
}

export default Register
