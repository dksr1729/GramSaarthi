import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  InsertDriveFile as FileIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material'

function Ingest() {
  const { user } = useAuthStore()
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [uploadedFiles, setUploadedFiles] = useState([])

  // Check if user is District Admin
  if (user?.persona !== 'District Admin') {
    return (
      <Box>
        <Alert severity="error">
          Access Denied. Only District Admins can access this page.
        </Alert>
      </Box>
    )
  }

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(file)
      setMessage({ type: '', text: '' })
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'Please select a file first.' })
      return
    }

    setUploading(true)
    setMessage({ type: '', text: '' })

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await api.post('/api/ingest', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      setMessage({ type: 'success', text: response.data.message || 'File uploaded successfully!' })
      setUploadedFiles([...uploadedFiles, {
        filename: response.data.filename,
        file_id: response.data.file_id,
        status: response.data.status,
      }])
      setSelectedFile(null)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to upload file. Please try again.',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
        Data Ingestion
      </Typography>

      <Paper sx={{ p: 4, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
          Upload Files
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Upload CSV, PDF, Excel, or other data files for processing and analysis.
        </Typography>

        {message.text && (
          <Alert severity={message.type} sx={{ mb: 2 }}>
            {message.text}
          </Alert>
        )}

        <Box
          sx={{
            border: '2px dashed',
            borderColor: 'primary.main',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            mb: 2,
            backgroundColor: 'background.default',
          }}
        >
          <UploadIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="body1" gutterBottom>
            {selectedFile ? selectedFile.name : 'Drag and drop a file here or click to browse'}
          </Typography>
          <Button
            variant="contained"
            component="label"
            sx={{ mt: 2 }}
          >
            Select File
            <input
              type="file"
              hidden
              onChange={handleFileSelect}
              accept=".csv,.pdf,.xlsx,.xls,.json,.txt"
            />
          </Button>
        </Box>

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          startIcon={uploading ? <CircularProgress size={20} /> : <UploadIcon />}
        >
          {uploading ? 'Uploading...' : 'Upload File'}
        </Button>
      </Paper>

      {uploadedFiles.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Uploaded Files
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <List>
            {uploadedFiles.map((file, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {file.status === 'processing' ? (
                    <CircularProgress size={24} />
                  ) : (
                    <SuccessIcon color="success" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={file.filename}
                  secondary={`Status: ${file.status}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  )
}

export default Ingest
