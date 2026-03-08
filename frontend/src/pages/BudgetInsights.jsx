import { useEffect, useState } from 'react'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import {
  Box,
  Grid,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  TextField,
  Button,
  Card,
  CardContent,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemText,
  Avatar,
} from '@mui/material'
import {
  Send as SendIcon,
  AttachMoney as BudgetIcon,
  Lightbulb as InsightIcon,
  Person as PersonIcon,
} from '@mui/icons-material'

function Programs() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [recommendations, setRecommendations] = useState([])
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  useEffect(() => {
    fetchRecommendations()
  }, [])

  const fetchRecommendations = async () => {
    try {
      const response = await api.get('/api/recommend', { params: { top_k: 12 } })
      const items = response.data.recommendations || []
      setRecommendations(items)
      if (items.length > 0) {
        setSelectedProgram(items[0])
        initializeChat(items[0])
      }
    } catch (err) {
      console.error('Error fetching recommendations:', err)
    } finally {
      setLoading(false)
    }
  }

  const initializeChat = (program) => {
    setChatMessages([
      {
        id: 1,
        type: 'bot',
        text: `I can help you with information about "${program.title}". Ask me about budget allocation, eligibility criteria, application process, or feasibility for your location. What would you like to know?`,
      },
    ])
  }

  const handleProgramSelect = (program) => {
    setSelectedProgram(program)
    initializeChat(program)
  }

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedProgram) return

    const userMessage = {
      id: chatMessages.length + 1,
      type: 'user',
      text: chatInput,
    }

    setChatMessages([...chatMessages, userMessage])
    setChatInput('')
    setChatLoading(true)

    try {
      const context = `Program: ${selectedProgram.title}\nTheme: ${selectedProgram.theme}\nSector: ${selectedProgram.sector}\nPriority: ${selectedProgram.priority_tier}`
      const response = await api.post('/api/query', {
        query: `${chatInput}\n\nContext: ${context}`,
      })

      const botMessage = {
        id: chatMessages.length + 2,
        type: 'bot',
        text: response.data.response || 'Sorry, I could not process your question.',
      }
      setChatMessages((prev) => [...prev, botMessage])
    } catch (err) {
      const errorMessage = {
        id: chatMessages.length + 2,
        type: 'bot',
        text: 'Sorry, I encountered an error. Please try again.',
      }
      setChatMessages((prev) => [...prev, errorMessage])
      console.error('Error sending message:', err)
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
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 3, flexShrink: 0 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Budget Insights
        </Typography>
        <Typography sx={{ color: '#5f7488', mt: 0.5 }}>
          Explore available programs and ask questions about budget, eligibility, and feasibility
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ flexGrow: 1, minHeight: 0 }}>
        {/* LEFT SIDE - Recommended Programs */}
        <Grid item xs={12} md={5} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Paper
            sx={{
              p: 2.5,
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              background: '#f8fafb',
              border: '1px solid #e0e7ff',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, flexShrink: 0 }}>
              <InsightIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Recommended Programs
              </Typography>
            </Box>
            <Divider sx={{ mb: 2, flexShrink: 0 }} />

            <Box sx={{ flexGrow: 1, overflow: 'auto', minHeight: 0 }}>
              {recommendations.length === 0 ? (
                <Typography color="text.secondary">No programs available</Typography>
              ) : (
                <List sx={{ p: 0 }}>
                  {recommendations.map((program, idx) => (
                    <ListItem
                      key={`${program.title}-${idx}`}
                      disablePadding
                      onClick={() => handleProgramSelect(program)}
                      sx={{
                        mb: 1.5,
                        p: 2,
                        borderRadius: 1.5,
                        cursor: 'pointer',
                        background: selectedProgram?.title === program.title ? '#e0e7ff' : '#fff',
                        border: selectedProgram?.title === program.title ? '2px solid #4f46e5' : '1px solid #e0e7ff',
                        transition: 'all 0.2s',
                        '&:hover': {
                          background: '#e0e7ff',
                          borderColor: '#4f46e5',
                        },
                      }}
                    >
                      <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 0.5 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1f2937' }}>
                            {program.title}
                          </Typography>
                          {program.recommendation_rank && (
                            <Chip size="small" label={`#${program.recommendation_rank}`} color="primary" variant="outlined" />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                          {program.theme && (
                            <Chip size="small" variant="outlined" label={program.theme} sx={{ fontSize: '0.7rem' }} />
                          )}
                          {program.sector && (
                            <Chip size="small" variant="outlined" label={program.sector} sx={{ fontSize: '0.7rem' }} />
                          )}
                        </Box>

                        {program.description && (
                          <Typography variant="caption" sx={{ color: '#6b7280', display: 'block', lineHeight: 1.4 }}>
                            {program.description.length > 100 ? `${program.description.substring(0, 100)}...` : program.description}
                          </Typography>
                        )}
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* RIGHT SIDE - Chatbot */}
        <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Paper
            sx={{
              p: 2.5,
              flexGrow: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              background: '#fff',
              border: '1px solid #e0e7ff',
              borderRadius: 2,
            }}
          >
            {/* Selected Program Header */}
            {selectedProgram && (
              <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <BudgetIcon sx={{ color: 'primary.main' }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {selectedProgram.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      {selectedProgram.theme} • {selectedProgram.sector}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}

            {/* Chat Messages */}
            <Box
              sx={{
                flexGrow: 1,
                overflowY: 'auto',
                mb: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                pr: 1,
                minHeight: 0,
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  background: '#f1f5f9',
                  borderRadius: '10px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: '#cbd5e1',
                  borderRadius: '10px',
                  '&:hover': {
                    background: '#94a3b8',
                  },
                },
              }}
            >
              {chatMessages.map((msg) => (
                <Box
                  key={msg.id}
                  sx={{
                    display: 'flex',
                    justifyContent: msg.type === 'user' ? 'flex-end' : 'flex-start',
                    alignItems: 'flex-start',
                    gap: 1,
                  }}
                >
                  {msg.type === 'bot' && <PersonIcon sx={{ mt: 0.5, color: 'primary.main', fontSize: '1.2rem' }} />}
                  <Paper
                    sx={{
                      p: 1.5,
                      maxWidth: '75%',
                      background: msg.type === 'user' ? '#4f46e5' : '#f3f4f6',
                      color: msg.type === 'user' ? '#fff' : '#1f2937',
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                      {msg.text}
                    </Typography>
                  </Paper>
                </Box>
              ))}
              {chatLoading && (
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <PersonIcon sx={{ color: 'primary.main', fontSize: '1.2rem' }} />
                  <Paper sx={{ p: 1.5, background: '#f3f4f6' }}>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#9ca3af',
                          animation: 'bounce 1.4s infinite',
                        }}
                      />
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#9ca3af',
                          animation: 'bounce 1.4s infinite',
                          animationDelay: '0.2s',
                        }}
                      />
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: '#9ca3af',
                          animation: 'bounce 1.4s infinite',
                          animationDelay: '0.4s',
                          '@keyframes bounce': {
                            '0%, 80%, 100%': { opacity: 0.3, transform: 'translateY(0)' },
                            '40%': { opacity: 1, transform: 'translateY(-8px)' },
                          },
                        }}
                      />
                    </Box>
                  </Paper>
                </Box>
              )}
            </Box>

            {/* Chat Input */}
            <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ask about budget, eligibility, or feasibility..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                disabled={chatLoading || !selectedProgram}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1.5,
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || chatLoading || !selectedProgram}
                sx={{ minWidth: 'auto' }}
              >
                <SendIcon />
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          40% {
            opacity: 1;
            transform: translateY(-8px);
          }
        }
      `}</style>
    </Box>
  )
}

export default Programs
