import { useState, useEffect } from 'react'
import api from '../api/axios'
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material'
import {
  Send as SendIcon,
  Download as DownloadIcon,
  Description as ReportIcon,
} from '@mui/icons-material'

function Reports() {
  const [loading, setLoading] = useState(false)
  const [reports, setReports] = useState([])
  const [query, setQuery] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [sessionId, setSessionId] = useState(null)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const response = await api.get('/api/reports')
      setReports(response.data.reports || [])
    } catch (err) {
      console.error('Error fetching reports:', err)
    }
  }

  const handleSendQuery = async () => {
    if (!query.trim()) return

    const userMessage = { role: 'user', content: query }
    setChatHistory([...chatHistory, userMessage])
    setQuery('')
    setLoading(true)

    try {
      const response = await api.post('/api/query', {
        query,
        session_id: sessionId,
      })

      const assistantMessage = {
        role: 'assistant',
        content: response.data.response,
        sources: response.data.sources,
        confidence: response.data.confidence,
      }

      setChatHistory([...chatHistory, userMessage, assistantMessage])
      setSessionId(response.data.session_id)
    } catch (err) {
      console.error('Error sending query:', err)
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
      }
      setChatHistory([...chatHistory, userMessage, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendQuery()
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Reports & Chatbot
      </Typography>

      <Grid container spacing={3}>
        {/* Chatbot Section */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '600px', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Ask Questions
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Chat History */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', mb: 2 }}>
              {chatHistory.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">
                    Start a conversation by asking a question about schemes, forecasts, or reports.
                  </Typography>
                </Box>
              ) : (
                chatHistory.map((message, index) => (
                  <Box
                    key={index}
                    sx={{
                      mb: 2,
                      display: 'flex',
                      justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <Paper
                      sx={{
                        p: 2,
                        maxWidth: '70%',
                        backgroundColor: message.role === 'user' ? 'primary.light' : 'grey.100',
                      }}
                    >
                      <Typography variant="body1">{message.content}</Typography>
                      {message.sources && message.sources.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Sources: {message.sources.join(', ')}
                          </Typography>
                        </Box>
                      )}
                      {message.confidence && (
                        <Chip
                          label={`Confidence: ${(message.confidence * 100).toFixed(0)}%`}
                          size="small"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Paper>
                  </Box>
                ))
              )}
            </Box>

            {/* Input Area */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                multiline
                maxRows={3}
                placeholder="Ask a question..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
              />
              <Button
                variant="contained"
                onClick={handleSendQuery}
                disabled={loading || !query.trim()}
                sx={{ minWidth: '100px' }}
              >
                {loading ? <CircularProgress size={24} /> : <SendIcon />}
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Reports List */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Generated Reports
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {reports.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <ReportIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography color="text.secondary">
                  No reports generated yet.
                </Typography>
              </Box>
            ) : (
              reports.map((report) => (
                <Card key={report.report_id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {report.report_type} Report
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Generated: {new Date(report.generated_at).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button size="small" startIcon={<DownloadIcon />}>
                      Download
                    </Button>
                  </CardActions>
                </Card>
              ))
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}

export default Reports
