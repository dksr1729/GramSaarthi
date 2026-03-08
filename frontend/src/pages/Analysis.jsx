import { useEffect, useState } from 'react'
import api from '../api/axios'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AutoAwesome as InsightIcon } from '@mui/icons-material'

function riskBandColor(riskBand) {
  if (riskBand === 'Very High') return 'error'
  if (riskBand === 'High') return 'warning'
  if (riskBand === 'Moderate') return 'info'
  return 'success'
}

function riskBandHex(riskBand) {
  if (riskBand === 'Very High') return '#dc2626'
  if (riskBand === 'High') return '#ea580c'
  if (riskBand === 'Moderate') return '#0284c7'
  return '#16a34a'
}

function Analysis() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [selectedMandal, setSelectedMandal] = useState('')
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    fetchAnalysis()
  }, [])

  const fetchAnalysis = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/analysis/drought-yearly', {
        params: { months_ahead: 12 },
      })
      setAnalysis(response.data)
      const first = response.data?.mandals?.[0]?.mandal || ''
      setSelectedMandal(first)
      setError('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load district drought analysis')
    } finally {
      setLoading(false)
    }
  }

  const normalizeAiText = (text) => {
    const cleaned = (text || '')
      .replace(/[*\-_]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const words = cleaned.split(' ').filter(Boolean)
    if (words.length <= 100) return cleaned
    return words.slice(0, 100).join(' ')
  }

  const buildCompactContext = () => {
    const rows = analysis?.mandals || []
    const summary = analysis?.summary || {}
    const top = rows.slice(0, 5).map((row) => ({
      mandal: row.mandal,
      annual: row.annual_drought_possibility_pct,
      severeMonths: row.severe_months,
      riskBand: row.risk_band,
    }))

    return {
      district: analysis?.district,
      horizonMonths: analysis?.months_ahead || 12,
      districtAvgAnnual: summary.avg_district_annual_possibility_pct || 0,
      totalMandals: summary.total_mandals || 0,
      highOrVeryHigh: summary.high_or_very_high_mandals || 0,
      topMandals: top,
    }
  }

  const generateAiSummary = async () => {
    if (!analysis) return
    setAiLoading(true)
    setAiError('')
    try {
      const context = buildCompactContext()
      const response = await api.post('/api/query', {
        query: `Provide exactly 100 words plain text drought situation analysis for district planning. Avoid markdown symbols and bullets. Avoid characters *, -, _. Keep it factual and action oriented.

Context:
${JSON.stringify(context)}`,
      })
      const text = normalizeAiText(response?.data?.response || '')
      setAiSummary(text || 'Analysis is currently unavailable. Please try again.')
    } catch (err) {
      setAiError('Failed to generate AI analysis. Please retry.')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  const rows = analysis?.mandals || []
  const summary = analysis?.summary || {}
  const topMandalsData = rows.slice(0, 10).map((row) => ({
    mandal: row.mandal,
    annual: row.annual_drought_possibility_pct,
    riskBand: row.risk_band,
  }))
  const bandCounts = rows.reduce((acc, row) => {
    const key = row.risk_band || 'Low'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const riskBandData = ['Very High', 'High', 'Moderate', 'Low'].map((band) => ({
    band,
    count: bandCounts[band] || 0,
  }))
  const selectedMandalRow = rows.find((row) => row.mandal === selectedMandal) || rows[0]
  const monthlyTrendData = (selectedMandalRow?.monthly_forecast || []).map((m) => ({
    month: m.month_label,
    drought_probability_pct: m.drought_probability_pct,
    severe_probability_pct: m.severe_probability_pct,
  }))

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
        Drought Analysis
      </Typography>
      <Typography sx={{ color: '#5f7488', mb: 3 }}>
        Next 1-year drought possibility across all mandals in {analysis?.district || 'your district'}.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!error && analysis && (
        <>
          <Paper
            sx={{
              p: 2,
              border: '1px solid #c7dcd7',
              borderRadius: 2,
              mb: 2.5,
              background: 'linear-gradient(135deg, #f7fbfa 0%, #eef7ff 100%)',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 1.2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InsightIcon sx={{ color: '#0f766e' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1d2b3a' }}>
                  AI Situation Analysis
                </Typography>
              </Box>
              <Button
                size="small"
                variant="contained"
                onClick={generateAiSummary}
                disabled={aiLoading}
                sx={{ backgroundColor: '#0f766e', '&:hover': { backgroundColor: '#0d685f' } }}
              >
                {aiLoading ? 'Generating...' : 'Generate 100-Word Analysis'}
              </Button>
            </Box>
            <Typography variant="caption" sx={{ color: '#5f7488', display: 'block', mb: 1 }}>
              Uses compact context from district summary and top mandals.
            </Typography>
            {aiError && (
              <Alert severity="error" sx={{ mb: 1 }}>
                {aiError}
              </Alert>
            )}
            <Paper sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid #d7e7e3', background: '#ffffff' }}>
              <Typography sx={{ color: '#22334d', lineHeight: 1.7, minHeight: 58 }}>
                {aiSummary || 'Click Generate to create a concise district situation analysis.'}
              </Typography>
            </Paper>
          </Paper>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, mb: 2.5 }}>
            <Paper sx={{ p: 2, border: '1px solid #c7dcd7', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: '#5f7488' }}>District</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1d2b3a' }}>{analysis.district}</Typography>
            </Paper>
            <Paper sx={{ p: 2, border: '1px solid #c7dcd7', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: '#5f7488' }}>Mandals Analysed</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1d2b3a' }}>{summary.total_mandals || 0}</Typography>
            </Paper>
            <Paper sx={{ p: 2, border: '1px solid #c7dcd7', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ color: '#5f7488' }}>District Avg Annual Drought Possibility</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1d2b3a' }}>
                {typeof summary.avg_district_annual_possibility_pct === 'number'
                  ? `${summary.avg_district_annual_possibility_pct}%`
                  : '-'}
              </Typography>
            </Paper>
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, mb: 2.5 }}>
            <Paper sx={{ p: 2, border: '1px solid #c7dcd7', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1d2b3a' }}>
                Top Mandals by Annual Drought Possibility
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={topMandalsData} margin={{ top: 5, right: 20, left: 0, bottom: 45 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mandal" angle={-30} textAnchor="end" interval={0} height={64} />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(value) => `${value}%`} />
                    <Bar dataKey="annual" name="Annual Possibility (%)">
                      {topMandalsData.map((entry) => (
                        <Cell key={entry.mandal} fill={riskBandHex(entry.riskBand)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>

            <Paper sx={{ p: 2, border: '1px solid #c7dcd7', borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1d2b3a' }}>
                Risk Band Distribution
              </Typography>
              <Box sx={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={riskBandData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="band" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" name="Mandals">
                      {riskBandData.map((entry) => (
                        <Cell key={entry.band} fill={riskBandHex(entry.band)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          </Box>

          <Paper sx={{ p: 2, border: '1px solid #c7dcd7', borderRadius: 2, mb: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1d2b3a' }}>
                Monthly Drought Trend ({selectedMandalRow?.mandal || '-'})
              </Typography>
              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel id="mandal-select-label">Select Mandal</InputLabel>
                <Select
                  labelId="mandal-select-label"
                  label="Select Mandal"
                  value={selectedMandal}
                  onChange={(e) => setSelectedMandal(e.target.value)}
                >
                  {rows.map((row) => (
                    <MenuItem key={row.mandal} value={row.mandal}>{row.mandal}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={monthlyTrendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="drought_probability_pct" name="Drought Probability (%)" stroke="#0f766e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="severe_probability_pct" name="Severe Probability (%)" stroke="#dc2626" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <TableContainer
            component={Paper}
            sx={{
              border: '1px solid #c7dcd7',
              borderRadius: 2,
              maxHeight: '65vh',
              overflow: 'auto',
            }}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Mandal</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Annual Drought Possibility</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Avg Monthly Probability</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Max Monthly Probability</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>High-Risk Months</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Severe Months</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Predominant Risk</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Risk Band</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.mandal} hover>
                    <TableCell>{row.mandal}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700, color: '#1d2b3a' }}>
                        {row.annual_drought_possibility_pct}%
                      </Typography>
                    </TableCell>
                    <TableCell>{row.avg_monthly_drought_probability_pct}%</TableCell>
                    <TableCell>{row.max_monthly_drought_probability_pct}%</TableCell>
                    <TableCell>{row.high_risk_months}</TableCell>
                    <TableCell>{row.severe_months}</TableCell>
                    <TableCell>{row.predominant_risk_level}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={riskBandColor(row.risk_band)}
                        label={row.risk_band}
                        variant="outlined"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  )
}

export default Analysis
