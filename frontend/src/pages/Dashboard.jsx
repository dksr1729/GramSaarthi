import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  MenuItem,
  Button,
  Alert,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  WaterDrop as WaterIcon,
  Landscape as LandscapeIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  TrendingUp as ForecastIcon,
  ExpandMore as ExpandMoreIcon,
  Send as SendIcon,
  Agriculture as AgricultureIcon,
  Forum as ForumIcon,
} from '@mui/icons-material'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function getRiskTone(level) {
  if (level === 'SEVERE') return { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239' }
  if (level === 'MODERATE') return { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }
  if (level === 'MILD') return { bg: '#f8fafc', border: '#cbd5e1', text: '#334155' }
  return { bg: '#f0fdfa', border: '#99f6e4', text: '#065f46' }
}

function formatMonthLabel(raw) {
  const value = String(raw || '').trim()
  const match = value.match(/^(\d{4})-(\d{2})$/)
  if (!match) return value
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  return new Date(year, month, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

function cleanTextLine(line) {
  return String(line || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .trim()
}

function parseCropBlocks(text) {
  const clean = String(text || '')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .trim()

  if (!clean) return []

  const blocks = clean
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.map((block) => {
    const lines = block
      .split('\n')
      .map(cleanTextLine)
      .filter(Boolean)

    const titleRaw = lines[0] || ''
    const monthFromLabel = titleRaw.match(/^Month:\s*(\w+\s+\d{4})(.*)$/i)
    const monthFromIso = titleRaw.match(/^Month:\s*(\d{4}-\d{2})(.*)$/i)

    let title = titleRaw
    if (monthFromIso) {
      title = `Month: ${formatMonthLabel(monthFromIso[1])}${monthFromIso[2] || ''}`
    } else if (monthFromLabel) {
      title = `Month: ${monthFromLabel[1]}${monthFromLabel[2] || ''}`
    }

    return {
      title,
      details: lines.slice(1).map((line) =>
        line
          .replace(/^Crop Suggestion:\s*/i, 'Crop: ')
          .replace(/^General Actions:\s*/i, 'General: ')
          .replace(/^Action:\s*/i, 'Action: '),
      ),
    }
  })
}

function Dashboard() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const [districtData, setDistrictData] = useState(null)
  const [dashboardData, setDashboardData] = useState(null)
  const [cropSuggestion, setCropSuggestion] = useState('')

  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState([])

  const [mandal, setMandal] = useState('')
  const [monthsAhead, setMonthsAhead] = useState(4)

  const canSelectMandal = !!dashboardData?.can_select_mandal
  const availableMandals = dashboardData?.available_mandals || districtData?.statistics?.available_mandals || []
  const cropBlocks = parseCropBlocks(cropSuggestion || dashboardData?.suggested_crops)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async (opts = {}) => {
    const { selectedMandal = '', months = monthsAhead } = opts
    setError('')

    try {
      const [districtRes, rainfallRes] = await Promise.all([
        api.get('/api/dashboard/district'),
        api.get('/api/dashboard/rainfall', {
          params: {
            mandal: selectedMandal,
            months_ahead: months,
          },
        }),
      ])

      const activeMandal = selectedMandal || rainfallRes.data?.location?.mandal || ''
      const cropsRes = await api.post('/api/dashboard/suggested-crops', {
        mandal: activeMandal,
        months_ahead: months,
      })

      setDistrictData(districtRes.data)
      setDashboardData(rainfallRes.data)
      setCropSuggestion(cropsRes.data?.suggested_crops || '')
      setMandal(activeMandal)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setError('')
    try {
      const response = await api.post('/api/dashboard/refresh', {
        mandal,
        months_ahead: monthsAhead,
      })
      setDashboardData(response.data)

      const cropsRes = await api.post('/api/dashboard/suggested-crops', {
        mandal: mandal || response.data?.location?.mandal || '',
        months_ahead: monthsAhead,
      })
      setCropSuggestion(cropsRes.data?.suggested_crops || '')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to refresh forecast')
    } finally {
      setRefreshing(false)
    }
  }

  const handleApplyMandal = async () => {
    setLoading(true)
    await fetchDashboardData({ selectedMandal: mandal, months: monthsAhead })
  }

  const handleChat = async () => {
    const question = chatInput.trim()
    if (!question) return

    setChatMessages((prev) => [...prev, { role: 'user', text: question }])
    setChatInput('')
    setChatLoading(true)

    try {
      const response = await api.post('/api/dashboard/chat', {
        question,
        mandal,
        months_ahead: monthsAhead,
      })

      setChatMessages((prev) => [...prev, { role: 'assistant', text: response.data?.answer || 'No answer available.' }])
    } catch (err) {
      setChatMessages((prev) => [...prev, { role: 'assistant', text: 'Failed to get answer from dashboard chat.' }])
    } finally {
      setChatLoading(false)
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
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 2, fontSize: { xs: '1.5rem', sm: '2rem' } }}>
        Rainfall Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: { xs: 1.5, sm: 2 }, border: '1px solid #c7dcd7', mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          {canSelectMandal && (
            <Grid item xs={12} md={4}>
              <TextField fullWidth select label="Mandal" value={mandal} onChange={(e) => setMandal(e.target.value)}>
                {availableMandals.map((item) => (
                  <MenuItem key={item} value={item}>{item}</MenuItem>
                ))}
              </TextField>
            </Grid>
          )}

          <Grid item xs={12} md={canSelectMandal ? 3 : 4}>
            <TextField
              fullWidth
              type="number"
              label="Forecast Months"
              value={monthsAhead}
              inputProps={{ min: 1, max: 6 }}
              onChange={(e) => setMonthsAhead(Number(e.target.value || 4))}
            />
          </Grid>

          {canSelectMandal && (
            <Grid item xs={12} md={2}>
              <Button variant="outlined" fullWidth onClick={handleApplyMandal}>Apply</Button>
            </Grid>
          )}

          <Grid item xs={12} md={canSelectMandal ? 3 : 8}>
            <Button
              variant="contained"
              fullWidth
              startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh Forecast'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #f5fbfa 0%, #e6f4f1 100%)', border: '1px solid #bddcd5' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WaterIcon sx={{ color: '#0f766e' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{districtData?.total_mandals || 0}</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#5f7488' }}>Total Mandals</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #fff8ef 0%, #f8f2e8 100%)', border: '1px solid #e7d4b7' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <LandscapeIcon sx={{ color: '#9b6b2e' }} />
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{districtData?.total_villages || 0}</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#5f7488' }}>Total Villages</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card sx={{ background: 'linear-gradient(135deg, #eef5ff 0%, #e6f0ff 100%)', border: '1px solid #c9d8f2' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon sx={{ color: '#315b9a' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{dashboardData?.location?.mandal || user?.mandal || 'N/A'}</Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#5f7488' }}>Selected Mandal</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, border: '1px solid #c7dcd7', borderRadius: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>Rainfall History + Forecast</Typography>
            <Typography variant="caption" sx={{ color: '#5f7488' }}>Scope: village users see their mandal forecast by design.</Typography>
            {(dashboardData?.data || []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dashboardData.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickFormatter={formatMonthLabel} />
                  <YAxis />
                  <Tooltip labelFormatter={(v) => formatMonthLabel(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="actual_rain_mm" name="Actual Rain (mm)" stroke="#0f766e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="forecast_rain_mm" name="Forecast Rain (mm)" stroke="#f4b860" strokeWidth={2} dot={false} strokeDasharray="6 4" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Typography sx={{ py: 4, textAlign: 'center', color: '#5f7488' }}>No rainfall records available for selected scope.</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, border: '1px solid #c7dcd7', borderRadius: 2, boxShadow: '0 6px 18px rgba(27,43,67,0.06)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25 }}>
              <ForecastIcon sx={{ color: '#0f766e' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Next Months Forecast</Typography>
            </Box>
            {(dashboardData?.forecast || []).length === 0 ? (
              <Typography sx={{ color: '#5f7488' }}>No forecast generated.</Typography>
            ) : (
              <Grid container spacing={1.5}>
                {dashboardData.forecast.map((row) => (
                  <Grid item xs={12} sm={6} md={6} lg={4} key={row.month}>
                    <Paper
                      sx={{
                        p: 1.5,
                        border: '1px solid #d7e4df',
                        borderRadius: 2,
                        backgroundColor: '#ffffff',
                        aspectRatio: { xs: 'auto', sm: '1 / 1' },
                        minHeight: { xs: 150, sm: 190 },
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography sx={{ fontWeight: 700, letterSpacing: '0.04em' }}>{formatMonthLabel(row.month)}</Typography>
                      <Box>
                        <Typography sx={{ fontSize: 32, fontWeight: 700, color: '#0f766e', lineHeight: 1 }}>{row.predicted_rain_mm}</Typography>
                        <Typography sx={{ fontSize: 12, color: '#5f7488' }}>mm rainfall</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
                        <Chip
                          size="small"
                          label={row.predicted_risk_level}
                          sx={{
                            backgroundColor: getRiskTone(row.predicted_risk_level).bg,
                            border: `1px solid ${getRiskTone(row.predicted_risk_level).border}`,
                            color: getRiskTone(row.predicted_risk_level).text,
                            fontWeight: 700,
                          }}
                        />
                        <Chip size="small" variant="outlined" label={`${row.confidence_pct}%`} />
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, border: '1px solid #c7dcd7', borderRadius: 2, boxShadow: '0 6px 18px rgba(27,43,67,0.06)', height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <ForumIcon sx={{ color: '#0f766e' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Rainfall Assistant</Typography>
            </Box>
            <Typography sx={{ fontSize: 12, color: '#5f7488', mb: 1.25 }}>
              Ask about rainfall trends, upcoming crops, and reasons based on your location + forecast context.
            </Typography>

            <Box sx={{ border: '1px solid #d7e4df', borderRadius: 2, p: 1.25, minHeight: 180, maxHeight: 320, overflowY: 'auto', mb: 1.25, backgroundColor: '#fff' }}>
              {chatMessages.length === 0 ? (
                <Typography sx={{ color: '#5f7488' }}>Try: "Why is March risk mild?" or "What crop should I plant in next 2 months?"</Typography>
              ) : (
                <Box sx={{ display: 'grid', gap: 1 }}>
                  {chatMessages.map((msg, idx) => (
                    <Box key={`msg-${idx}`} sx={{ p: 1, borderRadius: 1.5, border: '1px solid #e2ece8', backgroundColor: msg.role === 'user' ? '#f3f8ff' : '#f8fbfa' }}>
                      <Typography sx={{ fontSize: 12, color: '#5f7488', mb: 0.25, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {msg.role === 'user' ? 'You' : 'Assistant'}
                      </Typography>
                      <Typography sx={{ whiteSpace: 'pre-wrap', color: '#1a2333', lineHeight: 1.6 }}>{msg.text}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, flexDirection: { xs: 'column', sm: 'row' } }}>
              <TextField
                fullWidth
                placeholder="Ask about rainfall, crops, and reasons..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleChat()
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={handleChat}
                disabled={chatLoading || !chatInput.trim()}
                startIcon={chatLoading ? <CircularProgress size={14} color="inherit" /> : <SendIcon />}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Ask
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, border: '1px solid #c7dcd7', borderRadius: 2, boxShadow: '0 6px 18px rgba(27,43,67,0.06)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <AgricultureIcon sx={{ color: '#0f766e' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>Suggested Crops</Typography>
            </Box>
            <Typography sx={{ fontSize: 12, color: '#5f7488', mb: 1.25 }}>Based on forecasted rainfall</Typography>

            {cropBlocks.length > 0 ? (
              <Grid container spacing={1.5}>
                {cropBlocks.map((block, idx) => (
                  <Grid item xs={12} md={6} key={`crop-${idx}`}>
                    <Accordion
                      disableGutters
                      defaultExpanded={idx < 2}
                      sx={{
                        border: '1px solid #d7e4df',
                        borderRadius: '12px !important',
                        backgroundColor: '#ffffff',
                        boxShadow: 'none',
                        '&:before': { display: 'none' },
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 1.5 }}>
                        <Typography sx={{ fontWeight: 700, color: '#22334d' }}>{block.title}</Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ px: 1.5, pt: 0.25 }}>
                        <Box component="ul" sx={{ m: 0, pl: 2.2, display: 'grid', gap: 0.8 }}>
                          {block.details.map((line, lineIdx) => (
                            <Typography component="li" key={`crop-line-${idx}-${lineIdx}`} sx={{ lineHeight: 1.6, color: '#334155' }}>
                              {line}
                            </Typography>
                          ))}
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography sx={{ color: '#5f7488' }}>No crop recommendation available.</Typography>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}

export default Dashboard
