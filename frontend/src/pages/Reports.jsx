import { useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  MenuItem,
  Alert,
  CircularProgress,
  Grid,
  Chip,
} from '@mui/material'
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Autorenew as RegenerateIcon,
  Download as DownloadIcon,
} from '@mui/icons-material'

const schemeTypes = [
  { value: '', label: 'All schemes' },
  { value: 'health', label: 'Health' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'housing', label: 'Housing' },
  { value: 'education', label: 'Education' },
  { value: 'energy', label: 'Energy / LPG' },
  { value: 'employment', label: 'Employment' },
  { value: 'social', label: 'Social Welfare' },
]

function Reports() {
  const [question, setQuestion] = useState('')
  const [reportTopic, setReportTopic] = useState('')
  const [schemeTypeFilter, setSchemeTypeFilter] = useState('')
  const [topK, setTopK] = useState(8)

  const [reports, setReports] = useState([])
  const [selectedReportId, setSelectedReportId] = useState('')
  const [activeReport, setActiveReport] = useState(null)
  const [queryResult, setQueryResult] = useState(null)

  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [asking, setAsking] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [downloading, setDownloading] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at)),
    [reports],
  )

  const loadHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await api.get('/api/reports')
      setReports(response.data.reports || [])
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load report history.' })
    } finally {
      setLoadingHistory(false)
    }
  }

  const loadReport = async (reportId) => {
    if (!reportId) {
      setActiveReport(null)
      return
    }

    setLoadingReport(true)
    setMessage({ type: '', text: '' })
    try {
      const response = await api.get(`/api/reports/${reportId}`)
      setActiveReport(response.data)
      setReportTopic(response.data.question || '')
      setSchemeTypeFilter(response.data.scheme_type_filter || '')
      setTopK(response.data.top_k || 8)
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load selected report.' })
    } finally {
      setLoadingReport(false)
    }
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const handleAskQuestion = async () => {
    if (!question.trim()) {
      setMessage({ type: 'error', text: 'Question is required.' })
      return
    }

    setAsking(true)
    setMessage({ type: '', text: '' })
    try {
      const response = await api.post('/api/reports/query', {
        query: question,
        scheme_type_filter: schemeTypeFilter,
        top_k: topK,
      })
      setQueryResult(response.data)
      setMessage({ type: 'success', text: 'Query response generated.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to run query.' })
    } finally {
      setAsking(false)
    }
  }

  const handleGenerateReport = async () => {
    if (!reportTopic.trim()) {
      setMessage({ type: 'error', text: 'Report topic is required.' })
      return
    }

    setGenerating(true)
    setMessage({ type: '', text: '' })
    try {
      const response = await api.post('/api/reports/generate-standard', {
        topic: reportTopic,
        scheme_type_filter: schemeTypeFilter,
        top_k: topK,
      })

      setActiveReport(response.data)
      setSelectedReportId(response.data.report_id)
      await loadHistory()
      setMessage({ type: 'success', text: 'Report generated and saved to DynamoDB.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to generate report.' })
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async () => {
    if (!selectedReportId) return

    setRegenerating(true)
    setMessage({ type: '', text: '' })
    try {
      const response = await api.post(`/api/reports/${selectedReportId}/regenerate`)
      setActiveReport(response.data)
      setSelectedReportId(response.data.report_id)
      await loadHistory()
      setMessage({ type: 'success', text: 'Report regenerated and saved.' })
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to regenerate report.' })
    } finally {
      setRegenerating(false)
    }
  }

  const handleDownload = async (format) => {
    if (!selectedReportId) return

    setDownloading(format)
    try {
      const response = await api.get(`/api/reports/${selectedReportId}/download`, {
        params: { format },
        responseType: 'blob',
      })

      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `report-${selectedReportId}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to download report.' })
    } finally {
      setDownloading('')
    }
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', display: 'grid', gap: 2 }}>
      {message.text && <Alert severity={message.type}>{message.text}</Alert>}

      <Paper sx={{ p: 2.5, border: '1px solid #c7dcd7' }}>
        <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>Report History</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            select
            size="small"
            sx={{ minWidth: 360, maxWidth: '100%' }}
            value={selectedReportId}
            onChange={(e) => {
              const value = e.target.value
              setSelectedReportId(value)
              loadReport(value)
            }}
          >
            <MenuItem value="">Select saved report...</MenuItem>
            {sortedReports.map((report) => (
              <MenuItem key={report.report_id} value={report.report_id}>
                {report.question || report.report_id}
              </MenuItem>
            ))}
          </TextField>

          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadHistory} disabled={loadingHistory}>
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={regenerating ? <CircularProgress size={14} /> : <RegenerateIcon />}
            onClick={handleRegenerate}
            disabled={!selectedReportId || regenerating}
          >
            Regenerate
          </Button>
        </Box>
        <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#5f7488' }}>
          {sortedReports.length} saved report(s) in DynamoDB
        </Typography>
      </Paper>

      <Paper sx={{ p: 2.5, border: '1px solid #c7dcd7' }}>
        <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>Question</Typography>
        <TextField
          fullWidth
          multiline
          minRows={3}
          placeholder="Ask a quick question..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          sx={{ mb: 1.5 }}
        />

        <Grid container spacing={2} sx={{ mb: 1.5 }}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              select
              label="Scheme Type Filter"
              value={schemeTypeFilter}
              onChange={(e) => setSchemeTypeFilter(e.target.value)}
            >
              {schemeTypes.map((item) => (
                <MenuItem key={item.value || 'all'} value={item.value}>{item.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="number"
              label="Top K"
              inputProps={{ min: 1, max: 20 }}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value || 8))}
            />
          </Grid>
        </Grid>

        <Button
          variant="outlined"
          startIcon={asking ? <CircularProgress size={16} /> : <SearchIcon />}
          onClick={handleAskQuestion}
          disabled={asking || !question.trim()}
        >
          {asking ? 'Running...' : 'Run Query'}
        </Button>

        {queryResult?.answer && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Quick Answer</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{queryResult.answer}</Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {(queryResult.sources || []).map((src) => (
                <Chip key={src} size="small" label={src} variant="outlined" />
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 2.5, border: '1px solid #c7dcd7' }}>
        <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>Generate Report (Dedicated 10 Questions)</Typography>
        <TextField
          fullWidth
          label="Report Topic"
          placeholder="e.g. what is PMAY"
          value={reportTopic}
          onChange={(e) => setReportTopic(e.target.value)}
          sx={{ mb: 1.5 }}
        />

        <Button
          variant="contained"
          startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
          onClick={handleGenerateReport}
          disabled={generating || !reportTopic.trim()}
        >
          {generating ? 'Generating...' : 'Generate Report'}
        </Button>
      </Paper>

      <Paper sx={{ p: 2.5, border: '1px solid #c7dcd7' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Generated Report</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={downloading === 'txt' ? <CircularProgress size={14} /> : <DownloadIcon />}
              onClick={() => handleDownload('txt')}
              disabled={!selectedReportId || downloading !== ''}
            >
              TXT
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={downloading === 'pdf' ? <CircularProgress size={14} /> : <DownloadIcon />}
              onClick={() => handleDownload('pdf')}
              disabled={!selectedReportId || downloading !== ''}
            >
              PDF
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={downloading === 'json' ? <CircularProgress size={14} /> : <DownloadIcon />}
              onClick={() => handleDownload('json')}
              disabled={!selectedReportId || downloading !== ''}
            >
              JSON
            </Button>
          </Box>
        </Box>

        {loadingReport ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Loading report...</Typography>
          </Box>
        ) : activeReport?.report_text ? (
          <Typography
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'Consolas, Monaco, monospace',
              fontSize: 13,
              lineHeight: 1.55,
              border: '1px solid #d7e4df',
              borderRadius: 1,
              p: 1.5,
              maxHeight: 620,
              overflow: 'auto',
              backgroundColor: '#fff',
            }}
          >
            {activeReport.report_text}
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ color: '#5f7488' }}>
            Select a saved report or generate a new one.
          </Typography>
        )}
      </Paper>
    </Box>
  )
}

export default Reports
