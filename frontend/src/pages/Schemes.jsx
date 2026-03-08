import { useState, useEffect } from 'react'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  CircularProgress,
  Paper,
  TextField,
  Alert,
} from '@mui/material'
import {
  Download as DownloadIcon,
  Description as DescriptionIcon,
  UploadFile as UploadFileIcon,
} from '@mui/icons-material'

function Schemes() {
  const { user } = useAuthStore()
  const isDistrictAdmin = user?.persona === 'District Admin'
  const [loading, setLoading] = useState(true)
  const [schemeFiles, setSchemeFiles] = useState([])
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    fetchSchemes()
  }, [])

  const fetchSchemes = async () => {
    try {
      const response = await api.get('/api/schemes')
      setSchemeFiles(response.data.schemes || [])
    } catch (err) {
      console.error('Error fetching schemes:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatSize = (bytes = 0) => {
    if (!bytes) return '0 KB'
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    return `${(kb / 1024).toFixed(1)} MB`
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      setMessage({ type: 'error', text: 'Please choose a file to upload.' })
      return
    }

    setUploading(true)
    setMessage({ type: '', text: '' })
    try {
      const payload = new FormData()
      payload.append('file', uploadFile)
      payload.append('title', uploadTitle)
      await api.post('/api/schemes/upload', payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setMessage({ type: 'success', text: 'File uploaded successfully.' })
      setUploadFile(null)
      setUploadTitle('')
      await fetchSchemes()
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to upload file.',
      })
    } finally {
      setUploading(false)
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
        Scheme Documents
      </Typography>

      {isDistrictAdmin && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Upload Document
          </Typography>
          {message.text && (
            <Alert severity={message.type} sx={{ mb: 2 }}>
              {message.text}
            </Alert>
          )}
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFileIcon />}
                fullWidth
              >
                {uploadFile ? uploadFile.name : 'Choose File'}
                <input
                  hidden
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </Button>
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                label="Title (optional)"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Display title for card"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                fullWidth
              >
                {uploading ? 'Uploading...' : 'Upload to S3'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {schemeFiles.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No files available in S3.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {schemeFiles.map((file) => (
            <Grid item xs={12} md={6} key={file.s3_key}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                      {file.title || file.file_name}
                    </Typography>
                    <DescriptionIcon color="primary" />
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {file.file_name}
                  </Typography>

                  <Box sx={{ mt: 2 }}>
                    <Chip
                      label={`Size: ${formatSize(file.size_bytes)}`}
                      size="small"
                      variant="outlined"
                      sx={{ mr: 1, mb: 1 }}
                    />
                    {file.last_modified && (
                      <Chip
                        label={`Updated: ${new Date(file.last_modified).toLocaleDateString()}`}
                        size="small"
                        variant="outlined"
                        sx={{ mb: 1 }}
                      />
                    )}
                  </Box>
                </CardContent>

                <CardActions>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<DownloadIcon />}
                    href={file.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    disabled={!file.download_url}
                  >
                    Download
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
