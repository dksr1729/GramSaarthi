import { useEffect, useState } from 'react'
import api from '../api/axios'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import {
  Send as SendIcon,
  Person as PersonIcon,
  SmartToy as BotIcon,
} from '@mui/icons-material'

const MAX_CARDS = 5
const MIN_CARDS = 3

const rankValue = (item) => {
  if (typeof item.recommendation_rank === 'number') return item.recommendation_rank
  return Number.MAX_SAFE_INTEGER
}

const scoreValue = (item) => {
  if (typeof item.recommendation_score === 'number') return item.recommendation_score
  return Number.NEGATIVE_INFINITY
}

function Recommend() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

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

  const sortedItems = [...items].sort((a, b) => {
    if (rankValue(a) !== rankValue(b)) return rankValue(a) - rankValue(b)
    return scoreValue(b) - scoreValue(a)
  })

  const displayCount = Math.min(MAX_CARDS, sortedItems.length)
  const hasMinimumCards = sortedItems.length >= MIN_CARDS
  const insightCards = sortedItems.slice(0, displayCount)

  const buildContextWindow = () =>
    insightCards
      .map((item, index) => {
        const signals = [
          item.theme ? `Theme: ${item.theme}` : null,
          item.sector ? `Sector: ${item.sector}` : null,
          item.priority_tier ? `Tier: ${item.priority_tier}` : null,
          typeof item.recommendation_score === 'number' ? `Score: ${item.recommendation_score}` : null,
          item.predicted_drought_flag ? `Risk: ${item.predicted_drought_flag}` : null,
          typeof item.predicted_rainfall_mm === 'number' ? `Rainfall: ${item.predicted_rainfall_mm} mm` : null,
        ]
          .filter(Boolean)
          .join(', ')

        return `${index + 1}. ${item.title}
- Action: ${item.what_to_do || 'Not specified'}
- Signals: ${signals || 'Not specified'}
- Location: ${item.district || '-'}${item.mandal ? ` • ${item.mandal}` : ''}${item.gp_name ? ` • ${item.gp_name}` : ''}`
      })
      .join('\n')

  useEffect(() => {
    if (!insightCards.length) return
    setChatMessages([
      {
        id: 1,
        type: 'bot',
        text: `You are viewing ${insightCards.length} budget insight cards. Ask about priorities, risk, budget focus, or local action planning.`,
      },
    ])
  }, [insightCards.length])

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !insightCards.length) return

    const userMessage = { id: Date.now(), type: 'user', text: chatInput.trim() }
    setChatMessages((prev) => [...prev, userMessage])
    setChatInput('')
    setChatLoading(true)

    try {
      const context = buildContextWindow()
      const response = await api.post('/api/query', {
        query: `${userMessage.text}

Context Window (Budget Insight Cards):
${context}

Answer strictly using this context window and clearly mention when detail is unavailable in the context.`,
      })

      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: response.data.response || 'Unable to generate a response from the current context.',
      }
      setChatMessages((prev) => [...prev, botMessage])
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          type: 'bot',
          text: 'I could not process that question right now. Please try again.',
        },
      ])
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

      {!insightCards.length ? (
        <Paper sx={{ p: 4, textAlign: 'center', border: '1px solid #c7dcd7' }}>
          <Typography color="text.secondary">No budget insights are available for your current location scope.</Typography>
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={8}>
            {!hasMinimumCards && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Only {insightCards.length} insight card(s) are available right now. This view targets 3-5 cards when data allows.
              </Alert>
            )}
            <Grid container spacing={2.5}>
              {insightCards.map((item, idx) => (
                <Grid item xs={12} sm={6} key={`${item.title}-${item.gp_name}-${idx}`}>
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
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper
              sx={{
                p: 2,
                border: '1px solid #c7dcd7',
                borderRadius: 2,
                background: '#fff',
                boxShadow: '0 8px 18px rgba(27,43,67,0.06)',
                height: { xs: 380, md: 520 },
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <BotIcon sx={{ color: '#0f766e', fontSize: '1.1rem' }} />
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1d2b3a' }}>
                  Budget Chat
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: '#5f7488', mb: 1 }}>
                Context-aware answers from the displayed {insightCards.length} cards
              </Typography>
              <Divider sx={{ mb: 1.5 }} />

              <Box
                sx={{
                  flexGrow: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  pr: 0.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {chatMessages.map((msg) => (
                  <Box
                    key={msg.id}
                    sx={{
                      display: 'flex',
                      justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                      gap: 0.75,
                      alignItems: 'flex-start',
                    }}
                  >
                    {msg.type === 'bot' && <PersonIcon sx={{ mt: 0.5, color: '#0f766e', fontSize: '1rem' }} />}
                    <Box
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        maxWidth: '88%',
                        fontSize: 13,
                        lineHeight: 1.45,
                        background: msg.type === 'user' ? '#0f766e' : '#f1f5f4',
                        color: msg.type === 'user' ? '#fff' : '#1f2937',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {msg.text}
                    </Box>
                  </Box>
                ))}
                {chatLoading && (
                  <Typography variant="caption" sx={{ color: '#5f7488' }}>
                    Thinking...
                  </Typography>
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={chatInput}
                  placeholder="Ask about these cards..."
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={chatLoading}
                />
                <Button
                  variant="contained"
                  onClick={handleSendMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  sx={{ minWidth: 'auto', px: 1.2 }}
                >
                  <SendIcon sx={{ fontSize: '1rem' }} />
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  )
}

export default Recommend
