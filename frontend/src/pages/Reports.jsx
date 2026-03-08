import { useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import {
  Autorenew as RegenerateIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  InfoOutlined as InfoIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
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

const SECTION_TITLES = [
  'ELIGIBILITY',
  'BENEFITS',
  'HOW TO APPLY',
  'DOCUMENTS REQUIRED',
  'DEADLINES',
  'FINANCIAL DETAILS',
  'COMMON PITFALLS',
  'PRACTICAL TIPS',
  'HELPLINE',
]

function parseReportText(reportText) {
  if (!reportText) {
    return {
      question: '',
      confidence: 0,
      sections: {},
      retrieval: { schemes_index_docs: 0, citizen_faq_index_docs: 0, processing_time_seconds: 0 },
    }
  }

  const question = (reportText.match(/Question:\s*(.*)/) || [])[1] || ''
  const confidence = Number(((reportText.match(/Confidence:\s*(\d+)%/) || [])[1] || 0))

  const retrieval = {
    schemes_index_docs: Number(((reportText.match(/schemes_index docs:\s*(\d+)/) || [])[1] || 0)),
    citizen_faq_index_docs: Number(((reportText.match(/citizen_faq_index docs:\s*(\d+)/) || [])[1] || 0)),
    processing_time_seconds: Number(((reportText.match(/processing_time_seconds:\s*([\d.]+)/) || [])[1] || 0)),
  }

  const sections = {}
  const sectionRegex = /(^|\n)([A-Z][A-Z\s/]+)\n[-]{10,}\n([\s\S]*?)(?=\n[A-Z][A-Z\s/]+\n[-]{10,}\n|\nRETRIEVAL SUMMARY\n[-]{10,}\n|$)/g
  let match = sectionRegex.exec(reportText)
  while (match) {
    const title = (match[2] || '').trim()
    const content = (match[3] || '').trim()
    if (SECTION_TITLES.includes(title)) {
      sections[title] = content
    }
    match = sectionRegex.exec(reportText)
  }

  return { question, confidence, sections, retrieval }
}

function MetricCard({ label, value }) {
  return (
    <Paper sx={{ p: 2, border: '1px solid #c7dcd7', backgroundColor: '#f8f2e8', textAlign: 'center' }}>
      <Typography sx={{ fontSize: 44, lineHeight: 1, fontWeight: 700, color: '#0f766e' }}>{value}</Typography>
      <Typography sx={{ mt: 1, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#46566c', fontWeight: 700 }}>
        {label}
      </Typography>
    </Paper>
  )
}

function normalizeLine(line) {
  return (line || '')
    .replace(/^#{1,6}\s*/, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .trim()
}

function renderSectionContent(content) {
  const rawLines = (content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const cleaned = normalizeLine(line)
      if (/^[-*]\s+/.test(cleaned)) return `• ${cleaned.replace(/^[-*]\s+/, '')}`
      if (/^\d+\.\s+/.test(cleaned)) return cleaned
      return cleaned
    })
    .filter(Boolean)

  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {rawLines.map((line, idx) => (
        <Typography key={`line-${idx}`} sx={{ lineHeight: 1.7, color: 'inherit' }}>
          {line}
        </Typography>
      ))}
    </Box>
  )
}

function SectionCard({ title, content, accent = '#22334d' }) {
  return (
    <Paper
      sx={{
        p: 2.5,
        minHeight: 190,
        backgroundColor: '#ffffff',
        border: '1px solid rgba(151, 182, 176, 0.55)',
        borderRadius: '12px',
        boxShadow: '0 8px 24px rgba(34, 51, 77, 0.06)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, rgba(15,118,110,0.6), rgba(42,162,148,0.08))',
        },
        '&:hover': {
          transform: 'translateY(-2px)',
          borderColor: 'rgba(82, 146, 136, 0.55)',
          boxShadow: '0 14px 30px rgba(34, 51, 77, 0.1)',
        },
      }}
    >
      <Typography sx={{ fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#46566c', fontWeight: 800 }}>
        {title}
      </Typography>
      <Box sx={{ mt: 1, mb: 1.5, height: 1, background: 'linear-gradient(90deg, #b8d4ce 0%, rgba(184,212,206,0.25) 100%)' }} />
      <Box sx={{ color: accent }}>
        {content ? renderSectionContent(content) : (
          <Typography sx={{ lineHeight: 1.7 }}>No data available.</Typography>
        )}
      </Box>
    </Paper>
  )
}

function ContextDialog({ open, onClose, chunks }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Retrieved Context
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {!chunks.length ? (
          <Typography variant="body2" color="text.secondary">No retrieved chunks.</Typography>
        ) : (
          <Grid container spacing={2}>
            {chunks.map((chunk, idx) => (
              <Grid item xs={12} md={6} key={`${chunk.id || idx}-${idx}`}>
                <Paper sx={{ p: 2, border: '1px solid #c7dcd7', height: '100%', backgroundColor: '#f8f2e8' }}>
                  <Typography sx={{ fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#0f766e', fontWeight: 800 }}>
                    {(chunk.collection || 'unknown').replaceAll('_', ' ')}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#46566c', mt: 0.5, mb: 1 }}>{chunk.source || 'source'}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#5f7488', mb: 1 }}>Score: {(Number(chunk.score || 0)).toFixed(3)}</Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#22334d' }}>{chunk.text || ''}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>
    </Dialog>
  )
}

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

  const [contextOpen, setContextOpen] = useState(false)
  const [contextChunks, setContextChunks] = useState([])

  const sortedReports = useMemo(
    () => [...reports].sort((a, b) => new Date(b.generated_at) - new Date(a.generated_at)),
    [reports],
  )

  const parsedReport = useMemo(() => parseReportText(activeReport?.report_text || ''), [activeReport?.report_text])
  const retrievalSummary = activeReport?.retrieval_summary || parsedReport.retrieval
  const sectionMap = useMemo(() => {
    const mapped = {}
    const fromApi = Array.isArray(activeReport?.sections) ? activeReport.sections : []
    fromApi.forEach((item) => {
      if (item?.title) mapped[item.title] = item.content || ''
    })
    return Object.keys(mapped).length ? mapped : parsedReport.sections
  }, [activeReport?.sections, parsedReport.sections])

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

  const openContext = (chunks = []) => {
    setContextChunks(Array.isArray(chunks) ? chunks : [])
    setContextOpen(true)
  }

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', display: 'grid', gap: 2 }}>
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
          <Paper sx={{ mt: 2, p: 2, border: '1px solid #b7d8d2' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography sx={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#46566c', fontWeight: 800 }}>
                Query Result
              </Typography>
              {!!(queryResult.context_chunks || []).length && (
                <IconButton size="small" onClick={() => openContext(queryResult.context_chunks)}>
                  <InfoIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <Typography variant="body1" sx={{ mb: 1.5, color: '#1a2333', fontWeight: 600 }}>{queryResult.question}</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{queryResult.answer}</Typography>
            <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`${Math.round((queryResult.confidence || 0) * 100)}% confidence`} />
              {(queryResult.sources || []).map((src) => (
                <Chip key={src} size="small" label={src} variant="outlined" />
              ))}
            </Box>
          </Paper>
        )}
      </Paper>

      <Paper sx={{ p: 2.5, border: '1px solid #c7dcd7' }}>
        <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>Generate Report (Dedicated 10 Questions)</Typography>
        <TextField
          fullWidth
          label="Report Topic"
          placeholder="e.g. what is ayush bharat health account?"
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Generated Report</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {!!(activeReport?.context_chunks || []).length && (
              <IconButton size="small" onClick={() => openContext(activeReport.context_chunks)}>
                <InfoIcon fontSize="small" />
              </IconButton>
            )}
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
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Paper sx={{ p: 2.5, border: '1px solid #9bd4cb' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Box>
                  <Typography sx={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#46566c', fontWeight: 800 }}>
                    Query Result
                  </Typography>
                  <Typography sx={{ mt: 1, fontSize: 28, color: '#1a2333', fontWeight: 600, lineHeight: 1.3 }}>
                    {parsedReport.question || activeReport.question}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'start', flexWrap: 'wrap' }}>
                  <Chip label="CACHED" size="small" sx={{ backgroundColor: '#f8f2e8', border: '1px solid #f1c78f', color: '#9b6b2e', fontWeight: 700 }} />
                  <Chip label={`${parsedReport.confidence || Math.round((activeReport.confidence || 0) * 100)}% CONFIDENCE`} size="small" sx={{ backgroundColor: '#d8ece8', border: '1px solid #9bd4cb', color: '#0f766e', fontWeight: 700 }} />
                </Box>
              </Box>
            </Paper>

            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <MetricCard label="Scheme Docs" value={retrievalSummary.schemes_index_docs || 0} />
              </Grid>
              <Grid item xs={12} md={4}>
                <MetricCard label="FAQ Docs" value={retrievalSummary.citizen_faq_index_docs || 0} />
              </Grid>
              <Grid item xs={12} md={4}>
                <MetricCard
                  label="Process Time"
                  value={`${Number(retrievalSummary.processing_time_seconds || 0).toFixed(2)}s`}
                />
              </Grid>
            </Grid>

            {(Number(retrievalSummary.schemes_index_docs || 0) + Number(retrievalSummary.citizen_faq_index_docs || 0) === 0) && (
              <Alert severity="info">
                No indexed chunks were retrieved for this topic yet. Ingest scheme/FAQ documents to see non-zero retrieval.
              </Alert>
            )}

            <Box
              sx={{
                columnCount: { xs: 1, md: 2 },
                columnGap: 2,
              }}
            >
              {SECTION_TITLES.map((title) => (
                <Box
                  key={title}
                  sx={{
                    breakInside: 'avoid',
                    mb: 2,
                  }}
                >
                  <SectionCard
                    title={title}
                    content={sectionMap[title] || ''}
                    accent={title === 'HELPLINE' ? '#0f766e' : '#22334d'}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: '#5f7488' }}>
            Select a saved report or generate a new one.
          </Typography>
        )}
      </Paper>

      <ContextDialog open={contextOpen} onClose={() => setContextOpen(false)} chunks={contextChunks} />
    </Box>
  )
}

export default Reports
